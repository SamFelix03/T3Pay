import { z } from "zod";
import { Env } from "../../config/env";
import { badRequest } from "../../domain/errors";

const groqDecisionSchema = z.object({
  selectedProductId: z.string().min(1),
  selectedMerchantId: z.string().min(1),
  rationale: z.string().min(1).max(800),
  confidence: z.number().min(0).max(1)
});

export type CandidateProduct = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  category: string;
  priceCents: number;
  currency: string;
};

export type GroqDecision = z.infer<typeof groqDecisionSchema>;

export async function chooseProductWithGroq(
  env: Env,
  input: {
    objective: string;
    useCase: string;
    candidates: CandidateProduct[];
    budgetRemainingCents: number;
    allowedCategories: string[];
    allowedMerchants: string[];
  }
): Promise<GroqDecision> {
  if (!env.groqApiKey) {
    throw badRequest("GROQ_API_KEY is required for agent inference");
  }
  if (input.candidates.length < 2) {
    throw badRequest("agent inference requires at least two candidate products");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.groqApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.groqModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are the purchasing brain for VaultPay agents. Choose exactly one candidate product that best satisfies the user objective and policy. Return only JSON with selectedProductId, selectedMerchantId, rationale, confidence. Rationale must be concise and must not include hidden chain-of-thought."
        },
        {
          role: "user",
          content: JSON.stringify({
            objective: input.objective,
            useCase: input.useCase,
            budgetRemainingCents: input.budgetRemainingCents,
            allowedCategories: input.allowedCategories,
            allowedMerchants: input.allowedMerchants,
            candidates: input.candidates
          })
        }
      ]
    })
  });

  const json = await response.json();
  if (!response.ok) {
    throw badRequest("Groq inference failed", json);
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw badRequest("Groq response did not include a JSON decision");
  }
  const parsed = groqDecisionSchema.parse(JSON.parse(content));
  const selected = input.candidates.find(
    (candidate) =>
      candidate.id === parsed.selectedProductId && candidate.merchantId === parsed.selectedMerchantId
  );
  if (!selected) {
    throw badRequest("Groq selected a product outside the provided candidate set", parsed);
  }
  return parsed;
}
