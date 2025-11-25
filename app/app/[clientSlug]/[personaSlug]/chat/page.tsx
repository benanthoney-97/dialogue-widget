import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { slugify } from "@/app/lib/jump";
import ChatPanel from "./ChatPanel";
import PersonaTopbarSlot from "./PersonaTopbarSlot";

export const dynamic = "force-dynamic";

type Supabase = SupabaseClient<any, "public", any>;

type PageParams = {
  clientSlug: string;
  personaSlug: string;
};

type AgentRow = {
  agent_id: string;
  agent_name: string | null;
  key: string | null;
  description: string | null;
  content_type: string | null;
  dialogue_created_date: string | null;
  status: string | null;
  key_traits: unknown;
  key_pain_points: unknown;
  intent_signals: unknown;
  age: string | number | null;
  gender: string | null;
  location: string | null;
  customer_status: string | null;
  profile_image: string | null;
  active_status: boolean | null;
};

type PersonaDetails = {
  agentId: string;
  slug: string;
  name: string;
  description: string | null;
  contentType: string | null;
  updatedAt: string | null;
  keyTraits: string[];
  painPoints: string[];
  intentSignals: string[];
  customerStatus: string | null;
  profileImage: string | null;
};

type PersonaPreview = {
  id: string;
  slug: string;
  name: string;
  profileImage: string | null;
  href?: string;
};

type ClientRow = {
  id: number;
  name: string;
  display_name: string | null;
};

type ClientLookup = {
  clientId: number;
  displayName: string | null;
};

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const { clientSlug, personaSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialPromptRaw = resolvedSearchParams?.prompt;
  const initialPrompt = Array.isArray(initialPromptRaw)
    ? initialPromptRaw[0] ?? ""
    : initialPromptRaw ?? "";
  const initialMessage = initialPrompt.trim().length > 0 ? initialPrompt.trim() : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          color: "#b91c1c",
        }}
      >
        Supabase environment variables are not configured. The chat experience cannot load yet.
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey) as Supabase;

  const clientInfo = await resolveClientBySlug(supabase, clientSlug);
  if (!clientInfo) {
    notFound();
  }

  const persona = await fetchPersonaBySlug(supabase, clientInfo.clientId, personaSlug);
  if (!persona) {
    notFound();
  }

  const otherPersonasRaw = await fetchOtherPersonaSummaries(
    supabase,
    clientInfo.clientId,
    persona.agentId
  );
  const otherPersonas = otherPersonasRaw.map((otherPersona) => ({
    ...otherPersona,
    href: `/app/${clientSlug}/${otherPersona.slug}`,
  }));

  return (
    <div
      style={{
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        minHeight: 0,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "0 24px",
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <PersonaTopbarSlot
          personaName={persona.name}
          profileImage={persona.profileImage}
          personaHref={`/app/${clientSlug}/${persona.slug}`}
          otherPersonas={otherPersonas}
        />
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
            alignItems: "stretch",
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 auto",
              minHeight: 0,
            }}
          >
            <ChatPanel
              agentId={persona.agentId}
              personaName={persona.name}
              personaKeyTraits={persona.keyTraits}
              personaIntentSignals={persona.intentSignals}
              personaCustomerStatus={persona.customerStatus}
              personaKeyPainPoints={persona.painPoints}
              initialMessage={initialMessage ?? undefined}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

async function resolveClientBySlug(
  supabase: Supabase,
  clientSlug: string
): Promise<ClientLookup | null> {
  const trimmed = clientSlug.trim();
  if (trimmed.length === 36 && /^[0-9a-fA-F-]{36}$/.test(trimmed)) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, display_name")
      .eq("id", trimmed)
      .maybeSingle<ClientRow>();
    if (data) return { clientId: data.id, displayName: data.display_name };
  }

  const direct = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("name", clientSlug)
    .maybeSingle<ClientRow>();

  if (direct.data) {
    return { clientId: direct.data.id, displayName: direct.data.display_name };
  }

  const { data } = await supabase.from("clients").select("id, name, display_name");
  if (!data) return null;

  const match = data.find((client) => {
    const nameSlug = client.name ? slugify(client.name) : "";
    const displaySlug = client.display_name ? slugify(client.display_name) : "";
    return nameSlug === clientSlug || displaySlug === clientSlug;
  });

  if (!match) return null;

  return { clientId: match.id, displayName: match.display_name };
}

