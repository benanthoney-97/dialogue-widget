// app/lib/clientKnowledgeStore.ts

export type ConversationKnowledgeRecord = {
  callId: string;
  agentId: string;
  clientSlug: string;
  eventTimestamp: number | null;
  capturedAt: string;
  summarySubject?: string | null;
  summary?: string | null;
  transcriptSummary?: string | null;
  transcriptText?: string | null;
  analysis?: unknown;
  metadata?: unknown;
  sourceType?: string;
};

type ClientKnowledgePayload = {
  client: string;
  updatedAt: string;
  conversations: ConversationKnowledgeRecord[];
};

const MAX_RECORDS = 200;

const globalStore = globalThis as typeof globalThis & {
  __clientConversationStore?: Map<string, ClientKnowledgePayload>;
};

const store: Map<string, ClientKnowledgePayload> =
  globalStore.__clientConversationStore ?? new Map();

if (!globalStore.__clientConversationStore) {
  globalStore.__clientConversationStore = store;
}

export function appendConversationRecord(
  clientSlug: string,
  record: ConversationKnowledgeRecord
) {
  const existing = store.get(clientSlug);
  const conversations = existing ? [record, ...existing.conversations] : [record];
  store.set(clientSlug, {
    client: clientSlug,
    updatedAt: new Date().toISOString(),
    conversations: conversations.slice(0, MAX_RECORDS),
  });
}

export function getClientKnowledge(clientSlug: string): ClientKnowledgePayload {
  return (
    store.get(clientSlug) ?? {
      client: clientSlug,
      updatedAt: new Date().toISOString(),
      conversations: [],
    }
  );
}
