import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AgentMapRow = {
  agent_id: string;
  agent_name: string;
  profile_image?: string | null;
};

type CampaignResponseRow = {
  id?: string | number | null;
  conversation_id?: string | null;
  campaign_id?: string | null;
  persona_id?: string | null;
  received_at?: string | null;
  call_duration?: string | number | null;
  raw_body?: unknown;
  transcript?: unknown;
  response_summary?: string | null;
  response_title?: string | null;
};

type InsightsRow = {
  id: string;
  personaId: string | null;
  campaignId: string | null;
  campaignName?: string | null;
  receivedAt: string | null;
  callDurationSeconds: number | null;
  transcript?: unknown;
  summary?: string | null;
  responseTitle?: string | null;
  conversationId?: string | null;
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

function readDurationValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractMetadata(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const metadata = (parsed as { data?: { metadata?: unknown } })?.data?.metadata;
        if (metadata && typeof metadata === "object") {
          return metadata as Record<string, unknown>;
        }
      }
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    const metadata = (raw as { data?: { metadata?: unknown } })?.data?.metadata;
    if (metadata && typeof metadata === "object") {
      return metadata as Record<string, unknown>;
    }
  }
  return null;
}

function coerceCallDurationSeconds(row: CampaignResponseRow): number | null {
  const direct = readDurationValue(row.call_duration);
  if (direct !== null) {
    return direct;
  }

  const metadata = extractMetadata(row.raw_body);
  if (!metadata) {
    return null;
  }

  const candidate = metadata["call_duration_secs"] ?? metadata["call_duration"];
  return readDurationValue(candidate);
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

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const logContext = {
    clientId,
    page,
    pageSize,
    personaId,
    search,
  };
  console.info("[Insights API] Incoming request", logContext);

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
      .select("agent_id, agent_name, profile_image")
      .eq("client_id", clientRow.id);

    if (agentError) {
      return NextResponse.json({ error: "Failed to fetch personas" }, { status: 500 });
    }

    const personaOptions: PersonaOption[] = (agents ?? []).map((agent) => ({
      id: agent.agent_id,
      name: agent.agent_name ?? "",
      profile_image: (agent as AgentMapRow & { profile_image?: string | null }).profile_image ?? null,
    }));

    const { data: campaignRows, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, name")
      .eq("client_id", clientRow.id);

    if (campaignError) {
      console.error("[Insights API] Failed to load campaigns", { clientId, error: campaignError });
      return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 });
    }

    const campaignNameLookup = new Map<string, string | null>();
    const campaignIds = (campaignRows ?? [])
      .map((campaign) => {
        let normalizedId: string | null = null;
        if (typeof campaign.id === "string" && campaign.id.trim().length > 0) {
          normalizedId = campaign.id.trim();
        } else if (typeof campaign.id === "number") {
          normalizedId = String(campaign.id);
        }

        if (normalizedId) {
          const campaignName =
            typeof campaign.name === "string" && campaign.name.trim().length > 0
              ? campaign.name.trim()
              : null;
          campaignNameLookup.set(normalizedId, campaignName);
        }

        return normalizedId;
      })
      .filter((value): value is string => Boolean(value));

    console.info("[Insights API] Resolved campaigns", { clientId, campaignCount: campaignIds.length });

    if (campaignIds.length === 0) {
      return NextResponse.json(
        {
          rows: [],
          totalCount: 0,
          personas: personaOptions,
        } satisfies InsightsResponse,
        { status: 200 }
      );
    }

    const baseQuery = supabaseAdmin
      .from("campaign_responses")
      .select(
        "id, conversation_id, campaign_id, persona_id, received_at, call_duration, raw_body, transcript, response_summary, response_title",
        { count: "exact" }
      )
      .in("campaign_id", campaignIds)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (personaId) {
      baseQuery.eq("persona_id", personaId);
    }

    if (search) {
      const safeSearch = search.replace(/[%_,"']/g, " ").trim();
      if (safeSearch.length > 0) {
        baseQuery.or(
          [`persona_id.ilike.%${safeSearch}%`, `campaign_id.ilike.%${safeSearch}%`, `response_summary.ilike.%${safeSearch}%`].join(",")
        );
      }
    }

    const { data: responseRows, error: responsesError, count } = await baseQuery;

    if (responsesError) {
      console.error("[Insights API] Failed to load campaign responses", {
        clientId,
        personaId,
        search,
        error: responsesError,
      });
      return NextResponse.json({ error: "Failed to load campaign responses" }, { status: 500 });
    }

    const rows: InsightsRow[] = (responseRows ?? []).map((row: CampaignResponseRow, index) => {
      const callDurationSeconds = coerceCallDurationSeconds(row);
      const summary =
        typeof row.response_summary === "string" && row.response_summary.trim().length > 0
          ? row.response_summary
          : null;
      const campaignId = row.campaign_id ?? null;
      const campaignName = campaignId ? campaignNameLookup.get(campaignId) ?? null : null;
      const responseId =
        typeof row.id === "string" && row.id.trim().length > 0
          ? row.id.trim()
          : typeof row.id === "number"
          ? String(row.id)
          : row.conversation_id && row.conversation_id.trim().length > 0
          ? row.conversation_id.trim()
          : `response-${index}`;

      return {
        id: responseId,
        personaId: row.persona_id ?? null,
        campaignId,
        campaignName,
        receivedAt: row.received_at ?? null,
        callDurationSeconds,
        transcript: row.transcript,
        summary,
        responseTitle: row.response_title ?? null,
        conversationId: row.conversation_id ?? null,
      } satisfies InsightsRow;
    });

    const payload: InsightsResponse = {
      rows,
      totalCount: count ?? rows.length,
      personas: personaOptions,
    };

    console.info("[Insights API] Responding", {
      clientId,
      rowCount: rows.length,
      totalCount: payload.totalCount,
      from,
      to,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Insights API] Unexpected failure", { clientId, error });
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
