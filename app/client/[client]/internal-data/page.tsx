"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar from "@/app/components/Topbar";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import PDFJSViewer from "@/app/components/PDFJSViewer";
import { TOPBAR_HEIGHT } from "@/app/components/topbarHeight";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import { supabase } from "../../../lib/supabaseClient";

type AgentDocumentRow = {
  id: string;
  agent_id: string;
  file_name: string;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  source: string | null;
  created_at: string;
  created_by?: string | null;
  added_stage?: string | null;
};

type InternalDocumentRow = AgentDocumentRow & {
  personaName?: string;
};

function buildPublicUrl(path?: string | null): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/docs/${encodedPath}`;
}

function getDocumentUrl(row: InternalDocumentRow | null): string | null {
  if (!row) return null;
  if (row.public_url) return row.public_url;
  if (row.storage_path) return buildPublicUrl(row.storage_path);
  return null;
}

function isPdfUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.pdf($|\?)/i.test(url);
}

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

function formatInternalDate(value?: string) {
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

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes === 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(kb)} KB`;
}

function mergeFileLists(existing: File[], additions: File[]): File[] {
  if (additions.length === 0) return existing;
  const map = new Map<string, File>();
  existing.forEach((file) => map.set(fileKey(file), file));
  additions.forEach((file) => map.set(fileKey(file), file));
  return Array.from(map.values());
}

const ADD_FILES_INPUT_ID = "internal-data-add-files-input";
const ACCEPTED_FILE_LABELS = ["PDF", "DOCX", "TXT", "HTML"];
const ACCEPTED_FILE_EXTENSIONS = ".pdf,.docx,.txt,.html";

