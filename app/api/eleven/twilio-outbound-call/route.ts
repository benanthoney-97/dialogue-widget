import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ELEVENLABS_API_BASE =
  process.env.ELEVENLABS_API_BASE?.replace(/\/+$/, "") || "https://api.elevenlabs.io";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY?.trim();
const ELEVENLABS_TWILIO_PHONE_NUMBER_ID = process.env.ELEVENLABS_TWILIO_PHONE_NUMBER_ID?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

type CampaignMetadata = {
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  questions?: string[];
};

type OutboundCallPayload = {
  phone?: string | null;
  campaignLinkId?: string | null;
  campaignId?: string | null;
  campaignMeta?: CampaignMetadata;
  documentMarkdowns?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as OutboundCallPayload;
    console.log("[eleven-outbound-call] payload", payload);
    const toNumber =
      typeof payload.phone === "string" && payload.phone.trim().length > 0 ? payload.phone.trim() : null;
    if (!toNumber) {
      return NextResponse.json({ error: "Missing phone number" }, { status: 400 });
    }
    if (!ELEVENLABS_API_KEY || !ELEVENLABS_TWILIO_PHONE_NUMBER_ID) {
      console.error("[eleven-outbound-call] missing ElevenLabs configuration");
      return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
    }

    let personaAgentId: string | null = null;
    let campaignId = payload.campaignId ?? null;
    if (payload.campaignLinkId && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from("campaign_links")
        .select("campaign_id, persona_id")
        .eq("id", payload.campaignLinkId)
        .limit(1);
      if (error) {
        console.error("[eleven-outbound-call] failed to lookup campaign_link", { campaignLinkId: payload.campaignLinkId, error });
      } else if (Array.isArray(data) && data.length > 0) {
        const row = data[0];
        campaignId = campaignId ?? row.campaign_id ?? null;
        personaAgentId = row.persona_id ?? null;
      }
    }

    const campaignMeta = payload.campaignMeta ?? {};
    const documentMarkdowns =
      Array.isArray(payload.documentMarkdowns) && payload.documentMarkdowns.length > 0
        ? payload.documentMarkdowns.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : [];

    const dynamicVariables: Record<string, unknown> = {
      campaign_link_id: payload.campaignLinkId ?? undefined,
      campaign_id: campaignId ?? undefined,
      persona_id: personaAgentId ?? undefined,
    };
    if (campaignMeta.name) {
      dynamicVariables.campaign_name = campaignMeta.name;
    }
    if (campaignMeta.description) {
      dynamicVariables.campaign_description = campaignMeta.description;
    }
    if (campaignMeta.objective) {
      dynamicVariables.campaign_objective = campaignMeta.objective;
    }
    if (campaignMeta.questions && campaignMeta.questions.length > 0) {
      dynamicVariables.campaign_questions = JSON.stringify(campaignMeta.questions);
    }
    if (documentMarkdowns.length > 0) {
      dynamicVariables.campaign_documents = JSON.stringify(documentMarkdowns);
    }

    const twilioPayload: Record<string, unknown> = {
      agent_phone_number_id: ELEVENLABS_TWILIO_PHONE_NUMBER_ID,
      to_number: toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: {
          ...dynamicVariables,
        },
      },
      metadata: {
        campaign_link_id: payload.campaignLinkId ?? undefined,
        campaign_id: campaignId ?? undefined,
      },
    };

    twilioPayload.agent_id = "agent_2301kav2jq01ftbvns81kax8ed47";

    const response = await fetch(`${ELEVENLABS_API_BASE}/v1/convai/twilio/outbound-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify(twilioPayload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[eleven-outbound-call] ElevenLabs error", data);
      return NextResponse.json({ error: data }, { status: response.status });
    }

    console.log("[eleven-outbound-call] elevenlabs response", { status: response.status, data });
    return NextResponse.json({ status: "ok", ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[eleven-outbound-call] failure", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
