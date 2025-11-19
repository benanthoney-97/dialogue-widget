import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type AgentMapRow = {
  agent_id: string | null;
  agent_name: string | null;
};

type PersonaExternalKnowledgeRow = {
  agent_id: string | null;
  sourced_articles?: unknown;
  knowledge_text?: string | null;
  updated_at?: string | null;
  current_job_status?: string | null;
};

type PersonaWatchlistRow = {
  agent_id: string | null;
  query?: string | null;
};

type ArticleRecord = {
  title: string | null;
  url: string | null;
};

function normalizeArticles(raw: unknown): ArticleRecord[] {
  if (!Array.isArray(raw)) return [];
  const normalized: ArticleRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title =
      typeof record.title === "string" && record.title.trim().length > 0
        ? record.title.trim()
        : null;
    const url =
      typeof record.url === "string" && record.url.trim().length > 0
        ? record.url.trim()
        : null;
    if (!title && !url) continue;
    normalized.push({ title, url });
  }
  return normalized;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId?: string }> }
) {
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json({ error: "Missing workspace identifier" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 });
  }

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle<{ id: string }>();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: agentRows, error: agentError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id, agent_name")
      .eq("client_id", clientRow.id);

    if (agentError) {
      console.error("[AgentResearch] Failed to load personas", agentError);
      return NextResponse.json({ error: "Unable to load personas" }, { status: 500 });
    }

    const agentMap = new Map<string, { name: string | null }>();
    for (const row of agentRows ?? []) {
      if (!row?.agent_id) continue;
      agentMap.set(row.agent_id, { name: row.agent_name ?? null });
    }

    if (agentMap.size === 0) {
      return NextResponse.json({ records: [] });
    }

    const agentIds = Array.from(agentMap.keys());

    const { data: knowledgeRows, error: knowledgeError } = await supabaseAdmin
      .from("persona_external_knowledge")
      .select("agent_id, sourced_articles, knowledge_text, updated_at, current_job_status")
      .in("agent_id", agentIds);

    if (knowledgeError) {
      console.error("[AgentResearch] Failed to load external knowledge", knowledgeError);
      return NextResponse.json({ error: "Unable to load agent research" }, { status: 500 });
    }

    const knowledgeByAgent = new Map<string, PersonaExternalKnowledgeRow>();
    for (const entry of knowledgeRows ?? []) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as PersonaExternalKnowledgeRow;
      if (!row.agent_id) continue;
      const agentId = String(row.agent_id);
      if (!agentMap.has(agentId)) continue;
      const existing = knowledgeByAgent.get(agentId);
      const existingTime = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const incomingTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (!existing || incomingTime >= existingTime) {
        knowledgeByAgent.set(agentId, row);
      }
    }

    const { data: watchlistRows, error: watchlistError } = await supabaseAdmin
      .from("persona_watchlist")
      .select("agent_id, query")
      .in("agent_id", agentIds);

    if (watchlistError) {
      console.error("[AgentResearch] Failed to load watchlist prompts", watchlistError);
    }

    const watchlistByAgent = new Map<string, PersonaWatchlistRow>();
    for (const entry of watchlistRows ?? []) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as PersonaWatchlistRow;
      if (!row.agent_id) continue;
      watchlistByAgent.set(String(row.agent_id), row);
    }

    console.log("[AgentResearch] knowledgeRows:", knowledgeRows);
    const formatted = agentIds.map((agentId) => {
      const personaName = agentMap.get(agentId)?.name?.trim() || "Unnamed agent";
      const row = knowledgeByAgent.get(agentId);
      const watchlistRow = watchlistByAgent.get(agentId);
      return {
        agent_id: agentId,
        persona_name: personaName,
        knowledge_text:
          row && typeof row.knowledge_text === "string" && row.knowledge_text.trim().length > 0
            ? row.knowledge_text.trim()
            : null,
        updated_at: row?.updated_at ?? null,
        sourced_articles: normalizeArticles(row?.sourced_articles),
        current_job_status:
          row && typeof row.current_job_status === "string" && row.current_job_status.trim().length > 0
            ? row.current_job_status.trim().toLowerCase()
            : null,
        watchlist_query:
          watchlistRow && typeof watchlistRow.query === "string" && watchlistRow.query.trim().length > 0
            ? watchlistRow.query.trim()
            : null,
      };
    });

    return NextResponse.json({ records: formatted });
  } catch (error) {
    console.error("[AgentResearch] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
