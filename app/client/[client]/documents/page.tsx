"use client";
import React, { useState, useEffect } from "react";
import { BriefMeButton } from "@/app/components/BriefMeButton";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "../Sidebar";

export default function DocumentsPage() {
  const [selectedTab, setSelectedTab] = useState<"documents" | "upload">("documents");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [testingByKey, setTestingByKey] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  // Get client slug from URL
  function getClientSlug(pathname: string | null): string {
    if (!pathname) return "";
    const match = pathname.match(/^\/client\/([^\/]+)/);
    return match ? match[1] : "";
  }
  const clientSlug = getClientSlug(pathname);

  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);
      setError(null);
      // Get client id from clients table
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientSlug)
        .single();
      if (clientError || !client) {
        setError("Client not found");
        setLoading(false);
        return;
      }
      // Get agent_map rows for this client (include testing_mode)
      const { data: agentRows, error: agentError } = await supabase
        .from('agent_map')
        .select('agent_id, agent_name, content_type, created_at, status, dialogue_created_date, key, testing_mode')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (agentError) {
        setError("Error fetching documents");
        setLoading(false);
        return;
      }
      setDocs(agentRows || []);
  // initialize testing state from DB (testing_mode) for rows
  const init: Record<string, boolean> = {};
  (agentRows || []).forEach((r: any) => { init[r.key] = !!r.testing_mode; });
  setTestingByKey(init);
      setLoading(false);
    }
    if (clientSlug) fetchDocs();
  }, [clientSlug]);

  return (
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
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>Documents</h2>
        <div style={{ marginBottom: 32 }} />
        <div style={{ overflowX: "auto", width: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, background: "#16213a" }}>
            <thead>
              <tr style={{ background: "#1b2947" }}>
                <th style={thStyle}>Document</th>
                <th style={thStyle}>Content Type</th>
                <th style={thStyle}>Upload Date</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Dialogue Created Date</th>
                <th style={thStyle}>Test</th>
                <th style={{ ...thStyle, width: 24, minWidth: 18, maxWidth: 28, textAlign: 'center', padding: 0 }}></th>
                <th style={thStyle}>Mode</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ color: '#a3c0ff', textAlign: 'center', padding: 24 }}>Loading…</td></tr>
              ) : error ? (
                <tr><td colSpan={8} style={{ color: '#ef4444', textAlign: 'center', padding: 24 }}>{error}</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={8} style={{ color: '#a3c0ff', textAlign: 'center', padding: 24 }}>No documents found.</td></tr>
              ) : (
                docs.map((row, i) => (
                  <tr key={i} style={{ background: "#16213a", borderBottom: '1px solid #22325a' }}>
                    <td style={tdStyle}>
                      <div style={{
                        maxWidth: 300,
                        whiteSpace: 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                        paddingLeft: 6,
                        paddingRight: 0,
                      }}>{row.agent_name}</div>
                    </td>
                    <td style={tdStyle}>{row.content_type}</td>
                    <td style={tdStyle}>
                      {row.created_at
                        ? (() => {
                            const d = new Date(row.created_at);
                            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
                              ' ' +
                              d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                          })()
                        : '-'}
                    </td>
                    <td style={{ ...tdStyle, color: row.status === 'Ready' ? '#7ee67e' : row.status === 'Building' ? '#e6e67e' : '#a3c0ff', fontWeight: 700 }}>{row.status}</td>
                    <td style={tdStyle}>
                      {row.dialogue_created_date
                        ? (() => {
                            const d = new Date(row.dialogue_created_date);
                            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
                              ' ' +
                              d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                          })()
                        : '-'}
                    </td>
                    <td style={tdStyle}>
                      <button
                        style={{
                          ...buttonStyle,
                          background: row.status === 'Ready' ? '#525fe1' : '#22325a',
                          color: row.status === 'Ready' ? '#fff' : '#a3c0ff',
                          opacity: row.status === 'Ready' ? 1 : 0.5,
                          cursor: row.status === 'Ready' ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          pointerEvents: row.status === 'Ready' ? 'auto' : 'none',
                        }}
                        disabled={row.status !== 'Ready'}
                        onClick={() => {
                          if (row && row.key && row.status === 'Ready') {
                            window.open(`https://embed.dialogue-ai.co/doc/${row.key}`, '_blank');
                          }
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                            <rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
                            <rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
                            <rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
                          </svg>
                        </span>
                        Test
                      </button>
                    </td>
                    <td style={{
                      width: 110,
                      minWidth: 90,
                      maxWidth: 140,
                      textAlign: 'center',
                      padding: 0,
                      background: '#16213a',
                    }}>
                      <button
                        type="button"
                        aria-label="Copy document link"
                        title="Copy document link"
                        style={{
                          ...buttonStyle,
                          background: row.status === 'Ready' ? '#525fe1' : '#22325a',
                          color: row.status === 'Ready' ? '#fff' : '#a3c0ff',
                          opacity: row.status === 'Ready' ? 1 : 0.5,
                          cursor: row.status === 'Ready' ? 'pointer' : 'not-allowed',
                          pointerEvents: row.status === 'Ready' ? 'auto' : 'none',
                          minWidth: 0,
                          width: '100%',
                          padding: '7px 16px',
                          margin: 0,
                          fontSize: 14,
                        }}
                        disabled={row.status !== 'Ready'}
                        onClick={async () => {
                          if (row && row.key && row.status === 'Ready') {
                            const url = `https://embed.dialogue-ai.co/doc/${row.key}`;
                            try {
                              await navigator.clipboard.writeText(url);
                            } catch {
                              // fallback for older browsers
                              const textarea = document.createElement('textarea');
                              textarea.value = url;
                              document.body.appendChild(textarea);
                              textarea.select();
                              document.execCommand('copy');
                              document.body.removeChild(textarea);
                            }
                            setCopiedIdx(i);
                            setTimeout(() => {
                              setCopiedIdx((prev) => (prev === i ? null : prev));
                            }, 2000);
                          }
                        }}
                      >
                        {copiedIdx === i ? 'Copied' : 'Share'}
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden', border: '1px solid #22325a' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            // optimistic: set testing true
                            setTestingByKey((prev) => ({ ...prev, [row.key]: true }));
                            try {
                              const { error } = await supabase
                                .from('agent_map')
                                .update({ testing_mode: true })
                                .eq('key', row.key);
                              if (error) {
                                console.warn('Failed to update testing_mode', error);
                                setTestingByKey((prev) => ({ ...prev, [row.key]: false }));
                              }
                            } catch (e) {
                              console.warn('Failed to update testing_mode', e);
                              setTestingByKey((prev) => ({ ...prev, [row.key]: false }));
                            }
                          }}
                          style={{
                            padding: '0 10px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: testingByKey[row.key] ? '#f97316' : '#22325a',
                            color: testingByKey[row.key] ? '#fff' : '#a3c0ff',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          Testing
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            // optimistic: set testing false
                            setTestingByKey((prev) => ({ ...prev, [row.key]: false }));
                            try {
                              const { error } = await supabase
                                .from('agent_map')
                                .update({ testing_mode: false })
                                .eq('key', row.key);
                              if (error) {
                                console.warn('Failed to update testing_mode', error);
                                setTestingByKey((prev) => ({ ...prev, [row.key]: true }));
                              }
                            } catch (e) {
                              console.warn('Failed to update testing_mode', e);
                              setTestingByKey((prev) => ({ ...prev, [row.key]: true }));
                            }
                          }}
                          style={{
                            padding: '0 10px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: !testingByKey[row.key] ? '#525fe1' : '#22325a',
                            color: !testingByKey[row.key] ? '#fff' : '#a3c0ff',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          Live
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
  );
}

const thStyle = {
  textAlign: "left" as const,
  padding: "10px 8px",
  color: "#a3c0ff",
  fontSize: 13,
  fontWeight: 700,
  borderBottom: "1px solid #22325a",
  background: "#1b2947",
  position: "sticky" as const,
  top: 0,
  zIndex: 1,
};

const tdStyle = {
  padding: "10px 8px",
  borderBottom: "none",
  color: "#e6eaff",
  background: "#16213a",
  fontSize: 15,
  verticalAlign: 'middle' as const,
};

const buttonStyle = {
  padding: "7px 16px",
  borderRadius: 8,
  border: "1px solid #2d406b",
  background: "#22325a",
  color: "#a3c0ff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "background 0.18s, border 0.18s, color 0.18s",
  boxShadow: "0 2px 8px rgba(10,22,40,0.13)",
};
