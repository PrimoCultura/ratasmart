import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "../compatibility.ts";
import { calculateFinancingEndDate } from "../date-utils.ts";
import { evaluatePolicyRule } from "../rule-evaluators.ts";
import type {
  PatientFinancialProfile,
  RuntimePolicyRule,
} from "../types.ts";

const basePatient: PatientFinancialProfile = {
  age: 40,
  employmentType: "permanent_employee",
  isNonEuCitizen: false,
};

const calcDate = new Date(2026, 0, 10).getTime(); // 10 gennaio 2026 locale

function rule(
  partial: Partial<RuntimePolicyRule> &
    Pick<RuntimePolicyRule, "ruleType" | "operator">,
): RuntimePolicyRule {
  return {
    id: partial.id ?? "rule-1",
    policySetId: "ps-1",
    scope: partial.scope ?? "company",
    ruleType: partial.ruleType,
    operator: partial.operator,
    numericValue: partial.numericValue,
    stringValue: partial.stringValue,
    booleanValue: partial.booleanValue,
    stringValues: partial.stringValues,
    monthsBuffer: partial.monthsBuffer,
    failureMessage: partial.failureMessage ?? "Regola non rispettata",
    verificationMessage: partial.verificationMessage,
    sortOrder: partial.sortOrder ?? 1,
  };
}

const ctx = {
  patient: basePatient,
  requestedAmount: 5000,
  durationMonths: 12,
  firstInstallmentDelayDays: 30,
  calculationDate: calcDate,
};

describe("calculateFinancingEndDate", () => {
  it("calcola fine piano con prima rata a 30 giorni e 12 rate", () => {
    const end = calculateFinancingEndDate({
      calculationDate: calcDate,
      durationMonths: 12,
      firstInstallmentDelayDays: 30,
    });
    // offset 1 + 12 - 1 = 12 mesi → 10 gennaio 2027
    const endDate = new Date(end);
    expect(endDate.getFullYear()).toBe(2027);
    expect(endDate.getMonth()).toBe(0);
    expect(endDate.getDate()).toBe(10);
  });
});

describe("età", () => {
  it("età minima rispettata", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "minimum_age",
        operator: "greater_than_or_equal",
        numericValue: 18,
      }),
      ctx,
    );
    expect(result.status).toBe("passed");
  });

  it("età minima violata", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "minimum_age",
        operator: "greater_than_or_equal",
        numericValue: 45,
      }),
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("età massima al caricamento", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "maximum_age_at_application",
        operator: "less_than_or_equal",
        numericValue: 75,
      }),
      ctx,
    );
    expect(result.status).toBe("passed");
  });

  it("età massima a fine piano", () => {
    const young = evaluatePolicyRule(
      rule({
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: 75,
      }),
      { ...ctx, patient: { ...basePatient, age: 70 }, durationMonths: 24 },
    );
    expect(young.status).toBe("passed");

    const old = evaluatePolicyRule(
      rule({
        ruleType: "maximum_age_at_end",
        operator: "less_than_or_equal",
        numericValue: 75,
      }),
      { ...ctx, patient: { ...basePatient, age: 74 }, durationMonths: 24 },
    );
    expect(old.status).toBe("failed");
  });

  it("valore mancante → verification_required", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "minimum_age",
        operator: "greater_than_or_equal",
      }),
      ctx,
    );
    expect(result.status).toBe("verification_required");
  });
});

describe("lavoro", () => {
  it("tipo ammesso", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "employment_type_allowed",
        operator: "in",
        stringValues: ["permanent_employee", "pensioner"],
      }),
      ctx,
    );
    expect(result.status).toBe("passed");
  });

  it("tipo non ammesso", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "employment_type_allowed",
        operator: "in",
        stringValues: ["pensioner"],
      }),
      ctx,
    );
    expect(result.status).toBe("failed");
  });

  it("elenco mancante", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "employment_type_allowed",
        operator: "in",
        stringValues: [],
      }),
      ctx,
    );
    expect(result.status).toBe("verification_required");
  });

  it("regola pensionato applicabile", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "pensioner_allowed",
        operator: "equals",
        booleanValue: false,
      }),
      {
        ...ctx,
        patient: { ...basePatient, employmentType: "pensioner" },
      },
    );
    expect(result.status).toBe("failed");
  });

  it("regola pensionato non applicabile", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "pensioner_allowed",
        operator: "equals",
        booleanValue: false,
      }),
      ctx,
    );
    expect(result.status).toBe("not_applicable");
  });
});

describe("tempo determinato", () => {
  const end = calculateFinancingEndDate({
    calculationDate: calcDate,
    durationMonths: 12,
    firstInstallmentDelayDays: 30,
  });

  it("contratto oltre fine piano", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "temporary_contract_expiry",
        operator: "date_after_financing_end",
        monthsBuffer: 0,
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          employmentType: "temporary_employee",
          temporaryContractExpiry: end + 86_400_000,
        },
      },
    );
    expect(result.status).toBe("passed");
  });

  it("contratto prima della fine", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "temporary_contract_expiry",
        operator: "date_after_financing_end",
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          employmentType: "temporary_employee",
          temporaryContractExpiry: end - 86_400_000,
        },
      },
    );
    expect(result.status).toBe("failed");
  });

  it("buffer mesi", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "temporary_contract_expiry",
        operator: "date_after_financing_end",
        monthsBuffer: 3,
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          employmentType: "temporary_employee",
          temporaryContractExpiry: end + 30 * 86_400_000,
        },
      },
    );
    expect(result.status).toBe("failed");
  });

  it("data mancante", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "temporary_contract_expiry",
        operator: "date_after_financing_end",
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          employmentType: "temporary_employee",
        },
      },
    );
    expect(result.status).toBe("verification_required");
  });

  it("non applicabile a tempo indeterminato", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "temporary_contract_expiry",
        operator: "date_after_financing_end",
      }),
      ctx,
    );
    expect(result.status).toBe("not_applicable");
  });
});

