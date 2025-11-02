"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "../../../lib/supabaseClient";
import FullscreenModal from "../../../components/FullscreenModal";
import PrepAgent from "../../../components/PrepAgent";
import DialogueText from "../../../components/DialogueText";
import PillButton from "../../../components/PillButton";

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  audience_type: string | null;
  content_type: string | null;
  description: string | null;
  status: string | null;
  dialogue_created_date: string | null;
  key: string | null;
  age?: string | number | null;
  gender?: string | null;
  location?: string | null;
  customer_status?: string | null;
};

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function determineColumns(width: number): number {
  if (width <= 680) return 1;
  if (width <= 960) return 2;
  if (width <= 1280) return 3;
  return 4;
}

type PersonaTrait = {
  label: string;
  value: string;
};

function buildPersonaTraits(persona: PersonaRow): PersonaTrait[] {
  const traits: PersonaTrait[] = [];
  traits.push({
    label: "Age",
    value:
      persona.age !== undefined && persona.age !== null && `${persona.age}`.trim()
        ? `${persona.age}`
        : "Not set",
  });
  traits.push({
    label: "Gender",
    value:
      persona.gender && persona.gender.trim().length > 0 ? persona.gender.trim() : "Not set",
  });
  traits.push({
    label: "Location",
    value:
      persona.location && persona.location.trim().length > 0
        ? persona.location.trim()
        : "Not set",
  });
  traits.push({
    label: "Customer status",
    value:
      persona.customer_status && persona.customer_status.trim().length > 0
        ? persona.customer_status.trim()
        : "Not set",
  });
  return traits;
}

function buildUpdatedLabel(dateString: string | null): string {
  return formatDate(dateString);
}

const MODAL_OPTIONS: Array<{
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: "questionnaire",
    title: "Questionnaire",
    description: "Get instant responses to quant questionnaires.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="4" height="20" rx="1.6" fill="#7ea0e6" opacity="0.8" />
        <rect x="12" y="2" width="4" height="24" rx="1.6" fill="#93c5fd" />
        <rect x="20" y="10" width="4" height="16" rx="1.6" fill="#60a5fa" opacity="0.9" />
        <rect x="28" y="14" width="4" height="12" rx="1.6" fill="#3b82f6" />
      </svg>
    ),
  },
  {
    key: "chat",
    title: "Chat",
    description: "Quickfire answers to questions.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
        <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
        <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
      </svg>
    ),
  },
  {
    key: "interview",
    title: "Interview",
    description: "In-depth audio interview to validate new concepts and pitch ideas.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
        <path d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
        <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
        <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
      </svg>
    ),
  },
];

const EDIT_OPTION = {
  key: "edit",
  title: "Edit",
  description: "Open the persona editor.",
  icon: <span className="persona-option-icon">✎</span>,
};

type StagePanelProps = {
  heading: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
        </header>
      )}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

type StageButtonVariant = "primary" | "secondary" | "ghost";

type StageButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StageButtonVariant;
  width?: "auto" | "full";
};

