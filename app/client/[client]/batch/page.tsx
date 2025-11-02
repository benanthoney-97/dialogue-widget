"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "../../../lib/supabaseClient";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  content_type: string | null;
  audience_type: string | null;
};

type StagePanelProps = {
  heading: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
        </header>
      )}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

type StageButtonVariant = "primary" | "secondary" | "ghost";

type StageButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StageButtonVariant;
  width?: "auto" | "full";
};

function StageButton({ variant = "primary", width = "auto", className = "", ...props }: StageButtonProps) {
  const classes = [
    "stage-button",
    `stage-button--${variant}`,
    width === "full" ? "stage-button--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={`${classes} ${className}`.trim()} {...props} />;
}

export default function BatchPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<Set<string>>(() => new Set());
  const [stage, setStage] = useState<"select" | "upload">("select");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFileURL, setUploadFileURL] = useState<string | null>(null);
  const [uploadFileType, setUploadFileType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    async function fetchPersonas() {
      if (!clientSlug) return;
      setLoading(true);
      setError(null);
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", clientSlug)
          .single();
        if (profileError || !profile) {
          setError("Profile not found");
          setPersonas([]);
          return;
        }
        const { data, error: personaError } = await supabase
          .from("agent_map")
          .select("agent_id, agent_name, audience_type, content_type")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        if (personaError) {
          setError("Unable to load personas");
          setPersonas([]);
          return;
        }
        setPersonas((data ?? []).filter((row): row is PersonaRow => Boolean(row.agent_id)));
      } finally {
        setLoading(false);
      }
    }
    fetchPersonas();
  }, [clientSlug]);

  useEffect(() => {
    return () => {
      if (uploadFileURL) {
        try {
          URL.revokeObjectURL(uploadFileURL);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [uploadFileURL]);

  const handleTogglePersona = (personaId: string) => {
    setSelectedPersonaIds((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) {
        next.delete(personaId);
      } else {
        next.add(personaId);
      }
      return next;
    });
  };

  const selectedCount = selectedPersonaIds.size;
  const selectedPersonas = useMemo(
    () => personas.filter((persona) => selectedPersonaIds.has(persona.agent_id)),
    [personas, selectedPersonaIds]
  );

  const handleContinueToUpload = () => {
    if (selectedCount === 0) return;
    setUploadError(null);
    setStage("upload");
  };

  const handleBackToSelect = () => {
    setStage("select");
  };

  const handlePickUploadFile = () => {
    uploadInputRef.current?.click();
  };

  const clearUploadFile = () => {
    if (uploadFileURL) {
      try {
        URL.revokeObjectURL(uploadFileURL);
      } catch (e) {
        // ignore
      }
    }
    setUploadFileName(null);
    setUploadFileType(null);
    setUploadFileURL(null);
  };

  const handleUploadFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    clearUploadFile();
    const objectUrl = URL.createObjectURL(file);
    setUploadFileName(file.name);
    setUploadFileType(file.type || null);
    setUploadFileURL(objectUrl);
    setUploadError(null);
    event.target.value = "";
  };

  const handleLaunchBatch = () => {
    if (!uploadFileURL || !uploadFileName) {
      setUploadError("Upload a questionnaire before launching the batch run.");
      return;
    }
    setIsLaunching(true);
    try {
      // TODO: replace with actual batch run API integration
      // eslint-disable-next-line no-console
      console.log("Launch batch run", {
        personas: Array.from(selectedPersonaIds),
        file: uploadFileName,
        fileType: uploadFileType,
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <main className="stage-layout batch-root">
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div className="stage-layout__content">
        <div className="stage-shell">
          <StagePanel
            heading="Persona groups"
            subheading={
              stage === "select"
                ? "Group multiple personas and launch a shared questionnaire run."
                : "Upload a questionnaire to run across your selected personas."
            }
            leading={
              <div className="batch-step-indicator">
                <span>Step {stage === "select" ? "1" : "2"} of 2</span>
              </div>
            }
            trailing={
              <div className="batch-panel-actions">
                {stage === "upload" ? (
                  <>
                    <StageButton
                      type="button"
                      variant="ghost"
                      onClick={handleBackToSelect}
                      disabled={isLaunching}
                    >
                      Back
                    </StageButton>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={handleLaunchBatch}
                      disabled={!uploadFileURL || isLaunching}
                    >
                      {isLaunching ? "Launching…" : `Launch batch (${selectedCount})`}
                    </StageButton>
                  </>
                ) : (
                  <StageButton
                    type="button"
                    variant="primary"
                    disabled={selectedCount === 0}
                    onClick={handleContinueToUpload}
                  >
                    {selectedCount === 0 ? "Select personas" : `Continue (${selectedCount})`}
                  </StageButton>
                )}
              </div>
            }
          >
            {stage === "select" ? (
              <section className="batch-section">
                <div className="batch-intro">
                  <h3>Create your first group</h3>
                  <p>Pick the personas you want to include in this batch run. You can refine and save it once you choose the questionnaire file.</p>
                </div>
                <div className="batch-persona-grid" role="list">
                  {loading && (
                    <div className="batch-state" role="status">Loading personas…</div>
                  )}
                  {!loading && error && <div className="batch-state batch-state--error">{error}</div>}
                  {!loading && !error && personas.length === 0 && (
                    <div className="batch-state">No personas available yet. Create a persona first.</div>
                  )}
                  {!loading && !error && personas.length > 0 &&
                    personas.map((persona) => {
                      const isSelected = selectedPersonaIds.has(persona.agent_id);
                      return (
                        <button
                          key={persona.agent_id}
                          type="button"
                          className="batch-persona-card"
                          onClick={() => handleTogglePersona(persona.agent_id)}
                          aria-pressed={isSelected}
                        >
                          <span className="batch-persona-card__select" aria-hidden="true">
                            <span className="batch-persona-card__checkbox" data-selected={isSelected ? "true" : "false"}>
                              {isSelected ? (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <rect width="16" height="16" rx="4" fill="#1d4ed8" />
                                  <path d="M4.5 8.2L7 10.7L11.5 5.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                            </span>
                          </span>
                          <span className="batch-persona-card__content">
                            <strong>{persona.agent_name || "Untitled persona"}</strong>
                            <span>{persona.content_type || "No format set"}</span>
                            <span className="batch-persona-card__audience">Audience: {persona.audience_type || "Not specified"}</span>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </section>
            ) : (
              <section className="batch-upload-stage">
                <div className="batch-selected-panel">
                  <div className="batch-selected-header">
                    <h3>Selected personas</h3>
                    <span className="batch-selected-count">{selectedPersonas.length} selected</span>
                  </div>
                  <div className="batch-selected-grid" role="list">
                    {selectedPersonas.map((persona) => (
                      <div key={persona.agent_id} className="batch-selected-pill" role="listitem">
                        <strong>{persona.agent_name || "Untitled persona"}</strong>
                        <span>{persona.content_type || "No format set"}</span>
                        <span>{persona.audience_type ? `Audience: ${persona.audience_type}` : "Audience not set"}</span>
                      </div>
                    ))}
                  </div>
                  <StageButton type="button" variant="ghost" onClick={handleBackToSelect} className="batch-adjust-selection">
                    Adjust selection
                  </StageButton>
                </div>
                <div className="batch-upload-card">
                  <h3>Upload questionnaire</h3>
                  <p>Upload the questionnaire file to run against this group. Supported formats: PDF, DOCX, XLSX, CSV, TXT.</p>
                  <div className="batch-upload-drop">
                    {uploadFileName ? (
                      <div className="batch-upload-file">
                        <div className="batch-upload-file-meta">
                          <strong>{uploadFileName}</strong>
                          <span>{uploadFileType || "Unknown type"}</span>
                        </div>
                        <div className="batch-upload-file-actions">
                          <StageButton type="button" variant="ghost" onClick={handlePickUploadFile}>
                            Replace file
                          </StageButton>
                          <StageButton type="button" variant="ghost" onClick={clearUploadFile}>
                            Remove
                          </StageButton>
                          {uploadFileURL ? (
                            <a className="batch-upload-preview" href={uploadFileURL} target="_blank" rel="noreferrer">
                              Preview
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="batch-upload-trigger" onClick={handlePickUploadFile}>
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <rect x="5" y="6" width="26" height="24" rx="6" fill="rgba(59,130,246,0.12)" />
                          <path d="M18 12V24" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
                          <path d="M12 18H24" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Choose questionnaire</span>
                      </button>
                    )}
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                      style={{ display: "none" }}
                      onChange={handleUploadFileChange}
                    />
                  </div>
                  {uploadError ? <p className="batch-upload-error">{uploadError}</p> : null}
                </div>
              </section>
            )}
          </StagePanel>
        </div>
      </div>
      <style>{`
        .stage-layout {
          min-height: 100dvh;
          background: var(--bg, #f4f8ff);
          padding: 0;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          display: flex;
          flex-direction: row;
        }
        .stage-layout__sidebar {
          width: 180px;
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 64px 24px 96px;
          min-height: 100dvh;
          overflow-y: auto;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: var(--text);
        }
        .stage-panel {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(30, 41, 59, 0.12);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: #1e293b;
        }
        .stage-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .stage-panel__leading,
        .stage-panel__trailing,
        .stage-panel__spacer {
          flex: 0 0 auto;
          min-width: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .stage-panel__spacer {
          visibility: hidden;
        }
        .stage-panel__titles {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stage-panel__titles h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #1e293b;
        }
        .stage-panel__titles p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
        }
        .stage-panel__body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .stage-panel__footer {
          margin-top: 12px;
        }
        .stage-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
          font-family: inherit;
        }
        .stage-button:disabled,
        .stage-button[aria-disabled="true"] {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .stage-button--primary {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
        }
        .stage-button--primary:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
        }
        .stage-button--secondary {
          background: rgba(30, 41, 59, 0.08);
          color: #1e293b;
        }
        .stage-button--secondary:not(:disabled):hover {
          background: rgba(30, 41, 59, 0.16);
          transform: translateY(-1px);
        }
        .stage-button--ghost {
          background: transparent;
          color: #1e293b;
        }
        .stage-button--ghost:not(:disabled):hover {
          color: #0f172a;
        }
        .stage-button--full {
          width: 100%;
        }
        .batch-panel-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .batch-step-indicator {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(30, 64, 175, 0.1);
          color: rgba(30, 58, 138, 0.9);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.3px;
        }
        .batch-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .batch-intro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 620px;
        }
        .batch-intro h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-intro p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
          line-height: 1.6;
        }
        .batch-persona-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
        }
        .batch-persona-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px;
          border-radius: 16px;
          border: 1px solid rgba(43, 108, 176, 0.18);
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 12px 30px rgba(10, 22, 40, 0.08);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          position: relative;
          color: #1e293b;
        }
        .batch-persona-card:hover,
        .batch-persona-card[aria-pressed="true"] {
          border-color: rgba(43, 108, 176, 0.45);
          box-shadow: 0 18px 44px rgba(10, 22, 40, 0.16);
          transform: translateY(-2px);
        }
        .batch-persona-card:focus-visible {
          outline: 2px solid rgba(43, 108, 176, 0.75);
          outline-offset: 4px;
        }
        .batch-persona-card__select {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
        }
        .batch-persona-card__checkbox {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid rgba(43, 108, 176, 0.35);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.85);
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .batch-persona-card__checkbox[data-selected="true"] {
          border-color: rgba(29, 78, 216, 1);
          background: rgba(29, 78, 216, 0.12);
        }
        .batch-persona-card__content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.82);
        }
        .batch-persona-card__content strong {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-persona-card__audience {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.58);
        }
        .batch-state {
          grid-column: 1 / -1;
          padding: 18px;
          border-radius: 12px;
          border: 1px dashed rgba(43, 108, 176, 0.25);
          background: rgba(241, 245, 249, 0.68);
          color: rgba(15, 23, 42, 0.8);
          text-align: center;
          font-weight: 600;
        }
        .batch-state--error {
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(254, 226, 226, 0.4);
          color: rgba(185, 28, 28, 0.9);
        }
        .batch-upload-stage {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 28px;
          align-items: start;
        }
        .batch-selected-panel {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 24px;
          border-radius: 18px;
          border: 1px solid rgba(43, 108, 176, 0.15);
          background: rgba(248, 250, 252, 0.75);
        }
        .batch-selected-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .batch-selected-header h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }
        .batch-selected-count {
          font-size: 13px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.6);
        }
        .batch-selected-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .batch-selected-pill {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(30, 41, 59, 0.08);
          color: rgba(15, 23, 42, 0.82);
          font-size: 12px;
          box-shadow: inset 0 0 0 1px rgba(30, 41, 59, 0.06);
        }
        .batch-selected-pill strong {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .batch-adjust-selection {
          align-self: flex-start;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
        }
        .batch-upload-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 28px;
          border-radius: 18px;
          border: 1px solid rgba(43, 108, 176, 0.15);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(10, 22, 40, 0.12);
        }
        .batch-upload-card h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .batch-upload-card p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
          line-height: 1.6;
        }
        .batch-upload-drop {
          border: 1.5px dashed rgba(43, 108, 176, 0.3);
          border-radius: 16px;
          background: rgba(59, 130, 246, 0.06);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
          justify-content: center;
        }
        .batch-upload-trigger {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: rgba(255, 255, 255, 0.92);
          color: #1d4ed8;
          padding: 22px 28px;
          border-radius: 14px;
          border: 1px solid rgba(29, 78, 216, 0.26);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .batch-upload-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 36px rgba(29, 78, 216, 0.15);
        }
        .batch-upload-file {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .batch-upload-file-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 14px;
        }
        .batch-upload-file-meta strong {
          font-size: 16px;
          color: #0f172a;
        }
        .batch-upload-file-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .batch-upload-preview {
          font-size: 13px;
          font-weight: 600;
          color: #1d4ed8;
          text-decoration: none;
        }
        .batch-upload-preview:hover {
          text-decoration: underline;
        }
        .batch-upload-error {
          margin: 0;
          color: rgba(185, 28, 28, 0.9);
          font-size: 13px;
          font-weight: 600;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 64px 18px 96px;
          }
          .stage-panel {
            padding: 24px;
          }
          .batch-persona-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          }
          .batch-upload-stage {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 680px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .stage-layout__content {
            padding: 32px 16px 64px;
          }
          .stage-panel__titles h2 {
            font-size: 20px;
          }
        }
      `}</style>
    </main>
  );
}
