// app/lib/clientKnowledgeBaseState.ts

import { list, put } from "@vercel/blob";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const STATE_PREFIX = "client-knowledge-base";

export type ClientKnowledgeBaseState = {
  documentId: string;
  documentName?: string | null;
  sourceUrl?: string;
  updatedAt: string;
};

function getStateKey(clientSlug: string) {
  return `${STATE_PREFIX}/${clientSlug}.json`;
}

function isNotFoundError(error: unknown) {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  const code =
    (error as { code?: string }).code ?? (error as { name?: string }).name;
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

export async function getKnowledgeBaseState(
  clientSlug: string
): Promise<ClientKnowledgeBaseState | null> {
  if (!BLOB_TOKEN) return null;
  try {
    const listing = await list({
      prefix: getStateKey(clientSlug),
      limit: 1,
    });
    const blob = listing.blobs?.[0];
    if (!blob?.url) return null;
    const res = await fetch(blob.url, { method: "GET", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | ClientKnowledgeBaseState
      | null;
    if (!data?.documentId) return null;
    return data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.warn(
        "[clientKnowledgeBaseState] Failed to load state",
        JSON.stringify({
          clientSlug,
          message: (error as Error)?.message,
        })
      );
    }
    return null;
  }
}

export async function setKnowledgeBaseState(
  clientSlug: string,
  state: ClientKnowledgeBaseState
) {
  if (!BLOB_TOKEN) return;
  const key = getStateKey(clientSlug);
  try {
    await put(key, JSON.stringify(state), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
  } catch (error) {
    console.warn(
      "[clientKnowledgeBaseState] Failed to persist state",
      JSON.stringify({
        clientSlug,
        message: (error as Error)?.message,
      })
    );
  }
}
