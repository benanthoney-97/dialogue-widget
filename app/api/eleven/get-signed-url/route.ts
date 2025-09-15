// app/api/eleven/get-signed-url/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");
  if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });

  const r = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": key } }
  );

  if (!r.ok) {
    const t = await r.text();
    return NextResponse.json({ error: `Failed to get signed URL: ${t}` }, { status: 500 });
  }

  const data = await r.json(); // { signed_url } or { signedUrl }
  const signedUrl = data.signed_url || data.signedUrl;
  return NextResponse.json({ signedUrl });
}