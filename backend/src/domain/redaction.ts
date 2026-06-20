const SECRET_KEYS = new Set([
  "number",
  "cardNumber",
  "cvc",
  "cvv",
  "privateKey",
  "secret",
  "token",
  "rawCredential",
  "billingAddress"
]);

export function sanitize<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => sanitize(item)) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.has(key) ? "[redacted]" : sanitize(child);
  }
  return out as T;
}
