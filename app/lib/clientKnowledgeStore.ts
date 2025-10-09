// app/lib/clientKnowledgeStore.ts

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const FALLBACK_WRITE_BASE = "https://blob.vercel-storage.com";

const rawPublicBase =
  process.env.BLOB_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  process.env.BLOB_BASE_URL?.replace(/\/+$/, "") ||
  "";

const BLOB_PUBLIC_BASE_URL = rawPublicBase || FALLBACK_WRITE_BASE;

function deriveWriteBase() {
  const candidate =
    process.env.BLOB_WRITE_BASE_URL?.replace(/\/+$/, "") ||
    process.env.BLOB_BASE_URL?.replace(/\/+$/, "") ||
    (rawPublicBase.includes(".public.")
      ? rawPublicBase.replace(".public.", ".")
      : rawPublicBase) ||
    FALLBACK_WRITE_BASE;

  if (
    !candidate.endsWith("blob.vercel-storage.com") ||
    candidate.includes(".public.")
  ) {
    return FALLBACK_WRITE_BASE;
  }
  return candidate;
}

let resolvedWriteBase =
  process.env.BLOB_WRITE_BASE_URL?.replace(/\/+$/, "") || deriveWriteBase();

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

  await purgeClientBlobs(clientSlug);
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

  await deleteExistingBlob(key);

  const url = `${BLOB_WRITE_BASE_URL}/${encodePath(key)}?addRandomSuffix=false`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${BLOB_TOKEN}`,
      "Content-Type": "application/json",
      "x-vercel-blob-access": "public",
      "x-vercel-blob-add-random-suffix": "false",
      "x-vercel-blob-overwrite": "true",
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
  let result: any = null;
  try {
    result = await res.json();
  } catch {
    result = null;
  }
  console.log(
    "[clientKnowledgeStore] Wrote blob",
    JSON.stringify({
      requestedUrl: url,
      responseUrl: result?.url ?? null,
      locationHeader: res.headers.get("location") ?? res.headers.get("content-location"),
    })
  );
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

async function deleteExistingBlob(key: string) {
  if (!BLOB_TOKEN) return;
  const url = `${BLOB_WRITE_BASE_URL}/${encodePath(key)}`;
  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${BLOB_TOKEN}`,
      },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[clientKnowledgeStore] Failed to delete existing blob",
        JSON.stringify({ key, status: res.status, statusText: res.statusText, text })
      );
    }
  } catch (error) {
    console.warn(
      "[clientKnowledgeStore] Error deleting existing blob",
      JSON.stringify({ key, message: (error as Error)?.message })
    );
  }
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
        console.log(
          "[clientKnowledgeStore] Using latest blob",
          JSON.stringify({ clientSlug, url })
        );
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

async function purgeClientBlobs(clientSlug: string) {
  if (!BLOB_TOKEN) return;
  try {
    const blobs = await listClientBlobs(`${STORAGE_PREFIX}/${clientSlug}`, 25);
    const deletions = blobs.map(async (blob) => {
      const targetUrl = blob.url ?? blob.downloadUrl;
      if (!targetUrl) return;
      const keyPath = new URL(targetUrl).pathname.replace(/^\/+/, "");
      const deleteUrl = `${BLOB_WRITE_BASE_URL}/${keyPath}`;
      const res = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${BLOB_TOKEN}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => "");
        console.warn(
          "[clientKnowledgeStore] Failed to delete blob during purge",
          JSON.stringify({
            clientSlug,
            url: deleteUrl,
            status: res.status,
            statusText: res.statusText,
            text,
          })
        );
      }
    });
    await Promise.allSettled(deletions);
  } catch (error) {
    console.warn(
      "[clientKnowledgeStore] Error purging blobs",
      JSON.stringify({ clientSlug, message: (error as Error)?.message })
    );
  }
}
