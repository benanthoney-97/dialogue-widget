"use client";

import { useMemo } from "react";
import QuestionnaireResults from "@/app/components/QuestionnaireResults";

type QuestionnairePanelProps = {
  personaName: string;
  questionnaireStatus: string | null;
  lastRunAt: string | null;
  extractionResult: unknown;
  onStartNewQuestionnaire?: () => void;
  disableNewQuestionnaire?: boolean;
  isProcessing?: boolean;
  jobError?: string | null;
};

function formatStatus(value: string | null): string {
  if (!value) {
    return "Not run yet";
  }
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveStatusVariant(value: string | null): {
  background: string;
  border: string;
  color: string;
} {
  const status = value ? value.toLowerCase() : "idle";
  switch (status) {
    case "parsed":
    case "complete":
      return {
        background: "rgba(34, 197, 94, 0.12)",
        border: "1px solid rgba(34, 197, 94, 0.28)",
        color: "#166534",
      };
    case "processing":
    case "queued":
    case "running":
      return {
        background: "rgba(59, 130, 246, 0.12)",
        border: "1px solid rgba(59, 130, 246, 0.32)",
        color: "#1d4ed8",
      };
    case "failed":
    case "error":
      return {
        background: "rgba(239, 68, 68, 0.12)",
        border: "1px solid rgba(239, 68, 68, 0.32)",
        color: "#b91c1c",
      };
    default:
      return {
        background: "rgba(15, 23, 42, 0.08)",
        border: "1px solid rgba(15, 23, 42, 0.14)",
        color: "#0f172a",
      };
  }
}

export default function QuestionnairePanel({
  personaName,
  questionnaireStatus,
  lastRunAt,
  extractionResult,
  onStartNewQuestionnaire,
  disableNewQuestionnaire = false,
  isProcessing = false,
  jobError = null,
}: QuestionnairePanelProps) {
  const statusLabel = useMemo(() => formatStatus(questionnaireStatus), [questionnaireStatus]);
  const badgeTheme = useMemo(() => resolveStatusVariant(questionnaireStatus), [questionnaireStatus]);
  const lastRunLabel = useMemo(() => {
    if (!lastRunAt) {
      return null;
    }
    const dateValue = new Date(lastRunAt);
    if (Number.isNaN(dateValue.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dateValue);
  }, [lastRunAt]);

  const hasExtraction = extractionResult !== null && typeof extractionResult !== "undefined";

  return (
    <div className="persona-questionnaire-panel">
      <div className="persona-questionnaire-panel__toolbar">
        <div className="persona-questionnaire-panel__meta">
          <span className="persona-questionnaire-panel__badge" style={badgeTheme}>
            {statusLabel}
          </span>
          {lastRunLabel ? (
            <span className="persona-questionnaire-panel__timestamp">Last run {lastRunLabel}</span>
          ) : (
            <span className="persona-questionnaire-panel__timestamp">No questionnaire runs yet</span>
          )}
        </div>
        {onStartNewQuestionnaire ? (
          <button
            type="button"
            className="persona-questionnaire-panel__new-button"
            onClick={onStartNewQuestionnaire}
            disabled={disableNewQuestionnaire}
            aria-label={`Start a new questionnaire for ${personaName}`}
          >
            New Questionnaire
          </button>
        ) : null}
      </div>
      {jobError ? (
        <div className="persona-questionnaire-panel__alert" role="alert">
          {jobError}
        </div>
      ) : null}
      {hasExtraction ? (
        <QuestionnaireResults raw={extractionResult} title="Questionnaire responses" />
      ) : (
        <div className="persona-questionnaire-panel__empty">
          {isProcessing ? (
            <div className="persona-questionnaire-panel__empty-loading persona-quant-loading">
              <span className="persona-quant-spinner" aria-hidden="true" />
              <span>Processing questionnaire…</span>
            </div>
          ) : null}
          <strong>No questionnaire responses yet.</strong>
          <p>
            Launch a questionnaire run from the Dialogue console to surface structured answers here.
            Completed runs will appear automatically.
          </p>
        </div>
      )}
      <style jsx>{`
        .persona-questionnaire-panel {
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
        }
        .persona-questionnaire-panel__toolbar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .persona-questionnaire-panel__new-button {
          align-self: flex-start;
          border: none;
          border-radius: 999px;
          background: #0f172a;
          color: #f8fafc;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .persona-questionnaire-panel__new-button:hover:not(:disabled),
        .persona-questionnaire-panel__new-button:focus-visible:not(:disabled) {
          background: #14213d;
          transform: translateY(-1px);
          outline: none;
        }
        .persona-questionnaire-panel__new-button:disabled {
          cursor: not-allowed;
          background: rgba(15, 23, 42, 0.3);
          color: rgba(248, 250, 252, 0.7);
        }
        @media (min-width: 768px) {
          .persona-questionnaire-panel__toolbar {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .persona-questionnaire-panel__meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.66);
          font-weight: 600;
        }
        .persona-questionnaire-panel__alert {
          border-radius: 12px;
          border: 1px solid rgba(185, 28, 28, 0.3);
          background: rgba(239, 68, 68, 0.12);
          color: #991b1b;
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
        }
        .persona-questionnaire-panel__badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 12px;
          font-weight: 700;
        }
        .persona-questionnaire-panel__timestamp {
          font-family: 'Cooper Light BT', 'CooperBT', Cooper, serif;
        }
        .persona-questionnaire-panel__empty {
          border-radius: 18px;
          border: 1px dashed rgba(15, 23, 42, 0.22);
          background: rgba(15, 23, 42, 0.04);
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          text-align: center;
          color: rgba(15, 23, 42, 0.72);
        }
        .persona-questionnaire-panel__empty-loading.persona-quant-loading {
          border: none;
          background: transparent;
          padding: 0;
          min-height: 0;
          gap: 10px;
        }
        .persona-questionnaire-panel__empty-loading .persona-quant-spinner {
          width: 24px;
          height: 24px;
          border-width: 2px;
        }
        .persona-questionnaire-panel__empty-loading span:last-of-type {
          font-size: 14px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.7);
        }
        .persona-questionnaire-panel__empty strong {
          font-size: 16px;
          font-weight: 700;
          color: #052033;
        }
        .persona-questionnaire-panel__empty p {
          margin: 0;
          max-width: 520px;
          line-height: 1.6;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire) {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 18px;
          padding: 20px;
          color: #0f172a;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__header) {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__header h4) {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          color: #052033;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__count) {
          font-size: 13px;
          font-weight: 600;
          color: rgba(15, 23, 42, 0.54);
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__scroll) {
          flex: 1 1 auto;
          min-height: 0;
          max-height: 420px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__grid) {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
          align-content: start;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__item) {
          border: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 14px;
          padding: 16px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__question) {
          font-weight: 700;
          font-size: 14px;
          color: #052033;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__answer) {
          display: flex;
          gap: 8px;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
          color: rgba(15, 23, 42, 0.78);
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__label) {
          color: rgba(15, 23, 42, 0.54);
          font-weight: 600;
          flex-shrink: 0;
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__placeholder) {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 160px;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.66);
          border: 1px dashed rgba(15, 23, 42, 0.16);
          border-radius: 14px;
          background: rgba(248, 250, 252, 0.9);
        }
        .persona-questionnaire-panel :global(.insights-questionnaire__raw) {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          background: rgba(15, 23, 42, 0.08);
          border: 1px solid rgba(15, 23, 42, 0.16);
          border-radius: 14px;
          padding: 14px;
          white-space: pre-wrap;
          word-break: break-word;
          color: #0f172a;
        }
        @media (max-width: 768px) {
          .persona-questionnaire-panel {
            padding: 22px;
          }
          .persona-questionnaire-panel :global(.insights-questionnaire__grid) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
