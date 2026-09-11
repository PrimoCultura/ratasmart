import { describe, expect, it } from "vitest";
import {
  evaluateIncomeDocumentRequirements,
  INCOME_DOCUMENT_THRESHOLD_EUR,
} from "../index.ts";

describe("documentationRequirements – income document", () => {
  it("G) italiano <= soglia → possible exemption Agos/Compass/DB", () => {
    const result = evaluateIncomeDocumentRequirements({
      requestedAmount: 4500,
      financedFees: 100,
      isNonEuCitizen: false,
    });
    expect(result.incomeDocument.thresholdBase).toBe(4600);
    expect(result.incomeDocument.thresholdEur).toBe(INCOME_DOCUMENT_THRESHOLD_EUR);
    expect(result.incomeDocument.status).toBe("possible_exemption");
    for (const company of result.incomeDocument.companies) {
      expect(company.status).toBe("possible_exemption");
    }
  });

  it("H) extracomunitario <= soglia → Agos exemption, Compass/DB required", () => {
    const result = evaluateIncomeDocumentRequirements({
      requestedAmount: 4000,
      financedFees: 50,
      isNonEuCitizen: true,
    });
    expect(result.incomeDocument.thresholdBase).toBeLessThanOrEqual(5000);
    expect(result.incomeDocument.status).toBe("requires_verification");
    const byName = Object.fromEntries(
      result.incomeDocument.companies.map((item) => [
        item.companyShortName,
        item.status,
      ]),
    );
    expect(byName.Agos).toBe("possible_exemption");
    expect(byName.Compass).toBe("required");
    expect(byName["Deutsche Bank"]).toBe("required");
  });

  it("base soglia = requestedAmount + financedFees", () => {
    const result = evaluateIncomeDocumentRequirements({
      requestedAmount: 4900,
      financedFees: 200,
      isNonEuCitizen: false,
    });
    expect(result.incomeDocument.thresholdBase).toBe(5100);
    expect(result.incomeDocument.status).toBe("required");
  });
});
