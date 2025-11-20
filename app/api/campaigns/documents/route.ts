import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const CAMPAIGN_DOCUMENTS_BUCKET = "campaign_documents";

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

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }
  const mimeType = match[1] || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, mimeType };
}

type IncomingDoc = {
  temp_id: string;
  agent_name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  lastModified: number;
  groupTempId: string;
};

type Payload = {
  campaignId?: string;
  docs?: IncomingDoc[];
};

type PublicUrlResponse = {
  publicUrl?: string | null;
  publicURL?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Payload;
    const campaignId = body.campaignId?.trim();
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaign identifier" }, { status: 400 });
    }

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, client_id, created_by")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError) {
      console.error("[campaign_documents] failed to load campaign", campaignError);
      return NextResponse.json({ error: "Unable to resolve campaign" }, { status: 500 });
    }

    if (!campaign || !campaign.client_id) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const clientId = campaign.client_id;
    const docsArray = Array.isArray(body.docs) ? body.docs : [];
    if (docsArray.length === 0) {
      return NextResponse.json({ stored: 0 });
    }

    const storedDocs: Array<{
      fileName: string;
      storagePath: string;
      publicUrl: string;
      mimeType: string;
      fileSize: number;
      source: string;
    }> = [];

    for (const doc of docsArray) {
      if (!doc || !doc.dataUrl) continue;
      const isExternalUrl = doc.fileType === "text/url" && /^https?:\/\//i.test(doc.dataUrl);
      if (isExternalUrl) {
        continue; // external URLs are not persisted in storage
      }
      if (!doc.dataUrl.startsWith("data:")) {
        console.warn("[campaign_documents] skipping doc without data URL", doc.fileName);
        continue;
      }

      const { buffer, mimeType } = decodeDataUrl(doc.dataUrl);
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
      const publicUrlRecord = publicUrlData as PublicUrlResponse | null;
      const publicUrl =
        publicUrlRecord?.publicUrl ??
        publicUrlRecord?.publicURL ??
        buildStoragePublicUrl(CAMPAIGN_DOCUMENTS_BUCKET, storagePath);

      storedDocs.push({
        fileName: normalizedFileName,
        storagePath,
        publicUrl,
        mimeType,
        fileSize: doc.fileSize ?? buffer.byteLength,
        source: "storage",
      });
    }

    if (storedDocs.length > 0) {
      const insertPayload = storedDocs.map((doc) => ({
        campaign_id: campaignId,
        file_name: doc.fileName,
        storage_path: doc.storagePath,
        mime_type: doc.mimeType,
        file_size: doc.fileSize,
        source: doc.source,
        created_by: campaign?.created_by ?? null,
      }));
      const { error: insertError } = await supabaseAdmin
        .from("campaign_documents")
        .insert(insertPayload);
      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    return NextResponse.json({ stored: storedDocs.length, documents: storedDocs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[campaign_documents] upload failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
