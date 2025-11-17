"use client";

import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import { TOPBAR_HEIGHT } from "../../../components/topbarHeight";
import { supabase } from "@/app/lib/supabaseClient";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import IdeasOverlayContent from "@/app/components/IdeasOverlayContent";
import { DevelopmentIdeaRow } from "@/app/types/developmentIdea";
import { useParams, useRouter } from "next/navigation";

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getSourceDocumentText(body?: Record<string, unknown> | null) {
  if (!body || typeof body !== "object") {
    return null;
  }
  const sourceDocument = (body as Record<string, unknown>).sourceDocument;
  return typeof sourceDocument === "string" ? sourceDocument : null;
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<DevelopmentIdeaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdea, setActiveIdea] = useState<DevelopmentIdeaRow | null>(null);
  const [insightsIdea, setInsightsIdea] = useState<DevelopmentIdeaRow | null>(null);
  const [deletionCandidate, setDeletionCandidate] = useState<DevelopmentIdeaRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    supabase
      .from("development_ideas")
      .select("*")
      .order("received_at", { ascending: false })
      .then((response) => {
        if (!isMounted) return;
        if (response.error) {
          setError(response.error.message);
          setIdeas([]);
        } else {
          setIdeas(response.data ?? []);
          setError(null);
        }
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletionCandidate) return;
    setDeleting(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase
      .from("development_ideas")
      .delete()
      .eq("id", deletionCandidate.id);
    if (deleteErr) {
      setDeleteError(deleteErr.message);
    } else {
      setIdeas((prev) => prev.filter((idea) => idea.id !== deletionCandidate.id));
      setDeletionCandidate(null);
    }
    setDeleting(false);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeletionCandidate(null);
    setDeleteError(null);
  };

  const sourceDocumentTitle = getSourceDocumentText(activeIdea?.body);
  const overlayTitle = activeIdea?.call_summary_title ?? sourceDocumentTitle ?? "Idea details";
  const activeIdeaId = activeIdea?.id;
  const overlayDescription = activeIdea
    ? `Added ${formatDate(activeIdea.received_at)} · Status ${activeIdea.development_status ?? "Pending"}`
    : undefined;
  const params = useParams();
  const clientIdParam = params?.client;
  const clientId = Array.isArray(clientIdParam) ? clientIdParam[0] ?? "" : clientIdParam ?? "";

  const router = useRouter();
  const [editableTitle, setEditableTitle] = useState(overlayTitle);
  const [titleStatus, setTitleStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const titleSaveTimerRef = useRef<number | null>(null);
  const titleSkipSaveRef = useRef(true);
  const [titleDirty, setTitleDirty] = useState(false);

  useEffect(() => {
    setEditableTitle(overlayTitle);
    setTitleStatus("idle");
    setTitleDirty(false);
    titleSkipSaveRef.current = true;
  }, [overlayTitle]);

  useEffect(() => {
    setTitleStatus("idle");
    titleSkipSaveRef.current = true;
    setTitleDirty(false);
  }, [activeIdeaId]);

  useEffect(() => {
    if (!activeIdeaId) {
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
      }
      return;
    }
    if (titleSkipSaveRef.current) {
      titleSkipSaveRef.current = false;
      return;
    }
    setTitleStatus("saving");
    if (titleSaveTimerRef.current !== null) {
      window.clearTimeout(titleSaveTimerRef.current);
    }
    let idleTimer: number | null = null;
    titleSaveTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("development_ideas")
        .update({ call_summary_title: editableTitle })
        .eq("id", activeIdeaId);
      if (error) {
        setTitleStatus("error");
      } else {
        setTitleStatus("saved");
        setIdeas((prev) =>
          prev.map((idea) =>
            idea.id === activeIdeaId ? { ...idea, call_summary_title: editableTitle } : idea
          )
        );
        setActiveIdea((prev) =>
          prev && prev.id === activeIdeaId ? { ...prev, call_summary_title: editableTitle } : prev
        );
        idleTimer = window.setTimeout(() => {
          setTitleStatus("idle");
          setTitleDirty(false);
        }, 1500);
      }
      titleSaveTimerRef.current = null;
    }, 900);

    return () => {
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
        titleSaveTimerRef.current = null;
      }
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
    };
  }, [editableTitle, activeIdeaId]);

  const titleStatusMessage =
    titleStatus === "saving"
      ? "Saving…"
      : titleStatus === "saved"
      ? "Saved"
      : titleStatus === "error"
      ? "Save failed"
      : "";

  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current !== null) {
        window.clearTimeout(titleSaveTimerRef.current);
      }
    };
  }, []);


  const titleElement =
    activeIdea !== null ? (
      <div className="ideas-overlay__title-input-wrapper">
        <input
          type="text"
          value={editableTitle}
          onChange={(event) => {
            setEditableTitle(event.target.value);
            setTitleDirty(true);
          }}
          className="ideas-overlay__title-input"
          aria-label="Edit summary title"
          placeholder="Give it a summary title"
        />
        {titleStatusMessage ? (
          <span className="ideas-overlay__title-status" aria-live="polite">
            {titleStatusMessage}
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <>
    <div
      className="insights-stage"
      style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
    >
        <Sidebar />
        <div className="insights-stage__content">
          <Topbar
            offsetLeft="var(--sidebar-width)"
            hideProfileAvatar
            hideAdminView
            title="Ideas"
          />
          <main className="ideas-view">
            <header className="ideas-view__header" />
            {loading ? (
              <p>Loading ideas…</p>
            ) : error ? (
              <p className="ideas-view__error">Unable to load ideas: {error}</p>
            ) : ideas.length === 0 ? (
              <p>No development ideas have been captured yet.</p>
            ) : (
              <div className="ideas-table">
                <table>
                  <thead>
                    <tr>
                      <th>Summary title</th>
                      <th>Added</th>
                      <th>Status</th>
                      <th>Interviews</th>
                      <th>Insights</th>
                      <th aria-label="Actions" className="ideas-table__action-header" />
                    </tr>
                  </thead>
                  <tbody>
                    {ideas.map((idea) => {
                      const ideaTitle =
                        idea.call_summary_title ?? getSourceDocumentText(idea.body) ?? "Idea";
                      return (
                        <tr key={idea.id} className="ideas-table__row">
                        <td>{ideaTitle}</td>
                        <td>{formatDate(idea.received_at)}</td>
                        <td>
                          <span className="ideas-table__status">
                            {idea.development_status ?? "Pending"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ideas-table__secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveIdea(idea);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="#22325A"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z"
                              />
                            </svg>
                            Interviews
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ideas-table__secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setInsightsIdea(idea);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              fill="#22325A"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z"
                              />
                            </svg>
                            Insights
                          </button>
                        </td>
                      <td className="ideas-table__action-cell">
                            <button
                              type="button"
                              className="ideas-table__action"
                              aria-label="Delete idea"
                              onClick={(event) => {
                              event.stopPropagation();
                              setDeletionCandidate(idea);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="6" cy="12" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="18" cy="12" r="1.5" />
                            </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>

        {deletionCandidate ? (
          <div className="ideas-delete-overlay" role="presentation">
            <div
              className="ideas-delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ideas-delete-title"
            >
              <h3 id="ideas-delete-title">Confirm deletion</h3>
              <p>
                Are you sure you want to delete{" "}
                <strong>
                  {deletionCandidate.call_summary_title ??
                    getSourceDocumentText(deletionCandidate.body) ??
                    "this idea"}
                </strong>
                ? This cannot be undone.
              </p>
              <p className="ideas-delete-modal__note">This removes the idea for everyone on your team.</p>
              {deleteError ? (
                <p className="ideas-delete-modal__error">{deleteError}</p>
              ) : null}
              <div className="ideas-delete-modal__actions">
                <button
                  type="button"
                  className="ideas-delete-modal__cancel"
                  onClick={handleCancelDelete}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ideas-delete-modal__confirm"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      <SlidingPanelOverlay
        open={Boolean(activeIdea)}
        title={overlayTitle}
        titleElement={titleElement}
        description={overlayDescription}
        width="clamp(320px, calc(100vw - var(--stage-topbar-offset, 0px) - 164px), 100vw)"
        onRequestClose={() => setActiveIdea(null)}
        onAfterClose={() => setActiveIdea(null)}
      >
        {activeIdea ? <IdeasOverlayContent idea={activeIdea} clientId={clientId} /> : null}
      </SlidingPanelOverlay>

      <SlidingPanelOverlay
        open={Boolean(insightsIdea)}
        title={insightsIdea?.call_summary_title ?? "Insights"}
        description={
          insightsIdea
            ? `Added ${formatDate(insightsIdea.received_at)} · Status ${insightsIdea.development_status ?? "Pending"}`
            : undefined
        }
        width="clamp(320px, calc(100vw - var(--stage-topbar-offset, 0px) - 164px), 100vw)"
        onRequestClose={() => setInsightsIdea(null)}
        onAfterClose={() => setInsightsIdea(null)}
      >
        {insightsIdea ? (
          <div className="ideas-insights">
            <section className="ideas-insights__section">
              <h3>Insights snapshot</h3>
              <p className="ideas-insights__note">
                Use the insights panel to review the refined feedback that came out of the most recent simulated
                interviews. You can reference the transcript summary or capture new observations before exporting.
              </p>
              <div className="ideas-insights__summary-card">
                <p>
                  {insightsIdea.transcript_summary ?? "Transcript summary not yet available for this idea."}
                </p>
              </div>
            </section>
            <section className="ideas-insights__section">
              <h3>What to do next</h3>
              <ul className="ideas-insights__list">
                <li>Review patterns across related interviews and add notes for the team.</li>
                <li>Tag highlights that should influence product or research decisions.</li>
                <li>Plan outreach if additional follow-up interviews are needed.</li>
              </ul>
            </section>
          </div>
        ) : null}
      </SlidingPanelOverlay>

      </div>

      <style jsx>{`
        .insights-stage {
          display: flex;
          min-height: 100vh;
        }
        .insights-stage__content {
          margin-left: var(--sidebar-width);
          flex: 1;
          background: #f4f8ff;
          min-height: 100vh;
          padding-top: ${TOPBAR_HEIGHT}px;
        }
        .ideas-view {
          padding: 24px 28px;
        }
        .ideas-view__header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .ideas-view__header p {
          margin-top: 4px;
          color: rgba(15, 23, 42, 0.6);
        }
        .ideas-view__error {
          color: #b91c1c;
        }
        .ideas-table {
          margin-top: 16px;
          background: #fff;
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th,
        td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 14px;
        }
        .ideas-table__status {
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 999px;
          color: #0f172a;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .ideas-table__action-cell {
          text-align: right;
          display: flex;
          justify-content: flex-end;
        }
        th {
          background: #f1f5f9;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(15, 23, 42, 0.7);
        }
        .ideas-table__action-header {
          background: #f1f5f9;
        }
        tr:hover td {
          background: rgba(15, 23, 42, 0.03);
        }
        tbody tr:last-child td {
          border-bottom: none;
        }
        .ideas-table__row {
          cursor: pointer;
        }
        .ideas-table__action {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: rgba(15, 23, 42, 0.6);
          transition: background 0.2s ease, color 0.2s ease;
        }
        .ideas-table__action:hover {
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .ideas-table__secondary {
          border: none;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          background: rgba(59, 130, 246, 0.12);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ideas-table__secondary:hover {
          background: rgba(59, 130, 246, 0.2);
        }
        .ideas-delete-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .ideas-delete-modal {
          background: #fff;
          padding: 28px;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
          max-width: 420px;
          width: min(90vw, 420px);
          text-align: left;
        }
        .ideas-delete-modal h3 {
          margin-top: 0;
          margin-bottom: 8px;
          font-size: 18px;
        }
        .ideas-delete-modal p {
          margin: 0 0 12px;
          color: rgba(15, 23, 42, 0.7);
        }
        .ideas-delete-modal__note {
          font-size: 13px;
          color: rgba(15, 23, 42, 0.65);
        }
        .ideas-delete-modal__error {
          margin-bottom: 12px;
          font-size: 13px;
          color: #b91c1c;
        }
        .ideas-delete-modal__actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
        .ideas-delete-modal__actions button {
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
        }
        .ideas-delete-modal__cancel {
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .ideas-delete-modal__confirm {
          background: #dc2626;
          color: #fff;
        }
        .ideas-overlay__title-input-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px solid rgba(15, 23, 42, 0.15);
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
        }
        .ideas-overlay__title-input {
          width: 100%;
          border: none;
          border-bottom: 1px solid rgba(15, 23, 42, 0.3);
          font-size: 18px;
          font-weight: 700;
          padding: 0;
          background: transparent;
          color: #052033;
          min-width: 0;
        }
        .ideas-overlay__title-input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.8);
        }
        .ideas-overlay__title-status {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
        }
        .ideas-insights {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .ideas-insights__section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ideas-insights__section h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }
        .ideas-insights__note {
          margin: 0;
          color: rgba(15, 23, 42, 0.7);
          font-size: 14px;
        }
        .ideas-insights__summary-card {
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 12px;
          padding: 14px 16px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
          font-size: 14px;
          color: #0f172a;
        }
        .ideas-insights__list {
          margin: 0;
          padding: 0 0 0 20px;
          color: rgba(15, 23, 42, 0.7);
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
    </>
  );
}
