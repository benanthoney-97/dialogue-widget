import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type CampaignCreationPayload = {
  clientId?: string | number | null;
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  questions?: unknown;
  outputs?: unknown;
  personaIds?: unknown;
  createdBy?: string | null;
  documentIds?: unknown;
};

type CampaignOutput = {
  type: string;
  description: string;
};

function normalizeClientId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<string[]>((acc, item) => {
    if (typeof item !== "string") {
      return acc;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      return acc;
    }
    acc.push(trimmed);
    return acc;
  }, []);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function extractStringField(source: unknown, key: string): string | null {
  if (!source || typeof source !== "object") {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOutputs(value: unknown): CampaignOutput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<CampaignOutput[]>((acc, item) => {
    const description = extractStringField(item, "description");
    if (!description) {
      return acc;
    }
    const type = extractStringField(item, "type") ?? "text";
    acc.push({ type, description });
    return acc;
  }, []);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CampaignCreationPayload;
    console.log("[campaigns] POST received", {
      clientId: body.clientId,
      name: body.name,
      personaIdsCount: Array.isArray(body.personaIds) ? body.personaIds.length : 0,
      outputsCount: Array.isArray(body.outputs) ? body.outputs.length : 0,
      documentIdsCount: Array.isArray(body.documentIds) ? body.documentIds.length : 0,
    });
    const clientId = normalizeClientId(body.clientId);
    if (!clientId) {
      return NextResponse.json({ error: "Missing client identifier" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";
    const objective = typeof body.objective === "string" ? body.objective.trim() : "";
    const questionPayload = normalizeStringArray(body.questions);
    const outputsPayload = normalizeOutputs(body.outputs);
    const personaIdsPayload = uniqueStrings(normalizeStringArray(body.personaIds));
    const documentIdsPayload = uniqueStrings(normalizeStringArray(body.documentIds));
    const createdBy = typeof body.createdBy === "string" && body.createdBy.trim().length > 0
      ? body.createdBy.trim()
      : null;

    const insertPayload = {
      name,
      description: description.length > 0 ? description : null,
      objective: objective.length > 0 ? objective : null,
      questions: questionPayload,
      outputs: outputsPayload,
      client_id: clientId,
      persona_ids: personaIdsPayload,
      created_by: createdBy,
      document_ids: documentIdsPayload,
    };

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[campaigns] failed to create campaign", error);
      throw error;
    }

    if (!data?.id) {
      console.error("[campaigns] campaign ID missing after insert");
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }

    console.log("[campaigns] created campaign", { campaignId: data.id, clientId });
    return NextResponse.json({ id: data.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[campaigns] create route failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
