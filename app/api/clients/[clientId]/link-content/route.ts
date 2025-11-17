import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function getExtensionFromMime(mimeType: string | null | undefined): string {
  if (!mimeType) return "txt";
  const candidate = mimeType.split(";")[0];
  const parts = candidate.split("/");
  if (parts.length === 2 && parts[1]) {
    return parts[1].split("+")[0];
  }
  return "txt";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId?: string }> }
) {
  const { clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: "Missing workspace identifier" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = (payload ?? {}) as {
    url?: unknown;
    agentId?: unknown;
    title?: unknown;
  };

  const urlValue = typeof body.url === "string" ? body.url.trim() : "";
  if (!urlValue) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlValue);
  } catch (error) {
    return NextResponse.json({ error: "URL is not valid" }, { status: 400 });
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return NextResponse.json({ error: "Only http(s) URLs are allowed" }, { status: 400 });
  }

  const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const fetchResponse = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "DialogueWidgetBot/1.0",
      Accept: "text/html, text/plain, */*",
    },
    redirect: "follow",
  });

  if (!fetchResponse.ok) {
    return NextResponse.json({ error: `Failed to download URL (${fetchResponse.status})` }, { status: 502 });
  }

  const arrayBuffer = await fetchResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = fetchResponse.headers.get("content-type") ?? "text/plain";
  const extension = getExtensionFromMime(mimeType);
  const titleCandidate = typeof body.title === "string" && body.title.trim().length > 0
    ? safeFileName(body.title.trim())
    : safeFileName(parsedUrl.hostname ?? "link-content");
  const fileName = `${titleCandidate}-${Date.now()}.${extension}`;
  const storagePath = `clients/${clientId}/${agentId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("docs")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = await supabaseAdmin.storage
    .from("docs")
    .getPublicUrl(storagePath);

  const publicUrl =
    (publicUrlData as any)?.publicUrl ??
    (publicUrlData as any)?.publicURL ??
    `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/docs/${encodeURIComponent(storagePath)}`;

  const { error: docInsertError } = await supabaseAdmin.from("agent_documents").insert({
    agent_id: agentId,
    file_name: fileName,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: mimeType,
    file_size: buffer.byteLength,
    source: "link",
  });

  if (docInsertError) {
    return NextResponse.json({ error: docInsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, fileName, publicUrl });
}
