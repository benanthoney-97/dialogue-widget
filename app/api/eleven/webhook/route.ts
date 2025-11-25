import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

const ELEVENLABS_WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
const SIGNATURE_HEADERS = [
  "x-eleven-signature",
  "x-elevenlabs-signature",
  "x-eleven-signature-ed25519",
  "eleven-signature",
];

type WebhookBody = Record<string, unknown>;

type CampaignWebhookDetails = {
  campaignId: string;
  campaignLinkId?: string;
  personaId?: string | null;
  agentId?: string | null;
  phoneNumber?: string | null;
  linkUrl?: string | null;
  meta?: {
    campaign_name?: string;
    campaign_description?: string;
    campaign_objective?: string;
    campaign_questions?: string[];
    campaign_documents?: string[];
  };
};

function extractSignature(rawSignature: string | null): string | null {
  if (!rawSignature) {
    return null;
  }
  const trimmed = rawSignature.trim();
  if (!trimmed) {
    return null;
  }
  const [primary] = trimmed.split(/\s*,\s*/);
  const equalsIndex = primary.indexOf("=");
  if (equalsIndex !== -1) {
    return primary.slice(equalsIndex + 1).trim();
  }
  return primary;
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

function verifySignature(secret: string, payload: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.trim()) {
    return false;
  }
  const provided = extractSignature(signatureHeader);
  if (!provided) {
    return false;
  }
  const hmac = createHmac("sha256", secret).update(payload).digest();
  const hexValue = hmac.toString("hex");
  const base64Value = hmac.toString("base64");
  return timingSafeCompare(provided, hexValue) || timingSafeCompare(provided, base64Value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMetadata(value: unknown): WebhookBody | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as WebhookBody;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as WebhookBody;
      }
    } catch {
      // ignore malformed metadata
    }
  }
  return null;
}

function getDynamicVariables(body: WebhookBody): WebhookBody | null {
  const candidate = (body.dynamic_variables ?? body.dynamicVariables) as WebhookBody | undefined | null;
  if (!candidate || Array.isArray(candidate)) {
    return null;
  }
  return candidate;
}

function extractCampaignLinkId(
  body: WebhookBody,
  metadata: WebhookBody | null,
  dynamic: WebhookBody | null
): string | null {
  const candidates = [
    normalizeString(body.campaign_link_id),
    normalizeString(body.campaignLinkId),
    normalizeString(body.link_id),
    normalizeString(body.campaign_link),
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  if (dynamic) {
    const dynamicCandidate = normalizeString(dynamic.campaign_link_id) ?? normalizeString(dynamic.campaignLinkId);
    if (dynamicCandidate) {
      return dynamicCandidate;
    }
  }
  if (metadata) {
    const metaCandidate = normalizeString(metadata.campaign_link_id) ?? normalizeString(metadata.campaignLinkId);
    if (metaCandidate) {
      return metaCandidate;
    }
  }
  return null;
}

function extractCampaignId(body: WebhookBody, metadata: WebhookBody | null, dynamic: WebhookBody | null): string | null {
  const candidate =
    normalizeString(body.campaign_id) ??
    normalizeString(body.campaignId) ??
    normalizeString(body.linked_campaign_id) ??
    normalizeString(body.linkedCampaignId);
  if (candidate) {
    return candidate;
  }
  if (dynamic) {
    const dynamicCandidate = normalizeString(dynamic.campaign_id) ?? normalizeString(dynamic.campaignId);
    if (dynamicCandidate) {
      return dynamicCandidate;
    }
  }
  if (metadata) {
    return normalizeString(metadata.campaign_id) ?? normalizeString(metadata.campaignId);
  }
  return null;
}

function extractAgentId(body: WebhookBody, metadata: WebhookBody | null, dynamic: WebhookBody | null): string | null {
  const candidate = normalizeString(body.agent_id) ?? normalizeString(body.agentId);
  if (candidate) {
    return candidate;
  }
  if (dynamic) {
    const dynamicCandidate = normalizeString(dynamic.agent_id) ?? normalizeString(dynamic.persona_id);
    if (dynamicCandidate) {
      return dynamicCandidate;
    }
  }
  if (metadata) {
    return normalizeString(metadata.agent_id) ?? normalizeString(metadata.agentId);
  }
  return null;
}

async function fetchCampaignAgentId(campaignId: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("agent_id")
    .eq("id", campaignId)
    .limit(1);
  if (error) {
    console.error("[eleven-webhook] failed to load campaign agent_id", { campaignId, error });
    return null;
  }
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }
  return normalizeString(data[0]?.agent_id ?? null);
}

