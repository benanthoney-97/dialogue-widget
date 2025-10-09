// app/lib/elevenLabsKnowledgeBase.ts

import {
  setKnowledgeBaseState,
  getKnowledgeBaseState,
} from "@/app/lib/clientKnowledgeBaseState";

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") ||
  "https://api.elevenlabs.io";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

type RefreshOptions = {
  clientSlug: string;
  url: string;
  documentId?: string;
  documentName?: string;
  ragModel?: string;
};

async function deleteDocument(documentId: string) {
  if (!ELEVENLABS_API_KEY) return;
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/${documentId}?force=true`,
      {
        method: "DELETE",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[elevenLabs] Failed to delete knowledge base document",
        JSON.stringify({
          documentId,
          status: res.status,
          statusText: res.statusText,
          text,
        })
      );
    }
  } catch (error) {
    console.warn(
      "[elevenLabs] Error deleting knowledge base document",
      JSON.stringify({
        documentId,
        message: (error as Error)?.message,
      })
    );
  }
}

async function createDocumentFromUrl(url: string, name?: string | null) {
  if (!ELEVENLABS_API_KEY) return null;
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/url`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          name: name?.trim() ? name.trim() : null,
        }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[elevenLabs] Failed to create knowledge base document from URL",
        JSON.stringify({
          url,
          status: res.status,
          statusText: res.statusText,
          text,
        })
      );
      return null;
    }
    const data = (await res.json().catch(() => null)) as
      | { id?: string; name?: string }
      | null;
    if (!data?.id) {
      console.error(
        "[elevenLabs] Invalid response when creating document from URL",
        JSON.stringify({ url })
      );
      return null;
    }
    return data;
  } catch (error) {
    console.error(
      "[elevenLabs] Error creating document from URL",
      JSON.stringify({
        url,
        message: (error as Error)?.message,
      })
    );
    return null;
  }
}

async function computeRagIndex(documentId: string, model: string) {
  if (!ELEVENLABS_API_KEY) return;
  const endpoint = `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/${documentId}/rag/compute`;
  let attempt = 0;
  const maxAttempts = 6;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(
          "[elevenLabs] Failed to compute RAG index",
          JSON.stringify({
            documentId,
            status: res.status,
            statusText: res.statusText,
            text,
          })
        );
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { status?: string }
        | null;
      const status = data?.status;
      if (!status || status === "SUCCEEDED") {
        console.log(
          "[elevenLabs] RAG indexing completed",
          JSON.stringify({ documentId })
        );
        return;
      }
      if (status === "FAILED") {
        console.warn(
          "[elevenLabs] RAG indexing failed",
          JSON.stringify({ documentId })
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.warn(
        "[elevenLabs] Error during RAG indexing",
        JSON.stringify({
          documentId,
          attempt,
          message: (error as Error)?.message,
        })
      );
      return;
    }
  }
}

export async function refreshKnowledgeBaseDocument({
  clientSlug,
  url,
  documentId,
  documentName,
  ragModel = "e5_mistral_7b_instruct",
}: RefreshOptions) {
  if (!ELEVENLABS_API_KEY) {
    console.warn("[elevenLabs] Missing ELEVENLABS_API_KEY; skipping KB refresh");
    return;
  }
  if (!url) {
    console.warn(
      "[elevenLabs] Missing URL for knowledge base refresh",
      JSON.stringify({ clientSlug })
    );
    return;
  }

  const nameToUse =
    documentName ||
    (await getKnowledgeBaseState(clientSlug))?.documentName ||
    null;

  if (documentId) {
    await deleteDocument(documentId);
  }

  const created = await createDocumentFromUrl(url, nameToUse);
  if (!created?.id) return;

  await setKnowledgeBaseState(clientSlug, {
    documentId: created.id,
    documentName: created.name ?? nameToUse,
    sourceUrl: url,
    updatedAt: new Date().toISOString(),
  });

  await computeRagIndex(created.id, ragModel);
}
