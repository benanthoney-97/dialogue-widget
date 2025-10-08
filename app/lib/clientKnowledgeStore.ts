// app/lib/clientKnowledgeStore.ts
import { head, put } from "@vercel/blob";

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

export type ClientKnowledgePayload = {
  client: string;
  updatedAt: string;
  conversations: ConversationKnowledgeRecord[];
};

const STORAGE_PREFIX = "client-conversations";
const MAX_RECORDS = 200;

export async function appendConversationRecord(
  clientSlug: string,
  record: ConversationKnowledgeRecord
) {
  const existing = await getClientKnowledge(clientSlug);
  const conversations = [record, ...existing.conversations].slice(0, MAX_RECORDS);
  const payload: ClientKnowledgePayload = {
    client: clientSlug,
    updatedAt: new Date().toISOString(),
    conversations,
  };

  await put(getBlobKey(clientSlug), JSON.stringify(payload), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function getClientKnowledge(clientSlug: string): Promise<ClientKnowledgePayload> {
  const key = getBlobKey(clientSlug);
  try {
    const metadata = await head(key);
    if (!metadata?.url) throw new Error("Missing blob URL");
    const res = await fetch(metadata.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.statusText}`);
    const data = (await res.json()) as ClientKnowledgePayload;
    if (!data || typeof data !== "object") {
      throw new Error("Invalid blob payload");
    }
    return data;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return {
        client: clientSlug,
        updatedAt: new Date().toISOString(),
        conversations: [],
      };
    }
    console.error("Failed to load client knowledge", error);
    throw error;
  }
}

function getBlobKey(clientSlug: string) {
  return `${STORAGE_PREFIX}/${clientSlug}.json`;
}

function isNotFoundError(error: unknown) {
  return (
    (error as { status?: number })?.status === 404 ||
    (error as { code?: string })?.code === "blob_not_found"
  );
}
