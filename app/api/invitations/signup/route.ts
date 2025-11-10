import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
  // eslint-disable-next-line no-console
  console.error("[invite-signup] Missing Supabase environment variables");
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
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let body: { token?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; password?: unknown };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[invite-signup] Invalid request body", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Missing invitation token or password" }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (inviteError) {
    // eslint-disable-next-line no-console
    console.error("[invite-signup] Failed to load invite", inviteError);
    return NextResponse.json({ error: "Unable to load invitation" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const now = Date.now();
  const expiresAtEpoch = invite.expires_at ? Date.parse(invite.expires_at) : null;
  const isExpired = typeof expiresAtEpoch === "number" && expiresAtEpoch < now;

  if (isExpired) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  if (invite.status === "accepted") {
    return NextResponse.json({ error: "Invitation already accepted" }, { status: 409 });
  }

  if (invite.status && invite.status !== "pending") {
    return NextResponse.json({ error: `Invitation is ${invite.status}` }, { status: 409 });
  }

  const inviteEmail = normalizeEmail(invite.email);

  if (!inviteEmail) {
    return NextResponse.json({ error: "Invitation email unavailable" }, { status: 500 });
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: inviteEmail,
    password,
    email_confirm: true,
    user_metadata: {
      invited_via_token: token,
      invited_client_id: invite.client_id,
    },
  });

  if (createError || !newUser?.user) {
    const message = createError?.message ?? "Unable to create account";
    if (message.toLowerCase().includes("already registered") || message.toLowerCase().includes("exists")) {
      return NextResponse.json({ error: "Account already exists for this email" }, { status: 409 });
    }
    // eslint-disable-next-line no-console
    console.error("[invite-signup] Failed to create user", createError);
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      userId: newUser.user.id,
      email: newUser.user.email,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
