// app/lib/clientMap.ts
import { docMap } from "@/app/lib/docMap";

export type ClientEntry = {
  displayName: string;
  slugKeys: Array<keyof typeof docMap>;
  description?: string;
  clientAgentId?: string;
};

export const clientMap: Record<string, ClientEntry> = {
  "clifford-chance": {
    displayName: "Clifford Chance",
    slugKeys: ["convergence-ai-dlt-cc"],
    description:
      "Executive insights drawn from the Convergence of AI and Distributed Ledger Technology interactive report.",
    clientAgentId: "agent_client_clifford_chance_insights",
  },
  "dialogue-ai": {
    displayName: "Dialogue AI Demo",
    slugKeys: [
      "genai-adoption-he-students",
      "convergence-ai-dlt-cc",
      "intro-linear-optimisation",
    ],
    description:
      "Sample account showcasing how customers interact with Dialogue AI reports.",
    clientAgentId: "agent_client_dialogue_ai_demo",
  },
  srm360: {
    displayName: "SRM360",
    slugKeys: ["srm-field-experiments", "srm-all", "srm-live-discussion"],
    description:
      "Insights drawn from the SRM stakeholder engagement and knowledge hub experiences.",
    clientAgentId: "agent_client_srm360_insights",
  },
};

export function getClientReports(slug: string) {
  const entry = clientMap[slug];
  if (!entry) return [];
  return entry.slugKeys
    .map((key) => ({
      slug: key,
      doc: docMap[key],
    }))
    .filter((item) => Boolean(item.doc));
}

export function getClientsForAgentId(agentId: string): string[] {
  if (!agentId) return [];
  const matches: string[] = [];
  for (const [clientSlug, entry] of Object.entries(clientMap)) {
    const hasMatch = entry.slugKeys.some((key) => docMap[key]?.agentId === agentId);
    if (hasMatch) matches.push(clientSlug);
  }
  return matches;
}

export function getClientAgentId(clientSlug: string) {
  return clientMap[clientSlug]?.clientAgentId;
}

export function getClientDataPath(clientSlug: string) {
  return `/api/client-data/${clientSlug}`;
}
