import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { slugify } from "@/app/lib/jump";
import QuestionnaireExperience from "./QuestionnaireExperience";
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
  profile_image: string | null;
  status: string | null;
  dialogue_created_date?: string | null;
  updated_at?: string | null;
  research_type?: string | null;
};

type PersonaDetails = {
  agentId: string;
  name: string;
  description: string | null;
  profileImage: string | null;
  updatedAt: string | null;
  researchType: string | null;
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

type QuestionnaireJobRow = {
  id: string | number | null;
  status: string | null;
  extraction_result: unknown;
  file_path: string | null;
  created_at: string | null;
};

type QuestionnaireSummary = {
  jobId: string | null;
  status: string | null;
  extractionResult: string | null;
  filePath: string | null;
  createdAt: string | null;
};

export default async function QuestionnairePage({
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
        Supabase environment variables are not configured. The questionnaire experience cannot load yet.
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

  const questionnaire = await fetchLatestQuestionnaire(supabase, persona.agentId);

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
        color: "#0f172a",
        paddingBottom: 48,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          margin: "0",
          padding: "0 24px",
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <PersonaTopbarSlot personaName={persona.name} profileImage={persona.profileImage} />
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
            <QuestionnaireExperience
              agentId={persona.agentId}
              personaName={persona.name}
              personaUpdatedAt={persona.updatedAt}
              personaResearchType={persona.researchType}
              initialJob={questionnaire}
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
  .select("*")
    .eq("client_id", clientId);

  if (error) {
    return null;
  }

  const target = (data ?? []).find((row) => {
    const name = row.agent_name?.trim();
    if (!name) return false;
    return slugify(name) === personaSlug;
  });

  if (!target) {
    return null;
  }

  if ((target.status ?? "").toLowerCase() !== "ready") {
    return null;
  }

  return mapAgentRowToPersona(target);
}

async function fetchLatestQuestionnaire(
  supabase: Supabase,
  agentId: string
): Promise<QuestionnaireSummary | null> {
  const { data, error } = await supabase
    .from("questionnaire_jobs")
  .select("id, status, extraction_result, file_path, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<QuestionnaireJobRow>();

  if (error || !data) {
    return null;
  }

  return {
    jobId: data.id != null ? String(data.id) : null,
    status: data.status ?? null,
    extractionResult:
      data.extraction_result === null || typeof data.extraction_result === "undefined"
        ? null
        : typeof data.extraction_result === "string"
        ? data.extraction_result
        : JSON.stringify(data.extraction_result, null, 2),
    filePath: data.file_path ?? null,
    createdAt: data.created_at ?? null,
  };
}

function mapAgentRowToPersona(row: AgentRow): PersonaDetails {
  return {
    agentId: row.agent_id,
    name: row.agent_name?.trim() || "Untitled persona",
    description: row.description,
    profileImage:
      typeof row.profile_image === "string" && row.profile_image.trim().length > 0
        ? row.profile_image.trim()
        : null,
    updatedAt: row.updated_at ?? row.dialogue_created_date ?? null,
    researchType: typeof row.research_type === "string" && row.research_type.trim().length > 0
      ? row.research_type.trim()
      : null,
  };
}
