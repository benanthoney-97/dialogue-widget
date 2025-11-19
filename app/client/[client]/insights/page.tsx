"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { slugify } from "@/app/lib/jump";
import { supabase } from "@/app/lib/supabaseClient";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";

const insightTabs = [
  {
    label: "All",
    subheading: "View every insight across the journey",
  },
  {
    label: "Needs",
    subheading: "What do customers truly need right now?",
  },
  {
    label: "Motivations",
    subheading: "What motivates them to take action (or not)?",
  },
  {
    label: "Barriers",
    subheading: "What are their biggest barriers, frustrations, or blockers?",
  },
  {
    label: "Behaviours",
    subheading: "What are their current behaviours and routines?",
  },
  {
    label: "Value",
    subheading: "How do they feel—emotionally—about the problem or solution?",
  },
  {
    label: "Language",
    subheading: "How clear and compelling is the proposed concept or idea?",
  },
  {
    label: "Features",
    subheading: "How do they evaluate the proposed features or value proposition?",
  },
  {
    label: "Emotions",
    subheading: "How do they respond to the messaging or language used?",
  },
  {
    label: "Key Takeaways",
    subheading: "How do they compare this option to alternatives?",
  },
  {
    label: "Future Trends",
    subheading: "What trends, signals, or patterns are emerging across conversations?",
  },
];

const TAB_BASE_WIDTH = 220;
const TAB_EXPANDED_WIDTH = 360;

type ClientRow = {
  id: string;
  name: string | null;
  display_name: string | null;
};

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  profile_image: string | null;
  status: string | null;
};

type PersonaListItem = {
  id: string;
  slug: string;
  name: string;
  profileImage: string | null;
};

