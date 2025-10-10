"use client";

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";

import DialogueBarTalkButton from "@/app/components/DialogueBarTalkButton";
import {
  clientMap,
  getClientDataPath,
} from "@/app/lib/clientMap";
import { docMap } from "@/app/lib/docMap";
import type { ConversationKnowledgeRecord } from "@/app/lib/clientKnowledgeStore";

type ClientDataPayload = {
  updatedAt: string;
  conversations: ConversationKnowledgeRecord[];
  questions: string[];
};

type TranscriptBubble = {
  role: "agent" | "user" | "system";
  text: string;
};

type ClientAgentInfo = {
  agentId: string;
  label: string;
};

type SidebarSection = "home" | "agents" | "dialogues" | "chat" | "settings";

type LeadRow = {
  email: string;
  count: number;
  latestCapturedAt?: string;
  latestCallId?: string;
};

type QuestionLead = {
  question: string;
  capturedAt?: string;
  callId?: string;
  agentLabel?: string;
};

function parseTimestampValue(value?: string) {
  if (!value) return -Infinity;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

function dedupeConversationsList(items: ConversationKnowledgeRecord[]) {
  const map = new Map<string, ConversationKnowledgeRecord>();

  const weight = (item: ConversationKnowledgeRecord) => {
    let score = 0;
    if (item.summarySubject && item.summarySubject.trim()) score += 4;
    if (item.summary && item.summary.trim()) score += 3;
    if (item.transcriptSummary && item.transcriptSummary.trim()) score += 2;
    if (item.transcriptText && item.transcriptText.trim()) score += 1;
    if (item.dataCollectionResults && Object.keys(item.dataCollectionResults).length) score += 1;
    return score;
  };

  items.forEach((item) => {
    if (!item || !item.callId) return;
    const existing = map.get(item.callId);
    if (!existing) {
      map.set(item.callId, item);
      return;
    }

    const existingScore = weight(existing);
    const candidateScore = weight(item);
    const existingTime = parseTimestampValue(existing.capturedAt);
    const candidateTime = parseTimestampValue(item.capturedAt);

    if (
      candidateScore > existingScore ||
      (candidateScore === existingScore && candidateTime > existingTime)
    ) {
      map.set(item.callId, item);
    }
  });

  const unique: ConversationKnowledgeRecord[] = Array.from(map.values());
  unique.sort((a, b) => parseTimestampValue(b.capturedAt) - parseTimestampValue(a.capturedAt));
  const noId = items.filter((item) => !item?.callId);
  return [...unique, ...noId];
}

function formatDate(timestamp: string | null | undefined) {
  if (!timestamp) return "Unknown time";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSlugTitle(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractResultValue(entry: unknown): unknown {
  if (!entry || typeof entry !== "object") return null;
  const candidate = (entry as { value?: unknown }).value;
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    const looksLikeJson = /^(\{|\[)(.*)(\}|\])$/.test(trimmed);
    if (looksLikeJson) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        try {
          const normalized = trimmed
            .replace(/\r?\n/g, "")
            .replace(/([\{\[,\s])'([^']*)'(?=\s*[:,\}])/g, '$1"$2"')
            .replace(/'([^']*)'/g, '"$1"');
          return JSON.parse(normalized);
        } catch (error2) {
          return trimmed;
        }
      }
    }
    return trimmed;
  }
  return candidate;
}

function parseTranscriptMessages(raw: string | null | undefined): TranscriptBubble[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) {
        return { role: "agent" as const, text: line };
      }
      const roleCandidate = line.slice(0, separatorIndex).trim().toLowerCase();
      const text = line.slice(separatorIndex + 1).trim();
      if (!text) return { role: "agent" as const, text: line };
      if (roleCandidate === "user") return { role: "user" as const, text };
      if (roleCandidate === "system") return { role: "system" as const, text };
      return { role: "agent" as const, text };
    });
}

type ConversationTabsProps = {
  activeTab: "summary" | "transcript" | "data" | "questions";
  onTabChange: (tab: "summary" | "transcript" | "data" | "questions") => void;
  conversation: ConversationKnowledgeRecord;
  dataCollectionEntries: [string, unknown][];
  aggregatedQuestions: string[];
};

