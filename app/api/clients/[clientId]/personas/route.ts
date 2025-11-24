import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/app/lib/jump";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AgentMapRow = {
  agent_id?: string | null;
  agent_name?: string | null;
  work_label?: string | null;
  talk_label?: string | null;
  background_image?: string | null;
  profile_image?: string | null;
  key?: string | null;
  role_title?: string | null;
};

async function resolveClientId(param: string): Promise<string | null> {
  if (!param) {
    return null;
  }
  if (uuidRegex.test(param)) {
    return param;
  }
  const normalized = param.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, display_name")
    .limit(2000);
  if (error || !data) {
    return null;
  }
  const match = data.find((client) => {
    if (!client) return false;
    const name = client.name?.toLowerCase();
    const display = client.display_name?.toLowerCase();
    if (name === normalized || display === normalized) {
      return true;
    }
    const slugCandidates = [client.name, client.display_name]
      .filter((value): value is string => Boolean(value))
      .map((value) => slugify(value));
    return slugCandidates.includes(normalized);
  });
  return match?.id ?? null;
}

function mapAgentRowToPersona(row: AgentMapRow, index: number) {
  const identity = row.agent_id ?? row.key ?? (row.agent_name ? slugify(row.agent_name) : `persona-${index}`);
  return {
    id: identity,
    name: row.agent_name ?? row.key ?? `Persona ${index + 1}`,
    title: row.work_label ?? row.talk_label ?? row.role_title ?? "Persona",
    image: row.background_image ?? row.profile_image ?? null,
    agentId: row.agent_id ?? row.key ?? null,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> }
) {
  const { clientId: clientParam } = await context.params;
  if (!clientParam) {
    return NextResponse.json({ error: "Client identifier missing" }, { status: 400 });
  }
  const resolvedClientId = await resolveClientId(clientParam);
  if (!resolvedClientId) {
    return NextResponse.json(
      { clientId: null, personas: [] },
      { status: 404 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("agent_map")
    .select("agent_id, agent_name, work_label, talk_label, background_image, profile_image, key, role_title")
    .eq("client_id", resolvedClientId)
    .order("agent_name", { ascending: true });
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  const personas = (data ?? [])
    .map((row, index) => mapAgentRowToPersona(row, index))
    .filter((persona) => Boolean(persona.id));
  return NextResponse.json({ clientId: resolvedClientId, personas });
}