function decodeSegment(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function resolveClientId(clientSlug: string): Promise<string | null> {
  if (!clientSlug) return null;

  const directByName = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("name", clientSlug)
    .maybeSingle<ClientRow>();

  if (directByName.data) {
    return directByName.data.id;
  }

  const directById = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("id", clientSlug)
    .maybeSingle<ClientRow>();

  if (directById.data) {
    return directById.data.id;
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

function mapRowsToPersonas(rows: PersonaRow[]): PersonaListItem[] {
  return rows.map((row) => ({
    id: row.agent_id,
    slug: buildPersonaSlug(row),
    name: row.agent_name?.trim().length ? row.agent_name.trim() : "Untitled persona",
    profileImage: row.profile_image?.trim().length ? row.profile_image.trim() : null,
  }));
}

function getPersonaInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function InsightsTabPage() {
  const params = useParams();
  const rawClientParam = params.client;
  const scalarClientParam = Array.isArray(rawClientParam) ? rawClientParam[0] : rawClientParam;
  const clientSlug = decodeSegment(scalarClientParam);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [isPersonaLoading, setPersonaLoading] = useState(false);
  const [hoveredPersonaId, setHoveredPersonaId] = useState<string | null>(null);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const ALL_PERSONA_KEY = "__all_personas__";
  const isAllPersonaSelected = selectedPersonaIds.length === 0;
  const isAllPersonaHovered = hoveredPersonaId === ALL_PERSONA_KEY;

  const toggleTabSelection = (label: string) => {
    setSelectedTabs((prev) =>
      prev.includes(label) ? prev.filter((tab) => tab !== label) : [...prev, label]
    );
  };

  useEffect(() => {
    let active = true;
    setPersonas([]);
    setPersonaLoading(false);
    setHoveredPersonaId(null);
    if (!clientSlug) {
      setClientId(null);
      return () => {
        active = false;
      };
    }

    (async () => {
      const resolvedId = await resolveClientId(clientSlug);
      if (!active) return;
      setClientId(resolvedId);
    })();

    return () => {
      active = false;
    };
  }, [clientSlug]);

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setPersonas([]);
      setPersonaLoading(false);
      return () => {
        active = false;
      };
    }

    setPersonaLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("agent_map")
        .select("agent_id, agent_name, profile_image, status")
        .eq("client_id", clientId)
        .order("agent_name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("[Insights] Failed to load personas", error);
        setPersonas([]);
        setPersonaLoading(false);
        return;
      }

      const personaRows = ((data ?? []) as PersonaRow[]) || [];
      const readyRows = personaRows.filter((row) => (row.status ?? "").toLowerCase() === "ready");
      const rowsToUse = readyRows.length > 0 ? readyRows : personaRows;
  setPersonas(mapRowsToPersonas(rowsToUse));
      setPersonaLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [clientId]);

  const layoutStyle = {
    minHeight: "100vh",
    backgroundColor: "#fff",
  };

  const contentStyle = {
    display: "flex",
    minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
    paddingTop: `${TOPBAR_HEIGHT}px`,
  };

  const mainContentStyle = {
    flex: 1,
    display: "flex",
    minHeight: "100%",
  };

  const leftMenuStyle = {
    width: TAB_BASE_WIDTH,
    minWidth: TAB_BASE_WIDTH,
    padding: 24,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: 12,
    marginTop: 32,
    height: "100%",
    boxSizing: "border-box" as const,
    overflow: "visible" as const,
    alignItems: "flex-start" as const,
  };

  const tabBaseStyle = {
    padding: "10px 12px",
    borderRadius: 10,
       backgroundColor: "transparent",
    border: "1px solid transparent",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 120ms ease, box-shadow 120ms ease, width 120ms ease",
    width: TAB_BASE_WIDTH,
    minWidth: TAB_BASE_WIDTH,
    boxSizing: "border-box" as const,
    outline: "none",
    textAlign: "left" as const,
  } as const;

  const tabSelectedStyle = {
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    border: "1px solid rgba(37, 99, 235, 0.4)",
    color: "#0b1c2b",
  } as const;

  const getTabStyle = (isHovered: boolean, isSelected: boolean) => {
    const base = isSelected ? { ...tabBaseStyle, ...tabSelectedStyle } : tabBaseStyle;
    if (!isHovered) {
      return base;
    }
    return {
      ...base,
      width: TAB_EXPANDED_WIDTH,
      transform: "translateY(-2px)",
      boxShadow: "0 5px 15px rgba(15, 23, 42, 0.12)",
    };
  };

  const tabDetailStyle = {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 500,
    color: "rgba(15, 23, 42, 0.7)",
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    textAlign: "left" as const,
  } as const;

  const rightPanelStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: "100%",
    overflow: "hidden" as const,
    padding: "12px 24px 24px",
    boxSizing: "border-box" as const,
  };

  const mainPanelHeaderStyle = {
    paddingBottom: 12,
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    marginBottom: 12,
  };

  const personaBarStyle = {
    display: "flex",
    gap: 10,
    overflowX: "auto" as const,
    alignItems: "center" as const,
  };

  const rightPanelBodyStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  };

  const personaChipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    textDecoration: "none",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  } as const;

  const personaChipHoverStyle = {
    borderColor: "rgba(15, 23, 42, 0.2)",
    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.14)",
  } as const;

  const personaChipSelectedStyle = {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderColor: "rgba(37, 99, 235, 0.4)",
    color: "#0b1c2b",
  } as const;

  const personaAvatarStyle = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    fontSize: 12,
    fontWeight: 700,
    color: "#0f172a",
    overflow: "hidden",
  } as const;

  const personaAvatarImageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  };

  const personaNameColumnStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  };

  const personaNameStyle = {
    fontSize: 14,
    lineHeight: 1.2,
  } as const;

  const personaStatusTextStyle = {
    color: "rgba(15, 23, 42, 0.6)",
    fontWeight: 500,
    fontSize: 13,
  } as const;

  const insightSummaryStyle = {
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(15, 23, 42, 0.65)",
    marginBottom: 12,
  } as const;

  const mainPanelPlaceholderStyle = {
    flex: 1,
    borderRadius: 18,
    border: "1px dashed rgba(15, 23, 42, 0.3)",
    backgroundColor: "rgba(15, 23, 42, 0.02)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    padding: 32,
    color: "rgba(15, 23, 42, 0.6)",
  } as const;

  const placeholderTextStyle = {
    maxWidth: 460,
    fontSize: 15,
    lineHeight: 1.4,
  } as const;

  const selectionSummaryText =
    selectedTabs.length > 0
      ? `Selected insights (${selectedTabs.length}): ${selectedTabs.join(" • ")}`
      : "Select one or more insight tabs to explore how the personas are engaging with your work.";

  const placeholderCopy =
    selectedTabs.length > 0
      ? "Insights tied to these tabs will surface here once we aggregate the latest conversations."
      : "Select one or more insight tabs to begin unlocking persona trends for the client above.";

  const allChipStyle = {
    ...personaChipStyle,
    ...(isAllPersonaHovered ? personaChipHoverStyle : {}),
    ...(isAllPersonaSelected ? personaChipSelectedStyle : {}),
  };

  return (
    <div style={layoutStyle}>
      <Topbar
        title="Insights"
        offsetLeft="var(--sidebar-width, 280px)"
        hideCadenceControls
        hideProfileAvatar
      />
      <div style={contentStyle}>
        <aside
          style={{
            width: "var(--sidebar-width, 280px)",
            flexShrink: 0,
          }}
        >
          <Sidebar />
        </aside>
        <div style={mainContentStyle}>
          <div style={leftMenuStyle}>
            {insightTabs.map((tab) => {
              const isSelected = selectedTabs.includes(tab.label);
              const showDetail = hoveredTab === tab.label || isSelected;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onMouseEnter={() => setHoveredTab(tab.label)}
                  onMouseLeave={() => setHoveredTab(null)}
                  onClick={() => toggleTabSelection(tab.label)}
                  aria-pressed={isSelected}
                  style={getTabStyle(hoveredTab === tab.label, isSelected)}
                >
                  <div>{tab.label}</div>
                  {showDetail && <div style={tabDetailStyle}>{tab.subheading}</div>}
                </button>
              );
            })}
          </div>
          <div style={rightPanelStyle}>
            <div style={mainPanelHeaderStyle}>
              <div style={personaBarStyle}>
                <button
                  type="button"
                  aria-label="See insights for all personas"
                  aria-pressed={isAllPersonaSelected}
                  style={allChipStyle}
                  onMouseEnter={() => setHoveredPersonaId(ALL_PERSONA_KEY)}
                  onMouseLeave={() => setHoveredPersonaId(null)}
                  onClick={() => setSelectedPersonaIds([])}
                >
                  All
                </button>
                {personas.length > 0 ? (
                  personas.map((persona) => {
                    const isChipHovered = hoveredPersonaId === persona.id;
                    const isChipSelected = selectedPersonaIds.includes(persona.id);
                    const chipStyle = {
                      ...personaChipStyle,
                      ...(isChipHovered ? personaChipHoverStyle : {}),
                      ...(isChipSelected ? personaChipSelectedStyle : {}),
                    };
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        aria-label={`See insights for ${persona.name}`}
                        aria-pressed={isChipSelected}
                        style={chipStyle}
                        onMouseEnter={() => setHoveredPersonaId(persona.id)}
                        onMouseLeave={() => setHoveredPersonaId(null)}
                        onClick={() => {
                          setSelectedPersonaIds((prev) =>
                            prev.includes(persona.id)
                              ? prev.filter((id) => id !== persona.id)
                              : [...prev, persona.id]
                          );
                        }}
                      >
                        <div style={personaAvatarStyle}>
                          {persona.profileImage ? (
                            <img
                              src={persona.profileImage}
                              alt={persona.name}
                              style={personaAvatarImageStyle}
                            />
                          ) : (
                            getPersonaInitial(persona.name)
                          )}
                        </div>
                        <div style={personaNameColumnStyle}>
                          <span style={personaNameStyle}>{persona.name}</span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <span style={personaStatusTextStyle}>
                    {isPersonaLoading ? "Loading personas…" : "No personas available yet"}
                  </span>
                )}
              </div>
            </div>
            <div style={rightPanelBodyStyle}>
              <div style={insightSummaryStyle}>{selectionSummaryText}</div>
              <div style={mainPanelPlaceholderStyle}>
                <div style={placeholderTextStyle}>{placeholderCopy}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
