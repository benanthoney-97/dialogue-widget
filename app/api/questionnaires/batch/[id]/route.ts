"use server";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeBatchId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    if (!supabaseAdmin) {
      console.error("[questionnaires/batch/:id] missing Supabase configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const params = await context.params;
    const batchId = normalizeBatchId(params?.id);
    if (!batchId) {
      return NextResponse.json({ error: "Invalid batch identifier" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      console.error("[questionnaires/batch/:id] auth token invalid", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("client_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[questionnaires/batch/:id] profile lookup failed", profileError);
      return NextResponse.json({ error: "Unable to resolve profile" }, { status: 500 });
    }

    const clientId = profile?.client_id ?? null;
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: batchJob, error: batchError } = await supabaseAdmin
      .from("batch_jobs")
      .select(
        [
          "id",
          "client_id",
          "status",
          "questionnaire_file_url",
          "questionnaire_file_name",
          "questionnaire_file_type",
          "questionnaire_file_size",
          "created_at",
          "started_at",
          "completed_at",
        ].join(","),
      )
      .eq("id", batchId)
      .maybeSingle();

    if (batchError) {
      console.error("[questionnaires/batch/:id] batch lookup failed", batchError);
      return NextResponse.json({ error: "Failed to load batch job" }, { status: 500 });
    }

    if (!batchJob) {
      return NextResponse.json({ error: "Batch job not found" }, { status: 404 });
    }

    if (batchJob.client_id !== clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: personaRows, error: personaError } = await supabaseAdmin
      .from("batch_job_personas")
      .select(
        [
          "id",
          "batch_job_id",
          "agent_id",
          "status",
          "dialogue_id",
          "error_message",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("batch_job_id", batchId)
      .order("created_at", { ascending: true });

    if (personaError) {
      console.error("[questionnaires/batch/:id] persona lookup failed", personaError);
      return NextResponse.json({ error: "Failed to load batch personas" }, { status: 500 });
    }

    const agentIds = Array.from(
      new Set((personaRows ?? []).map((row) => row.agent_id).filter((id): id is string => Boolean(id))),
    );

    let agentLookup: Record<string, { agent_name: string | null }> = {};
    if (agentIds.length > 0) {
      const { data: agentRows, error: agentError } = await supabaseAdmin
        .from("agent_map")
        .select("agent_id, agent_name")
        .in("agent_id", agentIds);

      if (agentError) {
        console.warn("[questionnaires/batch/:id] agent lookup failed", agentError);
      } else {
        agentLookup = (agentRows ?? []).reduce((acc, row) => {
          acc[row.agent_id] = { agent_name: row.agent_name ?? null };
          return acc;
        }, {} as Record<string, { agent_name: string | null }>);
      }
    }

    const dialogueIds = Array.from(
      new Set(
        (personaRows ?? [])
          .map((row) => row.dialogue_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

let dialogueLookup: Record<string, { research_type: string | null; transcript_summary: string | null; transcript: unknown }> = {};

    if (dialogueIds.length > 0) {
      const { data: dialogueRows, error: dialogueError } = await supabaseAdmin
        .from("dialogues")
        .select("id, research_type, transcript_summary, transcript")
        .in("id", dialogueIds);

      if (dialogueError) {
        console.warn("[questionnaires/batch/:id] dialogue lookup failed", dialogueError);
      } else {
        dialogueLookup = (dialogueRows ?? []).reduce((acc, row) => {
          acc[row.id] = {
            research_type: row.research_type ?? null,
            transcript_summary: row.transcript_summary ?? null,
            transcript: row.transcript ?? null,
          };
          return acc;
        }, {} as Record<string, { research_type: string | null; transcript_summary: string | null; transcript: unknown }>);
      }
    }

    const personas = (personaRows ?? []).map((row) => ({
      id: row.id,
      agent_id: row.agent_id,
      agent_name: agentLookup[row.agent_id]?.agent_name ?? null,
      status: row.status,
      error_message: row.error_message ?? null,
      dialogue_id: row.dialogue_id ?? null,
      dialogue: row.dialogue_id ? dialogueLookup[row.dialogue_id] ?? null : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json(
      {
        batch_job: {
          id: batchJob.id,
          status: batchJob.status,
          questionnaire_file_url: batchJob.questionnaire_file_url,
          questionnaire_file_name: batchJob.questionnaire_file_name,
          questionnaire_file_type: batchJob.questionnaire_file_type,
          questionnaire_file_size: batchJob.questionnaire_file_size,
          created_at: batchJob.created_at,
          started_at: batchJob.started_at,
          completed_at: batchJob.completed_at,
        },
        personas,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[questionnaires/batch/:id] unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
