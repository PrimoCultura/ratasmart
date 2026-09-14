import { describe, expect, it } from "vitest";
import {
  calculateAgeAtDate,
  isAdultAtDate,
  isBirthDateNotInFuture,
  resolvePatientAge,
} from "../patient-age.ts";
import {
  ageYmdAt,
  evaluateSmvSeniorAge,
  isAgeWithinCalendarRange,
  SMV_MAX_AGE,
  SMV_MIN_AGE,
} from "../smv-senior-age.ts";

describe("calculateAgeAtDate", () => {
  it("A) anni compiuti: giorno prima e giorno del compleanno", () => {
    expect(
      calculateAgeAtDate("2000-09-15", Date.UTC(2026, 8, 14)),
    ).toBe(25);
    expect(
      calculateAgeAtDate("2000-09-15", Date.UTC(2026, 8, 15)),
    ).toBe(26);
  });

  it("B) maggiore età: giorno prima del 18° → minorenne; giorno del 18° → maggiorenne", () => {
    const birth = "2008-03-10";
    expect(isAdultAtDate(birth, Date.UTC(2026, 2, 9))).toBe(false);
    expect(calculateAgeAtDate(birth, Date.UTC(2026, 2, 9))).toBe(17);
    expect(isAdultAtDate(birth, Date.UTC(2026, 2, 10))).toBe(true);
    expect(calculateAgeAtDate(birth, Date.UTC(2026, 2, 10))).toBe(18);
  });

  it("rifiuta data futura e ISO non valida", () => {
    expect(isBirthDateNotInFuture("2027-01-01", Date.UTC(2026, 8, 14))).toBe(
      false,
    );
    expect(calculateAgeAtDate("not-a-date", Date.UTC(2026, 8, 14))).toBeNull();
  });
});

describe("SMV precise age boundaries", () => {
  it("C) lower boundary: 77a 6m 1g eligible; un giorno sotto not eligible", () => {
    // Compleanno 1948-12-14 → al 2026-06-15 = 77a 6m 1g
    const ref = Date.UTC(2026, 5, 15);
    expect(ageYmdAt("1948-12-14", ref)).toEqual({
      years: 77,
      months: 6,
      days: 1,
    });
    expect(
      isAgeWithinCalendarRange("1948-12-14", ref, SMV_MIN_AGE, SMV_MAX_AGE),
    ).toBe(true);
    expect(
      evaluateSmvSeniorAge({
        birthDate: "1948-12-14",
        calculationDate: ref,
      }).status,
    ).toBe("passed");

    // Un giorno sotto: 2026-06-14 → 77a 6m 0g
    const dayBefore = Date.UTC(2026, 5, 14);
    expect(ageYmdAt("1948-12-14", dayBefore)).toEqual({
      years: 77,
      months: 6,
      days: 0,
    });
    expect(
      evaluateSmvSeniorAge({
        birthDate: "1948-12-14",
        calculationDate: dayBefore,
      }).status,
    ).toBe("failed");
  });

  it("D) upper boundary: 85a 11m 29g eligible; un giorno oltre not eligible", () => {
    // Compleanno 1940-06-17 → al 2026-06-15 = 85a 11m 29g
    const ref = Date.UTC(2026, 5, 15);
    expect(ageYmdAt("1940-06-17", ref)).toEqual({
      years: 85,
      months: 11,
      days: 29,
    });
    expect(
      evaluateSmvSeniorAge({
        birthDate: "1940-06-17",
        calculationDate: ref,
      }).status,
    ).toBe("passed");

    const dayAfter = Date.UTC(2026, 5, 16);
    expect(ageYmdAt("1940-06-17", dayAfter)).toEqual({
      years: 85,
      months: 11,
      days: 30,
    });
    expect(
      evaluateSmvSeniorAge({
        birthDate: "1940-06-17",
        calculationDate: dayAfter,
      }).status,
    ).toBe("failed");
  });

  it("E) legacy senza birthDate → verification_required (nessuna data inventata)", () => {
    const asOf = Date.UTC(2026, 5, 15);
    expect(
      evaluateSmvSeniorAge({ age: 80, calculationDate: asOf }).status,
    ).toBe("verification_required");
    expect(
      evaluateSmvSeniorAge({ age: 77, calculationDate: asOf }).status,
    ).toBe("verification_required");

    const resolved = resolvePatientAge({
      legacyAge: 78,
      referenceDate: asOf,
    });
    expect(resolved).toEqual({
      age: 78,
      source: "legacy_age",
    });
    expect(resolved?.birthDate).toBeUndefined();
  });
});
