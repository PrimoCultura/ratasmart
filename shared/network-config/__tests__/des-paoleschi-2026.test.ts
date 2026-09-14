import { describe, expect, it } from "vitest";
import {
  CONFIRMED_DES_COMPASS_4CF_TAN_PERCENT,
  CONFIRMED_DES_DB_REDUCED_MAX_DURATION_MONTHS,
  CONFIRMED_DES_DB_REDUCED_TAN_PERCENT,
  CONFIRMED_DES_DB_STANDARD_DELAY_DAYS,
  CONFIRMED_DES_DB_STANDARD_TAN_PERCENT,
  CONFIRMED_DES_DB_ZERO_MAX_DURATION_MONTHS,
  CONFIRMED_DES_DB_ZERO_TAN_PERCENT,
  CONFIRMED_HEYLIGHT_MAX_DURATION_MONTHS,
  CONFIRMED_HEYLIGHT_PATIENT_TAN_PERCENT,
  DES_ALLOWED_TABLE_CODES,
  DES_COMPASS_ACTIVE_TABLE_CODE,
  DES_COMPASS_CODES_TO_DEACTIVATE,
  DES_PAOLESCHI_MISSING_DATA,
  LEGACY_DES_DB_STANDARD_TAN_PERCENT,
  PAOLESCHI_ALLOWED_TABLE_CODES,
  filterTablesForNetwork,
  isCompanyAvailableOnNetwork,
  isTableAvailableOnNetwork,
} from "../des-paoleschi-2026.ts";

describe("DES / Paoleschi 2026 availability", () => {
  it("A) DES → Agos assente", () => {
    expect(
      isCompanyAvailableOnNetwork({
        network: "DES",
        companyShortName: "Agos",
      }),
    ).toBe(false);
  });

  it("B) DES → Qmodo assente", () => {
    expect(
      isCompanyAvailableOnNetwork({
        network: "DES",
        companyShortName: "Qmodo",
      }),
    ).toBe(false);
  });

  it("C) DES → Compass presente", () => {
    expect(
      isCompanyAvailableOnNetwork({
        network: "DES",
        companyShortName: "Compass",
      }),
    ).toBe(true);
  });

  it("D) Compass DES → solo 4CF", () => {
    expect(
      isTableAvailableOnNetwork({
        network: "DES",
        companyShortName: "Compass",
        tableCode: DES_COMPASS_ACTIVE_TABLE_CODE,
      }),
    ).toBe(true);
    for (const code of DES_COMPASS_CODES_TO_DEACTIVATE) {
      expect(
        isTableAvailableOnNetwork({
          network: "DES",
          companyShortName: "Compass",
          tableCode: code,
        }),
      ).toBe(false);
    }
  });

  it("E) 4CF TAN = 10,75%", () => {
    expect(CONFIRMED_DES_COMPASS_4CF_TAN_PERCENT).toBe(10.75);
  });

  it("G) DB DES TAN 8,95 → non disponibile", () => {
    expect(
      isTableAvailableOnNetwork({
        network: "DES",
        companyShortName: "Deutsche Bank",
        tableCode: "DB_STD_LEGACY",
        customerTanPercent: LEGACY_DES_DB_STANDARD_TAN_PERCENT,
      }),
    ).toBe(false);
  });

  it("H) DB DES standard TAN 9,95 → disponibile", () => {
    expect(CONFIRMED_DES_DB_STANDARD_TAN_PERCENT).toBe(9.95);
    expect(
      isTableAvailableOnNetwork({
        network: "DES",
        companyShortName: "Deutsche Bank",
        tableCode: "DB_ST",
        customerTanPercent: 9.95,
      }),
    ).toBe(true);
  });

  it("I) DB DES delay standard = 30", () => {
    expect([...CONFIRMED_DES_DB_STANDARD_DELAY_DAYS]).toEqual([30]);
  });

  it("J/K) DB zero/ridotto vincoli", () => {
    expect(CONFIRMED_DES_DB_ZERO_TAN_PERCENT).toBe(0);
    expect(CONFIRMED_DES_DB_ZERO_MAX_DURATION_MONTHS).toBe(24);
    expect(CONFIRMED_DES_DB_REDUCED_TAN_PERCENT).toBe(4.49);
    expect(CONFIRMED_DES_DB_REDUCED_MAX_DURATION_MONTHS).toBe(48);
  });

  it("N/O) HeyLight DES", () => {
    expect(
      isCompanyAvailableOnNetwork({
        network: "DES",
        companyShortName: "HeyLight",
      }),
    ).toBe(true);
    expect(CONFIRMED_HEYLIGHT_PATIENT_TAN_PERCENT).toBe(0);
    expect(CONFIRMED_HEYLIGHT_MAX_DURATION_MONTHS).toBe(12);
    expect(
      isTableAvailableOnNetwork({
        network: "DES",
        companyShortName: "HeyLight",
        tableCode: "TR7",
      }),
    ).toBe(true);
  });

  it("Paoleschi: solo DB allowed codes", () => {
    expect([...PAOLESCHI_ALLOWED_TABLE_CODES].sort()).toEqual(
      ["DB_449", "DB_ST", "DB_ZERO", "SMV"].sort(),
    );
    for (const company of ["Compass", "HeyLight", "Agos", "Qmodo"] as const) {
      expect(
        isCompanyAvailableOnNetwork({
          network: "Paoleschi",
          companyShortName: company,
        }),
      ).toBe(false);
    }
  });

  it("DES allowed codes finali", () => {
    expect([...DES_ALLOWED_TABLE_CODES].sort()).toEqual(
      ["4CF", "DB_449", "DB_ST", "DB_ZERO", "SMV", "TR7"].sort(),
    );
  });

  it("filterTablesForNetwork DES", () => {
    const filtered = filterTablesForNetwork(
      [
        {
          network: "DES" as const,
          companyShortName: "Agos",
          tableCode: "NBQ",
          isActive: true,
        },
        {
          network: "DES" as const,
          companyShortName: "Compass",
          tableCode: "4CF",
          isActive: true,
        },
        {
          network: "DES" as const,
          companyShortName: "HeyLight",
          tableCode: "TR7",
          isActive: true,
        },
        {
          network: "DES" as const,
          companyShortName: "Deutsche Bank",
          tableCode: "DB_ST",
          isActive: true,
        },
      ],
      "DES",
    );
    expect(filtered.map((t) => t.tableCode).sort()).toEqual([
      "4CF",
      "DB_ST",
      "TR7",
    ]);
  });

  it("missing data: solo policy generali", () => {
    expect(DES_PAOLESCHI_MISSING_DATA.length).toBe(2);
    expect(
      DES_PAOLESCHI_MISSING_DATA.every((item) =>
        item.toLowerCase().includes("policy"),
      ),
    ).toBe(true);
  });
});
