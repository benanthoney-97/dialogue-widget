"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";
import { usePathname } from "next/navigation";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";

type FeedbackApiEntry = {
  id: string;
  title: string;
  body: string | null;
  source: string | null;
  fromUrl: string | null;
  createdAt: string | null;
  personaName: string | null;
  personaImage: string | null;
  submittedBy: string | null;
};

type FeedbackApiPayload = {
  entries: FeedbackApiEntry[];
};

function formatFeedbackDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getPersonaDisplayName(value?: string | null): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : "General";
}

function getPersonaImageUrl(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildPersonaInitial(name: string | null | undefined): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

function deriveClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^/]+)/);
  return match ? match[1] : "";
}

export default function FeedbackPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => deriveClientSlug(pathname), [pathname]);
  const [feedbackRows, setFeedbackRows] = useState<FeedbackApiEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<FeedbackApiEntry | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadFeedback() {
      if (!clientSlug) {
        setFeedbackRows([]);
        setFetchError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setFetchError(null);

      try {
        const response = await fetch(`/api/clients/${encodeURIComponent(clientSlug)}/feedback`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = "Failed to load feedback";
          try {
            const payload = (await response.json()) as { error?: string } | null;
            if (payload?.error) {
              message = payload.error;
            }
          } catch {
            // ignore JSON parse failure
          }
          throw new Error(message);
        }

        const payload = (await response.json()) as FeedbackApiPayload;
        if (!isMounted) return;
        setFeedbackRows(payload.entries ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Failed to load feedback";
        if (isMounted) {
          setFeedbackRows([]);
          setFetchError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }


    }

    void loadFeedback();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientSlug]);

  const goToPageHref = activeRow?.fromUrl?.trim() ?? "";
  const handleGoToPage = useCallback(() => {
    if (!goToPageHref) return;
    window.open(goToPageHref, "_blank");
  }, [goToPageHref]);
  const handleShareFeedback = useCallback(async () => {
    if (!activeRow) return;
    const shareData: ShareData = {
      title: activeRow.title ?? "Feedback submission",
      text: activeRow.body ?? undefined,
      url: goToPageHref || undefined,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch (shareError) {
        console.error("Share API error", shareError);
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const fallbackText = goToPageHref || activeRow.body || activeRow.title || "";
      if (!fallbackText) return;
      try {
        await navigator.clipboard.writeText(fallbackText);
      } catch (clipboardError) {
        console.error("Clipboard copy failed", clipboardError);
      }
    }
  }, [activeRow, goToPageHref]);

  const personaDisplayName = getPersonaDisplayName(activeRow?.personaName);
  const personaImageUrl = getPersonaImageUrl(activeRow?.personaImage);
  const personaInitial = buildPersonaInitial(personaDisplayName);

  return (
    <div
      className="feedback-stage"
      style={{
        "--stage-topbar-offset": "var(--sidebar-width)",
        "--feedback-topbar-height": `${TOPBAR_HEIGHT}px`,
      } as React.CSSProperties}
    >
      <Topbar title="Feedback" offsetLeft="var(--stage-topbar-offset, 0px)" hideCadenceControls hideProfileAvatar />
      <main className="stage-layout feedback-root">
        <aside className="stage-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="stage-layout__content">
          <div className="stage-shell">
            <section className="stage-panel">
              <div className="stage-panel__body">
                <div className="feedback-table-section">
                  <div className={`feedback-table-wrap${loading ? " feedback-table-wrap--busy" : ""}`} >
                    <table className="feedback-table">
                      <thead>
                        <tr>
                          <th>Submitted on</th>
                          <th>Topic</th>
                          <th>Type</th>
                          <th>Submitted by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!loading && fetchError ? (
                          <tr>
                            <td colSpan={4} className="feedback-empty">
                              {fetchError}
                            </td>
                          </tr>
                        ) : !loading && feedbackRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="feedback-empty">
                              No feedback has been submitted yet.
                            </td>
                          </tr>
                        ) : (
                          !loading &&
                          feedbackRows.map((row) => (
                            <tr
                              key={row.id}
                              className="feedback-table__row feedback-table__row--clickable"
                              tabIndex={0}
                              role="button"
                              onClick={() => setActiveRow(row)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setActiveRow(row);
                                }
                              }}
                            >
                              <td>{formatFeedbackDate(row.createdAt)}</td>
                              <td>{row.title || "Untitled feedback"}</td>
                              <td>{row.personaName ?? "General"}</td>
                              <td>{row.submittedBy ?? "Anonymous"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <div
                      className={`feedback-table-overlay${loading ? " feedback-table-overlay--visible" : ""}`}
                      aria-live="polite"
                    >
                      <span className="stage-alert stage-alert--info">Loading feedback…</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SlidingPanelOverlay
        open={Boolean(activeRow)}
        onRequestClose={() => setActiveRow(null)}
        onAfterClose={() => setActiveRow(null)}
        title={activeRow?.title ?? "Feedback submission"}
  titleId="feedback-overlay-title"
        bodyClassName="feedback-panel"
        actions={
          <div className="feedback-panel__actions">
            <button
              type="button"
              className="feedback-panel__go-page"
              onClick={handleGoToPage}
              disabled={!goToPageHref}
            >
              Go to page
            </button>
            <button
              type="button"
              className="feedback-panel__go-page"
              onClick={() => {
                void handleShareFeedback();
              }}
            >
              Share feedback
            </button>
          </div>
        }
      >
  {activeRow ? (
          <>
            <div className="feedback-panel__meta">
              <div>
                <p className="feedback-panel__meta-label">Submitted on</p>
                <p className="feedback-panel__meta-value">{formatFeedbackDate(activeRow.createdAt)}</p>
              </div>
              <div>
                <p className="feedback-panel__meta-label">Submitted by</p>
                <p className="feedback-panel__meta-value">{activeRow.submittedBy ?? "Anonymous"}</p>
              </div>
              <div>
                <p className="feedback-panel__meta-label">Persona</p>
                  <div className="feedback-panel__meta-persona">
                    <div className="feedback-panel__meta-persona-avatar" aria-hidden="true">
                      {personaImageUrl ? (
                        <img src={personaImageUrl} alt={`${personaDisplayName} avatar`} />
                      ) : (
                        <span>{personaInitial}</span>
                      )}
                    </div>
                    <p className="feedback-panel__meta-value">{personaDisplayName}</p>
                  </div>
              </div>
            </div>
            <div className="feedback-panel__body">
              <p className="feedback-panel__body-heading">User feedback</p>
              <p
                className={`feedback-panel__body-text${activeRow.body ? "" : " feedback-panel__body-text--muted"}`}
              >
                {activeRow.body ?? "No additional detail was provided for this entry."}
              </p>
            </div>
          </>
        ) : (
          <div className="feedback-panel__body">
            <p className="feedback-panel__body-text">Select a row to preview the feedback.</p>
          </div>
        )}
      </SlidingPanelOverlay>
      <style>{`
        .feedback-stage {
          position: relative;
          min-height: 100vh;
          font-family: ${BODY_FONT_STACK};
        }
        .stage-layout {
          background: var(--bg, #f4f8ff);
          display: flex;
          flex-direction: row;
          min-height: 100vh;
        }
        .stage-layout__sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: stretch;
          padding: 24px 24px 64px;
          height: 100%;
          overflow: hidden;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: 100%;
        }
        .feedback-table-section {
          width: 100%;
        }
        .feedback-table-wrap {
          width: 100%;
          min-width: 0;
          overflow-x: auto;
          position: relative;
        }
        .feedback-table-wrap--busy {
          pointer-events: none;
          opacity: 0.5;
        }
        .feedback-table {
          width: 100%;
          min-width: 0;
          table-layout: fixed;
          font-family: 'Cooper', 'Helvetica Neue', sans-serif;
          font-size: 15px;
          background: var(--bg, #f4f8ff);
          border-collapse: collapse;
          border-spacing: 0;
        }
        .stage-panel {
          background: #ffffff;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          color: #1e293b;
          flex: 1;
          min-height: 0;
        }
        .stage-panel__body {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
          padding: 0;
        }
        .feedback-panel__body {
          background: #f5f7ff;
          border-radius: 16px;
          padding: 18px 20px;
          min-height: 140px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .feedback-table__row--clickable {
          cursor: pointer;
        }
        .feedback-table__row--clickable:hover td:first-child,
        .feedback-table__row--clickable:focus-visible td:first-child {
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
        }
        .feedback-panel__actions {
        .feedback-table__row {
          transition: background 0.2s ease;
        }
        .feedback-table__row--clickable {
          cursor: pointer;
        }
        .feedback-table__row--clickable:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.45);
          outline-offset: -1px;
        }
        .feedback-table__row:hover {
          background: rgba(59, 130, 246, 0.08);
        }
        .feedback-table-overlay {
          position: absolute;
          top: 50%;
          left: 16px;
          right: 16px;
          transform: translateY(-50%);
          display: none;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .feedback-table-overlay--visible {
          display: flex;
          opacity: 1;
        }
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          gap: 10px;
        }
        .feedback-panel__actions button {
          width: 100%;
          min-width: 0;
        }
        .feedback-table__row--clickable:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.45);
          outline-offset: -1px;
        }
        .feedback-table th,
        .feedback-table td {
          padding: 16px;
          border: none;
        }
        .feedback-table th {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: rgba(15, 23, 42, 0.65);
          text-align: left;
        }
        .feedback-status-badge {
          display: inline-flex;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .feedback-empty {
          text-align: center;
          padding: 32px 0;
          color: rgba(15, 23, 42, 0.5);
        }
        .feedback-panel {
          gap: 18px;
        }
        .feedback-panel__meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .feedback-panel__meta > div {
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px 14px;
        }
        .feedback-panel__meta-persona {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .feedback-panel__meta-persona-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #0f172a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .feedback-panel__meta-persona-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        .feedback-panel__meta-label {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: rgba(15, 23, 42, 0.45);
        }
        .feedback-panel__meta-value {
          margin: 0;
          font-size: 14px;
          color: #0f172a;
        }
        .feedback-panel__body {
          background: #f5f7ff;
          border-radius: 16px;
          padding: 18px 20px;
          min-height: 140px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .feedback-panel__go-page {
          align-self: flex-start;
          appearance: none;
          border: none;
          border-radius: 12px;
          padding: 12px 18px;
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          background: #0f172a;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
          min-height: 44px;
        }
        .feedback-panel__go-page:hover:not(:disabled),
        .feedback-panel__go-page:focus-visible:not(:disabled) {
          transform: translateY(-1px);
          background: #111b2e;
        }
        .feedback-panel__go-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .feedback-panel__body-heading {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .feedback-panel__body-text {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
          white-space: pre-line;
        }
        .feedback-panel__body-text--muted {
          color: rgba(15, 23, 42, 0.6);
        }
        .feedback-panel__actions-blank {
          flex: 1;
          min-height: 120px;
        }
        .feedback-panel__source {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.6);
          font-style: italic;
        }
        .feedback-root {
          height: 100vh;
          box-sizing: border-box;
          padding-top: var(--feedback-topbar-height, 0px);
          overflow: hidden;
        }
        .feedback-root .stage-layout__sidebar {
          height: calc(100vh - var(--feedback-topbar-height, 0px));
          min-height: 0;
          overflow-y: auto;
          box-sizing: border-box;
          padding: 12px 0 24px;
        }
        .feedback-root .stage-layout__content {
          height: calc(100vh - var(--feedback-topbar-height, 0px));
          padding: 24px 64px 12px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .feedback-root .stage-shell {
          flex: 1;
          min-height: 0;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 20px 18px 56px;
          }
          .feedback-root .stage-layout__content {
            padding: 20px 18px 56px;
          }
        }
        @media (max-width: 768px) {
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
            padding: 16px 16px 56px;
          }
          .feedback-stage {
            --feedback-topbar-height: 0px;
          }
          .stage-panel__header,
          .stage-panel__body {
            padding-left: 24px;
            padding-right: 24px;
          }
          .stage-panel__titles h2 {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
}
