// app/api/moblog/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge"; // or "nodejs" if you prefer

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { level = "info", msg = "", meta = {} } = body || {};
    // These appear in Vercel function logs
    console.log(`[mobile-log] ${level.toUpperCase()}: ${msg}`, meta);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}