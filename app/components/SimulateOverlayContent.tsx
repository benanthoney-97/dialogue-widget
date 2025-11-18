"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";

type SimulateOverlayContentProps = {
  clientId: number | null;
  personaName: string;
};

type PersonaOption = {
  agent_id: string | null;
  agent_name: string | null;
  profile_image: string | null;
  role_title: string | null;
};

const interviewTypes = [
  {
    label: "Problem",
    description: "Understand what they’re trying to achieve, their motivations and existing pain points.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"
        />
      </svg>
    ),
  },
  {
    label: "Solution",
    description: "Stress-test your idea, which parts of the concept land, and what feels valuable.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
        <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10m0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12" />
        <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />
        <path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0" />
      </svg>
    ),
  },
  {
    label: "Positioning",
    description: "How they’d compare you to alternatives and what language actually resonates.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />
        <path
          d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2"
        />
      </svg>
    ),
  },
];

export default function SimulateOverlayContent({ clientId, personaName }: SimulateOverlayContentProps) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState("");
  const [savedQuestions, setSavedQuestions] = useState<string[]>([]);
  const runTimerRef = useRef<number | null>(null);

  const canRun = selectedTypes.length > 0 && selectedPersonas.length > 0;

  useEffect(() => {
    let active = true;
    if (!clientId) {
      setPersonas([]);
      setSelectedPersonas([]);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase
          .from("agent_map")
          .select("agent_id, agent_name, profile_image, role_title")
          .eq("client_id", clientId)
          .order("agent_name", { ascending: true });
        if (!active) return;
        const options = data ?? [];
        setPersonas(options);
        setSelectedPersonas((prev) =>
          prev.filter((item) => options.some((persona) => persona.agent_id === item))
        );
      } catch (err) {
        if (!active) return;
        setPersonas([]);
        setSelectedPersonas([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    return () => {
      if (runTimerRef.current !== null) {
        window.clearTimeout(runTimerRef.current);
      }
    };
  }, []);

  const handleRun = () => {
    if (!canRun) {
      setRunError("Pick at least one type and persona to run a simulation.");
      setRunStatus("error");
      return;
    }

    if (runTimerRef.current !== null) {
      window.clearTimeout(runTimerRef.current);
    }

    setRunError(null);
    setRunStatus("running");

    runTimerRef.current = window.setTimeout(() => {
      setRunStatus("success");
    }, 1200);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  };

  const togglePersona = (key: string) => {
    setSelectedPersonas((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const personaKey = (persona: PersonaOption) => persona.agent_id ?? persona.agent_name ?? "unknown";

  const interviewCount = selectedTypes.length * selectedPersonas.length;

  return (
    <div className="simulate-overlay">
      <section className="simulate-overlay__section">
        <div className="simulate-overlay__section-row">
          <h4 className="simulate-overlay__section-title">Interview objective</h4>
        </div>
        <textarea
          className="simulate-overlay__objective"
          placeholder="Describe what you’re trying to learn from this simulated interview."
          rows={3}
        />
      </section>
      <section className="simulate-overlay__section">
        <div className="simulate-overlay__section-row">
          <h4 className="simulate-overlay__section-title">Interview questions</h4>
        </div>
        <div className="simulate-overlay__questions-row">
          <input
            type="text"
            className="simulate-overlay__questions-input"
            placeholder="Type a question and click add"
            value={questionInput}
            onChange={(event) => setQuestionInput(event.target.value)}
          />
          <button
            type="button"
            className="simulate-overlay__add-button"
            onClick={() => {
              const trimmed = questionInput.trim();
              if (!trimmed) return;
              setSavedQuestions((prev) => [...prev, trimmed]);
              setQuestionInput("");
            }}
            disabled={questionInput.trim().length === 0}
          >
            Add question
          </button>
        </div>
        {savedQuestions.length > 0 ? (
          <div className="simulate-overlay__question-list">
            {savedQuestions.map((question, index) => (
              <p key={`${question}-${index}`} className="simulate-overlay__question-item">
                {index + 1}. {question}
              </p>
            ))}
          </div>
        ) : null}
      </section>
      <section className="simulate-overlay__section">
        <div className="simulate-overlay__section-row">
          <h4 className="simulate-overlay__section-title">Interview types</h4>
        </div>
        <div className="simulate-overlay__grid">
          {interviewTypes.map((type) => (
            <div
              key={type.label}
              className={`simulate-overlay__grid-item${selectedTypes.includes(type.label) ? " simulate-overlay__grid-item--selected" : ""}`}
              onClick={() => toggleType(type.label)}
            >
              <div className="simulate-overlay__grid-title">
                <strong>{type.label}</strong>
                <span className="simulate-overlay__grid-icon" aria-hidden="true">
                  {type.icon}
                </span>
              </div>
              <p className="simulate-overlay__grid-note">{type.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="simulate-overlay__section">
        <h4 className="simulate-overlay__section-title">Select personas</h4>
        {personas.length === 0 ? (
          <p className="simulate-overlay__placeholder">No personas configured for this workspace yet.</p>
        ) : (
          <div className="simulate-overlay__persona-row">
            {personas.map((persona) => {
              const key = personaKey(persona);
              const isSelected = selectedPersonas.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`simulate-overlay__persona-chip${isSelected ? " simulate-overlay__persona-chip--selected" : ""}`}
                  onClick={() => togglePersona(key)}
                >
                  {persona.profile_image ? (
                    <img
                      src={persona.profile_image}
                      alt={persona.agent_name ?? "Persona"}
                      className="simulate-overlay__persona-avatar"
                    />
                  ) : null}
                  <span>
                    {persona.agent_name ?? "Unnamed persona"}
                    {persona.role_title ? (
                      <small className="simulate-overlay__persona-role">{persona.role_title}</small>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="simulate-overlay__footer">
        <p className="simulate-overlay__count" role="status" aria-live="polite">
          Interview count: {interviewCount}
        </p>
        <button
          type="button"
          className="simulate-overlay__run-button"
          onClick={handleRun}
          disabled={runStatus === "running"}
        >
          Run interviews
        </button>
        {runStatus === "running" && <p className="simulate-overlay__run-status">Scheduling simulations…</p>}
        {runStatus === "success" && <p className="simulate-overlay__run-status">Simulations queued for {personaName}.</p>}
        {runStatus === "error" && runError ? (
          <p className="simulate-overlay__run-status simulate-overlay__run-status--error">{runError}</p>
        ) : null}
      </div>

      <style jsx>{`
        .simulate-overlay {
          font-family: ${BODY_FONT_STACK};
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .simulate-overlay__section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .simulate-overlay__section-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
        }
        .simulate-overlay__section-title {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.6);
        }
        .simulate-overlay__objective {
          font-family: inherit;
          font-size: 14px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          background: #f8fafc;
          color: rgba(15, 23, 42, 0.85);
          resize: vertical;
        }
        .simulate-overlay__questions-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .simulate-overlay__questions-input {
          flex: 1;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          padding: 10px;
          font-family: inherit;
          font-size: 14px;
          background: #f8fafc;
          color: rgba(15, 23, 42, 0.85);
        }
        .simulate-overlay__add-button {
          border-radius: 10px;
          border: none;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          background: #0f172a;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .simulate-overlay__add-button:disabled {
          background: rgba(0, 0, 0, 0.15);
          cursor: not-allowed;
        }
        .simulate-overlay__question-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
        }
        .simulate-overlay__question-item {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .simulate-overlay__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .simulate-overlay__grid-item {
          padding: 12px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.12);
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.8);
          font-weight: 500;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
        }
        .simulate-overlay__grid-item--selected {
          border-color: rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.12);
        }
        .simulate-overlay__grid-title {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
        }
        .simulate-overlay__grid-icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
        }
        .simulate-overlay__grid-note {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 400;
        }
        .simulate-overlay__persona-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .simulate-overlay__persona-chip {
          border: 1px solid rgba(15, 23, 42, 0.15);
          padding: 6px 14px;
          border-radius: 12px;
          background: #fff;
          color: #0f172a;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: flex-start;
          gap: 8px;
          min-width: 200px;
        }
        .simulate-overlay__persona-chip--selected {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.8);
        }
        .simulate-overlay__persona-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }
        .simulate-overlay__persona-chip span {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .simulate-overlay__persona-role {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
          font-size: 10px;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 400;
        }
        .simulate-overlay__placeholder {
          margin: 0;
          color: rgba(15, 23, 42, 0.6);
          font-size: 13px;
        }
        .simulate-overlay__footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-top: 6px;
        }
        .simulate-overlay__count {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .simulate-overlay__run-button {
          background: #0f172a;
          border: none;
          border-radius: 8px;
          color: #fff;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .simulate-overlay__run-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .simulate-overlay__run-status {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
        }
        .simulate-overlay__run-status--error {
          color: #b91c1c;
        }
      `}</style>
    </div>
  );
}