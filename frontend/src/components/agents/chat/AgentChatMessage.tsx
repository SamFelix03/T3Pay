"use client";

import type { AgentChatBlock, AgentChatProposal } from "@/lib/agent-chat-types";
import { money } from "@/lib/format";

type Props = {
  block: AgentChatBlock;
  busy?: boolean;
  onRun?: (block: AgentChatBlock, proposal?: AgentChatProposal) => void;
};

export function AgentChatMessage({ block, busy, onRun }: Props) {
  const isUser = block.role === "user";

  return (
    <div className={`agent-chat-message ${isUser ? "agent-chat-message--user" : "agent-chat-message--assistant"}`}>
      {block.text ? (
        <div className={`agent-chat-bubble ${isUser ? "agent-chat-bubble--user" : "agent-chat-bubble--assistant"}`}>
          {block.text}
        </div>
      ) : null}

      {block.role === "assistant" && block.proposals?.length ? (
        <div className="agent-chat-proposals">
          {block.proposals.map((proposal) => (
            <button
              key={proposal.id}
              type="button"
              className="agent-chat-proposal-card"
              disabled={busy || !block.canRun}
              onClick={() => onRun?.(block, proposal)}
            >
              <strong>{proposal.name}</strong>
              <span>{proposal.merchantName}</span>
              <span>{money(proposal.priceCents)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {block.role === "assistant" && block.canRun && onRun ? (
        <div className="agent-chat-run-row">
          <button type="button" className="primary-btn" disabled={busy} onClick={() => onRun(block)}>
            {busy ? "Running…" : "Run with best match"}
          </button>
        </div>
      ) : null}

      {block.runSummary ? <p className="agent-chat-run-summary">{block.runSummary}</p> : null}
    </div>
  );
}
