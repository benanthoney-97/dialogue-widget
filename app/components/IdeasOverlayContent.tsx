"use client";

import React, { useEffect, useRef, useState } from "react";
import { BODY_FONT_STACK } from "@/app/lib/fontStacks";
import { DevelopmentIdeaRow } from "@/app/types/developmentIdea";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

type IdeasOverlayContentProps = {
  idea: DevelopmentIdeaRow;
  clientId: string;
};

export default function IdeasOverlayContent({ idea, clientId }: IdeasOverlayContentProps) {
  const transcriptSummary = idea.transcript_summary ?? "No transcript summary available.";
  const [editableSummary, setEditableSummary] = useState(transcriptSummary);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<number | null>(null);
  const skipSaveRef = useRef(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [personas, setPersonas] = useState<
    { agent_id: string | null; agent_name: string | null; profile_image: string | null; role_title: string | null }[]
  >([]);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [runError, setRunError] = useState<string | null>(null);
  useEffect(() => {
    setRunStatus("idle");
    setRunError(null);
  }, [idea.id]);
  const [showTrackProgress, setShowTrackProgress] = useState(false);
  const canRunInterviews =
    editableSummary.trim().length > 0 && selectedTypes.length > 0 && selectedPersonas.length > 0;
  const router = useRouter();
  const handleRunInterviews = async () => {
    if (!canRunInterviews) return;
    setRunStatus("running");
    setRunError(null);
    const agentIds = personas
      .filter((persona) => {
        const key = persona.agent_id ?? persona.agent_name ?? "unknown";
        return selectedPersonas.includes(key) && Boolean(persona.agent_id);
      })
      .map((persona) => persona.agent_id ?? "")
      .filter(Boolean);
    if (agentIds.length === 0) {
      setRunStatus("error");
      setRunError("No agent configured for the selected personas.");
      return;
    }
    try {
      const response = await fetch(`/api/clients/${clientId}/run-interviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ideaId: idea.id,
          agentIds,
          interviewTypes: selectedTypes,
          ideaTitle: idea.call_summary_title,
          ideaDescription: idea.transcript_summary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setRunStatus("error");
        setRunError(payload?.error ?? "Unexpected error while running interviews.");
      } else {
        setRunStatus("success");
        setShowTrackProgress(true);
        void supabase
          .from("development_ideas")
          .update({ development_status: "Run" })
          .eq("id", idea.id)
          .then(({ error }) => {
            if (error) {
              console.error("[IdeasOverlayContent] Failed to mark idea as run", error);
            }
          });
      }
    } catch (err) {
      setRunStatus("error");
      setRunError("Unable to reach the interviews service.");
    }
  };

  useEffect(() => {
    setEditableSummary(transcriptSummary);
    setSaveStatus("idle");
    skipSaveRef.current = true;
  }, [transcriptSummary]);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveStatus("saving");
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("development_ideas")
        .update({ transcript_summary: editableSummary })
        .eq("id", idea.id);
      if (error) {
        setSaveStatus("error");
      } else {
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus("idle"), 1500);
      }
      saveTimerRef.current = null;
    }, 900);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [editableSummary, idea.id]);

  useEffect(() => {
    let mounted = true;
    if (!clientId) {
      setPersonas([]);
      setSelectedPersonas([]);
      return;
    }
    supabase
      .from("agent_map")
      .select("agent_id, agent_name, profile_image, role_title")
      .eq("client_id", clientId)
      .order("agent_name", { ascending: true })
      .then((response) => {
        if (!mounted) return;
        const options = response.data ?? [];
        setPersonas(options);
        setSelectedPersonas((prev) =>
          prev.filter((item) => options.some((persona) => persona.agent_id === item))
        );
      })
      .catch(() => {
        if (!mounted) return;
        setPersonas([]);
        setSelectedPersonas([]);
      });
    return () => {
      mounted = false;
    };
  }, [clientId]);

  return (
    <div className="ideas-overlay">
      <section className="ideas-overlay__section">
        <div className="ideas-overlay__section-row">
          <h4 className="ideas-overlay__section-title">Idea description</h4>
          <p className="ideas-overlay__auto-save">Auto saves on change</p>
        </div>
        <textarea
          className="ideas-overlay__summary"
          value={editableSummary}
          onChange={(event) => setEditableSummary(event.target.value)}
          rows={6}
        />
        {saveStatus !== "idle" ? (
          <p className="ideas-overlay__status">
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "Saved"
              : "Save failed"}
          </p>
        ) : null}
      </section>
      <section className="ideas-overlay__section">
        <h4 className="ideas-overlay__section-title">Interview types</h4>
        <div className="ideas-overlay__grid">
          <div
            className={`ideas-overlay__grid-item${selectedTypes.includes("Problem") ? " ideas-overlay__grid-item--selected" : ""}`}
            onClick={() =>
              setSelectedTypes((prev) =>
                prev.includes("Problem") ? prev.filter((item) => item !== "Problem") : [...prev, "Problem"]
              )
            }
          >
          <div className="ideas-overlay__grid-title">
            <strong>Problem</strong>
            <span className="ideas-overlay__grid-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="#0A1930"
                  viewBox="0 0 16 16"
                >
                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
                </svg>
              </span>
            </div>
            <p className="ideas-overlay__grid-note">
              Help us understand challenges and pain points.
            </p>
          </div>
          <div
            className={`ideas-overlay__grid-item${selectedTypes.includes("Solution") ? " ideas-overlay__grid-item--selected" : ""}`}
            onClick={() =>
              setSelectedTypes((prev) =>
                prev.includes("Solution") ? prev.filter((item) => item !== "Solution") : [...prev, "Solution"]
              )
            }
          >
            <div className="ideas-overlay__grid-title">
              <strong>Solution</strong>
              <span className="ideas-overlay__grid-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="#0A1930"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                  <path d="M8 13A5 5 0 1 1 8 3a5 5 0 0 1 0 10m0 1A6 6 0 1 0 8 2a6 6 0 0 0 0 12"/>
                  <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/>
                  <path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/>
                </svg>
              </span>
            </div>
            <p className="ideas-overlay__grid-note">
              Help us create new ideas and solutions.
            </p>
          </div>
          <div
            className={`ideas-overlay__grid-item${selectedTypes.includes("Positioning") ? " ideas-overlay__grid-item--selected" : ""}`}
            onClick={() =>
              setSelectedTypes((prev) =>
                prev.includes("Positioning") ? prev.filter((item) => item !== "Positioning") : [...prev, "Positioning"]
              )
            }
          >
            <div className="ideas-overlay__grid-title">
              <strong>Positioning</strong>
              <span className="ideas-overlay__grid-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  fill="#0A1930"
                  viewBox="0 0 16 16"
                >
                  <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
                  <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2"/>
                </svg>
              </span>
            </div>
            <p className="ideas-overlay__grid-note">
              Help us refine our messaging and market fit.
            </p>
          </div>
        </div>
      </section>
      <section className="ideas-overlay__section">
        <h4 className="ideas-overlay__section-title">Select personas</h4>
        {personas.length === 0 ? (
          <p className="ideas-overlay__placeholder">No personas configured for this client.</p>
        ) : (
          <div className="ideas-overlay__persona-row">
            {personas.map((persona) => {
              const key = persona.agent_id ?? persona.agent_name ?? "unknown";
              const isSelected = selectedPersonas.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`ideas-overlay__persona-chip${isSelected ? " ideas-overlay__persona-chip--selected" : ""}`}
                  onClick={() =>
                    setSelectedPersonas((current) =>
                      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
                    )
                  }
                >
                  {persona.profile_image ? (
                    <img
                      src={persona.profile_image}
                      alt={persona.agent_name ?? "Persona"}
                      className="ideas-overlay__persona-avatar"
                    />
                  ) : null}
                  <span>
                    {persona.agent_name ?? "Unnamed persona"}
                    {persona.role_title ? (
                      <small className="ideas-overlay__persona-role">{persona.role_title}</small>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      <div className="ideas-overlay__footer">
        <p className="ideas-overlay__count" role="status" aria-live="polite">
          Interview count: {selectedTypes.length * selectedPersonas.length}
        </p>
        <button
          type="button"
          className="ideas-overlay__run-button"
          onClick={handleRunInterviews}
          disabled={!canRunInterviews || runStatus === "running"}
        >
          Run interviews
        </button>
        {showTrackProgress && clientId ? (
          <button
            type="button"
            className="ideas-overlay__run-button ideas-overlay__run-button--secondary"
            onClick={() => router.push(`/client/${clientId}/interviews`)}
          >
            Track progress
          </button>
        ) : null}
        {runStatus === "running" ? (
          <p className="ideas-overlay__run-status">Running interviews…</p>
        ) : runStatus === "success" ? (
          <p className="ideas-overlay__run-status">Interviews scheduled</p>
        ) : runStatus === "error" && runError ? (
          <p className="ideas-overlay__run-status ideas-overlay__run-status--error">{runError}</p>
        ) : null}
      </div>
      <style jsx>{`
        .ideas-overlay {
          font-family: ${BODY_FONT_STACK};
        }
        .ideas-overlay__section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 18px;
        }
        .ideas-overlay__section-title {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.6);
        }
        .ideas-overlay__section-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .ideas-overlay__auto-save {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
          letter-spacing: 0.05em;
          text-transform: none;
        }
        .ideas-overlay__summary {
          font-family: inherit;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.85);
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(15, 23, 42, 0.2);
          resize: vertical;
          min-height: 120px;
          background: #f8fafc;
        }
        .ideas-overlay__status {
          margin: 4px 0 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
        }
        .ideas-overlay__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .ideas-overlay__grid-item {
          padding: 12px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08);
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
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .ideas-overlay__grid-item:hover {
          transform: translateY(-1px);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.08);
        }
        .ideas-overlay__grid-item--selected {
          border-color: rgba(59, 130, 246, 0.4);
          background: rgba(59, 130, 246, 0.12);
        }
        .ideas-overlay__persona-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ideas-overlay__persona-chip {
          border: 1px solid rgba(15, 23, 42, 0.15);
          padding: 6px 14px;
          border-radius: 12px;
          background: #fff;
          color: #0f172a;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
          display: inline-flex;
          align-items: flex-start;
          gap: 8px;
          width: 220px;
          min-width: 200px;
        }
        .ideas-overlay__persona-chip span {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .ideas-overlay__persona-role {
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
        .ideas-overlay__persona-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
        }
        .ideas-overlay__persona-chip--selected {
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(59, 130, 246, 0.8);
        }
        .ideas-overlay__placeholder {
          margin: 0;
          color: rgba(15, 23, 42, 0.6);
          font-size: 13px;
        }
        .ideas-overlay__grid-title {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
        }
        .ideas-overlay__grid-icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
        }
        .ideas-overlay__grid-note {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 400;
        }
        .ideas-overlay__footer {
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
          margin-top: 4px;
          gap: 20px;
        }
        .ideas-overlay__count {
          margin: 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.7);
        }
        .ideas-overlay__run-button {
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
        .ideas-overlay__run-button--secondary {
          background: transparent;
          border: 1px solid rgba(15, 23, 42, 0.2);
          color: #0f172a;
          box-shadow: none;
        }
        .ideas-overlay__run-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .ideas-overlay__run-button:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 12px rgba(15, 23, 42, 0.2);
        }
        .ideas-overlay__run-status {
          margin: 0;
          font-size: 12px;
          color: rgba(15, 23, 42, 0.65);
        }
        .ideas-overlay__run-status--error {
          color: #b91c1c;
        }
      `}</style>
    </div>
  );
}
