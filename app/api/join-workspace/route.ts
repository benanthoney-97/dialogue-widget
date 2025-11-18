import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("[join-workspace] Missing Supabase credentials");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type JoinWorkspacePayload = {
  clientId?: unknown;
};

function normalizeClientId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    console.error("[join-workspace] Failed to validate user", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: JoinWorkspacePayload;
  try {
    payload = (await request.json()) as JoinWorkspacePayload;
  } catch (error) {
    console.error("[join-workspace] Invalid payload", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const clientId = normalizeClientId(payload.clientId);
  if (clientId === null) {
    return NextResponse.json({ error: "Missing workspace identifier" }, { status: 400 });
  }

  const { data: clientRecord, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle<{ id: number }>();

  if (clientError) {
    console.error("[join-workspace] Failed to load workspace", clientError);
    return NextResponse.json({ error: "Workspace lookup failed" }, { status: 500 });
  }

  if (!clientRecord) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { data: existingRequest, error: duplicateError } = await supabaseAdmin
    .from("team_join_requests")
    .select("id")
    .eq("requester_id", user.id)
    .eq("target_client_id", clientId)
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();

  if (duplicateError) {
    console.error("[join-workspace] Failed to check existing requests", duplicateError);
    return NextResponse.json({ error: "Unable to check existing requests" }, { status: 500 });
  }

  if (existingRequest) {
    return NextResponse.json(
      { error: "A request is already pending for this workspace" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const { data: insertedRequest, error: insertError } = await supabaseAdmin
    .from("team_join_requests")
    .insert({
      requester_id: user.id,
      target_client_id: clientId,
      requested_at: now,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (insertError || !insertedRequest) {
    console.error("[join-workspace] Failed to create join request", insertError);
    return NextResponse.json({ error: "Unable to request access" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    requestId: insertedRequest.id,
    status: insertedRequest.status ?? "pending",
  });
}
