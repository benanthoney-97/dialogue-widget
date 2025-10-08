import { NextRequest, NextResponse } from "next/server";
import { clientMap } from "@/app/lib/clientMap";
import { getClientKnowledge } from "@/app/lib/clientKnowledgeStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const payload = getClientKnowledge(clientSlug);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
