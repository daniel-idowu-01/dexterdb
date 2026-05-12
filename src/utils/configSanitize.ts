const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Removes prototype-pollution-prone keys from parsed config objects (YAML/JSON).
 */
export function sanitizeConfigInput<T>(value: T): T {
  return sanitizeValue(value) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value instanceof Date) {
    return value;
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (POLLUTION_KEYS.has(key)) {
      continue;
    }
    out[key] = sanitizeValue(obj[key]);
  }

  return out;
}
