"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  exportTranscriptToPdf,
  type PdfTranscriptMessage,
  type TranscriptPdfPayload,
} from "@/app/lib/exportTranscriptPdf";

type HistorySidebarProps = {
  isOpen: boolean;
  onCloseAction: () => void;
};

type DialogueRecord = {
  id: string;
  call_summary_title: string | null;
  received_at: string | null;
  research_type: string | null;
  transcript: unknown;
  agent_id: string | null;
};

type TranscriptMessage = PdfTranscriptMessage;

const CHIP_COLOR_TOKENS: Array<{
  background: string;
  border: string;
  color: string;
}> = [
  {
    background: "rgba(30,64,175,0.1)",
    border: "1px solid rgba(30,64,175,0.25)",
    color: "#1e40af",
  },
  {
    background: "rgba(22,101,52,0.12)",
    border: "1px solid rgba(22,101,52,0.22)",
    color: "#166534",
  },
  {
    background: "rgba(180,83,9,0.12)",
    border: "1px solid rgba(180,83,9,0.22)",
    color: "#b45309",
  },
  {
    background: "rgba(79,70,229,0.12)",
    border: "1px solid rgba(79,70,229,0.22)",
    color: "#4f46e5",
  },
];

const CHIP_BASE_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.3px",
  padding: "4px 10px",
  fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
};

function getResearchChipStyle(value: string): CSSProperties {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return CHIP_BASE_STYLE;
  }
  const hashSeed = Array.from(normalized).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palette = CHIP_COLOR_TOKENS[hashSeed % CHIP_COLOR_TOKENS.length];
  return {
    ...CHIP_BASE_STYLE,
    background: palette.background,
    border: palette.border,
    color: palette.color,
  };
}

function coerceTranscriptArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return coerceTranscriptArray(parsed);
    } catch {
      return [];
    }
  }

  if (value && typeof value === "object") {
    const container = value as Record<string, unknown>;
    const candidateKeys = ["messages", "entries", "transcript", "conversation", "data", "logs"];
    for (const key of candidateKeys) {
      const candidate = container[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
}

function normalizeTranscriptMessages(value: unknown): TranscriptMessage[] {
  const rawEntries = coerceTranscriptArray(value);

  if (rawEntries.length === 0) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return [];
      }

      const pattern = /(^|\n\s*)(Agent|Assistant|AI|Persona|System|User|Customer|Client|You)\s*:\s*/gi;
      const segments: Array<{ roleLabel: string; text: string }> = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null = pattern.exec(trimmed);

      while (match) {
        const [, prefix, label] = match;
        const matchIndex = match.index ?? 0;
        const prefixLength = prefix?.length ?? 0;
        const start = matchIndex + prefixLength;
        if (segments.length > 0) {
          const prev = segments[segments.length - 1];
          prev.text = trimmed.slice(lastIndex, matchIndex).trim();
        }
        segments.push({ roleLabel: label ?? "Agent", text: "" });
        lastIndex = pattern.lastIndex;
        match = pattern.exec(trimmed);
      }

      if (segments.length > 0) {
        const finalSegment = segments[segments.length - 1];
        finalSegment.text = trimmed.slice(lastIndex).trim();

        const labelToRole = (label: string): TranscriptMessage["role"] => {
          const normalized = label.trim().toLowerCase();
          if (["user", "customer", "client", "you"].includes(normalized)) {
            return "user";
          }
          return "agent";
        };

        return segments
          .map((segment) => ({
            role: labelToRole(segment.roleLabel),
            text: segment.text,
          }))
          .filter((segment) => segment.text.length > 0);
      }

      return trimmed.length > 0 ? [{ role: "agent", text: trimmed }] : [];
    }
    return [];
  }

  const normalized: TranscriptMessage[] = [];

  const toRole = (roleInput: unknown, fallbackUserFlag?: boolean): TranscriptMessage["role"] => {
    if (typeof roleInput === "string") {
      const role = roleInput.trim().toLowerCase();
      if (role.includes("user") || role.includes("customer") || role.includes("client") || role === "human" || role === "lead") {
        return "user";
      }
      if (role.includes("assistant") || role.includes("agent") || role.includes("persona") || role.includes("ai") || role.includes("system")) {
        return "agent";
      }
    }
    if (typeof fallbackUserFlag === "boolean") {
      return fallbackUserFlag ? "user" : "agent";
    }
    return "agent";
  };

  const toText = (input: unknown): string => {
    if (typeof input === "string") {
      return input.trim();
    }
    if (Array.isArray(input)) {
      return input
        .map((part) => (typeof part === "string" ? part : typeof part === "object" ? JSON.stringify(part) : ""))
        .join(" ")
        .trim();
    }
    if (input && typeof input === "object") {
      try {
        return JSON.stringify(input);
      } catch {
        return String(input);
      }
    }
    return typeof input === "number" || typeof input === "boolean" ? String(input) : "";
  };

  for (const entry of rawEntries) {
    if (entry == null) {
      continue;
    }

    if (typeof entry === "string") {
      const text = entry.trim();
      if (text.length > 0) {
        normalized.push({ role: "agent", text });
      }
      continue;
    }

    if (typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const roleCandidate = record.role ?? record.speaker ?? record.sender ?? record.author ?? record.type ?? record.from;
    const roleFallbackFlag = typeof record.is_user === "boolean" ? record.is_user : typeof record.from_user === "boolean" ? record.from_user : undefined;
    const role = toRole(roleCandidate, roleFallbackFlag);

    const textCandidate =
      record.text ??
      record.message ??
      record.content ??
      record.body ??
      record.value ??
      record.transcript_text ??
      record.message_text ??
      record.summary;

    const text = toText(textCandidate);

    if (text.length === 0) {
      continue;
    }

    normalized.push({ role, text });
  }

  return normalized;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Unknown date";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function HistorySidebar({ isOpen, onCloseAction }: HistorySidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [dialogues, setDialogues] = useState<DialogueRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDialogueId, setExpandedDialogueId] = useState<string | null>(null);
    const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [downloadingDialogueId, setDownloadingDialogueId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      if (isMounted) {
        setAgentNames({});
      }
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (!userData?.user) {
          if (!isMounted) return;
          setDialogues([]);
          setError("Sign in to view your conversation history.");
          return;
        }

        const { data, error } = await supabase
          .from("dialogues")
          .select("id, call_summary_title, received_at, research_type, transcript, agent_id")
          .eq("user_id", userData.user.id)
          .order("received_at", { ascending: false })
          .limit(30);

        if (!isMounted) return;

        if (error) {
          throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        setDialogues(rows);

        const agentIds = Array.from(
          new Set(
            rows
              .map((row) => (typeof row.agent_id === "string" && row.agent_id.trim().length > 0 ? row.agent_id.trim() : null))
              .filter((value): value is string => Boolean(value)),
          ),
        );

        if (agentIds.length > 0) {
          const { data: agentRows, error: agentError } = await supabase
            .from("agent_map")
            .select("agent_id, agent_name")
            .in("agent_id", agentIds);

          if (!isMounted) return;

          if (agentError) {
            console.warn("[HistorySidebar] Failed to load agent names", agentError);
          } else if (Array.isArray(agentRows)) {
            setAgentNames((previous) => {
              const next = { ...previous };
              for (const row of agentRows) {
                if (typeof row?.agent_id === "string" && row.agent_id.trim().length > 0) {
                  const agentId = row.agent_id.trim();
                  const agentName =
                    typeof row.agent_name === "string" && row.agent_name.trim().length > 0
                      ? row.agent_name.trim()
                      : "Unknown persona";
                  next[agentId] = agentName;
                }
              }
              return next;
            });
          }
        }
      } catch (fetchError) {
        if (!isMounted) return;
        console.error("[HistorySidebar] Failed to load dialogues", fetchError);
        setError("Unable to load conversations right now.");
        setDialogues([]);
        setAgentNames({});
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseAction();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCloseAction]);

  useEffect(() => {
    if (!isOpen) {
      setExpandedDialogueId(null);
    }
  }, [isOpen]);

  const handleOverlayClick = useCallback(() => {
    onCloseAction();
  }, [onCloseAction]);

  const handleTranscriptDownload = useCallback(async (dialogueId: string, payload: TranscriptPdfPayload) => {
    try {
      setDownloadingDialogueId(dialogueId);
      await exportTranscriptToPdf(payload);
    } catch (downloadError) {
      console.error("[HistorySidebar] Failed to export transcript", downloadError);
    } finally {
      setDownloadingDialogueId(null);
    }
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "rgba(15, 23, 42, 0.75)",
          }}
        >
          Loading conversations...
        </p>
      );
    }

    if (error) {
      return (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "#b91c1c",
          }}
        >
          {error}
        </p>
      );
    }

    if (dialogues.length === 0) {
      return (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "rgba(15, 23, 42, 0.7)",
          }}
        >
          No conversations yet. Begin a new dialogue to see it appear here.
        </p>
      );
    }

    return (
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
          maxHeight: "calc(100vh - 220px)",
        }}
      >
        {dialogues.map((dialogue) => {
          const title = dialogue.call_summary_title?.trim().length
            ? dialogue.call_summary_title.trim()
            : "Untitled conversation";
          const researchTypeRaw = dialogue.research_type?.trim();
          const researchType = researchTypeRaw?.length
            ? `${researchTypeRaw.charAt(0).toUpperCase()}${researchTypeRaw.slice(1)}`
            : undefined;
          const researchChipStyle = researchTypeRaw ? getResearchChipStyle(researchTypeRaw) : undefined;
          const transcriptRaw = dialogue.transcript;
          const transcriptMessages = normalizeTranscriptMessages(transcriptRaw);
          const hasTranscriptMessages = transcriptMessages.length > 0;
          const fallbackTranscript = typeof transcriptRaw === "string"
            ? transcriptRaw.trim()
            : transcriptRaw == null
            ? ""
            : JSON.stringify(transcriptRaw, null, 2);
          const agentId = typeof dialogue.agent_id === "string" && dialogue.agent_id.trim().length > 0
            ? dialogue.agent_id.trim()
            : null;
          const personaName = agentId && agentNames[agentId]
            ? agentNames[agentId]
            : agentId
            ? "Unknown persona"
            : "Unknown persona";
          const timestampLabel = formatTimestamp(dialogue.received_at);
          const isExpanded = expandedDialogueId === dialogue.id;
          const transcriptElementId = `portal-history-transcript-${dialogue.id}`;
          return (
            <li
              key={dialogue.id}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(248,250,252,0.9)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: isExpanded ? 12 : 8,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedDialogueId((current) => (current === dialogue.id ? null : dialogue.id))
                }
                aria-expanded={isExpanded ? "true" : "false"}
                aria-controls={transcriptElementId}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 8,
                  textAlign: "left",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "rgba(15, 23, 42, 0.72)",
                        fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                        letterSpacing: "0.2px",
                      }}
                    >
                      {personaName}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(15, 23, 42, 0.55)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 160ms ease",
                      }}
                    >
                      <svg
                        width={12}
                        height={12}
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ display: "block" }}
                      >
                        <path
                          d="M3 4.5L6 7.5L9 4.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#0f172a",
                      fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                    }}
                  >
                    {title}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "rgba(15, 23, 42, 0.55)",
                    }}
                  >
                    {formatTimestamp(dialogue.received_at)}
                  </span>
                  {researchType && researchChipStyle ? (
                    <span style={researchChipStyle}>{researchType}</span>
                  ) : null}
                </div>
              </button>
              {isExpanded ? (
                <div
                  id={transcriptElementId}
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "rgba(255,255,255,0.9)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {hasTranscriptMessages ? (
                    transcriptMessages.map((message, index) => {
                      const isUserMessage = message.role === "user";
                      return (
                        <div
                          key={`${dialogue.id}-message-${index}`}
                          style={{
                            display: "flex",
                            justifyContent: isUserMessage ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: isUserMessage ? "flex-end" : "flex-start",
                              gap: 4,
                              maxWidth: "85%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.3px",
                                color: "rgba(15, 23, 42, 0.55)",
                                textTransform: "uppercase",
                                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                                textAlign: isUserMessage ? "right" : "left",
                              }}
                            >
                              {isUserMessage ? "You" : personaName}
                            </span>
                            <div
                              style={{
                                background: isUserMessage
                                  ? "linear-gradient(135deg, #1d4ed8, #4338ca)"
                                  : "rgba(15,23,42,0.05)",
                                color: isUserMessage ? "#ffffff" : "rgba(15, 23, 42, 0.82)",
                                borderRadius: isUserMessage
                                  ? "18px 18px 4px 18px"
                                  : "18px 18px 18px 4px",
                                padding: "10px 14px",
                                fontSize: 13,
                                lineHeight: 1.55,
                                whiteSpace: "pre-wrap",
                                boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
                              }}
                            >
                              {message.text}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : fallbackTranscript ? (
                    <span
                      style={{
                        color: "rgba(15, 23, 42, 0.78)",
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {fallbackTranscript}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        color: "rgba(15, 23, 42, 0.55)",
                      }}
                    >
                      Transcript not available.
                    </span>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleTranscriptDownload(dialogue.id, {
                          conversationTitle: title,
                          personaName,
                          researchType,
                          timestampLabel,
                          messages: transcriptMessages,
                          fallbackText: fallbackTranscript,
                        })
                      }
                      disabled={downloadingDialogueId === dialogue.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,0.16)",
                        background: "rgba(15,23,42,0.06)",
                        color: "#0f172a",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: "0.2px",
                        cursor: "pointer",
                        fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                        opacity: downloadingDialogueId === dialogue.id ? 0.6 : 1,
                        pointerEvents: downloadingDialogueId === dialogue.id ? "none" : "auto",
                      }}
                      aria-label="Download transcript as PDF"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }, [agentNames, dialogues, error, expandedDialogueId, loading]);

  return (
    <>
      <div
        onClick={handleOverlayClick}
        role="presentation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15,23,42,0.45)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 180ms ease",
          zIndex: 118,
        }}
      />
      <aside
        id="portal-history-panel"
        role="complementary"
        aria-hidden={isOpen ? "false" : "true"}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "min(420px, 85vw)",
          background: "#ffffff",
          boxShadow: "12px 0 32px rgba(15,23,42,0.14)",
          borderRight: "1px solid rgba(15,23,42,0.08)",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 220ms ease",
          zIndex: 121,
          display: "flex",
          flexDirection: "column",
          padding: "28px 24px 36px",
          gap: 20,
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: "#0f172a",
              fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
            }}
          >
            History
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseAction}
            aria-label="Close history panel"
            style={{
              border: "none",
              background: "transparent",
              color: "#0f172a",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1,
              padding: 4,
            }}
          >
            X
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "rgba(15, 23, 42, 0.7)",
            lineHeight: 1.6,
          }}
        >
          Browse and export your past chats and interviews with personas.
        </p>
        {content}
      </aside>
    </>
  );
}
