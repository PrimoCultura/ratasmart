import { describe, expect, it } from "vitest";
import {
  buildPreScreeningContext,
  detectPreScreeningIntents,
  formatPreScreeningContext,
  matchEntitiesFromQuestion,
  buildEntityCatalogFromActiveData,
} from "../../assistant-context/index.ts";
import { evaluateCompatibility } from "../compatibility.ts";
import type {
  PatientFinancialProfile,
  RuntimePolicyRule,
} from "../types.ts";
import { PCG_FINANCING_POLICY_SETS_2026 } from "../../../convex/lib/pcgFinancingPolicies2026Data.ts";

function rulesForCompany(
  shortName: "Agos" | "Compass" | "Deutsche Bank",
): RuntimePolicyRule[] {
  const set = PCG_FINANCING_POLICY_SETS_2026.find(
    (item) => item.companyShortName === shortName,
  );
  if (!set) throw new Error(`Missing set ${shortName}`);
  return set.rules.map((rule, index) => ({
    id: `${shortName}-${index}`,
    policySetId: set.stableKey,
    scope: "company" as const,
    ruleType: rule.ruleType,
    operator: rule.operator,
    numericValue: rule.numericValue,
    stringValue: rule.stringValue,
    booleanValue: rule.booleanValue,
    stringValues: rule.stringValues,
    monthsBuffer: rule.monthsBuffer,
    failureMessage: rule.failureMessage,
    verificationMessage: rule.verificationMessage,
    sortOrder: rule.sortOrder,
  }));
}

function evalCompany(
  shortName: "Agos" | "Compass" | "Deutsche Bank",
  patient: PatientFinancialProfile,
  requestedAmount: number,
  durationMonths: number,
) {
  return evaluateCompatibility({
    patient,
    requestedAmount,
    durationMonths,
    firstInstallmentDelayDays: 30,
    calculationDate: Date.UTC(2026, 0, 15),
    rules: rulesForCompany(shortName),
  });
}

const basePatient = (
  overrides: Partial<PatientFinancialProfile> &
    Pick<PatientFinancialProfile, "age" | "employmentType">,
): PatientFinancialProfile => ({
  isNonEuCitizen: false,
  ...overrides,
});

