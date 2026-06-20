import type { MockCard, MockWallet } from "./types";

export function createMockCard(holder: string): MockCard {
  const suffix = randomDigits(4);
  return {
    holder: holder.toUpperCase(),
    number: `4242 4242 4242 ${suffix}`,
    expiry: `${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}/${String(29 + Math.floor(Math.random() * 5)).slice(-2)}`,
    cvc: randomDigits(3),
    network: "T3Pay Visa"
  };
}

export function createMockWallet(): MockWallet {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const address = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { address, symbol: "USDC" };
}

function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}
