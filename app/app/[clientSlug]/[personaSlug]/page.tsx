import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import PersonaDescription from "@/app/components/personas/PersonaDescription";
import PersonaActionsMenu from "@/app/components/personas/PersonaActionsMenu";
import { slugify } from "@/app/lib/jump";

type PersonaDetailPageProps = {
  params: Promise<{ clientSlug: string; personaSlug: string }>;
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
};

type PersonaSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  contentType: string | null;
  updatedAt: string | null;
  profileImage: string | null;
};

type SuggestedQuestionRow = {
  id: number;
  suggested_question: string | null;
};

type Supabase = SupabaseClient<any, "public", any>;

async function resolveClientId(supabase: Supabase, clientSlug: string): Promise<number | null> {
  const direct = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("name", clientSlug)
    .maybeSingle<{ id: number; name: string; display_name: string | null }>();

  if (direct.data) {
    return direct.data.id;
  }

  const { data } = await supabase.from("clients").select("id, name, display_name");
  if (!data) return null;

  const match = data.find((client) => {
    const nameSlug = client.name ? slugify(client.name) : "";
    const displaySlug = client.display_name ? slugify(client.display_name) : "";
    return nameSlug === clientSlug || displaySlug === clientSlug;
  });

  return match?.id ?? null;
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
      contentType: row.content_type?.trim().length ? row.content_type.trim() : null,
      updatedAt: row.dialogue_created_date,
      profileImage:
        typeof row.profile_image === "string" && row.profile_image.trim().length > 0
          ? row.profile_image.trim()
          : null,
    } satisfies PersonaSummary;
  });
}

