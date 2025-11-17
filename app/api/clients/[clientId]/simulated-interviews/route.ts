import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

export async function GET(request: Request, context: { params: { clientId: string } }) {
  const { params } = context;
  const clientId = params.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }
  if (!supabaseUrl || !supabaseServiceRole) {
    return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("simulated_interviews")
    .select(
      "id,agent_id,interview_type,status,run_at,transcript,idea:development_ideas(call_summary_title),agent:agent_map(agent_name)"
    )
    .eq("client_id", clientId)
    .order("run_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ interviews: data ?? [] });
}

export const dynamic = "force-dynamic";