export default function InternalDataPage() {
  const [rows, setRows] = useState<InternalDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRow, setActiveRow] = useState<InternalDocumentRow | null>(null);
  const [confirmRow, setConfirmRow] = useState<InternalDocumentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [addModalType, setAddModalType] = useState<"url" | "files" | null>(null);
  const [modalFiles, setModalFiles] = useState<File[]>([]);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [personas, setPersonas] = useState<Array<{ agent_id: string; agent_name: string | null }>>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [personaSelectorOpen, setPersonaSelectorOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<{ agent_id: string; agent_name: string | null } | null>(null);
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);

  useEffect(() => {
    let isActive = true;
    if (!clientSlug) {
      setRows([]);
      setError(null);
      setLoading(false);
      setClientId(null);
      setSelectedPersona(null);
      setPersonas([]);
      return;
    }

      setLoading(true);
      setError(null);

    async function loadInternalDocuments() {
      try {
        const { data: clientRow, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("id", clientSlug)
          .maybeSingle();

        if (clientError || !clientRow) {
          throw new Error("Workspace not found");
        }

        const { data: agentRows, error: agentError } = await supabase
          .from("agent_map")
          .select("agent_id, agent_name")
          .eq("client_id", clientRow.id);

        if (agentError) {
          throw new Error("Failed to load internal data");
        }

        const agentIds = (agentRows ?? [])
          .map((agent) => agent.agent_id)
          .filter((agentId): agentId is string => Boolean(agentId));

        if (agentIds.length === 0) {
          if (!isActive) return;
          setRows([]);
          return;
        }

        const { data: documents, error: documentsError } = await supabase
          .from("agent_documents")
          .select(
            "id, agent_id, file_name, storage_path, public_url, mime_type, file_size, source, created_at, created_by"
          )
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false });

        if (documentsError) {
          throw new Error("Failed to load internal data");
        }

        const agentNameById = (agentRows ?? []).reduce<Record<string, string>>((acc, agent) => {
          if (agent.agent_id) {
            acc[agent.agent_id] = agent.agent_name ?? agent.agent_id;
          }
          return acc;
        }, {});

        const mappedRows =
          ((documents as AgentDocumentRow[]) ?? []).map((doc) => ({
            ...doc,
            personaName: agentNameById[doc.agent_id] ?? doc.agent_id,
          })) ?? [];

        if (!isActive) return;
        setRows(mappedRows);
        setClientId(clientRow.id);
        setError(null);
      } catch (fetchError) {
        if (!isActive) return;
        setRows([]);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load internal data");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadInternalDocuments();

    return () => {
      isActive = false;
    };
  }, [clientSlug]);

  const renderRows = () => {
    if (loading) {
      return (
        <tr className="insights-table__row">
        <td className="insights-table__cell" colSpan={4}>
            Loading internal documents…
          </td>
        </tr>
      );
    }

    return rows.map((row) => (
      <tr
        className="insights-table__row insights-table__row--clickable"
        key={row.id}
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
        <td className="insights-table__cell document-cell">
          <span className="document-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"
                fill="#22325A"
              />
              <path
                d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zM9.5 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
                fill="#22325A"
              />
            </svg>
          </span>
          <span className="document-cell__name">{row.file_name}</span>
        </td>
        <td className="insights-table__cell">{formatInternalDate(row.created_at)}</td>
        <td className="insights-table__cell insights-table__cell--persona">
          {row.personaName ?? row.agent_id}
        </td>
        <td className="insights-table__cell">{row.created_by ?? "—"}</td>
        <td className="insights-table__cell insights-table__cell--actions">
                <button
                  type="button"
                  className="insights-action-button"
                  aria-label={`Delete ${row.file_name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmRow(row);
                  }}
                >
                  <span className="insights-action-button__content">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"
                  fill="#22325A"
                />
                <path
                  d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"
                  fill="#22325A"
                />
              </svg>
            </span>
          </button>
        </td>
    </tr>
    ));
  };

  const addModalFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setModalFiles((prev) => mergeFileLists(prev, newFiles));
  };

  const handleModalFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    addModalFiles(files);
    event.target.value = "";
  };

  const handleModalDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleModalFileDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      addModalFiles(Array.from(event.dataTransfer.files));
      event.dataTransfer.clearData();
    }
  };

  const activeDocumentUrl = getDocumentUrl(activeRow);

  useEffect(() => {
    if (!addModalType) {
      setModalFiles([]);
    }
  }, [addModalType]);

  useEffect(() => {
    setSelectedPersona(null);
  }, [clientSlug]);

  const fetchPersonas = useCallback(async () => {
    if (!clientId) return;
    setPersonasLoading(true);
    setPersonasError(null);
    try {
      const { data, error } = await supabase
        .from("agent_map")
        .select("agent_id, agent_name")
        .eq("client_id", clientId)
        .order("agent_name", { ascending: true });
      if (error) {
        throw error;
      }
      setPersonas((data ?? []) as Array<{ agent_id: string; agent_name: string | null }>);
    } catch (personaError: any) {
      setPersonasError(personaError?.message ?? "Failed to load personas");
    } finally {
      setPersonasLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (personaSelectorOpen && clientId) {
      void fetchPersonas();
    }
  }, [personaSelectorOpen, clientId, fetchPersonas]);

  const modalActionLabel =
    addModalType === "files"
      ? modalFiles.length > 1
        ? "Add files"
        : "Add file"
      : "Continue";

  const renderDocumentPreview = () => {
    if (!activeRow) {
      return <div className="internal-data-panel__empty">Select a row to preview the document.</div>;
    }

    if (!activeDocumentUrl) {
      return <div className="internal-data-panel__empty">Document preview unavailable.</div>;
    }

    if (isPdfUrl(activeDocumentUrl)) {
      return (
        <div className="internal-data-panel__viewer">
          <PDFJSViewer file={activeDocumentUrl} background="transparent" />
        </div>
      );
    }

    return (
      <iframe
        src={activeDocumentUrl}
        title={activeRow.file_name}
        className="internal-data-panel__iframe"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    );
  };

  return (
    <div className="internal-data-page">
      <Topbar
        title="Internal data"
        offsetLeft="var(--stage-topbar-offset, 0px)"
        hideProfileAvatar
        hideCadenceControls
        rightSlot={
          clientSlug ? (
            <div className="internal-data-topbar-menu-wrapper">
              <button
                type="button"
                className="internal-data-topbar-button"
                onClick={() => {
                  setPersonaSelectorOpen(true);
                  setAddModalType(null);
                }}
              >
                <span className="stage-button__icon" aria-hidden="true">
                  +
                </span>
                Add knowledge
              </button>
              {selectedPersona ? (
                <span className="internal-data-topbar-persona-hint">
                  Adding to {selectedPersona.agent_name ?? selectedPersona.agent_id}
                </span>
              ) : null}
            </div>
          ) : null
        }
      />
      <main className="internal-data-page__layout">
        <aside className="internal-data-page__sidebar">
          <Sidebar />
        </aside>
        <section className="internal-data-page__body">
          <div className="insights-table-wrap">
            <table className="insights-table">
              <thead>
                <tr className="insights-table__head-row">
                  <th className="insights-table__head-cell document-column">Name</th>
                  <th className="insights-table__head-cell">Created</th>
                  <th className="insights-table__head-cell insights-table__head-cell--persona">
                    Persona
                  </th>
                  <th className="insights-table__head-cell">Created by</th>
                  <th className="insights-table__head-cell" aria-hidden="true" />
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>
          {error ? (
            <div className="insights-empty" role="alert">
              {error}
            </div>
          ) : !loading && rows.length === 0 ? (
            <div className="insights-empty">No internal documents found for this workspace.</div>
          ) : null}
        </section>
      </main>
      <SlidingPanelOverlay
        open={Boolean(activeRow)}
        onRequestClose={() => setActiveRow(null)}
        onAfterClose={() => setActiveRow(null)}
        title={activeRow ? activeRow.file_name ?? activeRow.personaName : ""}
        titleId="internal-data-overlay-title"
        descriptionId="internal-data-overlay-description"
        bodyClassName="internal-data-panel"
      >
        <div id="internal-data-overlay-description" />
        <div className="internal-data-panel__meta">
          {activeRow && (
            <div className="internal-data-panel__created">
              <span>Created</span>
              <span>{formatInternalDate(activeRow.created_at)}</span>
            </div>
          )}
        </div>
        <div className="internal-data-panel__document">{renderDocumentPreview()}</div>
      </SlidingPanelOverlay>
      {confirmRow && (
        <div className="internal-data-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="internal-data-confirm__dialog">
            <p id="confirm-title">
              Delete <strong>{confirmRow.file_name}</strong>?
            </p>
            <div className="internal-data-confirm__actions">
              <button
                type="button"
                className="insights-action-button insights-action-button--ghost"
                onClick={() => setConfirmRow(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="insights-action-button insights-action-button--secondary"
                onClick={async () => {
                  if (!confirmRow) return;
                  setIsDeleting(true);
                  setDeleteError(null);
                  try {
                    const { error: deleteErr } = await supabase
                      .from("agent_documents")
                      .delete()
                      .eq("id", confirmRow.id);
                    if (deleteErr) throw deleteErr;
                    setRows((prev) => prev.filter((item) => item.id !== confirmRow.id));
                    setConfirmRow(null);
                    if (activeRow?.id === confirmRow.id) {
                      setActiveRow(null);
                    }
                  } catch (deleteErr: any) {
                    setDeleteError(deleteErr?.message ?? "Failed to delete document");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
            </div>
            {deleteError ? <p className="internal-data-confirm__error">{deleteError}</p> : null}
          </div>
        </div>
      )}
      {personaSelectorOpen && (
        <div className="internal-data-persona-modal">
          <div className="internal-data-persona-modal__dialog">
            <div className="internal-data-persona-modal__header">
              <h3>Select a persona</h3>
              <button
                type="button"
                className="internal-data-persona-modal__close"
                onClick={() => setPersonaSelectorOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {personasLoading ? (
              <p className="internal-data-persona-modal__status">Loading personas…</p>
            ) : personasError ? (
              <p className="internal-data-persona-modal__status">{personasError}</p>
            ) : personas.length === 0 ? (
              <p className="internal-data-persona-modal__status">No personas found.</p>
            ) : (
              <ul className="internal-data-persona-modal__list">
                {personas.map((persona) => (
                  <li key={persona.agent_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPersona(persona);
                        setPersonaSelectorOpen(false);
                        setAddModalType(null);
                        setModalFiles([]);
                      }}
                    >
                      {persona.agent_name || persona.agent_id}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {addModalType && (
        <div className="internal-data-add-modal">
          <div className="internal-data-add-modal__dialog">
            <h3>{addModalType === "url" ? "Add URL" : "Add Files"}</h3>
            {addModalType === "files" ? (
              <label
                htmlFor={ADD_FILES_INPUT_ID}
                className="internal-data-add-modal__dropzone"
                onDragOver={handleModalDragOver}
                onDrop={handleModalFileDrop}
              >
                <input
                  id={ADD_FILES_INPUT_ID}
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_EXTENSIONS}
                  onChange={handleModalFileInputChange}
                  style={{ display: "none" }}
                />
                {modalFiles.length === 0 ? (
                  <>
                    <div className="internal-data-add-modal__heading">
                      Drag &amp; drop files here
                    </div>
                    <div className="internal-data-add-modal__subheading">
                      or{" "}
                      <span className="internal-data-add-modal__link">
                        click to select from computer
                      </span>
                    </div>
                    <div className="internal-data-add-modal__types">
                      {ACCEPTED_FILE_LABELS.map((type) => (
                        <span key={type} className="internal-data-add-modal__chip">
                          {type}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <ul className="internal-data-add-modal__file-list">
                      {modalFiles.map((file) => (
                        <li key={fileKey(file)} className="internal-data-add-modal__file-item">
                          <span
                            className="internal-data-add-modal__file-name"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                          <span className="internal-data-add-modal__file-size">
                            {formatFileSize(file.size)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="internal-data-add-modal__more">
                      Click to add more documents
                    </div>
                  </>
                )}
              </label>
            ) : (
              <p>We can wire the form in here when ready.</p>
            )}
            <div className="internal-data-add-modal__actions">
              <button
                type="button"
                className="insights-action-button insights-action-button--secondary"
                onClick={() => setAddModalType(null)}
              >
                {modalActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .internal-data-page {
          --stage-topbar-offset: var(--sidebar-width);
          min-height: 100dvh;
          background: #ffffff;
          font-family: ${BODY_FONT_STACK};
        }
        .internal-data-page__layout {
          display: flex;
          padding: calc(${TOPBAR_HEIGHT}px + 24px) 32px 48px;
          min-height: calc(100dvh - ${TOPBAR_HEIGHT}px - 48px);
          gap: 32px;
        }
        .internal-data-page__sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
        }
        .internal-data-page__body {
          flex: 1;
          border-radius: 24px;
          background: #ffffff;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .insights-table-wrap {
          flex: 1;
          min-height: 0;
          width: 100%;
          border-radius: 0;
          overflow: hidden;
          overflow-x: auto;
          overflow-y: auto;
        }
        .insights-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
          font-size: 15px;
          background: transparent;
          font-family: ${BODY_FONT_STACK};
        }
        .insights-table__head-cell {
          text-align: left;
          padding: 10px 8px;
          color: rgba(15, 23, 42, 0.65);
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid rgba(15, 23, 42, 0.12);
          position: sticky;
          top: 0;
          z-index: 1;
          background: none;
        }
        .insights-table__head-cell--persona {
          min-width: 150px;
          max-width: 220px;
        }
        .insights-table__row {
          background: none;
          transition: background 0.2s ease;
        }
        .insights-table__row--clickable {
          cursor: pointer;
        }
        .insights-table__row--clickable:focus-visible {
          outline: 3px solid rgba(59, 130, 246, 0.45);
          outline-offset: -1px;
        }

        .document-column {
          width: 380px;
          max-width: 380px;
        }
        .insights-table__cell {
          padding: 10px 8px;
          color: var(--text, #052033);
          background: var(--panel-2, #F6F7F9fff);
          font-size: 15px;
          vertical-align: middle;
        }
        .insights-table__cell--actions {
          text-align: center;
        }
        .insights-table__cell--actions .insights-action-button {
          cursor: pointer;
        }
        .insights-table__cell--persona {
          min-width: 150px;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .document-cell {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .document-cell__name {
          display: inline-block;
          max-width: 360px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .document-icon {
          width: 16px;
          height: 16px;
          display: inline-flex;
        }
        .internal-data-topbar-menu-wrapper {
          position: relative;
          display: inline-flex;
        }
        .internal-data-topbar-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          background: #fff;
          border-radius: 12px;
          padding: 8px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 140px;
          z-index: 50;
        }
        .internal-data-topbar-dropdown button {
          border: none;
          background: transparent;
          text-align: left;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #0f172a;
          cursor: pointer;
        }
        .internal-data-topbar-dropdown button:hover,
        .internal-data-topbar-dropdown button:focus-visible {
          background: rgba(248, 250, 252, 0.9);
          outline: none;
        }
        .internal-data-topbar-persona-hint {
          margin-top: 6px;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
        }
        .internal-data-topbar-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 12px;
          border: none;
          background: #061430;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          font-family: ${HEADING_FONT_STACK};
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
          cursor: pointer;
        }
        .internal-data-topbar-button:hover,
        .internal-data-topbar-button:focus-visible {
          background: #0e1f41;
          box-shadow: 0 14px 28px rgba(6, 20, 48, 0.35);
          transform: translateY(-1px);
          outline: none;
        }
        .internal-data-persona-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 700;
        }
        .internal-data-persona-modal__dialog {
          width: min(520px, 100%);
          background: #fff;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.35);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .internal-data-persona-modal__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .internal-data-persona-modal__close {
          border: none;
          background: transparent;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }
        .internal-data-persona-modal__status {
          margin: 0;
          color: rgba(15, 23, 42, 0.65);
          font-size: 14px;
        }
        .internal-data-persona-modal__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .internal-data-persona-modal__list button {
          width: 100%;
          text-align: left;
          border: 1px solid rgba(15, 23, 42, 0.15);
          border-radius: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .internal-data-persona-modal__list button:hover,
        .internal-data-persona-modal__list button:focus-visible {
          background: #eef2ff;
          border-color: rgba(79, 92, 229, 0.7);
        }
        .insights-empty {
          padding: 32px 16px;
          text-align: center;
          color: rgba(15, 23, 42, 0.55);
          font-size: 15px;
          font-weight: 600;
        }
        .internal-data-panel__document {
          flex: 1;
          min-height: 320px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .internal-data-panel__viewer {
          flex: 1;
          min-height: 320px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.25);
          border-radius: 12px;
        }
        .internal-data-panel__iframe {
          flex: 1;
          min-height: 320px;
          border: none;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.25);
          border-radius: 12px;
        }
        .internal-data-panel__empty {
          padding: 24px;
          border: 1px dashed rgba(15, 23, 42, 0.2);
          border-radius: 12px;
          color: rgba(15, 23, 42, 0.62);
          font-size: 14px;
          background: #f7fafc;
          text-align: center;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .internal-data-panel__meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.68);
        }
        .internal-data-panel__created {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.68);
        }
        .internal-data-confirm {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 500;
          padding: 16px;
        }
        .internal-data-confirm__dialog {
          background: #fff;
          border-radius: 32px;
          padding: 32px;
          max-width: 460px;
          width: 100%;
          box-shadow: 0 28px 60px rgba(15, 23, 42, 0.35);
        }
        .internal-data-confirm__actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }
        .internal-data-confirm__actions .insights-action-button {
          border: 1px solid rgba(15, 23, 42, 0.2);
          border-radius: 12px;
          background: #fff;
          box-shadow: none;
          padding: 12px 24px;
          cursor: pointer;
        }
        .internal-data-confirm__actions .insights-action-button--secondary {
          background: #0f172a;
          color: #fff;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.22);
        }
        .internal-data-confirm__error {
          margin-top: 12px;
          font-size: 13px;
          color: #b91c1c;
        }
        .internal-data-add-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 600;
        }
        .internal-data-add-modal__dialog {
          width: min(520px, 100%);
          background: #fff;
          border-radius: 28px;
          padding: 32px;
          box-shadow: 0 32px 70px rgba(15, 23, 42, 0.35);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .internal-data-add-modal__actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
        }
        .internal-data-add-modal__dropzone {
          width: 100%;
          min-height: 200px;
          border-radius: 18px;
          border: 2px dashed #2d406b;
          background: #0d1a40;
          padding: 28px 20px;
          color: #f5f6fb;
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
          justify-content: center;
          text-align: center;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }
        .internal-data-add-modal__dropzone:hover,
        .internal-data-add-modal__dropzone:focus-visible {
          border-color: #4f5ce5;
          box-shadow: 0 0 0 6px rgba(79, 92, 229, 0.25);
        }
        .internal-data-add-modal__heading {
          font-size: 18px;
          font-weight: 600;
          color: #f8fafc;
        }
        .internal-data-add-modal__subheading {
          font-size: 14px;
          color: rgba(248, 250, 252, 0.85);
        }
        .internal-data-add-modal__link {
          color: #a5b5ff;
          text-decoration: underline;
        }
        .internal-data-add-modal__types {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }
        .internal-data-add-modal__chip {
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(148, 163, 184, 0.16);
          color: #e2e8f0;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .internal-data-add-modal__file-list {
          list-style: none;
          margin: 0;
          padding: 0;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .internal-data-add-modal__file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(148, 163, 184, 0.25);
          font-size: 14px;
          gap: 12px;
        }
        .internal-data-add-modal__file-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
          text-align: left;
        }
        .internal-data-add-modal__file-size {
          font-size: 13px;
          color: #a5b5ff;
          flex-shrink: 0;
        }
        .internal-data-add-modal__more {
          font-size: 13px;
          color: rgba(248, 250, 252, 0.85);
        }
        .internal-data-add-modal__actions .insights-action-button--secondary {
          background: #0f172a;
          color: #fff;
          border-color: transparent;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
          padding: 12px 28px;
          border-radius: 12px;
        }
        @media (max-width: 960px) {
          .internal-data-page__layout {
            padding: calc(${TOPBAR_HEIGHT}px + 20px) 18px 56px;
          }
          .internal-data-page__sidebar {
            width: 100%;
          }
        }
        @media (max-width: 680px) {
          .internal-data-page__layout {
            flex-direction: column;
            padding: calc(${TOPBAR_HEIGHT}px + 16px) 16px 48px;
          }
          .internal-data-page__sidebar {
            position: sticky;
            top: ${TOPBAR_HEIGHT}px;
            z-index: 20;
          }
        }
      `}</style>
    </div>
  );
}
