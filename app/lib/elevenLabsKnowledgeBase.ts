// app/lib/elevenLabsKnowledgeBase.ts

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") ||
  "https://api.elevenlabs.io";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

type RefreshOptions = {
  documentId: string;
  documentName?: string;
  ragModel?: string;
};

async function fetchDocumentInfo(documentId: string) {
  if (!ELEVENLABS_API_KEY) return null;
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/${documentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as { name?: string } | null;
  } catch (error) {
    console.warn(
      "[elevenLabs] Failed to fetch knowledge base document info",
      JSON.stringify({
        documentId,
        message: (error as Error)?.message,
      })
    );
    return null;
  }
}

async function updateDocumentName(documentId: string, name: string) {
  if (!ELEVENLABS_API_KEY) return;
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/${documentId}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[elevenLabs] Failed to update knowledge base document name",
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
      "[elevenLabs] Error updating knowledge base document",
      JSON.stringify({
        documentId,
        message: (error as Error)?.message,
      })
    );
  }
}

async function computeRagIndex(documentId: string, model: string) {
  if (!ELEVENLABS_API_KEY) return;
  const url = `${ELEVENLABS_API_BASE}/v1/convai/knowledge-base/${documentId}/rag/compute`;
  let attempt = 0;
  const maxAttempts = 6;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fetch(url, {
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
  documentId,
  documentName,
  ragModel = "e5_mistral_7b_instruct",
}: RefreshOptions) {
  if (!ELEVENLABS_API_KEY) {
    console.warn("[elevenLabs] Missing ELEVENLABS_API_KEY; skipping KB refresh");
    return;
  }

  let effectiveName = documentName;
  if (!effectiveName) {
    const info = await fetchDocumentInfo(documentId);
    if (info?.name) {
      effectiveName = info.name;
    }
  }

  if (effectiveName) {
    await updateDocumentName(documentId, effectiveName);
  }

  await computeRagIndex(documentId, ragModel);
}
