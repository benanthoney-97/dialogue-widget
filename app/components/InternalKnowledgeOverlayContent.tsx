"use client";

import React from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";
import { PersonaDocumentRecord } from "@/app/lib/documentTypes";
import DocumentLinkInput from "./DocumentLinkInput";
import DocumentUploadCard from "./DocumentUploadCard";

type InternalKnowledgeOverlayContentProps = {
  personaName: string;
  documents: PersonaDocumentRecord[];
  isLoading: boolean;
  overlayTitleId: string;
  overlayDescriptionId: string;
  onRemoveDocument?: (doc: PersonaDocumentRecord) => Promise<void>;
  showUploadCard: boolean;
  onUploadDocuments?: (files: File[]) => Promise<void>;
  isUploadingDocuments?: boolean;
  onRequestShowUploadCard?: (mode: "upload" | "link") => void;
  onAddDocumentLink?: (links: string[]) => Promise<void>;
  isAddingLink?: boolean;
  activeUploadMode: "upload" | "link";
};

export default function InternalKnowledgeOverlayContent({
  personaName,
  documents,
  isLoading,
  overlayTitleId,
  overlayDescriptionId,
  onRemoveDocument,
  showUploadCard,
  onUploadDocuments,
  isUploadingDocuments = false,
  onRequestShowUploadCard,
  onAddDocumentLink,
  isAddingLink = false,
  activeUploadMode,
}: InternalKnowledgeOverlayContentProps) {
  const [pendingRemove, setPendingRemove] = React.useState<PersonaDocumentRecord | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [cardFiles, setCardFiles] = React.useState<File[]>([]);
  const [linkValue, setLinkValue] = React.useState("");
  const [linkList, setLinkList] = React.useState<string[]>([]);
  const [activeMode, setActiveMode] = React.useState<"upload" | "link">("upload");
  React.useEffect(() => {
    if (!showUploadCard) {
      setCardFiles([]);
      setLinkList([]);
    }
  }, [showUploadCard]);

  const handleUploadClick = async () => {
    if (!onUploadDocuments || cardFiles.length === 0) return;
    console.log("[InternalKnowledgeOverlayContent] handleUploadClick files", cardFiles.map((file) => file.name));
    await onUploadDocuments(cardFiles);
    setCardFiles([]);
  };

  const handleAddLink = () => {
    const trimmed = linkValue.trim();
    if (!trimmed) return;
    setLinkList((prev) => [...prev, trimmed]);
    setLinkValue("");
  };

  const handleSubmitLinks = async () => {
    if (linkList.length === 0) return;
    try {
      await onAddDocumentLink?.(linkList);
      setLinkList([]);
    } catch (error) {
      console.error("[InternalKnowledgeOverlayContent] Failed to submit links", error);
    }
  };

  const handleRemoveLink = (link: string) => {
    setLinkList((prev) => prev.filter((item) => item !== link));
  };

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
      <div className="internal-knowledge-overlay__body">
        {isLoading && <p className="internal-knowledge-overlay__status">Loading documents…</p>}
        {!isLoading && documents.length === 0 && (
          <p className="internal-knowledge-overlay__status">No documents added yet.</p>
        )}
        <div className="internal-knowledge-overlay__upload-area">
          <div className="internal-knowledge-overlay__mode-buttons">
          <button
            type="button"
            className="internal-knowledge-overlay__upload-button"
            aria-pressed={activeMode === "upload"}
            onClick={() => {
              setActiveMode("upload");
              onRequestShowUploadCard?.("upload");
            }}
          >
            Upload document
          </button>
          <button
            type="button"
            className="internal-knowledge-overlay__upload-button"
            aria-pressed={activeMode === "link"}
            onClick={() => {
              setActiveMode("link");
              onRequestShowUploadCard?.("link");
            }}
            >
              Add link
            </button>
          </div>
          {showUploadCard && (
            <div className="internal-knowledge-overlay__upload-card-wrapper">
              {activeUploadMode === "upload" ? (
                <>
                  <DocumentUploadCard
                    files={cardFiles}
                    onFilesAdded={(files) => setCardFiles((prev) => [...prev, ...files])}
                    onFilesRemoved={(index) => setCardFiles((prev) => prev.filter((_, idx) => idx !== index))}
                  />
                  {cardFiles.length > 0 && (
                    <button
                      type="button"
                      className="internal-knowledge-overlay__upload-submit"
                      onClick={handleUploadClick}
                      disabled={isUploadingDocuments}
                    >
                      {isUploadingDocuments ? "Uploading…" : "Upload"}
                    </button>
                  )}
                </>
              ) : (
            <DocumentLinkInput
              value={linkValue}
              onChangeAction={setLinkValue}
              onAdd={handleAddLink}
              canAdd={linkValue.trim().length > 0}
              links={linkList}
              onRemove={handleRemoveLink}
              placeholder="https://"
            />
              )}
              {activeUploadMode === "link" && linkList.length > 0 && (
                <button
                  type="button"
                  className="internal-knowledge-overlay__upload-submit"
                  onClick={handleSubmitLinks}
                  disabled={isAddingLink}
                >
                  {isAddingLink ? "Saving…" : "Add link"}
                </button>
              )}
            </div>
          )}
        </div>
        {!isLoading && documents.length > 0 && (
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
        .internal-knowledge-overlay__header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 12px;
        }
        .internal-knowledge-overlay__header-row button {
          margin-left: 0;
        }
        .internal-knowledge-overlay__header-row span {
          flex: 1;
          text-align: left;
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
        .internal-knowledge-overlay__upload-area {
          background: rgba(59, 130, 246, 0.08);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .internal-knowledge-overlay__mode-buttons {
          display: flex;
          gap: 12px;
        }
        .internal-knowledge-overlay__upload-card-wrapper {
          width: 100%;
        }
        .internal-knowledge-overlay__upload-submit {
          margin-top: 12px;
          align-self: flex-end;
          background: #1e293b;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 10px 24px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .internal-knowledge-overlay__upload-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .internal-knowledge-overlay__upload-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.2);
        }
        .internal-knowledge-overlay__status {
          margin: 0;
          color: rgba(15, 23, 42, 0.65);
        }
        .internal-knowledge-overlay__upload-button {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
          margin-left: 0px;
        }
        .internal-knowledge-overlay__upload-button[aria-pressed="true"] {
          background: #0f172a;
          color: #fff;
        
        }
        .internal-knowledge-overlay__upload-modal {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 400;
        }
        .internal-knowledge-overlay__upload-card {
          background: #f6f7fb;
          border-radius: 18px;
          width: min(540px, 90vw);
          padding: 30px;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .internal-knowledge-overlay__upload-card h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
        .internal-knowledge-overlay__upload-dropzone {
          border: 2px dashed rgba(15, 23, 42, 0.35);
          border-radius: 22px;
          background: #ffffff;
          padding: 32px 24px;
          text-align: center;
        }
        .internal-knowledge-overlay__dropzone-cards {
          display: flex;
          justify-content: center;
          align-items: stretch;
          gap: 10px;
          margin-top: 18px;
          flex-wrap: wrap;
          height: 200px;
        }
        .internal-knowledge-overlay__doc-card {
          border: 1px solid rgba(15, 23, 42, 0.25);
          border-radius: 14px;
          padding: 14px 16px;
          width: 150px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          gap: 6px;
          font-size: 13px;
          color: #0f172a;
        }
        .internal-knowledge-overlay__doc-card.placeholder {
          border-style: dashed;
          justify-content: center;
          text-align: center;
          color: rgba(15, 23, 42, 0.6);
        }
        .internal-knowledge-overlay__doc-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.15);
          display: inline-block;
        }
        .internal-knowledge-overlay__upload-heading {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .internal-knowledge-overlay__upload-placeholder {
          border: 2px dashed rgba(15, 23, 42, 0.2);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          color: rgba(15, 23, 42, 0.65);
          font-size: 14px;
        }
        .internal-knowledge-overlay__upload-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .internal-knowledge-overlay__upload-close {
          border: none;
          background: transparent;
          color: #0f172a;
          font-weight: 600;
          cursor: pointer;
        }
        .internal-knowledge-overlay__list-container {
          background: none;
          border-radius: 12px;
          padding: 0px;
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
