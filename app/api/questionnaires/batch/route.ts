"use server";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const QUESTIONNAIRE_BUCKET = "questionnaires";

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

type QuestionnaireFilePayload = {
  file_name?: string;
  file_type?: string;
  file_size?: number | string | null;
  data_url?: string;
};

type BatchRequestPayload = {
  persona_ids?: unknown;
  questionnaire?: QuestionnaireFilePayload | null;
  notes?: string | null;
};

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const mimeType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function buildPublicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${QUESTIONNAIRE_BUCKET}/${encodeURIComponent(path)}`;
}

function parsePersonaIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const ids = input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  return Array.from(new Set(ids));
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error("[questionnaires/batch] missing Supabase configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as BatchRequestPayload | null;

    if (!payload) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const questionnaireInput = payload.questionnaire ?? null;
    const personaIds = parsePersonaIds(payload.persona_ids);

    if (personaIds.length === 0) {
      return NextResponse.json({ error: "persona_ids must include at least one persona" }, { status: 400 });
    }

    if (!questionnaireInput?.data_url) {
      return NextResponse.json({ error: "questionnaire.data_url is required" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error("[questionnaires/batch] auth token invalid", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("client_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[questionnaires/batch] profile lookup failed", profileError);
      return NextResponse.json({ error: "Unable to resolve profile" }, { status: 500 });
    }

    const clientId = profile?.client_id ?? null;

    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch personas to ensure they belong to the same workspace.
    const { data: personaRows, error: personaLookupError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id, client_id")
      .in("agent_id", personaIds);

    if (personaLookupError) {
      console.error("[questionnaires/batch] persona lookup failed", personaLookupError);
      return NextResponse.json({ error: "Unable to resolve personas" }, { status: 500 });
    }

    if (!personaRows || personaRows.length !== personaIds.length) {
      return NextResponse.json({ error: "One or more personas were not found" }, { status: 404 });
    }

    const unauthorizedPersona = personaRows.find((row) => row.client_id !== clientId);
    if (unauthorizedPersona) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { buffer, mimeType } = decodeDataUrl(questionnaireInput.data_url);

    const originalName =
      typeof questionnaireInput.file_name === "string" && questionnaireInput.file_name.trim().length > 0
        ? questionnaireInput.file_name.trim()
        : `questionnaire-${Date.now()}.pdf`;

    const fileName = safeFileName(originalName);
    const storagePath = `batch/${clientId}/${randomUUID()}-${fileName}`;

    const candidateContentType =
      questionnaireInput.file_type && questionnaireInput.file_type.trim().length > 0
        ? questionnaireInput.file_type.trim()
        : mimeType;

    const uploadContentType =
      candidateContentType &&
      !["text/csv", "text/tab-separated-values"].includes(candidateContentType)
        ? candidateContentType
        : "application/octet-stream";

    const { error: uploadError } = await supabaseAdmin.storage
      .from(QUESTIONNAIRE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: uploadContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[questionnaires/batch] storage upload failed", uploadError);
      return NextResponse.json({ error: "Failed to upload questionnaire" }, { status: 500 });
    }
    const { data: publicUrlData } = await supabaseAdmin.storage
      .from(QUESTIONNAIRE_BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl =
      (publicUrlData as any)?.publicUrl ??
      (publicUrlData as any)?.publicURL ??
      buildPublicUrl(storagePath);

    const numericFileSize =
      questionnaireInput.file_size === null || questionnaireInput.file_size === undefined
        ? buffer.byteLength
        : Number(questionnaireInput.file_size);

    const insertBatchPayload: Record<string, unknown> = {
      client_id: clientId,
      created_by: userId,
      status: "pending",
      questionnaire_file_name: fileName,
      questionnaire_file_type: questionnaireInput.file_type ?? mimeType,
      questionnaire_file_size: Number.isFinite(numericFileSize) ? numericFileSize : buffer.byteLength,
      questionnaire_file_url: publicUrl,
    };

    const { data: batchJob, error: batchInsertError } = await supabaseAdmin
      .from("batch_jobs")
      .insert(insertBatchPayload)
      .select("id, status, created_at, questionnaire_file_url, questionnaire_file_name")
      .single();

    if (batchInsertError || !batchJob) {
      console.error("[questionnaires/batch] failed to insert batch job", batchInsertError);
      return NextResponse.json({ error: "Failed to create batch job" }, { status: 500 });
    }

    const personaInserts = personaRows.map((row) => ({
      batch_job_id: batchJob.id,
      agent_id: row.agent_id,
      status: "queued",
    }));

    const { data: insertedPersonas, error: personaInsertError } = await supabaseAdmin
      .from("batch_job_personas")
      .insert(personaInserts)
      .select("id, agent_id, status");

    if (personaInsertError) {
      console.error("[questionnaires/batch] failed to insert persona rows", personaInsertError);
      return NextResponse.json({ error: "Failed to queue personas for batch run" }, { status: 500 });
    }

    return NextResponse.json(
      {
        batch_job: batchJob,
        personas: insertedPersonas ?? [],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[questionnaires/batch] unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
