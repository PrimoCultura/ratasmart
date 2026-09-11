import { describe, expect, it } from "vitest";
import {
  FinancialEngineError,
  convertDelayDaysToMonths,
  generateAllowedDurations,
  resolveAllowedDurations,
} from "../index.ts";

describe("generateAllowedDurations", () => {
  it("genera 12–84 con step 6", () => {
    expect(
      generateAllowedDurations({
        minimumDurationMonths: 12,
        maximumDurationMonths: 84,
        durationStepMonths: 6,
      }),
    ).toEqual([12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84]);
  });

  it("genera 3–12 con step 1", () => {
    expect(
      generateAllowedDurations({
        minimumDurationMonths: 3,
        maximumDurationMonths: 12,
        durationStepMonths: 1,
      }),
    ).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("non include un massimo non raggiungibile dallo step", () => {
    expect(
      generateAllowedDurations({
        minimumDurationMonths: 12,
        maximumDurationMonths: 25,
        durationStepMonths: 6,
      }),
    ).toEqual([12, 18, 24]);
  });

  it("accetta minimo uguale al massimo", () => {
    expect(
      generateAllowedDurations({
        minimumDurationMonths: 12,
        maximumDurationMonths: 12,
        durationStepMonths: 6,
      }),
    ).toEqual([12]);
  });

  it("rifiuta step zero", () => {
    expect(() =>
      generateAllowedDurations({
        minimumDurationMonths: 12,
        maximumDurationMonths: 24,
        durationStepMonths: 0,
      }),
    ).toThrow(FinancialEngineError);
  });

  it("rifiuta minimo negativo", () => {
    expect(() =>
      generateAllowedDurations({
        minimumDurationMonths: -1,
        maximumDurationMonths: 12,
        durationStepMonths: 1,
      }),
    ).toThrow(FinancialEngineError);
  });

  it("rifiuta massimo inferiore al minimo", () => {
    expect(() =>
      generateAllowedDurations({
        minimumDurationMonths: 24,
        maximumDurationMonths: 12,
        durationStepMonths: 6,
      }),
    ).toThrow(FinancialEngineError);
  });
});

describe("resolveAllowedDurations with durationTerms", () => {
  it("usa esattamente le durate dei termini, senza step artificiale", () => {
    expect(
      resolveAllowedDurations({
        minimumDurationMonths: 6,
        maximumDurationMonths: 20,
        durationStepMonths: 1,
        durationTerms: [
          { durationMonths: 6, minimumAmount: 200, maximumAmount: 1500 },
          { durationMonths: 9, minimumAmount: 200, maximumAmount: 1500 },
          { durationMonths: 12, minimumAmount: 200, maximumAmount: 1500 },
          { durationMonths: 15, minimumAmount: 226, maximumAmount: 1500 },
          { durationMonths: 18, minimumAmount: 268, maximumAmount: 1500 },
          { durationMonths: 20, minimumAmount: 295, maximumAmount: 1500 },
        ],
      }),
    ).toEqual([6, 9, 12, 15, 18, 20]);
  });

  it("fallback a min/max/step se durationTerms assente", () => {
    expect(
      resolveAllowedDurations({
        minimumDurationMonths: 12,
        maximumDurationMonths: 36,
        durationStepMonths: 12,
      }),
    ).toEqual([12, 24, 36]);
  });
});

describe("convertDelayDaysToMonths", () => {
  it("converte 30/60/90", () => {
    expect(convertDelayDaysToMonths(30)).toBe(1);
    expect(convertDelayDaysToMonths(60)).toBe(2);
    expect(convertDelayDaysToMonths(90)).toBe(3);
  });

  it("rifiuta valori non multipli di 30", () => {
    expect(() => convertDelayDaysToMonths(45)).toThrow(FinancialEngineError);
  });
});
