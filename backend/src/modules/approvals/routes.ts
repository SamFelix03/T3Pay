import { Router } from "../../http/router";
import { conflict } from "../../domain/errors";
import { nowIso } from "../shared";
import { writeAudit } from "../activity/service";
import { resumeApprovedTask } from "../tasks/service";

export function registerApprovalRoutes(router: Router): void {
  router.get("/api/approvals", ({ app, url }) => {
    const status = url.searchParams.get("status");
    return (status
      ? app.repo.list("approvals", { eq: { status }, order: { column: "created_at", ascending: false } })
      : app.repo.list("approvals", { order: { column: "created_at", ascending: false } })
    ).then((approvals) => ({ approvals: approvals.map(decodeApproval) }));
  });

  router.post("/api/approvals/:id/approve", async ({ params, app }) => {
    const approval = await app.repo.getById<any>("approvals", params.id, "approval");
    if (!["pending", "approved"].includes(approval.status)) throw conflict("approval cannot be approved");
    const resolvedAt = nowIso();
    if (approval.status === "pending") {
      await app.t3n.approveAction(params.id);
      await app.repo.update("approvals", params.id, { status: "approved", resolved_at: resolvedAt });
      await writeAudit(app.repo, {
        agentId: approval.agent_id,
        type: "approval.approved",
        entityType: "approval",
        entityId: params.id,
        decision: "approved",
        payload: { approvalId: params.id }
      });
    }
    const result = await resumeApprovedTask(app.repo, app.t3n, params.id);
    return { approval: decodeApproval(await app.repo.getById("approvals", params.id, "approval")), result };
  });

  router.post("/api/approvals/:id/reject", async ({ params, app }) => {
    const approval = await app.repo.getById<any>("approvals", params.id, "approval");
    if (approval.status !== "pending") throw conflict("approval is not pending");
    await app.t3n.rejectAction(params.id);
    await app.repo.update("approvals", params.id, { status: "rejected", resolved_at: nowIso() });
    await writeAudit(app.repo, {
      agentId: approval.agent_id,
      type: "approval.rejected",
      entityType: "approval",
      entityId: params.id,
      decision: "rejected",
      payload: { approvalId: params.id }
    });
    return { approval: decodeApproval(await app.repo.getById("approvals", params.id, "approval")) };
  });
}

function decodeApproval(row: any) {
  return { ...row, payload: JSON.parse(row.payload_json) };
}
