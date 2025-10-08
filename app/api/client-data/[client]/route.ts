import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { clientMap } from "@/app/lib/clientMap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data", "client-conversations");

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ client: string }> }
) {
  const params = await context.params;
  const clientSlug = params.client;
  if (!clientSlug || !clientMap[clientSlug]) {
    return NextResponse.json(
      { error: "Unknown client slug", client: clientSlug },
      { status: 404 }
    );
  }

  try {
    const filePath = path.join(DATA_DIR, `${clientSlug}.json`);
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json(
        { client: clientSlug, conversations: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    console.error("Failed to load client conversation data", error);
    return NextResponse.json(
      { error: "Failed to load client conversation data" },
      { status: 500 }
    );
  }
}
