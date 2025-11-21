"use client";

import React from "react";

type DocumentLinkInputProps = {
  value: string;
  onChangeAction: (value: string) => void;
  onAdd: () => void;
  canAdd: boolean;
  links: string[];
  onRemove: (link: string) => void;
  placeholder?: string;
};

export default function DocumentLinkInput({
  value,
  onChangeAction,
  onAdd,
  canAdd,
  links,
  onRemove,
  placeholder = "https://",
}: DocumentLinkInputProps) {
  return (
    <div className="document-link-input">
      <div className="document-link-input__field">
        <input
          type="url"
          placeholder={placeholder}
          value={value}
        onChange={(event) => onChangeAction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <button type="button" onClick={onAdd} disabled={!canAdd}>
          Add link
        </button>
      </div>
      {links.length > 0 && (
        <div className="document-link-input__chips">
          {links.map((link) => (
            <span className="document-link-input__chip" key={link}>
              <span>{link}</span>
              <button type="button" onClick={() => onRemove(link)} aria-label={`Remove ${link}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <style jsx>{`
        .document-link-input {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .document-link-input__field {
          display: flex;
          gap: 10px;
          align-items: stretch;
          font-size: 13px;
        }
        .document-link-input__field input {
          flex: 1;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.35);
          font-size: 13px;
          color: #0f172a;
          background: #fff;
        }
        .document-link-input__field button {
          border: none;
          border-radius: 10px;
          padding: 12px 18px;
          font-weight: 700;
          background: #1e293b;
          color: #f6f7f9;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.2);
        }
        .document-link-input__field button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .document-link-input__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .document-link-input__chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          background: none;
          padding: 6px 14px;
          font-size: 13px;
        }
        .document-link-input__chip button {
          border: none;
          background: transparent;
          cursor: pointer;
          color: rgba(15, 23, 42, 0.6);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
