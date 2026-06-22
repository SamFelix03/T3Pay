"use client";

import type { RunTrace, RunTraceStep } from "@/lib/types";

type Props = {
  trace: RunTrace | null;
  title?: string;
  fillHeight?: boolean;
};

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    run: "Run",
    agent: "Agent",
    vault: "Vault",
    delegation: "Delegation",
    auth: "T3N auth",
    mandate: "Mandate",
    catalog: "Catalog",
    groq: "Groq",
    selection: "Selection",
    t3n: "T3N",
    policy: "Policy",
    approval: "Approval",
    settlement: "Settlement",
    receipt: "Receipt"
  };
  return labels[phase] ?? phase;
}

function DetailBlock({ detail }: { detail: Record<string, unknown> }) {
  return (
    <pre className="trace-detail-json">{JSON.stringify(detail, null, 2)}</pre>
  );
}

function TraceStep({ step }: { step: RunTraceStep }) {
  return (
    <article className={`trace-step trace-step-${step.status}`}>
      <div className="trace-step-head">
        <span className="trace-step-seq">{step.seq}</span>
        <div>
          <span className="trace-step-phase">{phaseLabel(step.phase)}</span>
          <strong>{step.title}</strong>
        </div>
        <span className={`trace-step-status trace-status-${step.status}`}>{step.status}</span>
      </div>
      <time className="trace-step-time">{new Date(step.at).toLocaleString()}</time>
      {Object.keys(step.detail).length ? <DetailBlock detail={step.detail} /> : null}
    </article>
  );
}

export function RunTracePanel({ trace, title = "Run trace", fillHeight = false }: Props) {
  const shellClass = fillHeight ? "run-trace-card run-trace-card--fill" : "surface-card";

  if (!trace?.steps?.length) {
    return (
      <section className={`${shellClass} run-trace-card--empty`}>
        <span className="section-label">{title}</span>
        <p className="empty-state">Start an agent run to see the full step-by-step trace.</p>
      </section>
    );
  }

  return (
    <section className={`${shellClass} run-trace-card`}>
      <div className="card-head">
        <div>
          <span className="section-label">{title}</span>
          <h2>{trace.steps.length} steps</h2>
        </div>
        <span className="trace-window">
          {new Date(trace.startedAt).toLocaleTimeString()} → {new Date(trace.completedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="trace-timeline">
        {trace.steps.map((step) => (
          <TraceStep key={step.seq} step={step} />
        ))}
      </div>
    </section>
  );
}
