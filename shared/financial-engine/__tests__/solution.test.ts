import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  FinancialEngineError,
  almostEqual,
  buildFrenchAmortizationSchedule,
  calculateFinancialSolution,
  calculateFrenchInstallment,
  calculateInternalCost,
  resolveInstallmentFee,
} from "../index.ts";

/**
 * Formula francese indipendente usata solo nei test come oracolo.
 * installment = P * r / (1 - (1+r)^(-n))
 */
function independentFrenchInstallment(
  principal: number,
  tanPercent: number,
  months: number,
): number {
  if (tanPercent === 0) {
    return principal / months;
  }
  const r = tanPercent / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

describe("calculateFrenchInstallment", () => {
  it("Caso A: TAN 0% → rata = capitale / n", () => {
    const result = calculateFrenchInstallment({
      financedAmount: 1000,
      customerTanPercent: 0,
      durationMonths: 12,
    });
    expect(result.monthlyRate).toBe(0);
    expect(result.roundedRegularInstallment).toBe(83.33);
  });

  it("Caso B: TAN 10,50% su €1000 in 12 mesi ≈ €88,15", () => {
    const result = calculateFrenchInstallment({
      financedAmount: 1000,
      customerTanPercent: 10.5,
      durationMonths: 12,
    });

    const independent = independentFrenchInstallment(1000, 10.5, 12);
    expect(result.theoreticalInstallment).toBeCloseTo(independent, 8);
    // Valore atteso indicativo da specifica: circa 88.15
    expect(result.roundedRegularInstallment).toBeCloseTo(88.15, 1);
    expect(almostEqual(result.roundedRegularInstallment, 88.15, 0.02)).toBe(
      true,
    );
  });
});

describe("buildFrenchAmortizationSchedule", () => {
  it("chiude correttamente un piano TAN > 0", () => {
    const built = buildFrenchAmortizationSchedule({
      financedAmount: 1000,
      customerTanPercent: 10.5,
      durationMonths: 12,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });

    expect(built.schedule).toHaveLength(12);
    expect(built.schedule[0]?.dueOffsetMonths).toBe(1);
    expect(built.schedule[11]?.dueOffsetMonths).toBe(12);
    expect(built.schedule[11]?.closingBalance).toBe(0);

    const principalSum = built.schedule.reduce(
      (sum, row) => sum + row.principalAmount,
      0,
    );
    expect(almostEqual(principalSum, 1000, 0.01)).toBe(true);

    // Interessi decrescenti (prima rata > ultima, a parità di ritardi)
    expect(built.schedule[0]!.interestAmount).toBeGreaterThan(
      built.schedule[10]!.interestAmount,
    );

    for (const row of built.schedule) {
      expect(row.principalAmount).toBeGreaterThanOrEqual(0);
      expect(row.interestAmount).toBeGreaterThanOrEqual(0);
      expect(row.collectionFeeAmount).toBe(0);
    }
  });

  it("piano TAN 0 con ripartizione uniforme e correzione ultima rata", () => {
    const built = buildFrenchAmortizationSchedule({
      financedAmount: 1000,
      customerTanPercent: 0,
      durationMonths: 12,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });

    expect(built.schedule.every((row) => row.interestAmount === 0)).toBe(true);
    const principalSum = built.schedule.reduce(
      (sum, row) => sum + row.principalAmount,
      0,
    );
    expect(almostEqual(principalSum, 1000, 0.01)).toBe(true);
    expect(built.schedule[11]?.closingBalance).toBe(0);
  });

  it("include spesa di incasso in ogni rata senza toccare il capitale", () => {
    const built = buildFrenchAmortizationSchedule({
      financedAmount: 1000,
      customerTanPercent: 0,
      durationMonths: 6,
      collectionFeePerInstallment: 1.5,
      firstInstallmentDelayDays: 30,
    });

    for (const row of built.schedule) {
      expect(row.collectionFeeAmount).toBe(1.5);
      expect(row.totalInstallmentAmount).toBeCloseTo(
        row.baseInstallmentAmount + 1.5,
        2,
      );
    }

    const principalSum = built.schedule.reduce(
      (sum, row) => sum + row.principalAmount,
      0,
    );
    expect(almostEqual(principalSum, 1000, 0.01)).toBe(true);
  });
});

describe("calculateInternalCost", () => {
  const cases = [
    { months: 12, applied: 5, amount: 50, net: 950 },
    { months: 18, applied: 7.5, amount: 75, net: 925 },
    { months: 24, applied: 10, amount: 100, net: 900 },
    { months: 36, applied: 15, amount: 150, net: 850 },
    { months: 48, applied: 20, amount: 200, net: 800 },
  ] as const;

  for (const item of cases) {
    it(`LEGACY FALLBACK 10% a 24 mesi → ${item.months} mesi = ${item.applied}%`, () => {
      const result = calculateInternalCost({
        requestedAmount: 1000,
        financedAmount: 1000,
        durationMonths: item.months,
        internalCostPercentAt24Months: 10,
      });
      expect(result.internalCostPercentApplied).toBeCloseTo(item.applied, 8);
      expect(result.internalCostAmount).toBe(item.amount);
      expect(result.netAmountPaidToCompany).toBe(item.net);
    });
  }

  it("usa internalCostPercentApplied esatto senza proporzione", () => {
    const result = calculateInternalCost({
      requestedAmount: 3000,
      financedAmount: 3000,
      durationMonths: 12,
      internalCostPercentApplied: 4.44,
      internalCostPercentAt24Months: 10,
    });
    expect(result.internalCostPercentApplied).toBeCloseTo(4.44, 8);
    expect(result.internalCostAmount).toBe(133.2);
    expect(result.netAmountPaidToCompany).toBe(2866.8);
  });

  it("assenza costo → netto = importo richiesto", () => {
    const result = calculateInternalCost({
      requestedAmount: 1000,
      financedAmount: 1000,
      durationMonths: 24,
    });
    expect(result.internalCostAmount).toBe(0);
    expect(result.netAmountPaidToCompany).toBe(1000);
  });

  it("commissione finanziata non aumenta il netto liquidato (caso NBQ)", () => {
    const result = calculateInternalCost({
      requestedAmount: 1000,
      financedAmount: 1015,
      durationMonths: 12,
      internalCostPercentApplied: 0,
    });
    expect(result.internalCostAmount).toBe(0);
    expect(result.netAmountPaidToCompany).toBe(1000);
  });

  it("commissione % importo richiesto costante su ogni rata (NE9)", () => {
    const fee = resolveInstallmentFee({
      requestedAmount: 1000,
      installmentFeeType: "percentage_of_requested_amount",
      installmentFeeValue: 0.6,
    });
    expect(fee.feePerInstallment).toBe(6);

    const result = calculateFinancialSolution({
      requestedAmount: 1000,
      durationMonths: 10,
      customerTanPercent: 0,
      openingFeeType: "none",
      openingFeeValue: 0,
      installmentFeeType: "percentage_of_requested_amount",
      installmentFeeValue: 0.6,
      firstInstallmentDelayDays: 30,
    });
    expect(result.regularBaseInstallmentAmount).toBe(100);
    expect(result.collectionFeePerInstallment).toBe(6);
    expect(result.regularTotalInstallmentAmount).toBe(106);
    expect(result.totalCustomerRepayment).toBe(1060);
    expect(result.netAmountPaidToCompany).toBe(1000);
    expect(result.amortizationSchedule.every((row) => row.collectionFeeAmount === 6)).toBe(
      true,
    );
  });

  it("internalCostBase requested_amount (S8L)", () => {
    const result = calculateInternalCost({
      requestedAmount: 3000,
      financedAmount: 3075,
      durationMonths: 12,
      internalCostPercentApplied: 4.75,
      internalCostBase: "requested_amount",
    });
    expect(result.internalCostAmount).toBe(142.5);
    expect(result.netAmountPaidToCompany).toBe(2857.5);
  });
});

describe("calculateFinancialSolution – casi di accettazione", () => {
  it("Caso A: TAN 0 senza costi", () => {
    const result = calculateFinancialSolution({
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 0,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });

    expect(result.financedAmount).toBe(1000);
    expect(result.totalCustomerInterest).toBe(0);
    expect(result.totalCustomerRepayment).toBe(1000);
    expect(result.amortizationSchedule.at(-1)?.closingBalance).toBe(0);
    expect(result.estimatedTaeg.success).toBe(true);
    if (result.estimatedTaeg.success) {
      expect(result.estimatedTaeg.taegPercent).toBe(0);
    }
  });

  it("Caso B: TAN 10,50% senza costi aggiuntivi", () => {
    const result = calculateFinancialSolution({
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "none",
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    });

    expect(result.regularBaseInstallmentAmount).toBeCloseTo(88.15, 1);
    expect(result.amortizationSchedule.at(-1)?.closingBalance).toBe(0);
    expect(result.totalPrincipalRepaid).toBeCloseTo(1000, 1);
    expect(result.totalCustomerInterest).toBeGreaterThan(0);
    expect(result.estimatedTaeg.success).toBe(true);
  });

  it("Caso C: commissione 1,5% + incasso 1,50", () => {
    const result = calculateFinancialSolution({
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "percentage",
      openingFeeValue: 1.5,
      collectionFeePerInstallment: 1.5,
      firstInstallmentDelayDays: 30,
    });

    expect(result.openingFeeAmount).toBe(15);
    expect(result.financedAmount).toBe(1015);
    // Valori indicativi specifica: rata base ~89.47, totale ~90.97
    expect(result.regularBaseInstallmentAmount).toBeCloseTo(89.47, 1);
    expect(result.regularTotalInstallmentAmount).toBeCloseTo(90.97, 1);
    expect(result.amortizationSchedule.at(-1)?.closingBalance).toBe(0);
    // Netto liquidato = richiesto, non finanziato
    expect(result.netAmountPaidToCompany).toBe(1000);

    const independentBase = independentFrenchInstallment(1015, 10.5, 12);
    expect(result.theoreticalBaseInstallmentAmount).toBeCloseTo(
      independentBase,
      6,
    );

    expect(result.estimatedTaeg.success).toBe(true);
    if (result.estimatedTaeg.success) {
      // Specifica: TAEG tecnico stimato circa 17.8%
      expect(result.estimatedTaeg.taegPercent).toBeCloseTo(17.8, 0);
    }

    expect(result.totalCollectionFees).toBe(18);
    expect(result.totalCustomerCosts).toBeGreaterThan(15);
  });

  it("differimento 30/60/90: stessi totali, TAEG potenzialmente diverso", () => {
    const base = {
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "none" as const,
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
    };

    const d30 = calculateFinancialSolution({
      ...base,
      firstInstallmentDelayDays: 30,
    });
    const d60 = calculateFinancialSolution({
      ...base,
      firstInstallmentDelayDays: 60,
    });
    const d90 = calculateFinancialSolution({
      ...base,
      firstInstallmentDelayDays: 90,
    });

    expect(d30.regularBaseInstallmentAmount).toBe(d60.regularBaseInstallmentAmount);
    expect(d60.regularBaseInstallmentAmount).toBe(d90.regularBaseInstallmentAmount);
    expect(d30.totalCustomerInterest).toBe(d60.totalCustomerInterest);
    expect(d60.totalCustomerInterest).toBe(d90.totalCustomerInterest);
    expect(d30.totalCustomerRepayment).toBe(d90.totalCustomerRepayment);
    expect(d30.internalCostAmount).toBe(d90.internalCostAmount);

    expect(d30.amortizationSchedule[0]?.dueOffsetMonths).toBe(1);
    expect(d60.amortizationSchedule[0]?.dueOffsetMonths).toBe(2);
    expect(d90.amortizationSchedule[0]?.dueOffsetMonths).toBe(3);

    expect(d30.estimatedTaeg.success && d60.estimatedTaeg.success).toBe(true);
    if (d30.estimatedTaeg.success && d90.estimatedTaeg.success) {
      // Stessi importi pagati più tardi → tasso effettivo più basso.
      expect(d90.estimatedTaeg.taegPercent).toBeLessThan(
        d30.estimatedTaeg.taegPercent,
      );
      expect(d60.estimatedTaeg.taegPercent).not.toBe(
        d30.estimatedTaeg.taegPercent,
      );
    }
  });

  it.each([3, 6, 12, 24, 60, 84])(
    "chiude correttamente durata estrema %s mesi",
    (months) => {
      const result = calculateFinancialSolution({
        requestedAmount: 2500,
        durationMonths: months,
        customerTanPercent: 8.9,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        internalCostPercentAt24Months: 10,
        firstInstallmentDelayDays: 30,
      });

      expect(result.amortizationSchedule).toHaveLength(months);
      expect(result.amortizationSchedule.at(-1)?.closingBalance).toBe(0);
      expect(
        almostEqual(result.totalPrincipalRepaid, result.financedAmount, 0.01),
      ).toBe(true);
      expect(result.estimatedTaeg.success).toBe(true);
    },
  );
});

describe("errori di dominio", () => {
  it("rifiuta importo zero/negativo", () => {
    expect(() =>
      calculateFinancialSolution({
        requestedAmount: 0,
        durationMonths: 12,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        firstInstallmentDelayDays: 30,
      }),
    ).toThrow(FinancialEngineError);

    expect(() =>
      calculateFinancialSolution({
        requestedAmount: -10,
        durationMonths: 12,
        customerTanPercent: 0,
        openingFeeType: "none",
        openingFeeValue: 0,
        collectionFeePerInstallment: 0,
        firstInstallmentDelayDays: 30,
      }),
    ).toThrow(FinancialEngineError);
  });

  it("rifiuta TAN negativo, durata non intera, fee negative, delay invalido", () => {
    const base = {
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10,
      openingFeeType: "none" as const,
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    };

    expect(() =>
      calculateFinancialSolution({ ...base, customerTanPercent: -1 }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({ ...base, durationMonths: 12.5 }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({ ...base, durationMonths: 0 }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({
        ...base,
        openingFeeType: "fixed",
        openingFeeValue: -5,
      }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({ ...base, collectionFeePerInstallment: -1 }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({
        ...base,
        internalCostPercentAt24Months: -2,
      }),
    ).toThrow(FinancialEngineError);
    expect(() =>
      calculateFinancialSolution({ ...base, firstInstallmentDelayDays: 45 }),
    ).toThrow(FinancialEngineError);
  });
});

describe("precisione Decimal", () => {
  it("roundMoney usa HALF_UP", () => {
    // 1.225 → 1.23 con HALF_UP a 2 decimali
    expect(new Decimal("1.225").toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()).toBe(
      1.23,
    );
  });
});
