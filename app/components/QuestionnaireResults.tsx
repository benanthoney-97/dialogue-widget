"use client";

import React, { useMemo } from "react";

export type QuestionnaireEntry = {
  id?: string;
  question?: string;
  response?: string;
  selected_option?: string;
  free_text?: string;
  confidence?: number | string | null;
};

export type ParsedQuestionnaireResult = {
  questions: QuestionnaireEntry[];
};

export type QuestionnaireResultsProps = {
  raw: unknown;
  title?: string;
};

export function parseQuestionnaireResponses(input: unknown): ParsedQuestionnaireResult | null {
  if (input === null || typeof input === "undefined") {
    return null;
  }

  let data: unknown = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  let rawQuestions: unknown[] = [];
  if (Array.isArray((data as { questions?: unknown[] }).questions)) {
    rawQuestions = (data as { questions?: unknown[] }).questions ?? [];
  } else if (Array.isArray(data)) {
    rawQuestions = data;
  }

  const questions = rawQuestions.map((entry): QuestionnaireEntry => {
    if (typeof entry !== "object" || entry === null) {
      return {};
    }
    const item = entry as Record<string, unknown>;
    return {
      id: typeof item.id === "string" ? item.id : undefined,
      question: typeof item.question === "string" ? item.question : undefined,
      response: typeof item.response === "string" ? item.response : undefined,
      selected_option: typeof item.selected_option === "string" ? item.selected_option : undefined,
      free_text: typeof item.free_text === "string" ? item.free_text : undefined,
      confidence:
        typeof item.confidence === "number" || typeof item.confidence === "string"
          ? item.confidence
          : null,
    };
  });

  return { questions };
}

export default function QuestionnaireResults({ raw, title = "Questionnaire responses" }: QuestionnaireResultsProps) {
  const parsed = useMemo(() => parseQuestionnaireResponses(raw), [raw]);
  const questions = parsed?.questions ?? [];
  const hasQuestions = questions.length > 0;

  const rawContent =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object"
      ? JSON.stringify(raw, null, 2)
      : null;

  return (
    <div className="insights-questionnaire">
      <div className="insights-questionnaire__header">
        <h4>{title}</h4>
        {parsed ? (
          <span className="insights-questionnaire__count">
            {questions.length} {questions.length === 1 ? "response" : "responses"}
          </span>
        ) : null}
      </div>
      <div className="insights-questionnaire__scroll">
        {hasQuestions ? (
          <ul className="insights-questionnaire__grid">
            {questions.map((entry, idx) => (
              <li key={entry.id ?? `question-${idx}`} className="insights-questionnaire__item">
                <span className="insights-questionnaire__question">
                  {entry.question ?? "Question"}
                </span>
                <div className="insights-questionnaire__answer">
                  <span className="insights-questionnaire__label">Response:</span>
                  <span>{entry.response ?? entry.selected_option ?? "—"}</span>
                </div>
                {entry.free_text ? (
                  <div className="insights-questionnaire__answer">
                    <span className="insights-questionnaire__label">Free text:</span>
                    <span>{entry.free_text}</span>
                  </div>
                ) : null}
                {entry.confidence !== undefined && entry.confidence !== null ? (
                  <div className="insights-questionnaire__answer">
                    <span className="insights-questionnaire__label">Confidence:</span>
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
        ) : rawContent ? (
          <pre className="insights-questionnaire__raw">{rawContent}</pre>
        ) : (
          <div className="insights-questionnaire__placeholder">
            No questionnaire responses captured yet.
          </div>
        )}
      </div>
    </div>
  );
}
