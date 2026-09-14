import type { NetworkCode } from "../domain/networks.ts";

/**
 * Availability e vincoli confermati DES / Paoleschi 2026.
 */

export const DES_ACTIVE_COMPANY_SHORT_NAMES = [
  "Compass",
  "HeyLight",
  "Deutsche Bank",
] as const;

export const DES_UNAVAILABLE_COMPANY_SHORT_NAMES = [
  "Agos",
  "Qmodo",
] as const;

export const PAOLESCHI_ACTIVE_COMPANY_SHORT_NAMES = [
  "Deutsche Bank",
] as const;

export const PAOLESCHI_UNAVAILABLE_COMPANY_SHORT_NAMES = [
  "Compass",
  "HeyLight",
  "Agos",
  "Qmodo",
] as const;

export const DES_COMPASS_ACTIVE_TABLE_CODE = "4CF" as const;

export const DES_COMPASS_CODES_TO_DEACTIVATE = [
  "MKE",
  "PM8",
  "46V",
  "NR1",
] as const;

export const DES_ALLOWED_TABLE_CODES = [
  "4CF",
  "TR7",
  "DB_ST",
  "DB_449",
  "DB_ZERO",
  "SMV",
] as const;

export const PAOLESCHI_ALLOWED_TABLE_CODES = [
  "DB_ST",
  "DB_449",
  "DB_ZERO",
  "SMV",
] as const;

export const CONFIRMED_DES_COMPASS_4CF_TAN_PERCENT = 10.75;
export const CONFIRMED_DES_DB_STANDARD_TAN_PERCENT = 9.95;
export const LEGACY_DES_DB_STANDARD_TAN_PERCENT = 8.95;
export const CONFIRMED_DES_DB_ZERO_TAN_PERCENT = 0;
export const CONFIRMED_DES_DB_ZERO_MAX_DURATION_MONTHS = 24;
export const CONFIRMED_DES_DB_REDUCED_TAN_PERCENT = 4.49;
export const CONFIRMED_DES_DB_REDUCED_MAX_DURATION_MONTHS = 48;
export const CONFIRMED_DES_DB_STANDARD_DELAY_DAYS = [30] as const;
export const CONFIRMED_HEYLIGHT_PATIENT_TAN_PERCENT = 0;
export const CONFIRMED_HEYLIGHT_MAX_DURATION_MONTHS = 12;

/** Solo policy generali rete ancora mancanti. */
export const DES_PAOLESCHI_MISSING_DATA: string[] = [
  "Policy paziente generali DES ancora da configurare",
  "Policy paziente generali Paoleschi ancora da configurare",
];

export type NetworkCompanyAvailabilityInput = {
  network: NetworkCode;
  companyShortName: string;
};

export function isCompanyAvailableOnNetwork(
  input: NetworkCompanyAvailabilityInput,
): boolean {
  const short = input.companyShortName.trim();
  if (input.network === "PCG") {
    return true;
  }
  if (input.network === "DES") {
    if (
      (DES_UNAVAILABLE_COMPANY_SHORT_NAMES as readonly string[]).includes(short)
    ) {
      return false;
    }
    return (DES_ACTIVE_COMPANY_SHORT_NAMES as readonly string[]).includes(short);
  }
  if (input.network === "Paoleschi") {
    if (
      (PAOLESCHI_UNAVAILABLE_COMPANY_SHORT_NAMES as readonly string[]).includes(
        short,
      )
    ) {
      return false;
    }
    return (PAOLESCHI_ACTIVE_COMPANY_SHORT_NAMES as readonly string[]).includes(
      short,
    );
  }
  return false;
}

export type NetworkTableAvailabilityInput = {
  network: NetworkCode;
  companyShortName: string;
  tableCode: string;
  customerTanPercent?: number;
  isActive?: boolean;
};

export function isTableAvailableOnNetwork(
  input: NetworkTableAvailabilityInput,
): boolean {
  if (input.isActive === false) return false;
  if (!isCompanyAvailableOnNetwork(input)) return false;

  if (input.network === "DES") {
    if (
      (DES_COMPASS_CODES_TO_DEACTIVATE as readonly string[]).includes(
        input.tableCode,
      )
    ) {
      return false;
    }
    if (
      input.companyShortName === "Deutsche Bank" &&
      input.customerTanPercent === LEGACY_DES_DB_STANDARD_TAN_PERCENT
    ) {
      return false;
    }
    return (DES_ALLOWED_TABLE_CODES as readonly string[]).includes(
      input.tableCode,
    );
  }

  if (input.network === "Paoleschi") {
    return (PAOLESCHI_ALLOWED_TABLE_CODES as readonly string[]).includes(
      input.tableCode,
    );
  }

  return true;
}

export function filterTablesForNetwork<T extends NetworkTableAvailabilityInput>(
  tables: T[],
  network: NetworkCode,
): T[] {
  return tables.filter((table) =>
    isTableAvailableOnNetwork({ ...table, network }),
  );
}
