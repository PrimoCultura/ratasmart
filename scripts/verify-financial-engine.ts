/**
 * Harness di sviluppo — scenari tecnici demo, nessuna condizione ufficiale.
 */
import { calculateFinancialSolution } from "../shared/financial-engine/index.ts";

const scenarios = [
  {
    name: "A — TAN 0 senza costi",
    input: {
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 0,
      openingFeeType: "none" as const,
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    },
  },
  {
    name: "B — TAN 10,50%",
    input: {
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "none" as const,
      openingFeeValue: 0,
      collectionFeePerInstallment: 0,
      firstInstallmentDelayDays: 30,
    },
  },
  {
    name: "C — commissione 1,5% + incasso 1,50",
    input: {
      requestedAmount: 1000,
      durationMonths: 12,
      customerTanPercent: 10.5,
      openingFeeType: "percentage" as const,
      openingFeeValue: 1.5,
      collectionFeePerInstallment: 1.5,
      firstInstallmentDelayDays: 30,
    },
  },
] as const;

for (const scenario of scenarios) {
  const result = calculateFinancialSolution(scenario.input);
  const taeg = result.estimatedTaeg.success
    ? `${result.estimatedTaeg.taegPercent.toFixed(4)}%`
    : `ERR ${result.estimatedTaeg.errorCode}`;

  console.log(`\n=== ${scenario.name} ===`);
  console.log("input", scenario.input);
  console.log("rata regolare base", result.regularBaseInstallmentAmount);
  console.log("rata regolare totale", result.regularTotalInstallmentAmount);
  console.log("TAEG tecnico stimato", taeg);
  console.log("totale dovuto", result.totalCustomerRepayment);
  console.log("costo interno", result.internalCostAmount);
  console.log("netto liquidato", result.netAmountPaidToCompany);
  console.log(
    "saldo finale",
    result.amortizationSchedule.at(-1)?.closingBalance,
  );
}
