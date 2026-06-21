import { z } from "zod";
import { Env } from "../../config/env";
import { badRequest } from "../../domain/errors";
import type { RunTrace } from "./trace";

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

export type GroqDecisionResult = GroqDecision & {
  meta: {
    model: string;
    candidateCount: number;
    requestPayload: Record<string, unknown>;
    rawResponseContent: string;
    usage: unknown;
    finishReason: string | null;
  };
};

export async function chooseProductWithGroq(
  env: Env,
  input: {
    objective: string;
    useCase: string;
    candidates: CandidateProduct[];
    budgetRemainingCents: number;
    allowedCategories: string[];
    allowedMerchants: string[];
  },
  trace?: RunTrace
): Promise<GroqDecisionResult> {
  if (!env.groqApiKey) {
    throw badRequest("GROQ_API_KEY is required for agent inference");
  }
  if (input.candidates.length < 2) {
    throw badRequest("agent inference requires at least two candidate products");
  }

  const requestPayload = {
    objective: input.objective,
    useCase: input.useCase,
    budgetRemainingCents: input.budgetRemainingCents,
    allowedCategories: input.allowedCategories,
    allowedMerchants: input.allowedMerchants,
    candidates: input.candidates
  };

  trace?.step("groq", "Preparing Groq inference request", {
    model: env.groqModel,
    candidateCount: input.candidates.length,
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      merchantId: candidate.merchantId,
      priceCents: candidate.priceCents
    })),
    policyContext: {
      budgetRemainingCents: input.budgetRemainingCents,
      allowedCategories: input.allowedCategories,
      allowedMerchants: input.allowedMerchants
    }
  });

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
          content: JSON.stringify(requestPayload)
        }
      ]
    })
  });

  const json = await response.json();
  if (!response.ok) {
    trace?.error("groq", "Groq API request failed", { status: response.status, body: json });
    throw badRequest("Groq inference failed", json);
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    trace?.error("groq", "Groq response missing JSON content", { body: json });
    throw badRequest("Groq response did not include a JSON decision");
  }

  const parsed = groqDecisionSchema.parse(JSON.parse(content));
  const selected = input.candidates.find(
    (candidate) =>
      candidate.id === parsed.selectedProductId && candidate.merchantId === parsed.selectedMerchantId
  );
  if (!selected) {
    trace?.error("groq", "Groq selected product outside candidate set", { parsed });
    throw badRequest("Groq selected a product outside the provided candidate set", parsed);
  }

  trace?.success("groq", "Groq selected a product", {
    selectedProductId: parsed.selectedProductId,
    selectedMerchantId: parsed.selectedMerchantId,
    selectedProductName: selected.name,
    rationale: parsed.rationale,
    confidence: parsed.confidence,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
    usage: json.usage ?? null
  });

  return {
    ...parsed,
    meta: {
      model: env.groqModel,
      candidateCount: input.candidates.length,
      requestPayload,
      rawResponseContent: content,
      usage: json.usage ?? null,
      finishReason: json.choices?.[0]?.finish_reason ?? null
    }
  };
}
