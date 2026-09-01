/**
 * Normalizza valori per Convex: omette `undefined`, mantiene `null` solo se esplicito.
 */

export function normalizeOptional<T>(
  value: T | undefined | null,
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as { [K in keyof T]?: Exclude<T[K], undefined> };
}

export function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) {
        result[key] = stripUndefinedDeep(entry);
      }
    }
    return result as T;
  }
  return value;
}
