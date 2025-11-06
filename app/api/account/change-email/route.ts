"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ChangeEmailPayload = {
  email?: unknown;
  refreshToken?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChangeEmailPayload | null;
    if (!body) {
      return NextResponse.json({ error: "Missing request body" }, { status: 400 });
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const refreshToken =
      typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
    if (!rawEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "Email format is invalid" }, { status: 400 });
    }

    if (!refreshToken) {
      console.warn("[change-email] missing refresh token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      console.warn("[change-email] missing bearer token", { hasAuthHeader: Boolean(authHeader) });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) {
      console.warn("[change-email] empty access token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[change-email] missing supabase env vars", {
        hasUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(supabaseAnonKey),
      });
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        detectSessionInUrl: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: sessionData,
      error: sessionError,
    } = await supabaseUserClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData?.session || !sessionData.user) {
      console.error("[change-email] could not establish session", { sessionError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = sessionData.user;

    const currentEmail = user.email ?? null;
    if (currentEmail && currentEmail.toLowerCase() === rawEmail.toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      );
    }

    console.log("[change-email] attempting update", {
      currentEmail,
      targetEmail: rawEmail,
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth?verification=success&email=change`;

    const { data: updateResult, error: updateError } = await supabaseUserClient.auth.updateUser(
      { email: rawEmail },
      { emailRedirectTo: redirectTo }
    );

    if (updateError) {
      console.error("[change-email] update failed", updateError);
      const status = updateError.status ?? 400;
      const message = updateError.message ?? "Unable to update email";
      return NextResponse.json({ error: message }, { status });
    }

    console.log("[change-email] update triggered", {
      updateResult,
      redirectTo,
    });

    return NextResponse.json({ message: "Confirmation sent to the new email." }, { status: 200 });
  } catch (error) {
    console.error("[change-email] unexpected error", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
