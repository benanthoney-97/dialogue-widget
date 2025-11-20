"use client";

import React from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";

export type PersonaDocumentRecord = {
  id: string;
  agent_id?: string | null;
  file_name: string | null;
  document_url?: string | null;
  public_url?: string | null;
  created_at?: string | null;
  file_size?: number | null;
};

type InternalKnowledgeOverlayContentProps = {
  personaName: string;
  documents: PersonaDocumentRecord[];
  isLoading: boolean;
  overlayTitleId: string;
  overlayDescriptionId: string;
  onRemoveDocument?: (doc: PersonaDocumentRecord) => Promise<void>;
};

export default function InternalKnowledgeOverlayContent({
  personaName,
  documents,
  isLoading,
  overlayTitleId,
  overlayDescriptionId,
  onRemoveDocument,
}: InternalKnowledgeOverlayContentProps) {
  const [pendingRemove, setPendingRemove] = React.useState<PersonaDocumentRecord | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    if (onRemoveDocument) {
      setIsRemoving(true);
      await onRemoveDocument(pendingRemove);
      setIsRemoving(false);
    }
    setPendingRemove(null);
  };

  return (
    <div className="internal-knowledge-overlay" aria-labelledby={overlayTitleId} aria-describedby={overlayDescriptionId}>
      <div className="internal-knowledge-overlay__header">
      </div>
      <div className="internal-knowledge-overlay__body">
        {isLoading ? (
          <p className="internal-knowledge-overlay__status">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="internal-knowledge-overlay__status">No documents added yet.</p>
        ) : (
          <div className="internal-knowledge-overlay__list-container">
            <ul className="internal-knowledge-overlay__list">
              {documents.map((doc) => {
                const title =
                  doc.file_name && doc.file_name.trim().length > 0
                    ? doc.file_name.trim()
                    : "Untitled document";
                const meta: string[] = [];
                if (doc.file_size) {
                  const sizeInKb = doc.file_size / 1024;
                  meta.push(sizeInKb >= 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${Math.max(sizeInKb, 1).toFixed(0)} KB`);
                }
                if (doc.created_at) {
                  meta.push(`Added ${formatDate(doc.created_at)}`);
                }
                const url = doc.public_url ?? doc.document_url ?? null;
                return (
                  <li key={doc.id}>
                    <div className="internal-knowledge-overlay__item">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="internal-knowledge-overlay__link">
                          {title}
                        </a>
                      ) : (
                        <span className="internal-knowledge-overlay__link">{title}</span>
                      )}
                      {meta.length > 0 ? <span className="internal-knowledge-overlay__meta">{meta.join(" · ")}</span> : null}
                      <button
                        type="button"
                        className="internal-knowledge-overlay__remove"
                        onClick={() => setPendingRemove(doc)}
                        disabled={isRemoving}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      <style jsx>{`
        .internal-knowledge-overlay {
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-family: ${BODY_FONT_STACK};
          height: 100%;
          min-height: 0;
        }
        .internal-knowledge-overlay__header span {
          font-size: 16px;
          font-weight: 600;
        }
        .internal-knowledge-overlay__updated {
          margin: 4px 0 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.68);
        }
        .internal-knowledge-overlay__body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
          flex: 1;
        }
        .internal-knowledge-overlay__status {
          margin: 0;
          color: rgba(15, 23, 42, 0.65);
        }
        .internal-knowledge-overlay__list-container {
          background: none;
          border-radius: 12px;
          padding: 12px;
          flex: 1;
          min-height: 0;
        }
        .internal-knowledge-overlay__list {
          margin: 0;
          padding-top: 10px;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: 100%;
          min-height: 0;
          overflow-y: auto;
        }
        .internal-knowledge-overlay__item {
          padding: 12px 14px;
          border: 1px solid rgba(59, 130, 246, 0.28);
          border-radius: 10px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
          position: relative;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
        }
        .internal-knowledge-overlay__item:hover,
        .internal-knowledge-overlay__item:focus-within {
          border-color: rgba(59, 130, 246, 0.35);
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
          transform: translateY(-1px);
        }
        .internal-knowledge-overlay__link {
          font-weight: 600;
          color: #0f172a;
          text-decoration: none;
        }
        .internal-knowledge-overlay__link:hover {
          text-decoration: underline;
        }
        .internal-knowledge-overlay__meta {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.55);
        }
        .internal-knowledge-overlay__remove {
          position: absolute;
          bottom: 10px;
          right: 10px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid rgba(239, 68, 68, 0.6);
          background: rgba(239, 68, 68, 0.08);
          color: #b91c1c;
          cursor: pointer;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .internal-knowledge-overlay__item:hover .internal-knowledge-overlay__remove,
        .internal-knowledge-overlay__item:focus-within .internal-knowledge-overlay__remove {
          opacity: 1;
          transform: translateY(0);
        }
        .internal-knowledge-overlay__remove:hover,
        .internal-knowledge-overlay__remove:focus-visible {
          border-color: rgba(239, 68, 68, 0.8);
          background: rgba(239, 68, 68, 0.12);
          outline: none;
        }
        .internal-knowledge-overlay__modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .internal-knowledge-overlay__modal {
          background: #fff;
          border-radius: 12px;
          padding: 20px;
          width: min(420px, 90vw);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-family: ${BODY_FONT_STACK};
        }
        .internal-knowledge-overlay__modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .internal-knowledge-overlay__modal button {
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          border: 1px solid rgba(15, 23, 42, 0.2);
          background: #eef2f7;
          cursor: pointer;
        }
        .internal-knowledge-overlay__modal button:focus-visible {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
        }
        .internal-knowledge-overlay__modal button.internal-knowledge-overlay__confirm {
          background: #b91c1c;
          border-color: #991b1b;
          color: #fff;
        }
        .internal-knowledge-overlay__modal button.internal-knowledge-overlay__cancel {
          background: #fff;
          color: #0f172a;
        }
      `}</style>
      {pendingRemove ? (
        <div className="internal-knowledge-overlay__modal-backdrop" role="dialog" aria-modal="true">
          <div className="internal-knowledge-overlay__modal">
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Remove document?</p>
            <p style={{ margin: 0, color: "rgba(15,23,42,0.75)" }}>
              This will remove “{pendingRemove.file_name || "Untitled document"}” from the list.
            </p>
            <div className="internal-knowledge-overlay__modal-actions">
              <button
                type="button"
                className="internal-knowledge-overlay__cancel"
                onClick={() => setPendingRemove(null)}
                disabled={isRemoving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="internal-knowledge-overlay__confirm"
                onClick={confirmRemove}
                disabled={isRemoving}
              >
                {isRemoving ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
