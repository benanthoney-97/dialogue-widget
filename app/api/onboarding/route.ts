import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // eslint-disable-next-line no-console
  console.error("[onboarding] Missing Supabase environment variables");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type OnboardingPayload = {
  displayName?: unknown;
  companyName?: unknown;
  companySize?: unknown;
  teamName?: unknown;
};

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    console.error("[onboarding] Failed to validate user", authError);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: OnboardingPayload;
  try {
    body = (await request.json()) as OnboardingPayload;
  } catch (err) {
    console.error("[onboarding] Invalid payload", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = {
    display_name: toNullableString(body.displayName),
    company_name: toNullableString(body.companyName),
    company_size: toNullableString(body.companySize),
    team_name: toNullableString(body.teamName),
    updated_at: new Date().toISOString(),
  } as const;

  if (
    payload.display_name === null &&
    payload.company_name === null &&
    payload.company_size === null &&
    payload.team_name === null
  ) {
    return NextResponse.json({ error: "No onboarding fields were provided" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (updateError) {
    console.error("[onboarding] Failed to update profile", updateError);
    return NextResponse.json({ error: "Unable to save onboarding information" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}