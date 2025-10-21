"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";

export default function PreparePage() {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  // No local upload state on Prepare page


  const pathname = usePathname();
  // Get client slug from URL
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

  // Mock data for UI-first implementation. Replace with Supabase fetch later.
  const now = new Date();
  const mockMeetings: MeetingRow[] = [
    {
      id: 'm-1',
      title: 'Pitch: Acme Corp — Q4 Research Brief',
      start_time: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(), // +1 day
      status: 'Ready',
      materials_count: 3,
    },
    {
      id: 'm-2',
      title: 'Intro: Beta LLC — Project Scope',
      start_time: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3).toISOString(), // +3 days
      status: 'Pending',
      materials_count: 1,
    },
  ];

  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingRow[]>(mockMeetings);

  // Prepare page intentionally doesn't include upload controls.
  // Use the Upload page for file submission: `/client/${clientSlug}/upload`.

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
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>Your upcoming meetings</h2>
          <div style={{ marginBottom: 32 }} />
          <div style={{ background: "#0f2036", borderRadius: 12, padding: 16 }}>
            {loading ? (
              <div style={{ color: '#a3c0ff', padding: 20 }}>Loading meetings…</div>
            ) : meetings.length === 0 ? (
              <div style={{ color: '#a3c0ff', padding: 20 }}>No upcoming meetings. Use Upload to add documents or schedule a meeting.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <th style={{ padding: '12px 16px', color: '#9fb3ff', fontWeight: 700 }}>Meeting</th>
                      <th style={{ padding: '12px 16px', color: '#9fb3ff', fontWeight: 700 }}>Client</th>
                      <th style={{ padding: '12px 16px', color: '#9fb3ff', fontWeight: 700 }}>Date</th>
                      <th style={{ padding: '12px 16px', color: '#9fb3ff', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '12px 16px', color: '#9fb3ff', fontWeight: 700 }}>Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetings.map((m) => {
                      const dest = `/client/${clientSlug}/meeting`;
                      return (
                        <tr
                          key={m.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => router.push(dest)}
                          onKeyDown={(e) => { if (e.key === 'Enter') router.push(dest); }}
                          onMouseEnter={() => setHoveredRow(m.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          onFocus={() => setHoveredRow(m.id)}
                          onBlur={() => setHoveredRow(null)}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            background: hoveredRow === m.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '12px 16px', color: '#e6eaff', fontWeight: 700 }}>{m.title}</td>
                          <td style={{ padding: '12px 16px', color: '#a3c0ff' }}>{clientSlug}</td>
                          <td style={{ padding: '12px 16px', color: '#a3c0ff' }}>
                            {m.start_time
                              ? (() => {
                                  const d = new Date(m.start_time);
                                  const pad = (n: number) => String(n).padStart(2, '0');
                                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
                                    d.getHours()
                                  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                                })()
                              : '-'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: m.status === 'Ready' ? '#153d1f' : '#3a2b12', color: m.status === 'Ready' ? '#22c55e' : '#f59e0b', fontWeight: 700, fontSize: 13 }}>{m.status ?? 'Pending'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#a3c0ff' }}>{m.materials_count ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
