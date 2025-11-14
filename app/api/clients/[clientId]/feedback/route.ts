import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/app/lib/jump";

type FeedbackRow = {
  id: string;
  feedback_title: string;
  feedback_body: string | null;
  from_url: string | null;
  created_at: string | null;
  persona_id: string | null;
  user_id: string | null;
};

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
};

type FeedbackPayload = {
  entries: Array<{
    id: string;
    title: string;
    body: string | null;
    source: string | null;
    fromUrl: string | null;
    createdAt: string | null;
    personaId: string | null;
    personaName: string | null;
    userId: string | null;
    submittedBy: string | null;
  }>;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

async function resolveClientId(clientIdentifier?: string): Promise<number | null> {
  if (!clientIdentifier) {
    return null;
  }

  const trimmed = clientIdentifier.trim();
  if (!trimmed) {
    return null;
  }

  const numericId = Number(trimmed);
  if (Number.isFinite(numericId) && numericId > 0) {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", numericId)
      .maybeSingle<{ id: number }>();
    if (!error && data) {
      return data.id;
    }
  }

  // Directly try matching the raw string (covering UUID-based slugs)
  const { data: exactMatch, error: exactMatchError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", trimmed)
    .maybeSingle<{ id: number }>();
  if (!exactMatchError && exactMatch) {
    return exactMatch.id;
  }

  const normalized = slugify(trimmed);
  const { data: allClients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, name, display_name");

  if (clientsError || !allClients) {
    return null;
  }

  const match = allClients.find((client) => {
    const nameSlug = slugify(client.name);
    const displaySlug = client.display_name ? slugify(client.display_name) : "";
    return nameSlug === normalized || displaySlug === normalized;
  });

  return match ? match.id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: { clientId?: string } }
) {
  const clientIdentifier = params.clientId;
  const resolvedClientId = await resolveClientId(clientIdentifier);

  if (!resolvedClientId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const feedbackResponse = await supabaseAdmin
      .from("user_feedback")
      .select(
        "id, feedback_title, feedback_body, from_url, created_at, persona_id, user_id"
      )
      .eq("client_id", resolvedClientId)
      .order("created_at", { ascending: false })
      .limit(500);

    const feedbackRows = ((feedbackResponse.data ?? []) as FeedbackRow[]);
    const feedbackError = feedbackResponse.error;

    if (feedbackError) {
      console.error("[Feedback API] Failed to load feedback", feedbackError);
      return NextResponse.json(
        { error: "Unable to load feedback" },
        { status: 500 }
      );
    }

    const personaIds = Array.from(
      new Set(feedbackRows.map((row) => row.persona_id).filter((value): value is string => Boolean(value)))
    );
    const userIds = Array.from(
      new Set(feedbackRows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
    );

    let personaById: Record<string, PersonaRow> = {};
    if (personaIds.length > 0) {
      const { data: personaRows, error: personaError } = await supabaseAdmin
        .from("agent_map")
        .select("agent_id, agent_name")
        .in("agent_id", personaIds);
      if (personaError) {
        console.error("[Feedback API] Failed to load personas", personaError);
        return NextResponse.json(
          { error: "Unable to resolve personas" },
          { status: 500 }
        );
      }
      personaById = (personaRows ?? []).reduce<Record<string, PersonaRow>>((acc, persona) => {
        acc[persona.agent_id] = persona;
        return acc;
      }, {});
    }

    let profileById: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds);
      if (profilesError) {
        console.error("[Feedback API] Failed to load profiles", profilesError);
        return NextResponse.json(
          { error: "Unable to resolve submitters" },
          { status: 500 }
        );
      }
      profileById = (profiles ?? []).reduce<Record<string, ProfileRow>>((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
    }

    const entries = feedbackRows.map((row) => {
      const persona = row.persona_id ? personaById[row.persona_id] : undefined;
      const profile = row.user_id ? profileById[row.user_id] : undefined;
      const submittedBy = profile?.display_name?.trim() || profile?.email?.trim() || row.user_id;

      return {
        id: row.id,
        title: row.feedback_title,
        body: row.feedback_body,
        source: row.from_url,
        fromUrl: row.from_url,
        createdAt: row.created_at,
        personaId: row.persona_id,
        personaName: persona?.agent_name ?? null,
        userId: row.user_id,
        submittedBy: submittedBy ?? null,
      };
    });

    const payload: FeedbackPayload = { entries };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Feedback API] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
