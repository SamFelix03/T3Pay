import { z } from "zod";
import { Router, readJson } from "../../http/router";
import { id } from "../../domain/ids";
import { notFound } from "../../domain/errors";
import { asJson, nowIso } from "../shared";
import { writeAudit } from "../activity/service";

const createVaultSchema = z.object({ userId: z.string().min(1) });
const createPaymentMethodSchema = z.object({
  type: z.enum(["card", "stablecoin"]),
  alias: z.string().min(1),
  balanceCents: z.number().int().nonnegative(),
  currency: z.enum(["USD", "USDC"])
});

const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1)
});

export function registerVaultRoutes(router: Router): void {
  router.post("/api/vaults", async ({ req, app }) => {
    const body = await readJson(req, createVaultSchema);
    await app.repo.getById("users", body.userId, "user");
    const vaultId = id("vlt");
    const createdAt = nowIso();
    await app.repo.insert("vaults", { id: vaultId, user_id: body.userId, status: "active", created_at: createdAt });
    await writeAudit(app.repo, { userId: body.userId, type: "vault.created", entityType: "vault", entityId: vaultId, payload: { vaultId } });
    return { vault: { id: vaultId, userId: body.userId, status: "active", createdAt } };
  });

  router.get("/api/vaults/:id", async ({ params, app }) => {
    const vault = await app.repo.getById("vaults", params.id, "vault");
    const paymentMethods = await app.repo.list("payment_methods", { eq: { vault_id: params.id }, select: "id,vault_id,type,alias,display,balance_cents,currency,status,created_at" });
    return { vault, paymentMethods };
  });

  router.post("/api/vaults/:id/payment-methods", async ({ req, params, app }) => {
    const body = await readJson(req, createPaymentMethodSchema);
    const vault = await app.repo.getById<any>("vaults", params.id, "vault");
    const paymentMethodId = id(body.type === "card" ? "card" : "wal");
    const createdAt = nowIso();
    const display = body.type === "card" ? `${body.alias} ending 4242` : `${body.alias} address ...7c6a`;
    const secretRef = `z:tenant:secrets/${paymentMethodId}`;
    await app.repo.insert("payment_methods", {
        id: paymentMethodId,
        vault_id: params.id,
        type: body.type,
        alias: body.alias,
        display,
        balance_cents: body.balanceCents,
        currency: body.currency,
        status: "active",
        t3n_secret_ref: secretRef,
        created_at: createdAt
    });
    await writeAudit(app.repo, {
      userId: vault.user_id,
      type: "vault.payment_method_created",
      entityType: "payment_method",
      entityId: paymentMethodId,
      payload: { paymentMethodId, type: body.type, display, secretRef }
    });
    return { paymentMethod: { id: paymentMethodId, vaultId: params.id, type: body.type, alias: body.alias, display, balanceCents: body.balanceCents, currency: body.currency, status: "active", createdAt } };
  });

  router.post("/api/vaults/:id/attach-payment-method", async ({ req, params, app }) => {
    const body = await readJson(req, attachPaymentMethodSchema);
    const vault = await app.repo.getById<any>("vaults", params.id, "vault");
    const paymentMethod = await app.repo.getById<any>("payment_methods", body.paymentMethodId, "payment method");
    const sourceVault = await app.repo.getById<any>("vaults", paymentMethod.vault_id, "vault");
    if (sourceVault.user_id !== vault.user_id) {
      throw notFound("payment method");
    }
    if (String(paymentMethod.vault_id) === params.id) {
      return { paymentMethod: decodePaymentMethod(paymentMethod) };
    }
    const updated = await app.repo.update("payment_methods", body.paymentMethodId, { vault_id: params.id });
    await writeAudit(app.repo, {
      userId: vault.user_id,
      type: "vault.payment_method_attached",
      entityType: "payment_method",
      entityId: body.paymentMethodId,
      payload: { paymentMethodId: body.paymentMethodId, fromVaultId: paymentMethod.vault_id, toVaultId: params.id }
    });
    return { paymentMethod: decodePaymentMethod(updated) };
  });

  router.post("/api/vault/payment-method", async ({ req, app }) => {
    const body = await readJson(req, createPaymentMethodSchema.extend({ vaultId: z.string().min(1) }));
    const route = router as unknown as { __noop?: never };
    void route;
    const vault = await app.repo.maybeById<any>("vaults", body.vaultId);
    if (!vault) throw notFound("vault");
    return { message: "Use POST /api/vaults/:id/payment-methods", vaultId: body.vaultId };
  });
}

function decodePaymentMethod(row: any) {
  return {
    id: row.id,
    vaultId: row.vault_id,
    type: row.type,
    alias: row.alias,
    display: row.display,
    balanceCents: row.balance_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at
  };
}
