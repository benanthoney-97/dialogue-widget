"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";

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
  knowledgeText: string | null;
  updatedAt: string | null;
  sourcedArticles: Array<{ title: string; url: string }>;
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
  const [selectedAgent, setSelectedAgent] = useState<AgentResearchRecord | null>(null);
  const overlayTitleId = "research-overlay-title";
  const overlayDescriptionId = "research-overlay-description";

  const knowledgeParagraphs = useMemo(() => {
    const text = selectedAgent?.knowledgeText;
    if (!text) return null;
    return text
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ));
  }, [selectedAgent?.knowledgeText]);

  const closeOverlay = () => {
    setSelectedAgent(null);
  };

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
                const sourcedArticles =
                  Array.isArray(record.sourced_articles) && record.sourced_articles.length > 0
                    ? record.sourced_articles
                        .map((article) => ({
                          title:
                            typeof article?.title === "string" && article.title.trim().length > 0
                              ? article.title.trim()
                              : "Untitled article",
                          url: typeof article?.url === "string" ? article.url : "",
                        }))
                        .filter((article) => article.url.length > 0)
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
      style={{
        "--stage-topbar-offset": "var(--sidebar-width)",
        fontFamily: BODY_FONT_STACK,
      } as React.CSSProperties}
    >
      <Topbar
        title="Web research"
        offsetLeft="var(--stage-topbar-offset, 0px)"
        hideProfileAvatar
        hideCadenceControls
        centerSlot={
          <div
            className="research-chip-tabs research-chip-tabs--topbar"
            role="list"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <button
              type="button"
              className={`research-chip research-chip--tab${activeView === "agent" ? " research-chip--active" : ""}`}
              role="tab"
              aria-selected={activeView === "agent"}
              onClick={() => setActiveView("agent")}
            >
              Agent Research
            </button>
            <button
              type="button"
              className={`research-chip research-chip--tab${activeView === "sources" ? " research-chip--active" : ""}`}
              role="tab"
              aria-selected={activeView === "sources"}
              onClick={() => setActiveView("sources")}
            >
              Target Sources
            </button>
          </div>
        }
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
                            <th scope="col">Last updated</th>
                          </tr>
                          </thead>
                          <tbody>
                            {agentResearch.map((item) => {
                              const isExpandable = Boolean(item.knowledgeText && item.knowledgeText.length > 240);

                              const rowClassName = [
                                "agent-row",
                                isExpandable ? "agent-row--expandable" : "",
                              ]
                                .filter(Boolean)
                                .join(" ");

                              const handleRowClick = () => {
                                setSelectedAgent(item);
                              };

                              const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedAgent(item);
                                }
                              };
                              return (
                                <tr
                                  key={item.agentId}
                                  className={rowClassName}
                                  onClick={handleRowClick}
                                  onKeyDown={handleRowKeyDown}
                                  role="button"
                                  tabIndex={0}
                                >
                                  <td>{item.personaName}</td>
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
                                <Image
                                  src={source.logoUrl}
                                  alt={source.name}
                                  className="research-source-logo__image"
                                  width={64}
                                  height={64}
                                  unoptimized
                                />
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
        {selectedAgent ? (
          <SlidingPanelOverlay
            open
            onRequestClose={closeOverlay}
            onAfterClose={() => setSelectedAgent(null)}
            title={
              <div className="research-overlay__header-content">
                <span>{selectedAgent.personaName}</span>
                <p className="research-overlay__updated">
                  Last updated <strong>{formatUpdatedAt(selectedAgent.updatedAt)}</strong>
                </p>
              </div>
            }
            titleId={overlayTitleId}
            descriptionId={overlayDescriptionId}
            actions={
              <div className="research-overlay__actions-stack">
                {selectedAgent.sourcedArticles.length > 0 ? (
                  <section className="research-overlay__sources" aria-label="Source articles">
                    <p className="research-overlay__sources-heading">Sourced articles</p>
                    <ul>
                      {selectedAgent.sourcedArticles.map((article) => (
                        <li key={article.url}>
                          <a href={article.url} target="_blank" rel="noreferrer">
                            {article.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            }
          >
            <div id={overlayDescriptionId} className="research-overlay__body">
              <div className="research-overlay__main" role="group" aria-labelledby={overlayTitleId}>
                <section className="research-overlay__summary" aria-label="Knowledge summary">
                  <p className="research-overlay__placeholder-heading">Summary</p>
                  {knowledgeParagraphs || <p className="research-overlay__placeholder-text">No knowledge captured for this persona.</p>}
                </section>
              </div>
            </div>
         </SlidingPanelOverlay>
        ) : null}
      </main>
      <style>{`
        .research-stage {
          position: relative;
          min-height: 100vh;
        }
        .stage-layout {
          background: var(--bg, #f4f8ff);
          font-family: ${BODY_FONT_STACK};
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
          font-family: ${HEADING_FONT_STACK};
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
        .research-chip-tabs {
          display: inline-flex;
          margin: 4px 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.14);
          overflow: hidden;
          background: rgba(248, 250, 255, 0.95);
          min-width: 320px;
        }
        .research-chip-tabs--topbar {
          margin: 0;
          min-width: 280px;
        }
        .research-chip {
          border: none;
          background: transparent;
          color: #052033;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 18px;
          cursor: pointer;
          transition: background 0.18s ease;
          flex: 1;
          text-align: center;
        }
        .research-chip--tab:first-child {
          border-right: 1px solid rgba(15, 23, 42, 0.14);
        }
        .research-chip--tab:focus-visible,
        .research-chip--tab:hover {
          outline: none;
          background: rgba(59, 130, 246, 0.12);
        }
        .research-chip--active {
          background: rgba(59, 130, 246, 0.18);
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
          font-family: ${HEADING_FONT_STACK};
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
        .research-overlay__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .research-overlay__header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .research-overlay__header-content {
          display: flex;
          flex-direction: row;
          align-items: baseline;
          gap: 12px;
        }
        .research-overlay__updated {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.68);
        }
        .research-overlay__close {
          border: none;
          background: transparent;
          color: #0f172a;
          font-weight: 600;
          cursor: pointer;
        }
        .research-overlay__body {
          flex: 1;
          display: flex;
          gap: 28px;
          align-items: stretch;
          min-height: 0;
        }
        .research-overlay__main {
          flex: 1;
          min-width: 0;
          background: rgba(148, 197, 255, 0.12);
          border: 1px dashed rgba(59, 130, 246, 0.32);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: rgba(15, 23, 42, 0.78);
        }
        .research-overlay__summary {
          font-size: 14px;
          color: #475569;
          line-height: 1.6;
        }
        .research-overlay__actions-stack {
          flex: 1;
          min-height: 0;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.16);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .research-overlay__actions-placeholder {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.72);
        }
        .research-overlay__sources {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.75);
        }
        .research-overlay__sources-heading {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.55);
        }
        .research-overlay__placeholder-heading {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.55);
        }
        .research-overlay__placeholder-text {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .research-overlay__sources ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .research-overlay__sources li a {
          color: #1d4ed8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }
        .research-overlay__sources li a:hover {
          text-decoration: underline;
        }
        .agent-articles-list {
          margin: 0;
          padding-left: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
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
          font-family: ${HEADING_FONT_STACK};
        }
        .research-source-logo__image {
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
    </div>
  );
}
        /* placeholder styles moved into main block */