describe("PCG 2026 real financing policies – age", () => {
  it("74 anni: Compass caricamento ok, DB ok, Agos dipende da fine piano", () => {
    const patient = basePatient({
      age: 74,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    expect(evalCompany("Compass", patient, 3000, 24).status).not.toBe(
      "not_compatible",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 24).status).not.toBe(
      "not_compatible",
    );
    // 74 + ~24m ≈ 76 < 82 → Agos ok
    expect(evalCompany("Agos", patient, 3000, 24).status).toBe("compatible");
  });

  it("75 anni: Compass esclusa; DB e Agos valutabili in funzione durata", () => {
    const patient = basePatient({
      age: 75,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    const compass = evalCompany("Compass", patient, 3000, 12);
    expect(compass.status).toBe("not_compatible");
    expect(compass.reasons.join(" ")).toMatch(/75/);

    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).not.toBe(
      "not_compatible",
    );
    expect(evalCompany("Agos", patient, 3000, 12).status).toBe("compatible");
  });

  it("78 anni: Compass esclusa; DB standard potenzialmente ok; Agos ok su durata breve", () => {
    const patient = basePatient({
      age: 78,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).not.toBe(
      "not_compatible",
    );
    expect(evalCompany("Agos", patient, 3000, 12).status).toBe("compatible");
  });

  it("79 anni: Compass e DB standard esclusi; Agos ok se fine piano ≤ 82", () => {
    const patient = basePatient({
      age: 79,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Agos", patient, 3000, 12).status).toBe("compatible");
    // durata lunga che supera 82 → non compatibile
    expect(evalCompany("Agos", patient, 3000, 48).status).toBe(
      "not_compatible",
    );
  });

  it("80 anni: Compass e DB esclusi; Agos dipende dalla durata (limite 82)", () => {
    const patient = basePatient({
      age: 80,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Agos", patient, 3000, 12).status).toBe("compatible");
    expect(evalCompany("Agos", patient, 3000, 36).status).toBe(
      "not_compatible",
    );
  });

  it("età < 18: not_compatible per tutte", () => {
    const patient = basePatient({
      age: 17,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
    });
    for (const company of ["Agos", "Compass", "Deutsche Bank"] as const) {
      const result = evalCompany(company, patient, 3000, 12);
      expect(result.status).toBe("not_compatible");
      expect(result.reasons.join(" ")).toMatch(/maggiorenne/i);
    }
  });
});

describe("PCG 2026 – extracomunitario / ricevuta", () => {
  it("extracomunitario senza scadenza → verification_required", () => {
    const patient = basePatient({
      age: 40,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
      isNonEuCitizen: true,
    });
    for (const company of ["Agos", "Compass", "Deutsche Bank"] as const) {
      expect(evalCompany(company, patient, 3000, 12).status).toBe(
        "verification_required",
      );
    }
  });

  it("sola ricevuta: Agos not_compatible; Compass/DB verification", () => {
    const patient = basePatient({
      age: 40,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 24,
      isNonEuCitizen: true,
      hasResidencePermitRenewalReceiptOnly: true,
    });
    expect(evalCompany("Agos", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "verification_required",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).toBe(
      "verification_required",
    );
  });
});

describe("PCG 2026 – lavoro", () => {
  it("tempo determinato senza scadenza → verification_required", () => {
    const patient = basePatient({
      age: 35,
      employmentType: "temporary_employee",
    });
    const result = evalCompany("Agos", patient, 3000, 12);
    expect(result.status).toBe("verification_required");
    expect(result.verificationReasons.join(" ")).toMatch(/scadenza del contratto/i);
  });

  it("tempo determinato con scadenza incompatibile → not_compatible", () => {
    const patient = basePatient({
      age: 35,
      employmentType: "temporary_employee",
      // scadenza troppo vicina rispetto a un piano 24 mesi
      temporaryContractExpiry: Date.UTC(2026, 2, 1),
    });
    expect(evalCompany("Compass", patient, 3000, 24).status).toBe(
      "not_compatible",
    );
  });

  it("tempo indeterminato con 6 mesi → verification_required (non blocco)", () => {
    const patient = basePatient({
      age: 35,
      employmentType: "permanent_employee",
      employmentSeniorityMonths: 6,
    });
    const result = evalCompany("Agos", patient, 3000, 12);
    expect(result.status).toBe("verification_required");
    expect(result.verificationReasons.join(" ")).toMatch(/12 mesi/i);
  });
});

describe("PCG 2026 – studente / casalinga", () => {
  it("studente + Agos → not_compatible", () => {
    const patient = basePatient({ age: 22, employmentType: "student" });
    expect(evalCompany("Agos", patient, 2000, 12).status).toBe(
      "not_compatible",
    );
  });

  it("studente + Compass 2000 → verification (garante); 3000 → not_compatible", () => {
    const patient = basePatient({ age: 22, employmentType: "student" });
    expect(evalCompany("Compass", patient, 2000, 12).status).toBe(
      "verification_required",
    );
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
  });

  it("studente + DB 2000 → potenzialmente senza blocco importo; 3000 escluso", () => {
    const patient = basePatient({ age: 22, employmentType: "student" });
    expect(evalCompany("Deutsche Bank", patient, 2000, 12).status).not.toBe(
      "not_compatible",
    );
    expect(evalCompany("Deutsche Bank", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
  });

  it("casalinga + Agos esclusa; Compass/DB ≤2500 ok formale importo", () => {
    const patient = basePatient({ age: 40, employmentType: "housewife" });
    expect(evalCompany("Agos", patient, 2000, 12).status).toBe(
      "not_compatible",
    );
    expect(evalCompany("Compass", patient, 2000, 12).status).not.toBe(
      "not_compatible",
    );
    expect(evalCompany("Compass", patient, 3000, 12).status).toBe(
      "not_compatible",
    );
  });
});

describe("PCG 2026 – provider context pre-screening", () => {
  function sourceFromSeedPolicies() {
    const companies = [
      { id: "agos", name: "Agos", shortName: "Agos" },
      { id: "db", name: "Deutsche Bank", shortName: "Deutsche Bank" },
      { id: "compass", name: "Compass", shortName: "Compass" },
    ];
    const policySets = PCG_FINANCING_POLICY_SETS_2026.map((set) => ({
      id: set.stableKey,
      name: set.name,
      network: "PCG" as const,
      companyId:
        set.companyShortName === "Agos"
          ? "agos"
          : set.companyShortName === "Compass"
            ? "compass"
            : "db",
      isActive: true,
    }));
    const policyRules = PCG_FINANCING_POLICY_SETS_2026.flatMap((set) =>
      set.rules.map((rule) => ({
        policySetId: set.stableKey,
        ruleType: rule.ruleType,
        operator: rule.operator,
        numericValue: rule.numericValue,
        stringValue: rule.stringValue,
        booleanValue: rule.booleanValue,
        stringValues: rule.stringValues,
        monthsBuffer: rule.monthsBuffer,
        failureMessage: rule.failureMessage,
        verificationMessage: rule.verificationMessage,
        isActive: true,
        sortOrder: rule.sortOrder,
      })),
    );
    return {
      network: "PCG" as const,
      companies,
      products: [
        {
          id: "p1",
          companyId: "agos",
          name: "Agos",
          category: "standard",
          isActive: true,
        },
        {
          id: "p2",
          companyId: "db",
          name: "DB",
          category: "standard",
          isActive: true,
        },
        {
          id: "p3",
          companyId: "compass",
          name: "Compass",
          category: "standard",
          isActive: true,
        },
      ],
      tables: [
        {
          id: "t1",
          companyId: "agos",
          productId: "p1",
          tableCode: "NBQ",
          displayName: "NBQ",
          category: "standard",
          network: "PCG" as const,
          minimumAmount: 760,
          maximumAmount: 20000,
          minimumDurationMonths: 12,
          maximumDurationMonths: 48,
          durationStepMonths: 6,
          firstInstallmentDelayDays: [30],
          customerTanPercent: 10.5,
          isActive: true,
        },
        {
          id: "t2",
          companyId: "db",
          productId: "p2",
          tableCode: "S/U",
          displayName: "S/U",
          category: "standard",
          network: "PCG" as const,
          minimumAmount: 2600,
          maximumAmount: 20000,
          minimumDurationMonths: 24,
          maximumDurationMonths: 72,
          durationStepMonths: 1,
          firstInstallmentDelayDays: [30],
          customerTanPercent: 10.5,
          isActive: true,
        },
        {
          id: "t3",
          companyId: "compass",
          productId: "p3",
          tableCode: "81K",
          displayName: "81K",
          category: "standard",
          network: "PCG" as const,
          minimumAmount: 1000,
          maximumAmount: 30000,
          minimumDurationMonths: 12,
          maximumDurationMonths: 84,
          durationStepMonths: 1,
          firstInstallmentDelayDays: [30],
          customerTanPercent: 10.5,
          isActive: true,
        },
      ],
      policySets,
      policyRules,
      calculationDate: Date.now(),
    };
  }

  it("80 anni: contesto contiene limiti età reali", () => {
    const q = "Ho un paziente di 80 anni";
    const intents = detectPreScreeningIntents(q);
    const ctx = buildPreScreeningContext({
      intents,
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: sourceFromSeedPolicies(),
    });
    const text = formatPreScreeningContext(ctx);
    expect(text).toContain("valore=82");
    expect(text).toContain("valore=75");
    expect(text).toContain("valore=80");
    expect(text).toContain("valore=79");
    expect(text).toMatch(/maximum_age_at_end/);
    expect(text).toMatch(/maximum_age_at_application/);
  });

  it("extracomunitario con ricevuta: differenze Agos/Compass/DB", () => {
    const q = "Ho un paziente extracomunitario con ricevuta di rinnovo";
    const intents = detectPreScreeningIntents(q);
    expect(intents).toEqual(
      expect.arrayContaining(["residence_permit"]),
    );
    const catalog = buildEntityCatalogFromActiveData({
      companies: sourceFromSeedPolicies().companies,
      products: [],
      tables: [],
    });
    const matched = matchEntitiesFromQuestion(q, catalog);
    const ctx = buildPreScreeningContext({
      intents,
      matched,
      source: sourceFromSeedPolicies(),
    });
    const text = formatPreScreeningContext(ctx);
    expect(text).toMatch(/non accetta la sola ricevuta/i);
    expect(text).toMatch(/Compass può valutare una ricevuta/i);
    expect(text).toMatch(/Deutsche Bank può valutare una ricevuta/i);
    expect(text).toMatch(/residence_permit_expiry|permesso/i);
  });

  it("tempo determinato: regola fine piano e verifica scadenza", () => {
    const q = "Ha un tempo determinato";
    const intents = detectPreScreeningIntents(q);
    const ctx = buildPreScreeningContext({
      intents,
      matched: {
        companyIds: [],
        productIds: [],
        tableIds: [],
        networks: [],
        matchedLabels: [],
      },
      source: sourceFromSeedPolicies(),
    });
    const text = formatPreScreeningContext(ctx);
    expect(text).toMatch(/temporary_contract_expiry/);
    expect(text).toMatch(/scadenza del contratto/i);
  });
});
