import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type DialogueRow = {
  id?: string | number | null;
  agent_id?: string | null;
  research_type?: string | null;
  call_summary_title?: string | null;
  transcript?: unknown;
  transcript_summary?: string | null;
  received_at?: string | null;
  status?: string | null;
  research_stage?: string | null;
  user_id?: string | null;
};

type InsightsRow = {
  personaId: string | null;
  personaName: string | null;
  sourceDocument: string | null;
  lead?: { value: string | null; source: string };
  engagementTime: string | null;
  status: "Simulation" | "Interview" | "Chat";
  date: string;
  briefReport?: string | null;
  conversation_id: string;
  transcript?: unknown;
  transcript_summary?: string | null;
  main_language?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  call_summary_title?: string | null;
  dialogueStatus?: "pending" | "running" | "completed";
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

function normalizeStatuses(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

function normalizeResearchType(value: unknown | null | undefined): "Simulation" | "Interview" | "Chat" {
  if (typeof value !== "string") return "Chat";
  const normalized = value.trim().toLowerCase();
  if (normalized === "simulation") return "Simulation";
  if (normalized === "interview") return "Interview";
  return "Chat";
}

function mapStatus(value: string | null | undefined): "pending" | "running" | "completed" {
  if (!value) return "pending";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "running" || trimmed === "active") return "running";
  if (trimmed === "completed" || trimmed === "done") return "completed";
  return "pending";
}

function buildLead(userId: string | null | undefined): { value: string | null; source: string } | undefined {
  if (!userId) return undefined;
  return { value: userId, source: "User" };
}

export async function GET(
  request: NextRequest,
  context: { params: { clientId?: string } } | { params: Promise<{ clientId?: string }> }
) {
  const params = "params" in context ? context.params : undefined;
  const resolvedParams = params instanceof Promise ? await params : params;
  const clientId = resolvedParams?.clientId;
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

    const { data: personaRows, error: personaError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id, agent_name, profile_image")
      .eq("client_id", clientRow.id);
    if (personaError) {
      return NextResponse.json({ error: "Failed to load personas" }, { status: 500 });
    }

    const personaOptions: PersonaOption[] = (personaRows ?? [])
      .map((agent) => {
        if (!agent) return null;
        const id = typeof agent.agent_id === "string" ? agent.agent_id.trim() : "";
        return id.length > 0
          ? {
              id,
              name: typeof agent.agent_name === "string" && agent.agent_name.trim().length > 0 ? agent.agent_name.trim() : "Untitled persona",
              profile_image: agent.profile_image ?? null,
            }
          : null;
      })
      .filter((option): option is PersonaOption => Boolean(option));

    const baseQuery = supabaseAdmin
      .from("dialogues")
      .select(
        "id, agent_id, research_type, call_summary_title, transcript, transcript_summary, received_at, status, research_stage, user_id",
        { count: "exact" }
      )
      .eq("client_id", clientRow.id)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (personaId) {
      baseQuery.eq("agent_id", personaId);
    }

    if (statuses.length > 0) {
      baseQuery.in("research_type", statuses);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,"']/g, " ").trim();
      if (safeSearch.length > 0) {
        baseQuery.or(
          [
            `call_summary_title.ilike.%${safeSearch}%`,
            `transcript_summary.ilike.%${safeSearch}%`,
            `transcript.ilike.%${safeSearch}%`,
          ].join(",")
        );
      }
    }

    const { data: rowsData, error: rowsError, count } = await baseQuery;
    if (rowsError) {
      console.error("[conversations] failed to load dialogues", { clientId, rowsError });
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
    }

    const agentIds = Array.from(
      new Set(
        (rowsData ?? [])
          .map((row) => (typeof row.agent_id === "string" ? row.agent_id.trim() : "").trim())
          .filter((value): value is string => value.length > 0)
      )
    );
    const agentNameLookup = new Map<string, string>();
    if (agentIds.length > 0) {
      const { data: agentRows } = await supabaseAdmin
        .from("agent_map")
        .select("agent_id, agent_name")
        .in("agent_id", agentIds);

      if (Array.isArray(agentRows)) {
        for (const agentRow of agentRows) {
          if (typeof agentRow?.agent_id === "string" && agentRow.agent_id.trim().length > 0) {
            const agentId = agentRow.agent_id.trim();
            const agentName =
              typeof agentRow.agent_name === "string" && agentRow.agent_name.trim().length > 0
                ? agentRow.agent_name.trim()
                : agentId;
            agentNameLookup.set(agentId, agentName);
          }
        }
      }
    }

    const userIds = Array.from(
      new Set(
        (rowsData ?? [])
          .map((row) => (typeof row.user_id === "string" ? row.user_id.trim() : "").trim())
          .filter((value): value is string => value.length > 0)
      )
    );
    const userNameLookup = new Map<string, string>();
    if (userIds.length > 0) {
    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email")
        .in("id", userIds);

      if (Array.isArray(profileRows)) {
        for (const profile of profileRows) {
          if (typeof profile?.id === "string" && profile.id.trim().length > 0) {
            const profileId = profile.id.trim();
            const profileNameLike =
              typeof profile.email === "string" && profile.email.trim().length > 0
                ? profile.email.trim()
                : typeof profile.display_name === "string" && profile.display_name.trim().length > 0
                ? profile.display_name.trim()
                : profileId;
            userNameLookup.set(profileId, profileNameLike);
          }
        }
      }
    }

    const rows: InsightsRow[] = (rowsData ?? []).map((row: DialogueRow, index) => {
      const idValue =
        typeof row.id === "string" && row.id.trim().length > 0
          ? row.id.trim()
          : typeof row.id === "number"
          ? String(row.id)
          : `dialogue-${index}`;
      const researchType = normalizeResearchType(row.research_type ?? null);
      const agentIdValue = typeof row.agent_id === "string" && row.agent_id.trim().length > 0 ? row.agent_id.trim() : null;
      const personaDisplayName =
        (agentIdValue && agentNameLookup.get(agentIdValue)) ??
        row.call_summary_title ??
        researchType;
      const ownerId = typeof row.user_id === "string" && row.user_id.trim().length > 0 ? row.user_id.trim() : null;
      return {
        personaId: row.agent_id ?? null,
        personaName: personaDisplayName,
        sourceDocument: row.call_summary_title ?? researchType,
        lead: buildLead(row.user_id),
        engagementTime: row.received_at ?? null,
        status: researchType,
        date: row.received_at ?? new Date().toISOString(),
        briefReport: row.transcript_summary ?? row.call_summary_title ?? null,
        conversation_id: idValue,
        transcript: row.transcript,
        transcript_summary: row.transcript_summary,
        ownerEmail: ownerId,
        ownerName: ownerId ? userNameLookup.get(ownerId) ?? null : null,
        call_summary_title: row.call_summary_title,
        dialogueStatus: mapStatus(row.status),
      };
    });

    const responsePayload: InsightsResponse = {
      rows,
      totalCount: count ?? rows.length,
      personas: personaOptions,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[conversations] unexpected failure", { clientId, error });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
