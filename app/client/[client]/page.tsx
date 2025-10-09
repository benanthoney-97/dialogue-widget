"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

function extractResultValue(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  const candidate = (entry as { value?: unknown }).value;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : null;
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
  activeTab: "summary" | "transcript" | "data" | "questions" | "agents";
  onTabChange: (tab: "summary" | "transcript" | "data" | "questions" | "agents") => void;
  conversation: ConversationKnowledgeRecord;
  dataCollectionEntries: [string, unknown][];
  aggregatedQuestions: string[];
  agents: ClientAgentInfo[];
};

function ConversationTabs({
  activeTab,
  onTabChange,
  conversation,
  dataCollectionEntries,
  aggregatedQuestions,
  agents,
}: ConversationTabsProps) {
  const conversationQuestions = dataCollectionEntries
    .filter(([key]) => key.toLowerCase().includes("question"))
    .map(([, value]) => extractResultValue(value))
    .filter((value): value is string => Boolean(value && value.length > 0));

  const transcriptMessages = useMemo(
    () => parseTranscriptMessages(conversation.transcriptText),
    [conversation.transcriptText]
  );

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
        {["summary", "transcript", "data", "questions", "agents"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab as typeof activeTab)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border:
                activeTab === tab
                  ? "1px solid rgba(56, 189, 248, 0.6)"
                  : "1px solid rgba(148, 163, 184, 0.35)",
              background: activeTab === tab ? "rgba(56, 189, 248, 0.18)" : "transparent",
              color: activeTab === tab ? "#38bdf8" : "#e2e8f0",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "background 0.18s ease, border 0.18s ease",
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
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.65)" }}>
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
                          color: "rgba(226, 232, 240, 0.65)",
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
                            ? "linear-gradient(135deg, rgba(37, 99, 235, 0.65), rgba(14, 165, 233, 0.65))"
                            : message.role === "agent"
                            ? "rgba(30, 41, 59, 0.75)"
                            : "rgba(148, 163, 184, 0.2)",
                        color: "#e2e8f0",
                        padding: "10px 14px",
                        borderRadius:
                          message.role === "user"
                            ? "16px 16px 4px 16px"
                            : message.role === "agent"
                            ? "16px 16px 16px 4px"
                            : "12px",
                        boxShadow: "0 6px 20px rgba(7, 11, 23, 0.5)",
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
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.65)" }}>
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
                    <strong>{formatKey(key)}:</strong> {extracted ?? ""}
                </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.65)" }}>
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
                    background: "rgba(30, 41, 59, 0.75)",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#e2e8f0",
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
                    background: "rgba(30, 41, 59, 0.75)",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#e2e8f0",
                  }}
                >
                  {question}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.65)" }}>
              No questions captured yet.
            </p>
          )
        ) : null}

        {activeTab === "agents" ? (
          agents.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {agents.map((agent) => (
                <div
                  key={agent.agentId}
                  style={{
                    background: "rgba(30, 41, 59, 0.75)",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{agent.label}</span>
                  <code style={{ fontSize: 13, color: "rgba(148, 197, 255, 0.85)" }}>
                    {agent.agentId}
                  </code>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.65)" }}>
              No agents configured for this client.
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
    "summary" | "transcript" | "data" | "questions" | "agents"
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
        setQuestions(Array.isArray(payload.questions) ? payload.questions : []);
        setConversations(
          Array.isArray(payload.conversations) ? payload.conversations : []
        );
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
        background: "#0b1220",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "row",
        position: "relative",
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
          background: "rgba(11, 18, 32, 0.95)",
          borderRight: "1px solid rgba(148, 163, 184, 0.25)",
          transition: "width 0.22s ease, min-width 0.22s ease, padding 0.22s ease",
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
                color: "#f8fafc",
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
              background: "rgba(148, 163, 184, 0.16)",
              color: "#cbd5f5",
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

        {[
          { key: "home", label: "Home", icon: "🏠" },
          { key: "agents", label: "Agents", icon: "🤖" },
          { key: "dialogues", label: "Dialogues", icon: "💬" },
          { key: "chat", label: "Chat", icon: "🗨️" },
          { key: "settings", label: "Settings", icon: "⚙️" },
        ].map((item) => {
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
                background: isActive ? "rgba(56, 189, 248, 0.18)" : "transparent",
                border: "none",
                color: isActive ? "#38bdf8" : "#cbd5f5",
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
              <span style={{ fontSize: 16 }}>{item.icon}</span>
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
          background: "radial-gradient(circle at top, rgba(37, 99, 235, 0.22), transparent 60%)",
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
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 8px 24px rgba(7, 11, 23, 0.35)",
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
                      background: "rgba(30, 41, 59, 0.75)",
                      border: "1px solid rgba(148, 163, 184, 0.35)",
                      borderRadius: 12,
                      padding: "12px 16px",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      boxShadow: "0 6px 18px rgba(7, 11, 23, 0.35)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{agent.label}</span>
                    <code style={{ fontSize: 13, color: "rgba(148, 197, 255, 0.85)" }}>
                      {agent.agentId}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
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
            }}
          >
            {agentFilterOptions.length > 1 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 4,
                  scrollbarWidth: "thin",
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
                          ? "1px solid rgba(56, 189, 248, 0.7)"
                          : "1px solid rgba(148, 163, 184, 0.35)",
                        background: isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(15, 23, 42, 0.6)",
                        color: isActive ? "#38bdf8" : "#cbd5f5",
                        fontSize: 13,
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
            ) : null}
            <div
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                display: "flex",
                flexDirection: "row",
                gap: 20,
              }}
            >
              <aside
                style={{
                  flex: "0 0 26%",
                  width: "26%",
                  minWidth: 220,
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: "0 8px 24px rgba(7, 11, 23, 0.35)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Dialogues</h2>
                {isLoading ? (
                  <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
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
                            border: "1px solid rgba(148, 163, 184, 0.35)",
                            background: isSelected
                              ? "rgba(56, 189, 248, 0.22)"
                              : "rgba(30, 41, 59, 0.65)",
                            color: "#e2e8f0",
                            borderRadius: 12,
                            padding: "12px 14px",
                            cursor: "pointer",
                            transition: "background 0.18s ease, border 0.18s ease",
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
                  <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
                    No conversations for this agent yet.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
                    No customer conversations yet.
                  </p>
                )}
              </aside>

              <section
                style={{
                  flex: "1 1 0%",
                  minWidth: 0,
                  background: "rgba(15, 23, 42, 0.72)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 10px 28px rgba(7, 11, 23, 0.4)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minHeight: 0,
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
                      agents={clientAgents}
                    />
                  ) : (
                    <p style={{ margin: "16px 0 0", color: "rgba(226, 232, 240, 0.7)" }}>
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
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 8px 24px rgba(7, 11, 23, 0.35)",
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
                  background: "rgba(37, 58, 96, 0.65)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(8, 20, 39, 0.35)",
                }}
              >
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Total conversations
                </span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>{totalConversationsCount}</span>
                <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.6)" }}>
                  Across all customer agents
                </span>
              </div>
              <div
                style={{
                  background: "rgba(37, 58, 96, 0.65)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: 16,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: "0 6px 18px rgba(8, 20, 39, 0.35)",
                }}
              >
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Total conversation time
                </span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>
                  {formatSecondsAsDuration(totalConversationSeconds)}
                </span>
                <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.6)" }}>
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
                          ? "1px solid rgba(56, 189, 248, 0.7)"
                          : "1px solid rgba(148, 163, 184, 0.35)",
                        background: isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(15, 23, 42, 0.6)",
                        color: isActive ? "#38bdf8" : "#cbd5f5",
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
                color: "rgba(226, 232, 240, 0.65)",
              }}
            >
              Counts represent captured conversations per agent within the selected timeframe.
            </p>
            {hasHomeRows ? (
              <>
                {!hasHomeVolume ? (
                  <p style={{ margin: 0, fontSize: 13, color: "rgba(226, 232, 240, 0.6)" }}>
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
                          <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.65)" }}>
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
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(226, 232, 240, 0.65)" }}>
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
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: 16,
              padding: 24,
              color: "rgba(226, 232, 240, 0.7)",
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
        background: "#0f172a",
      }}
    >
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          background: "#111827",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          maxWidth: 520,
          textAlign: "center",
          color: "#e2e8f0",
          lineHeight: 1.6,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div>{description}</div>
      </div>
    </main>
  );
}
