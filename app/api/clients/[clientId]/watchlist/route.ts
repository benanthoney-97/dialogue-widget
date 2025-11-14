import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId?: string }> }
) {
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json({ error: "Missing workspace identifier" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 });
  }

  let body: { agentId?: string; query?: string | null } | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.agentId) {
    return NextResponse.json({ error: "Missing agent identifier" }, { status: 400 });
  }

  const agentId = body.agentId;
  const requestedQuery =
    typeof body.query === "string" && body.query.trim().length > 0 ? body.query.trim() : null;

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle<{ id: string }>();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: agentRow, error: agentError } = await supabaseAdmin
      .from("agent_map")
      .select("agent_id")
      .eq("client_id", clientRow.id)
      .eq("agent_id", agentId)
      .maybeSingle<{ agent_id: string }>();

    if (agentError || !agentRow) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const targetRow = { agent_id: agentId, query: requestedQuery, client_id: clientRow.id };
    let upsertResult = await supabaseAdmin
      .from("persona_watchlist")
      .upsert(targetRow, { onConflict: "agent_id" });

    if (
      upsertResult.error &&
      (upsertResult.error.message?.includes("column \"client_id\"") ||
        upsertResult.error.message?.includes("client_id"))
    ) {
      upsertResult = await supabaseAdmin
        .from("persona_watchlist")
      .upsert({ agent_id: agentId, query: requestedQuery }, { onConflict: "agent_id" });
    }

    if (upsertResult.error) {
      console.error("[AgentResearch] Failed to update watchlist prompt", upsertResult.error);
      return NextResponse.json(
        { error: "Unable to update research prompt" },
        { status: 500 }
      );
    }
    const savedQuery = upsertResult.data?.[0]?.query ?? requestedQuery;

    return NextResponse.json({ success: true, query: savedQuery });
  } catch (error) {
    console.error("[AgentResearch] Unexpected error updating watchlist prompt", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
