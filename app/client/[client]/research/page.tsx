"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import ResearchOverlayContent, { AgentResearchRecord } from "@/app/components/ResearchOverlayContent";
import { useResearchOverlayState } from "@/app/hooks/useResearchOverlayState";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}
function getClientIdFromPath(pathname: string | null): string {
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

const ARTICLE_PREVIEW_LIMIT = 2;
const TOP_SOURCE_LIMIT = 2;
const ARTICLE_TITLE_TRIM = 48;

const truncateText = (value: string, limit: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
};

const deriveSourceLabel = (rawUrl: string | null | undefined): string | null => {
  if (!rawUrl) return null;
  const candidate = rawUrl.trim();
  if (!candidate) return null;
  try {
    return new URL(candidate).hostname;
  } catch {
    const withoutProtocol = candidate.replace(/^https?:\/\//i, "");
    const host = withoutProtocol.split(/[/?#]/)[0];
    return host || null;
  }
};

const deriveTopSources = (articles: AgentResearchRecord["sourcedArticles"]) => {
  const counts = new Map<string, number>();
  articles.forEach((article) => {
    const label = deriveSourceLabel(article.url);
    if (!label) return;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, TOP_SOURCE_LIMIT)
    .map(([label]) => label);
};

export default function ResearchPage() {
  const pathname = usePathname();
  const router = useRouter();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const clientIdFromPath = useMemo(() => getClientIdFromPath(pathname), [pathname]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [availableSources, setAvailableSources] = useState<ExternalSource[]>([]);
  const [activeView, setActiveView] = useState<"agent" | "sources">("agent");
  const {
    agentResearch,
    agentResearchLoading,
    agentResearchError,
    selectedAgent,
    selectAgentById,
    promptValue,
    isPromptDirty,
    isPromptSaving,
    promptSaveError,
    handlePromptChange,
    handlePromptSave,
    handleClearPrompt,
    handleRemoveSourcedArticle,
    addArticleToAgent,
    setSelectedAgent,
  } = useResearchOverlayState(clientSlug);
  const overlayTitleId = "research-overlay-title";
  const overlayDescriptionId = "research-overlay-description";
  const searchParams = useSearchParams();
  const [activeOverlayTab, setActiveOverlayTab] = useState<"research" | "prompt">("research");

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
  useEffect(() => {
    const agentIdFromParam = searchParams?.get("agentId") ?? null;
    if (!agentIdFromParam) return;
    selectAgentById(agentIdFromParam);
  }, [searchParams, selectAgentById]);

  const handleCreatePersona = useCallback(() => {
    if (clientSlug) {
      router.push(`/client/${clientSlug}/upload`);
      return;
    }
    router.push("/upload");
  }, [clientSlug, router]);

  const closeOverlay = useCallback(() => {
    setSelectedAgent(null);
    if (!router) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("agentId");
    const search = params.toString();
    const targetPath = `${pathname}${search ? `?${search}` : ""}`;
    router.replace(targetPath, { scroll: false });
  }, [pathname, router, searchParams]);

  const handlePromptSaveCurrent = useCallback(() => {
    void handlePromptSave(promptValue);
  }, [handlePromptSave, promptValue]);
  const handleAddResearchArticle = useCallback(
    async (article: AgentResearchRecord["sourcedArticles"][number]) => {
      const agentId = selectedAgent?.agentId;
      const targetClientId = clientIdFromPath || clientSlug;
      const articleUrl = article?.url?.trim();
      if (!agentId || !targetClientId || !articleUrl) return;
      try {
        const response = await fetch(`/api/clients/${targetClientId}/agent-research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, article: { title: article.title, url: articleUrl } }),
        });
        if (!response.ok) {
          console.error("[Research] Failed to add research", response.status, await response.text());
          return;
        }
        addArticleToAgent(agentId, { title: article.title, url: articleUrl });
      } catch (error) {
        console.error("[Research] Failed to add research", error);
      }
    },
    [addArticleToAgent, clientIdFromPath, clientSlug, selectedAgent]
  );

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
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
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
            sourced_articles_count?: number | null;
            added_articles?: Array<{ title?: string | null; url?: string | null }>;
            watchlist_query?: string | null;
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
                const addedArticles =
                  Array.isArray(record.added_articles) && record.added_articles.length > 0
                    ? record.added_articles
                        .map((article) => ({
                          title:
                            typeof article?.title === "string" && article.title.trim().length > 0
                              ? article.title.trim()
                              : "Untitled article",
                          url: typeof article?.url === "string" ? article.url : "",
                        }))
                        .filter((article) => article.url.length > 0)
                    : [];
                const watchlistQuery =
                  typeof record.watchlist_query === "string" && record.watchlist_query.trim().length > 0
                    ? record.watchlist_query.trim()
                    : null;
                const rawSourcedArticleCount =
                  typeof record.sourced_articles_count === "number" && !Number.isNaN(record.sourced_articles_count)
                    ? Math.max(0, Math.floor(record.sourced_articles_count))
                    : null;
                const sourcedArticlesCount =
                  rawSourcedArticleCount !== null
                    ? Math.max(rawSourcedArticleCount, sourcedArticles.length)
                    : sourcedArticles.length;
                return {
                  agentId,
                  personaName,
                  knowledgeText,
                  updatedAt,
                  sourcedArticles,
                  addedArticles,
                  sourcedArticlesCount,
                  watchlistQuery,
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
                    <div
                      className={`research-agent-table${agentResearchLoading ? " research-agent-table--busy" : ""}`}
                      role="region"
                      aria-label="Agent research queue"
                    >
                      <div
                        className={`research-agent-table__overlay${agentResearchLoading ? " research-agent-table__overlay--visible" : ""}`}
                        aria-live="polite"
                      >
                        <span className="stage-alert stage-alert--info">Loading agent research…</span>
                      </div>
                      {!agentResearchLoading && (
                        <>
                          {agentResearchError ? (
                            <div className="research-agent-state research-agent-state--error">
                              {agentResearchError}
                            </div>
                          ) : agentResearch.length === 0 ? (
                            <div className="research-agent-state research-agent-state--empty">
                              <div className="research-empty-callout">
                                <button
                                  type="button"
                                  className="research-empty-callout__button"
                                  onClick={handleCreatePersona}
                                >
                                  Create first persona
                                </button>
                              </div>
                            </div>
                          ) : (
                            <table>
                              <thead>
                              <tr>
                                <th scope="col">Persona</th>
                                <th scope="col">Last updated</th>
                                <th scope="col">Articles</th>
                                <th scope="col">Top Sources</th>
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
                                  const articleCount = Math.max(
                                    item.sourcedArticlesCount,
                                    item.sourcedArticles.length
                                  );
                                  const topSources = deriveTopSources(item.sourcedArticles);
                                  return (
                                    <tr
                                      key={item.agentId}
                                      className={rowClassName}
                                      onClick={handleRowClick}
                                      onKeyDown={handleRowKeyDown}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <td className="agent-row__persona-cell">{item.personaName}</td>
                                      <td className="agent-row__updated-cell">
                                        {formatUpdatedAt(item.updatedAt)}
                                      </td>
                                      <td className="agent-row__articles-cell">
                                        <span className="agent-row__articles-count">
                                          {articleCount}
                                        </span>
                                      </td>
                                      <td className="agent-row__sources-cell">
                                        {topSources.length > 0 ? (
                                          <span className="agent-row__source-list">
                                            {topSources.join(", ")}
                                          </span>
                                        ) : (
                                          <span className="agent-row__empty">No sources</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </>
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
                  Last updated{" "}
                  <strong>{formatUpdatedAt(selectedAgent.updatedAt)}</strong>{" "}
                  <span className="research-overlay__refresh-note">(refreshes weekly)</span>
                </p>
              </div>
            }
            titleId={overlayTitleId}
            descriptionId={overlayDescriptionId}
          >
            <ResearchOverlayContent
              agent={selectedAgent}
              activeTab={activeOverlayTab}
              setActiveTabAction={setActiveOverlayTab}
              promptValue={promptValue}
              isPromptDirty={isPromptDirty}
              isPromptSaving={isPromptSaving}
              promptSaveError={promptSaveError}
              onPromptChangeAction={handlePromptChange}
              onPromptSaveAction={handlePromptSaveCurrent}
              onClearPrompt={handleClearPrompt}
              onRemoveArticle={handleRemoveSourcedArticle}
              onAddArticle={handleAddResearchArticle}
              overlayTitleId={overlayTitleId}
              overlayDescriptionId={overlayDescriptionId}
              selectedSources={selectedSources}
              onSourceToggle={handleSourceToggle}
            />
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
          margin-top: 0px;
          border: none;
          border-radius: 0px;
          overflow: hidden;
          background: none;
          box-shadow: none;
          position: relative;
          min-height: 220px;
        }
        .research-agent-table--busy {
          pointer-events: none;
          opacity: 0.4;
        }
        .research-agent-table__overlay {
          position: absolute;
          left: 16px;
          right: 16px;
          top: 60%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
          opacity: 0;
        }
        .research-agent-table__overlay--visible {
          opacity: 1;
        }
        .research-agent-table__overlay .stage-alert {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          font-size: 14px;
          color: #0f172a;
        }
        .research-agent-table table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
          font-size: 15px;
          font-family: 'Cooper', 'Helvetica Neue', sans-serif;
          background: var(--bg, #f4f8ff);
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
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(var(--accent-rgb), 0.08);
          position: sticky;
          top: 0;
          z-index: 1;
          background: none;
        }
        .research-agent-table th:nth-child(1),
        .research-agent-table td:nth-child(1) {
          width: 26%;
        }
        .research-agent-table th:nth-child(2),
        .research-agent-table td:nth-child(2) {
          width: 18%;
        }
        .research-agent-table th:nth-child(3),
        .research-agent-table td:nth-child(3) {
          width: 30%;
        }
        .research-agent-table th:nth-child(4),
        .research-agent-table td:nth-child(4) {
          width: 26%;
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
        .research-agent-state--empty {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 170px;
        }
        .research-empty-callout {
          margin-bottom: 20px;
          padding: 16px 20px;
          border-radius: 16px;
          background: transparent;
          color: rgba(15, 23, 42, 0.9);
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          text-align: center;
        }
        .research-empty-callout__button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 20px;
          border-radius: 12px;
          background: #0f172a;
          color: #f8fafc;
          font-weight: 700;
          font-size: 15px;
          border: none;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease,
            color 0.18s ease;
          font-family: inherit;
        }
        .research-empty-callout__button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
        }
        .research-agent-state--error {
          color: #b91c1c;
        }
        }
        .agent-row__articles-cell,
        .agent-row__sources-cell {
          vertical-align: middle;
        }
        .agent-row__sources-cell {
          min-width: 0;
        }
        .agent-row__articles {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.85);
        }
        .persona-unsaved-banner {
          position: fixed;
          left: 50%;
          bottom: -120px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 22px;
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          background: rgba(15, 23, 42, 0.92);
          box-shadow: 0 16px 40px rgba(10, 22, 40, 0.35);
          color: rgba(226, 232, 240, 0.9);
          z-index: 1200;
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
          width: min(560px, calc(100vw - 40px));
          opacity: 0;
          pointer-events: none;
          transition: transform 0.3s ease, opacity 0.3s ease, bottom 0.3s ease;
        }
        .persona-unsaved-banner--visible {
          bottom: 32px;
          opacity: 1;
          pointer-events: auto;
        }
        .persona-unsaved-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: flex-end;
        }
        .research-prompt-banner__message {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .research-prompt-banner__refresh {
          font-size: 11px;
          letter-spacing: 0.3px;
          color: rgba(226, 232, 240, 0.7);
        }
        .persona-unsaved-save {
          display: inline-flex;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgba(148, 195, 255, 0.45);
          background: #ffffff;
          color: #052033;
          padding: 8px 18px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.4px;
          font-family: var(--font-heading, var(--font-body, var(--font-sans)));
          cursor: pointer;
        }
        .persona-unsaved-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .persona-unsaved-banner,
        .persona-unsaved-message,
        .persona-unsaved-actions button {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .persona-unsaved-message {
          flex: 1;
          text-align: left;
        }
        .agent-row__articles-count {
          font-size: inherit;
          font-weight: 400;
          color: inherit;
          letter-spacing: 0;
          text-transform: none;
          font-family: inherit;
        }
        .agent-row__article-title {
          display: inline-block;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .agent-row__article-more {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
        }
        .agent-row__source-list {
          display: inline-flex;
          gap: 6px;
          flex-wrap: nowrap;
          font-size: 13px;
          color: rgba(30, 64, 175, 0.85);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          min-width: 0;
        }
        .agent-row__empty {
          font-size: 13px;
          color: rgba(15, 23, 42, 0.58);
        }
        .agent-row {
          transition: background 0.18s ease;
          cursor: pointer;
          border-radius: 12px;
        }
        .agent-row:hover,
        .agent-row:focus-visible {
          background: rgba(59, 130, 246, 0.08);
        }
        .agent-row:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.45);
          outline-offset: -1px;
        }
        .agent-row--expanded {
          background: rgba(37, 99, 235, 0.04);
        }
        .agent-row--expandable {
          cursor: pointer;
        }
        .persona-unsaved-clear {
          border-radius: 12px;
          border: 1px solid rgba(148, 195, 255, 0.45);
          background: transparent;
          color: rgba(226, 232, 240, 0.85);
          padding: 8px 18px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.4px;
          font-family: var(--font-heading, var(--font-body, var(--font-sans)));
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
          text-transform: none;
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
          .agent-row__articles-cell,
          .agent-row__sources-cell {
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
          .agent-row__articles-cell,
          .agent-row__sources-cell {
            min-width: 0;
          }
        }
        .stage-alert {
          width: 100%;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 600;
          font-size: 14px;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
        }
        .stage-alert--success {
          color: #166534;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.35);
        }
        .stage-alert--error {
          color: #b91c1c;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
        }
        .stage-alert--info {
          color: #0f172a;
          background: rgba(15, 23, 42, 0.12);
          border: 1px solid rgba(15, 23, 42, 0.28);
        }
      `}</style>
    </div>
  );
}
        /* placeholder styles moved into main block */
