export type RunTraceStep = {
  seq: number;
  phase: string;
  title: string;
  status: "info" | "success" | "warning" | "error";
  at: string;
  detail: Record<string, unknown>;
};

export class RunTrace {
  private steps: RunTraceStep[] = [];
  private counter = 0;

  step(
    phase: string,
    title: string,
    detail: Record<string, unknown> = {},
    status: RunTraceStep["status"] = "info"
  ): void {
    this.counter += 1;
    this.steps.push({
      seq: this.counter,
      phase,
      title,
      status,
      at: new Date().toISOString(),
      detail: sanitizeTraceDetail(detail)
    });
  }

  success(phase: string, title: string, detail: Record<string, unknown> = {}): void {
    this.step(phase, title, detail, "success");
  }

  warning(phase: string, title: string, detail: Record<string, unknown> = {}): void {
    this.step(phase, title, detail, "warning");
  }

  error(phase: string, title: string, detail: Record<string, unknown> = {}): void {
    this.step(phase, title, detail, "error");
  }

  toJSON(): { steps: RunTraceStep[]; startedAt: string; completedAt: string } {
    const startedAt = this.steps[0]?.at ?? new Date().toISOString();
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      steps: this.steps
    };
  }
}

function sanitizeTraceDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["credential_jcs_b64u", "user_sig_b64u", "agent_invocation_sig_b64u", "t3nApiKey", "privateKey"]);
  return JSON.parse(
    JSON.stringify(detail, (_key, value) => {
      if (typeof value === "string" && blocked.has(_key)) return "[redacted]";
      if (typeof _key === "string" && blocked.has(_key)) return "[redacted]";
      return value;
    })
  ) as Record<string, unknown>;
}
