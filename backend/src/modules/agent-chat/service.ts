import { conflict, notFound } from "../../domain/errors";
import type { Env } from "../../config/env";
import type { SupabaseRepository } from "../../db/supabase";
import { roleAllowsPurchases, useCasesForRole } from "./role-scope";
import { chatWithAgentGroq, type ChatProduct } from "./groq-chat";

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

async function loadEligibleProducts(
  repo: SupabaseRepository,
  mandate: any,
  role: string
): Promise<ChatProduct[]> {
  const allowedCategories = JSON.parse(mandate.allowed_categories_json) as string[];
  const allowedMerchants = JSON.parse(mandate.allowed_merchants_json) as string[];
  const roleUseCases = useCasesForRole(role);
  const categories = allowedCategories.filter((category) =>
    roleUseCases.includes(category as "electronics" | "groceries" | "travel")
  );

  const [rawProducts, merchants] = await Promise.all([
    repo.list<any>("products", { order: { column: "price_cents", ascending: true }, limit: 30 }),
    repo.list<any>("merchants")
  ]);
  const merchantById = new Map(merchants.map((merchant: any) => [merchant.id, merchant]));

  return rawProducts
    .filter(
      (product: any) =>
        product.price_cents <= mandate.budget_remaining_cents &&
        categories.includes(product.category) &&
        allowedMerchants.includes(product.merchant_id)
    )
    .slice(0, 9)
    .map((product: any) => ({
      id: product.id,
      merchantId: product.merchant_id,
      merchantName: merchantById.get(product.merchant_id)?.name ?? product.merchant_id,
      name: product.name,
      category: product.category,
      priceCents: product.price_cents,
      currency: product.currency
    }));
}

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

  const eligibleProducts = await loadEligibleProducts(repo, mandate, String(agent.role ?? "custom_agent"));
  const decision = await chatWithAgentGroq(env, {
    agentName: String(agent.name),
    agentRole: String(agent.role ?? "custom_agent"),
    budgetRemainingCents: mandate.budget_remaining_cents,
    allowedCategories: JSON.parse(mandate.allowed_categories_json),
    allowedMerchants: JSON.parse(mandate.allowed_merchants_json),
    eligibleProducts,
    messages: input.messages
  });

  const proposals = decision.proposalProductIds
    .map((productId) => eligibleProducts.find((product) => product.id === productId))
    .filter((product): product is ChatProduct => Boolean(product))
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
