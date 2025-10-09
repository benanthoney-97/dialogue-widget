// app/lib/clientKnowledgeBaseConfig.ts

import { getKnowledgeBaseState } from "@/app/lib/clientKnowledgeBaseState";
import { getClientAgentId } from "@/app/lib/clientMap";

export type KnowledgeBaseConfig = {
  url: string;
  documentId?: string;
  documentName?: string;
  ragModel?: string;
  agentId?: string;
};

function slugToEnvKey(slug: string) {
  return slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function getKnowledgeBaseConfig(
  clientSlug: string
): Promise<KnowledgeBaseConfig | null> {
  const key = slugToEnvKey(clientSlug);
  const urlEnv = process.env[`ELEVENLABS_KB_URL_${key}`];
  const url = urlEnv?.trim()
    ? urlEnv.trim()
    : process.env[`ELEVENLABS_KB_URL_DEFAULT`]?.trim();
  if (!url) return null;

  const docIdEnv = process.env[`ELEVENLABS_KB_DOC_ID_${key}`]?.trim();
  const docNameEnv = process.env[`ELEVENLABS_KB_DOC_NAME_${key}`]?.trim();
  const ragModel =
    process.env[`ELEVENLABS_KB_RAG_MODEL_${key}`]?.trim() ||
    process.env.ELEVENLABS_KB_DEFAULT_MODEL?.trim();

  const stored = await getKnowledgeBaseState(clientSlug);
  const agentId = getClientAgentId(clientSlug) ?? undefined;

  const resolvedConfig: KnowledgeBaseConfig = {
    url: stored?.sourceUrl?.trim() || url,
    documentId: stored?.documentId || docIdEnv || undefined,
    documentName: stored?.documentName || docNameEnv || undefined,
    ragModel,
    agentId,
  };

  console.log(
    "[knowledgeBaseConfig] Resolved config",
    JSON.stringify({
      clientSlug,
      hasStoredState: Boolean(stored),
      url: resolvedConfig.url,
      documentId: resolvedConfig.documentId ?? null,
      documentName: resolvedConfig.documentName ?? null,
      ragModel: resolvedConfig.ragModel ?? null,
      agentId: resolvedConfig.agentId ?? null,
    })
  );

  return resolvedConfig;
}
