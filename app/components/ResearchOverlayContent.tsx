"use client";

import React from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";

export type AgentResearchRecord = {
  agentId: string;
  personaName: string;
  knowledgeText: string | null;
  updatedAt: string | null;
  sourcedArticles: Array<{ title: string; url: string }>;
  sourcedArticlesCount: number;
  watchlistQuery: string | null;
};

type ResearchOverlayTab = "research" | "prompt";

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
  overlayTitleId: string;
  overlayDescriptionId: string;
  lastUpdatedLabel: string;
};

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
  overlayTitleId,
  overlayDescriptionId,
  lastUpdatedLabel,
}: ResearchOverlayContentProps) {
  if (!agent) return null;

  return (
    <>
      <div className="research-overlay__header-content">
        <span>{agent.personaName}</span>
        <p className="research-overlay__updated">
          Last updated <strong>{lastUpdatedLabel}</strong>{" "}
          <span className="research-overlay__refresh-note">(refreshes weekly)</span>
        </p>
      </div>
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
          className={`research-overlay__tab${activeTab === "prompt" ? " research-overlay__tab--active" : ""}`}
          onClick={() => setActiveTab("prompt")}
        >
          Prompt
        </button>
      </div>
      <div id={overlayDescriptionId} className="research-overlay__body">
        {activeTab === "research" ? (
          <div className="research-overlay__content">
            <div className="research-overlay__actions-stack">
              <p className="research-overlay__sources-heading">New articles</p>
              <p className="research-overlay__actions-placeholder">
                New articles will appear here once they are queued for evaluation.
              </p>
            </div>
            <div className="research-overlay__main" role="group" aria-labelledby={overlayTitleId}>
              <section className="research-overlay__snapshot-panel" aria-label="Knowledge snapshot">
                <p className="research-overlay__snapshot-heading">Added knowledge</p>
                {agent.sourcedArticles.length > 0 ? (
                  <ul className="research-overlay__sources-list">
                    {agent.sourcedArticles.map((article) => (
                      <li key={article.url} className="research-overlay__knowledge-item">
                        <button
                          type="button"
                          className="research-overlay__knowledge-close"
                          aria-label="Remove sourced article"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!article.url) return;
                            onRemoveArticle(article.url);
                          }}
                        >
                          ×
                        </button>
                        <a href={article.url} target="_blank" rel="noreferrer">
                          {article.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="research-overlay__actions-placeholder">No knowledge yet.</p>
                )}
              </section>
            </div>
          </div>
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
        .research-overlay__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .research-overlay__header-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .research-overlay__updated {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.68);
          font-family: ${BODY_FONT_STACK};
        }
        .research-overlay__refresh-note {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.68);
          font-family: ${BODY_FONT_STACK};
          text-transform: none;
          margin-left: 6px;
        }
        .research-overlay__tabs {
          display: flex;
          gap: 12px;
        }
        .research-overlay__tab {
          width: 150px;
          padding: 8px 0;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(15, 23, 42, 0.6);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.08em;
          border-radius: 12px;
          cursor: pointer;
          transition: border 0.2s ease, color 0.2s ease, background 0.2s ease;
          text-align: center;
        }
        .research-overlay__tab--active {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
          color: #0f172a;
        }
        .research-overlay__body {
          flex: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: stretch;
          min-height: 0;
          overflow-x: hidden;
        }
        .research-overlay__content {
          width: 100%;
          display: flex;
          gap: 28px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
        }
        .research-overlay__main {
          flex: 2;
          min-width: 0;
          width: 0;
          display: flex;
          flex-direction: column;
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
        .research-overlay__actions-stack {
          flex: 0 0 48%;
          width: 48%;
          min-width: 0;
          max-width: 48%;
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
          font-size: 14px;
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
        .research-overlay__knowledge-item {
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 10px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.9);
          position: relative;
        }
        .research-overlay__knowledge-close {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
          font-size: 14px;
          line-height: 1;
          display: none;
          cursor: pointer;
        }
        .research-overlay__knowledge-item:hover .research-overlay__knowledge-close {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .research-overlay__prompt-panel {
          width: 100%;
          flex: 1;
          min-height: 0;
          background: rgba(248, 250, 252, 0.9);
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