function ConversationTabs({
  activeTab,
  onTabChange,
  conversation,
  dataCollectionEntries,
  aggregatedQuestions,
}: ConversationTabsProps) {
  const conversationQuestions = dataCollectionEntries
    .filter(([key]) => key.toLowerCase().includes("question"))
    .map(([, value]) => extractResultValue(value))
    .filter((value): value is string => Boolean(value && value.length > 0));

  const transcriptMessages = useMemo(
    () => parseTranscriptMessages(conversation.transcriptText),
    [conversation.transcriptText]
  );

  const renderDataValue = (value: unknown) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
          {value.map((item, index) => (
            <li key={index}>{renderDataValue(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === "object") {
      const keys = Object.keys(value as Record<string, unknown>);
      if (!keys.length) return "—";
      return (
        <pre
          style={{
            margin: "6px 0 0",
            background: "#f8fafc",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return "—";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flex: "1 1 auto",
        minHeight: 0,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {["summary", "transcript", "data", "questions"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab as typeof activeTab)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border:
                activeTab === tab
                  ? "1px solid rgba(37, 99, 235, 0.55)"
                  : "1px solid rgba(203, 213, 225, 0.8)",
              background: activeTab === tab ? "rgba(37, 99, 235, 0.12)" : "#ffffff",
              color: activeTab === tab ? "#1d4ed8" : "#475569",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "background 0.18s ease, border 0.18s ease",
              boxShadow:
                activeTab === tab ? "0 4px 10px rgba(37, 99, 235, 0.08)" : "0 1px 4px rgba(15, 23, 42, 0.05)",
            }}
          >
            {formatKey(tab)}
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 4,
          flex: "1 1 auto",
          overflowY: "auto",
          paddingRight: 4,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
        }}
      >
        {activeTab === "summary" ? (
          conversation.summary ? (
            <p style={{ margin: 0, lineHeight: 1.55 }}>{conversation.summary}</p>
          ) : (
            <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.9)" }}>
              No summary captured for this conversation.
            </p>
          )
        ) : null}

        {activeTab === "transcript" ? (
          transcriptMessages.length ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {transcriptMessages.map((message, index) => {
                const alignSelf =
                  message.role === "user"
                    ? "flex-end"
                    : message.role === "agent"
                    ? "flex-start"
                    : "center";
                const label =
                  message.role === "user"
                    ? "User"
                    : message.role === "agent"
                    ? "Agent"
                    : message.role === "system"
                    ? "System"
                    : "";

                return (
                  <div
                    key={`${message.role}-${index}-${message.text.slice(0, 12)}`}
                    style={{
                      alignSelf,
                      maxWidth: "80%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {label ? (
                      <span
                        style={{
                          fontSize: 11,
                          letterSpacing: 0.2,
                          color: "rgba(71, 85, 105, 0.85)",
                          alignSelf,
                        }}
                      >
                        {label}
                      </span>
                    ) : null}
                    <div
                      style={{
                        background:
                          message.role === "user"
                            ? "linear-gradient(135deg, rgba(37, 99, 235, 0.82), rgba(14, 165, 233, 0.82))"
                            : message.role === "agent"
                            ? "#f1f5f9"
                            : "#e2e8f0",
                        color: message.role === "user" ? "#ffffff" : "#1f2937",
                        padding: "10px 14px",
                        borderRadius:
                          message.role === "user"
                            ? "16px 16px 4px 16px"
                            : message.role === "agent"
                            ? "16px 16px 16px 4px"
                            : "12px",
                        boxShadow: "0 3px 14px rgba(15, 23, 42, 0.08)",
                        fontSize: 14,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {message.text}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.9)" }}>
              No transcript available for this conversation.
            </p>
          )
        ) : null}

        {activeTab === "data" ? (
          dataCollectionEntries.length ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                display: "grid",
                gap: 6,
                fontSize: 14,
              }}
            >
              {dataCollectionEntries.map(([key, value]) => {
                const extracted = extractResultValue(value);
                return (
                  <li key={key}>
                    <strong>{formatKey(key)}:</strong> {renderDataValue(extracted)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.9)" }}>
              No data collection captured in this conversation.
            </p>
          )
        ) : null}

        {activeTab === "questions" ? (
          conversationQuestions.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {conversationQuestions.map((question, index) => (
                <div
                  key={`${question}-${index}`}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid rgba(148, 163, 184, 0.45)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#1f2937",
                  }}
                >
                  {question}
                </div>
              ))}
            </div>
          ) : aggregatedQuestions.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {aggregatedQuestions.map((question, index) => (
                <div
                  key={`${question}-${index}`}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid rgba(148, 163, 184, 0.45)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#1f2937",
                  }}
                >
                  {question}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.9)" }}>
              No questions captured yet.
            </p>
          )
        ) : null}

     </div>
    </div>
  );
}

export default function ClientInsightsChat() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();

  const normalizedClient = client?.toLowerCase() ?? "";
  const entry = normalizedClient ? clientMap[normalizedClient] : undefined;
  const clientAgents = useMemo<ClientAgentInfo[]>(() => {
    if (!entry) return [];
    const items: ClientAgentInfo[] = [];

    entry.slugKeys.forEach((slug) => {
      const docEntry = docMap[slug];
      if (!docEntry?.agentId) return;
      items.push({
        agentId: docEntry.agentId,
        label:
          docEntry.agentName ||
          docEntry.talkLabel ||
          docEntry.workLabel ||
          formatSlugTitle(slug),
      });
    });

    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.agentId)) return false;
      seen.add(item.agentId);
      return true;
    });
  }, [entry]);

  const queryAgentId = searchParams?.get("agentId") ?? "";
  const clientAgentId = entry?.clientAgentId ?? queryAgentId ?? "";
  const dataFeedUrl = normalizedClient ? getClientDataPath(normalizedClient) : "";

  const [questions, setQuestions] = useState<string[]>([]);
  const [conversations, setConversations] = useState<ConversationKnowledgeRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [homeTimeframe, setHomeTimeframe] = useState<"day" | "week" | "month" | "quarter">(
    "week"
  );
  const [activeAgentFilter, setActiveAgentFilter] = useState<string>("all");
  const [activeSidebarSection, setActiveSidebarSection] =
    useState<SidebarSection>("dialogues");
  const [activeTab, setActiveTab] = useState<
    "summary" | "transcript" | "data" | "questions"
  >(
    "summary"
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!normalizedClient || !dataFeedUrl) {
      setQuestions([]);
      setConversations([]);
      setActiveAgentFilter("all");
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setDataError(null);
      try {
        const res = await fetch(dataFeedUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        const payload = (await res.json()) as ClientDataPayload;
        if (cancelled) return;
        const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
        const rawConversations = Array.isArray(payload.conversations)
          ? payload.conversations
          : [];
        setQuestions(rawQuestions);
        setConversations(dedupeConversationsList(rawConversations));
        setSelectedIndex(0);
        setActiveTab("summary");
        setActiveAgentFilter("all");
      } catch (error) {
        if (cancelled) return;
        setDataError(
          error instanceof Error ? error.message : "Unable to load conversation data."
        );
        setQuestions([]);
        setConversations([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [dataFeedUrl, normalizedClient]);

  if (!normalizedClient || !entry) {
    return (
      <FallbackState
        title="Unknown client"
        description={
          <>
            <strong>Unknown client slug:</strong> <code>{client ?? "—"}</code>
          </>
        }
      />
    );
  }

  if (!clientAgentId) {
    return (
      <FallbackState
        title={`${entry.displayName} has no insights agent configured`}
        description={
          <>
            Add <code>clientAgentId</code> to <code>clientMap</code> or pass <code>?agentId=</code>.
          </>
        }
      />
    );
  }

  const primaryDoc = entry.slugKeys[0];
  const serverLocation = (primaryDoc && docMap[primaryDoc]?.region) || "us";

  const filteredConversations = useMemo(() => {
    if (activeAgentFilter === "all") return conversations;
    return conversations.filter((conversation) => conversation.agentId === activeAgentFilter);
  }, [activeAgentFilter, conversations]);

  const agentFilterOptions = useMemo(
    () => [
      { value: "all", label: "All agents" },
      ...clientAgents.map((agent) => ({
        value: agent.agentId,
        label: agent.label,
      })),
    ],
    [clientAgents]
  );

  const agentLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    clientAgents.forEach((agent) => map.set(agent.agentId, agent.label));
    return map;
  }, [clientAgents]);

  const homeTimeframeOptions = useMemo(
    () => [
      { value: "day" as const, label: "Day" },
      { value: "week" as const, label: "Week" },
      { value: "month" as const, label: "Month" },
      { value: "quarter" as const, label: "Quarter" },
    ],
    []
  );

  const sidebarItems = useMemo(
    () => [
      {
        key: "home",
        label: "Home",
        icon: (
          <svg
            aria-hidden="true"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5.25 12.75v7.5h4.5v-4.5h4.5v4.5h4.5v-7.5" />
          </svg>
        ),
      },
      {
        key: "agents",
        label: "Agents",
        icon: (
          <svg
            aria-hidden="true"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            <path d="M5.25 19.5v-.75A4.5 4.5 0 0 1 9.75 14.25h4.5A4.5 4.5 0 0 1 18.75 18v1.5" />
          </svg>
        ),
      },
      {
        key: "dialogues",
        label: "Dialogues",
        icon: (
          <svg
            aria-hidden="true"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15h-2.75L9 18.25V15H8.5A3.5 3.5 0 0 1 5 11.5v-5Z" />
          </svg>
        ),
      },
      {
        key: "chat",
        label: "Chat",
        icon: (
          <svg
            aria-hidden="true"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8.25h12M6 12h7.5" />
            <path d="M4.5 4.5h15v11.25H14.25L9 20.25v-4.5H4.5V4.5Z" />
          </svg>
        ),
      },
      {
        key: "settings",
        label: "Settings",
        icon: (
          <svg
            aria-hidden="true"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9.75a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5Z" />
            <path d="M19.5 12a7.5 7.5 0 0 0-.073-.998l2.287-1.781-2-3.464-2.735 1.093a7.503 7.503 0 0 0-1.731-.998L15 3h-6l-.248 2.852a7.503 7.503 0 0 0-1.731.998L4.286 5.757l-2 3.464 2.287 1.781A7.51 7.51 0 0 0 4.5 12c0 .339.025.673.073.998l-2.287 1.781 2 3.464 2.735-1.093c.53.41 1.11.75 1.731.998L9 21h6l.248-2.852c.621-.248 1.201-.588 1.731-.998l2.735 1.093 2-3.464-2.287-1.781c.048-.325.073-.659.073-.998Z" />
          </svg>
        ),
      },
    ],
    []
  );

  const homeAgentChart = useMemo(() => {
    const counts = new Map<string, number>();
    agentLabelLookup.forEach((_, agentId) => counts.set(agentId, 0));

    const now = new Date();
    const start = (() => {
      const base = new Date(now);
      switch (homeTimeframe) {
        case "day":
          base.setDate(base.getDate() - 1);
          return base;
        case "week":
          base.setDate(base.getDate() - 7);
          return base;
        case "month":
          base.setMonth(base.getMonth() - 1);
          return base;
        case "quarter":
          base.setMonth(base.getMonth() - 3);
          return base;
        default:
          return null;
      }
    })();

    conversations.forEach((conversation) => {
      const { agentId, capturedAt } = conversation;
      if (!agentId) return;
      const timestamp = new Date(capturedAt);
      if (Number.isNaN(timestamp.getTime())) return;
      if (start && timestamp < start) return;
      const next = (counts.get(agentId) ?? 0) + 1;
      counts.set(agentId, next);
    });

    const rows = Array.from(counts.entries()).map(([agentId, count]) => ({
      agentId,
      count,
      label: agentLabelLookup.get(agentId) ?? agentId,
    }));

    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);

    return { rows, maxCount };
  }, [agentLabelLookup, conversations, homeTimeframe]);

  const homeChartRows = homeAgentChart.rows;
  const homeChartMax = homeAgentChart.maxCount > 0 ? homeAgentChart.maxCount : 1;
  const hasHomeRows = homeChartRows.length > 0;
  const hasHomeVolume = homeChartRows.some((row) => row.count > 0);

  const totalConversationsCount = useMemo(() => conversations.length, [conversations]);
  const totalConversationSeconds = useMemo(() => {
    let total = 0;
    conversations.forEach((conversation) => {
      const value = conversation.callDurationSecs;
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        total += value;
      }
    });
    return total;
  }, [conversations]);

  const formatSecondsAsDuration = useMemo(() => {
    return (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const parts: string[] = [];
      if (hours) parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      if (secs || !parts.length) parts.push(`${secs}s`);
      return parts.join(" ");
    };
  }, []);

  const buildLeadRows = (key: "summaryEmails" | "contactEmails"): LeadRow[] => {
    const map = new Map<string, LeadRow>();
    conversations.forEach((conversation) => {
      const list = conversation[key];
      if (!Array.isArray(list)) return;
      list.forEach((raw) => {
        if (typeof raw !== "string") return;
        const trimmed = raw.trim();
        if (!trimmed) return;
        const normalized = trimmed.toLowerCase();
        const capturedAt = conversation.capturedAt || undefined;
        const existing = map.get(normalized);
        if (existing) {
          existing.count += 1;
          const nextTime = parseTimestampValue(capturedAt);
          if (nextTime > parseTimestampValue(existing.latestCapturedAt)) {
            existing.latestCapturedAt = capturedAt;
            existing.latestCallId = conversation.callId;
          }
        } else {
          map.set(normalized, {
            email: trimmed,
            count: 1,
            latestCapturedAt: capturedAt,
            latestCallId: conversation.callId,
          });
        }
      });
    });
    const rows = Array.from(map.values());
    rows.sort(
      (a, b) => parseTimestampValue(b.latestCapturedAt) - parseTimestampValue(a.latestCapturedAt)
    );
    return rows;
  };

  const summaryLeadRows = useMemo(() => buildLeadRows("summaryEmails"), [conversations]);
  const contactLeadRows = useMemo(() => buildLeadRows("contactEmails"), [conversations]);

  const questionLeads = useMemo<QuestionLead[]>(() => {
    const results: QuestionLead[] = [];
    conversations.forEach((conversation) => {
      const list = conversation.dataCollectionResults;
      if (!list || typeof list !== "object") return;
      const entry = (list as Record<string, unknown>).questions;
      const extracted = extractResultValue(entry);
      if (!extracted) return;
      if (Array.isArray(extracted)) {
        extracted.forEach((item) => {
          const text =
            typeof item === "string"
              ? item.trim()
              : item && typeof item === "object"
              ? String((item as { text?: unknown }).text ?? "").trim()
              : "";
          if (!text) return;
          results.push({
            question: text,
            capturedAt: conversation.capturedAt,
            callId: conversation.callId,
            agentLabel: agentLabelLookup.get(conversation.agentId ?? "") ?? conversation.agentId,
          });
        });
      } else if (typeof extracted === "object") {
        const asArray = Array.isArray((extracted as { questions?: unknown }).questions)
          ? ((extracted as { questions?: unknown }).questions as unknown[])
          : [];
        asArray.forEach((item) => {
          const text =
            typeof item === "string"
              ? item.trim()
              : item && typeof item === "object"
              ? String((item as { text?: unknown }).text ?? "").trim()
              : "";
          if (!text) return;
          results.push({
            question: text,
            capturedAt: conversation.capturedAt,
            callId: conversation.callId,
            agentLabel: agentLabelLookup.get(conversation.agentId ?? "") ?? conversation.agentId,
          });
        });
      }
    });

    results.sort((a, b) => parseTimestampValue(b.capturedAt) - parseTimestampValue(a.capturedAt));
    return results;
  }, [conversations, agentLabelLookup]);

  const formatLeadDate = (value?: string) => formatDate(value ?? null);

  const focusConversation = useCallback(
    (callId?: string) => {
      if (!callId) return;
      const index = conversations.findIndex((conversation) => conversation.callId === callId);
      if (index === -1) return;
      setActiveSidebarSection("dialogues");
      setActiveAgentFilter("all");
      setActiveTab("summary");
      setSelectedIndex(index);
    },
    [conversations]
  );

  useEffect(() => {
    if (summaryLeadRows.length || contactLeadRows.length) {
      console.log("[client-home] Lead rows", {
        client: normalizedClient,
        summary: summaryLeadRows,
        contact: contactLeadRows,
      });
    } else {
      console.log("[client-home] Lead rows empty", {
        client: normalizedClient,
        conversations: conversations.length,
      });
    }
  }, [summaryLeadRows, contactLeadRows, normalizedClient, conversations.length]);

  useEffect(() => {
    if (!filteredConversations.length) {
      if (selectedIndex !== 0) setSelectedIndex(0);
      return;
    }
    if (selectedIndex >= filteredConversations.length) {
      setSelectedIndex(0);
    }
  }, [filteredConversations, selectedIndex]);

  const selectedConversation = filteredConversations[selectedIndex] ?? null;
  const dataCollectionEntries =
    selectedConversation?.dataCollectionResults && typeof selectedConversation.dataCollectionResults === "object"
      ? Object.entries(selectedConversation.dataCollectionResults).filter(
          ([, value]) => value && typeof value === "object" && "value" in value
        )
      : [];

  const sidebarTitle = entry?.displayName?.trim() || "Dialogue";

  return (
    <main
      style={{
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "#f8f5ef",
        color: "#2f2a26",
        display: "flex",
        flexDirection: "row",
        position: "relative",
        fontFamily: "'Cooper Light BT', 'Georgia', serif",
      }}
    >
      <aside
        style={{
          width: isSidebarCollapsed ? 68 : 200,
          minWidth: isSidebarCollapsed ? 68 : 200,
          padding: isSidebarCollapsed ? "20px 12px" : "32px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "#ffffff",
          borderRight: "1px solid rgba(203, 213, 225, 0.8)",
          transition: "width 0.22s ease, min-width 0.22s ease, padding 0.22s ease, box-shadow 0.22s ease",
          boxShadow: isSidebarCollapsed
            ? "0 4px 12px rgba(15, 23, 42, 0.08)"
            : "6px 0 18px rgba(15, 23, 42, 0.08)",
        }}
        onClick={() => {
          if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isSidebarCollapsed ? "center" : "space-between",
            gap: 8,
          }}
        >
          {!isSidebarCollapsed ? (
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#2f2a26",
                letterSpacing: 0.3,
              }}
            >
              {sidebarTitle}
            </span>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsSidebarCollapsed((prev) => !prev);
            }}
            style={{
              background: "rgba(203, 213, 225, 0.5)",
              color: "#475569",
              border: "none",
              borderRadius: 10,
              padding: "6px 8px",
              fontSize: 12,
              cursor: "pointer",
              minWidth: 32,
            }}
            aria-label={isSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isSidebarCollapsed ? "⤢" : "⤡"}
          </button>
        </div>

        {sidebarItems.map((item) => {
          const isActive = activeSidebarSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveSidebarSection(item.key as SidebarSection);
                if (isSidebarCollapsed) setIsSidebarCollapsed(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isSidebarCollapsed ? 0 : 10,
                justifyContent: isSidebarCollapsed ? "center" : "flex-start",
                background: isActive ? "#e0ecff" : "transparent",
                border: "none",
                color: isActive ? "#1d4ed8" : "#475569",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 12px",
                borderRadius: 10,
                transition: "background 0.18s ease, color 0.18s ease",
                cursor: "pointer",
              }}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </span>
              {!isSidebarCollapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </aside>

      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
      <section
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          background: "transparent",
          minHeight: 0,
          padding: "16px clamp(16px, 4vw, 32px)",
          overflow: "hidden",
          gap: 20,
        }}
      >
        {activeSidebarSection === "agents" ? (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "#ffffff",
              border: "1px solid rgba(203, 213, 225, 0.8)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 8px 20px rgba(15, 23, 42, 0.09)",
              overflowY: "auto",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Agents</h2>
            {clientAgents.length ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                {clientAgents.map((agent) => (
                  <div
                    key={agent.agentId}
                    style={{
                      background: "#ffffff",
                      border: "1px solid rgba(203, 213, 225, 0.8)",
                      borderRadius: 12,
                      padding: "12px 16px",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "#1f2937",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{agent.label}</span>
                    <code style={{ fontSize: 13, color: "#2563eb" }}>
                      {agent.agentId}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.9)", fontSize: 14 }}>
                No agents configured for this client.
              </p>
            )}
          </div>
        ) : activeSidebarSection === "dialogues" ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: "1 1 auto",
              minHeight: 0,
              position: "relative",
              zIndex: 2,
              background: "#f8f5ef",
              paddingTop: 2,
              paddingBottom: 12,
            }}
          >
            {agentFilterOptions.length > 1 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 6,
                  paddingTop: 2,
                  scrollbarWidth: "thin",
                  alignItems: "stretch",
                  position: "relative",
                  zIndex: 3,
                  marginBottom: 8,
                  paddingLeft: 2,
                  paddingRight: 2,
                  background: "#f8f5ef",
                  flexShrink: 0,
                  overflowY: "hidden",
                  minHeight: 40,
                }}
              >
                {agentFilterOptions.map((option) => {
                  const isActive = activeAgentFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (activeAgentFilter === option.value) return;
                        setActiveAgentFilter(option.value);
                        setSelectedIndex(0);
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 999,
                        border: isActive
                          ? "1px solid rgba(37, 99, 235, 0.6)"
                          : "1px solid rgba(203, 213, 225, 0.85)",
                        background: isActive ? "#e0ecff" : "#f3f4f6",
                        color: isActive ? "#1d4ed8" : "#475569",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.2,
                        cursor: "pointer",
                        transition: "background 0.18s ease, border 0.18s ease",
                        whiteSpace: "nowrap",
                        minHeight: 36,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                      aria-pressed={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "row",
                gap: 20,
                paddingTop: 0,
                marginTop: 4,
                paddingLeft: 2,
                paddingRight: 2,
              }}
            >
              <aside
                style={{
                  flex: "0 0 26%",
                  width: "26%",
                  minWidth: 220,
                  background: "#ffffff",
                  border: "1px solid rgba(203, 213, 225, 0.8)",
                  borderRadius: 16,
                  padding: "12px 16px 16px",
                  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 0,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Dialogues</h2>
                {isLoading ? (
                  <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.85)", fontSize: 14 }}>
                    Loading conversations…
                  </p>
                ) : dataError ? (
                  <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{dataError}</p>
                ) : filteredConversations.length ? (
                  <div
                    style={{
                      overflowY: "auto",
                      paddingRight: 4,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {filteredConversations.map((conversation, index) => {
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={`${conversation.callId}-${index}`}
                          type="button"
                          onClick={() => setSelectedIndex(index)}
                          style={{
                            textAlign: "left",
                            border: isSelected
                              ? "1px solid rgba(37, 99, 235, 0.6)"
                              : "1px solid rgba(203, 213, 225, 0.8)",
                            background: isSelected ? "#e0ecff" : "#f7fafc",
                            color: "#1f2937",
                            borderRadius: 12,
                            padding: "12px 14px",
                            cursor: "pointer",
                            transition: "background 0.18s ease, border 0.18s ease, box-shadow 0.18s ease",
                            boxShadow: isSelected ? "0 4px 14px rgba(37, 99, 235, 0.15)" : "0 2px 10px rgba(15, 23, 42, 0.06)",
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 6 }}>
                            {conversation.summarySubject?.trim() || "Untitled conversation"}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.75 }}>
                            {formatDate(conversation.capturedAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : conversations.length ? (
                  <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.85)", fontSize: 14 }}>
                    No conversations for this agent yet.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "rgba(71, 85, 105, 0.85)", fontSize: 14 }}>
                    No customer conversations yet.
                  </p>
                )}
              </aside>

              <section
                style={{
                  flex: "1 1 0%",
                  minWidth: 0,
                  background: "#ffffff",
                  border: "1px solid rgba(203, 213, 225, 0.8)",
                  borderRadius: 16,
                  padding: "14px 20px 20px",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minHeight: 0,
                  marginTop: 0,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
                  {selectedConversation ? (
                    <ConversationTabs
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      conversation={selectedConversation}
                      dataCollectionEntries={dataCollectionEntries}
                      aggregatedQuestions={questions}
                    />
                  ) : (
                  <p style={{ margin: "16px 0 0", color: "rgba(71, 85, 105, 0.85)" }}>
                    Select a conversation to see details.
                  </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : activeSidebarSection === "home" ? (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "#ffffff",
              border: "1px solid rgba(203, 213, 225, 0.8)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              <div
                style={{
                  background: "#fff7e6",
                  border: "1px solid rgba(251, 191, 36, 0.45)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(148, 92, 35, 0.15)",
                }}
              >
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Total conversations
                </span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>{totalConversationsCount}</span>
                <span style={{ fontSize: 12, color: "rgba(124, 75, 46, 0.85)" }}>
                  Across all customer agents
                </span>
              </div>
              <div
                style={{
                  background: "#ecf3ff",
                  border: "1px solid rgba(59, 130, 246, 0.35)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(59, 130, 246, 0.18)",
                }}
              >
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Total conversation time
                </span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>
                  {formatSecondsAsDuration(totalConversationSeconds)}
                </span>
                <span style={{ fontSize: 12, color: "rgba(37, 99, 235, 0.75)" }}>
                  Summed duration of captured calls
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                Conversation volume
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                {homeTimeframeOptions.map((option) => {
                  const isActive = homeTimeframe === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (homeTimeframe === option.value) return;
                        setHomeTimeframe(option.value);
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        border: isActive
                          ? "1px solid rgba(37, 99, 235, 0.6)"
                          : "1px solid rgba(203, 213, 225, 0.85)",
                        background: isActive ? "#e0ecff" : "#f3f4f6",
                        color: isActive ? "#1d4ed8" : "#475569",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: 0.2,
                        cursor: "pointer",
                        transition: "background 0.18s ease, border 0.18s ease",
                        whiteSpace: "nowrap",
                      }}
                      aria-pressed={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "rgba(71, 85, 105, 0.85)",
              }}
            >
              Counts represent captured conversations per agent within the selected timeframe.
            </p>
            {hasHomeRows ? (
              <>
                {!hasHomeVolume ? (
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                    No conversations captured for this timeframe yet.
                  </p>
                ) : null}
                <div
                  style={{
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    paddingRight: 4,
                  }}
                >
                  {homeChartRows.map((row) => {
                    const widthPercent = Math.round((row.count / homeChartMax) * 100);
                    return (
                      <div
                        key={row.agentId}
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
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{row.label}</span>
                          <span style={{ fontSize: 12, color: "rgba(71, 85, 105, 0.85)" }}>
                            {row.count} {row.count === 1 ? "conversation" : "conversations"}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 10,
                            borderRadius: 999,
                            background: "rgba(148, 163, 184, 0.2)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${widthPercent}%`,
                              height: "100%",
                              borderRadius: 999,
                              background:
                                "linear-gradient(90deg, rgba(56, 189, 248, 0.85), rgba(37, 99, 235, 0.85))",
                              transition: "width 0.2s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              <div
                style={{
                  display: "grid",
                  gap: 20,
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  marginTop: 12,
                }}
              >
                  <div
                    style={{
                      background: "#fffdf8",
                      border: "1px solid rgba(251, 191, 36, 0.4)",
                      borderRadius: 12,
                      padding: 16,
                      boxShadow: "0 6px 18px rgba(148, 92, 35, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Summary requests</h3>
                      <span style={{ fontSize: 12, color: "rgba(124, 75, 46, 0.85)" }}>
                        {summaryLeadRows.length}
                      </span>
                    </div>
                   {summaryLeadRows.length ? (
                      <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "6px 0",
                                  color: "rgba(71, 85, 105, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(203, 213, 225, 0.6)",
                                }}
                              >
                                Email
                              </th>
                              <th
                                style={{
                                  textAlign: "right",
                                  padding: "6px 0",
                                  color: "rgba(71, 85, 105, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(203, 213, 225, 0.6)",
                                }}
                              >
                                Conversations
                              </th>
                              <th
                                style={{
                                  textAlign: "right",
                                  padding: "6px 0",
                                  color: "rgba(71, 85, 105, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(203, 213, 225, 0.6)",
                                }}
                              >
                                Last seen
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryLeadRows.map((row, index) => {
                              const isLast = index === summaryLeadRows.length - 1;
                              const isClickable = Boolean(row.latestCallId);
                              const handleClick = () => {
                                if (isClickable) focusConversation(row.latestCallId);
                              };
                              const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                                if (!isClickable) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  focusConversation(row.latestCallId);
                                }
                              };
          return (
                                <tr
                                  key={`${row.email}-${index}`}
                                  onClick={handleClick}
                                  onKeyDown={handleKeyDown}
                                  tabIndex={isClickable ? 0 : -1}
                                  style={{
                                    cursor: isClickable ? "pointer" : "default",
                                    transition: "background 0.18s ease, box-shadow 0.18s ease",
                                    background: "transparent",
                                  }}
              onMouseEnter={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "#f3e2c7";
                node.style.boxShadow = "0 4px 12px rgba(148, 92, 35, 0.12)";
              }}
              onMouseLeave={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "transparent";
                node.style.boxShadow = "none";
              }}
              onFocus={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "#f3e2c7";
                node.style.boxShadow = "0 4px 12px rgba(148, 92, 35, 0.12)";
              }}
              onBlur={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "transparent";
                node.style.boxShadow = "none";
              }}
            >
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(226, 232, 240, 0.6)",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {row.email}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(226, 232, 240, 0.6)",
                                      textAlign: "right",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {row.count}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(226, 232, 240, 0.6)",
                                      textAlign: "right",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {formatLeadDate(row.latestCapturedAt)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(124, 75, 46, 0.8)" }}>
                        No summary requests yet.
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      background: "#eef6ff",
                      border: "1px solid rgba(59, 130, 246, 0.35)",
                      borderRadius: 12,
                      padding: 16,
                      boxShadow: "0 6px 18px rgba(37, 99, 235, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>New contact requests</h3>
                      <span style={{ fontSize: 12, color: "rgba(37, 99, 235, 0.85)" }}>
                        {contactLeadRows.length}
                      </span>
                    </div>
                    {contactLeadRows.length ? (
                      <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                        <table
                          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "6px 0",
                                  color: "rgba(37, 99, 235, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(191, 219, 254, 0.7)",
                                }}
                              >
                                Email
                              </th>
                              <th
                                style={{
                                  textAlign: "right",
                                  padding: "6px 0",
                                  color: "rgba(37, 99, 235, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(191, 219, 254, 0.7)",
                                }}
                              >
                                Conversations
                              </th>
                              <th
                                style={{
                                  textAlign: "right",
                                  padding: "6px 0",
                                  color: "rgba(37, 99, 235, 0.85)",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(191, 219, 254, 0.7)",
                                }}
                              >
                                Last seen
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {contactLeadRows.map((row, index) => {
                              const isLast = index === contactLeadRows.length - 1;
                              const isClickable = Boolean(row.latestCallId);
                              const handleClick = () => {
                                if (isClickable) focusConversation(row.latestCallId);
                              };
                              const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
                                if (!isClickable) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  focusConversation(row.latestCallId);
                                }
                              };
                            return (
                                <tr
                                  key={`${row.email}-${index}`}
                                  onClick={handleClick}
                                  onKeyDown={handleKeyDown}
                                  tabIndex={isClickable ? 0 : -1}
                                  style={{
                                    cursor: isClickable ? "pointer" : "default",
                                    transition: "background 0.18s ease, box-shadow 0.18s ease",
                                    background: "transparent",
                                  }}
                                onMouseEnter={(event) => {
                                  if (!isClickable) return;
                                  const node = event.currentTarget as HTMLTableRowElement;
                                  node.style.background = "#d6e4ff";
                                  node.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.18)";
                                }}
              onMouseLeave={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "transparent";
                node.style.boxShadow = "none";
              }}
                                onFocus={(event) => {
                                  if (!isClickable) return;
                                  const node = event.currentTarget as HTMLTableRowElement;
                                  node.style.background = "#d6e4ff";
                                  node.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.18)";
                                }}
              onBlur={(event) => {
                if (!isClickable) return;
                const node = event.currentTarget as HTMLTableRowElement;
                node.style.background = "transparent";
                node.style.boxShadow = "none";
              }}
                              >
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(191, 219, 254, 0.6)",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {row.email}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(191, 219, 254, 0.6)",
                                      textAlign: "right",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {row.count}
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 0",
                                      borderBottom: isLast
                                        ? "none"
                                        : "1px solid rgba(191, 219, 254, 0.6)",
                                      textAlign: "right",
                                      color: "#1f2937",
                                    }}
                                  >
                                    {formatLeadDate(row.latestCapturedAt)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(37, 99, 235, 0.75)" }}>
                        No contact requests yet.
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      background: "#f3f6ff",
                      border: "1px solid rgba(99, 102, 241, 0.35)",
                      borderRadius: 12,
                      padding: 16,
                      boxShadow: "0 6px 18px rgba(99, 102, 241, 0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Latest questions</h3>
                      <span style={{ fontSize: 12, color: "rgba(79, 70, 229, 0.85)" }}>
                        {questionLeads.length}
                      </span>
                    </div>
                    {questionLeads.length ? (
                      <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                        <ul
                          style={{
                            listStyle: "none",
                            margin: 0,
                            padding: 0,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          {questionLeads.map((lead, index) => (
                            <li
                              key={`${lead.callId}-${index}`}
                              onClick={() => focusConversation(lead.callId)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  focusConversation(lead.callId);
                                }
                              }}
                              tabIndex={lead.callId ? 0 : -1}
                              style={{
                                background: "#ffffff",
                                border: "1px solid rgba(165, 180, 252, 0.6)",
                                borderRadius: 12,
                                padding: "10px 14px",
                                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.12)",
                                cursor: lead.callId ? "pointer" : "default",
                                transition: "background 0.18s ease, box-shadow 0.18s ease",
                              }}
                              onMouseEnter={(event) => {
                                if (!lead.callId) return;
                                const node = event.currentTarget as HTMLLIElement;
                                node.style.background = "#e8edff";
                                node.style.boxShadow = "0 4px 16px rgba(99, 102, 241, 0.18)";
                              }}
                              onMouseLeave={(event) => {
                                if (!lead.callId) return;
                                const node = event.currentTarget as HTMLLIElement;
                                node.style.background = "#ffffff";
                                node.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.12)";
                              }}
                              onFocus={(event) => {
                                if (!lead.callId) return;
                                const node = event.currentTarget as HTMLLIElement;
                                node.style.background = "#e8edff";
                                node.style.boxShadow = "0 4px 16px rgba(99, 102, 241, 0.18)";
                              }}
                              onBlur={(event) => {
                                if (!lead.callId) return;
                                const node = event.currentTarget as HTMLLIElement;
                                node.style.background = "#ffffff";
                                node.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.12)";
                              }}
                            >
                              <div style={{ fontSize: 14, color: "#1f2937", fontWeight: 600 }}>
                                {lead.question}
                              </div>
                              <div style={{ fontSize: 12, color: "rgba(71, 85, 105, 0.85)", marginTop: 4 }}>
                                {lead.agentLabel ? `${lead.agentLabel} • ` : ""}
                                {formatLeadDate(lead.capturedAt)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "rgba(79, 70, 229, 0.75)" }}>
                        No questions captured yet.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                No agents available for reporting yet.
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid rgba(203, 213, 225, 0.8)",
              borderRadius: 16,
              padding: 24,
              color: "rgba(71, 85, 105, 0.85)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {activeSidebarSection === "chat"
              ? "Chat workspace coming soon."
              : "Settings coming soon."}
          </div>
        )}
      </section>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 50,
        }}
      >
        <DialogueBarTalkButton
          agentId={clientAgentId}
          useSignedUrl
          serverLocation={serverLocation}
          buttonColor="#38bdf8"
          buttonTextColor="#ffffff"
          talkLabel="Talk"
        />
      </div>
    </main>
  );
}

function FallbackState({ title, description }: { title: string; description: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f8f5ef",
      }}
    >
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid rgba(203, 213, 225, 0.8)",
          maxWidth: 520,
          textAlign: "center",
          color: "#2f2a26",
          lineHeight: 1.6,
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div>{description}</div>
      </div>
    </main>
  );
}