async function resolveCampaignDetails(options: {
  campaignLinkId?: string | null;
  campaignId?: string | null;
  agentId?: string | null;
  dynamicVariables?: WebhookBody | null;
}): Promise<CampaignWebhookDetails | null> {
  if (!supabaseAdmin) {
    return null;
  }
  const dynamic = options.dynamicVariables;
  if (options.campaignLinkId) {
    console.log("[eleven-webhook] resolving campaign_link_id", options.campaignLinkId);
    const { data, error } = await supabaseAdmin
      .from("campaign_links")
      .select("campaign_id, persona_id, phone_number, link_url")
      .eq("id", options.campaignLinkId)
      .limit(1);
    if (error) {
      console.error("[eleven-webhook] failed to load campaign_link", { linkId: options.campaignLinkId, error });
    } else if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as {
        campaign_id: string;
        persona_id?: string | null;
        phone_number?: string | null;
        link_url?: string | null;
      };
      const personaAgentId = normalizeString(row.persona_id ?? null);
      const agentId =
        personaAgentId || (await fetchCampaignAgentId(row.campaign_id)) || null;
      return {
        campaignId: row.campaign_id,
        campaignLinkId: options.campaignLinkId,
        personaId: personaAgentId,
        agentId,
        phoneNumber: row.phone_number ?? null,
        linkUrl: row.link_url ?? null,
      };
    }
  }

  if (options.campaignId) {
    console.log("[eleven-webhook] resolving campaign_id", options.campaignId);
    const agentId = await fetchCampaignAgentId(options.campaignId);
    return { campaignId: options.campaignId, agentId };
  }

  if (options.agentId) {
    console.log("[eleven-webhook] resolving agent_id", options.agentId);
    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, agent_id")
      .eq("agent_id", options.agentId)
      .limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as { id: string; agent_id?: string | null };
      return { campaignId: row.id, agentId: normalizeString(row.agent_id) ?? null };
    }
  }
  if (dynamic) {
    const dynamicAgentId = normalizeString(dynamic.agent_id ?? dynamic.persona_id);
    if (dynamicAgentId) {
      const dynamicCampaignId = options.campaignId ?? normalizeString(dynamic.campaign_id ?? null) ?? "";
      const dynamicCampaignLinkId = normalizeString(options.campaignLinkId ?? dynamic.campaign_link_id ?? null);
      return {
        campaignId: dynamicCampaignId,
        campaignLinkId: dynamicCampaignLinkId ?? undefined,
        personaId: normalizeString(dynamic.persona_id ?? null),
        agentId: dynamicAgentId,
        phoneNumber: null,
        linkUrl: null,
        meta: {
          campaign_name: typeof dynamic.campaign_name === "string" ? dynamic.campaign_name : undefined,
          campaign_description:
            typeof dynamic.campaign_description === "string" ? dynamic.campaign_description : undefined,
          campaign_objective:
            typeof dynamic.campaign_objective === "string" ? dynamic.campaign_objective : undefined,
          campaign_questions:
            typeof dynamic.campaign_questions === "string"
              ? JSON.parse(dynamic.campaign_questions)
              : Array.isArray(dynamic.campaign_questions)
              ? dynamic.campaign_questions.filter((entry): entry is string => typeof entry === "string")
              : undefined,
          campaign_documents:
            typeof dynamic.campaign_documents === "string"
              ? JSON.parse(dynamic.campaign_documents)
              : Array.isArray(dynamic.campaign_documents)
              ? dynamic.campaign_documents.filter((entry): entry is string => typeof entry === "string")
              : undefined,
        },
      };
    }
  }

  return null;
}

function buildDynamicVariables(details: CampaignWebhookDetails): Record<string, string> | null {
  if (!details.personaId) {
    return null;
  }
  const variables: Record<string, string> = {
    persona_id: details.personaId,
  };
  if (details.campaignId) {
    variables.campaign_id = details.campaignId;
  }
  if (details.campaignLinkId) {
    variables.campaign_link_id = details.campaignLinkId;
  }
  if (details.meta?.campaign_name) {
    variables.campaign_name = details.meta.campaign_name;
  }
  if (details.meta?.campaign_objective) {
    variables.campaign_objective = details.meta.campaign_objective;
  }
  if (details.meta?.campaign_description) {
    variables.campaign_description = details.meta.campaign_description;
  }
  if (details.meta?.campaign_questions) {
    variables.campaign_questions = JSON.stringify(details.meta.campaign_questions);
  }
  if (details.meta?.campaign_documents) {
    variables.campaign_documents = JSON.stringify(details.meta.campaign_documents);
  }
  return variables;
}

export async function POST(request: NextRequest) {
  const rawPayload = await request.text();
  console.log("[eleven-webhook] handler invoked");
  console.log("[eleven-webhook] received payload", rawPayload);
  // Signature verification temporarily disabled for testing

  let parsed: WebhookBody;
  try {
    parsed = rawPayload.length > 0 ? (JSON.parse(rawPayload) as WebhookBody) : {};
  } catch (error) {
    console.error("[eleven-webhook] failed to parse payload", { error });
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const metadata = parseMetadata(parsed.metadata ?? parsed.meta ?? null);
  console.log("[eleven-webhook] parsed metadata", metadata);
  const parsedDynamicVariables = getDynamicVariables(parsed);
  console.log("[eleven-webhook] parsed dynamic variables", parsedDynamicVariables);
  const campaignLinkId = extractCampaignLinkId(parsed, metadata, parsedDynamicVariables);
  const campaignId = extractCampaignId(parsed, metadata, parsedDynamicVariables);
  const agentId = extractAgentId(parsed, metadata, parsedDynamicVariables);
  console.log("[eleven-webhook] resolved identifiers", {
    campaignLinkId,
    campaignId,
    agentId,
  });
  const details = await resolveCampaignDetails({
    campaignLinkId,
    campaignId,
    agentId,
    dynamicVariables: parsedDynamicVariables,
  });
  if (!details) {
    console.warn("[eleven-webhook] unable to resolve campaign details", {
      campaignLinkId,
      campaignId,
      agentId,
    });
    return NextResponse.json({ error: "Unable to resolve campaign context" }, { status: 404 });
  }

  const resolvedVariables = buildDynamicVariables(details);
  console.log("[eleven-webhook] persona metadata", details.meta);
  console.log("[eleven-webhook] resolved dynamic variables", resolvedVariables);
  if (!resolvedVariables) {
    console.warn("[eleven-webhook] persona_id missing, cannot build dynamic variables");
    return NextResponse.json({ error: "Missing persona_id for campaign" }, { status: 422 });
  }

  return NextResponse.json({
    type: "conversation_initiation_client_data",
    dynamic_variables: resolvedVariables,
  });
}

export const dynamic = "force-dynamic";