async function fetchPersonaBySlug(
  supabase: Supabase,
  clientId: number,
  personaSlug: string
): Promise<PersonaDetails | null> {
  console.log("[chat] fetchPersonaBySlug start", { clientId, personaSlug });
  const columns =
    "agent_id, agent_name, key, description, dialogue_created_date, status, key_traits, key_pain_points, customer_status, profile_image, active_status";
  const direct = await supabase
    .from("agent_map")
    .select(columns)
    .eq("client_id", clientId)
    .eq("key", personaSlug)
    .maybeSingle<AgentRow>();

  if (direct.data && direct.data.active_status && (direct.data.status ?? "").toLowerCase() === "ready") {
    console.log("[chat] persona direct match", { personaSlug, agentId: direct.data.agent_id });
    return mapAgentRowToPersona(direct.data);
  }

  console.log("[chat] fetchPersonaBySlug fallback query", {
    clientId,
    personaSlug,
    select: columns,
  });
  const { data } = await supabase
    .from("agent_map")
    .select(
    columns
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .returns<AgentRow[]>();

  if (!data) {
    return null;
  }

  const slugCounts = new Map<string, number>();
  for (const row of data) {
    if ((row.status ?? "").toLowerCase() !== "ready" || !row.active_status) continue;
    const baseSlug = buildPersonaSlug(row);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const candidate = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    if (candidate === personaSlug) {
      console.log("[chat] persona fallback match", { personaSlug, agentId: row.agent_id });
      return mapAgentRowToPersona(row);
    }
  }

  console.log("[chat] persona slug fallback not matched", { personaSlug });
  return null;
}

function buildPersonaSlug(row: AgentRow): string {
  const keySlug = row.key?.trim();
  if (keySlug && keySlug.length > 0) {
    return slugify(keySlug);
  }
  const name = row.agent_name?.trim();
  if (name && name.length > 0) {
    return slugify(name);
  }
  return slugify(row.agent_id);
}

function mapAgentRowToPersona(row: AgentRow): PersonaDetails {
  const traits = Array.isArray(row.key_traits) ? row.key_traits.filter((item): item is string => Boolean(item?.toString())) : [];
  const pains = Array.isArray(row.key_pain_points) ? row.key_pain_points.filter((item): item is string => Boolean(item?.toString())) : [];
  const signals = Array.isArray(row.intent_signals) ? row.intent_signals.filter((item): item is string => Boolean(item?.toString())) : [];
  return {
    agentId: row.agent_id,
    slug: row.key ?? buildPersonaSlug(row),
    name: row.agent_name?.trim() || "Persona",
    description: row.description,
    contentType: row.content_type?.trim() || null,
    updatedAt: row.dialogue_created_date,
    keyTraits: traits,
    painPoints: pains,
    intentSignals: signals,
    customerStatus: typeof row.customer_status === "string" && row.customer_status.trim().length > 0 ? row.customer_status.trim() : null,
    profileImage: typeof row.profile_image === "string" && row.profile_image.trim().length > 0 ? row.profile_image.trim() : null,
  };
}

async function fetchOtherPersonaSummaries(
  supabase: Supabase,
  clientId: number,
  excludeAgentId: string
): Promise<PersonaPreview[]> {
  const { data, error } = await supabase
    .from("agent_map")
    .select("agent_id, agent_name, profile_image, status, key")
    .eq("client_id", clientId);

  if (error) {
    return [];
  }

  return (data ?? [])
    .filter((row) => (row.status ?? "").toLowerCase() === "ready")
    .filter((row) => row.agent_id !== excludeAgentId)
    .map((row) => ({
      id: row.agent_id,
      slug: buildPersonaSlug({
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        key: row.key ?? null,
        description: null,
        content_type: null,
        dialogue_created_date: null,
        status: row.status,
        key_traits: null,
        key_pain_points: null,
        intent_signals: null,
        age: null,
        gender: null,
        location: null,
        customer_status: null,
        profile_image: row.profile_image,
        active_status: row.status?.toLowerCase() === "ready" ? true : null,
      }),
      name: row.agent_name?.trim() || "Untitled persona",
      profileImage:
        typeof row.profile_image === "string" && row.profile_image.trim().length > 0
          ? row.profile_image.trim()
          : null,
    }));
}

function normalizeList(source: unknown): string[] {
  if (Array.isArray(source)) {
    return source
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  }
  if (typeof source === "string") {
    return source
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  return [];
}
