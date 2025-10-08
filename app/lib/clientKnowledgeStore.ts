// app/lib/clientKnowledgeStore.ts

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_BASE_URL =
  process.env.BLOB_BASE_URL?.replace(/\/+$/, "") || "https://blob.vercel-storage.com";

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
  if (!BLOB_TOKEN) {
    console.warn("[clientKnowledgeStore] Missing BLOB_READ_WRITE_TOKEN; skipping write");
    return;
  }

  const existing = await getClientKnowledge(clientSlug);
  const conversations = [record, ...existing.conversations].slice(0, MAX_RECORDS);
  const payload: ClientKnowledgePayload = {
    client: clientSlug,
    updatedAt: new Date().toISOString(),
    conversations,
  };

  await writeBlob(getBlobKey(clientSlug), payload);
}

export async function getClientKnowledge(clientSlug: string): Promise<ClientKnowledgePayload> {
  const key = getBlobKey(clientSlug);
  const url = `${BLOB_BASE_URL}/${encodePath(key)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 404) {
      return {
        client: clientSlug,
        updatedAt: new Date().toISOString(),
        conversations: [],
      };
    }
    if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status} ${res.statusText}`);
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
  if (!error) return false;
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code ?? (error as { name?: string }).name;
  const message =
    typeof (error as { message?: string }).message === "string"
      ? (error as { message?: string }).message
      : "";
  return (
    status === 404 ||
    code?.toLowerCase() === "blob_not_found" ||
    code?.toLowerCase() === "notfound" ||
    message.toLowerCase().includes("does not exist") ||
    message.toLowerCase().includes("not found")
  );
}

async function writeBlob(key: string, payload: ClientKnowledgePayload) {
  const url = `${BLOB_BASE_URL}/${encodePath(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "Content-Type": "application/json",
      "x-vercel-blob-access": "public",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      "[clientKnowledgeStore] Failed to write blob",
      JSON.stringify({ url, status: res.status, statusText: res.statusText, text })
    );
    throw new Error(`Failed to write blob (${res.status})`);
  }
}

function encodePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