describe("extracomunitari", () => {
  it("non extracomunitario → not_applicable", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: false,
      }),
      ctx,
    );
    expect(result.status).toBe("not_applicable");
  });

  it("extracomunitario ammesso", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: true,
      }),
      {
        ...ctx,
        patient: { ...basePatient, isNonEuCitizen: true },
      },
    );
    expect(result.status).toBe("passed");
  });

  it("extracomunitario non ammesso", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "non_eu_allowed",
        operator: "equals",
        booleanValue: false,
      }),
      {
        ...ctx,
        patient: { ...basePatient, isNonEuCitizen: true },
      },
    );
    expect(result.status).toBe("failed");
  });

  it("permesso oltre fine piano", () => {
    const end = calculateFinancingEndDate({
      calculationDate: calcDate,
      durationMonths: 12,
      firstInstallmentDelayDays: 30,
    });
    const result = evaluatePolicyRule(
      rule({
        ruleType: "residence_permit_expiry",
        operator: "date_after_financing_end",
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          isNonEuCitizen: true,
          residencePermitExpiry: end + 86_400_000,
        },
      },
    );
    expect(result.status).toBe("passed");
  });

  it("permesso in scadenza", () => {
    const end = calculateFinancingEndDate({
      calculationDate: calcDate,
      durationMonths: 12,
      firstInstallmentDelayDays: 30,
    });
    const result = evaluatePolicyRule(
      rule({
        ruleType: "residence_permit_expiry",
        operator: "date_after_financing_end",
      }),
      {
        ...ctx,
        patient: {
          ...basePatient,
          isNonEuCitizen: true,
          residencePermitExpiry: end - 86_400_000,
        },
      },
    );
    expect(result.status).toBe("failed");
  });

  it("data mancante", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "residence_permit_expiry",
        operator: "date_after_financing_end",
      }),
      {
        ...ctx,
        patient: { ...basePatient, isNonEuCitizen: true },
      },
    );
    expect(result.status).toBe("verification_required");
  });
});

describe("importi e durate", () => {
  it("minimo importo", () => {
    expect(
      evaluatePolicyRule(
        rule({
          ruleType: "minimum_amount",
          operator: "greater_than_or_equal",
          numericValue: 1000,
        }),
        ctx,
      ).status,
    ).toBe("passed");
    expect(
      evaluatePolicyRule(
        rule({
          ruleType: "minimum_amount",
          operator: "greater_than_or_equal",
          numericValue: 9000,
        }),
        ctx,
      ).status,
    ).toBe("failed");
  });

  it("massimo importo", () => {
    expect(
      evaluatePolicyRule(
        rule({
          ruleType: "maximum_amount",
          operator: "less_than_or_equal",
          numericValue: 10000,
        }),
        ctx,
      ).status,
    ).toBe("passed");
  });

  it("durata minima e massima", () => {
    expect(
      evaluatePolicyRule(
        rule({
          ruleType: "minimum_duration",
          operator: "greater_than_or_equal",
          numericValue: 6,
        }),
        ctx,
      ).status,
    ).toBe("passed");
    expect(
      evaluatePolicyRule(
        rule({
          ruleType: "maximum_duration",
          operator: "less_than_or_equal",
          numericValue: 6,
        }),
        ctx,
      ).status,
    ).toBe("failed");
  });
});

describe("custom", () => {
  it("restituisce sempre verification_required", () => {
    const result = evaluatePolicyRule(
      rule({
        ruleType: "custom",
        operator: "custom",
        verificationMessage: "Verifica custom",
      }),
      ctx,
    );
    expect(result.status).toBe("verification_required");
    expect(result.message).toBe("Verifica custom");
  });
});

describe("aggregazione compatibilità", () => {
  const minAge = rule({
    id: "a",
    ruleType: "minimum_age",
    operator: "greater_than_or_equal",
    numericValue: 18,
  });
  const maxAge = rule({
    id: "b",
    ruleType: "maximum_age_at_application",
    operator: "less_than_or_equal",
    numericValue: 75,
  });
  const custom = rule({
    id: "c",
    ruleType: "custom",
    operator: "custom",
  });
  const failAge = rule({
    id: "d",
    ruleType: "minimum_age",
    operator: "greater_than_or_equal",
    numericValue: 90,
  });

  it("tutte passate → compatible", () => {
    const result = evaluateCompatibility({
      ...ctx,
      rules: [minAge, maxAge],
    });
    expect(result.status).toBe("compatible");
  });

  it("una verifica → verification_required", () => {
    const result = evaluateCompatibility({
      ...ctx,
      rules: [minAge, custom],
    });
    expect(result.status).toBe("verification_required");
  });

  it("una fallita → not_compatible", () => {
    const result = evaluateCompatibility({
      ...ctx,
      rules: [failAge],
    });
    expect(result.status).toBe("not_compatible");
  });

  it("fallita + verifica → not_compatible", () => {
    const result = evaluateCompatibility({
      ...ctx,
      rules: [failAge, custom],
    });
    expect(result.status).toBe("not_compatible");
  });
});
