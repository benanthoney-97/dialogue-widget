"use client";

import React, { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import PillButton from "./PillButton";
import FullscreenModal from "./FullscreenModal";
import QuestionnaireSingleModal from "./QuestionnaireSingleModal";
import { jsPDF } from "jspdf";
import { COOPER_FONT_NAME, ensureCooperFont } from "@/app/lib/pdfFonts";
import styles from "./QuestionnaireUploadCard.module.css";

type QuestionnaireUploadCardProps = {
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

export default function QuestionnaireUploadCard({
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
}: QuestionnaireUploadCardProps) {
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const handlePreview = useCallback(() => {
    if (!quantFileURL) return;
    try {
      window.open(quantFileURL, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("[questionnaire] preview failed", error);
    }
  }, [quantFileURL]);

  const isHydrating = Boolean(isHydratingJob);
  const jobInFlight = jobStatus !== null && jobStatus !== "parsed" && jobStatus !== "failed";
  const isProcessing = isCreatingJob || jobInFlight;
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
      return { questions };
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
            for (let i = 1; i < valueLines.length; i += 1) {
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
            fileDate = date.toLocaleDateString("en-CA");
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
  }, [parsedResults, personaName, personaOwnerName, personaResearchType, personaUpdatedAt, quantFileName]);

  const fileSummary = (
    <div className={styles.file}>
      <div className={styles.fileHeader}>
        <span className={styles.fileTitle}>Uploaded Questionnaire</span>
        {jobStatus ? (
          <span
            className={clsx(styles.status, {
              [styles.statusParsed]: jobStatus === "parsed",
              [styles.statusFailed]: jobStatus === "failed",
            })}
          >
            {jobStatus}
          </span>
        ) : null}
      </div>
      {isHydrating ? (
        <div className={styles.fileLoading}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>Loading questionnaire…</span>
        </div>
      ) : quantFileName ? (
        <div className={styles.fileBody}>
          <div className={styles.fileName} title={quantFileName}>
            {quantFileName}
          </div>
        </div>
      ) : (
        <div className={styles.fileEmpty}>No document uploaded yet.</div>
      )}
      {quantFileType ? (
        <div className={styles.fileChip}>{quantFileType}</div>
      ) : null}
      {jobId ? <div className={styles.fileMeta}>Job ID: {jobId}</div> : null}
    </div>
  );

  return (
    <>
      <div ref={expandedCardRef} className={styles.card}>
        {fileSummary}
        <div className={styles.actions}>
          <input
            ref={quantUploadInputRef}
            type="file"
            accept=".pdf,.csv"
            style={{ display: "none" }}
            onChange={onUploadChangeAction}
          />
          <div className={styles.ctaRow}>
            <PillButton
              type="button"
              onClick={onUploadClickAction}
              disabled={isProcessing}
              unstyled
              className={styles.ctaButton}
            >
              {quantFileName ? "Change document" : "Upload questionnaire"}
            </PillButton>
            <PillButton
              type="button"
              onClick={handlePreview}
              disabled={!quantFileURL}
              unstyled
              className={styles.ctaButton}
            >
              Preview
            </PillButton>
            <PillButton
              type="button"
              onClick={onRunAction}
              disabled={isProcessing || !hasQuantFile}
              unstyled
              className={clsx(styles.ctaButton, styles.ctaPrimary)}
            >
              {isProcessing ? "Processing…" : "Run questionnaire"}
            </PillButton>
          </div>
          {jobError ? <p className={styles.error}>{jobError}</p> : null}
        </div>
        {showResults && resultsPlacement === "inline" ? (
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <h4 className={styles.resultsTitle}>Questionnaire Responses</h4>
              <span className={styles.resultsCount}>
                {parsedResults?.questions?.length ?? 0} {parsedResults && parsedResults.questions.length === 1 ? "response" : "responses"}
              </span>
            </div>
            {parsedResults?.questions?.length ? (
              <ul className={styles.resultsList}>
                {parsedResults.questions.map((entry, index) => (
                  <li key={entry.id ?? `question-${index}`} className={styles.resultsListItem}>
                    <p className={styles.question}>{entry.question ?? `Question ${index + 1}`}</p>
                    <div className={styles.answer}>
                      <span className={styles.answerLabel}>Response:</span>
                      <span>{entry.response ?? entry.selectedOption ?? "—"}</span>
                    </div>
                    {entry.freeText ? (
                      <div className={styles.answer}>
                        <span className={styles.answerLabel}>Free text:</span>
                        <span>{entry.freeText}</span>
                      </div>
                    ) : null}
                    {entry.confidence !== undefined && entry.confidence !== null ? (
                      <div className={styles.answer}>
                        <span className={styles.answerLabel}>Confidence:</span>
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
            ) : (
              <pre className={styles.resultsRaw}>{extractionResult}</pre>
            )}
            <div className={styles.options}>
              <button type="button" className={styles.optionButton} onClick={() => setIsFullscreenOpen(true)}>
                View full screen
              </button>
              <button
                type="button"
                className={styles.optionButton}
                onClick={handleDownload}
                disabled={isDownloading || !parsedResults?.questions?.length}
              >
                {isDownloading ? "Downloading…" : "Download PDF"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <FullscreenModal open={isFullscreenOpen} onCloseAction={() => setIsFullscreenOpen(false)} fillScreen>
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
