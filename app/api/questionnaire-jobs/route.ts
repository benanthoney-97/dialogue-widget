"use server";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

type BodyPayload = {
  agent_id?: string;
  file_path?: string;
  file_size?: number | string | null;
  file_hash?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BodyPayload | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
    const filePath = typeof body.file_path === "string" ? body.file_path.trim() : "";
    const fileSizeRaw = body.file_size;
    const fileHash =
      typeof body.file_hash === "string" && body.file_hash.trim().length > 0
        ? body.file_hash.trim()
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

    const cookieStore = await cookies();
    console.log("[questionnaire-jobs] cookie snapshot", {
      cookieCount: cookieStore.getAll().length,
      hasAuthCookie: cookieStore.get("sb-kbxwedaluywyogaimmyi-auth-token") ? true : false,
    });
    const supabase = createRouteHandlerClient(
      { cookies: () => cookieStore },
      {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("[questionnaire-jobs] session lookup error", sessionError);
    }
    if (!session) {
      console.warn("[questionnaire-jobs] no active session", {
        sessionError: sessionError?.message ?? null,
      });
    }
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[questionnaire-jobs] session resolved", {
      userId: session.user?.id ?? null,
    });

    const userId = session.user?.id ?? null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("client_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[questionnaire-jobs] profile lookup failed", profileError);
      return NextResponse.json({ error: "Unable to resolve client profile" }, { status: 500 });
    }

    const clientId = profile?.client_id ?? null;
    console.log("[questionnaire-jobs] profile resolved", {
      clientId,
      userId,
    });

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[questionnaire-jobs] missing service role key");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      serviceRoleKey
    );

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
      console.error("[questionnaire-jobs] insert failed", insertError);
      return NextResponse.json({ error: "Failed to create questionnaire job" }, { status: 500 });
    }

    return NextResponse.json({ job: inserted }, { status: 201 });
  } catch (error) {
    console.error("[questionnaire-jobs] unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
