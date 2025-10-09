// app/lib/clientKnowledgeStore.ts

import { list, put } from "@vercel/blob";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const rawPublicBase =
  process.env.BLOB_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  process.env.BLOB_BASE_URL?.replace(/\/+$/, "") ||
  "";

const BLOB_PUBLIC_BASE_URL = rawPublicBase || "";

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

  const existing = await fetchLatestClientKnowledge(clientSlug);
  const existingCount = existing?.conversations.length ?? 0;
  console.log(
    "[clientKnowledgeStore] Loaded existing conversations",
    JSON.stringify({ clientSlug, existingCount })
  );
  const conversations = [record, ...(existing?.conversations ?? [])].slice(0, MAX_RECORDS);
  const payload: ClientKnowledgePayload = {
    client: clientSlug,
    updatedAt: new Date().toISOString(),
    conversations,
  };

  await writeBlob(getBlobKey(clientSlug), payload);
}

export async function getClientKnowledge(clientSlug: string): Promise<ClientKnowledgePayload> {
  const latest = await fetchLatestClientKnowledge(clientSlug);
  if (latest) return latest;

  return {
    client: clientSlug,
    updatedAt: new Date().toISOString(),
    conversations: [],
  };
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
  if (!BLOB_TOKEN) {
    console.warn(
      "[clientKnowledgeStore] Cannot write blob; missing BLOB_READ_WRITE_TOKEN"
    );
    return;
  }
  try {
    const response = await put(key, JSON.stringify(payload), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });

    console.log(
      "[clientKnowledgeStore] Wrote blob via SDK",
      JSON.stringify({ key, url: response.url })
    );
  } catch (error) {
    console.error(
      "[clientKnowledgeStore] SDK write failed",
      JSON.stringify({ key, message: (error as Error)?.message })
    );
    throw error;
  }
}

function encodePath(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseClientKnowledgePayload(
  data: unknown,
  meta: { clientSlug: string; url: string }
): ClientKnowledgePayload | null {
  if (!data || typeof data !== "object" || !Array.isArray((data as any).conversations)) {
    console.error(
      "[clientKnowledgeStore] Invalid blob payload",
      JSON.stringify(meta)
    );
    return null;
  }
  return data as ClientKnowledgePayload;
}

async function fetchPublicClientKnowledge(clientSlug: string) {
  if (!BLOB_PUBLIC_BASE_URL) return null;
  const key = getBlobKey(clientSlug);
  const url = `${BLOB_PUBLIC_BASE_URL}/${encodePath(key)}?ts=${Date.now()}`;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(
        "[clientKnowledgeStore] Failed to fetch public blob",
        JSON.stringify({ clientSlug, url, status: res.status, statusText: res.statusText })
      );
      return null;
    }
    const payload = await res.json().catch(() => null);
    if (!payload) {
      console.warn(
        "[clientKnowledgeStore] Public blob returned empty payload",
        JSON.stringify({ clientSlug, url })
      );
    }
    return parseClientKnowledgePayload(payload, { clientSlug, url });
  } catch (error) {
    console.error(
      "[clientKnowledgeStore] Error fetching public blob",
      JSON.stringify({ clientSlug, url, message: (error as Error)?.message })
    );
    return null;
  }
}

async function fetchLatestClientKnowledge(clientSlug: string) {
  if (BLOB_TOKEN) {
    try {
      const listing = await list({ prefix: `${STORAGE_PREFIX}/${clientSlug}.json`, limit: 1 });
      const latest = listing.blobs?.[0];
      if (!latest) {
        console.log(
          "[clientKnowledgeStore] No existing blobs for client",
          JSON.stringify({ clientSlug })
        );
      } else if (latest.url) {
        const url = latest.url;
        console.log(
          "[clientKnowledgeStore] Using latest blob",
          JSON.stringify({ clientSlug, url })
        );
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          const parsed = parseClientKnowledgePayload(payload, { clientSlug, url });
          if (parsed) return parsed;
        } else {
          console.error(
            "[clientKnowledgeStore] Failed to fetch latest blob",
            JSON.stringify({ clientSlug, url, status: res.status, statusText: res.statusText })
          );
        }
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error(
          "[clientKnowledgeStore] Failed to load latest client knowledge",
          error
        );
      }
    }
  }

  const publicData = await fetchPublicClientKnowledge(clientSlug);
  if (publicData) {
    console.log(
      "[clientKnowledgeStore] Served client data from public blob",
      JSON.stringify({ clientSlug })
    );
  }
  if (!publicData) {
    console.warn(
      "[clientKnowledgeStore] Falling back to empty payload after public fetch failed",
      JSON.stringify({ clientSlug })
    );
  }
  return publicData;
}

// No purge helpers required with SDK-managed overwrites.
