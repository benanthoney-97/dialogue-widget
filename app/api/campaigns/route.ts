import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const CAMPAIGN_DOCUMENTS_BUCKET = "campaign_documents";
const CAMPAIGN_QR_BUCKET = "campaign_qrcodes";

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStoragePublicUrl(bucket: string, path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function buildDubQrEndpoint(targetUrl: string): string {
  const qrUrl = new URL("https://api.dub.co/qr");
  qrUrl.searchParams.set("size", "600");
  qrUrl.searchParams.set("level", "L");
  qrUrl.searchParams.set("fgColor", "#000000");
  qrUrl.searchParams.set("bgColor", "#FFFFFF");
  qrUrl.searchParams.set("hideLogo", "true");
  qrUrl.searchParams.set("margin", "2");
  qrUrl.searchParams.set("includeMargin", "true");
  qrUrl.searchParams.set("url", targetUrl);
  return qrUrl.toString();
}

async function generateQrCodeBase64(url: string): Promise<string | null> {
  const apiKey = process.env.DUB_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[campaigns] DUB_API_KEY missing, skipping QR generation");
    return null;
  }
  const endpoint = buildDubQrEndpoint(url);
  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Dub QR fetch failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[campaigns] dub qr result length", buffer.length);
    console.log("[campaigns] qr header bytes", Array.from(buffer.slice(0, 8)));
    return buffer.toString("base64");
  } catch (error) {
    console.error("[campaigns] failed to generate QR code", { url, error });
    return null;
  }
}

