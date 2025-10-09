// app/lib/clientKnowledgeBaseConfig.ts

type KnowledgeBaseConfig = {
  documentId: string;
  documentName?: string;
  ragModel?: string;
};

function slugToEnvKey(slug: string) {
  return slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getKnowledgeBaseConfig(
  clientSlug: string
): KnowledgeBaseConfig | null {
  const key = slugToEnvKey(clientSlug);
  const documentId = process.env[`ELEVENLABS_KB_DOC_ID_${key}`];
  if (!documentId) return null;
  const documentName = process.env[`ELEVENLABS_KB_DOC_NAME_${key}`];
  const ragModel =
    process.env[`ELEVENLABS_KB_RAG_MODEL_${key}`] ||
    process.env.ELEVENLABS_KB_DEFAULT_MODEL;
  return {
    documentId,
    documentName: documentName?.trim() ? documentName : undefined,
    ragModel: ragModel?.trim() ? ragModel : undefined,
  };
}
