import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
  // eslint-disable-next-line no-console
  console.error("[invite-validate] Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  client_id: number;
  expires_at: string | null;
  created_at: string | null;
  invited_by: string | null;
};

type ClientRow = {
  id: number;
  name: string;
  display_name: string | null;
};

type ProfileRow = {
  id: string;
};

export async function GET(request: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (inviteError) {
    // eslint-disable-next-line no-console
    console.error("[invite-validate] Failed to load invite", inviteError);
    return NextResponse.json({ error: "Unable to load invitation" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, name, display_name")
    .eq("id", invite.client_id)
    .maybeSingle<ClientRow>();

  const { data: profileMatch, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", invite.email)
    .maybeSingle<ProfileRow>();

  if (profileError && profileError.code !== "PGRST116") {
    // eslint-disable-next-line no-console
    console.error("[invite-validate] Failed to check profile", profileError);
  }

  const now = Date.now();
  const expiresAtEpoch = invite.expires_at ? Date.parse(invite.expires_at) : null;
  const isExpired = typeof expiresAtEpoch === "number" && expiresAtEpoch < now;

  const derivedStatus = isExpired ? "expired" : invite.status ?? "pending";

  return NextResponse.json(
    {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: derivedStatus,
      clientId: invite.client_id,
      clientName: client?.display_name ?? client?.name ?? null,
      expiresAt: invite.expires_at,
      invitedBy: invite.invited_by,
      createdAt: invite.created_at,
      hasAccount: Boolean(profileMatch),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
