import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/app/lib/jump";
import type { Database } from "@/app/lib/database.types";
import CampaignExperienceClient, {
  type CampaignExperienceData,
} from "@/app/campaign/_components/CampaignExperienceClient";

export const dynamic = "force-dynamic";

const CAMPAIGN_SELECT_COLUMNS =
  "id, name, description, objective, image_url, agent_id, questions, outputs, client_id, persona_ids" as const;

type CampaignsTable = {
  Row: CampaignRow;
  Insert: CampaignRow;
  Update: Partial<CampaignRow>;
  Relationships: [];
};

type ClientsTable = Database["public"]["Tables"]["clients"];

type ExtendedClientsTable = {
  Row: Omit<ClientsTable["Row"], "id"> & { id: string | number };
  Insert: Omit<ClientsTable["Insert"], "id"> & { id?: string | number };
  Update: Omit<ClientsTable["Update"], "id"> & { id?: string | number };
  Relationships: ClientsTable["Relationships"];
};

type CampaignLinksTable = {
  Row: CampaignLinkRow;
  Insert: {
    id?: string;
    campaign_id: string;
    persona_id?: string | null;
    qr_code?: string | null;
    qr_code_image?: string | null;
    link_url?: string | null;
    phone_number?: string | null;
    created_at?: string | null;
  };
  Update: {
    id?: string;
    campaign_id?: string;
    persona_id?: string | null;
    qr_code?: string | null;
    qr_code_image?: string | null;
    link_url?: string | null;
    phone_number?: string | null;
    created_at?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: "campaign_links_campaign_id_fkey";
      columns: ["campaign_id"];
      isOneToOne: false;
      referencedRelation: "campaigns";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "campaign_links_persona_id_fkey";
      columns: ["persona_id"];
      isOneToOne: false;
      referencedRelation: "agent_map";
      referencedColumns: ["agent_id"];
    },
  ];
};

type SupabaseDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "clients"> & {
      clients: ExtendedClientsTable;
      campaigns: CampaignsTable;
      campaign_links: CampaignLinksTable;
    };
  };
};

type Supabase = SupabaseClient<SupabaseDatabase>;

type ClientRow = {
  id: string | number;
  name: string | null;
  display_name: string | null;
};

type CampaignRow = {
  id: string;
  name: string | null;
  description: string | null;
  objective: string | null;
  image_url: string | null;
  agent_id: string | null;
  client_id: string | number | null;
  questions: unknown;
  outputs: unknown;
  persona_ids: unknown;
};

type CampaignLinkRow = {
  id: string;
  campaign_id: string;
  persona_id: string | null;
  qr_code: string | null;
  qr_code_image: string | null;
  link_url: string | null;
  phone_number: string | null;
  created_at: string | null;
};

type PageParams = { clientSlug: string; campaignSlug: string };

type CampaignOutput = {
  type: "string" | "boolean" | "number";
  description: string;
};

type CampaignExperienceRow = Omit<CampaignExperienceData, "questions" | "outputs" | "clientName"> & {
  questions: string[];
  outputs: CampaignOutput[];
};

type RawCampaignOutput = {
  description?: unknown;
  type?: unknown;
};

function isRawCampaignOutput(payload: unknown): payload is RawCampaignOutput {
  return Boolean(payload && typeof payload === "object");
}

function normalizeQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizeOutputs(value: unknown): CampaignOutput[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.reduce<CampaignOutput[]>((acc, item) => {
    if (!isRawCampaignOutput(item)) {
      return acc;
    }
    const description = typeof item.description === "string"
      ? item.description.trim()
      : "";
    if (!description) {
      return acc;
    }
    const typeValue = typeof item.type === "string"
      ? item.type.trim().toLowerCase()
      : "";
    const type: CampaignOutput["type"] =
      typeValue === "boolean"
        ? "boolean"
        : typeValue === "number"
        ? "number"
        : "string";
    acc.push({ description, type });
    return acc;
  }, []);
}

function normalizePersonaIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizeCampaignId(value: string | number | null | undefined): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

async function resolveClient(
  supabase: Supabase,
  clientSlug: string
): Promise<ClientRow | null> {
  const trimmedSlug = clientSlug.trim();
  if (trimmedSlug) {
    const directByExactId = await supabase
      .from("clients")
      .select("id, name, display_name")
      .eq("id", trimmedSlug)
      .maybeSingle<ClientRow>();
    if (directByExactId.data) {
      return directByExactId.data;
    }

    const numericId = Number(trimmedSlug);
    if (!Number.isNaN(numericId)) {
      const directByNumericId = await supabase
        .from("clients")
        .select("id, name, display_name")
        .eq("id", numericId)
        .maybeSingle<ClientRow>();
      if (directByNumericId.data) {
        return directByNumericId.data;
      }
    }
  }

  const directByName = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("name", clientSlug)
    .maybeSingle<ClientRow>();
  if (directByName.data) {
    return directByName.data;
  }

  const { data } = await supabase.from("clients").select("id, name, display_name");
  if (!data) {
    return null;
  }

  return (
    data.find((client) => {
      const nameSlug = client.name ? slugify(client.name) : "";
      const displaySlug = client.display_name ? slugify(client.display_name) : "";
      return nameSlug === clientSlug || displaySlug === clientSlug;
    }) ?? null
  );
}

