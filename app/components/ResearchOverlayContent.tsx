"use client";

import React, { useEffect, useState } from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";

export type AgentResearchRecord = {
  agentId: string;
  personaName: string;
  knowledgeText: string | null;
  updatedAt: string | null;
  sourcedArticles: Array<{ title: string; url: string }>;
  addedArticles: Array<{ title: string; url: string }>;
  sourcedArticlesCount: number;
  watchlistQuery: string | null;
  currentJobStatus?: string | null;
};

type ResearchOverlayTab = "research" | "prompt" | "sources";

type ExternalProvider = {
  id: string;
  name: string;
  logo: string | null;
};

type ResearchOverlayContentProps = {
  agent: AgentResearchRecord;
  activeTab: ResearchOverlayTab;
  setActiveTab: (tab: ResearchOverlayTab) => void;
  promptValue: string;
  isPromptDirty: boolean;
  isPromptSaving: boolean;
  promptSaveError: string | null;
  onPromptChange: (value: string) => void;
  onPromptSave: () => void;
  onClearPrompt: () => void;
  onRemoveArticle: (url: string) => void;
  onAddArticle: (article: { title: string | null; url: string | null }) => void;
  overlayTitleId: string;
  overlayDescriptionId: string;
};

const EXTERNAL_SOURCES_ENDPOINT = "/api/external-sources";

