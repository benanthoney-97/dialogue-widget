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
  agentId?: string;
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
    } else {
      console.log(
        "[elevenLabs] Deleted knowledge base document",
        JSON.stringify({ documentId, status: res.status })
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
    console.log(
      "[elevenLabs] Created knowledge base document from URL",
      JSON.stringify({ url, documentId: data.id })
    );
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

async function fetchAgent(agentId: string) {
  if (!ELEVENLABS_API_KEY) return null;
  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/agents/${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[elevenLabs] Failed to fetch agent",
        JSON.stringify({ agentId, status: res.status, statusText: res.statusText, text })
      );
      return null;
    }
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (error) {
    console.warn(
      "[elevenLabs] Error fetching agent",
      JSON.stringify({ agentId, message: (error as Error)?.message })
    );
    return null;
  }
}

async function updateAgentKnowledgeBase(
  agentId: string,
  documentId: string,
  documentName: string | null,
  ragModel: string | undefined
) {
  if (!ELEVENLABS_API_KEY) return;
  const agent = await fetchAgent(agentId);
  if (!agent) return;

  const conversationConfig = (agent.conversation_config ?? {}) as Record<string, any>;
  const agentConfig = (conversationConfig.agent ?? {}) as Record<string, any>;
  const promptConfig = (agentConfig.prompt ?? {}) as Record<string, any>;

  const existingKb = Array.isArray(promptConfig.knowledge_base)
    ? promptConfig.knowledge_base.filter((entry: any) => entry && entry.id !== documentId)
    : [];

  const name = documentName?.trim() ? documentName.trim() : documentId;
  existingKb.push({
    type: "url",
    id: documentId,
    name,
    usage_mode: "auto",
  });

  const existingRag = (promptConfig.rag ?? {}) as Record<string, any>;
  const ragPayload = {
    ...existingRag,
    enabled: true,
    ...(ragModel ? { embedding_model: ragModel } : {}),
  };

  const body = {
    conversation_config: {
      agent: {
        prompt: {
          knowledge_base: existingKb,
          rag: ragPayload,
        },
      },
    },
  };

  try {
    const res = await fetch(
      `${ELEVENLABS_API_BASE}/v1/convai/agents/${agentId}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[elevenLabs] Failed to update agent knowledge base",
        JSON.stringify({ agentId, status: res.status, statusText: res.statusText, text })
      );
      return;
    }
    console.log(
      "[elevenLabs] Updated agent knowledge base",
      JSON.stringify({ agentId, documentId })
    );
  } catch (error) {
    console.warn(
      "[elevenLabs] Error updating agent",
      JSON.stringify({ agentId, message: (error as Error)?.message })
    );
  }
}

export async function refreshKnowledgeBaseDocument({
  clientSlug,
  url,
  documentId,
  documentName,
  ragModel = "e5_mistral_7b_instruct",
  agentId,
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

  if (agentId) {
    await updateAgentKnowledgeBase(agentId, created.id, created.name ?? nameToUse ?? null, ragModel);
  } else {
    console.log(
      "[elevenLabs] No agent ID provided; skipping agent update",
      JSON.stringify({ clientSlug })
    );
  }

  await computeRagIndex(created.id, ragModel);
}