async function resolveCampaign(
  supabase: Supabase,
  clientId: string | number,
  campaignSlug: string
): Promise<CampaignExperienceRow | null> {
  const normalizedSlug = campaignSlug.trim();
  if (!normalizedSlug) {
    return null;
  }
  const normalizedSlugLower = normalizedSlug.toLowerCase();

  const linkLookup = await supabase
    .from("campaign_links")
    .select("id, campaign_id, persona_id")
    .eq("id", normalizedSlug)
    .maybeSingle<CampaignLinkRow>();
  if (linkLookup.data && linkLookup.data.campaign_id) {
    const campaignByLink = await supabase
      .from("campaigns")
      .select(CAMPAIGN_SELECT_COLUMNS)
      .eq("id", linkLookup.data.campaign_id)
      .maybeSingle<CampaignRow>();
    if (
      campaignByLink.data &&
      String(campaignByLink.data.client_id) === String(clientId)
    ) {
      return mapCampaignRowToExperience(
        campaignByLink.data,
        linkLookup.data.persona_id ?? null
      );
    }
  }

  const directById = await supabase
    .from("campaigns")
    .select(CAMPAIGN_SELECT_COLUMNS)
    .eq("id", normalizedSlug)
    .maybeSingle<CampaignRow>();
  if (directById.data && String(directById.data.client_id) === String(clientId)) {
    return mapCampaignRowToExperience(directById.data);
  }

  const { data } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_SELECT_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) {
    return null;
  }

  const match = data.find((row) => {
    const rowId = normalizeCampaignId(row.id);
    if (rowId) {
      const rowIdLower = rowId.toLowerCase();
      if (rowId === normalizedSlug || rowIdLower === normalizedSlugLower) {
        return true;
      }
    }
    const nameSlug = row.name ? slugify(row.name) : "";
    return nameSlug === normalizedSlug || nameSlug === normalizedSlugLower;
  });
  return match ? mapCampaignRowToExperience(match) : null;
}

function mapCampaignRowToExperience(
  row: CampaignRow,
  forcedPersonaId?: string | null
): CampaignExperienceRow {
  const rawAgentId = row.agent_id;
  const agentId =
    typeof rawAgentId === "string"
      ? rawAgentId.trim()
      : rawAgentId
      ? String(rawAgentId)
      : "";
  const personaIds = normalizePersonaIds(row.persona_ids);
  const primaryPersonaId = personaIds.length > 0 ? personaIds[0] ?? null : null;
  const personaId =
    forcedPersonaId && forcedPersonaId.trim().length > 0
      ? forcedPersonaId.trim()
      : primaryPersonaId;
  return {
    id: row.id,
    name: row.name?.trim().length ? row.name.trim() : "Untitled campaign",
    description: row.description?.trim().length ? row.description.trim() : null,
    objective: row.objective?.trim().length ? row.objective.trim() : null,
    imageUrl: row.image_url?.trim().length ? row.image_url.trim() : null,
    agentId,
    personaId,
    questions: normalizeQuestions(row.questions),
    outputs: normalizeOutputs(row.outputs),
    outcomes: [],
  };
}

function buildError(message: string) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f8fafc",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          borderRadius: 20,
          padding: 24,
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
          fontSize: 16,
          color: "#0f172a",
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
    </main>
  );
}

export default async function CampaignExperiencePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { clientSlug, campaignSlug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return buildError("Supabase credentials are not configured. This campaign cannot load yet.");
  }

  if (!clientSlug || !campaignSlug) {
    return buildError("Missing campaign address. Double-check the shareable link.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey) as Supabase;
  const client = await resolveClient(supabase, decodeURIComponent(clientSlug));
  if (!client) {
    return buildError("Workspace not found. Ask your Dialogue admin to confirm the link.");
  }

  const campaign = await resolveCampaign(supabase, client.id, decodeURIComponent(campaignSlug));
  if (!campaign) {
    return buildError("Campaign not found or no longer available.");
  }

  if (!campaign.agentId) {
    return buildError("This campaign is missing an ElevenLabs agent. Please finish configuring it in Dialogue.");
  }

  return (
    <CampaignExperienceClient
      campaign={{
        ...campaign,
        clientName: client.display_name ?? client.name ?? null,
      }}
    />
  );
}
