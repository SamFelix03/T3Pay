import type { UseCase } from "@/lib/types";

export type AgentChatProposal = {
  id: string;
  merchantId: string;
  merchantName: string;
  name: string;
  category: string;
  priceCents: number;
  currency: string;
};

export type AgentChatPurchaseSuccess = {
  productName: string;
  priceCents: number;
  merchantName?: string;
};

export type AgentChatBlock = {
  role: "user" | "assistant";
  text?: string;
  proposals?: AgentChatProposal[];
  canRun?: boolean;
  objective?: string | null;
  useCase?: UseCase | null;
  purchaseSuccess?: AgentChatPurchaseSuccess;
};

export type AgentChatResponse = {
  reply: string;
  inScope: boolean;
  intent: "chat" | "purchase" | "clarify";
  useCase: UseCase | null;
  objective: string | null;
  proposals: AgentChatProposal[];
  canRun: boolean;
};

const CHAT_STORAGE_PREFIX = "t3pay_agent_chat:";

export function loadAgentChat(agentId: string): AgentChatBlock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${agentId}`);
    return raw ? (JSON.parse(raw) as AgentChatBlock[]) : [];
  } catch {
    return [];
  }
}

export function saveAgentChat(agentId: string, blocks: AgentChatBlock[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${CHAT_STORAGE_PREFIX}${agentId}`, JSON.stringify(blocks));
}
