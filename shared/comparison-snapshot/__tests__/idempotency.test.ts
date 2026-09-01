import { describe, expect, it } from "vitest";
import {
  findDuplicateByRequestId,
  hasInputsChangedAfterRun,
  isDuplicateRequestId,
  nextRunNumber,
} from "../idempotency.ts";

describe("nextRunNumber", () => {
  it("parte da 1 se non esistono run", () => {
    expect(nextRunNumber(undefined)).toBe(1);
    expect(nextRunNumber(null)).toBe(1);
  });

  it("incrementa dal massimo esistente (1 poi 2)", () => {
    expect(nextRunNumber(1)).toBe(2);
    expect(nextRunNumber(2)).toBe(3);
  });
});

describe("duplicate requestId", () => {
  it("rileva duplicati", () => {
    expect(isDuplicateRequestId(["a", "b"], "a")).toBe(true);
    expect(isDuplicateRequestId(["a", "b"], "c")).toBe(false);

    const existing = [
      { requestId: "req-1", runNumber: 1 },
      { requestId: "req-2", runNumber: 2 },
    ];
    expect(findDuplicateByRequestId(existing, "req-1")?.runNumber).toBe(1);
    expect(findDuplicateByRequestId(existing, "req-9")).toBeUndefined();
  });
});

describe("hasInputsChangedAfterRun", () => {
  it("rileva input modificati dopo il run", () => {
    expect(hasInputsChangedAfterRun(undefined, 1000)).toBe(false);
    expect(hasInputsChangedAfterRun(900, 1000)).toBe(false);
    expect(hasInputsChangedAfterRun(1000, 1000)).toBe(false);
    expect(hasInputsChangedAfterRun(1001, 1000)).toBe(true);
  });
});
