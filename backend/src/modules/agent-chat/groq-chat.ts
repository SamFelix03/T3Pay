import { z } from "zod";
import type { Env } from "../../config/env";
import { badRequest } from "../../domain/errors";
import { roleAllowsPurchases, roleLabel, roleResponsibility, useCasesForRole } from "./role-scope";

export type ChatProduct = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  category: string;
  priceCents: number;
  currency: string;
};

const chatDecisionSchema = z.object({
  reply: z.string().min(1).max(2000),
  inScope: z.boolean(),
  intent: z.enum(["chat", "purchase", "clarify"]),
  useCase: z.enum(["electronics", "groceries", "travel"]).nullable(),
  objective: z.string().max(500).nullable(),
  proposalProductIds: z.array(z.string()).max(3).default([])
});

export type ChatDecision = z.infer<typeof chatDecisionSchema>;

export type AgentChatInput = {
  agentName: string;
  agentRole: string;
  budgetRemainingCents: number;
  allowedCategories: string[];
  allowedMerchants: string[];
  eligibleProducts: ChatProduct[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function chatWithAgentGroq(env: Env, input: AgentChatInput): Promise<ChatDecision> {
  if (!env.groqApiKey) {
    throw badRequest("GROQ_API_KEY is required for agent chat");
  }

  const role = input.agentRole;
  const purchasesAllowed = roleAllowsPurchases(role);
  const roleUseCases = useCasesForRole(role);
  const productCatalog = input.eligibleProducts.map((product) => ({
    id: product.id,
    merchantId: product.merchantId,
    name: product.name,
    category: product.category,
    priceCents: product.priceCents,
    merchantName: product.merchantName
  }));

  const systemPrompt = [
    `You are ${input.agentName}, a ${roleLabel(role)} in VaultPay.`,
    `Responsibility: ${roleResponsibility(role)}`,
    purchasesAllowed
      ? `You may help with purchases only inside your role and mandate. Supported use cases for this role: ${roleUseCases.join(", ") || "none"}.`
      : "You must not initiate purchases or propose products to buy. Politely refuse purchase requests and offer research or policy guidance instead.",
    `Budget remaining: ${input.budgetRemainingCents} cents.`,
    `Allowed categories: ${input.allowedCategories.join(", ")}.`,
    `Allowed merchants: ${input.allowedMerchants.join(", ")}.`,
    "Return JSON only with keys: reply, inScope, intent, useCase, objective, proposalProductIds.",
    "reply: natural conversational text for the user.",
    "inScope: false when the request is outside your role, mandate, or purchase authority.",
    "intent: chat for general Q&A, clarify when you need more detail, purchase when the user wants to buy something in scope.",
    "useCase: electronics, groceries, or travel when intent is purchase; otherwise null.",
    "objective: concise purchase instruction when intent is purchase; otherwise null.",
    "proposalProductIds: up to 3 product ids from eligibleProducts that fit the request when intent is purchase; otherwise [].",
    "Never claim you completed a purchase — the app runs policy and settlement separately.",
    "Keep reply concise and helpful."
  ].join("\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.groqApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.groqModel,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            eligibleProducts: productCatalog,
            conversation: input.messages
          })
        }
      ]
    })
  });

  const json = await response.json();
  if (!response.ok) {
    throw badRequest("Groq chat failed", json);
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw badRequest("Groq chat response missing JSON content");
  }

  const parsed = chatDecisionSchema.parse(JSON.parse(content));

  if (!purchasesAllowed && parsed.intent === "purchase") {
    return {
      reply:
        parsed.reply ||
        "I can research options and explain policy, but this agent role cannot execute purchases. Ask me for guidance instead.",
      inScope: false,
      intent: "chat",
      useCase: null,
      objective: null,
      proposalProductIds: []
    };
  }

  if (parsed.intent === "purchase" && parsed.useCase && !roleUseCases.includes(parsed.useCase)) {
    return {
      reply: `${parsed.reply} That category is outside my role as a ${roleLabel(role)}.`,
      inScope: false,
      intent: "chat",
      useCase: null,
      objective: null,
      proposalProductIds: []
    };
  }

  const validIds = new Set(input.eligibleProducts.map((product) => product.id));
  const proposalProductIds = parsed.proposalProductIds.filter((id) => validIds.has(id));

  return {
    ...parsed,
    proposalProductIds,
    inScope: parsed.inScope && (parsed.intent !== "purchase" || purchasesAllowed)
  };
}