async function uploadQrCodeImage(
  clientId: string,
  campaignId: string,
  linkId: string,
  base64: string
): Promise<string | null> {
  if (!base64) {
    return null;
  }
  const buffer = Buffer.from(base64, "base64");
  const normalizedClient = clientId.trim();
  const storagePath = `clients/${normalizedClient}/campaigns/${campaignId}/${linkId}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(CAMPAIGN_QR_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  if (uploadError) {
    console.error("[campaigns] failed to upload QR code image", { campaignId, linkId, error: uploadError });
    return null;
  }
  const { data: publicUrlData } = await supabaseAdmin.storage
    .from(CAMPAIGN_QR_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrlRecord = publicUrlData as { publicUrl?: string | null; publicURL?: string | null } | null;
  return (
    publicUrlRecord?.publicUrl ??
    publicUrlRecord?.publicURL ??
    buildStoragePublicUrl(CAMPAIGN_QR_BUCKET, storagePath)
  );
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const mimeType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType };
}

type CampaignCreationPayload = {
  clientId?: string | number | null;
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  questions?: unknown;
  clientSlug?: string | null;
  outputs?: unknown;
  personaIds?: unknown;
  createdBy?: string | null;
  documentIds?: unknown;
  personaImageUpload?: PersonaImageUploadPayload | null;
  documentsUpload?: unknown;
};

type PersonaImageUploadPayload = {
  fileName?: string | null;
  dataUrl?: string | null;
  mimeType?: string | null;
};

type PrimitiveOutputType = "string" | "boolean" | "number";
type CampaignOutput = {
  type: PrimitiveOutputType;
  description: string;
};

const OUTPUT_TYPE_SYNONYMS: Record<string, PrimitiveOutputType> = {
  string: "string",
  text: "string",
  boolean: "boolean",
  bool: "boolean",
  yesno: "boolean",
  "yes/no": "boolean",
  number: "number",
  numeric: "number",
};

type NormalizedCampaignDocument = {
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  dataUrl: string;
};

type CampaignDocumentInsertRow = {
  campaign_id: string;
  file_name: string;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  source: string | null;
  created_by: string | null;
  agent_id?: string;
};

type CampaignLinkInsertRow = {
  id: string;
  campaign_id: string;
  persona_id: string | null;
  link_url?: string | null;
  qr_code?: string | null;
  qr_code_image?: string | null;
};

function isAgentIdConstraintError(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  if (!normalized.includes("agent_id")) {
    return false;
  }
  return normalized.includes("foreign key") || normalized.includes("violates") || normalized.includes("constraint");
}

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

function extractInsertedIds(rows: Array<{ id?: string | number | null }> | null): string[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      if (!row) {
        return null;
      }
      if (typeof row.id === "string") {
        return row.id;
      }
      if (typeof row.id === "number") {
        return row.id.toString();
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
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

function normalizeOutputType(value: unknown): PrimitiveOutputType {
  if (typeof value !== "string") {
    return "string";
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "string";
  }
  return OUTPUT_TYPE_SYNONYMS[normalized] ?? "string";
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
    const type = normalizeOutputType(extractStringField(item, "type"));
    acc.push({ type, description });
    return acc;
  }, []);
}

function normalizePersonaImagePayload(value: unknown): PersonaImageUploadPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const dataUrl = extractStringField(value, "dataUrl");
  if (!dataUrl) {
    return null;
  }
  const fileName = extractStringField(value, "fileName");
  const mimeType = extractStringField(value, "mimeType");
  return {
    fileName,
    dataUrl,
    mimeType,
  };
}

async function uploadPersonaImageToStorage(
  clientId: string,
  campaignId: string,
  payload: PersonaImageUploadPayload
): Promise<string | null> {
  if (!payload?.dataUrl) {
    return null;
  }
  const trimmedDataUrl = payload.dataUrl.trim();
  if (!trimmedDataUrl.startsWith("data:")) {
    throw new Error("Persona image must be provided as a data URL");
  }
  const { buffer, mimeType: derivedMime } = decodeDataUrl(trimmedDataUrl);
  const mimeType = payload.mimeType?.trim() || derivedMime || "image/png";
  const baseFileName = payload.fileName?.trim() || `persona-${campaignId}-${randomUUID()}`;
  const sanitizedBase = safeFileName(baseFileName);
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(sanitizedBase);
  const extension = hasExtension
    ? ""
    : (() => {
        const ext = mimeType.split("/").pop();
        return ext ? `.${ext}` : ".png";
      })();
  const finalFileName = hasExtension ? sanitizedBase : safeFileName(`${sanitizedBase}${extension}`);
  const storagePath = `clients/${clientId}/campaigns/${campaignId}/${finalFileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CAMPAIGN_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = await supabaseAdmin.storage
    .from(CAMPAIGN_DOCUMENTS_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrlRecord = publicUrlData as { publicUrl?: string | null; publicURL?: string | null } | null;

  return (
    publicUrlRecord?.publicUrl ??
    publicUrlRecord?.publicURL ??
    buildStoragePublicUrl(CAMPAIGN_DOCUMENTS_BUCKET, storagePath)
  );
}

function normalizeDocumentUploads(value: unknown): NormalizedCampaignDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<NormalizedCampaignDocument[]>((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }
    const dataUrl = extractStringField(item, "dataUrl");
    if (!dataUrl) {
      return acc;
    }
    const fileName = extractStringField(item, "fileName");
    const fileType = extractStringField(item, "fileType");
    const rawSize = (item as Record<string, unknown>).fileSize;
    const fileSize =
      typeof rawSize === "number" && Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null;

    acc.push({
      fileName,
      fileType,
      fileSize,
      dataUrl,
    });
    return acc;
  }, []);
}

function isExternalDocument(doc: NormalizedCampaignDocument): boolean {
  if (!doc.fileType || !doc.dataUrl) {
    return false;
  }
  return doc.fileType.toLowerCase() === "text/url" && /^https?:\/\//i.test(doc.dataUrl.trim());
}

