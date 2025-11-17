"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";
import { useParams } from "next/navigation";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";

type TranscriptTurn = Record<string, unknown> | string;

type InterviewTranscript = {
  instruction?: string | null;
  turns?: TranscriptTurn[] | null;
};

type InterviewRow = {
  id: string;
  agent_id: string | null;
  agent?: { agent_name: string | null } | null;
  idea_id: number | null;
  interview_type: string | null;
  status: string | null;
  run_at: string | null;
  transcript: InterviewTranscript | null;
  idea: { call_summary_title: string | null } | null;
};

type InterviewsResponse = {
  interviews: InterviewRow[];
};

type ChatMessage = {
  role: "persona" | "user" | "system";
  text: string;
};

function formatRunDate(value: string | null) {
  if (!value) return "Not run yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolveText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = resolveText(item);
      if (candidate) {
        return candidate;
      }
    }
    return "";
  }
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  if (typeof record.content === "string" && record.content.trim()) {
    return record.content.trim();
  }
  if (record.content && typeof record.content === "object") {
    return resolveText(record.content);
  }
  if (record.payload && typeof record.payload === "object") {
    return resolveText(record.payload);
  }
  return "";
}

function resolveRole(value: unknown): ChatMessage["role"] {
  const normalizedValue =
    typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
  const normalized = normalizedValue.toLowerCase();
  if (normalized.includes("agent") || normalized.includes("persona") || normalized.includes("assistant")) {
    return "persona";
  }
  if (normalized.includes("user")) {
    return "user";
  }
  if (normalized.includes("system") || normalized.includes("instruction")) {
    return "system";
  }
  return "system";
}

