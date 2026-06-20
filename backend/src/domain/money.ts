import { badRequest } from "./errors";

export type Money = {
  currency: "USD" | "USDC";
  cents: number;
};

export function money(cents: number, currency: Money["currency"] = "USD"): Money {
  if (!Number.isInteger(cents) || cents < 0) throw badRequest("money must be a non-negative integer number of cents");
  return { cents, currency };
}

export function formatMoney(value: Money): string {
  return `${value.currency} ${(value.cents / 100).toFixed(2)}`;
}