async function persistCampaignDocuments(
  clientId: string,
  campaignId: string,
  documents: NormalizedCampaignDocument[],
  createdBy: string | null,
  agentId: string
): Promise<{ storedAgentId: boolean; documentIds: string[] }> {
  if (!Array.isArray(documents) || documents.length === 0) {
    return { storedAgentId: true, documentIds: [] };
  }

  const insertPayload: CampaignDocumentInsertRow[] = [];

  for (const doc of documents) {
    const trimmedDataUrl = doc.dataUrl?.trim();
    if (!trimmedDataUrl) {
      continue;
    }
    if (isExternalDocument(doc)) {
      const publicUrl = trimmedDataUrl;
      insertPayload.push({
        campaign_id: campaignId,
        file_name: doc.fileName?.trim() || safeFileName(`link-${randomUUID()}`),
        storage_path: trimmedDataUrl,
        public_url: publicUrl,
        mime_type: doc.fileType ?? "text/uri-list",
        file_size: doc.fileSize ?? null,
        source: "external",
        created_by: createdBy,
        agent_id: agentId,
      });
      continue;
    }
    if (!trimmedDataUrl.startsWith("data:")) {
      console.warn("[campaigns] skipping campaign document without data URL", doc.fileName);
      continue;
    }
    const { buffer, mimeType } = decodeDataUrl(trimmedDataUrl);
    const normalizedFileName = doc.fileName?.trim().length
      ? safeFileName(doc.fileName.trim())
      : safeFileName(`file-${randomUUID()}`);
    const storagePath = `clients/${clientId}/campaigns/${campaignId}/${normalizedFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(CAMPAIGN_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = await supabaseAdmin.storage
      .from(CAMPAIGN_DOCUMENTS_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrlRecord = publicUrlData as { publicUrl?: string | null; publicURL?: string | null } | null;
    const publicUrl =
      publicUrlRecord?.publicUrl ??
      publicUrlRecord?.publicURL ??
      buildStoragePublicUrl(CAMPAIGN_DOCUMENTS_BUCKET, storagePath);

    insertPayload.push({
      campaign_id: campaignId,
      file_name: normalizedFileName,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: mimeType,
      file_size: doc.fileSize ?? buffer.byteLength,
      source: "storage",
      created_by: createdBy,
      agent_id: agentId,
    });
  }

  if (insertPayload.length === 0) {
    return { storedAgentId: true, documentIds: [] };
  }

  const { data: insertResult, error: insertError } = await supabaseAdmin
    .from("campaign_documents")
    .insert(insertPayload)
    .select("id");
  if (insertError) {
    if (agentId && isAgentIdConstraintError(insertError.message)) {
      console.warn("[campaigns] campaign_documents insert blocked by agent_id constraint, retrying without agent linkage", {
        campaignId,
        clientId,
        agentId,
        message: insertError.message,
      });
      const fallbackPayload = insertPayload.map((doc) => {
        const docWithoutAgentId = { ...doc };
        delete docWithoutAgentId.agent_id;
        return docWithoutAgentId;
      });
      const { data: fallbackResult, error: retryError } = await supabaseAdmin
        .from("campaign_documents")
        .insert(fallbackPayload)
        .select("id");
      if (retryError) {
        throw new Error(retryError.message);
      }
      return { storedAgentId: false, documentIds: extractInsertedIds(fallbackResult ?? null) };
    }
    throw new Error(insertError.message);
  }

  return { storedAgentId: true, documentIds: extractInsertedIds(insertResult ?? null) };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CampaignCreationPayload;
    console.log("[campaigns] POST received", {
      clientId: body.clientId,
      name: body.name,
      personaIdsCount: Array.isArray(body.personaIds) ? body.personaIds.length : 0,
      questionsCount: Array.isArray(body.questions) ? body.questions.length : 0,
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
    const initialDocumentIds = uniqueStrings(normalizeStringArray(body.documentIds));
    const documentsUploadPayload = normalizeDocumentUploads(body.documentsUpload);
    const personaImagePayload = normalizePersonaImagePayload(body.personaImageUpload);
    const createdBy = typeof body.createdBy === "string" && body.createdBy.trim().length > 0
      ? body.createdBy.trim()
      : null;
    const agentId = randomUUID();
    const campaignId = randomUUID();
    let personaImageUrl: string | null = null;
    if (personaImagePayload) {
      try {
        personaImageUrl = await uploadPersonaImageToStorage(clientId, campaignId, personaImagePayload);
      } catch (imageUploadError) {
        console.error("[campaigns] persona image upload failed", imageUploadError);
        throw imageUploadError instanceof Error ? imageUploadError : new Error("Persona image upload failed");
      }
    }

    const insertPayload = {
      id: campaignId,
      name,
      description: description.length > 0 ? description : null,
      objective: objective.length > 0 ? objective : null,
      questions: questionPayload,
      outputs: outputsPayload,
      client_id: clientId,
      persona_ids: personaIdsPayload,
      created_by: createdBy,
      document_ids: initialDocumentIds,
      agent_id: agentId,
      image_url: personaImageUrl,
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

    let persistedAgentLink = true;
    let uploadedDocumentIds: string[] = [];
    try {
      const { storedAgentId, documentIds: newDocumentIds } = await persistCampaignDocuments(
        clientId,
        campaignId,
        documentsUploadPayload,
        createdBy,
        agentId
      );
      persistedAgentLink = storedAgentId;
      uploadedDocumentIds = newDocumentIds;
    } catch (documentsError) {
      console.error("[campaigns] document upload failed", documentsError);
      await supabaseAdmin.from("campaigns").delete().eq("id", campaignId);
      throw documentsError;
    }

    if (!persistedAgentLink) {
      console.warn("[campaigns] campaign documents stored without agent linkage", {
        campaignId,
        agentId,
      });
    }

    if (uploadedDocumentIds.length > 0) {
      const combinedDocumentIds = uniqueStrings([...initialDocumentIds, ...uploadedDocumentIds]);
      try {
        const { error: documentIdsUpdateError } = await supabaseAdmin
          .from("campaigns")
          .update({ document_ids: combinedDocumentIds })
          .eq("id", campaignId);
        if (documentIdsUpdateError) {
          throw documentIdsUpdateError;
        }
      } catch (documentIdsUpdateError) {
        console.error("[campaigns] failed to update campaign document_ids", documentIdsUpdateError);
        await supabaseAdmin.from("campaigns").delete().eq("id", campaignId);
        throw documentIdsUpdateError;
      }
    }

    const shareSlugRaw =
      typeof body.clientSlug === "string" ? body.clientSlug.trim() : "";
    const shareSlug = shareSlugRaw.length > 0 ? shareSlugRaw : null;
    const shareBaseUrl =
      typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
        ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "")
        : "";
    const requestOrigin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return null;
      }
    })();
    const shareOrigin = shareSlug
      ? shareBaseUrl || requestOrigin
      : null;
    if (personaIdsPayload.length > 0) {
      const personaLinkRows: CampaignLinkInsertRow[] = [];
      for (const personaId of personaIdsPayload) {
        const linkId = randomUUID();
        const sharePath = shareSlug ? `/campaign/${shareSlug}/${linkId}` : null;
        const absoluteShareUrl =
          sharePath && shareOrigin ? `${shareOrigin}${sharePath}` : null;
        const qrCodeBase64 = absoluteShareUrl
          ? await generateQrCodeBase64(absoluteShareUrl)
          : null;
        const qrCodeImage =
          qrCodeBase64 && clientId
            ? await uploadQrCodeImage(clientId, campaignId, linkId, qrCodeBase64)
            : null;
        personaLinkRows.push({
          id: linkId,
          campaign_id: campaignId,
          persona_id: personaId,
          link_url: absoluteShareUrl ?? sharePath ?? null,
        qr_code_image: qrCodeImage,
      });
      }
      const { error: campaignLinkError } = await supabaseAdmin
        .from("campaign_links")
        .insert(personaLinkRows);
      if (campaignLinkError) {
        console.error(
          "[campaigns] failed to insert campaign_links rows",
          campaignLinkError,
          { campaignId, personaIds: personaIdsPayload, shareSlug }
        );
      }
    }

    console.log("[campaigns] created campaign", { campaignId, agentId, clientId });
    return NextResponse.json({ id: campaignId, agentId, imageUrl: personaImageUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[campaigns] create route failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
