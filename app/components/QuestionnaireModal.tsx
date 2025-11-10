"use client";

import React, { useMemo, useState, useCallback } from "react";
import PillButton from "./PillButton";
import FullscreenModal from "./FullscreenModal";
import QuestionnaireSingleModal from "./QuestionnaireSingleModal";
import { jsPDF } from "jspdf";
import { COOPER_FONT_NAME, ensureCooperFont } from "@/app/lib/pdfFonts";

type QuestionnaireModalProps = {
  expandedCardRef: React.RefObject<HTMLDivElement | null>;
  quantUploadInputRef: React.RefObject<HTMLInputElement | null>;
  quantFileURL: string | null;
  quantFileName: string | null;
  quantFileType: string | null;
  hasQuantFile: boolean;
  isCreatingJob: boolean;
  isHydratingJob?: boolean;
  jobError: string | null;
  jobStatus: string | null;
  jobId: string | null;
  extractionResult?: string | null;
  onUploadClickAction: () => void;
  onUploadChangeAction: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRunAction: () => void;
  personaName?: string | null;
  personaUpdatedAt?: string | null;
  personaResearchType?: string | null;
  personaOwnerName?: string | null;
  resultsPlacement?: "inline" | "external";
};

export default function QuestionnaireModal({
  expandedCardRef,
  quantUploadInputRef,
  quantFileURL,
  quantFileName,
  quantFileType,
  hasQuantFile,
  isCreatingJob,
  isHydratingJob = false,
  jobError,
  jobStatus,
  jobId,
  extractionResult,
  onUploadClickAction,
  onUploadChangeAction,
  onRunAction,
  personaName,
  personaUpdatedAt,
  personaResearchType,
  personaOwnerName,
  resultsPlacement = "inline",
}: QuestionnaireModalProps) {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const isHydrating = Boolean(isHydratingJob);
  const jobInFlight = jobStatus !== null && jobStatus !== "parsed" && jobStatus !== "failed";
  const isProcessing = isCreatingJob || jobInFlight;
  const actionsDisabled = isHydrating || isProcessing;
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

  const handleDownload = useCallback(async () => {
    if (!parsedResults?.questions || parsedResults.questions.length === 0) {
      return;
    }
    setIsDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const cooperLoaded = await ensureCooperFont(doc);
      const textFont = cooperLoaded ? COOPER_FONT_NAME : "helvetica";
      const titleFontSize = cooperLoaded ? 26 : 18;
      const sectionTitleSize = cooperLoaded ? 15 : 13;
      const bodyFontSize = cooperLoaded ? 12 : 11;
      let cursorY = 48;

      const headerTitle = `Questionnaire - ${personaName || quantFileName || "Untitled"}`;
      const maxTitleWidth = doc.internal.pageSize.getWidth() * 0.6;
      const ellipsize = (text: string) => {
        doc.setFont(textFont, "normal");
        doc.setFontSize(titleFontSize);
        if (doc.getTextWidth(text) <= maxTitleWidth) return text;
        let current = text.trim();
        const ellipsis = "…";
        while (current.length > 0 && doc.getTextWidth(`${current}${ellipsis}`) > maxTitleWidth) {
          current = current.slice(0, -1);
        }
        return `${current.trimEnd()}${ellipsis}`;
      };
      const truncatedTitle = ellipsize(headerTitle);

      const drawPageFrame = (isFirstPage: boolean) => {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 60, "F");
        doc.setFont(textFont, "normal");
        doc.setTextColor(246, 247, 249);
        doc.setFontSize(titleFontSize);
        doc.text(truncatedTitle, 40, 40);
        doc.setFontSize(12);
        doc.text("powered by Dialogue", doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });
        doc.setDrawColor(230, 235, 243);
        doc.setFillColor(246, 247, 249);
        doc.roundedRect(30, 70, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 100, 12, 12, "FD");
        doc.setTextColor(5, 32, 51);
        cursorY = 82;
        if (!isFirstPage) {
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          cursorY += 20;
          doc.text("(continued)", 40, cursorY);
        }
      };

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          drawPageFrame(false);
        }
      };

      const QUESTION_CARD_PADDING_X = 18;
      const QUESTION_CARD_PADDING_Y = 14;
      const QUESTION_CARD_WIDTH = doc.internal.pageSize.getWidth() - 96;
      const QUESTION_TEXT_WIDTH = QUESTION_CARD_WIDTH - QUESTION_CARD_PADDING_X * 2;
      const QUESTION_LINE_WIDTH = doc.internal.pageSize.getWidth() - 160;
      const CARD_LABEL_COLOR = { r: 191, g: 219, b: 254 };
      const CARD_VALUE_COLOR = { r: 226, g: 232, b: 240 };
      const DETAIL_TEXT_COLOR = { r: 15, g: 23, b: 42 };

      const addQuestionCard = (
        title: string,
        rows: Array<{ label: string; value: string }>,
        options?: { variant?: "details" },
      ) => {
        const lineHeight = bodyFontSize + 4;
        const isDetails = options?.variant === "details";
        const titleWidth = isDetails ? QUESTION_LINE_WIDTH : QUESTION_TEXT_WIDTH;
        let blockHeight = isDetails ? 0 : QUESTION_CARD_PADDING_Y * 2;

        const titleLines = doc.splitTextToSize(title, titleWidth) as string[];
        blockHeight += titleLines.length * lineHeight;

        rows.forEach((row) => {
          const safeText = `${row.label}: ${row.value}`;
          const lines = doc.splitTextToSize(safeText, titleWidth) as string[];
          blockHeight += (isDetails ? 10 : 12) + lines.length * lineHeight;
        });

        ensureSpace(blockHeight + 36);

        const blockX = 48;
        const blockY = cursorY + 24;

        let textY = isDetails ? blockY : blockY + QUESTION_CARD_PADDING_Y + bodyFontSize;
        const textX = isDetails ? blockX : blockX + QUESTION_CARD_PADDING_X;

        if (!isDetails) {
          doc.setFillColor(19, 32, 62);
          doc.setDrawColor(59, 130, 246);
          doc.roundedRect(blockX, blockY, QUESTION_CARD_WIDTH, blockHeight, 12, 12, "F");
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          doc.setTextColor(CARD_LABEL_COLOR.r, CARD_LABEL_COLOR.g, CARD_LABEL_COLOR.b);
        } else {
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          doc.setTextColor(DETAIL_TEXT_COLOR.r, DETAIL_TEXT_COLOR.g, DETAIL_TEXT_COLOR.b);
        }

        titleLines.forEach((line) => {
          doc.text(line, textX, textY);
          textY += lineHeight;
        });

        doc.setFont(textFont, "normal");
        doc.setFontSize(bodyFontSize);
        rows.forEach((row) => {
          textY += isDetails ? 8 : 12;
          const labelText = `${row.label}:`;
          const labelWidth = doc.getTextWidth(labelText) + 12;
          if (isDetails) {
            doc.setTextColor(DETAIL_TEXT_COLOR.r, DETAIL_TEXT_COLOR.g, DETAIL_TEXT_COLOR.b);
          } else {
            doc.setTextColor(CARD_LABEL_COLOR.r, CARD_LABEL_COLOR.g, CARD_LABEL_COLOR.b);
          }
          doc.text(labelText, textX, textY);

          const availableWidth = titleWidth - labelWidth;
          const valueLines = doc.splitTextToSize(row.value, availableWidth) as string[];
          if (isDetails) {
            doc.setTextColor(DETAIL_TEXT_COLOR.r, DETAIL_TEXT_COLOR.g, DETAIL_TEXT_COLOR.b);
          } else {
            doc.setTextColor(CARD_VALUE_COLOR.r, CARD_VALUE_COLOR.g, CARD_VALUE_COLOR.b);
          }
          if (valueLines.length) {
            doc.text(valueLines[0], textX + labelWidth, textY);
            for (let i = 1; i < valueLines.length; i++) {
              textY += lineHeight;
              doc.text(valueLines[i], textX + labelWidth, textY);
            }
          } else {
            doc.text("—", textX + labelWidth, textY);
          }
          textY += lineHeight;
        });

        cursorY = blockY + blockHeight;
        doc.setTextColor(5, 32, 51);
      };

      drawPageFrame(true);

      const details: string[] = [];
      if (personaName) {
        details.push(`Persona: ${personaName}`);
      }
      if (personaResearchType) {
        details.push(`Research type: ${personaResearchType}`);
      }
      if (personaOwnerName) {
        details.push(`Owner: ${personaOwnerName}`);
      }
      if (personaUpdatedAt) {
        try {
          const formatted = new Date(personaUpdatedAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          details.push(`Date: ${formatted}`);
        } catch {
          details.push(`Date: ${personaUpdatedAt}`);
        }
      }
      if (details.length) {
        const detailRows = details.map((item) => {
          const [label, ...rest] = item.split(": ");
          return {
            label: label ?? "",
            value: rest.join(": ") || "—",
          };
        });
        addQuestionCard("Details", detailRows, { variant: "details" });
      }

      parsedResults.questions.forEach((entry, index) => {
        const questionText = entry.question ? `Q${index + 1}. ${entry.question}` : `Question ${index + 1}`;
        const cardRows: Array<{ label: string; value: string }> = [
          { label: "Response", value: entry.response ?? entry.selectedOption ?? "—" },
        ];
        if (entry.freeText) {
          cardRows.push({ label: "Free text", value: entry.freeText });
        }
        if (entry.confidence !== undefined && entry.confidence !== null) {
          const confidenceValue =
            typeof entry.confidence === "number" ? entry.confidence.toFixed(2) : String(entry.confidence);
          cardRows.push({ label: "Confidence", value: confidenceValue });
        }
        addQuestionCard(questionText, cardRows);
      });

      const filePersona = personaName || quantFileName || "Untitled";
      let fileDate: string | null = null;
      if (personaUpdatedAt) {
        try {
          const date = new Date(personaUpdatedAt);
          if (!Number.isNaN(date.getTime())) {
            fileDate = date.toLocaleDateString("en-CA"); // YYYY-MM-DD
          }
        } catch {
          fileDate = personaUpdatedAt;
        }
      }
      const baseName = `Questionnaire - ${filePersona}${fileDate ? ` - ${fileDate}` : ""}`;
      const safeName = baseName
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      doc.save(`${safeName || "Questionnaire"}.pdf`);
    } catch (error) {
      console.error("[questionnaire] download failed", error);
    } finally {
      setIsDownloading(false);
    }
  }, [parsedResults, personaName, personaResearchType, personaOwnerName, personaUpdatedAt, quantFileName]);

  if (isHydrating && !quantFileURL) {
    return (
      <div ref={expandedCardRef} className="persona-modal-option-body-content persona-modal-option-body-content--quant">
        <div className="persona-quant-loading" style={{ minHeight: 240 }}>
          <span className="persona-quant-spinner" aria-hidden="true" />
          <span>Loading questionnaire…</span>
        </div>
      </div>
    );
  }

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

  const showActionsColumn = resultsPlacement !== "external";
  const gridClassNames = ["persona-quant-grid"];
  if (!showResults) {
    gridClassNames.push("persona-quant-grid--preview-only");
  }
  if (!showActionsColumn) {
    gridClassNames.push("persona-quant-grid--single");
  }

  return (
    <>
      <div ref={expandedCardRef} className="persona-modal-option-body-content persona-modal-option-body-content--quant">
      {quantFileURL ? (
          <div className={gridClassNames.join(" ")}>
              <div className={`persona-quant-preview${!showResults ? " persona-quant-preview--wide" : ""}`}>
                {renderPreview()}
              </div>
              {showActionsColumn ? (
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

            {isHydrating ? (
              <div className="persona-quant-loading">
                <span className="persona-quant-spinner" aria-hidden="true" />
                <span>Loading questionnaire…</span>
              </div>
            ) : isProcessing ? null : showResults && resultsPlacement === "inline" ? (
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
            ) : !showResults ? (
              <div className="persona-quant-actions-row">
                <PillButton
                  type="button"
                  onClick={onUploadClickAction}
                  aria-label="Change document"
                  className="persona-quant-action-square"
                  disabled={actionsDisabled}
                  style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8, minWidth: 0, flex: "1 1 0" }}
                >
                  Change document
                </PillButton>
                <PillButton
                  type="button"
                  onClick={onRunAction}
                  aria-label="Run questionnaire"
                  className="persona-quant-action-square"
                  disabled={actionsDisabled || !hasQuantFile}
                  style={{ padding: "12px 0", fontWeight: 700, height: 56, borderRadius: 8, minWidth: 0, flex: "1 1 0" }}
                >
                  Run questionnaire
                </PillButton>
              </div>
            ) : null}
            {jobError ? (
              <p className="persona-quant-status persona-quant-status--error">{jobError}</p>
            ) : null}
            {showResults ? (
              <div className="persona-quant-options-bar" role="group" aria-label="Questionnaire options">
                <button
                  type="button"
                  className="persona-quant-option-button"
                  onClick={() => setIsFullscreenOpen(true)}
                >
                  View Full Screen
                </button>
                <button
                  type="button"
                  className="persona-quant-option-button"
                  onClick={handleDownload}
                  disabled={isDownloading || !parsedResults?.questions?.length}
                >
                  {isDownloading ? "Downloading…" : "Download"}
                </button>
              </div>
            ) : null}
          </div>
            ) : null}
        </div>
      ) : (
        <div className="persona-quant-actions">
          <PillButton
            type="button"
            onClick={onUploadClickAction}
            disabled={actionsDisabled}
            style={{
              padding: "12px 26px",
              fontSize: 15,
              fontWeight: 700,
              background: "transparent",
              boxShadow: "none",
              border: "none",
              color: "#0f172a",
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
                color: "#0f172a",
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
              <span style={{ color: "#0f172a", fontWeight: 700 }}>Upload research questionnaire</span>
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
      <FullscreenModal
        open={isFullscreenOpen}
        onCloseAction={() => setIsFullscreenOpen(false)}
        fillScreen
      >
        <QuestionnaireSingleModal
          questions={parsedResults?.questions ?? []}
          rawFallback={extractionResult ?? null}
          onClose={() => setIsFullscreenOpen(false)}
          personaName={quantFileName}
        />
      </FullscreenModal>
    </>
  );
}
