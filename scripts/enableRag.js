#!/usr/bin/env node
"use strict";
/**
 * Enable RAG for a specific ElevenLabs document + agent.
 *
 * Usage:
 *   node scripts/enableRag.js <documentId> <agentId>
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY (the client key)
 * Optional env vars:
 *   ELEVENLABS_DOCUMENT_ID, ELEVENLABS_AGENT_ID (defaults)
 *   ELEVENLABS_API_BASE (override API host, default https://api.elevenlabs.io/v1)
 */

const API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") || "https://api.elevenlabs.io/v1";

async function enableRag(documentId, agentId, apiKey) {
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  if (!documentId || !agentId) {
    throw new Error("Both documentId and agentId are required");
  }

  console.log(
    `[enableRag] Starting RAG indexing for document ${documentId} (agent ${agentId})`
  );

  await startComputeRag(documentId, apiKey);

  let status = await getDocumentRagStatus(documentId, apiKey);

  while (status !== "SUCCEEDED" && status !== "FAILED") {
    console.log(
      `[enableRag] Index status ${status ?? "UNKNOWN"} — polling again in 5s`
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await getDocumentRagStatus(documentId, apiKey);
  }

  if (status === "FAILED") {
    throw new Error("RAG indexing failed");
  }

  console.log("[enableRag] Indexing complete, updating agent configuration…");

  const agentConfig = await getAgentConfig(agentId, apiKey);

  const updatedConfig = {
    conversation_config: {
      ...agentConfig.agent,
      prompt: {
        ...agentConfig.agent.prompt,
        rag: {
          enabled: true,
          embedding_model: "e5_mistral_7b_instruct",
          max_documents_length: 10000,
        },
      },
    },
  };

  if (agentConfig.agent.prompt?.knowledge_base) {
    updatedConfig.conversation_config.prompt.knowledge_base =
      agentConfig.agent.prompt.knowledge_base.map((doc) =>
        doc.id === documentId ? { ...doc, usage_mode: "auto" } : doc
      );
  }

  await updateAgent(agentId, apiKey, updatedConfig);

  console.log("[enableRag] RAG configuration updated successfully");
}

async function main() {
  const [, , docIdArg, agentIdArg] = process.argv;

  const documentId = docIdArg || process.env.ELEVENLABS_DOCUMENT_ID || "";
  const agentId = agentIdArg || process.env.ELEVENLABS_AGENT_ID || "";
  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    await enableRag(documentId, agentId, apiKey);
    console.log("[enableRag] Done.");
  } catch (error) {
    console.error("[enableRag] Error configuring RAG:", error);
    process.exitCode = 1;
  }
}

main();

async function startComputeRag(documentId, apiKey) {
  const res = await fetch(
    `${API_BASE}/conversational-ai/knowledge-base/document/${documentId}/rag`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({ model: "e5_mistral_7b_instruct" }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to start RAG indexing (${res.status} ${res.statusText}): ${text}`
    );
  }
}

async function getDocumentRagStatus(documentId, apiKey) {
  const res = await fetch(
    `${API_BASE}/conversational-ai/knowledge-base/document/${documentId}`,
    {
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch document status (${res.status} ${res.statusText}): ${text}`
    );
  }

  const data = await res.json();
  return data?.rag_status ?? data?.rag?.status ?? data?.status ?? "UNKNOWN";
}

async function getAgentConfig(agentId, apiKey) {
  const res = await fetch(`${API_BASE}/conversational-ai/agents/${agentId}`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch agent config (${res.status} ${res.statusText}): ${text}`
    );
  }

  return res.json();
}

async function updateAgent(agentId, apiKey, payload) {
  const res = await fetch(`${API_BASE}/conversational-ai/agents/${agentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to update agent (${res.status} ${res.statusText}): ${text}`
    );
  }
}
