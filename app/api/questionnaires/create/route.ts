"use server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RequestBody = {
  agent_id?: string;
  file_path?: string;
  file_size?: number | string | null;
  file_hash?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      console.error("[questionnaires/create] missing Supabase configuration");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const accessToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as RequestBody | null;

    console.log("[questionnaires/create] incoming request", {
      hasToken: Boolean(accessToken),
      tokenLength: accessToken.length,
    });
    if (!payload) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const agentId = typeof payload.agent_id === "string" ? payload.agent_id.trim() : "";
    const filePath = typeof payload.file_path === "string" ? payload.file_path.trim() : "";
    const fileSizeRaw = payload.file_size;
    const fileHash =
      typeof payload.file_hash === "string" && payload.file_hash.trim().length > 0
        ? payload.file_hash.trim()
        : null;

    if (!agentId) {
      return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: "file_path is required" }, { status: 400 });
    }

    const fileSize =
      fileSizeRaw === undefined || fileSizeRaw === null
        ? null
        : Number(fileSizeRaw);

    if (fileSize !== null && !Number.isFinite(fileSize)) {
      return NextResponse.json({ error: "file_size must be numeric" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error("[questionnaires/create] auth token invalid", userError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[questionnaires/create] authenticated user", {
      userId: userData.user.id,
      email: userData.user.email,
    });

    const userId = userData.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("client_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[questionnaires/create] profile lookup failed", profileError);
      return NextResponse.json({ error: "Unable to resolve profile" }, { status: 500 });
    }

    const clientId = profile?.client_id ?? null;

    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log("[questionnaires/create] resolved profile", {
      userId,
      clientId,
    });

    const { data: persona, error: personaError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id, client_id")
      .eq("agent_id", agentId)
      .maybeSingle();

    if (personaError) {
      console.error("[questionnaires/create] persona lookup failed", personaError);
      return NextResponse.json({ error: "Unable to resolve persona" }, { status: 500 });
    }

    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    if (persona.client_id !== clientId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    console.log("[questionnaires/create] persona validated", {
      agentId: persona.agent_id,
      personaClientId: persona.client_id,
    });

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("questionnaire_jobs")
      .insert({
        agent_id: agentId,
        client_id: clientId,
        user_id: userId,
        file_path: filePath,
        file_size: fileSize,
        file_hash: fileHash,
        status: "queued",
      })
      .select("id, status, created_at")
      .single();

    if (insertError || !inserted) {
      console.error("[questionnaires/create] insert failed", insertError);
      return NextResponse.json({ error: "Failed to create questionnaire job" }, { status: 500 });
    }

    return NextResponse.json({ job: inserted }, { status: 201 });
  } catch (error) {
    console.error("[questionnaires/create] unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
