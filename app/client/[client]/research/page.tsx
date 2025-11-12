"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

type ExternalSource = {
  id: string;
  name: string;
  accent: string;
  logoUrl: string | null;
};

type AgentResearchRecord = {
  agentId: string;
  personaName: string;
  sourcedArticles: Array<{ title: string | null; url: string | null }>;
  knowledgeText: string | null;
  updatedAt: string | null;
};

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "WS";
}

function deriveAccent(name: string): string {
  const palette = [
    "#2563eb",
    "#0ea5e9",
    "#10b981",
    "#f97316",
    "#6366f1",
    "#dc2626",
    "#7c3aed",
    "#14b8a6",
    "#f59e0b",
  ];
  if (!name) return palette[0];
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export default function ResearchPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<ExternalSource[]>([]);
  const [activeView, setActiveView] = useState<"agent" | "sources">("agent");
  const [agentResearch, setAgentResearch] = useState<AgentResearchRecord[]>([]);
  const [agentResearchLoading, setAgentResearchLoading] = useState(false);
  const [agentResearchError, setAgentResearchError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<string[]>([]);

  const toggleAgentExpansion = useCallback((agentId: string) => {
    setExpandedAgents((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId);
      }
      return [...prev, agentId];
    });
  }, []);

  useEffect(() => {
    if (!clientSlug) return;
    let isMounted = true;
    const controller = new AbortController();

    async function fetchResearchPriorities() {
      try {
        const response = await fetch(`/api/clients/${clientSlug}/research-priorities`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error("[Research] Failed to load research priorities", response.status);
          return;
        }
        const payload = (await response.json()) as {
          priority?: { primary_goal?: string | null; priorities?: string[] | null; target_sources?: string[] | null } | null;
        };
        if (!isMounted) return;
        const sources = payload.priority?.target_sources;
        if (Array.isArray(sources)) {
          setSelectedSources(sources);
        } else {
          setSelectedSources([]);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Research] Unexpected error loading priorities", error);
      }
    }

    void fetchResearchPriorities();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientSlug]);

  const handleSourceToggle = useCallback(async (sourceName: string) => {
    if (!clientSlug) return;

    const previousSources = selectedSources;
    const isActive = previousSources.includes(sourceName);
    const nextSources = isActive
      ? previousSources.filter((name) => name !== sourceName)
      : [...previousSources, sourceName];

    setSelectedSources(nextSources);

    try {
      const response = await fetch(`/api/clients/${clientSlug}/research-priorities`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_sources: nextSources }),
      });

      if (!response.ok) {
        console.error("[Research] Failed to update target sources", response.status);
        setSelectedSources(previousSources);
        return;
      }

      const payload = (await response.json()) as {
        priority?: { primary_goal?: string | null; priorities?: string[] | null; target_sources?: string[] | null } | null;
      };

      if (payload.priority?.target_sources && Array.isArray(payload.priority.target_sources)) {
        setSelectedSources(payload.priority.target_sources);
      }
    } catch (error) {
      console.error("[Research] Unexpected error updating target sources", error);
      setSelectedSources(previousSources);
    }
  }, [clientSlug, selectedSources]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchExternalSources() {
      try {
        const response = await fetch("/api/external-sources", {
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error("[Research] Failed to load external sources", response.status);
          return;
        }

        const payload = (await response.json()) as {
          sources?: Array<{ id: string; name: string; logo?: string | null }>;
        };

        if (!isMounted) return;

        const normalized = (payload.sources ?? []).map((source) => {
          const name = source.name?.trim() ?? "";
          const safeName = name.length > 0 ? name : "Unknown Source";
          const rawLogo = typeof source.logo === "string" ? source.logo.trim() : "";
          return {
            id: source.id,
            name: safeName,
            accent: deriveAccent(safeName),
            logoUrl: rawLogo.length > 0 ? rawLogo : null,
          } satisfies ExternalSource;
        });

  setAvailableSources(normalized);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Research] Unexpected error loading external sources", error);
      }
    }

    void fetchExternalSources();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const targetSources = useMemo(() => availableSources, [availableSources]);
  const formatUpdatedAt = useCallback((value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  useEffect(() => {
    if (!clientSlug) {
      setAgentResearch([]);
      setAgentResearchError(null);
      setAgentResearchLoading(false);
      setExpandedAgents([]);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function fetchAgentResearch() {
      setAgentResearchLoading(true);
      setAgentResearchError(null);
      try {
        const response = await fetch(`/api/clients/${clientSlug}/agent-research`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const message = `Request failed with status ${response.status}`;
          console.error("[Research] Failed to load agent research", message);
          if (isMounted) {
            setAgentResearchError("Unable to load agent research data");
            setAgentResearch([]);
          }
          return;
        }
        const payload = (await response.json()) as {
          records?: Array<{
            agent_id?: string | null;
            persona_name?: string | null;
            knowledge_text?: string | null;
            updated_at?: string | null;
            sourced_articles?: Array<{ title?: string | null; url?: string | null }>;
          }>;
        };
        if (!isMounted) return;

        const records = Array.isArray(payload.records) ? payload.records : [];
        const normalized: AgentResearchRecord[] = records
          .map((record) => {
            const agentId = typeof record.agent_id === "string" ? record.agent_id.trim() : "";
            if (!agentId) return null;
            const personaName =
              typeof record.persona_name === "string" && record.persona_name.trim().length > 0
                ? record.persona_name.trim()
                : "Unnamed agent";
            const knowledgeText =
              typeof record.knowledge_text === "string" && record.knowledge_text.trim().length > 0
                ? record.knowledge_text.trim()
                : null;
            const updatedAt =
              typeof record.updated_at === "string" && record.updated_at.trim().length > 0
                ? record.updated_at
                : null;
            const sourcedArticles = Array.isArray(record.sourced_articles)
              ? record.sourced_articles
                  .map((article) => {
                    if (!article || typeof article !== "object") return null;
                    const title =
                      typeof article.title === "string" && article.title.trim().length > 0
                        ? article.title.trim()
                        : null;
                    const url =
                      typeof article.url === "string" && article.url.trim().length > 0
                        ? article.url.trim()
                        : null;
                    if (!title && !url) return null;
                    return { title, url };
                  })
                  .filter((article): article is { title: string | null; url: string | null } => article !== null)
              : [];

            return {
              agentId,
              personaName,
              knowledgeText,
              updatedAt,
              sourcedArticles,
            } satisfies AgentResearchRecord;
          })
          .filter((item): item is AgentResearchRecord => item !== null)
          .sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA;
          });

        setAgentResearch(normalized);
  setExpandedAgents((prev) => prev.filter((id) => normalized.some((item) => item.agentId === id)));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Research] Unexpected error loading agent research", error);
        if (isMounted) {
          setAgentResearchError("Unexpected error loading agent research");
          setAgentResearch([]);
        }
      } finally {
        if (isMounted) {
          setAgentResearchLoading(false);
        }
      }
    }

    void fetchAgentResearch();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientSlug]);

  return (
    <div
      className="research-stage"
      style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
    >
      <Topbar
        title="Web research"
        offsetLeft="var(--stage-topbar-offset, 0px)"
        hideProfileAvatar
        hideCadenceControls
        rightSlot={<></>}
      />
      <main className="stage-layout research-root">
        <aside className="stage-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="stage-layout__content">
          <div className="stage-shell">
            <section className="research-card research-card--placeholder">
              <header />
              <div className="research-card__body">
                <div className="research-sources">
                  <div className="research-chip-row" role="list">
                    <button
                      type="button"
                      className={`research-chip${activeView === "agent" ? " research-chip--active" : ""}`}
                      role="listitem"
                      aria-pressed={activeView === "agent"}
                      onClick={() => setActiveView("agent")}
                    >
                      Agent Research
                    </button>
                    <button
                      type="button"
                      className={`research-chip${activeView === "sources" ? " research-chip--active" : ""}`}
                      role="listitem"
                      aria-pressed={activeView === "sources"}
                      onClick={() => setActiveView("sources")}
                    >
                      Target Sources
                    </button>
                  </div>
                  <header className="research-section-header">
                    <p className="research-section-helper">
                      {activeView === "agent"
                        ? "Review the research your agents run on a recurring basis."
                        : "Pin the news sources most relevant to your customer personas."}
                    </p>
                  </header>
                  {activeView === "agent" ? (
                    <div className="research-agent-table" role="region" aria-label="Agent research queue">
                      {agentResearchLoading ? (
                        <div className="research-agent-state">Loading agent research…</div>
                      ) : agentResearchError ? (
                        <div className="research-agent-state research-agent-state--error">
                          {agentResearchError}
                        </div>
                      ) : agentResearch.length === 0 ? (
                        <div className="research-agent-state">No agent research runs yet.</div>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th scope="col">Persona</th>
                              <th scope="col">Sources</th>
                              <th scope="col">Knowledge</th>
                              <th scope="col">Last updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agentResearch.map((item) => {
                              const isExpanded = expandedAgents.includes(item.agentId);
                              const isExpandable =
                                item.sourcedArticles.length > 3 || Boolean(item.knowledgeText && item.knowledgeText.length > 240);

                              const rowClassName = [
                                "agent-row",
                                isExpanded ? "agent-row--expanded" : "",
                                isExpandable ? "agent-row--expandable" : "",
                              ]
                                .filter(Boolean)
                                .join(" ");

                              const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
                                if (!isExpandable) return;
                                const target = event.target as HTMLElement;
                                if (target.closest("a, button")) return;
                                toggleAgentExpansion(item.agentId);
                              };

                              const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                                if (!isExpandable) return;
                                if (event.key === "Enter" || event.key === " ") {
                                  const target = event.target as HTMLElement;
                                  if (target.closest("a, button")) return;
                                  event.preventDefault();
                                  toggleAgentExpansion(item.agentId);
                                }
                              };
                              return (
                                <tr
                                  key={item.agentId}
                                  className={rowClassName}
                                  onClick={handleRowClick}
                                  onKeyDown={handleRowKeyDown}
                                  role={isExpandable ? "button" : undefined}
                                  tabIndex={isExpandable ? 0 : undefined}
                                  aria-expanded={isExpandable ? isExpanded : undefined}
                                >
                                  <td>{item.personaName}</td>
                                  <td className="agent-sources-cell">
                                    <div className={isExpanded ? "agent-cell agent-cell--expanded" : "agent-cell"}>
                                      {item.sourcedArticles.length > 0 ? (
                                        <ul className="agent-articles-list">
                                          {item.sourcedArticles.map((article, index) => (
                                            <li key={`${item.agentId}-article-${index}`}>
                                              {article.url ? (
                                                <a href={article.url} target="_blank" rel="noreferrer noopener">
                                                  {article.title ?? article.url}
                                                </a>
                                              ) : (
                                                article.title ?? "Untitled source"
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="agent-articles-empty">No sources linked</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className={isExpanded ? "agent-knowledge-cell agent-knowledge-cell--expanded" : "agent-knowledge-cell"}>
                                    <div className={isExpanded ? "agent-cell agent-cell--expanded" : "agent-cell"}>
                                      <div className="agent-knowledge-text">{item.knowledgeText ?? "—"}</div>
                                    </div>
                                  </td>
                                  <td>{formatUpdatedAt(item.updatedAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : (
                    <div className="research-sources-grid">
                      {targetSources.map((source) => {
                        const active = selectedSources.includes(source.name);
                        const logoStyle = source.logoUrl
                          ? undefined
                          : {
                              background: `linear-gradient(135deg, ${source.accent} 0%, ${source.accent} 60%, rgba(255,255,255,0.85) 100%)`,
                            };
                        return (
                          <button
                            type="button"
                            key={source.id}
                            className={`research-source-card${active ? " research-source-card--active" : ""}`}
                            onClick={() => handleSourceToggle(source.name)}
                            aria-pressed={active}
                          >
                            <div className="research-source-logo" style={logoStyle}>
                              {source.logoUrl ? (
                                <img src={source.logoUrl} alt="" loading="lazy" />
                              ) : (
                                <span aria-hidden="true">{deriveInitials(source.name)}</span>
                              )}
                            </div>
                            <span className="research-source-name">{source.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
      </div>
      <style>{`
        .research-stage {
          position: relative;
          min-height: 100vh;
        }
        .stage-layout {
          background: var(--bg, #f4f8ff);
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          display: flex;
          height: 100%;
        }
        .stage-layout__sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 18px 24px 48px;
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: #052033;
          height: 100%;
          min-height: 0;
        }
        .research-card {
          background: none;
          border-radius: 0px;
          border: none;
          box-shadow: none;
          padding: 22px 0px px;
          display: flex;
          flex-direction: column;
          gap: 0px;
        }
        .research-card header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .research-card header p {
          margin: 0px 0 0;
          color: rgba(15, 23, 42, 0.68);
          font-size: 12px;
          line-height: 1.6;
          max-width: 560px;
        }
        .research-card__body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .research-chip-row {
          display: inline-flex;
          gap: 10px;
          margin: 4px 0 12px;
          flex-wrap: wrap;
        }
        .research-chip {
          border: 1px solid rgba(15, 23, 42, 0.14);
          background: rgba(248, 250, 255, 0.85);
          color: #052033;
          font-size: 12px;
          font-weight: 600;
          border-radius: 999px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.18s ease, border 0.18s ease, transform 0.18s ease;
        }
        .research-chip--active {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.55);
          color: #052033;
        }
        .research-chip:hover,
        .research-chip:focus-visible {
          outline: none;
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.4);
          transform: translateY(-1px);
        }
        .research-root {
          height: 100vh;
          box-sizing: border-box;
          padding-top: ${TOPBAR_HEIGHT}px;
          overflow: hidden;
        }
        .research-root .stage-layout__sidebar {
          height: calc(100vh - ${TOPBAR_HEIGHT}px);
          min-height: 0;
          overflow-y: auto;
          padding: 12px 0 24px;
          box-sizing: border-box;
        }
        .research-root .stage-layout__content {
          height: calc(100vh - ${TOPBAR_HEIGHT}px);
          padding: 24px 64px 12px;
        }
        .research-root .stage-shell {
          flex: 1;
          min-height: 0;
        }
        .research-root .research-card {
          flex: 1;
          height: 100%;
          min-height: 0;
        }
        .research-root .research-card__body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-right: 0px;
        }
        .research-section-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
        }
        .research-section-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .research-section-helper {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: rgba(15, 23, 42, 0.6);
          letter-spacing: 0.01em;
        }
        .research-section-header p:not(.research-section-helper) {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.68);
          line-height: 1.55;
        }
        .research-sources-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 18px;
        }
        .research-source-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          border-radius: 20px;
          border: none;
          padding: 20px 16px;
          text-align: center;
          background: transparent;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
          color: inherit;
        }
        .research-source-card:hover,
        .research-source-card:focus-visible {
          outline: none;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
          background: rgba(59, 130, 246, 0.08);
        }
        .research-source-card--active {
          box-shadow: 0 18px 40px rgba(59, 130, 246, 0.18);
          background: rgba(59, 130, 246, 0.12);
        }
        .research-agent-table {
          margin-top: 20px;
          border: none;
          border-radius: 0px;
          overflow: hidden;
          background: none;
          box-shadow: none;
        }
        .research-agent-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .research-agent-table th,
        .research-agent-table td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          vertical-align: top;
        }
        .research-agent-table th {
    text-align: left;
    padding: 10px 8px;
    color: rgba(15, 23, 42, 0.65);
    font-size: 13px;
    font-weight: 700;
    border-bottom: 1px solid rgba(var(--accent-rgb), 0.08);
    position: sticky;
    top: 0;
    z-index: 1;
    background: none;
}
        .research-agent-table th:nth-child(2),
        .research-agent-table td:nth-child(2) {
          width: 24%;
        }
        .research-agent-table th:nth-child(3),
        .research-agent-table td:nth-child(3) {
          width: 36%;
        }
        .research-agent-table tbody tr:last-of-type td {
          border-bottom: none;
        }
        .research-agent-state {
          padding: 28px;
          text-align: center;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .research-agent-state--error {
          color: #b91c1c;
        }
        .agent-articles-list {
          margin: 0;
          padding-left: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .agent-articles-list li {
          margin: 0;
        }
        .agent-articles-list a {
          color: #2563eb;
          text-decoration: none;
        }
        .agent-articles-list a:hover,
        .agent-articles-list a:focus-visible {
          text-decoration: underline;
          outline: none;
        }
        .agent-articles-empty {
          color: rgba(15, 23, 42, 0.48);
          font-style: italic;
        }
        .agent-row {
          transition: background 0.18s ease;
        }
        .agent-row--expanded {
          background: rgba(37, 99, 235, 0.04);
        }
        .agent-row--expandable {
          cursor: pointer;
        }
        .agent-sources-cell {
          min-width: 180px;
          position: relative;
        }
        .agent-knowledge-cell {
          min-width: 240px;
          position: relative;
          max-width: 420px;
        }
        .agent-cell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 110px;
          overflow: hidden;
          position: relative;
        }
        .agent-cell--expanded,
        .agent-row--expanded .agent-cell {
          max-height: none;
        }
        .agent-row--expandable:not(.agent-row--expanded) .agent-cell::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 32px;
          pointer-events: none;
          background: linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.92));
        }
        .agent-knowledge-text {
          min-height: 64px;
          white-space: pre-wrap;
          line-height: 1.5;
          overflow: hidden;
        }
        .agent-knowledge-cell--expanded .agent-knowledge-text {
          min-height: 0;
        }
        .research-source-logo {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 14px 32px rgba(59, 130, 246, 0.24);
          overflow: hidden;
        }
        .research-source-logo span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-size: 18px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.92);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .research-source-logo img {
          width: 70%;
          height: 70%;
          object-fit: contain;
          border-radius: 12px;
        }
        .research-source-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.4;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 24px 18px 52px;
          }
          .research-root .stage-layout__content {
            padding: 24px 18px 48px;
          }
          .research-card {
            padding: 28px;
          }
          .agent-sources-cell,
          .agent-knowledge-cell {
            min-width: 0;
          }
        }
        @media (max-width: 680px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: ${TOPBAR_HEIGHT}px;
            z-index: 20;
          }
          .stage-layout__content {
            padding: 16px 16px 48px;
          }
          .research-stage {
            --stage-topbar-offset: 0px;
          }
          .research-root {
            overflow: auto;
            --stage-topbar-offset: 0px;
          }
          .research-root .stage-layout__sidebar {
            height: auto;
            overflow-y: visible;
            padding: 12px 16px 0;
          }
          .research-root .stage-layout__content {
            height: auto;
            padding: 16px 16px 48px;
          }
          .research-sources-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
          .agent-sources-cell,
          .agent-knowledge-cell {
            min-width: 0;
          }
        }
      `}</style>
    </main>
  </div>
  );
}
