import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { slugify } from "@/app/lib/jump";
import InterviewPanel from "./InterviewPanel";
import PersonaTopbarSlot from "../chat/PersonaTopbarSlot";

export const dynamic = "force-dynamic";

type Supabase = SupabaseClient<any, "public", any>;

type PageParams = {
  clientSlug: string;
  personaSlug: string;
};

type AgentRow = {
  agent_id: string;
  agent_name: string | null;
  description: string | null;
  content_type: string | null;
  dialogue_created_date: string | null;
  status: string | null;
  key_traits: unknown;
  key_pain_points: unknown;
  age: string | number | null;
  gender: string | null;
  location: string | null;
  customer_status: string | null;
  profile_image: string | null;
  talk_label: string | null;
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
  attributes: Array<{ label: string; value: string }>;
  profileImage: string | null;
  talkLabel: string | null;
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

export default async function InterviewPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { clientSlug, personaSlug } = await params;
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
        Supabase environment variables are not configured. The interview experience cannot load yet.
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
    persona.agentId,
  );
  const otherPersonas = otherPersonasRaw.map((otherPersona) => ({
    ...otherPersona,
    href: `/app/${clientSlug}/${otherPersona.slug}`,
  }));

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "#0f172a",
        paddingBottom: 48,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "48px 24px 0",
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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 32,
            alignItems: "stretch",
          }}
        >
          <section style={{ display: "flex", flexDirection: "column" }}>
            <InterviewPanel
              agentId={persona.agentId}
              talkLabel={persona.talkLabel}
              subtitle={persona.description}
              personaName={persona.name}
              profileImage={persona.profileImage}
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
  const { data, error } = await supabase
    .from("agent_map")
    .select(
      "agent_id, agent_name, description, content_type, dialogue_created_date, status, key_traits, key_pain_points, age, gender, location, customer_status, profile_image, talk_label"
    )
    .eq("client_id", clientId);

  if (error) {
    return null;
  }

  const target = (data ?? []).find((row) => buildPersonaSlug(row) === personaSlug);

  if (!target) {
    return null;
  }

  if ((target.status ?? "").toLowerCase() !== "ready") {
    return null;
  }

  return mapAgentRowToPersona(target);
}

function mapAgentRowToPersona(row: AgentRow): PersonaDetails {
  return {
    agentId: row.agent_id,
    slug: buildPersonaSlug(row),
    name: row.agent_name?.trim() || "Untitled persona",
    description: row.description,
    contentType: row.content_type?.trim() || null,
    updatedAt: row.dialogue_created_date,
    keyTraits: normalizeList(row.key_traits),
    painPoints: normalizeList(row.key_pain_points),
    attributes: buildAttributes(row),
    profileImage:
      typeof row.profile_image === "string" && row.profile_image.trim().length > 0
        ? row.profile_image.trim()
        : null,
    talkLabel: row.talk_label,
  };
}

function buildPersonaSlug(row: { agent_id: string; agent_name: string | null }): string {
  const name = row.agent_name?.trim();
  if (name && name.length > 0) {
    return slugify(name);
  }
  return slugify(row.agent_id);
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

function buildAttributes(row: AgentRow): Array<{ label: string; value: string }> {
  const attributes: Array<{ label: string; value: string }> = [];
  const ageValue = row.age != null ? `${row.age}`.trim() : "";
  const genderValue = row.gender?.trim() ?? "";
  const locationValue = row.location?.trim() ?? "";
  const statusValue = row.customer_status?.trim() ?? "";

  if (ageValue) attributes.push({ label: "Age", value: ageValue });
  if (genderValue) attributes.push({ label: "Gender", value: genderValue });
  if (locationValue) attributes.push({ label: "Location", value: locationValue });
  if (statusValue) attributes.push({ label: "Customer status", value: statusValue });

  return attributes;
}

async function fetchOtherPersonaSummaries(
  supabase: Supabase,
  clientId: number,
  excludeAgentId: string,
): Promise<PersonaPreview[]> {
  const { data, error } = await supabase
    .from("agent_map")
    .select("agent_id, agent_name, profile_image, status")
    .eq("client_id", clientId);

  if (error) {
    return [];
  }

  return (data ?? [])
    .filter((row) => (row.status ?? "").toLowerCase() === "ready")
    .filter((row) => row.agent_id !== excludeAgentId)
    .map((row) => ({
      id: row.agent_id,
      slug: buildPersonaSlug(row),
      name: row.agent_name?.trim() || "Untitled persona",
      profileImage:
        typeof row.profile_image === "string" && row.profile_image.trim().length > 0
          ? row.profile_image.trim()
          : null,
    }));
}
