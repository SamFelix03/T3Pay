import { z } from "zod";
import { id } from "../../domain/ids";
import { Router, readJson } from "../../http/router";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import { runAgentTask } from "../tasks/service";
import { chooseProductWithGroq, CandidateProduct } from "./groq";

const runSchema = z.object({
  agentId: z.string().min(1),
  mandateId: z.string().min(1),
  paymentMethodId: z.string().min(1),
  objective: z.string().min(1),
  useCase: z.enum(["electronics", "groceries", "travel"]),
  candidateLimit: z.number().int().min(2).max(3).default(3)
});

export function registerAgentRunRoutes(router: Router): void {
  router.get("/api/agent-runs", ({ app, url }) => {
    const agentId = url.searchParams.get("agentId");
    return (agentId
      ? app.repo.list("agent_runs", { eq: { agent_id: agentId }, order: { column: "created_at", ascending: false } })
      : app.repo.list("agent_runs", { order: { column: "created_at", ascending: false }, limit: 100 })
    ).then((runs) => ({ runs: runs.map(decodeRun) }));
  });

  router.post("/api/agent-runs", async ({ req, app }) => {
    const body = await readJson(req, runSchema);
    const agent = await app.repo.getById<any>("agents", body.agentId, "agent");
    const mandate = await app.repo.getById<any>("mandates", body.mandateId, "mandate");
    if (mandate.agent_id !== body.agentId) throw new Error("mandate does not belong to agent");
    const allowedCategories = JSON.parse(mandate.allowed_categories_json);
    const allowedMerchants = JSON.parse(mandate.allowed_merchants_json);
    const [rawProducts, merchants] = await Promise.all([
      app.repo.list<any>("products", { eq: { category: body.useCase }, order: { column: "price_cents", ascending: true }, limit: body.candidateLimit }),
      app.repo.list<any>("merchants")
    ]);
    const merchantById = new Map(merchants.map((merchant: any) => [merchant.id, merchant]));
    const products = rawProducts.filter(
      (product: any) =>
        product.price_cents <= mandate.budget_remaining_cents &&
        allowedCategories.includes(product.category) &&
        allowedMerchants.includes(product.merchant_id)
    );

    const candidates: CandidateProduct[] = products.map((product: any) => ({
      id: product.id,
      merchantId: product.merchant_id,
      merchantName: merchantById.get(product.merchant_id)?.name ?? product.merchant_id,
      name: product.name,
      category: product.category,
      priceCents: product.price_cents,
      currency: product.currency
    }));

    const decision = await chooseProductWithGroq(app.env, {
      objective: body.objective,
      useCase: body.useCase,
      candidates,
      budgetRemainingCents: mandate.budget_remaining_cents,
      allowedCategories,
      allowedMerchants
    });

    const purchase = await runAgentTask(app.repo, app.t3n, {
      agentId: body.agentId,
      mandateId: body.mandateId,
      merchantId: decision.selectedMerchantId,
      productId: decision.selectedProductId,
      paymentMethodId: body.paymentMethodId,
      reason: `${body.objective} | Agent rationale: ${decision.rationale}`
    });

    const receipt = "receipt" in purchase ? purchase.receipt : undefined;
    const runId = id("run");
    const createdAt = nowIso();
    await app.repo.insert("agent_runs", {
        id: runId,
        agent_id: body.agentId,
        mandate_id: body.mandateId,
        objective: body.objective,
        use_case: body.useCase,
        model: app.env.groqModel,
        candidate_products_json: asJson(candidates),
        selected_product_id: decision.selectedProductId,
        selected_merchant_id: decision.selectedMerchantId,
        rationale: decision.rationale,
        confidence: decision.confidence,
        purchase_attempt_id: purchase.attempt.id,
        receipt_id: receipt?.id ?? null,
        status: purchase.attempt.decision,
        created_at: createdAt
    });
    await writeAudit(app.repo, {
      userId: agent.user_id,
      agentId: body.agentId,
      type: "agent_run.completed",
      entityType: "agent_run",
      entityId: runId,
      decision: purchase.attempt.decision,
      payload: { objective: body.objective, selectedProductId: decision.selectedProductId, rationale: decision.rationale }
    });
    return { run: decodeRun(await app.repo.getById("agent_runs", runId, "agent run")), purchase };
  });
}

function decodeRun(row: any) {
  return { ...row, candidateProducts: JSON.parse(row.candidate_products_json) };
}
