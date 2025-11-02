import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  client_id: number;
  expires_at: string | null;
};

type ProfileRow = {
  id: string;
};

type ClientRow = {
  id: number;
  name: string;
  display_name: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
  // eslint-disable-next-line no-console
  console.error("[invite-accept] Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[invite-accept] Invalid request body", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    // eslint-disable-next-line no-console
    console.error("[invite-accept] Failed to validate user", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (inviteError) {
    // eslint-disable-next-line no-console
    console.error("[invite-accept] Failed to load invite", inviteError);
    return NextResponse.json({ error: "Unable to load invite" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const now = Date.now();
  const expiresAtEpoch = invite.expires_at ? Date.parse(invite.expires_at) : null;
  const isExpired = typeof expiresAtEpoch === "number" && expiresAtEpoch < now;

  if (isExpired) {
    return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
  }

  if (invite.status === "accepted") {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  const inviteEmail = normalizeEmail(invite.email);
  const userEmail = normalizeEmail(user.email);

  if (!inviteEmail || inviteEmail !== userEmail) {
    return NextResponse.json({ error: "Signed-in user does not match invite" }, { status: 403 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name, display_name")
    .eq("id", invite.client_id)
    .maybeSingle<ClientRow>();

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const nowIso = new Date().toISOString();

  if (existingProfile) {
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        client_id: invite.client_id,
        role: invite.role,
        updated_at: nowIso,
      })
      .eq("id", user.id);

    if (profileUpdateError) {
      // eslint-disable-next-line no-console
      console.error("[invite-accept] Failed to update profile", profileUpdateError);
      return NextResponse.json({ error: "Unable to update profile" }, { status: 500 });
    }
  } else {
    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        client_id: invite.client_id,
        role: invite.role,
        display_name: user.user_metadata?.full_name ?? user.email ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      });

    if (profileInsertError) {
      // eslint-disable-next-line no-console
      console.error("[invite-accept] Failed to create profile", profileInsertError);
      return NextResponse.json({ error: "Unable to create profile" }, { status: 500 });
    }
  }

  const { error: updateInviteError } = await supabaseAdmin
    .from("team_invites")
    .update({
      status: "accepted",
      accepted_at: nowIso,
      accepted_by: user.id,
      token,
    })
    .eq("id", invite.id);

  if (updateInviteError) {
    // eslint-disable-next-line no-console
    console.error("[invite-accept] Failed to update invite", updateInviteError);
    return NextResponse.json({ error: "Unable to update invite status" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      clientId: invite.client_id,
      inviteId: invite.id,
      clientName: client?.display_name ?? client?.name ?? null,
      role: invite.role,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