function formatStatusLabel(value?: string | null) {
  if (!value) return "Pending";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInterview, setActiveInterview] = useState<InterviewRow | null>(null);
  const params = useParams();
  const clientId = params?.client;

  const chatMessages = useMemo<ChatMessage[]>(() => {
    if (!activeInterview?.transcript) return [];
    const messages: ChatMessage[] = [];
    const turns = Array.isArray(activeInterview.transcript.turns)
      ? activeInterview.transcript.turns
      : [];
    for (const rawTurn of turns) {
      const text = resolveText(rawTurn);
      if (!text) continue;
      let roleValue: unknown = "";
      if (typeof rawTurn === "string") {
        roleValue = "";
      } else if (rawTurn && typeof rawTurn === "object") {
        roleValue = rawTurn.role ?? rawTurn.speaker ?? rawTurn.actor ?? "";
      }
      const role = resolveRole(roleValue);
      messages.push({ role, text });
    }
    return messages;
  }, [activeInterview]);

  const instructionText =
    activeInterview &&
    typeof activeInterview.transcript?.instruction === "string" &&
    activeInterview.transcript.instruction.trim()
      ? activeInterview.transcript.instruction.trim()
      : null;

  const loadInterviews = useCallback(() => {
    if (!clientId) return;
    let isMounted = true;
    setLoading(true);
    fetch(`/api/clients/${clientId}/simulated-interviews`)
      .then((res) => res.json())
      .then((data: InterviewsResponse) => {
        if (!isMounted) return;
        setInterviews(data.interviews ?? []);
      })
      .catch(() => {
        if (!isMounted) return;
        setInterviews([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    const cleanup = loadInterviews();
    return cleanup;
  }, [loadInterviews]);

  return (
    <>
      <div
        className="interviews-stage"
        style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
      >
        <Sidebar />
        <div className="interviews-stage__content">
          <Topbar
            offsetLeft="var(--sidebar-width)"
            hideProfileAvatar
            hideAdminView
            title="Interviews"
          />
          <main className="interviews-view">
            <header className="interviews-view__header" />
            <div className="interviews-view__toolbar">
              <button
                type="button"
                className="interviews-refresh"
                onClick={() => {
                  loadInterviews();
                }}
                aria-label="Refresh interviews"
                disabled={loading}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="#22325A"
                    fillRule="evenodd"
                    d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"
                  />
                  <path
                    fill="#22325A"
                    d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"
                  />
                </svg>
              </button>
            </div>
            {loading ? (
              <p>Loading interviews…</p>
            ) : interviews.length === 0 ? (
              <p>No interviews recorded yet.</p>
            ) : (
              <div className="interviews-table">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Idea</th>
                      <th>Interview type</th>
                      <th>Status</th>
                      <th>Run at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((row) => (
                      <tr
                        key={row.id}
                        className="interviews-table__row"
                        tabIndex={0}
                        role="button"
                        onClick={() => setActiveInterview(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setActiveInterview(row);
                          }
                        }}
                      >
                        <td>{row.agent?.agent_name ?? row.agent_id ?? "Unknown"}</td>
                        <td>{row.idea?.call_summary_title ?? `#${row.idea_id ?? "?"}`}</td>
                        <td>{row.interview_type ?? "Unknown"}</td>
                        <td>
                          {(() => {
                            const statusKey = (row.status ?? "pending").toLowerCase();
                            const label = formatStatusLabel(row.status);
                            const badgeClass = `interviews-status-badge interviews-status-badge--${statusKey}`;
                            return (
                              <span className={badgeClass}>
                                {statusKey === "pending" ? (
                                  <>
                                    <span className="interviews-status__spinner" aria-hidden="true" />
                                    <span>{label}</span>
                                  </>
                                ) : (
                                  <span>{label}</span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td>{formatRunDate(row.run_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>

      <SlidingPanelOverlay
        open={Boolean(activeInterview)}
        title={activeInterview?.agent?.agent_name ?? "Interview playback"}
        description={
          activeInterview
            ? `${activeInterview.interview_type ?? "Interview"} · ${activeInterview.status ?? "Pending"}`
            : undefined
        }
        width="calc(100vw - var(--sidebar-width) - 164px)"
        onRequestClose={() => setActiveInterview(null)}
        onAfterClose={() => setActiveInterview(null)}
      >
        {activeInterview ? (
          <div className="interviews-panel">
            <div className="interviews-panel__meta-grid">
              <article className="interviews-panel__meta-card">
                <p className="interviews-panel__meta-label">Persona</p>
                <p className="interviews-panel__meta-value">
                  {activeInterview.agent?.agent_name ?? activeInterview.agent_id ?? "Unknown"}
                </p>
              </article>
              <article className="interviews-panel__meta-card">
                <p className="interviews-panel__meta-label">Idea</p>
                <p className="interviews-panel__meta-value">
                  {activeInterview.idea?.call_summary_title ?? `#${activeInterview.idea_id ?? "?"}`}
                </p>
              </article>
              <article className="interviews-panel__meta-card">
                <p className="interviews-panel__meta-label">Status</p>
                <p className="interviews-panel__meta-value">{activeInterview.status ?? "Pending"}</p>
              </article>
              <article className="interviews-panel__meta-card">
                <p className="interviews-panel__meta-label">Run at</p>
                <p className="interviews-panel__meta-value">{formatRunDate(activeInterview.run_at)}</p>
              </article>
            </div>
            <section className="interviews-panel__summary">
              <span className="interviews-panel__wide-label">Transcript</span>
              {chatMessages.length > 0 ? (
                <div className="interviews-panel__chat" role="log" aria-label="Interview transcript">
                  {chatMessages.map((message, index) => {
                    const authorName =
                      message.role === "persona"
                        ? activeInterview.agent?.agent_name ?? "Persona"
                        : message.role === "user"
                          ? "User"
                          : "System";
                    return (
                      <div
                        key={`${message.role}-${index}`}
                        className={`interviews-panel__chat-message interviews-panel__chat-message--${message.role}`}
                      >
                        <span className={`interviews-panel__chat-author interviews-panel__chat-author--${message.role}`}>
                          {authorName}
                        </span>
                        <p>{message.text}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="interviews-panel__empty">Transcript unavailable yet.</p>
              )}
            </section>
          </div>
        ) : null}
      </SlidingPanelOverlay>

      <style jsx>{`
        .interviews-stage {
          display: flex;
          min-height: 100vh;
        }
        .interviews-stage__content {
          margin-left: var(--sidebar-width);
          flex: 1;
          background: #f4f8ff;
          min-height: 100vh;
          padding-top: ${TOPBAR_HEIGHT}px;
        }
        .interviews-view {
          padding: 24px 28px;
        }
        .interviews-view__toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 12px;
        }
        .interviews-refresh {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          background: #fff;
          color: rgba(15, 23, 42, 0.85);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .interviews-refresh:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .interviews-refresh svg {
          display: block;
        }
        .interviews-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .interviews-status-badge--pending {
          background: rgba(59, 130, 246, 0.16);
          color: #1d4ed8;
        }
        .interviews-status-badge--completed {
          background: rgba(16, 185, 129, 0.15);
          color: #047857;
        }
        .interviews-status-badge--failed {
          background: rgba(239, 68, 68, 0.12);
          color: #b91c1c;
        }
        .interviews-table {
          background: #fff;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th,
        td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 12px;
        }
        thead {
          background: #f1f5f9;
          font-size: 12px;
          letter-spacing: 0.03em;
          text-transform: none;
          color: rgba(15, 23, 42, 0.7);
        }
        tbody tr {
          cursor: pointer;
        }
        tbody tr:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.45);
          outline-offset: -1px;
        }
        tr:last-child td {
          border-bottom: none;
        }
        .interviews-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 100%;
          height: 100%;
        }
        .interviews-panel__meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .interviews-panel__meta-card {
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(15, 23, 42, 0.1);
        }
        .interviews-panel__meta-label {
          margin: 0;
          font-size: 11px;
          color: rgba(15, 23, 42, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .interviews-panel__meta-value {
          margin: 4px 0 0;
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
        }
        .interviews-panel__summary {
          background: #f5f7ff;
          border-radius: 16px;
          padding: 18px 20px;
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-self: stretch;
        }
        .interviews-panel__wide-label {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.75);
        }
        .interviews-panel__chat {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          flex: 1 1 0;
          padding-right: 4px;
          min-height: 0;
        }
        .interviews-panel__chat-message {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }
        .interviews-panel__chat-author {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2px;
          margin-bottom: 4px;
          color: rgba(15, 23, 42, 0.65);
        }
        .interviews-panel__chat-author--user {
          color: #ffffff;
          text-align: right;
        }
        .interviews-panel__chat-message--persona {
          align-self: flex-start;
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .interviews-panel__chat-message--user {
          align-self: flex-end;
          background: #0a1c2f;
          color: #f8fafc;
        }
        .interviews-panel__chat-message--system {
          align-self: center;
          background: rgba(148, 163, 184, 0.32);
          color: rgba(15, 23, 42, 0.85);
          font-size: 12px;
          font-weight: 600;
          border-radius: 12px;
          text-align: center;
        }
        .interviews-panel__empty {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .interviews-status__spinner {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.3);
          border-top-color: #0f172a;
          animation: interviews-status-spin 0.9s linear infinite;
        }
        @keyframes interviews-status-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </>
  );
}
