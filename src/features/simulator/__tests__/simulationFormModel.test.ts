import { describe, expect, it } from "vitest";
import {
  getSimulationFormVisibility,
  isLegacySimulationMissingBirthDate,
  mergeSimulationPatientUpdate,
  parseSimulationFormValues,
  SIMULATION_FORM_DEFAULT_VALUES,
  simulationToFormValues,
  type SimulationFormValues,
} from "../simulationFormModel.ts";

type SimulationLike = Parameters<typeof simulationToFormValues>[0];

function baseSimulation(
  overrides: Partial<SimulationLike> = {},
): SimulationLike {
  return {
    _id: "sim_test" as SimulationLike["_id"],
    _creationTime: 1,
    ownerUserId: "user_test" as SimulationLike["ownerUserId"],
    patientFirstName: "Mario",
    patientLastName: "Rossi",
    network: "PCG",
    status: "draft",
    comparisonStatus: "calculated",
    requestedAmount: 4000,
    patientAge: 55,
    patientBirthDate: "1971-03-15",
    employmentType: "permanent_employee",
    isNonEuCitizen: false,
    employmentStartDate: "2024-01-01",
    employmentSeniorityMonths: 20,
    patientRequestsZeroInterest: true,
    preferredFirstInstallmentDelayDays: 30,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("simulationFormModel shared create/edit", () => {
  it("F) form create: birthDate required", () => {
    const formValues: SimulationFormValues = {
      ...SIMULATION_FORM_DEFAULT_VALUES,
      patientFirstName: "Mario",
      patientLastName: "Rossi",
      network: "PCG",
      patientBirthDate: "",
      employmentType: "permanent_employee",
      employmentStartDate: "2020-01-01",
      isNonEuCitizen: "no",
      requestedAmount: "4.000,00",
      preferredFirstInstallmentDelayDays: "30",
    };
    const parsed = parseSimulationFormValues(
      formValues,
      new Date("2026-09-14T12:00:00").getTime(),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.message).toMatch(/data di nascita/i);
  });

  it("G) form edit legacy: birthDate richiesta prima del nuovo ricalcolo", () => {
    const legacy = baseSimulation({
      patientBirthDate: undefined,
      patientAge: 78,
    });
    expect(isLegacySimulationMissingBirthDate(legacy)).toBe(true);
    const formValues = simulationToFormValues(legacy);
    expect(formValues.patientBirthDate).toBe("");
    const parsed = parseSimulationFormValues(formValues);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.message).toMatch(/data di nascita|legacy/i);

    formValues.patientBirthDate = "1948-01-10";
    const ref = new Date("2026-09-14T12:00:00").getTime();
    const withBirth = parseSimulationFormValues(formValues, ref);
    expect(withBirth.success).toBe(true);
    if (!withBirth.success) return;
    expect(withBirth.data.patientBirthDate).toBe("1948-01-10");
    expect(withBirth.data.patientAge).toBeGreaterThanOrEqual(18);
  });

  it("A) creazione con employmentStartDate → modifica precompilata", () => {
    const values = simulationToFormValues(
      baseSimulation({ employmentStartDate: "2024-01-01" }),
    );
    expect(values.employmentStartDate).toBe("2024-01-01");
    expect(values.patientBirthDate).toBe("1971-03-15");
    expect(getSimulationFormVisibility(values).showEmploymentStart).toBe(true);
  });

  it("B) modifica solo requestedAmount → employmentStartDate invariato nello storage merge", () => {
    const existing = baseSimulation();
    const formValues = simulationToFormValues(existing);
    formValues.requestedAmount = "4.500,00";
    const parsed = parseSimulationFormValues(formValues, Date.now());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const merged = mergeSimulationPatientUpdate({
      existing: {
        employmentStartDate: existing.employmentStartDate,
        employmentSeniorityMonths: existing.employmentSeniorityMonths,
        temporaryContractExpiry: existing.temporaryContractExpiry,
        residencePermitExpiry: existing.residencePermitExpiry,
        hasResidencePermitRenewalReceiptOnly:
          existing.hasResidencePermitRenewalReceiptOnly,
        hasGuarantor: existing.hasGuarantor,
        patientRequestsZeroInterest: existing.patientRequestsZeroInterest,
        preferredFirstInstallmentDelayDays:
          existing.preferredFirstInstallmentDelayDays as 30 | 60 | 90 | undefined,
      },
      update: {
        ...parsed.data,
        employmentStartDate: undefined,
        employmentSeniorityMonths: undefined,
      },
    });
    expect(merged.employmentStartDate).toBe("2024-01-01");
    expect(merged.requestedAmount).toBe(4500);
  });

  it("C) salva form modifica senza toccare employmentStartDate → resta nello storage", () => {
    const existing = baseSimulation({ employmentStartDate: "2024-01-01" });
    const formValues = simulationToFormValues(existing);
    const parsed = parseSimulationFormValues(formValues);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.employmentStartDate).toBe("2024-01-01");
    expect(parsed.data.employmentSeniorityMonths).toBeGreaterThanOrEqual(12);
  });

  it("D) TI seniority >12 mesi, modifica importo → seniority policy still satisfied", () => {
    const existing = baseSimulation({
      employmentStartDate: "2020-01-15",
      employmentSeniorityMonths: 70,
    });
    const formValues = simulationToFormValues(existing);
    formValues.requestedAmount = "3.800,00";
    const parsed = parseSimulationFormValues(
      formValues,
      new Date("2026-09-11T12:00:00").getTime(),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.employmentStartDate).toBe("2020-01-15");
    expect(parsed.data.employmentSeniorityMonths).toBeGreaterThanOrEqual(12);
  });

  it("E) TD: employmentStartDate + contractExpiry preservate", () => {
    const expiry = new Date("2027-06-01T12:00:00").getTime();
    const existing = baseSimulation({
      employmentType: "temporary_employee",
      employmentStartDate: "2024-03-01",
      temporaryContractExpiry: expiry,
    });
    const formValues = simulationToFormValues(existing);
    formValues.requestedAmount = "4.100,00";
    const parsed = parseSimulationFormValues(formValues);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.employmentStartDate).toBe("2024-03-01");
    expect(parsed.data.temporaryContractExpiry).toBe(expiry);
  });

  it("extracomunitario: residencePermitExpiry preservata", () => {
    const permit = new Date("2027-01-15T12:00:00").getTime();
    const existing = baseSimulation({
      isNonEuCitizen: true,
      residencePermitExpiry: permit,
    });
    const formValues = simulationToFormValues(existing);
    formValues.requestedAmount = "4.200,00";
    const parsed = parseSimulationFormValues(formValues);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.isNonEuCitizen).toBe(true);
    expect(parsed.data.residencePermitExpiry).toBe(permit);
  });

  it("patientRequestsZeroInterest=true resta true dopo modifica altro campo", () => {
    const existing = baseSimulation({ patientRequestsZeroInterest: true });
    const formValues = simulationToFormValues(existing);
    formValues.patientBirthDate = "1970-06-01";
    const parsed = parseSimulationFormValues(
      formValues,
      new Date("2026-09-14T12:00:00").getTime(),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.patientRequestsZeroInterest).toBe(true);
    expect(parsed.data.patientAge).toBe(56);
  });

  it("end-to-end logico: create → edit innocuo → campi critici preservati", () => {
    const created = baseSimulation({
      employmentType: "permanent_employee",
      employmentStartDate: "2018-05-10",
      patientBirthDate: "1971-03-15",
      patientAge: 55,
      isNonEuCitizen: false,
      requestedAmount: 4000,
      requestedDurationMonths: 18,
      patientRequestsZeroInterest: true,
    });
    const formValues = simulationToFormValues(created);
    formValues.targetInstallment = "250,00";
    const parsed = parseSimulationFormValues(
      formValues,
      new Date("2026-09-11T12:00:00").getTime(),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.employmentStartDate).toBe("2018-05-10");
    expect(parsed.data.employmentSeniorityMonths).toBeGreaterThanOrEqual(12);
    expect(parsed.data.patientRequestsZeroInterest).toBe(true);
    expect(parsed.data.requestedAmount).toBe(4000);
    expect(parsed.data.requestedDurationMonths).toBe(18);
    expect(parsed.data.patientBirthDate).toBe("1971-03-15");
  });

  it("default form e create condividono gli stessi campi", () => {
    const keys = Object.keys(SIMULATION_FORM_DEFAULT_VALUES).sort();
    const fromSim = Object.keys(
      simulationToFormValues(baseSimulation()),
    ).sort();
    expect(fromSim).toEqual(keys);
    expect(keys).toContain("patientBirthDate");
    expect(keys).toContain("employmentStartDate");
    expect(keys).toContain("hasResidencePermitRenewalReceiptOnly");
    expect(keys).toContain("hasGuarantor");
    expect(keys).toContain("patientRequestsZeroInterest");
  });

  it("visibility TI/TD/extracomunitario", () => {
    const ti: SimulationFormValues = {
      ...SIMULATION_FORM_DEFAULT_VALUES,
      employmentType: "permanent_employee",
    };
    expect(getSimulationFormVisibility(ti).showEmploymentStart).toBe(true);
    expect(getSimulationFormVisibility(ti).showContractExpiry).toBe(false);

    const td: SimulationFormValues = {
      ...SIMULATION_FORM_DEFAULT_VALUES,
      employmentType: "temporary_employee",
    };
    expect(getSimulationFormVisibility(td).showEmploymentStart).toBe(true);
    expect(getSimulationFormVisibility(td).showContractExpiry).toBe(true);

    const nonEu: SimulationFormValues = {
      ...SIMULATION_FORM_DEFAULT_VALUES,
      isNonEuCitizen: "yes",
    };
    expect(getSimulationFormVisibility(nonEu).showPermitExpiry).toBe(true);
  });
});
