import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type PersonaSummary } from "@/app/components/personas/PersonaGallery";
import ExplorePersonaGrid from "./ExplorePersonaGrid";
import { slugify } from "@/app/lib/jump";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: number;
  name: string;
  display_name: string | null;
};

type PersonaRow = {
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
  role_title: string | null;
  active_status: boolean | null;
};

type Supabase = SupabaseClient<any, "public", any>;

function normalizeKeyTraits(source: unknown): string[] {
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

function buildAttributes(row: PersonaRow): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];
  const ageValue = row.age != null ? `${row.age}`.trim() : "";
  const genderValue = row.gender?.trim() ?? "";
  const locationValue = row.location?.trim() ?? "";
  const statusValue = row.customer_status?.trim() ?? "";

  if (ageValue) entries.push({ label: "Age", value: ageValue });
  if (genderValue) entries.push({ label: "Gender", value: genderValue });
  if (locationValue) entries.push({ label: "Location", value: locationValue });
  if (statusValue) entries.push({ label: "Customer status", value: statusValue });

  return entries;
}

function buildPersonaSlug(row: PersonaRow): string {
  const nameSlug = row.agent_name ? slugify(row.agent_name) : "";
  if (nameSlug.length > 0) {
    return nameSlug;
  }

  const idSlug = slugify(row.agent_id);
  if (idSlug.length > 0) {
    return idSlug;
  }

  const rawFallback = row.agent_id.replace(/[^a-z0-9]/gi, "");
  return rawFallback.length > 0 ? rawFallback : "persona";
}

async function resolveClient(supabase: Supabase, clientSlug: string): Promise<ClientRow | null> {
  const direct = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("name", clientSlug)
    .maybeSingle<ClientRow>();
  if (direct.data) {
    return direct.data;
  }

  const { data } = await supabase.from("clients").select("id, name, display_name");
  if (!data) return null;

  const match = data.find((client) => {
    const nameSlug = client.name ? slugify(client.name) : "";
    const displaySlug = client.display_name ? slugify(client.display_name) : "";
    return nameSlug === clientSlug || displaySlug === clientSlug;
  });

  return match ?? null;
}

function mapPersonasToSummaries(rows: PersonaRow[]): PersonaSummary[] {
  const slugCounts = new Map<string, number>();
  return rows.map((row) => {
    const baseSlug = buildPersonaSlug(row);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

    return {
      id: row.agent_id,
      slug,
      name: row.agent_name?.trim().length ? row.agent_name.trim() : "Untitled persona",
      description: row.description,
      keyTraits: normalizeKeyTraits(row.key_traits),
      painPoints: normalizeKeyTraits(row.key_pain_points),
      contentType: row.content_type?.trim().length ? row.content_type.trim() : null,
      updatedAt: row.dialogue_created_date,
      attributes: buildAttributes(row),
      profileImage:
        typeof row.profile_image === "string" && row.profile_image.trim().length > 0
          ? row.profile_image.trim()
          : null,
      roleTitle: row.role_title?.trim().length ? row.role_title.trim() : null,
      customerStatus:
        typeof row.customer_status === "string" && row.customer_status.trim().length > 0
          ? row.customer_status.trim()
          : null,
    } satisfies PersonaSummary;
  });
}

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(239,68,68,0.35)",
          background: "rgba(239,68,68,0.08)",
          padding: 20,
          color: "#b91c1c",
          fontWeight: 600,
        }}
      >
        Supabase environment variables are not configured. The portal cannot load personas yet.
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey) as Supabase;

  const client = await resolveClient(supabase, clientSlug);
  if (!client) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(239,68,68,0.35)",
          background: "rgba(239,68,68,0.08)",
          padding: 20,
          color: "#b91c1c",
          fontWeight: 600,
        }}
      >
        Workspace not found. Ask the Dialogue team to confirm the shareable portal URL.
      </div>
    );
  }

  const { data: personaRows, error } = await supabase
    .from("agent_map")
    .select(
      "agent_id, agent_name, description, content_type, dialogue_created_date, status, key_traits, key_pain_points, age, gender, location, customer_status, profile_image, role_title, active_status"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  const readyPersonas = (personaRows ?? []).filter((row) => {
    const statusReady = (row.status ?? "").toLowerCase() === "ready";
    const isActive = row.active_status === true;
    return statusReady && isActive;
  });
  const summaries = mapPersonasToSummaries(readyPersonas);

  const scrollAnchorOffset = 96;
  const exploreContentMaxWidth = "1100px";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: 4,
          marginRight: -4,
          paddingBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <div
          id="explore"
          style={{
            scrollMarginTop: scrollAnchorOffset,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: exploreContentMaxWidth,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <ExplorePersonaGrid
              clientSlug={clientSlug}
              personas={summaries}
              errorMessage={error ? "Unable to load personas right now. Please try again." : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
