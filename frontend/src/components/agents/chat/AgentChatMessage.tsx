"use client";

import type { AgentChatBlock, AgentChatProposal } from "@/lib/agent-chat-types";
import { money } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

type Props = {
  block: AgentChatBlock;
  busy?: boolean;
  onRun?: (block: AgentChatBlock, proposal?: AgentChatProposal) => void;
};

function PurchaseSuccessCard({
  productName,
  priceCents,
  merchantName
}: NonNullable<AgentChatBlock["purchaseSuccess"]>) {
  return (
    <div className="agent-chat-purchase-success">
      <div className="agent-chat-purchase-success-icon" aria-hidden>
        <CheckCircle2 strokeWidth={1.75} />
      </div>
      <div className="agent-chat-purchase-success-copy">
        <strong>Purchase completed</strong>
        <p>
          I have completed your purchase. You have successfully placed an order for{" "}
          <span className="agent-chat-purchase-success-product">{productName}</span>
          {priceCents ? ` (${money(priceCents)})` : ""}.
        </p>
        {merchantName ? <span className="agent-chat-purchase-success-merchant">{merchantName}</span> : null}
      </div>
    </div>
  );
}

export function AgentChatMessage({ block, busy, onRun }: Props) {
  const isUser = block.role === "user";

  return (
    <div className={`agent-chat-message ${isUser ? "agent-chat-message--user" : "agent-chat-message--assistant"}`}>
      {block.purchaseSuccess ? <PurchaseSuccessCard {...block.purchaseSuccess} /> : null}

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
    </div>
  );
}
