import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type DialogueRow = {
  id: number;
  agent_id: string | null;
  call_duration_secs: number | null;
  received_at: string | null;
  transcript?: unknown;
  transcript_summary?: string | null;
  main_language?: string | null;
  research_type?: string | null;
  conversation_id?: string | null;
  user_id?: string | null;
};

type AgentMapRow = {
  agent_id: string;
  agent_name: string;
  profile_image?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type InsightsRow = {
  personaId: string;
  sourceDocument: string;
  lead: { value: string; source: string };
  engagementTime: string;
  status: "Questionnaire" | "Interview" | "Chat";
  date: string;
  briefReport: string;
  conversation_id: string;
  transcript?: unknown;
  transcript_summary?: string | null;
  main_language?: string | null;
  ownerEmail?: string | null;
};

type PersonaOption = {
  id: string;
  name: string;
  profile_image?: string | null;
};

type InsightsResponse = {
  rows: InsightsRow[];
  totalCount: number;
  personas: PersonaOption[];
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

function normalizePagination(value: string | null): number {
  if (!value) return 1;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

function normalizePageSize(value: string | null): number {
  if (!value) return PAGE_SIZE_DEFAULT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return PAGE_SIZE_DEFAULT;
  return Math.min(parsed, PAGE_SIZE_MAX);
}

function normalizeStatuses(rawStatuses: string | null): string[] {
  if (!rawStatuses) return [];
  return rawStatuses
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item === "questionnaire" || item === "interview" || item === "chat");
}

function normalizeSearch(rawSearch: string | null): string | null {
  if (!rawSearch) return null;
  const trimmed = rawSearch.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePersona(rawPersonaId: string | null): string | null {
  if (!rawPersonaId) return null;
  const trimmed = rawPersonaId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function determineStatus(researchType: string | null | undefined): "Questionnaire" | "Interview" | "Chat" {
  const normalized = typeof researchType === "string" ? researchType.trim().toLowerCase() : "";
  if (normalized === "interview") return "Interview";
  if (normalized === "chat") return "Chat";
  return "Questionnaire";
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  const date = new Date(seconds * 1000);
  return date.toISOString().substr(11, 8);
}

export async function GET(request: NextRequest, { params }: { params: { clientId?: string } }) {
  const clientId = params.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing workspace identifier" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = normalizePagination(searchParams.get("page"));
  const pageSize = normalizePageSize(searchParams.get("pageSize"));
  const search = normalizeSearch(searchParams.get("search"));
  const personaId = normalizePersona(searchParams.get("personaId"));
  const statuses = normalizeStatuses(searchParams.get("statuses"));

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: agents, error: agentError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id, agent_name")
      .eq("client_id", clientRow.id);

    if (agentError) {
      return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 });
    }

    const agentMapById: Record<string, AgentMapRow> = (agents ?? []).reduce<Record<string, AgentMapRow>>(
      (acc, agent) => {
        acc[agent.agent_id] = agent;
        return acc;
      },
      {}
    );

    const personaOptions: PersonaOption[] = (agents ?? []).map((agent) => ({
      id: agent.agent_id,
      name: agent.agent_name ?? "",
      profile_image: (agent as AgentMapRow & { profile_image?: string | null }).profile_image ?? null,
    }));

    let personaNameMatches: string[] = [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      personaNameMatches = (agents ?? [])
        .filter((agent) => (agent.agent_name ?? "").toLowerCase().includes(lowerSearch))
        .map((agent) => agent.agent_id);
    }

    const baseQuery = supabaseAdmin
      .from("dialogues")
      .select(
        "id, conversation_id, agent_id, user_id, call_duration_secs, received_at, transcript, transcript_summary, main_language, research_type",
        { count: "exact" }
      )
      .eq("client_id", clientRow.id)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (personaId) {
      baseQuery.eq("agent_id", personaId);
    }

    if (statuses.length > 0) {
      baseQuery.in(
        "research_type",
        statuses.map((status) => (status === "questionnaire" ? "questionnaire" : status === "interview" ? "interview" : "chat"))
      );
    }

    if (search) {
      const safeSearch = search.replace(/[%_,"']/g, " ").trim();
      const orConditions: string[] = [];
      if (safeSearch.length > 0) {
        orConditions.push(`transcript_summary.ilike.%${safeSearch}%`);
        orConditions.push(`main_language.ilike.%${safeSearch}%`);
        orConditions.push(`conversation_id.ilike.%${safeSearch}%`);
      }
      if (personaNameMatches.length > 0) {
        const encodedIds = personaNameMatches.map((id) => `"${id}"`).join(",");
        orConditions.push(`agent_id.in.(${encodedIds})`);
      }
      if (orConditions.length > 0) {
        baseQuery.or(orConditions.join(","));
      }
    }

    const { data: dialogueRows, error: dialogueError, count } = await baseQuery;

    if (dialogueError) {
      return NextResponse.json({ error: "Failed to fetch dialogues" }, { status: 500 });
    }

    const rows = dialogueRows ?? [];

    const userIds = Array.from(
      new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
    );

    let profileById: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
  .select("id, display_name, email")
        .in("id", userIds);

      if (profilesError) {
        return NextResponse.json({ error: "Failed to fetch participant profiles" }, { status: 500 });
      }

      profileById = (profiles ?? []).reduce<Record<string, ProfileRow>>((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
    }

    const responseRows: InsightsRow[] = rows.map((dialogue) => {
      const agent = dialogue.agent_id ? agentMapById[dialogue.agent_id] : undefined;

      return {
        personaId: dialogue.agent_id ?? "",
        sourceDocument: agent ? agent.agent_name : "",
        lead: { value: "", source: "none" },
        engagementTime: formatDuration(dialogue.call_duration_secs),
        status: determineStatus(dialogue.research_type),
        date: dialogue.received_at || "",
        briefReport: "",
        conversation_id: dialogue.conversation_id ?? "",
        transcript: dialogue.transcript,
        transcript_summary: dialogue.transcript_summary,
        main_language: dialogue.main_language ?? undefined,
  ownerEmail: dialogue.user_id ? profileById[dialogue.user_id]?.email ?? null : null,
      };
    });

    const payload: InsightsResponse = {
      rows: responseRows,
      totalCount: count ?? 0,
      personas: personaOptions,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Insights API] Unexpected failure", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
