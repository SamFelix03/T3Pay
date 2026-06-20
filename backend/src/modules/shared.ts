import { z } from "zod";
import { CONTRACT_RECORD_LIMIT_BYTES, PAYMENT_METHODS } from "../config/constants";
import { badRequest } from "../domain/errors";

export const moneySchema = z.object({
  cents: z.number().int().nonnegative(),
  currency: z.enum(["USD", "USDC"]).default("USD")
});

export const paymentMethodSchema = z.enum(PAYMENT_METHODS);

export function nowIso(): string {
  return new Date().toISOString();
}

export function asJson<T>(value: T): string {
  return JSON.stringify(value);
}

export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function assertContractRecordSize(label: string, value: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > CONTRACT_RECORD_LIMIT_BYTES) {
    throw badRequest(`${label} exceeds ${CONTRACT_RECORD_LIMIT_BYTES} byte contract record limit`, { bytes });
  }
}