export default function ResearchOverlayContent({
  agent,
  activeTab,
  setActiveTab,
  promptValue,
  isPromptDirty,
  isPromptSaving,
  promptSaveError,
  onPromptChange,
  onPromptSave,
  onClearPrompt,
  onRemoveArticle,
  onAddArticle,
  overlayTitleId,
  overlayDescriptionId,
}: ResearchOverlayContentProps) {
  const [externalProviders, setExternalProviders] = useState<ExternalProvider[]>([]);
  const [externalProvidersLoading, setExternalProvidersLoading] = useState(true);
  const [externalProvidersError, setExternalProvidersError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadExternalSources = async () => {
      setExternalProvidersLoading(true);
      setExternalProvidersError(null);

      try {
        const response = await fetch(EXTERNAL_SOURCES_ENDPOINT, { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load external sources");
        }

        const normalized = Array.isArray(payload?.sources)
          ? (payload.sources as Partial<ExternalProvider>[])
              .map((source) => ({
                id: source?.id ?? "",
                name: typeof source?.name === "string" ? source.name : "",
                logo:
                  typeof source?.logo === "string" && source.logo.trim().length > 0
                    ? source.logo.trim()
                    : null,
              }))
              .filter((source): source is ExternalProvider => Boolean(source.id && source.name))
          : [];

        if (isMounted) {
          setExternalProviders(normalized);
        }
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to load sources.";
        setExternalProvidersError(message);
      } finally {
        if (isMounted) {
          setExternalProvidersLoading(false);
        }
      }
    };

    loadExternalSources();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!agent) return null;

  return (
    <>
      <div className="research-overlay__tabs">
        <button
          type="button"
          className={`research-overlay__tab${activeTab === "research" ? " research-overlay__tab--active" : ""}`}
          onClick={() => setActiveTab("research")}
        >
          Research
        </button>
        <button
          type="button"
          className={`research-overlay__tab${activeTab === "sources" ? " research-overlay__tab--active" : ""}`}
          onClick={() => setActiveTab("sources")}
        >
          Sources
        </button>
        <button
          type="button"
          className={`research-overlay__tab${activeTab === "prompt" ? " research-overlay__tab--active" : ""}`}
          onClick={() => setActiveTab("prompt")}
        >
          Prompt
        </button>
      </div>
      <div className="research-overlay__metadata">
        <p className="research-overlay__updated">
        </p>
      </div>
      <div id={overlayDescriptionId} className="research-overlay__body">
        {activeTab === "research" ? (
          <div className="research-overlay__content">
            <div className="research-overlay__actions-stack">
              <p className="research-overlay__sources-heading">New articles</p>
              {agent.sourcedArticles.length > 0 ? (
                <ul className="research-overlay__sources-list">
                  {agent.sourcedArticles.map((article) => (
                    <li key={article.url} className="research-overlay__knowledge-item">
                      <div className="research-overlay__knowledge-controls">
                        <button
                          type="button"
                          className="research-overlay__knowledge-button research-overlay__knowledge-back"
                          aria-label="Add research"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAddArticle(article);
                          }}
                        >
                          Add research
                        </button>
                        <button
                          type="button"
                          className="research-overlay__knowledge-button research-overlay__knowledge-close"
                          aria-label="Remove sourced article"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!article.url) return;
                            onRemoveArticle(article.url);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.title}
                      </a>
                      <p className="research-overlay__source-url">{article.url}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="research-overlay__actions-placeholder">
                  New articles will appear here once they are queued for evaluation.
                </p>
              )}
            </div>
            <div className="research-overlay__main" role="group" aria-labelledby={overlayTitleId}>
              <section className="research-overlay__snapshot-panel" aria-label="Knowledge snapshot">
                <p className="research-overlay__snapshot-heading">Added Research</p>
                {agent.addedArticles.length > 0 ? (
                  <ul className="research-overlay__sources-list">
                    {agent.addedArticles.map((article) => (
                      <li key={article.url} className="research-overlay__knowledge-item">
                        <a href={article.url} target="_blank" rel="noreferrer">
                          {article.title}
                        </a>
                        <p className="research-overlay__source-url">{article.url}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="research-overlay__actions-placeholder">
                    Knowledge sources show here once they’re incorporated into the agent’s understanding.
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : activeTab === "sources" ? (
          <section className="research-overlay__sources-panel" aria-label="Sources placeholder">
            {externalProvidersLoading ? (
              <p className="research-overlay__sources-status">Loading sources…</p>
            ) : externalProvidersError ? (
              <p className="research-overlay__sources-status research-overlay__sources-error">
                {externalProvidersError}
              </p>
            ) : externalProviders.length === 0 ? (
              <p className="research-overlay__placeholder-line">
                No sources are configured yet. Check back once external providers are available.
              </p>
            ) : (
              <div className="research-overlay__sources-grid">
                {externalProviders.map((source) => (
                  <article key={source.id} className="research-overlay__sources-card">
                    {source.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={source.logo}
                        alt={`${source.name} logo`}
                        className="research-overlay__sources-card-logo"
                        loading="lazy"
                      />
                    ) : (
                      <div className="research-overlay__sources-card-fallback">
                        {source.name
                          .split(" ")
                          .map((token) => token.charAt(0))
                          .join("")
                          .slice(0, 3)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="research-overlay__sources-card-body">
                      <p className="research-overlay__sources-card-title">{source.name}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="research-overlay__prompt-panel" aria-label="Research prompt">
            <p className="research-overlay__placeholder-heading">Research Prompt</p>
            <textarea
              className="research-overlay__prompt-input"
              value={promptValue}
              placeholder="No research prompt captured for this persona."
              onChange={(event) => onPromptChange(event.target.value)}
              disabled={isPromptSaving}
            />
            <div className="research-overlay__prompt-status">
              {isPromptSaving ? (
                <span>Saving…</span>
              ) : promptSaveError ? (
                <span className="research-overlay__prompt-error">{promptSaveError}</span>
              ) : !isPromptDirty ? (
                <span className="research-overlay__prompt-hint">No changes yet. Edit the prompt to unlock the banner.</span>
              ) : null}
            </div>
            {isPromptDirty ? (
              <div className="persona-unsaved-banner persona-unsaved-banner--visible research-prompt-banner">
                <div className="research-prompt-banner__message">
                  <span className="persona-unsaved-message">You have unsaved changes to this prompt</span>
                  <span className="research-prompt-banner__refresh">Refreshes weekly</span>
                </div>
                <div className="persona-unsaved-actions">
                  <button
                    type="button"
                    className="persona-unsaved-clear"
                    onClick={onClearPrompt}
                    disabled={isPromptSaving}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="persona-unsaved-save"
                    onClick={onPromptSave}
                    disabled={isPromptSaving}
                  >
                    Save &amp; Refresh
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
      <style jsx global>{`
        .research-overlay__updated,
        .research-overlay__updated strong,
        .research-overlay__refresh-note {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.2px;
          color: rgba(15, 23, 42, 0.7);
          font-family: ${BODY_FONT_STACK};
        }
        .research-overlay__title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .research-overlay__tabs {
          display: flex;
          gap: 12px;
        }
        .research-overlay__body {
          flex: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: stretch;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }
        .research-overlay__tab {
          width: 150px;
          padding: 8px 0;
          border: 1px solid rgba(59, 130, 246, 0.18);
          background: rgba(59, 130, 246, 0.08);
          color: rgba(15, 23, 42, 0.75);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          border-radius: 12px;
          cursor: pointer;
          transition: border 0.2s ease, color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
          text-align: center;
        }
        .research-overlay__tab--active {
          background: rgba(59, 130, 246, 0.16);
          border-color: rgba(59, 130, 246, 0.4);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
          color: #052033;
        }
        .research-overlay__preview-link {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.2px;
          color: rgba(15, 23, 42, 0.7);
          font-family: ${BODY_FONT_STACK};
          display: block;
          margin-top: 2px;
          word-break: break-all;
        }
        .research-overlay__content {
          width: 100%;
          display: flex;
          gap: 28px;
          flex: 1;
          min-height: 0;
          flex-wrap: nowrap;
          align-items: stretch;
        }
        .research-overlay__content .research-overlay__main {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.16);
          border-radius: 16px;
          padding: 20px;
          flex: 2;
          min-width: 0;
          width: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: visible;
          position: relative;
          height: 100%;
        }
        .research-overlay__sources-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
          margin-top: 4px;
        }
        .research-overlay__sources-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
        }
        .research-overlay__sources-card-image {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(16, 185, 129, 0.25));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.4);
        }
        .research-overlay__sources-card-logo {
          width: 100%;
          height: 80px;
          object-fit: contain;
          border-radius: 8px;
          background: rgba(248, 250, 252, 1);
        }
        .research-overlay__sources-card-fallback {
          width: 100%;
          height: 80px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.6);
          letter-spacing: 0.2em;
        }
          gap: 16px;
          overflow: visible;
          position: relative;
        }
        .research-overlay__snapshot-panel {
          background: rgba(59, 130, 246, 0.1);
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.16);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          color: rgba(15, 23, 42, 0.8);
          min-height: 140px;
          flex: 1;
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          position: relative;
        }
        .research-overlay__snapshot-heading,
        .research-overlay__sources-heading {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: rgba(15, 23, 42, 0.55);
        }
        .research-overlay__sources-panel {
          width: 100%;
          flex: 1;
          min-height: 0;
          border-radius: 20px;
          border: 1px dashed rgba(15, 23, 42, 0.1);
          padding: 32px;
          padding-top: 0px'
          display: flex;
          flex-direction: column;
          gap: 12px;
          justify-content: flex-start;
          align-items: stretch;
        }
        .research-overlay__placeholder-line {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.65);
          line-height: 1.5;
        }
        .research-overlay__sources-hero {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .research-overlay__sources-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 4px;
        }
        .research-overlay__sources-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.08);
        }
        .research-overlay__sources-card-image {
          width: 100%;
          height: 96px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(16, 185, 129, 0.25));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.4);
        }
        .research-overlay__sources-card-logo {
          width: 100%;
          height: 96px;
          object-fit: contain;
          border-radius: 10px;
          background: rgba(248, 250, 252, 1);
        }
        .research-overlay__sources-card-fallback {
          width: 100%;
          height: 96px;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.6);
          letter-spacing: 0.2em;
        }
        .research-overlay__sources-card-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .research-overlay__sources-card-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .research-overlay__sources-card-description {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
        }
        .research-overlay__sources-status {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
        }
        .research-overlay__sources-error {
          color: #b91c1c;
        }
        .research-overlay__actions-stack {
          flex: 0 0 40%;
          width: 40%;
          min-width: 320px;
          max-width: 40%;
          min-height: 0;
          height: 100%;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.16);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: auto;
        }
        .research-overlay__actions-placeholder {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.72);
        }
        .research-overlay__sources-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .research-overlay__actions-stack .research-overlay__sources-list,
        .research-overlay__main .research-overlay__sources-list {
          flex: 1;
          min-height: 0;
          max-height: 100%;
          overflow-y: auto;
        }
        .research-overlay__knowledge-item {
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.9);
          position: relative;
          font-size: 12px;
        }
        .research-overlay__knowledge-controls {
          position: absolute;
          bottom: 6px;
          right: 6px;
          display: flex;
          gap: 6px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }
        .research-overlay__knowledge-item:hover .research-overlay__knowledge-controls {
          opacity: 1;
          pointer-events: auto;
        }
        .research-overlay__knowledge-button {
          min-width: 60px;
          height: 28px;
          border: none;
          border-radius: 999px;
          font-size: 10px;
          letter-spacing: 0.04em;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
        }
        .research-overlay__knowledge-close {
          background: rgba(15, 23, 42, 0.2);
          color: #0f172a;
        }
        .research-overlay__knowledge-back {
          background: rgba(16, 185, 129, 0.32);
          color: #064e3b;
        }
        .research-overlay__source-url {
          margin: 4px 0 0;
          font-size: 10px;
          color: rgba(15, 23, 42, 0.6);
          word-break: break-all;
        }
        .research-overlay__prompt-panel {
          width: 100%;
          flex: 1;
          min-height: 0;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: auto;
        }
        .research-overlay__placeholder-heading {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.55);
        }
        .research-overlay__prompt-input {
          width: 100%;
          flex: 1;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          padding: 12px;
          font-size: 14px;
          font-family: ${BODY_FONT_STACK};
          background: #ffffff;
          resize: none;
          min-height: 0;
          color: rgba(15, 23, 42, 0.85);
        }
        .research-overlay__prompt-input:focus-visible {
          outline: none;
          border-color: rgba(59, 130, 246, 0.8);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
        }
        .research-overlay__prompt-status {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
        }
        .research-overlay__prompt-error {
          color: #b91c1c;
        }
        .research-overlay__prompt-action {
          margin-top: 8px;
          align-self: flex-start;
          border: none;
          background: #0f172a;
          color: #ffffff;
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .research-overlay__prompt-action:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .research-overlay__prompt-action:not(:disabled):hover,
        .research-overlay__prompt-action:not(:disabled):focus-visible {
          transform: translateY(-1px);
          background: #001935;
        }
        .persona-unsaved-banner.persona-unsaved-banner--visible {
          display: flex;
        }
        .research-prompt-banner__message {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .persona-unsaved-actions {
          display: flex;
          gap: 8px;
        }
      `}</style>
    </>
  );
}
