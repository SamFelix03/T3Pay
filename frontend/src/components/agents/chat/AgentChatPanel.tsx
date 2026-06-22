"use client";

import { useEffect } from "react";
import type { AgentChatBlock, AgentChatProposal } from "@/lib/agent-chat-types";
import { roleChatMetaName } from "@/lib/agent-utils";
import { StatusChip } from "@/components/ui/primitives";
import { AgentChatComposer, AgentChatTypingIndicator, AgentChatWindowChrome } from "@/components/agents/chat/AgentChatChrome";
import { AgentChatMessage } from "@/components/agents/chat/AgentChatMessage";
import { useStickToBottom } from "@/hooks/useStickToBottom";

type Props = {
  agentName: string;
  agentRole: string;
  vaultLabel: string;
  grantStatus: string;
  chat: AgentChatBlock[];
  draft: string;
  loading: boolean;
  busy: boolean;
  canChat: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRun: (block: AgentChatBlock, proposal?: AgentChatProposal) => void;
  onExample: (text: string) => void;
  onClearHistory?: () => void;
};

const EXAMPLES: Record<string, string[]> = {
  shopping_agent: [
    "Find a USB-C charger under $50 from an approved electronics merchant.",
    "Compare grocery staples I can buy within my per-purchase limit.",
    "What electronics deals fit my remaining budget?"
  ],
  travel_agent: [
    "Book a hotel night within my approval threshold.",
    "Find a travel option under my per-purchase limit.",
    "What travel merchants are in my mandate?"
  ],
  subscription_agent: [
    "Put together a weekly grocery basket under budget.",
    "Set up a recurring grocery purchase within my limit.",
    "What subscription-style groceries can I order today?"
  ],
  research_only: [
    "What merchants and categories am I allowed to research?",
    "Summarize my spending limits without making a purchase.",
    "Which products are in scope for my mandate?"
  ],
  custom_agent: [
    "What can you help me buy with my current mandate?",
    "Find something useful under my per-purchase limit.",
    "What merchants and categories can you shop from?"
  ]
};

export function AgentChatPanel({
  agentName,
  agentRole,
  vaultLabel,
  grantStatus,
  chat,
  draft,
  loading,
  busy,
  canChat,
  onDraftChange,
  onSend,
  onRun,
  onExample,
  onClearHistory
}: Props) {
  const { viewportRef, followOutput, enableStickToBottom } = useStickToBottom<HTMLDivElement>();
  const canSend = Boolean(draft.trim()) && !loading && !busy && canChat;
  const showTyping = loading;
  const isEmpty = chat.length === 0;
  const examples = EXAMPLES[agentRole] ?? EXAMPLES.custom_agent;

  useEffect(() => {
    followOutput();
  }, [chat, loading, showTyping, followOutput]);

  function handleSend() {
    enableStickToBottom("smooth");
    onSend();
  }

  return (
    <AgentChatWindowChrome>
      <header className="agent-chat-header">
        <div>
          <span className="section-label">Agent chat</span>
          <h2 className="agent-chat-title">{agentName}</h2>
          <p className="agent-chat-subtitle">Ask for help within this agent&apos;s role and mandate.</p>
        </div>
        <div className="agent-chat-header-meta">
          <div className="agent-chat-meta-badge">
            <span>role</span>
            <strong>{roleChatMetaName(agentRole)}</strong>
          </div>
          <div className="agent-chat-meta-badge">
            <span>vault</span>
            <strong>{vaultLabel}</strong>
          </div>
          <StatusChip value={grantStatus} />
          {onClearHistory && chat.length ? (
            <button type="button" className="ghost-btn agent-chat-clear-btn" onClick={onClearHistory}>
              Clear history
            </button>
          ) : null}
        </div>
      </header>

      <div className="agent-chat-viewport" ref={viewportRef}>
        <div className="agent-chat-thread">
          {isEmpty ? (
            <div className="agent-chat-empty">
              <p>Tell this agent what you need. It will stay within its role and spending mandate.</p>
              <div className="agent-chat-example-prompts" role="list" aria-label="Example prompts">
                {examples.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="agent-chat-example-prompt"
                    onClick={() => onExample(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {chat.map((block, index) => (
            <AgentChatMessage key={`${block.role}-${index}`} block={block} busy={busy} onRun={onRun} />
          ))}

          {showTyping ? <AgentChatTypingIndicator /> : null}
        </div>
      </div>

      <AgentChatComposer
        value={draft}
        onChange={onDraftChange}
        onSend={handleSend}
        disabled={!canChat}
        loading={loading}
        canSend={canSend}
        placeholder={canChat ? "Message your agent…" : "Agent needs an active mandate and vault funding."}
      />
    </AgentChatWindowChrome>
  );
}
