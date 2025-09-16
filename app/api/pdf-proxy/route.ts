import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return NextResponse.json({ error: "Missing ?url=" }, { status: 400 });
    }

    // Fetch the remote PDF
    const upstream = await fetch(url, {
      // credentials: "omit" // usually omit; set include if you truly need cookies
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    // Stream it back with same-origin headers
    const res = new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/pdf",
        "cache-control": "public, max-age=300",
      },
    });
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 }
    );
  }
}