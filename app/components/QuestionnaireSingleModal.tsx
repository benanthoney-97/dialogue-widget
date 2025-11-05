"use client";

import React from "react";

type SingleQuestion = {
  id?: string;
  question?: string;
  response?: string;
  selectedOption?: string;
  freeText?: string;
  confidence?: number | string | null;
};

type QuestionnaireSingleModalProps = {
  questions: SingleQuestion[];
  personaName?: string | null;
  onClose: () => void;
  rawFallback?: string | null;
};

export default function QuestionnaireSingleModal({
  questions,
  personaName,
  onClose,
  rawFallback,
}: QuestionnaireSingleModalProps) {
  const hasQuestions = questions.length > 0;

  const renderConfidence = (value: number | string | null | undefined) => {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "number") {
      return value.toFixed(2);
    }
    return value;
  };

  return (
    <div className="qs-modal">
      <header className="qs-header">
        <div>
          <h2>{personaName ? `${personaName} – Questionnaire responses` : "Questionnaire responses"}</h2>
          <p>Review the full set of answers captured for this persona.</p>
        </div>
        <button type="button" className="qs-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      <main className="qs-body">
        {hasQuestions ? (
          <div className="qs-scroll">
            {questions.map((entry, index) => (
              <article key={entry.id ?? `question-${index}`} className="qs-card">
                <header className="qs-card-question">
                  {entry.question ? `Q${index + 1}. ${entry.question}` : `Question ${index + 1}`}
                </header>
                <dl className="qs-card-details">
                  <div className="qs-card-row">
                    <dt>Response</dt>
                    <dd>{entry.response ?? entry.selectedOption ?? "—"}</dd>
                  </div>
                  {entry.freeText ? (
                    <div className="qs-card-row">
                      <dt>Free text</dt>
                      <dd>{entry.freeText}</dd>
                    </div>
                  ) : null}
                  {entry.confidence !== undefined && entry.confidence !== null ? (
                    <div className="qs-card-row">
                      <dt>Confidence</dt>
                      <dd>{renderConfidence(entry.confidence)}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        ) : rawFallback ? (
          <div className="qs-empty">
            <pre>{rawFallback}</pre>
          </div>
        ) : (
          <div className="qs-empty">
            <p>No questionnaire responses captured yet.</p>
          </div>
        )}
      </main>
      <style jsx>{`
        .qs-modal {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f4f6fb;
          color: #0f172a;
        }
        .qs-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 32px 40px 24px;
          gap: 24px;
        }
        .qs-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .qs-header p {
          margin: 8px 0 0;
          color: rgba(15, 23, 42, 0.65);
        }
        .qs-close {
          background: rgba(15, 23, 42, 0.05);
          border: 1px solid rgba(15, 23, 42, 0.12);
          color: #0f172a;
          font-size: 28px;
          line-height: 1;
          border-radius: 999px;
          width: 44px;
          height: 44px;
          cursor: pointer;
        }
        .qs-body {
          flex: 1;
          min-height: 0;
          padding: 0 40px 32px;
        }
        .qs-scroll {
          height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-right: 6px;
        }
        .qs-card {
          background: #13203e;
          color: #f8fafc;
          border: 1px solid rgba(59, 130, 246, 0.45);
          border-radius: 14px;
          padding: 20px 22px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
        }
        .qs-card-question {
          font-size: 15px;
          margin: 0 0 16px;
          color: #bfdbfe;
        }
        .qs-card-details {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .qs-card-row {
          display: flex;
          gap: 12px;
          line-height: 1.5;
        }
        .qs-card-row dt {
          min-width: 92px;
          color: rgba(191, 219, 254, 0.85);
          font-weight: 600;
        }
        .qs-card-row dd {
          margin: 0;
          flex: 1;
          color: #f8fafc;
          white-space: pre-wrap;
        }
        .qs-empty {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(15, 23, 42, 0.6);
          padding: 40px;
          text-align: center;
        }
        .qs-empty pre {
          text-align: left;
          background: rgba(15, 23, 42, 0.08);
          padding: 16px;
          border-radius: 10px;
          white-space: pre-wrap;
        }
        @media (max-width: 800px) {
          .qs-body {
            padding: 0 24px 28px;
          }
          .qs-scroll {
            padding-right: 0;
          }
        }
      `}</style>
    </div>
  );
}
