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
    slugKeys: [
      "convergence-ai-dlt-cc",
      "savills-2025-european-real-estate-logistics-consensus",
    ],
    description:
      "Executive insights drawn from the Convergence of AI and Distributed Ledger Technology interactive report.",
    clientAgentId: "agent_3201k728gsbtfdqsbgvnhxvvmtzz",
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
