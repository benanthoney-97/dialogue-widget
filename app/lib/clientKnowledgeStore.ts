// app/lib/clientKnowledgeStore.ts

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const DEFAULT_WRITE_BASE_URL = "https://blob.vercel-storage.com";

const BLOB_PUBLIC_BASE_URL =
  process.env.BLOB_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  process.env.BLOB_BASE_URL?.replace(/\/+$/, "") ||
  DEFAULT_WRITE_BASE_URL;

let resolvedWriteBase =
  process.env.BLOB_WRITE_BASE_URL?.replace(/\/+$/, "") || DEFAULT_WRITE_BASE_URL;
if (
  !resolvedWriteBase.endsWith("blob.vercel-storage.com") ||
  resolvedWriteBase.includes(".public.")
) {
  resolvedWriteBase = DEFAULT_WRITE_BASE_URL;
}
const BLOB_WRITE_BASE_URL = resolvedWriteBase;

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
  const url = `${BLOB_WRITE_BASE_URL}/${encodePath(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "Content-Type": "application/json",
      "x-vercel-blob-access": "public",
      "x-vercel-blob-add-random-suffix": "false",
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

  try {
    const result = await res.json();
    console.log(
      "[clientKnowledgeStore] Wrote blob",
      JSON.stringify({ url: result?.url ?? url })
    );
  } catch {
    // ignore if no JSON body
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
    const prefix = `${STORAGE_PREFIX}/${clientSlug}`;
    try {
      const list = await listClientBlobs(prefix, 1);
      if (!list.length) {
        console.log(
          "[clientKnowledgeStore] No existing blobs for client",
          JSON.stringify({ clientSlug })
        );
      } else {
        const latest = list[0];
        const url = latest.url ?? latest.downloadUrl;
        if (url) {
          const res = await fetch(url, { method: "GET", cache: "no-store" });
          if (res.ok) {
            const payload = await res.json().catch(() => null);
            const parsed = parseClientKnowledgePayload(payload, { clientSlug, url });
            if (parsed) return parsed;
          } else {
            console.error(
              "[clientKnowledgeStore] Failed to fetch latest blob",
              JSON.stringify({
                clientSlug,
                url,
                status: res.status,
                statusText: res.statusText,
              })
            );
          }
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

  return fetchPublicClientKnowledge(clientSlug);
}

async function listClientBlobs(prefix: string, limit: number) {
  const params = new URLSearchParams({ prefix, limit: String(limit) });
  const url = `${BLOB_WRITE_BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    const text = await res.text().catch(() => "");
    console.error(
      "[clientKnowledgeStore] Failed to list blobs",
      JSON.stringify({ prefix, status: res.status, statusText: res.statusText, text })
    );
    throw new Error(`Failed to list blobs (${res.status})`);
  }

  const data = (await res.json()) as {
    blobs?: Array<{ url?: string; downloadUrl?: string; uploadedAt?: string }>;
  };
  const blobs = data?.blobs ?? [];
  return blobs.sort((a, b) => {
    const aDate = a?.uploadedAt ? Date.parse(a.uploadedAt) : 0;
    const bDate = b?.uploadedAt ? Date.parse(b.uploadedAt) : 0;
    return bDate - aDate;
  });
}
