import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type PersonaSummary } from "@/app/components/personas/PersonaGallery";
import ExplorePersonaGrid from "./ExplorePersonaGrid";
import { slugify } from "@/app/lib/jump";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  name: string;
  display_name: string | null;
};

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  key: string | null;
  description: string | null;
  dialogue_created_date: string | null;
  status: string | null;
  key_traits: unknown;
  key_pain_points: unknown;
  customer_status: string | null;
  profile_image: string | null;
  role_title: string | null;
  active_status: boolean | null;
};

type Supabase = SupabaseClient<any, "public", any>;

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

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
  const statusValue = row.customer_status?.trim() ?? "";
  if (statusValue) entries.push({ label: "Customer status", value: statusValue });
  return entries;
}

function buildPersonaSlug(row: PersonaRow): string {
  const keySlug = row.key ? slugify(row.key) : "";
  if (keySlug.length > 0) {
    return keySlug;
  }
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

async function fetchClientById(supabase: Supabase, clientParam: string): Promise<ClientRow | null> {
  const trimmed = clientParam.trim();
  if (!trimmed || !isUuid(trimmed)) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("id", trimmed)
    .maybeSingle<ClientRow>();

  console.log("[explore] fetchClientById result", { trimmed, data, error });

  if (error && error.code && error.code !== "PGRST116") {
    console.warn("[portal] Failed to resolve client by id", { candidate: trimmed, error });
  }

  return data ?? null;
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
        contentType: null,
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
  const { clientSlug: clientParam } = await params;
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

  console.log("[explore] resolving client slug", clientParam);
  const client = await fetchClientById(supabase, clientParam);
  if (!client) {
    console.warn("[explore] failed to find client", clientParam);
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
        Workspace not found. Confirm the shareable portal URL includes a valid client ID.
      </div>
    );
  }

  const { data: personaRows, error } = await supabase
    .from("agent_map")
    .select(
      "agent_id, agent_name, key, description, dialogue_created_date, status, key_traits, key_pain_points, customer_status, profile_image, role_title, active_status"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });

  console.log("[explore] agent_map fetch", {
    clientId: client.id,
    length: (personaRows ?? []).length,
    error,
  });

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
              clientSlug={String(client.id)}
              personas={summaries}
              errorMessage={error ? "Unable to load personas right now. Please try again." : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
