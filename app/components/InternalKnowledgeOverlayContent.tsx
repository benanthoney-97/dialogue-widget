"use client";

import React from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";

export type PersonaDocumentRecord = {
  id: string;
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
  lastUpdatedLabel: string;
};

export default function InternalKnowledgeOverlayContent({
  personaName,
  documents,
  isLoading,
  overlayTitleId,
  overlayDescriptionId,
  lastUpdatedLabel,
}: InternalKnowledgeOverlayContentProps) {
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

  return (
    <div className="internal-knowledge-overlay" aria-labelledby={overlayTitleId} aria-describedby={overlayDescriptionId}>
      <div className="internal-knowledge-overlay__header">
        <div>
          <span>{personaName}</span>
          <p className="internal-knowledge-overlay__updated">
            Internal data <strong>{lastUpdatedLabel}</strong>
          </p>
        </div>
      </div>
      <div className="internal-knowledge-overlay__body">
        {isLoading ? (
          <p className="internal-knowledge-overlay__status">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="internal-knowledge-overlay__status">No documents added yet.</p>
        ) : (
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <style jsx>{`
        .internal-knowledge-overlay {
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-family: ${BODY_FONT_STACK};
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
        }
        .internal-knowledge-overlay__status {
          margin: 0;
          color: rgba(15, 23, 42, 0.65);
        }
        .internal-knowledge-overlay__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 60vh;
          overflow-y: auto;
        }
        .internal-knowledge-overlay__item {
          padding: 12px 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 10px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 4px;
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
      `}</style>
    </div>
  );
}
