import { describe, expect, it } from "vitest";
import {
  FinancialEngineError,
  calculateFinancedAmount,
  calculateOpeningFee,
} from "../index.ts";

describe("calculateOpeningFee", () => {
  it("restituisce 0 per commissione none", () => {
    expect(
      calculateOpeningFee({
        requestedAmount: 1000,
        openingFeeType: "none",
        openingFeeValue: 0,
      }),
    ).toBe(0);
  });

  it("calcola commissione fissa", () => {
    expect(
      calculateOpeningFee({
        requestedAmount: 1000,
        openingFeeType: "fixed",
        openingFeeValue: 25,
      }),
    ).toBe(25);
  });

  it("calcola commissione percentuale con arrotondamento", () => {
    // 1000 * 1.5% = 15 esatti
    expect(
      calculateOpeningFee({
        requestedAmount: 1000,
        openingFeeType: "percentage",
        openingFeeValue: 1.5,
      }),
    ).toBe(15);

    // 999 * 1.5% = 14.985 → 14.99 HALF_UP
    expect(
      calculateOpeningFee({
        requestedAmount: 999,
        openingFeeType: "percentage",
        openingFeeValue: 1.5,
      }),
    ).toBe(14.99);
  });

  it("rifiuta valore negativo", () => {
    expect(() =>
      calculateOpeningFee({
        requestedAmount: 1000,
        openingFeeType: "fixed",
        openingFeeValue: -1,
      }),
    ).toThrow(FinancialEngineError);
  });

  it("calcola importo finanziato", () => {
    expect(calculateFinancedAmount(1000, 15)).toBe(1015);
  });
});
