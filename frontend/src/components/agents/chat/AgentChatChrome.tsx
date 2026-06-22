"use client";

import type { ReactNode } from "react";

export function AgentChatTypingIndicator() {
  return (
    <div className="agent-chat-message agent-chat-message--assistant">
      <div className="agent-chat-bubble agent-chat-bubble--typing" aria-label="Agent is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function AgentChatWindowChrome({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`agent-chat-window ${className ?? ""}`.trim()}>{children}</div>;
}

export function AgentChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  loading,
  canSend,
  placeholder = "Message your agent…"
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  loading?: boolean;
  canSend: boolean;
  placeholder?: string;
}) {
  return (
    <div className="agent-chat-composer">
      <div className="agent-chat-composer-inner">
        <textarea
          rows={1}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSend) {
              event.preventDefault();
              onSend();
            }
          }}
          disabled={disabled}
        />
        <button type="button" className="agent-chat-send-btn" onClick={onSend} disabled={!canSend} aria-label="Send">
          {loading ? <span className="agent-chat-send-spinner" aria-hidden /> : <span aria-hidden>↑</span>}
        </button>
      </div>
      <p className="agent-chat-composer-hint">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
