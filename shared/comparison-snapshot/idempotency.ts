/**
 * Helper puri per idempotenza requestId e numerazione run.
 */

export function nextRunNumber(existingMax: number | undefined | null): number {
  if (existingMax === undefined || existingMax === null || existingMax < 0) {
    return 1;
  }
  return existingMax + 1;
}

export function findDuplicateByRequestId<T extends { requestId: string }>(
  existing: readonly T[],
  requestId: string,
): T | undefined {
  return existing.find((item) => item.requestId === requestId);
}

export function isDuplicateRequestId(
  existingRequestIds: readonly string[],
  requestId: string,
): boolean {
  return existingRequestIds.includes(requestId);
}

/**
 * True se i dati input della simulazione sono stati modificati dopo il run.
 */
export function hasInputsChangedAfterRun(
  lastInputUpdatedAt: number | undefined,
  runCreatedAt: number,
): boolean {
  return (
    lastInputUpdatedAt !== undefined && lastInputUpdatedAt > runCreatedAt
  );
}