function StageButton({ variant = "primary", width = "auto", className = "", ...props }: StageButtonProps) {
  const classes = [
    "stage-button",
    `stage-button--${variant}`,
    width === "full" ? "stage-button--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={`${classes} ${className}`.trim()} {...props} />;
}

export default function PersonasPage() {
  const pathname = usePathname();
  const router = useRouter();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<number>(() =>
    typeof window === "undefined" ? 4 : determineColumns(window.innerWidth)
  );
  const columnsRef = useRef(columns);
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaRow | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const quantUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [quantFileName, setQuantFileName] = useState<string | null>(null);
  const [quantFileURL, setQuantFileURL] = useState<string | null>(null);
  const [quantFileType, setQuantFileType] = useState<string | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string>("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const nameWrapperRef = useRef<HTMLDivElement | null>(null);
  const nameMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [nameFieldWidth, setNameFieldWidth] = useState<number | null>(null);
  const [traitChips, setTraitChips] = useState<string[]>([]);
  const [traitError, setTraitError] = useState<string | null>(null);
  const [isAddingTrait, setIsAddingTrait] = useState(false);
  const [newTraitValue, setNewTraitValue] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkValue, setNewLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    if (expandedPersonaId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedPersonaId]);

  const miniOptions = useMemo(() => {
    if (!selectedOption) {
      return [];
    }
    const options = MODAL_OPTIONS.filter((option) => option.key !== selectedOption);
    if (selectedOption !== "edit") {
      options.push(EDIT_OPTION);
    }
    return options;
  }, [selectedOption]);

  const selectedOptionMeta = useMemo(() => {
    if (!selectedOption) {
      return null;
    }
    if (selectedOption === EDIT_OPTION.key) {
      return EDIT_OPTION;
    }
    return MODAL_OPTIONS.find((option) => option.key === selectedOption) ?? null;
  }, [selectedOption]);


  const fillerCount =
    !loading && !error && personas.length > 0
      ? (columns - (personas.length % columns || columns)) % columns
      : 0;

  useEffect(() => {
    async function fetchPersonas() {
      if (!clientSlug) return;
      setLoading(true);
      setError(null);
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", clientSlug)
          .single();
        if (profileError || !profile) {
          setError("Profile not found");
          setPersonas([]);
          return;
        }
        const { data, error: personaError } = await supabase
          .from("agent_map")
          .select(
            "agent_id, agent_name, audience_type, content_type, description, status, dialogue_created_date, key"
          )
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        if (personaError) {
          setError("Unable to load personas");
          setPersonas([]);
          return;
        }
        setPersonas((data ?? []).filter((row) => row.agent_id));
      } finally {
        setLoading(false);
      }
    }
    fetchPersonas();
  }, [clientSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleResize() {
      const nextColumns = determineColumns(window.innerWidth);
      columnsRef.current = nextColumns;
      setColumns(nextColumns);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTogglePersonaCard = (persona: PersonaRow) => {
    setExpandedPersonaId((prev) => (prev === persona.agent_id ? null : persona.agent_id));
  };

  const handleClosePersona = () => {
    setActivePersona(null);
    setSelectedOption(null);
  };

  const handleQuantUploadClick = () => {
    quantUploadInputRef.current?.click();
  };

  const handleRunQuestionnaire = () => {
    // TODO: implement running the questionnaire against the uploaded document
    // Placeholder: log the event and relevant context
    // eslint-disable-next-line no-console
    console.log("Run questionnaire", { persona: activePersona?.agent_id, file: quantFileName });
  };

  const handleQuantUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    // Revoke previous object URL if present
    if (quantFileURL) {
      try {
        URL.revokeObjectURL(quantFileURL);
      } catch (e) {
        // ignore
      }
    }
    const objectUrl = URL.createObjectURL(file);
    setQuantFileURL(objectUrl);
    setQuantFileType(file.type || null);
    setQuantFileName(file.name);
    // TODO: replace this with your upload implementation (Supabase storage, S3, etc.)
    // Example placeholder: console.log the selected file and leave a TODO for integration.
    // You can add an `uploadQuantQuestionnaire(file)` function and call it here.
    // eslint-disable-next-line no-console
    console.log("Quant questionnaire selected:", file);
    // Clear the input so the same file can be selected again if needed
    event.currentTarget.value = "";
  };

  // Revoke object URL on unmount or when quantFileURL changes (cleanup previous)
  React.useEffect(() => {
    return () => {
      if (quantFileURL) {
        try {
          URL.revokeObjectURL(quantFileURL);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [quantFileURL]);

  useEffect(() => {
    if (activePersona) {
      setEditingName(activePersona.agent_name ?? "");
      setEditingDescription(activePersona.description ?? "");
      setNameError(null);
      setDescriptionError(null);
      setTraitError(null);
      setTraitChips([]);
      setIsAddingTrait(false);
      setNewTraitValue("");
      setLinks([]);
      setIsAddingLink(false);
      setNewLinkValue("");
      setLinkError(null);
      setQuantFileName(null);
      setQuantFileURL(null);
    } else {
      setEditingName("");
      setEditingDescription("");
      setTraitError(null);
      setTraitChips([]);
      setIsAddingTrait(false);
      setNewTraitValue("");
      setLinks([]);
      setIsAddingLink(false);
      setNewLinkValue("");
      setLinkError(null);
      setQuantFileName(null);
      setQuantFileURL(null);
    }
  }, [activePersona]);

  useEffect(() => {
    if (!nameWrapperRef.current || !nameMeasureRef.current) return;
    const wrapperWidth = nameWrapperRef.current.clientWidth;
    const measureWidth = nameMeasureRef.current.offsetWidth + 8;
    setNameFieldWidth(Math.min(measureWidth, wrapperWidth));
  }, [editingName, activePersona]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function handleResize() {
      if (!nameWrapperRef.current || !nameMeasureRef.current) return;
      const wrapperWidth = nameWrapperRef.current.clientWidth;
      const measureWidth = nameMeasureRef.current.offsetWidth + 8;
      setNameFieldWidth(Math.min(measureWidth, wrapperWidth));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const commitPersonaName = useCallback(async () => {
    if (!activePersona || isSavingName) return;
    const trimmed = editingName.trim();
    const previous = activePersona.agent_name ?? "";
    if (!trimmed) {
      setEditingName(previous);
      setNameError("Name cannot be empty.");
      return;
    }
    if (trimmed === previous) {
      setNameError(null);
      if (editingName !== previous) {
        setEditingName(previous);
      }
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    const currentAgentId = activePersona.agent_id;
    const { error } = await supabase
      .from("agent_map")
      .update({ agent_name: trimmed })
      .eq("agent_id", currentAgentId);
    if (error) {
      setNameError("Unable to update name. Please try again.");
      setEditingName(previous);
      setIsSavingName(false);
      return;
    }
    setEditingName(trimmed);
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId ? { ...prev, agent_name: trimmed } : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId ? { ...persona, agent_name: trimmed } : persona
      )
    );
    setIsSavingName(false);
  }, [activePersona, editingName, isSavingName]);

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        (event.currentTarget as HTMLInputElement).blur();
      } else if (event.key === "Escape" && activePersona) {
        event.preventDefault();
        setEditingName(activePersona.agent_name ?? "");
        setNameError(null);
        (event.currentTarget as HTMLInputElement).blur();
      }
    },
    [activePersona]
  );

  const commitPersonaDescription = useCallback(async () => {
    if (!activePersona || isSavingDescription) return;
    const currentAgentId = activePersona.agent_id;
    const previous = activePersona.description ?? "";
    if (editingDescription === previous) {
      setDescriptionError(null);
      return;
    }
    setIsSavingDescription(true);
    setDescriptionError(null);
    const { error } = await supabase
      .from("agent_map")
      .update({ description: editingDescription })
      .eq("agent_id", currentAgentId);
    if (error) {
      setDescriptionError("Unable to update description. Please try again.");
      setEditingDescription(previous);
      setIsSavingDescription(false);
      return;
    }
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId ? { ...prev, description: editingDescription } : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId ? { ...persona, description: editingDescription } : persona
      )
    );
    setIsSavingDescription(false);
  }, [activePersona, editingDescription, isSavingDescription]);

  const handleRemoveTrait = useCallback((trait: string) => {
    setTraitChips((prev) => prev.filter((label) => label !== trait));
  }, []);

  const handleSaveTrait = useCallback(() => {
    const value = newTraitValue.trim();
    if (!value) {
      setTraitError("Trait cannot be empty.");
      return;
    }
    if (traitChips.includes(value)) {
      setTraitError("Trait already exists.");
      return;
    }
    setTraitChips((prev) => [...prev, value]);
    setNewTraitValue("");
    setIsAddingTrait(false);
    setTraitError(null);
  }, [newTraitValue, traitChips]);

  const handleSaveLink = useCallback(() => {
    const value = newLinkValue.trim();
    if (!value) {
      setLinkError("Link cannot be empty.");
      return;
    }
    if (links.includes(value)) {
      setLinkError("Link already added.");
      return;
    }
    setLinks((prev) => [...prev, value]);
    setNewLinkValue("");
    setIsAddingLink(false);
    setLinkError(null);
  }, [newLinkValue, links]);

  const handleRemoveLink = useCallback((link: string) => {
    setLinks((prev) => prev.filter((l) => l !== link));
  }, []);

  return (
    <main
      className="stage-layout persona-root"
      data-expanded={expandedPersonaId ? "true" : "false"}
    >
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div ref={contentContainerRef} className="stage-layout__content">
        <div className="stage-shell">
        <StagePanel
          heading="Personas"
          trailing={
            clientSlug ? (
              <StageButton
                type="button"
                variant="secondary"
                onClick={() => router.push(`/client/${clientSlug}/upload`)}
                className="personas-new-button"
              >
                <span className="stage-button__icon" aria-hidden="true">+</span>
                <span>New persona</span>
              </StageButton>
            ) : undefined
          }
        >
        <section className="personas-section">
          <div className="personas-grid">
            {loading && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 16,
                }}
              >
                Loading personas…
              </div>
            )}
            {!loading && error && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#fecaca",
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}
            {!loading && !error && personas.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 16,
                }}
              >
                No personas configured yet.
              </div>
            )}
            {!loading &&
              !error &&
              personas.map((persona) => {
                const isExpanded = expandedPersonaId === persona.agent_id;
                const buttonStyle = isExpanded
                  ? {
                      gridColumn: columnsRef.current > 1 ? "1 / -1" : undefined,
                      gridRow: columnsRef.current > 1 ? "span 2" : undefined,
                    }
                  : undefined;
                const traitChips = buildPersonaTraits(persona);
                const updatedLabel = buildUpdatedLabel(persona.dialogue_created_date);
                return (
                  <button
                    key={persona.agent_id}
                    type="button"
                    className="persona-card-button"
                    onClick={() => handleTogglePersonaCard(persona)}
                    aria-expanded={isExpanded}
                    style={buttonStyle}
                  >
                    <article
                      className="persona-card"
                      data-expanded={isExpanded ? "true" : "false"}
                      style={
                        isExpanded
                          ? {
                              borderColor: "rgba(30, 41, 59, 0.28)",
                              boxShadow: "0 18px 44px rgba(15, 23, 42, 0.18)",
                            }
                          : undefined
                      }
                    >
                    <div className="persona-card__body">
                      <div className="persona-card__title-row">
                        <h3 className="persona-card__title">{persona.agent_name ?? "Untitled persona"}</h3>
                        {isExpanded ? (
                          <div className="persona-title-actions">
                            <button
                              type="button"
                              className="persona-title-cta"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActivePersona(persona);
                                setSelectedOption(null);
                              }}
                            >
                              Start interview
                            </button>
                            <button
                              type="button"
                              className="persona-title-cta persona-title-cta--ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActivePersona(persona);
                                setSelectedOption("edit");
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <p className="persona-card__type">{persona.content_type ?? ""}</p>
                    </div>
                    <div
                      className="persona-card__expanded"
                      data-visible={isExpanded ? "true" : "false"}
                    >
                      <div className="persona-card__expanded-inner">
                        <div className="persona-traits" role="list">
                          <div className="persona-traits__chips">
                            {traitChips.map((trait) => (
                              <span key={trait.label} className="persona-trait-chip" role="listitem">
                                <strong>{trait.label}:</strong>
                                <span>{trait.value}</span>
                              </span>
                            ))}
                          </div>
                          {isExpanded ? (
                            <span className="persona-title-updated persona-title-updated--inline">
                              <span className="persona-updated__label">Updated:</span>
                              {updatedLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="persona-description">
                          <p>
                            {persona.description && persona.description.trim().length > 0
                              ? persona.description
                              : "No description has been added yet."}
                          </p>
                        </div>
                        <div className="persona-expanded-scroll">
                          <div className="persona-expanded-grid">
                            <div className="persona-expanded-block">
                              <h4>Key pain points</h4>
                              <ul className="persona-expanded-list">
                                <li>
                                  <div className="persona-expanded-list-item">Placeholder pain point one.</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Placeholder pain point two.</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Placeholder pain point three.</div>
                                </li>
                              </ul>
                            </div>
                            <div className="persona-expanded-block">
                              <h4>Intent signals</h4>
                              <ul className="persona-expanded-list">
                                <li>
                                  <div className="persona-expanded-list-item">Asks for timing or budget to deploy the solution.</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Requests proof points from similar clients.</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Moves discussion to implementation milestones.</div>
                                </li>
                              </ul>
                            </div>
                            <div className="persona-expanded-block">
                              <h4>Data sources</h4>
                              <ul className="persona-expanded-list">
                                <li>
                                  <div className="persona-expanded-list-item">Uploaded pitch deck.pdf</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Industry outlook article</div>
                                </li>
                                <li>
                                  <div className="persona-expanded-list-item">Briefing transcript</div>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                    <div
                      className="persona-card__footer"
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}
                    >
                      {!isExpanded ? (
                        <div className="persona-traits persona-traits--collapsed" role="list">
                          <div className="persona-traits__chips">
                            {traitChips.map((trait) => (
                              <span key={`collapsed-${trait.label}`} className="persona-trait-chip" role="listitem">
                                <strong>{trait.label}:</strong>
                                <span>{trait.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                  </button>
                );
              })}
            {Array.from({ length: fillerCount }).map((_, idx) => (
              <div key={`persona-filler-${idx}`} className="persona-filler" aria-hidden="true" />
            ))}
          </div>
        </section>
        </StagePanel>

        <FullscreenModal
          open={!!activePersona}
          onCloseAction={handleClosePersona}
          anchorRef={contentContainerRef}
        >
          {activePersona && (
            <><div
              ref={modalPanelRef}
              className={`persona-modal-container${selectedOption ? " persona-modal-container--expanded" : ""}`}
            >
              <header className={`persona-modal-header${selectedOption ? " persona-modal-header--with-mini" : ""}${selectedOption && selectedOption !== "edit" ? " persona-modal-header--with-selection" : ""}`}>
                <div className="persona-modal-heading">
                  <div className="persona-modal-title-row">
                    <div className="persona-modal-title-left">
                      <PillButton
                        className="persona-modal-close"
                        onClick={handleClosePersona}
                        aria-label="Back to personas"
                        style={{ padding: "6px 10px", border: "none", background: "transparent", color: "#052033" }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 28,
                            lineHeight: 1,
                            display: "inline-flex",
                            transform: "translateX(-2px)",
                          }}
                        >
                          ‹
                        </span>
                      </PillButton>
                      <div className="persona-modal-title-wrapper" role="heading" aria-level={2}>
                        <span
                          id="persona-modal-title"
                          className="persona-modal-title-display"
                          aria-label="Persona name"
                        >
                          {editingName && editingName.trim().length > 0
                            ? editingName
                            : "Untitled persona"}
                        </span>
                        {isSavingName ? (
                          <span className="persona-modal-title-status">Saving…</span>
                        ) : nameError ? (
                          <span className="persona-modal-title-error">{nameError}</span>
                        ) : null}
                      </div>
                    </div>
                    {selectedOption && (
                      <div className="persona-modal-title-chips">
                        {miniOptions.map((option) => (
                          <PillButton
                            key={`mini-${option.key}`}
                            type="button"
                            variant="subtle"
                            className="persona-modal-mini-card"
                            onClick={() => setSelectedOption(option.key as string)}
                            style={{ gap: 18, padding: "10px 18px", fontSize: 14 }}
                          >
                            <span className="persona-modal-icon persona-modal-icon--mini">{option.icon}</span>
                            <div className="persona-modal-mini-meta">
                              <strong>{option.title}</strong>
                            </div>
                          </PillButton>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="persona-modal-subheading-wrapper">
                    {selectedOptionMeta ? (
                      <div className="persona-modal-subheading persona-modal-subheading--card">
                        <span className="persona-modal-subheading-icon" aria-hidden="true">
                          {selectedOptionMeta.icon}
                        </span>
                        <span>{`${selectedOptionMeta.title}: ${selectedOptionMeta.description}`}</span>
                      </div>
                    ) : (
                      <p className="persona-modal-subheading">
                        Pick the format you want to run with this persona.
                      </p>
                    )}
                  </div>
                </div>
              </header>
              <div className={`persona-modal-body${selectedOption === "edit" ? " persona-modal-body--edit" : ""}`}>
                {selectedOption === "edit" ? (
                  <div className="persona-modal-option persona-modal-option--expanded persona-modal-option--edit">
                    <div className="persona-modal-option-body persona-modal-option-body--edit">
                      <div className="persona-edit-layout">
                        <div className="persona-edit-column" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
                            <div className="persona-edit-top-grid" aria-hidden="true">
                              <div className="persona-edit-top-left">
                                <div className="persona-edit-name-wrapper" ref={nameWrapperRef}>
                                  <span
                                    ref={nameMeasureRef}
                                    className="persona-edit-name-measure"
                                    aria-hidden="true"
                                  >
                                    {editingName || "Untitled persona"}
                                  </span>
                                  <input
                                    id="persona-edit-name"
                                    type="text"
                                    value={editingName}
                                    onChange={(event) => {
                                      setEditingName(event.target.value);
                                      setNameError(null);
                                    }}
                                    onBlur={() => {
                                      void commitPersonaName();
                                    }}
                                    onKeyDown={handleNameKeyDown}
                                    className="persona-edit-name-input"
                                    placeholder="Untitled persona"
                                    disabled={isSavingName}
                                    style={nameFieldWidth ? { width: `${nameFieldWidth}px` } : undefined}
                                  />
                                  <span className="persona-edit-name-icon" aria-hidden="true">
                                    ✎
                                  </span>
                                </div>

                                <div className="persona-edit-traits">
                                  {traitChips.map((trait) => (
                                    <button
                                      key={`persona-trait-${trait}`}
                                      type="button"
                                      className="persona-edit-trait"
                                      onClick={() => handleRemoveTrait(trait)}
                                      aria-label={`Remove ${trait}`}
                                    >
                                      <span className="persona-edit-trait-label">{trait}</span>
                                      <span aria-hidden="true" className="persona-edit-trait-close">
                                        ×
                                      </span>
                                    </button>
                                  ))}
                                  {!isAddingTrait && (
                                    <button
                                      type="button"
                                      className="persona-edit-trait persona-edit-trait--add"
                                      onClick={() => {
                                        setIsAddingTrait(true);
                                        setNewTraitValue("");
                                        setTraitError(null);
                                      }}
                                    >
                                      <span className="persona-edit-trait-label">Add trait</span>
                                      <span aria-hidden="true" className="persona-edit-trait-close">
                                        +
                                      </span>
                                    </button>
                                  )}
                                </div>

                                {isAddingTrait && (
                                  <div className="persona-edit-trait-form">
                                    <input
                                      type="text"
                                      className="persona-edit-trait-input"
                                      value={newTraitValue}
                                      onChange={(event) => {
                                        setNewTraitValue(event.target.value);
                                        setTraitError(null);
                                      }}
                                      placeholder="Enter value"
                                    />
                                    <div className="persona-edit-trait-actions">
                                      <button
                                        type="button"
                                        className="persona-edit-trait-save"
                                        onClick={() => handleSaveTrait()}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="persona-edit-trait-cancel"
                                        onClick={() => {
                                          setIsAddingTrait(false);
                                          setNewTraitValue("");
                                          setTraitError(null);
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {traitError && <span className="persona-edit-error persona-edit-error--inline">{traitError}</span>}

                                {isSavingName ? (
                                  <span className="persona-edit-status">Saving…</span>
                                ) : nameError ? (
                                  <span className="persona-edit-error">{nameError}</span>
                                ) : null}
                              </div>

                              <div className="persona-edit-description">
                                <textarea
                                  id="persona-edit-description"
                                  value={editingDescription}
                                  placeholder="No description has been added for this persona yet."
                                  onChange={(event) => {
                                    setEditingDescription(event.target.value);
                                    setDescriptionError(null);
                                  }}
                                  onBlur={() => {
                                    void commitPersonaDescription();
                                  }}
                                  disabled={isSavingDescription}
                                />
                                {isSavingDescription ? (
                                  <span className="persona-edit-status">Saving…</span>
                                ) : descriptionError ? (
                                  <span className="persona-edit-error">{descriptionError}</span>
                                ) : null}

                                {/* Data sources moved below the grid */}
                              </div>
                            </div>

                          {/* Data sources container (moved below top grid) */}
                          <div className="persona-edit-uploaded-documents" style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 12, marginTop: 12, flex: 1, minHeight: 0, overflow: "auto" }}>
                            <div className="persona-edit-aside-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <strong>Data sources</strong>
                              <button type="button" className="persona-edit-aside-button" aria-label="Add uploaded document">
                                <span aria-hidden="true">＋</span>
                              </button>
                            </div>
                            <div
                              className="persona-edit-data-grid"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 12,
                                marginTop: 12,
                                alignItems: "start",
                              }}
                            >
                              <div className="persona-edit-data-col" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <h4 className="persona-edit-data-header" style={{ margin: 0, fontSize: 14, textAlign: "center", width: "100%" }}>Documents</h4>
                                <div className="persona-edit-data-body" style={{ marginTop: 8, color: "var(--muted)" }}>
                                  <label style={{ display: "inline-block" }}>
                                    <input
                                      id="persona-upload-doc"
                                      type="file"
                                      style={{ display: "none" }}
                                      onChange={() => { /* TODO: handle file upload */ }}
                                    />
                                    <button
                                      type="button"
                                      className="persona-upload-first-doc"
                                      aria-label="Add first document"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "1px dashed rgba(203,213,245,0.12)",
                                        background: "transparent",
                                        color: "var(--muted)",
                                        fontSize: 14,
                                        fontWeight: 700,
                                      }}
                                      onClick={() => document.getElementById('persona-upload-doc')?.click()}
                                    >
                                      Add first document
                                    </button>
                                  </label>
                                </div>
                              </div>
                              <div className="persona-edit-data-col" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <h4 className="persona-edit-data-header" style={{ margin: 0, fontSize: 14, textAlign: "center", width: "100%" }}>Links</h4>
                                <div className="persona-edit-data-body" style={{ marginTop: 8, color: "var(--muted)", width: "100%", display: "flex", justifyContent: "center" }}>
                                  {links.length === 0 && !isAddingLink ? (
                                    <button
                                      type="button"
                                      className="persona-upload-first-doc"
                                      aria-label="Add first link"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "1px dashed rgba(203,213,245,0.12)",
                                        background: "transparent",
                                        color: "var(--muted)",
                                        fontSize: 14,
                                        fontWeight: 700,
                                      }}
                                      onClick={() => {
                                        setIsAddingLink(true);
                                        setNewLinkValue("");
                                        setLinkError(null);
                                      }}
                                    >
                                      Add first link
                                    </button>
                                  ) : isAddingLink ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
                                      <input
                                        type="text"
                                        value={newLinkValue}
                                        onChange={(e) => {
                                          setNewLinkValue(e.target.value);
                                          setLinkError(null);
                                        }}
                                        placeholder="https://example.com"
                                        style={{
                                          width: "100%",
                                          maxWidth: 360,
                                          borderRadius: 10,
                                          border: "1px solid rgba(126,160,230,0.2)",
                                          padding: "8px 10px",
                                          background: "rgba(15,23,42,0.6)",
                                          color: "var(--text)",
                                        }}
                                      />
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveLink()}
                                          className="persona-edit-trait-save"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsAddingLink(false);
                                            setNewLinkValue("");
                                            setLinkError(null);
                                          }}
                                          className="persona-edit-trait-cancel"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                      {linkError && <div className="persona-edit-error">{linkError}</div>}
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                                      {links.map((l) => (
                                        <div key={l} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                          <a href={l} target="_blank" rel="noreferrer" style={{ color: "var(--muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</a>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveLink(l)}
                                            className="persona-edit-document-close"
                                            aria-label={`Remove link ${l}`}
                                            style={{ width: "auto", height: "auto", padding: "4px 8px", borderRadius: 8 }}
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="persona-edit-data-col" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <h4 className="persona-edit-data-header" style={{ margin: 0, fontSize: 14, textAlign: "center", width: "100%" }}>Calls</h4>
                                <div className="persona-edit-data-body" style={{ marginTop: 8, color: "var(--muted)" }}>No calls yet.</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`persona-modal-options${selectedOption ? " persona-modal-options--has-selection" : ""}`}
                    >
                      {MODAL_OPTIONS.map((option) => {
                        const isSelected = selectedOption === option.key;
                        const isDismissed = Boolean(selectedOption && selectedOption !== option.key);
                        const optionClasses = isSelected || isDismissed
                          ? [
                            "persona-modal-option",
                            isSelected ? "persona-modal-option--expanded" : "",
                            isDismissed ? "persona-modal-option--dismissed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")
                          : "persona-modal-option persona-modal-option--initial";

                        const content = (
                          <>
                            {!isSelected && (
                              <div
                                className={`persona-modal-option-header$${isSelected ? " persona-modal-option-header--expanded" : ""}`.replace("$", "")}
                              >
                                <span className="persona-modal-icon">{option.icon}</span>
                                <div className="persona-modal-option-copy">
                                  <div className="persona-modal-option-titles">
                                    <h3>{option.title}</h3>
                                    <p>{option.description}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            {isSelected && option.key === "questionnaire" && (
                              <div className="persona-modal-option-body">
                                <div
                                  ref={expandedCardRef}
                                  className="persona-modal-option-body-content persona-modal-option-body-content--quant"
                                >
                                  {quantFileURL ? (
                                    <div className="persona-quant-grid">
                                      <div className="persona-quant-preview">
                                        {((quantFileType && quantFileType.includes("pdf")) || (quantFileName && quantFileName.toLowerCase().endsWith(".pdf"))) ? (
                                          <iframe
                                            // Append a PDF fragment to request the viewer hide the toolbar where
                                            // supported by the PDF viewer (browser-dependent). If the browser
                                            // ignores this fragment the toolbar may still appear.
                                            src={quantFileURL ? `${quantFileURL}#toolbar=0` : undefined}
                                            title={quantFileName ?? "preview"}
                                            style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
                                          />
                                        ) : (
                                          <div className="persona-quant-file-card">
                                            <div className="persona-quant-file-name" title={quantFileName ?? undefined}>{quantFileName}</div>
                                            <a className="persona-quant-download" href={quantFileURL ?? undefined} download={quantFileName ?? undefined}>
                                              Download
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                      <div className="persona-quant-actions-col">
                                        <input
                                          ref={quantUploadInputRef}
                                          type="file"
                                          accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                                          style={{ display: "none" }}
                                          onChange={handleQuantUploadChange}
                                        />
                                        {quantFileName && !quantFileURL && (
                                          <div className="persona-quant-file" title={quantFileName ?? undefined}>
                                            {quantFileName}
                                          </div>
                                        )}

                                        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
                                          <PillButton
                                            type="button"
                                            onClick={handleQuantUploadClick}
                                            aria-label="Change document"
                                            className="persona-quant-action-square"
                                            // Use a taller rectangular touch target and ensure the inline
                                            // styles request the larger height/padding so the underlying
                                            // PillButton doesn't collapse to a single text line.
                                            style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8 }}
                                          >
                                            Change document
                                          </PillButton>
                                          <PillButton
                                            type="button"
                                            onClick={handleRunQuestionnaire}
                                            aria-label="Run questionnaire"
                                            className="persona-quant-action-square"
                                            style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8 }}
                                          >
                                            Run questionnaire
                                          </PillButton>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="persona-quant-actions">
                                      <PillButton
                                        type="button"
                                        onClick={handleQuantUploadClick}
                                        style={{
                                          padding: "12px 26px",
                                          fontSize: 15,
                                          fontWeight: 700,
                                          background: "transparent",
                                          boxShadow: "none",
                                          border: "none",
                                        }}
                                      >
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 160, height: 160, justifyContent: "center", boxSizing: "border-box", borderRadius: 8 }}>
                                          <svg
                                            width="40"
                                            height="40"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            aria-hidden="true"
                                            style={{ display: "block" }}
                                          >
                                            <path d="M12 16V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M8 10l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            <rect x="3" y="18" width="18" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
                                          </svg>
                                          <span>Upload quant questionnaire</span>
                                        </div>
                                      </PillButton>
                                      <input
                                        ref={quantUploadInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                                        style={{ display: "none" }}
                                        onChange={handleQuantUploadChange}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {isSelected && option.key === "interview" && (
                              <div className="persona-modal-option-body">
                                <div ref={expandedCardRef} className="persona-modal-option-body-content">
                                  <PrepAgent agentId={activePersona.agent_id ?? undefined} panelExpanded={true} panelRootRef={expandedCardRef} />
                                </div>
                              </div>
                            )}
                            {isSelected && option.key === "chat" && (
                              <div className="persona-modal-option-body">
                                <div ref={expandedCardRef} className="persona-modal-option-body-content persona-modal-option-body-content--agent">
                                  <DialogueText
                                    agentId={activePersona.agent_id ?? ""}
                                    personaName={activePersona.agent_name || undefined} />
                                </div>
                              </div>
                            )}
                          </>
                        );

                        if (isSelected) {
                          return (
                            <div key={option.key} className={optionClasses}>
                              {content}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={optionClasses}
                            onClick={() => setSelectedOption(option.key)}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  </>)}
              </div>
            </div>
          </>)}
        </FullscreenModal>

        <style>{`
          @font-face {
            font-family: 'CooperBT';
            src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          .stage-layout {
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
            padding: 0;
            font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
            display: flex;
            flex-direction: row;
          }
          .stage-layout__sidebar {
            width: 180px;
            flex-shrink: 0;
          }
          .stage-layout__content {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 64px 24px 96px;
            min-height: 100dvh;
            overflow-y: auto;
          }
          .stage-shell {
            width: min(1120px, 96%);
            display: flex;
            flex-direction: column;
            gap: 32px;
            color: var(--text);
          }
          .personas-section {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 28px;
          }
          .stage-panel {
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid rgba(30, 41, 59, 0.12);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
            display: flex;
            flex-direction: column;
            gap: 24px;
            color: #1e293b;
          }
          .stage-panel__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .stage-panel__leading,
          .stage-panel__trailing,
          .stage-panel__spacer {
            flex: 0 0 auto;
            min-width: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .stage-panel__spacer {
            visibility: hidden;
          }
          .stage-panel__titles {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .stage-panel__titles h2 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #1e293b;
          }
          .stage-panel__titles p {
            margin: 0;
            font-size: 14px;
            color: rgba(30, 41, 59, 0.68);
          }
          .stage-panel__body {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .stage-panel__footer {
            margin-top: 12px;
          }
          .stage-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 20px;
            border-radius: 12px;
            border: none;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
            font-family: inherit;
          }
          .stage-button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }
          .stage-button--full {
            width: 100%;
          }
          .stage-button--primary {
            background: #1e293b;
            color: #f6f7f9;
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
          }
          .stage-button--primary:not(:disabled):hover {
            transform: translateY(-1px);
            box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
          }
          .stage-button--secondary {
            background: rgba(30, 41, 59, 0.08);
            color: #1e293b;
          }
          .stage-button--secondary:not(:disabled):hover {
            background: rgba(30, 41, 59, 0.16);
            transform: translateY(-1px);
          }
          .stage-button--ghost {
            background: transparent;
            color: #1e293b;
          }
          .stage-button--ghost:not(:disabled):hover {
            color: #0f172a;
          }
          .stage-button__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            background: var(--accent, #2b6cb0);
            color: #f6f7f9;
            font-weight: 800;
            font-size: 16px;
          }
          .personas-new-button {
            padding: 10px 18px;
          }
          .personas-new-button .stage-button__icon {
            margin-right: 6px;
          }
          .personas-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 20px;
            padding-top: 12px;
          }
          .persona-root[data-expanded="true"] .personas-section {
            overflow-y: auto;
            max-height: calc(100vh - 220px);
            padding-right: 6px;
            margin-right: -6px;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
            overscroll-behavior: contain;
          }
          .persona-root[data-expanded="true"] .personas-section::-webkit-scrollbar {
            width: 6px;
          }
          .persona-root[data-expanded="true"] .personas-section::-webkit-scrollbar-thumb {
            background-color: rgba(148, 163, 184, 0.55);
            border-radius: 999px;
          }
          .persona-root[data-expanded="true"] .personas-section::-webkit-scrollbar-track {
            background: transparent;
          }
          @media (max-width: 1280px) {
            .personas-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 960px) {
            .personas-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 680px) {
            .personas-grid {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          .persona-card-button {
            background: none;
            border: none;
            padding: 0;
            text-align: left;
            display: block;
            width: 100%;
            color: inherit;
          }
          .persona-card-button:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.85);
            outline-offset: 6px;
            border-radius: 20px;
          }
          .persona-filler {
            border-radius: 16px;
            border: 1px solid transparent;
            visibility: hidden;
          }
          .persona-card {
            position: relative;
            border-radius: 16px;
            border: 1px solid rgba(43, 108, 176, 0.18);
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 18px 36px rgba(10, 22, 40, 0.12);
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 0;
            min-height: 200px;
            transition: transform 0.32s ease, box-shadow 0.32s ease, border-color 0.32s ease, background-color 0.32s ease;
            cursor: pointer;
          }
          .persona-card[data-expanded="true"] {
            background-color: rgba(255, 255, 255, 0.99);
          }
          .persona-card__expanded {
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transform: translateY(-6px);
            transition: max-height 0.44s ease, opacity 0.36s ease, transform 0.36s ease;
          }
          .persona-card__expanded[data-visible="true"] {
            max-height: 800px;
            opacity: 1;
            transform: translateY(0);
          }
          .persona-card__expanded-inner {
            padding-top: 6px;
            color: rgba(30, 41, 59, 0.72);
            font-size: 14px;
            line-height: 1.5;
            text-align: left;
          }
          .persona-traits {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
            margin-top: 6px;
          }
          .persona-traits--collapsed {
            justify-content: flex-start;
            align-items: flex-start;
            margin-top: 8px;
            margin-bottom: 0;
            gap: 8px;
          }
          .persona-traits--collapsed .persona-traits__chips {
            gap: 8px;
          }
          .persona-traits--collapsed .persona-trait-chip {
            padding: 2px 7px;
            font-size: 10px;
            line-height: 1.2;
            gap: 3px;
          }
          .persona-traits--collapsed .persona-trait-chip strong {
            font-size: 8px;
            letter-spacing: 0.3px;
          }
          .persona-traits__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .persona-trait-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(43, 108, 176, 0.12);
            color: #1e293b;
            font-size: 12px;
            font-weight: 600;
          }
          .persona-trait-chip strong {
            font-weight: 700;
            color: #1c3d68;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 10px;
          }
          .persona-trait-chip span {
            font-weight: 600;
          }
          .persona-expanded-placeholder {
            color: rgba(30, 41, 59, 0.5);
            font-style: italic;
          }
          .persona-expanded-scroll {
            margin-top: 20px;
            max-height: clamp(220px, 48vh, 360px);
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 4px;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
            overscroll-behavior: contain;
          }
          .persona-expanded-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(148, 163, 184, 0.55);
            border-radius: 999px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .persona-expanded-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }
          @media (max-width: 960px) {
            .persona-expanded-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 680px) {
            .persona-expanded-grid {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          .persona-expanded-block {
            padding: 16px 18px;
            color: rgba(30, 41, 59, 0.85);
            min-height: 140px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .persona-expanded-block h4 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 0.4px;
          }
          .persona-expanded-block ul {
            margin: 0;
            padding-left: 0;
            list-style-position: inside;
            font-size: 13px;
            line-height: 1.5;
            color: rgba(30, 41, 59, 0.75);
          }
          .persona-expanded-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .persona-expanded-list-item {
            width: 100%;
            background: rgba(30, 41, 59, 0.06);
            border-radius: 10px;
            padding: 10px 12px;
          }
          .persona-description {
            margin-bottom: 14px;
            color: rgba(30, 41, 59, 0.82);
            font-size: 14px;
            line-height: 1.6;
          }
          .persona-description p {
            margin: 0;
          }
          .persona-description--empty {
            color: rgba(71, 85, 105, 0.75);
            font-style: italic;
          }
          .persona-card-button:hover .persona-card,
          .persona-card-button:focus-visible .persona-card {
            transform: translateY(-6px);
            box-shadow: 0 24px 60px rgba(10, 22, 40, 0.16);
            border-color: rgba(43, 108, 176, 0.42);
            background-color: rgba(255, 255, 255, 0.99);
          }
          .persona-card__body {
            display: flex;
            flex-direction: column;
            gap: 8px;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 14px;
            flex: 1 1 auto;
          }
          .persona-card__footer {
            margin-top: auto;
            width: 100%;
          }
          .persona-card__title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: space-between;
          }
          .persona-card__title {
            margin: 0;
            font-weight: 700;
            font-size: 18px;
            color: var(--text);
          }
          .persona-title-actions {
            display: inline-flex;
            align-items: center;
            gap: 10px;
          }
          .persona-title-cta {
            border: none;
            background: #0f172a;
            color: #f8fafc;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            padding: 8px 14px;
            border-radius: 999px;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
          }
          .persona-title-cta:hover {
            background: #1e293b;
            color: #f8fafc;
            transform: translateY(-1px);
          }
          .persona-title-cta:focus-visible {
            outline: 2px solid rgba(29, 78, 216, 0.65);
            outline-offset: 2px;
          }
          .persona-title-cta--ghost {
            background: transparent;
            color: #1e3a8a;
            border: 1px solid rgba(30, 64, 175, 0.28);
            padding: 8px 16px;
          }
          .persona-title-cta--ghost:hover {
            background: rgba(30, 64, 175, 0.08);
            color: #1d4ed8;
          }
          .persona-title-updated {
            display: inline-flex;
            align-items: baseline;
            gap: 6px;
            font-size: 13px;
            color: var(--muted);
          }
          .persona-title-updated--inline {
            background: rgba(43, 108, 176, 0.08);
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            color: rgba(30, 41, 59, 0.65);
            gap: 6px;
            display: inline-flex;
            align-items: center;
          }
          .persona-card__type {
            margin: 0;
            color: var(--muted);
          }
          .persona-card__footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 16px;
          }
          .persona-card[data-expanded="false"] .persona-card__footer {
            margin-top: auto;
          }
          .persona-updated {
            font-size: 13px;
            color: var(--muted);
            display: inline-flex;
            align-items: baseline;
            gap: 4px;
          }
          .persona-updated__label {
            color: var(--accent-2);
            font-weight: 600;
          }
          .persona-status {
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            background: rgba(var(--accent-rgb, 43,108,176), 0.12);
            color: var(--accent-2);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
          }
          .persona-modal-container {
            display: flex;
            flex-direction: column;
            padding: 40px 72px 40px;
            gap: 40px;
            color: var(--text);
            height: 100%;
            flex: 1;
            overflow-y: auto;
            position: relative;
          }
          .persona-modal-container--expanded {
            overflow: hidden;
            gap: 40px;
          }
          @media (max-width: 900px) {
            .persona-modal-container {
              padding: 56px 32px 48px;
              gap: 40px;
            }
            .persona-modal-title-left {
              justify-content: center;
            }
            .persona-modal-title-chips {
              justify-content: center;
            }
            .persona-quant-actions {
              justify-content: center;
            }
            .persona-modal-secondary-row {
              grid-template-columns: 1fr;
            }
            .persona-edit-layout {
              grid-template-columns: 1fr;
            }
          }
          .persona-modal-title-wrapper {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 0 1 auto;
            min-width: 0;
            align-items: flex-start;
          }
          .persona-modal-title-display {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.4px;
            color: inherit;
            min-width: 140px;
            max-width: 100%;
            line-height: 1.2;
            background: transparent;
            border-radius: 8px;
            box-sizing: border-box;
            word-break: break-word;
          }
          .persona-modal-title-status {
            font-size: 12px;
            color: var(--muted);
            font-weight: 600;
          }
          .persona-modal-title-error {
            font-size: 12px;
            color: rgba(248, 163, 163, 0.95);
            font-weight: 600;
          }
          .persona-modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0;
            flex-wrap: wrap;
          }
          .persona-modal-header--with-mini {
            justify-content: space-between;
          }
          .persona-modal-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 16px;
            flex-wrap: wrap;
          }
          .persona-modal-title-left {
            display: flex;
            align-items: center;
            gap: 16px;
            flex: 2 1 600px;
            min-width: min(100%, 600px);
          }
          .persona-modal-title-chips {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
            flex: 0 0 auto;
          }
          .persona-modal-close {
            white-space: nowrap;
            background: transparent !important;
            color: #052033 !important;
          }
          .persona-modal-heading {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
            flex: 1 1 320px;
          }
          .persona-modal-option-body--edit {
            padding: 12px 0;
          }
          .persona-edit-layout {
            display: flex;
            width: 100%;
            gap: 24px;
            align-items: flex-start;
            flex-wrap: nowrap;
          }
          .persona-edit-column {
            flex: 1 1 0%;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-edit-aside {
            flex: 0 0 33%;
            max-width: 33%;
            min-width: 260px;
            display: flex;
            justify-content: flex-end;
          }
          .persona-edit-aside-grid {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-edit-aside-inner {
            width: 100%;
            max-width: none;
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(43, 108, 176, 0.28);
            border-radius: 18px;
            padding: 18px;
            box-shadow: 0 12px 28px rgba(10, 22, 40, 0.35);
            display: flex;
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }
          .persona-edit-aside-heading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          .persona-edit-aside-inner strong {
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(203, 213, 245, 0.75);
          }
          .persona-edit-aside-inner--secondary {
            background: rgba(14, 23, 48, 0.7);
          }
          .persona-edit-aside-button {
            border-radius: 999px;
            border: none; /* removed border entirely */
            background: transparent;
            color: var(--text);
            padding: 6px 14px;
            font-size: 12px;
            letter-spacing: 0.4px;
            cursor: pointer;
            transition: background 0.18s ease, box-shadow 0.18s ease;
          }
          .persona-edit-aside-button:hover,
          .persona-edit-aside-button:focus-visible {
            background: transparent; /* keep hover transparent */
            border: none;
            /* Keep an accessible focus ring for keyboard users */
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          @media (max-width: 1100px) {
            .persona-edit-layout {
              flex-direction: column;
            }
            .persona-edit-aside {
              flex: 0 0 auto;
              max-width: none;
              width: 100%;
              justify-content: center;
            }
            .persona-edit-aside-inner {
              max-width: 420px;
            }
            .persona-edit-name-wrapper {
              max-width: 100%;
            }
          }
          .persona-edit-documents {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }
          .persona-edit-documents--empty {
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed rgba(43, 108, 176, 0.35);
            border-radius: 14px;
            padding: 18px;
            color: rgba(203, 213, 245, 0.68);
            font-size: 12px;
            letter-spacing: 0.3px;
          }
          .persona-edit-documents-placeholder {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .persona-edit-document-card {
            position: relative;
            border-radius: 18px;
            border: 1px solid rgba(43, 108, 176, 0.28);
            background: rgba(14, 22, 40, 0.85);
            padding: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            text-align: center;
            box-shadow: 0 12px 25px rgba(8, 15, 30, 0.35);
          }
          .persona-edit-document-meta {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: rgba(226, 232, 240, 0.85);
          }
          .persona-edit-document-details {
            line-height: 1.4;
          }
          .persona-edit-document-actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .persona-edit-document-open {
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.45);
            background: rgba(24, 38, 66, 0.85);
            color: var(--accent-2);
            padding: 6px 16px;
            font-size: 12px;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-live-sources {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .persona-live-source-card {
            border-radius: 16px;
            border: 1px solid rgba(43, 108, 176, 0.25);
            background: rgba(18, 27, 46, 0.85);
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: center;
          }
          .persona-live-source-name {
            font-size: 13px;
            color: #e6eaff;
            letter-spacing: 0.4px;
            text-transform: uppercase;
          }
          .persona-live-source-meta {
            font-size: 11px;
            color: rgba(203, 213, 245, 0.75);
          }
          .persona-live-source-manage {
            margin-top: 4px;
            border-radius: 10px;
            border: 1px solid rgba(43, 108, 176, 0.4);
            background: rgba(24, 38, 66, 0.8);
            color: var(--accent-2);
            padding: 4px 12px;
            font-size: 11px;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-live-source-manage:hover,
          .persona-live-source-manage:focus-visible {
            background: rgba(32, 48, 76, 0.95);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          .persona-edit-document-open:hover,
          .persona-edit-document-open:focus-visible {
            background: rgba(32, 48, 76, 0.95);
            border-color: rgba(140, 170, 240, 0.7);
            outline: none;
          }
          .persona-edit-document-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            color: rgba(210, 222, 255, 0.85);
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-edit-document-close:hover,
          .persona-edit-document-close:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          /* Empty two-column grid placeholder shown at top of expanded Edit card */
          .persona-edit-top-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            width: 100%;
            margin-bottom: 12px;
            min-height: 40px; /* reserve visible space for future content */
            align-items: start;
            align-content: start;
          }
          .persona-edit-name-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            max-width: 50%;
            min-width: 0;
            position: relative;
          }
          .persona-edit-name-measure {
            position: absolute;
            visibility: hidden;
            white-space: pre;
            pointer-events: none;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.3px;
            font-family: inherit;
          }
          .persona-edit-name-input {
            width: 100%;
            flex: 1 1 auto;
            min-width: 0;
            border-radius: 14px;
            border: none;
            background: transparent;
            color: #e6eaff;
            padding: 8px 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.3px;
          }
          .persona-edit-name-icon {
            font-size: 14px;
            color: rgba(203, 213, 245, 0.6);
            flex-shrink: 0;
          }
          .persona-edit-name-input::placeholder {
            color: rgba(203, 213, 245, 0.5);
          }
          .persona-edit-name-input:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          .persona-edit-traits {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 6px;
          }
          .persona-edit-trait {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 999px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: rgba(20, 31, 58, 0.65);
            font-size: 11px;
            letter-spacing: 0.3px;
            color: rgba(230, 234, 255, 0.85);
            text-transform: uppercase;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
            font-family: inherit;
            appearance: none;
          }
          .persona-edit-trait:hover,
          .persona-edit-trait:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(43, 108, 176, 0.55);
            outline: none;
          }
          .persona-edit-trait-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .persona-edit-trait-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.18s ease;
          }
          .persona-edit-trait:hover .persona-edit-trait-close,
          .persona-edit-trait:focus-visible .persona-edit-trait-close {
            opacity: 1;
          }
          .persona-edit-trait--add {
            border-style: dashed;
            color: rgba(230, 234, 255, 0.75);
          }
          .persona-edit-trait--add .persona-edit-trait-close {
            opacity: 1;
          }
          .persona-edit-trait-form {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }
          .persona-edit-trait-input {
            border-radius: 10px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: rgba(15, 23, 42, 0.7);
            color: #e6eaff;
            padding: 6px 10px;
            font-size: 12px;
            letter-spacing: 0.3px;
          }
          .persona-edit-trait-input {
            min-width: 180px;
            flex: 1 1 160px;
          }
          .persona-edit-trait-actions {
            display: flex;
            gap: 6px;
          }
          .persona-edit-trait-save,
          .persona-edit-trait-cancel {
            border-radius: 999px;
            border: 1px solid rgba(43, 108, 176, 0.4);
            padding: 4px 12px;
            font-size: 12px;
            letter-spacing: 0.3px;
            color: #e6eaff;
            background: rgba(20, 31, 58, 0.7);
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-edit-trait-save:hover,
          .persona-edit-trait-save:focus-visible,
          .persona-edit-trait-cancel:hover,
          .persona-edit-trait-cancel:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          .persona-edit-trait-save:disabled,
          .persona-edit-trait-cancel:disabled {
            opacity: 0.6;
            cursor: wait;
          }
          .persona-edit-status {
            font-size: 12px;
            color: rgba(43, 108, 176, 0.8);
          }
          .persona-edit-error {
            font-size: 12px;
            color: #fca5a5;
          }
          .persona-edit-error--inline {
            margin-top: 6px;
            display: inline-block;
          }
          .persona-edit-description {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }
          .persona-edit-description textarea {
            width: 100%;
            min-height: 140px;
            border-radius: 14px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: rgba(15, 23, 42, 0.7);
            color: #e6eaff;
            padding: 18px;
            font-size: 14px;
            line-height: 1.6;
            resize: vertical;
          }
          .persona-edit-description textarea:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          .persona-results-table-wrapper {
            max-height: 220px;
            overflow-y: auto;
            margin-top: 4px;
            width: 100%;
          }
          .persona-results-table-wrapper::-webkit-scrollbar {
            width: 6px;
          }
          .persona-results-table-wrapper::-webkit-scrollbar-thumb {
            background: rgba(43, 108, 176, 0.12);
            border-radius: 999px;
          }
          .persona-results-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .persona-results-table th,
          .persona-results-table td {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(43, 108, 176, 0.12);
          }
          .persona-results-table th:nth-child(1),
          .persona-results-table td:nth-child(1) {
            width: 28%;
          }
          .persona-results-table th:nth-child(2),
          .persona-results-table td:nth-child(2) {
            width: 22%;
          }
          .persona-results-table th:nth-child(3),
          .persona-results-table td:nth-child(3) {
            width: 18%;
          }
          .persona-results-table th:nth-child(4),
          .persona-results-table td:nth-child(4) {
            width: 16%;
          }
          .persona-results-table th:nth-child(5),
          .persona-results-table td:nth-child(5) {
            text-align: right;
            width: 16%;
          }
          .persona-results-table th {
            text-transform: uppercase;
            letter-spacing: 0.6px;
            font-size: 11px;
            color: #052033;
          }
          .persona-results-table tbody tr:hover {
            background: rgba(15, 23, 42, 0.55);
          }
          .persona-results-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 16px;
            border-radius: 999px;
            font-weight: 600;
            font-size: 12px;
            background: rgba(43, 108, 176, 0.08);
            color: #052033;
            border: 1px solid rgba(43, 108, 176, 0.28);
            cursor: pointer;
          }
          .persona-results-chip:hover {
            background: rgba(43, 108, 176, 0.12);
          }
          .persona-results-chip--ghost {
            padding: 6px 14px;
            background: rgba(43, 108, 176, 0.06);
          }
          .persona-results-chip--ghost:hover {
            background: rgba(43, 108, 176, 0.08);
          }
          .persona-results-download {
            background: rgba(43, 108, 176, 0.06);
            color: #e6eaff;
            border: 1px solid rgba(43, 108, 176, 0.28);
            border-radius: 12px;
            padding: 6px 10px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .persona-results-download:hover {
            background: rgba(43, 108, 176, 0.12);
          }
          .persona-secondary-card-content--narrow {
            align-items: center;
            text-align: center;
          }
          .persona-secondary-card-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: rgba(43, 108, 176, 0.08);
            color: var(--accent-2);
            font-size: 18px;
            box-shadow: 0 8px 20px rgba(10, 22, 40, 0.28);
          }
          .persona-secondary-card h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #e6eaff;
          }
          .persona-secondary-card.persona-secondary-card--wide h3 {
            color: #052033;
          }
          .persona-secondary-card.persona-secondary-card--narrow h3 {
            color: #052033;
          }
          .persona-secondary-card p {
            margin: 0;
            color: #052033;
            font-size: 14px;
            line-height: 1.6;
          }
          .persona-modal-option-body--quant {
            display: flex;
            flex-direction: column;
            gap: 28px;
            width: 100%;
          }
          .persona-quant-actions {
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
            align-items: center;
          }
          .persona-quant-grid {
            display: flex;
            gap: 20px;
            width: 100%;
            /* center items vertically so actions column sits mid-height beside the preview */
            align-items: center;
            position: relative; /* for absolute positioning of actions column */
            /* make room on the right so the absolute actions column doesn't overlap the preview */
            padding-right: 260px;
          }
          .persona-quant-preview {
            /* Reduce width: use fixed base width with sensible max to keep preview narrower */
            flex: 0 0 520px;
            max-width: 520px;
            min-width: 320px;
            min-height: 360px;
            /* Allow taller previews on desktop but cap to avoid taking entire viewport */
            max-height: 720px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(43, 108, 176, 0.12);
            background: rgba(15, 23, 42, 0.9);
            display: flex;
            /* stretch children so embedded iframe can fill the container */
            align-items: stretch;
            justify-content: center;
          }
          .persona-quant-preview iframe {
            width: 100%;
            height: 100%;
            display: block;
            border: none;
          }
          .persona-quant-actions-col {
            width: 320px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center; /* center vertically within the grid */
            gap: 12px;
            /* position the actions column at the right-hand side of the expanded card */
            position: absolute;
            right: 24px;
            top: 50%;
            transform: translateY(-50%);
          }
          .persona-quant-file-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            justify-content: center;
            padding: 18px;
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.12);
            background: rgba(20, 28, 48, 0.8);
            color: #e6eaff;
            width: calc(100% - 40px);
            max-width: 560px;
          }
          .persona-quant-file-name {
            font-size: 14px;
            color: var(--muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
          }
          .persona-quant-download {
            display: inline-flex;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(43, 108, 176, 0.06);
            color: #e6eaff;
            text-decoration: none;
            font-weight: 600;
          }
          .persona-quant-action-square {
            width: 100%;
            height: 56px; /* taller rectangular touch target */
            min-height: 56px;
            border-radius: 8px; /* small corner radius, not pill */
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(20, 28, 48, 0.85);
            color: #e6eaff;
            border: 1px solid rgba(43, 108, 176, 0.28);
            cursor: pointer;
            padding: 0 12px; /* horizontal padding while vertical height comes from height */
          }
          .persona-quant-action-square:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.65);
            outline-offset: 3px;
          }
          .persona-quant-file {
            color: var(--muted);
            font-size: 13px;
            max-width: 520px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            align-self: center;
          }

          /* Make the quant preview stack on narrow screens for better responsiveness */
          @media (max-width: 1100px) {
            .persona-quant-grid {
              flex-direction: column;
              gap: 12px;
              padding-right: 0; /* no absolute actions on narrow screens */
            }
            .persona-quant-preview {
              flex: none;
              width: 100%;
              max-width: none;
              min-width: 0;
              min-height: 220px;
              /* On smaller screens limit height relative to viewport so it doesn't overflow */
              max-height: 60vh;
            }
            .persona-quant-actions-col {
              width: 100%;
              justify-content: flex-start; /* stacked: keep actions at top */
              position: static;
              transform: none;
              right: auto;
              top: auto;
            }
          }

          /* Make the quant content fill available vertical space so preview can stretch
             (previously centered which limited the grid/preview height). */
          .persona-modal-option-body-content.persona-modal-option-body-content--quant {
            display: flex;
            align-items: stretch; /* allow children to grow vertically */
            justify-content: center;
            width: 100%;
            height: 100%;
            min-height: 0;
          }
          .persona-quant-grid {
            /* let the grid expand to the available vertical space inside the content */
            height: 100%;
            min-height: 0;
          }
          .persona-quant-preview {
            /* allow the preview to take full height of the grid */
            height: 100%;
            min-height: 0;
          }
          .persona-modal-subheading-wrapper {
            margin-top: 12px;
            display: flex;
            justify-content: center;
          }
          .persona-modal-header--with-selection .persona-modal-subheading-wrapper {
            justify-content: flex-start;
          }
          .persona-modal-subheading {
            font-size: 15px;
            color: rgba(15, 23, 42, 0.78);
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
          }
          .persona-modal-subheading--card {
            font-size: 16px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.88);
            margin: 0;
          }
          .persona-modal-subheading-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            flex-shrink: 0;
          }
          .persona-modal-subheading-icon svg {
            width: 100%;
            height: 100%;
          }
            .persona-quant-actions {
              justify-content: center;
            }
            .persona-modal-secondary-row {
              grid-template-columns: 1fr;
            }
          }
          .persona-modal-body {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            flex: 1;
            min-height: 0;
          }
          .persona-modal-body--edit {
            flex: 1;
          }
          .persona-modal-option--edit {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .persona-modal-option-body--edit {
            flex: 1;
            display: flex;
          }
          .persona-modal-options {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 28px;
            width: 100%;
            transition: all 0.28s ease;
          }
          .persona-modal-options--has-selection {
            display: flex;
            justify-content: flex-start;
            align-items: stretch;
            gap: 0;
            flex: 1;
            width: 100%;
            min-height: 0;
            height: 100%;
          }

          /* When an option is expanded (e.g. Agent), make the expanded card fill the
             modal vertical space so it reaches down where the secondary row normally sits. */
          .persona-modal-options--has-selection .persona-modal-option--expanded {
            /* Use viewport-aware calc to account for modal chrome (padding/header). */
            min-height: calc(100vh - 220px);
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          @media (max-width: 900px) {
            .persona-modal-options--has-selection .persona-modal-option--expanded {
              min-height: auto;
              height: auto;
            }
          }
          @media (max-width: 1100px) {
            .persona-modal-options {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .persona-modal-options--has-selection {
              display: flex;
            }
            .persona-modal-option--initial {
              flex: 1 1 calc((100% - 24px) / 2);
            }
          }
          @media (max-width: 720px) {
            .persona-modal-options {
              grid-template-columns: minmax(0, 1fr);
            }
            .persona-modal-option--initial {
              flex: 1 1 100%;
            }
          }
          .persona-modal-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            padding: 32px 28px;
            border-radius: 24px;
            border: 1px solid rgba(43, 108, 176, 0.28);
            background: #d2e4ff;
            box-shadow: 0 16px 42px rgba(10, 22, 40, 0.38);
            color: inherit;
            text-align: center;
            cursor: pointer;
            transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease,
              background 0.24s ease, opacity 0.2s ease, max-width 0.28s ease, flex 0.28s ease,
              height 0.28s ease;
            max-width: 320px;
            width: 100%;
          }
          .persona-modal-option--initial {
            flex: 1 1 calc((100% - 48px) / 3);
            max-width: none;
            align-items: center;
            text-align: center;
            padding: 36px 32px;
          }
          .persona-modal-option:hover,
          .persona-modal-option:focus-visible {
            transform: translateY(-6px);
            border-color: rgba(43, 108, 176, 0.58);
            box-shadow: 0 22px 52px rgba(10, 22, 40, 0.46);
            background: rgba(24, 38, 66, 0.98);
            outline: none;
            color: inherit;
          }
          .persona-modal-option:hover h3,
          .persona-modal-option:focus-visible h3,
          .persona-modal-option:hover p,
          .persona-modal-option:focus-visible p {
            color: #d2e4ff;
          }
          .persona-modal-option--expanded {
            flex: 1;
            max-width: none;
            width: 100%;
            height: 100%;
            min-height: 0;
            align-items: flex-start;
            text-align: left;
            transform: none;
            background: rgba(28, 44, 74, 0.98);
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
            padding: 22px 30px;
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            margin: 0;
            cursor: default;
          }
          .persona-modal-option--expanded:hover,
          .persona-modal-option--expanded:focus-visible {
            transform: none;
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
            background: rgba(28, 44, 74, 0.98);
          }
          .persona-modal-option--dismissed {
            opacity: 0;
            transform: translateY(40px) scale(0.92);
            pointer-events: none;
            max-width: 0;
            width: 0;
            padding: 0;
            margin: 0;
            border-width: 0;
          }
          .persona-modal-option-header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 18px;
            width: 50%;
          }
          .persona-modal-option--initial .persona-modal-option-header {
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            width: 100%;
          }
          .persona-modal-option-copy {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: left;
            text-align: inherit;
            width: 100%;
          }
          .persona-modal-option--initial .persona-modal-option-copy {
            align-items: center;
            text-align: center;
            gap: 12px;
          }
          .persona-modal-option-titles {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .persona-modal-option--expanded .persona-modal-option-titles h3 {
            margin: 0;
          }
          .persona-modal-option-body {
            margin-top: 8px;
            width: 100%;
            flex: 1;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .persona-modal-option-body-content {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
          }
          .persona-modal-option-body > * {
            flex: 1;
            min-height: 0;
          }
          .persona-modal-option h3 {
            margin: 0 0 10px;
            font-size: 20px;
            font-weight: 700;
          }
          .persona-modal-option--initial h3 {
            font-size: 22px;
          }
          .persona-modal-option p {
            margin: 0;
            font-size: 15px;
            color: #052033;
            line-height: 1.6;
          }
          .persona-modal-icon {
            width: 58px;
            height: 58px;
            border-radius: 20px;
            background: rgba(43, 108, 176, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 0 1px rgba(43, 108, 176, 0.12);
            margin-bottom: 6px;
          }
          .persona-modal-icon--mini {
            width: 16px;
            height: 16px;
            margin-bottom: 0;
            background: none;
            box-shadow: none;
            border-radius: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
          }
        /* Theme variables for a lighter navy-themed palette. Adjust here to tune the theme. */
        :global(.persona-root) {
          --bg: #f4f8ff; /* page background (very light bluish) */
          --panel: #f4f8ff; /* panel/card background */
          --panel-2: #f4f8ff; /* slightly bluish panel */
          --accent: #2b6cb0; /* primary accent (navy-blue) */
          --accent-2: #7fb3ff; /* lighter accent */
          --accent-rgb: 43,108,176;
          --text: #052033; /* primary text (dark navy) */
          --muted: #475569; /* muted text */
          --muted-2: #6b7280; /* secondary muted */
          --danger: #ef4444;
        }

        `}</style>
        </div>
      </div>
    </main>
  );
}
