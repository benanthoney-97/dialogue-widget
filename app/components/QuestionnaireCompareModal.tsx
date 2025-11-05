"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { parseQuestionnaireResponses } from "./QuestionnaireResults";
import { jsPDF } from "jspdf";
import { COOPER_FONT_NAME, ensureCooperFont } from "@/app/lib/pdfFonts";

type ComparePersona = {
  id: string;
  name: string;
  status?: string | null;
  audience?: string | null;
  updatedAt?: string | null;
  transcript: unknown;
};

type QuestionnaireCompareModalProps = {
  personas: ComparePersona[];
  initialPersonaId?: string | null;
  onClose: () => void;
};

export default function QuestionnaireCompareModal({
  personas,
  initialPersonaId,
  onClose,
}: QuestionnaireCompareModalProps) {
  const comparable = useMemo(
    () =>
      personas
        .map((persona) => {
          const parsed = parseQuestionnaireResponses(persona.transcript);
          return {
            ...persona,
            questions: parsed?.questions ?? [],
          };
        })
        .filter((persona) => persona.questions.length > 0),
    [personas],
  );

  const personaMap = useMemo(() => {
    const map = new Map<string, (typeof comparable)[number]>();
    comparable.forEach((item) => map.set(item.id, item));
    return map;
  }, [comparable]);

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  useEffect(() => {
    if (!comparable.length) {
      setLeftId(null);
      setRightId(null);
      return;
    }

    if (leftId && personaMap.has(leftId) && rightId && personaMap.has(rightId)) {
      return;
    }

    const defaultLeft =
      (initialPersonaId && personaMap.has(initialPersonaId) && initialPersonaId) ||
      comparable[0]?.id ||
      null;
    let defaultRight: string | null = null;
    if (defaultLeft) {
      defaultRight =
        comparable.find((persona) => persona.id !== defaultLeft)?.id ??
        comparable.find((persona) => persona.id === defaultLeft)?.id ??
        null;
    }
    setLeftId(defaultLeft);
    setRightId(defaultRight);
  }, [comparable, personaMap, leftId, rightId, initialPersonaId]);

  const leftPersona = leftId ? personaMap.get(leftId) ?? null : null;
  const rightPersona = rightId ? personaMap.get(rightId) ?? null : null;
  const selectedPersonas = useMemo(
    () => [leftPersona, rightPersona].filter(Boolean) as Array<(typeof comparable)[number]>,
    [leftPersona, rightPersona],
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const renderColumn = (persona: (typeof comparable)[number] | null) => {
    if (!persona) {
      return (
        <div className="qc-column qc-column--empty">
          <div className="qc-column-empty">
            <p>Select another parsed persona to compare.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="qc-column">
        <div className="qc-scroll">
          {persona.questions.map((entry, index) => (
            <article key={entry.id ?? `question-${index}`} className="qc-card">
              <header className="qc-card-question">
                {entry.question ? `Q${index + 1}. ${entry.question}` : `Question ${index + 1}`}
              </header>
              <dl className="qc-card-details">
                <div className="qc-card-row">
                  <dt>Response</dt>
                  <dd>{renderValue(entry.response ?? entry.selected_option)}</dd>
                </div>
                {entry.free_text ? (
                  <div className="qc-card-row">
                    <dt>Free text</dt>
                    <dd>{entry.free_text}</dd>
                  </div>
                ) : null}
                {entry.confidence !== undefined && entry.confidence !== null ? (
                  <div className="qc-card-row">
                    <dt>Confidence</dt>
                    <dd>
                      {typeof entry.confidence === "number"
                        ? entry.confidence.toFixed(2)
                        : entry.confidence}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderValue = (value: string | undefined | null) => {
    if (!value || !value.trim()) return "—";
    return value;
  };

  const handleDownload = useCallback(async () => {
    if (!selectedPersonas.length) return;
    setIsDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const cooperLoaded = await ensureCooperFont(doc);
      const textFont = cooperLoaded ? COOPER_FONT_NAME : "helvetica";
      const titleFontSize = cooperLoaded ? 26 : 18;
      const sectionTitleSize = cooperLoaded ? 15 : 13;
      const bodyFontSize = cooperLoaded ? 12 : 11;
      const cardPaddingX = 18;
      const cardPaddingY = 14;
      const cardWidth = doc.internal.pageSize.getWidth() - 96;
      const contentWidth = cardWidth - cardPaddingX * 2;
      const detailWidth = doc.internal.pageSize.getWidth() - 160;
      let cursorY = 48;

      const personaLabel = selectedPersonas.map((p) => p.name || "Untitled").join(" vs ");
      const headerTitle = `Questionnaire Comparison - ${personaLabel || "Personas"}`;
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

      const addCard = (
        title: string,
        rows: Array<{ label: string; value: string }>,
        options?: { variant?: "details" },
      ) => {
        const lineHeight = bodyFontSize + 4;
        const isDetails = options?.variant === "details";
        const titleWidth = isDetails ? detailWidth : contentWidth;
        let blockHeight = isDetails ? 0 : cardPaddingY * 2;

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
        let textY = isDetails ? blockY : blockY + cardPaddingY + bodyFontSize;
        const textX = isDetails ? blockX : blockX + cardPaddingX;

        if (!isDetails) {
          doc.setFillColor(19, 32, 62);
          doc.setDrawColor(59, 130, 246);
          doc.roundedRect(blockX, blockY, cardWidth, blockHeight, 12, 12, "F");
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          doc.setTextColor(191, 219, 254);
        } else {
          doc.setFont(textFont, "normal");
          doc.setFontSize(sectionTitleSize);
          doc.setTextColor(15, 23, 42);
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
            doc.setTextColor(15, 23, 42);
          } else {
            doc.setTextColor(191, 219, 254);
          }
          doc.text(labelText, textX, textY);

          const availableWidth = titleWidth - labelWidth;
          const valueLines = doc.splitTextToSize(row.value, availableWidth) as string[];
          if (isDetails) {
            doc.setTextColor(15, 23, 42);
          } else {
            doc.setTextColor(226, 232, 240);
          }
          if (valueLines.length) {
            doc.text(valueLines[0], textX + labelWidth, textY);
            for (let i = 1; i < valueLines.length; i++) {
              textY += lineHeight;
              doc.text(valueLines[i], textX + (isDetails ? labelWidth : 0), textY);
            }
          } else {
            doc.text("—", textX + labelWidth, textY);
          }
          textY += lineHeight;
        });

        cursorY = blockY + blockHeight;
        doc.setTextColor(5, 32, 51);
      };

      const formatDetailDate = (value?: string | null) => {
        if (!value) return "—";
        try {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return value;
          return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
        } catch {
          return value;
        }
      };

      drawPageFrame(true);

      selectedPersonas.forEach((persona, index) => {
        const detailRows = [
          { label: "Persona", value: persona.name || "Untitled" },
          { label: "Research type", value: persona.status || "—" },
          { label: "Audience", value: persona.audience || "—" },
          { label: "Date", value: formatDetailDate(persona.updatedAt) },
        ];
        addCard(`Persona ${index === 0 ? "A" : "B"} – Details`, detailRows, { variant: "details" });

        persona.questions.forEach((entry, questionIndex) => {
          const title = entry.question ? `Q${questionIndex + 1}. ${entry.question}` : `Question ${questionIndex + 1}`;
          const rows: Array<{ label: string; value: string }> = [
            { label: "Response", value: entry.response ?? entry.selected_option ?? "—" },
          ];
          if (entry.free_text) {
            rows.push({ label: "Free text", value: entry.free_text });
          }
          if (entry.confidence !== undefined && entry.confidence !== null) {
            const confidenceValue =
              typeof entry.confidence === "number" ? entry.confidence.toFixed(2) : String(entry.confidence);
            rows.push({ label: "Confidence", value: confidenceValue });
          }
          addCard(title, rows);
        });
      });

      const today = new Date();
      const formattedDate = today.toISOString().slice(0, 10);
      const personaCountLabel = `${selectedPersonas.length} Personas`;
      const fileNameParts = ["Group Questionnaire", personaCountLabel, formattedDate];
      const safeName = fileNameParts
        .join(" - ")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      doc.save(`${safeName || "questionnaire-comparison"}.pdf`);
    } catch (error) {
      console.error("[questionnaire-compare] download failed", error);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedPersonas]);

  return (
    <div className="qc-modal">
      <header className="qc-header">
        <div className="qc-header-text">
          <h2>Compare questionnaire results</h2>
          <p>Select up to two personas with parsed questionnaires to review responses side-by-side.</p>
        </div>
        <div className="qc-header-actions">
          <button
            type="button"
            className="qc-download"
            onClick={handleDownload}
            disabled={isDownloading || selectedPersonas.length === 0}
          >
            {isDownloading ? "Downloading…" : "Download"}
          </button>
          <button type="button" className="qc-close" onClick={onClose} aria-label="Close comparison modal">
            ×
          </button>
        </div>
      </header>
      {comparable.length === 0 ? (
        <div className="qc-empty">
          <p>No parsed questionnaire results available yet. Run a questionnaire to start comparing.</p>
        </div>
      ) : (
        <>
          <div className="qc-controls" role="group" aria-label="Persona selection">
            <div className="qc-select-group">
              <label htmlFor="qc-left-select">Persona A</label>
              <select
                id="qc-left-select"
                value={leftId ?? ""}
                onChange={(event) => setLeftId(event.target.value || null)}
              >
                {comparable.map((persona) => (
                  <option key={persona.id} value={persona.id} disabled={persona.id === rightId}>
                    {persona.name || "Untitled persona"}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="qc-swap"
              onClick={() => {
                setLeftId(rightId ?? null);
                setRightId(leftId ?? null);
              }}
              disabled={!leftId && !rightId}
            >
              Swap
            </button>
            <div className="qc-select-group">
              <label htmlFor="qc-right-select">Persona B</label>
              <select
                id="qc-right-select"
                value={rightId ?? ""}
                onChange={(event) => setRightId(event.target.value || null)}
              >
                {comparable.map((persona) => (
                  <option key={persona.id} value={persona.id} disabled={persona.id === leftId}>
                    {persona.name || "Untitled persona"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="qc-columns">
            {renderColumn(leftPersona ?? null)}
            {renderColumn(rightPersona ?? null)}
          </div>
        </>
      )}
      <footer className="qc-footer">
        <span>
          Showing {leftPersona?.questions.length ?? 0} questions for Persona A
          {rightPersona ? ` • ${rightPersona.questions.length} for Persona B` : ""}
        </span>
      </footer>
      <style jsx>{`
        .qc-modal {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f4f6fb;
          color: #0f172a;
        }
        .qc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 32px 40px 24px;
          gap: 24px;
        }
        .qc-header-text h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .qc-header-text p {
          margin-top: 8px;
          color: rgba(15, 23, 42, 0.65);
          max-width: 640px;
        }
        .qc-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .qc-download,
        .qc-close {
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.12);
          color: #0f172a;
          border-radius: 999px;
          cursor: pointer;
        }
        .qc-close {
          font-size: 28px;
          line-height: 1;
          width: 44px;
          height: 44px;
        }
        .qc-download {
          padding: 10px 18px;
          font-weight: 600;
          font-size: 14px;
        }
        .qc-download:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .qc-controls {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          padding: 0 40px 20px;
        }
        .qc-select-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qc-select-group label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.7);
        }
        .qc-select-group select {
          background: #ffffff;
          border: 1px solid rgba(59, 130, 246, 0.35);
          color: #0f172a;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
        }
        .qc-swap {
          align-self: center;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.1);
          color: #1d4ed8;
          cursor: pointer;
          font-weight: 600;
        }
        .qc-columns {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 40px 32px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 24px;
        }
        .qc-column {
          background: #ffffff;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }
        .qc-column--empty {
          justify-content: center;
          align-items: center;
        }
        .qc-column-empty {
          padding: 32px;
          text-align: center;
          color: rgba(15, 23, 42, 0.5);
        }
        .qc-scroll {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .qc-footer {
          border-top: 1px solid rgba(15, 23, 42, 0.06);
          padding: 18px 40px;
          display: flex;
          align-items: center;
          color: rgba(15, 23, 42, 0.6);
          font-size: 13px;
        }
        .qc-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
          color: rgba(15, 23, 42, 0.55);
        }
        @media (max-width: 1080px) {
          .qc-columns {
            grid-template-columns: 1fr;
          }
          .qc-controls {
            flex-direction: column;
            align-items: stretch;
          }
          .qc-swap {
            align-self: flex-end;
          }
          .qc-footer {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
      `}</style>
      <style jsx global>{`
        .qc-card {
          background: #13203e;
          color: #f8fafc;
          border: 1px solid rgba(59, 130, 246, 0.45);
          border-radius: 14px;
          padding: 20px 22px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
        }
        .qc-card + .qc-card {
          margin-top: 18px;
        }
        .qc-card-question {
          font-size: 15px;
          margin: 0 0 16px;
          color: #bfdbfe;
        }
        .qc-card-details {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .qc-card-row {
          display: flex;
          gap: 12px;
          line-height: 1.5;
        }
        .qc-card-row dt {
          min-width: 92px;
          color: rgba(191, 219, 254, 0.85);
          font-weight: 600;
        }
        .qc-card-row dd {
          margin: 0;
          flex: 1;
          color: #f8fafc;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
