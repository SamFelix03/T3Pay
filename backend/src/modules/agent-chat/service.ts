import { conflict, notFound } from "../../domain/errors";
import type { Env } from "../../config/env";
import type { SupabaseRepository } from "../../db/supabase";
import { loadProductCatalog } from "../catalog/products";
import { roleAllowsPurchases } from "./role-scope";
import { chatWithAgentGroq } from "./groq-chat";

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatProposal = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  category: string;
  priceCents: number;
  currency: string;
};

export type AgentChatResponse = {
  reply: string;
  inScope: boolean;
  intent: "chat" | "purchase" | "clarify";
  useCase: "electronics" | "groceries" | "travel" | null;
  objective: string | null;
  proposals: AgentChatProposal[];
  canRun: boolean;
};

export async function handleAgentChat(
  repo: SupabaseRepository,
  env: Env,
  input: { agentId: string; messages: AgentChatMessage[] }
): Promise<AgentChatResponse> {
  const agent = await repo.getById<any>("agents", input.agentId, "agent");
  const mandates = await repo.list<any>("mandates", {
    eq: { agent_id: input.agentId },
    order: { column: "created_at", ascending: false },
    limit: 1
  });
  const mandate = mandates[0];
  if (!mandate) throw notFound("mandate not found for agent");

  const catalogProducts = await loadProductCatalog(repo);
  const decision = await chatWithAgentGroq(env, {
    agentName: String(agent.name),
    agentRole: String(agent.role ?? "custom_agent"),
    budgetRemainingCents: mandate.budget_remaining_cents,
    perPurchaseLimitCents: mandate.per_purchase_limit_cents,
    approvalThresholdCents: mandate.approval_threshold_cents,
    allowedCategories: JSON.parse(mandate.allowed_categories_json),
    allowedMerchants: JSON.parse(mandate.allowed_merchants_json),
    catalogProducts,
    messages: input.messages
  });

  const proposals = decision.proposalProductIds
    .map((productId) => catalogProducts.find((product) => product.id === productId))
    .filter((product): product is (typeof catalogProducts)[number] => Boolean(product))
    .map((product) => ({
      id: product.id,
      merchantId: product.merchantId,
      merchantName: product.merchantName,
      name: product.name,
      category: product.category,
      priceCents: product.priceCents,
      currency: product.currency
    }));

  const canRun =
    decision.inScope &&
    decision.intent === "purchase" &&
    roleAllowsPurchases(String(agent.role)) &&
    Boolean(decision.objective) &&
    Boolean(decision.useCase) &&
    proposals.length > 0;

  if (!decision.inScope && decision.intent === "purchase") {
    return {
      reply: decision.reply,
      inScope: false,
      intent: "chat",
      useCase: null,
      objective: null,
      proposals: [],
      canRun: false
    };
  }

  if (agent.status === "revoked") {
    throw conflict("agent is revoked");
  }

  return {
    reply: decision.reply,
    inScope: decision.inScope,
    intent: decision.intent,
    useCase: decision.useCase,
    objective: decision.objective,
    proposals,
    canRun
  };
}
