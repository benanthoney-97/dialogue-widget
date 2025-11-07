"use client";

import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import Topbar, { TOPBAR_HEIGHT } from "../../../components/Topbar";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function ResearchPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"Goals & Priorities" | "Target Sources">(
    "Goals & Priorities"
  );
  const [selectedCadence, setSelectedCadence] = useState<string>("Weekly");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const targetSources = useMemo(
    () => [
      { name: "Financial Times", initials: "FT", accent: "#f97316" },
      { name: "Bloomberg", initials: "BB", accent: "#6366f1" },
      { name: "TechCrunch", initials: "TC", accent: "#10b981" },
      { name: "Crunchbase", initials: "CB", accent: "#0ea5e9" },
      { name: "Harvard Business Review", initials: "HBR", accent: "#dc2626" },
      { name: "McKinsey Insights", initials: "MI", accent: "#2563eb" },
      { name: "Gartner", initials: "G", accent: "#7c3aed" },
      { name: "Forrester", initials: "F", accent: "#14b8a6" },
    ],
    []
  );

  return (
    <div
      className="research-stage"
      style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
    >
      <Topbar
        title="Web research"
        cadence={selectedCadence}
        onCadenceChange={(value) => setSelectedCadence(value)}
        offsetLeft="var(--stage-topbar-offset, 0px)"
      />
      <main className="stage-layout research-root">
        <aside className="stage-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="stage-layout__content">
          <div className="stage-shell">
            <div className="research-tabs">
              {(["Goals & Priorities", "Target Sources"] as const).map((label) => {
                const isActive = activeTab === label;
                return (
                  <button
                    key={label}
                    type="button"
                    className={`research-tab${isActive ? " research-tab--active" : ""}`}
                    onClick={() => setActiveTab(label)}
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          <section className="research-card research-card--placeholder">
            <header>
            </header>
            <div className="research-card__body">
              {activeTab === "Goals & Priorities" ? (
                <>
                  <header className="research-section-header">
                    <h2>Core Goal</h2>
                    <p className="research-section-helper">Choose the primary goal for your personas.</p>
                  </header>
                  <div className="research-goals">
                    {[
                      { label: "Develop new products", description: "Spot emerging needs and market gaps to guide R&D." },
                      { label: "Refine messaging", description: "Understand customer language to sharpen positioning." },
                      { label: "Content strategy", description: "Track narratives and trends to fuel editorial calendars." },
                      { label: "Sales enablement", description: "Give reps the freshest proof points and competitive intel." },
                    ].map((goal) => (
                      <button
                        type="button"
                        key={goal.label}
                        className={`research-goal-tile${selectedGoal === goal.label ? " research-goal-tile--active" : ""}`}
                        onClick={() => setSelectedGoal((prev) => (prev === goal.label ? null : goal.label))}
                        aria-pressed={selectedGoal === goal.label}
                      >
                        <span className="research-goal-title">{goal.label}</span>
                        <span className="research-goal-copy">{goal.description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="research-placeholder-grid">
                    <div className="research-priorities">
                      <header className="research-section-header">
                        <h2>Priorities</h2>
                        <p className="research-section-helper">Choose the types of research you want to focus on.</p>
                      </header>
                      <div className="research-priorities-grid">
                        {[
                          { label: "Industry trends", helper: "Spot macro shifts and market sentiment." },
                          { label: "Competitors", helper: "Track launches, pricing moves, and leadership news." },
                          { label: "Customer signals", helper: "Monitor reviews, forums, and feedback loops." },
                          { label: "Regulation", helper: "Stay ahead of policy updates and compliance risks." },
                          { label: "Investor chatter", helper: "Watch funding rounds and analyst notes." },
                          { label: "Emerging tech", helper: "Surface new tools and enablers for your space." },
                        ].map((priority) => {
                          const active = selectedPriorities.includes(priority.label);
                          return (
                            <button
                              type="button"
                              key={priority.label}
                              className={`research-priority-chip${active ? " research-priority-chip--active" : ""}`}
                              onClick={() =>
                                setSelectedPriorities((prev) =>
                                  prev.includes(priority.label)
                                    ? prev.filter((label) => label !== priority.label)
                                    : [...prev, priority.label]
                                )
                              }
                              aria-pressed={active}
                            >
                              <span className="research-priority-label">{priority.label}</span>
                              <span className="research-priority-helper">{priority.helper}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="research-sources">
                  <header className="research-section-header">
                    <h2>Target sources</h2>
                    <p className="research-section-helper">
                      Pin the news sources most relevant to your customer personas.
                    </p>
                  </header>
                  <div className="research-sources-grid">
                    {targetSources.map((source) => {
                      const active = selectedSources.includes(source.name);
                      return (
                        <button
                          type="button"
                          key={source.name}
                          className={`research-source-card${active ? " research-source-card--active" : ""}`}
                          onClick={() =>
                            setSelectedSources((prev) =>
                              prev.includes(source.name)
                                ? prev.filter((name) => name !== source.name)
                                : [...prev, source.name]
                            )
                          }
                          aria-pressed={active}
                        >
                        <div
                          className="research-source-logo"
                          style={{
                            background: `linear-gradient(135deg, ${source.accent} 0%, ${source.accent} 60%, rgba(255,255,255,0.85) 100%)`,
                          }}
                          aria-hidden="true"
                        >
                          {source.initials}
                        </div>
                        <span className="research-source-name">{source.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      <style>{`
        .research-stage {
          position: relative;
          min-height: 100vh;
        }
        .stage-layout {
          background: #f4f8ff;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          display: flex;
          height: 100%;
        }
        .stage-layout__sidebar {
          width: var(--sidebar-width);
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 18px 24px 48px;
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: #052033;
          height: 100%;
          min-height: 0;
        }
        .research-tabs {
          display: flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.12);
          padding: 6px;
          border-radius: 12px;
          width: 100%;
          justify-content: space-between;
        }
        .research-tab {
          border: none;
          background: transparent;
          color: rgba(15, 23, 42, 0.6);
          padding: 8px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
          flex: 1 1 0;
        }
        .research-tab:hover,
        .research-tab:focus-visible {
          outline: none;
          background: rgba(59, 130, 246, 0.12);
          color: #0f172a;
        }
        .research-tab--active {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
        }
        .research-card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 22px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
          padding: 22px 32px 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .research-card header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .research-card header p {
          margin: 0px 0 0;
          color: rgba(15, 23, 42, 0.68);
          font-size: 12px;
          line-height: 1.6;
          max-width: 560px;
        }
        .research-card__body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .research-root {
          height: 100vh;
          box-sizing: border-box;
          padding-top: ${TOPBAR_HEIGHT}px;
          overflow: hidden;
        }
        .research-root .stage-layout__sidebar {
          height: calc(100vh - ${TOPBAR_HEIGHT}px);
          min-height: 0;
          overflow-y: auto;
          padding: 12px 0 24px;
          box-sizing: border-box;
        }
        .research-root .stage-layout__content {
          height: calc(100vh - ${TOPBAR_HEIGHT}px);
          padding: 18px 24px 48px;
        }
        .research-root .stage-shell {
          flex: 1;
          min-height: 0;
        }
        .research-root .research-card {
          flex: 1;
          height: 100%;
          min-height: 0;
        }
        .research-root .research-card__body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding-right: 6px;
        }
        .research-section-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
        }
        .research-section-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .research-section-helper {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          color: rgba(15, 23, 42, 0.6);
          letter-spacing: 0.01em;
        }
        .research-section-header p:not(.research-section-helper) {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.68);
          line-height: 1.55;
        }
        .research-goals {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding-top: 4px;
        }
        .research-goal-tile {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          padding: 20px 22px;
          border-radius: 18px;
          border: 1px solid rgba(30, 64, 175, 0.18);
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
          text-align: left;
          color: #0f172a;
          cursor: pointer;
          transition: border 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .research-goal-tile:hover,
        .research-goal-tile:focus-visible {
          border-color: rgba(59, 130, 246, 0.45);
          box-shadow: 0 22px 48px rgba(59, 130, 246, 0.18);
          transform: translateY(-2px);
          outline: none;
        }
        .research-goal-tile--active {
          border-color: rgba(59, 130, 246, 0.55);
          box-shadow: 0 26px 52px rgba(59, 130, 246, 0.22);
          transform: translateY(-2px);
          background: linear-gradient(155deg, rgba(59,130,246,0.18) 0%, rgba(255,255,255,0.95) 70%);
        }
        .research-goal-title {
          font-size: 16px;
          font-weight: 700;
        }
        .research-goal-copy {
          font-size: 13px;
          color: rgba(15, 23, 42, 0.65);
          line-height: 1.55;
        }
        .research-placeholder-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }
        .research-placeholder-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
        }
        .research-placeholder-tile {
          border-radius: 18px;
          border: 1px dashed rgba(148, 163, 184, 0.5);
          background: rgba(241, 245, 249, 0.65);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .research-placeholder-tile h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e3a8a;
        }
        .research-placeholder-tile p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
          line-height: 1.55;
        }
        .research-priorities {
          border-radius: 18px;
          padding: 0px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .research-priorities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .research-priority-chip {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(248, 250, 255, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.38);
          text-align: left;
          color: #0f172a;
          font-size: 13px;
          cursor: pointer;
          transition: border 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
        }
        .research-priority-chip:hover,
        .research-priority-chip:focus-visible {
          outline: none;
          border-color: rgba(59, 130, 246, 0.45);
          box-shadow: 0 14px 32px rgba(59, 130, 246, 0.16);
          transform: translateY(-1px);
        }
        .research-priority-chip--active {
          border-color: rgba(59, 130, 246, 0.55);
          background: linear-gradient(150deg, rgba(59,130,246,0.15) 0%, rgba(248, 250, 255, 0.95) 70%);
          box-shadow: 0 18px 40px rgba(59, 130, 246, 0.2);
        }
        .research-priority-label {
          font-weight: 700;
          font-size: 14px;
        }
        .research-priority-helper {
          color: rgba(15, 23, 42, 0.6);
          font-size: 12px;
          line-height: 1.5;
        }
        .research-sources-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 18px;
        }
        .research-source-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          border-radius: 20px;
          border: none;
          padding: 20px 16px;
          text-align: center;
          background: transparent;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
          color: inherit;
        }
        .research-source-card:hover,
        .research-source-card:focus-visible {
          outline: none;
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
          background: rgba(59, 130, 246, 0.08);
        }
        .research-source-card--active {
          box-shadow: 0 18px 40px rgba(59, 130, 246, 0.18);
          background: rgba(59, 130, 246, 0.12);
        }
        .research-source-logo {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.92);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          box-shadow: 0 14px 32px rgba(59, 130, 246, 0.24);
        }
        .research-source-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.4;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 24px 18px 52px;
          }
          .research-root .stage-layout__content {
            padding: 24px 18px 48px;
          }
          .research-card {
            padding: 28px;
          }
          .research-goals {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
          .research-priorities-grid {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
        }
        @media (max-width: 680px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: ${TOPBAR_HEIGHT}px;
            z-index: 20;
          }
          .stage-layout__content {
            padding: 16px 16px 48px;
          }
          .research-stage {
            --stage-topbar-offset: 0px;
          }
          .research-root {
            overflow: auto;
            --stage-topbar-offset: 0px;
          }
          .research-root .stage-layout__sidebar {
            height: auto;
            overflow-y: visible;
            padding: 12px 16px 0;
          }
          .research-root .stage-layout__content {
            height: auto;
            padding: 16px 16px 48px;
          }
          .research-sources-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
          .research-goals {
            grid-template-columns: 1fr;
          }
          .research-priorities-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  </div>
  );
}
