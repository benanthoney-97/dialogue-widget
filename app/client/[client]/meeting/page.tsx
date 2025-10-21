"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";

export default function MeetingPage() {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const pathname = usePathname();
  function getClientSlug(pathname: string | null): string {
    if (!pathname) return "";
    const match = pathname.match(/^\/client\/([^\/]+)/);
    return match ? match[1] : "";
  }
  const clientSlug = getClientSlug(pathname);
  type MeetingRow = {
    id: string;
    title: string;
    start_time: string;
    status?: string | null;
    materials_count?: number | null;
  };

  const now = new Date();
  const mockMeetings: MeetingRow[] = [
    {
      id: 'm-1',
      title: 'Pitch: Acme Corp — Q4 Research Brief',
      start_time: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(),
      status: 'Ready',
      materials_count: 3,
    },
    {
      id: 'm-2',
      title: 'Intro: Beta LLC — Project Scope',
      start_time: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      status: 'Pending',
      materials_count: 1,
    },
  ];

  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingRow[]>(mockMeetings);

  // --- Placeholder meeting detail data (replace with real fetch) ---
  const meetingTitle = "Pitch: Acme Corp — Q4 Research Brief";
  const meetingDateIso = new Date().toISOString();
  const meetingType = "Practice"; // e.g. Practice / Review / Client
  const sessionsCount = 12;
  const totalSeconds = 60 * 60 * 5 + 60 * 30; // 5h30m

  function formatDateIso(iso?: string) {
    if (!iso) return "-";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function formatDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // --- Scenarios and agent actions (left column) ---
  const scenarios = [
    { id: 's-intro', label: 'Intro' },
    { id: 's-pitch', label: 'Pitch' },
    { id: 's-qa', label: 'Q&A' },
    { id: 's-summary', label: 'Summary' },
  ];
  const [selectedScenario, setSelectedScenario] = useState<string>(scenarios[0].id);

  function handleRunAgent() {
    // placeholder: wire to agent execution later
    console.log('Run agent for scenario', selectedScenario);
  }

  function handleStartPractice() {
    console.log('Start practice session for', selectedScenario);
  }

  // --- Insights placeholders for right column ---
  type InsightItem = { id: string; label: string; score?: number };
  const strengths: InsightItem[] = [
    { id: 'st-1', label: 'Clear articulation of value prop', score: 0.92 },
    { id: 'st-2', label: 'Confident tone', score: 0.87 },
  ];
  const weaknesses: InsightItem[] = [
    { id: 'wk-1', label: 'Too much detail on pricing', score: 0.34 },
    { id: 'wk-2', label: 'Missing concise opening hook', score: 0.41 },
  ];
  const notCovered: InsightItem[] = [
    { id: 'nc-1', label: 'Competitive differentiation' },
    { id: 'nc-2', label: 'Next steps & timeline' },
  ];

  // --- Documents for this meeting (placeholder local state) ---
  type Doc = { id: string; title: string };
  const [docs, setDocs] = useState<Doc[]>([
    { id: 'd-1', title: 'Research Brief.pdf' },
    { id: 'd-2', title: 'Pricing Sheet.xlsx' },
  ]);

  function handleAddFiles(files?: FileList | null) {
    if (!files || files.length === 0) return;
    const newDocs: Doc[] = Array.from(files).map((f, i) => ({ id: `d-${Date.now()}-${i}`, title: f.name }));
    setDocs((s) => [...newDocs, ...s]);
  }

  return (
    <>
      <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
        <div style={{ width: 180, flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div style={{
          flex: 1,
          background: "#16213a",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
          padding: 40,
          fontFamily: "inherit",
          position: 'relative',
          minHeight: '100dvh',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button
              aria-label="Back to prepare"
              onClick={() => router.push(`/client/${clientSlug}/prepare`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: '#a3c0ff',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#e6eaff", fontFamily: "inherit", margin: 0 }}>{meetingTitle}</h2>
          </div>
          <div style={{ marginBottom: 12 }} />

          {/* Top summary section (compact single row): date | sessions + total | meeting type */}
          <div style={{ background: "#0f2036", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ color: '#a3c0ff', fontSize: 13 }}>{formatDateIso(meetingDateIso)}</div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div style={{ color: '#9fb3ff', fontSize: 13 }}>
                  <span style={{ color: '#e6eaff', fontWeight: 800, marginRight: 6 }}>{sessionsCount}</span>
                  sessions
                </div>
                <div style={{ color: '#9fb3ff', fontSize: 13 }}>
                  <span style={{ color: '#e6eaff', fontWeight: 800, marginRight: 6 }}>{formatDuration(totalSeconds)}</span>
                  total
                </div>
              </div>

              <div style={{ color: '#9fb3ff', fontWeight: 700, fontSize: 13, textAlign: 'right' }}>{meetingType}</div>
            </div>
          </div>

          {/* Middle section: two columns — left: scenarios + agent buttons; right: placeholder for now */}
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#0f2036', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9fb3ff', marginBottom: 8 }}>Scenario</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {scenarios.map((s) => {
                  const active = selectedScenario === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedScenario(s.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        background: active ? '#2b4f89' : 'transparent',
                        color: active ? '#fff' : '#9fb3ff',
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 8 }} />
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={handleRunAgent} style={{ padding: '10px 12px', borderRadius: 10, background: '#1f6bed', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' }}>Run agent</button>
                <button onClick={handleStartPractice} style={{ padding: '10px 12px', borderRadius: 10, background: '#22325a', color: '#9fb3ff', fontWeight: 700, border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>Start practice</button>
              </div>
            </div>
            <div style={{ background: '#0f2036', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Strengths */}
              <div style={{ background: '#071226', borderRadius: 10, padding: 12 }}>
                <div style={{ color: '#9fb3ff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Strengths</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {strengths.map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#e6eaff', fontWeight: 700 }}>{s.label}</div>
                      <div style={{ color: '#9fb3ff', fontSize: 13, fontWeight: 800 }}>{Math.round((s.score ?? 0) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div style={{ background: '#071226', borderRadius: 10, padding: 12 }}>
                <div style={{ color: '#9fb3ff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Weaknesses</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {weaknesses.map((w) => (
                    <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#e6eaff', fontWeight: 700 }}>{w.label}</div>
                      <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 800 }}>{Math.round((w.score ?? 0) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Not covered */}
              <div style={{ background: '#071226', borderRadius: 10, padding: 12 }}>
                <div style={{ color: '#9fb3ff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Not covered</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notCovered.map((n) => (
                    <div key={n.id} style={{ color: '#e6eaff', fontWeight: 700 }}>{n.label}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Meeting list/table removed per request */}

          {/* Documents section */}
          <div style={{ marginTop: 16 }} />
          <div style={{ background: '#0f2036', borderRadius: 12, padding: 10, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#9fb3ff', marginBottom: 8 }}>Documents</div>
            <div style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingBottom: 4 }}>
              {/* Add button as first item */}
              <div style={{ flex: '0 0 auto' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 120, height: 140, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.04)', color: '#9fb3ff', fontWeight: 800, cursor: 'pointer' }}>
                  + Add
                  <input type="file" multiple style={{ display: 'none' }} onChange={(e) => handleAddFiles(e.target.files)} />
                </label>
              </div>

              {docs.map((d) => (
                <div key={d.id} style={{ flex: '0 0 auto', width: 120, height: 140, borderRadius: 8, background: '#071226', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#e6eaff', fontWeight: 800, marginBottom: 6, fontSize: 13 }}>{d.title}</div>
                    <div style={{ color: '#9fb3ff', fontSize: 11 }}>Uploaded</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
  <style>{`
          @font-face {
            font-family: 'CooperBT';
            src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
        `}</style>
      </main>
    </>
  );
}