export default async function PersonaDetailPage({ params }: PersonaDetailPageProps) {
  const { clientSlug, personaSlug } = await params;
  const targetSlug = decodeURIComponent(personaSlug);
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
        Supabase environment variables are not configured. The persona page cannot load yet.
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey) as Supabase;
  const clientId = await resolveClientId(supabase, clientSlug);

  if (!clientId) {
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
      "agent_id, agent_name, description, content_type, dialogue_created_date, status, key_traits, key_pain_points, age, gender, location, customer_status, profile_image"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
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
        Unable to load this persona right now. Please try again in a moment.
      </div>
    );
  }

  const readyPersonas = (personaRows ?? []).filter((row) => (row.status ?? "").toLowerCase() === "ready");
  const summaries = mapPersonasToSummaries(readyPersonas);
  const persona = summaries.find((summary) => summary.slug === targetSlug);

  const { data: suggestedQuestionRows, error: suggestedQuestionsError } = await supabase
    .from("suggested_questions")
    .select("id, suggested_question")
    .order("id", { ascending: true });

  if (suggestedQuestionsError) {
    console.error("Failed to load suggested questions", suggestedQuestionsError);
  }

  const suggestedQuestions = (suggestedQuestionRows ?? [])
    .map((row) => row.suggested_question?.trim())
    .filter((question): question is string => Boolean(question && question.length > 0));

  if (!persona) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(59,130,246,0.35)",
          background: "rgba(59,130,246,0.08)",
          padding: 20,
          color: "#1d4ed8",
          fontWeight: 600,
        }}
      >
        That persona is not available. Return to explore to see the full gallery.
      </div>
    );
  }

  const descriptionText = persona.description?.trim().length
    ? persona.description
    : "The Dialogue team hasn’t published a narrative for this persona yet.";

  const actions: Array<{ label: string; href?: string; icon?: React.ReactNode }> = [
    {
      label: "Chat",
      href: `/app/${clientSlug}/${persona.slug}/chat`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
          <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
          <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
        </svg>
      ),
    },
    {
      label: "Interview",
      href: `/app/${clientSlug}/${persona.slug}/interview`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
          <path
            d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14"
            stroke="#c084fc"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
          <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        padding: "32px 0",
        paddingBottom: 0,
      }}
    >
      <style>{`
        [data-persona-layout-container] {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          column-gap: clamp(14px, 3vw, 28px);
          row-gap: 8px;
          align-items: flex-start;
          padding: 0 clamp(10px, 3.5vw, 24px);
          box-sizing: border-box;
          margin: 0 auto;
          justify-items: stretch;
          justify-content: center;
          min-height: 0;
        }

        [data-persona-action-chip] {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 999px;
          border: 1px solid rgba(43,108,176,0.24);
          background: #1e293b;
          box-shadow: 0 12px 24px rgba(15,40,90,0.12);
          color: #f8fafc;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          font-family: "Cooper Light BT", "CooperBT", Cooper, serif;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          cursor: pointer;
          min-width: 140px;
          justify-self: flex-start;
        }

        [data-persona-action-chip]:hover,
        [data-persona-action-chip]:focus-visible {
          transform: translateY(-4px);
          box-shadow: 0 16px 30px rgba(15,40,90,0.16);
          border-color: rgba(43,108,176,0.32);
          background: #273652;
          color: #f8fafc;
          outline: none;
        }

        [data-persona-layout-container] [data-persona-portrait] {
          width: clamp(120px, 24vw, 100px);
          aspect-ratio: 3 / 4;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(15,23,42,0.18);
          border: 1px solid rgba(15,23,42,0.12);
          background: #0f172a;
          position: relative;
          justify-self: start;
        }

        [data-persona-suggested-link] {
          padding: 16px 18px;
          border: 1px solid rgba(148,163,184,0.35);
          border-radius: 16px;
          background: transparent;
          color: #0f172a;
          font-size: 15px;
          line-height: 1.55;
          text-decoration: none;
          display: block;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        [data-persona-suggested-link]:hover,
        [data-persona-suggested-link]:focus-visible {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
          border-color: rgba(59,130,246,0.45);
          outline: none;
        }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "840px",
          borderRadius: 28,
          padding: "28px 0",
        }}
      >
        <div data-persona-layout-container>
          <div data-persona-portrait>
            {persona.profileImage ? (
              <img
                src={persona.profileImage}
                alt={`Portrait of ${persona.name}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  maxWidth: "640px",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f8fafc",
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {(() => {
                  const initials = persona.name
                    .split(/\s+/)
                    .filter((segment) => segment.length > 0)
                    .map((segment) => segment.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return initials.length > 0 ? initials : "P";
                })()}
              </div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              color: "#0f172a",
              maxWidth: "640px",
              alignSelf: "stretch",
              height: "100%",
              minHeight: "100%",
            }}
          >
            <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    fontSize: 26,
                    lineHeight: 1.15,
                    fontWeight: 700,
                    fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                  }}
                >
                  {persona.name}
                </h1>
                <PersonaActionsMenu personaName={persona.name} personaId={persona.id} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.4,
                  color: "#475569",
                }}
              >
                Wizard from Hogwarts school
              </p>
            </header>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {persona.contentType ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,0.35)",
                    padding: "16px 18px",
                    background: "#ffffff",
                  }}
                >
                  <span style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Content focus
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{persona.contentType}</span>
                </div>
              ) : null}
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: "auto",
              }}
            >
              {actions.map((action) => {
                const content = (
                  <>
                    {action.icon ? (
                      <span
                        aria-hidden="true"
                        style={{ display: "inline-flex", alignItems: "center" }}
                      >
                        {action.icon}
                      </span>
                    ) : null}
                    <span>{action.label}</span>
                  </>
                );

                if (action.href) {
                  return (
                    <Link
                      key={`persona-action-${action.label.toLowerCase()}`}
                      href={action.href}
                      data-persona-action-chip
                      prefetch={false}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <span
                    key={`persona-action-${action.label.toLowerCase()}`}
                    data-persona-action-chip
                  >
                    {content}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              height: 1,
              borderBottom: "1px dashed rgba(148,163,184,0.35)",
              margin: "12px 0 20px",
            }}
          />

          <div
            style={{
              gridColumn: "1 / -1",
              borderRadius: 20,
              color: "#0f172a",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              }}
            >
              Persona description
            </h2>
            <div style={{ marginTop: 12 }}>
              <PersonaDescription text={descriptionText} />
            </div>
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              height: 1,
              borderBottom: "1px dashed rgba(148,163,184,0.35)",
              margin: "16px 0 20px",
            }}
          />

          <div
            style={{
              gridColumn: "1 / -1",
              borderRadius: 20,
              padding: "0 0 ",
              color: "#0f172a",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              }}
            >
              Suggested questions
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 16,
              }}
            >
              {suggestedQuestions.length > 0 ? (
                suggestedQuestions.map((question, index) => (
                  <Link
                    key={`suggested-question-${index}`}
                    href={`/app/${clientSlug}/${persona.slug}/chat?prompt=${encodeURIComponent(question)}`}
                    prefetch={false}
                    data-persona-suggested-link
                  >
                    {question}
                  </Link>
                ))
              ) : (
                <div
                  style={{
                    padding: "16px 18px",
                    border: "1px dashed rgba(148,163,184,0.35)",
                    borderRadius: 16,
                    color: "#475569",
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}
                >
                  Suggested questions are coming soon.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
