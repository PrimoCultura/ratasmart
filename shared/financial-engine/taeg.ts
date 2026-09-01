import { Decimal, toDecimal } from "./money.ts";
import type { AmortizationRow, CashFlow, TaegCalculationResult } from "./types.ts";

const DEFAULT_TOLERANCE = 1e-10;
const MAX_ITERATIONS = 200;

export function buildPatientCashFlows(input: {
  requestedAmount: number;
  schedule: AmortizationRow[];
}): CashFlow[] {
  const flows: CashFlow[] = [
    { periodMonths: 0, amount: input.requestedAmount },
  ];

  for (const row of input.schedule) {
    flows.push({
      periodMonths: row.dueOffsetMonths,
      amount: -row.totalInstallmentAmount,
    });
  }

  return flows;
}

function npv(flows: CashFlow[], monthlyRate: Decimal): Decimal {
  let value = new Decimal(0);
  for (const flow of flows) {
    const discount = new Decimal(1).plus(monthlyRate).pow(flow.periodMonths);
    if (discount.isZero()) {
      return new Decimal(NaN);
    }
    value = value.plus(toDecimal(flow.amount).div(discount));
  }
  return value;
}

function npvDerivative(flows: CashFlow[], monthlyRate: Decimal): Decimal {
  let value = new Decimal(0);
  for (const flow of flows) {
    if (flow.periodMonths === 0) {
      continue;
    }
    const onePlusR = new Decimal(1).plus(monthlyRate);
    const denom = onePlusR.pow(flow.periodMonths + 1);
    value = value.minus(
      toDecimal(flow.amount).mul(flow.periodMonths).div(denom),
    );
  }
  return value;
}

function hasMixedSigns(flows: CashFlow[]): boolean {
  let hasPositive = false;
  let hasNegative = false;
  for (const flow of flows) {
    if (flow.amount > 0) hasPositive = true;
    if (flow.amount < 0) hasNegative = true;
  }
  return hasPositive && hasNegative;
}

function annualize(monthlyRate: Decimal): {
  annualEffectiveRate: number;
  taegPercent: number;
} {
  const annual = new Decimal(1).plus(monthlyRate).pow(12).minus(1);
  return {
    annualEffectiveRate: annual.toNumber(),
    taegPercent: annual.mul(100).toNumber(),
  };
}

/**
 * Stima il TAEG tecnico annualizzato dai flussi paziente.
 *
 * Flusso iniziale: +requestedAmount (non financedAmount).
 * Flussi successivi: −totalInstallmentAmount agli offset effettivi.
 *
 * Solver: Newton-Raphson con fallback a bisezione.
 */
export function estimateTechnicalTaeg(input: {
  requestedAmount: number;
  schedule: AmortizationRow[];
}): TaegCalculationResult {
  const flows = buildPatientCashFlows(input);

  if (!hasMixedSigns(flows)) {
    return {
      success: false,
      monthlyRate: null,
      annualEffectiveRate: null,
      taegPercent: null,
      iterations: 0,
      errorCode: "INVALID_CASH_FLOWS",
      errorMessage: "Flussi di cassa non validi per il calcolo del TAEG.",
    };
  }

  // Caso senza costi: uscite totali = importo richiesto → TAEG 0.
  const totalOutflow = flows
    .filter((flow) => flow.amount < 0)
    .reduce((sum, flow) => sum + Math.abs(flow.amount), 0);
  if (Math.abs(totalOutflow - input.requestedAmount) <= 0.01) {
    return {
      success: true,
      monthlyRate: 0,
      annualEffectiveRate: 0,
      taegPercent: 0,
      iterations: 0,
    };
  }

  // Newton-Raphson
  let rate = new Decimal(0.01);
  let iterations = 0;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    iterations = i + 1;
    const value = npv(flows, rate);
    const derivative = npvDerivative(flows, rate);

    if (!value.isFinite()) {
      break;
    }

    if (value.abs().lessThan(DEFAULT_TOLERANCE)) {
      const annualized = annualize(rate);
      return {
        success: true,
        monthlyRate: rate.toNumber(),
        annualEffectiveRate: annualized.annualEffectiveRate,
        taegPercent: annualized.taegPercent,
        iterations,
      };
    }

    if (!derivative.isFinite() || derivative.abs().lessThan(1e-16)) {
      break;
    }

    const next = rate.minus(value.div(derivative));
    if (!next.isFinite() || next.lessThanOrEqualTo(-0.999999)) {
      break;
    }
    rate = next;
  }

  // Fallback: bisezione su intervallo dinamico
  let low = new Decimal(-0.9999);
  let high = new Decimal(10);
  let npvLow = npv(flows, low);
  let npvHigh = npv(flows, high);

  // Espandi high se i segni coincidono.
  let expand = 0;
  while (npvLow.mul(npvHigh).greaterThan(0) && expand < 20) {
    high = high.mul(2);
    npvHigh = npv(flows, high);
    expand += 1;
  }

  if (npvLow.mul(npvHigh).greaterThan(0)) {
    return {
      success: false,
      monthlyRate: null,
      annualEffectiveRate: null,
      taegPercent: null,
      iterations,
      errorCode: "NO_VALID_ROOT",
      errorMessage: "Nessuna radice valida trovata per il TAEG tecnico stimato.",
    };
  }

  let mid = low.plus(high).div(2);
  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    iterations += 1;
    mid = low.plus(high).div(2);
    const npvMid = npv(flows, mid);

    if (!npvMid.isFinite()) {
      return {
        success: false,
        monthlyRate: null,
        annualEffectiveRate: null,
        taegPercent: null,
        iterations,
        errorCode: "NO_VALID_ROOT",
        errorMessage: "NPV non finito durante la bisezione del TAEG.",
      };
    }

    if (
      npvMid.abs().lessThan(DEFAULT_TOLERANCE) ||
      high.minus(low).lessThan(DEFAULT_TOLERANCE)
    ) {
      const annualized = annualize(mid);
      return {
        success: true,
        monthlyRate: mid.toNumber(),
        annualEffectiveRate: annualized.annualEffectiveRate,
        taegPercent: annualized.taegPercent,
        iterations,
      };
    }

    if (npvLow.mul(npvMid).lessThanOrEqualTo(0)) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return {
    success: false,
    monthlyRate: null,
    annualEffectiveRate: null,
    taegPercent: null,
    iterations,
    errorCode: "MAX_ITERATIONS_REACHED",
    errorMessage:
      "Raggiunto il numero massimo di iterazioni nel calcolo del TAEG tecnico stimato.",
  };
}
