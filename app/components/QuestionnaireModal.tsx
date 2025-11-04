"use client";

import React, { useMemo } from "react";
import PillButton from "./PillButton";

type QuestionnaireModalProps = {
  expandedCardRef: React.RefObject<HTMLDivElement | null>;
  quantUploadInputRef: React.RefObject<HTMLInputElement | null>;
  quantFileURL: string | null;
  quantFileName: string | null;
  quantFileType: string | null;
  hasQuantFile: boolean;
  isCreatingJob: boolean;
  jobError: string | null;
  jobStatus: string | null;
  jobId: string | null;
  extractionResult?: string | null;
  onUploadClickAction: () => void;
  onUploadChangeAction: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunAction: () => void;
};

export default function QuestionnaireModal({
  expandedCardRef,
  quantUploadInputRef,
  quantFileURL,
  quantFileName,
  quantFileType,
  hasQuantFile,
  isCreatingJob,
  jobError,
  jobStatus,
  jobId,
  extractionResult,
  onUploadClickAction,
  onUploadChangeAction,
  onRunAction,
}: QuestionnaireModalProps) {
  const isProcessing =
    isCreatingJob ||
    (jobStatus !== null && jobStatus !== "parsed" && jobStatus !== "failed");
  const showResults = jobStatus === "parsed" && Boolean(extractionResult);

  const parsedResults = useMemo(() => {
    if (!extractionResult) return null;
    try {
      const data = JSON.parse(extractionResult);
      if (typeof data !== "object" || data === null) return null;
      const rawQuestions = Array.isArray((data as { questions?: unknown }).questions)
        ? (data as { questions?: unknown[] }).questions ?? []
        : [];
      const questions = rawQuestions.map((item) => {
        const entry = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
        return {
          id: typeof entry.id === "string" ? entry.id : undefined,
          question: typeof entry.question === "string" ? entry.question : undefined,
          response: typeof entry.response === "string" ? entry.response : undefined,
          selectedOption: typeof entry.selected_option === "string" ? entry.selected_option : undefined,
          freeText: typeof entry.free_text === "string" ? entry.free_text : undefined,
          confidence:
            typeof entry.confidence === "number" || typeof entry.confidence === "string"
              ? entry.confidence
              : undefined,
        };
      });
      const result = { questions };
      return result;
    } catch (error) {
      console.error("[questionnaire] failed to parse extraction result", error);
      return null;
    }
  }, [extractionResult]);

  const renderPreview = () => {
    if (!quantFileURL) {
      return null;
    }

    const looksLikePdf =
      (quantFileType && quantFileType.includes("pdf")) ||
      (quantFileName && quantFileName.toLowerCase().endsWith(".pdf"));

    if (looksLikePdf) {
      return (
        <iframe
          src={`${quantFileURL}#toolbar=0`}
          title={quantFileName ?? "preview"}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
        />
      );
    }

    return (
      <div className="persona-quant-file-card">
        <div className="persona-quant-file-name" title={quantFileName ?? undefined}>
          {quantFileName}
        </div>
        <a
          className="persona-quant-download"
          href={quantFileURL ?? undefined}
          download={quantFileName ?? undefined}
        >
          Download
        </a>
      </div>
    );
  };

  return (
    <div ref={expandedCardRef} className="persona-modal-option-body-content persona-modal-option-body-content--quant">
      {quantFileURL ? (
        <div className="persona-quant-grid">
          <div className="persona-quant-preview">{renderPreview()}</div>
          <div className="persona-quant-actions-col">
            <input
              ref={quantUploadInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
              style={{ display: "none" }}
              onChange={onUploadChangeAction}
            />
            {quantFileName && !quantFileURL ? (
              <div className="persona-quant-file" title={quantFileName ?? undefined}>
                {quantFileName}
              </div>
            ) : null}

            {isProcessing ? (
              <div className="persona-quant-loading">
                <span className="persona-quant-spinner" aria-hidden="true" />
                <span>Processing questionnaire…</span>
              </div>
            ) : showResults ? (
              <div className="persona-quant-results">
                <div className="persona-quant-results-header">
                  <h4>Questionnaire responses</h4>
                  {parsedResults?.questions ? (
                    <span className="persona-quant-results-count">
                      {parsedResults.questions.length}{" "}
                      {parsedResults.questions.length === 1 ? "response" : "responses"}
                    </span>
                  ) : null}
                </div>
                {parsedResults?.questions && parsedResults.questions.length > 0 ? (
                  <div className="persona-quant-results-scroll">
                    <ul className="persona-quant-results-list">
                      {parsedResults.questions.map((entry, index) => (
                        <li key={entry.id ?? `question-${index}`} className="persona-quant-results-item">
                          <span className="persona-quant-results-question">
                            {entry.question ?? "Question"}
                          </span>
                          <div className="persona-quant-results-answer">
                            <span className="persona-quant-results-label">Response:</span>
                            <span>
                              {entry.response ?? entry.selectedOption ?? "—"}
                            </span>
                          </div>
                          {entry.freeText ? (
                            <div className="persona-quant-results-answer">
                              <span className="persona-quant-results-label">Free text:</span>
                              <span>{entry.freeText}</span>
                            </div>
                          ) : null}
                          {entry.confidence !== undefined && entry.confidence !== null ? (
                            <div className="persona-quant-results-answer">
                              <span className="persona-quant-results-label">Confidence:</span>
                              <span>
                                {typeof entry.confidence === "number"
                                  ? entry.confidence.toFixed(2)
                                  : entry.confidence}
                              </span>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : extractionResult ? (
                  <div className="persona-quant-results-scroll">
                    <pre className="persona-quant-results-raw">{extractionResult}</pre>
                  </div>
                ) : (
                  <div className="persona-quant-results-scroll">
                    <div className="persona-quant-results-placeholder">
                      No questionnaire responses captured yet.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 8 }}>
                <PillButton
                  type="button"
                  onClick={onUploadClickAction}
                  aria-label="Change document"
                  className="persona-quant-action-square"
                  style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8 }}
                >
                  Change document
                </PillButton>
                <PillButton
                  type="button"
                  onClick={onRunAction}
                  aria-label="Run questionnaire"
                  className="persona-quant-action-square"
                  disabled={!hasQuantFile}
                  style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8 }}
                >
                  Run questionnaire
                </PillButton>
              </div>
            )}
            {jobError ? (
              <p className="persona-quant-status persona-quant-status--error">{jobError}</p>
            ) : null}
            {showResults ? (
              <div className="persona-quant-options-bar" role="group" aria-label="Questionnaire options">
                <button type="button" className="persona-quant-option-button">
                  View Full Screen
                </button>
                <button type="button" className="persona-quant-option-button">
                  Download
                </button>
                <button type="button" className="persona-quant-option-button">
                  Share
                </button>
              </div>
            ) : jobStatus && !jobError ? (
              <p className="persona-quant-status persona-quant-status--success">
                Questionnaire {jobStatus}
                {jobId ? ` (job ID: ${jobId})` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="persona-quant-actions">
          <PillButton
            type="button"
            onClick={onUploadClickAction}
            style={{
              padding: "12px 26px",
              fontSize: 15,
              fontWeight: 700,
              background: "transparent",
              boxShadow: "none",
              border: "none",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                width: 160,
                height: 160,
                justifyContent: "center",
                boxSizing: "border-box",
                borderRadius: 8,
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <path
                  d="M12 5V19M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Upload quant questionnaire</span>
            </div>
          </PillButton>
          <input
            ref={quantUploadInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
            style={{ display: "none" }}
            onChange={onUploadChangeAction}
          />
        </div>
      )}
    </div>
  );
}
