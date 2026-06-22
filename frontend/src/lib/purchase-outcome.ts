import { money } from "@/lib/format";

export type PurchaseOutcomeStatus = "approved" | "rejected" | "pending_approval" | "revoked" | string;

export function humanizePurchaseReason(
  reason: string | null | undefined,
  status: PurchaseOutcomeStatus
): string {
  const code = String(reason ?? "").trim();
  const messages: Record<string, string> = {
    budget_exceeded: "The product price is higher than your remaining mandate budget.",
    per_purchase_limit_exceeded: "The product price exceeds your per-purchase spending limit.",
    approval_required: "This purchase needs your approval before it can complete.",
    merchant_not_allowed: "This merchant is not on your mandate allowlist.",
    category_not_allowed: "This product category is not allowed by your mandate.",
    payment_method_not_allowed: "Your mandate does not allow this payment method.",
    insufficient_payment_balance: "The selected card or wallet does not have enough balance.",
    agent_vault_not_assigned: "This agent is not assigned to a vault.",
    payment_method_vault_mismatch: "The payment method does not belong to the agent's vault.",
    agent_revoked: "This agent has been revoked.",
    agent_paused: "This agent is paused.",
    agent_grant_missing: "This agent does not have an active spending grant.",
    agent_grant_revoked: "This agent's spending grant was revoked.",
    mandate_revoked: "The spending mandate was revoked.",
    mandate_not_active: "The spending mandate is not active.",
    mandate_expired: "The spending mandate has expired.",
    payment_method_not_active: "The selected payment method is not active.",
    agent_not_allowed: "This agent is not authorized for the mandate.",
    agent_did_not_allowed: "The agent identity did not match the mandate."
  };

  if (code && messages[code]) return messages[code];
  if (status === "pending_approval") {
    return "This purchase is waiting for your approval in the Approvals tab.";
  }
  if (status === "rejected" || status === "revoked") {
    return code
      ? `The purchase was blocked (${code.replace(/_/g, " ")}).`
      : "The purchase was blocked by spending policy.";
  }
  return "The purchase could not be completed.";
}

export function purchaseOutcomeTitle(status: PurchaseOutcomeStatus): string {
  if (status === "approved") return "Purchase completed";
  if (status === "pending_approval") return "Approval required";
  if (status === "revoked") return "Purchase revoked";
  return "Purchase blocked";
}

export function purchaseOutcomeMessage(input: {
  status: PurchaseOutcomeStatus;
  reason?: string | null;
  productName: string;
  priceCents?: number;
}): string {
  const price = input.priceCents ? ` (${money(input.priceCents)})` : "";
  if (input.status === "approved") {
    return `You successfully placed an order for ${input.productName}${price}.`;
  }
  if (input.status === "pending_approval") {
    return `I selected ${input.productName}${price}, but it needs your approval before checkout can finish.`;
  }
  return `I could not complete your order for ${input.productName}${price}. ${humanizePurchaseReason(input.reason, input.status)}`;
}
