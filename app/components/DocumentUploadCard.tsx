"use client";

import React from "react";

type DocumentUploadCardProps = {
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onFilesRemoved: (index: number) => void;
};

export default function DocumentUploadCard({ files, onFilesAdded, onFilesRemoved }: DocumentUploadCardProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesAdded(droppedFiles);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length > 0) {
      onFilesAdded(selectedFiles);
    }
  };

  return (
    <label
      htmlFor="document-upload-card"
      className="document-upload-card"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        id="document-upload-card"
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.html"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {files.length === 0 ? (
        <>
          <div className="document-upload-card__heading">Drag & drop files here</div>
          <div className="document-upload-card__subheading">or <span>click to select from computer</span></div>
          <div className="document-upload-card__types">
            {["PDF", "TXT", "DOCX", "HTML"].map((type) => (
              <span key={type} className="document-upload-card__chip">
                {type}
              </span>
            ))}
          </div>
        </>
      ) : (
        <ul className="document-upload-card__list">
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="document-upload-card__item">
              <div className="document-upload-card__item-content">
                <p>{file.name}</p>
                <small>{file.type || "application/octet-stream"}</small>
              </div>
              <button
                type="button"
                className="document-upload-card__remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onFilesRemoved(idx);
                }}
              >
                ✕
              </button>
            </li>
          ))}
          <li className="document-upload-card__placeholder">
            <p>Click to add more documents</p>
          </li>
        </ul>
      )}
      <style jsx>{`
        .document-upload-card {
          border-radius: 14px;
          border: 1px dashed #0f172a;
          background: #ffffff;
          padding: 28px 24px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .document-upload-card__heading {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
        .document-upload-card__subheading {
          font-size: 16px;
          color: rgba(15, 23, 42, 0.75);
        }
        .document-upload-card__subheading span {
          font-weight: 600;
          color: #0f172a;
          text-decoration: underline;
        }
        .document-upload-card__types {
          display: flex;
          justify-content: center;
          gap: 12px;
        }
        .document-upload-card__chip {
          padding: 6px 14px;
          border-radius: 999px;
          background: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
        }
        .document-upload-card__list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          gap: 12px;
          overflow-x: auto;
        }
        .document-upload-card__item {
          border-radius: 10px;
          border: 1px solid rgba(30, 41, 59, 0.35);
          padding: 18px;
          width: 130px;
          min-height: 186px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          color: #0f172a;
          font-size: 13px;
          position: relative;
        }
        .document-upload-card__item-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
        .document-upload-card__item-content p,
        .document-upload-card__item-content small {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
          display: block;
          width: 100%;
        }
        .document-upload-card__item p {
          font-weight: 600;
        }
        .document-upload-card__item small {
          color: rgba(15, 23, 42, 0.6);
          margin-top: 2px;
        }
        .document-upload-card__remove {
          position: absolute;
          top: 6px;
          right: 6px;
          border: none;
          background: rgba(0, 0, 0, 0.05);
          color: rgba(15, 23, 42, 0.8);
          font-size: 16px;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .document-upload-card__placeholder {
          margin: 0;
          padding: 24px;
          border-radius: 10px;
          border: 1px dashed rgba(30, 41, 59, 0.35);
          height: 186px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 600;
        }
      `}</style>
    </label>
  );
}
