// @ts-expect-error — resolved by the Deno runtime when deployed to Supabase Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error — resolved by the Deno runtime when deployed to Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

type JsonRecord = Record<string, unknown>;

type InvitePayload = {
  email?: unknown;
  role?: unknown;
};

const ALLOWED_ROLES = new Set(["viewer", "admin", "owner"]);
const COMMON_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
} as const;

function jsonResponse(req: Request, status: number, body: JsonRecord) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...COMMON_CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
    },
  });
}

function emptyResponse(req: Request, status = 200) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(null, {
    status,
    headers: {
      ...COMMON_CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
    },
  });
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveInviteUrl(token: string): string {
  const template = Deno.env.get("INVITE_ACCEPT_URL")?.trim();
  if (!template || template.length === 0) {
    return `https://embed.dialogue-ai.co/auth/accept?token=${token}`;
  }
  if (template.includes("{token}")) {
    return template.replace("{token}", token);
  }
  const separator = template.includes("?") ? "&" : "?";
  return `${template}${separator}token=${token}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return emptyResponse(req, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const resendReplyTo = Deno.env.get("RESEND_REPLY_TO_EMAIL") ?? undefined;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing required Supabase env vars");
    return jsonResponse(req, 500, { error: "Server misconfiguration" });
  }

  if (!resendApiKey || !resendFromEmail) {
    console.error("Resend secrets are missing");
    return jsonResponse(req, 500, { error: "Email service not configured" });
  }

  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch (error) {
    console.error("Failed to parse request body", error);
    return jsonResponse(req, 400, { error: "Invalid request payload" });
  }

  const emailValue = typeof payload.email === "string" ? payload.email : "";
  const roleValue = typeof payload.role === "string" ? payload.role : "viewer";

  const email = normaliseEmail(emailValue);
  const role = roleValue.trim().toLowerCase();

  if (!email) {
    return jsonResponse(req, 400, { error: "Email is required" });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse(req, 400, { error: "Invalid role" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return jsonResponse(req, 401, { error: "Missing access token" });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    console.error("Auth validation failed", authError);
    return jsonResponse(req, 401, { error: "Unauthorized" });
  }

  const { data: inviterProfile, error: inviterError } = await supabase
    .from("profiles")
    .select("id, email, display_name, client_id, role")
    .eq("id", user.id)
    .single();

  if (inviterError || !inviterProfile) {
    console.error("Failed to load inviter profile", inviterError);
    return jsonResponse(req, 403, { error: "Not allowed to invite teammates" });
  }

  if (!inviterProfile.client_id) {
    return jsonResponse(req, 400, { error: "Inviter is not linked to a workspace" });
  }

  const inviterRole =
    typeof inviterProfile.role === "string" ? inviterProfile.role.trim().toLowerCase() : "viewer";
  if (inviterRole !== "admin") {
    return jsonResponse(req, 403, { error: "Only admins can invite teammates" });
  }

  const clientId: number = inviterProfile.client_id;

  const { data: clientRecord, error: clientError } = await supabase
    .from("clients")
    .select("display_name, name")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) {
    console.warn("Failed to load workspace metadata", clientError);
  }

  const { data: existingMember, error: memberError } = await supabase
    .from("profiles")
    .select("id")
    .eq("client_id", clientId)
    .eq("email", email)
    .maybeSingle();

  if (memberError) {
    console.error("Failed to check existing member", memberError);
    return jsonResponse(req, 500, { error: "Unable to check existing members" });
  }

  if (existingMember) {
    return jsonResponse(req, 409, { error: "That email is already a member of this workspace" });
  }

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const inviteToken = crypto.randomUUID();

  const { data: existingInvite, error: inviteLookupError } = await supabase
    .from("team_invites")
    .select("id, status")
    .eq("client_id", clientId)
    .eq("email", email)
    .maybeSingle();

  if (inviteLookupError) {
    console.error("Failed to load existing invite", inviteLookupError);
    return jsonResponse(req, 500, { error: "Unable to manage invite" });
  }

  if (existingInvite?.status === "accepted") {
    return jsonResponse(req, 409, { error: "This teammate has already joined" });
  }

  let inviteRecord: {
    id: string;
    token: string;
    email: string;
    role: string;
    status: string;
    expires_at: string | null;
  } | null = null;

  if (existingInvite) {
    const { data, error } = await supabase
      .from("team_invites")
      .update({
        role,
        token: inviteToken,
        status: "pending",
        invited_by: inviterProfile.id,
        expires_at: expiresAt,
      })
      .eq("id", existingInvite.id)
      .select("id, token, email, role, status, expires_at")
      .single();

    if (error || !data) {
      console.error("Failed to update existing invite", error);
      return jsonResponse(req, 500, { error: "Unable to update invite" });
    }

    inviteRecord = data;
  } else {
    const { data, error } = await supabase
      .from("team_invites")
      .insert({
        client_id: clientId,
        email,
        role,
        token: inviteToken,
        status: "pending",
        invited_by: inviterProfile.id,
        expires_at: expiresAt,
      })
      .select("id, token, email, role, status, expires_at")
      .single();

    if (error || !data) {
      console.error("Failed to create invite", error);
      return jsonResponse(req, 500, { error: "Unable to create invite" });
    }

    inviteRecord = data;
  }

  if (!inviteRecord) {
    console.error("Invite record unexpectedly missing after upsert");
    return jsonResponse(req, 500, { error: "Unable to create invite" });
  }

  const inviteUrl = resolveInviteUrl(inviteRecord.token);
  const inviterName = inviterProfile.display_name ?? inviterProfile.email ?? "A teammate";
  const workspaceName = clientRecord?.display_name ?? clientRecord?.name ?? "their Dialogue workspace";
  const subject = `${inviterName} invited you to Dialogue`;

  const expiresText = inviteRecord.expires_at
    ? new Date(inviteRecord.expires_at).toLocaleString("en-GB", { timeZone: "UTC", timeStyle: "short", dateStyle: "medium" }) + " UTC"
    : "soon";

  const htmlBody = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Dialogue invite</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background: #f8fafc; }
        .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
        .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12); }
        h1 { margin: 0 0 16px; font-size: 20px; color: #0f172a; }
        p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 12px; }
        .cta { display: inline-block; margin-top: 22px; padding: 12px 20px; background: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; }
        .meta { font-size: 13px; color: #64748b; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <h1>${inviterName} invited you to Dialogue</h1>
          <p>Hi there,</p>
          <p>${inviterName} has added you as a <strong>${role}</strong> on ${workspaceName}.</p>
          <p>Click below to accept the invite and get started.</p>
          <p><a class="cta" href="${inviteUrl}">Accept invitation</a></p>
          <p class="meta">This link expires ${expiresText}. If you were not expecting this invite, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
  </html>`;

  const textBody = `Hi there,\n\n${inviterName} has added you as a ${role} on ${workspaceName}.\n\nAccept the invitation: ${inviteUrl}\n\nThis link expires ${expiresText}. If you were not expecting this invite you can ignore this email.`;

  const resendPayload: Record<string, unknown> = {
    from: resendFromEmail,
    to: [email],
    subject,
    html: htmlBody,
    text: textBody,
  };

  if (resendReplyTo) {
    resendPayload.reply_to = resendReplyTo;
  }

  console.log("invite-teammate: sending email", {
    inviteId: inviteRecord.id,
    to: email,
    role,
  });

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text().catch(() => "");
    console.error("Resend error", {
      status: resendResponse.status,
      body: errorText,
    });
    return jsonResponse(req, 502, { error: "Failed to send invite email" });
  }

  const resendResult = await resendResponse.json().catch(() => ({}));

  console.log("invite-teammate: resend success", {
    inviteId: inviteRecord.id,
    resendId: (resendResult as { id?: string }).id ?? null,
  });

  return jsonResponse(req, 200, {
    inviteId: inviteRecord.id,
    resendId: (resendResult as { id?: string }).id ?? null,
    status: inviteRecord.status,
  });
});
