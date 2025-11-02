"use client";
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "../Sidebar";
import PurposeCard, { defaultChipStyleMap } from "../../../components/PurposeCard";
import PrepAgent from "../../../components/PrepAgent";
import ProgressAgent from "../../../components/ProgressAgent";

const GUIDANCE_AUDIENCE_MAP: Record<string, string> = {
  Prepare: "Personal",
  Learn: "Personal",
  Review: "Team",
  "Go-to-market": "Client",
};

type AgentDocumentRow = {
  id: string;
  agent_id: string;
  file_name: string;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  source: string | null;
  created_at: string;
  added_stage?: string | null;
};

const PURPOSE_GUIDANCE_TEXTS: Record<string, string> = {
  Prepare: "I want to prepare for a presentation, seminar or meeting using the documents in your knowledge base.",
  Learn: "I want to learn in-depth about the topics discussed in the documents in your knowledge base.",
  Review: "I'm reviewing the document(s) in your knowledge base for a teammate, in order to provide them with detailed feedback, and would like your assistance.",
  "Go-to-market": "I'm a client of the author of the documents in your knowledge base and would like to analyse these materials with your assistance.",
};

function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value < 10 && exponent > 0 ? value.toFixed(1) : Math.round(value)} ${units[exponent]}`;
}

function buildPublicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/docs/${encodedPath}`;
}

export default function DocumentsPage() {
  const [selectedTab, setSelectedTab] = useState<"documents" | "upload">("documents");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailsExpandedKey, setDetailsExpandedKey] = useState<string | null>(null);
  const [progressExpandedKey, setProgressExpandedKey] = useState<string | null>(null);
  const [agentDocuments, setAgentDocuments] = useState<Record<
    string,
    { loading: boolean; docs: AgentDocumentRow[]; error: string | null }
  >>({});
  const [agentDocumentDrafts, setAgentDocumentDrafts] = useState<Record<
    string,
    { file: File | null; saving: boolean; error: string | null }
  >>({});
  const [confirmingDoc, setConfirmingDoc] = useState<null | { agentId: string; doc: AgentDocumentRow }>(null);
  const [deletingDoc, setDeletingDoc] = useState<boolean>(false);
  const [docDeleteError, setDocDeleteError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [purposeText, setPurposeText] = useState<string>("");
  const [selectedGuidance, setSelectedGuidance] = useState<string | null>(null);
  const [savedPurpose, setSavedPurpose] = useState<string | null>(null);
  const [audienceType, setAudienceType] = useState<string>("Custom");
  const [purposeSubmitting, setPurposeSubmitting] = useState<boolean>(false);
  const guidanceTexts = PURPOSE_GUIDANCE_TEXTS;
  const chipStyleMap = defaultChipStyleMap;

  // Get profile slug from URL
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
      // Get profile id from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', clientSlug)
        .single();
      if (profileError || !profile) {
        setError("Profile not found");
        setLoading(false);
        return;
      }
      // Get agent_map rows for this profile/user
      const { data: agentRows, error: agentError } = await supabase
        .from('agent_map')
        .select('agent_id, agent_name, content_type, audience_type, created_at, status, dialogue_created_date, key')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (agentError) {
        setError("Error fetching documents");
        setLoading(false);
        return;
      }
  // debug: log fetched data (use console.log so messages are visible in browser consoles)
   
  console.log('DocumentsPage.fetchDocs', { clientSlug, profile: profile ?? null, agentRows: agentRows ?? [] });
      setDocs(agentRows || []);
   
  console.log('DocumentsPage.setDocs count', (agentRows || []).length);
      setLoading(false);
    }
    if (clientSlug) fetchDocs();
  }, [clientSlug]);

  useEffect(() => {
    setDocDeleteError(null);
    setDeletingDoc(false);
  }, [confirmingDoc]);

  // Debug: log when docs/loading/error change
  useEffect(() => {
     
    console.log('DocumentsPage.state', { clientSlug, docsLength: docs.length, loading, error });
  }, [clientSlug, docs.length, loading, error]);

  const ensureAgentDocuments = async (agentId: string) => {
    setAgentDocuments((prev) => ({
      ...prev,
      [agentId]: {
        docs: prev[agentId]?.docs ?? [],
        loading: true,
        error: null,
      },
    }));
    const { data, error: docsError } = await supabase
      .from('agent_documents')
      .select('id, agent_id, file_name, storage_path, public_url, mime_type, file_size, source, created_at, added_stage')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    setAgentDocuments((prev) => ({
      ...prev,
      [agentId]: {
        docs: (data as AgentDocumentRow[]) ?? [],
        loading: false,
        error: docsError ? docsError.message : null,
      },
    }));
  };

  const handleProgressToggle = (row: any) => {
    if (!row || !row.key) return;
    const rowKey = row.key as string;
    setExpandedKey(null);
    if (progressExpandedKey === rowKey) {
      setProgressExpandedKey(null);
      return;
    }
    setProgressExpandedKey(rowKey);
    setDetailsExpandedKey(null);
  };

  const handleRowToggle = (row: any) => {
    if (!row || !row.key) return;
    const rowKey = row.key as string;
    const agentId = typeof row.agent_id === 'string' ? row.agent_id : null;
    if (expandedKey === rowKey) {
      setExpandedKey(null);
      setProgressExpandedKey((prev) => (prev === rowKey ? null : prev));
      return;
    }
    setExpandedKey(rowKey);
    setDetailsExpandedKey(null);
    setProgressExpandedKey(null);
    if (agentId) {
      const cached = agentDocuments[agentId];
      if (!cached || (!cached.loading && (cached.docs.length === 0 || cached.error))) {
        void ensureAgentDocuments(agentId);
      }
    }
  };

  const handleDetailsToggle = (row: any) => {
    if (!row || !row.key) return;
    const rowKey = row.key as string;
    setExpandedKey(null);
    setProgressExpandedKey(null);
    if (detailsExpandedKey === rowKey) {
      setDetailsExpandedKey(null);
      return;
    }
    setDetailsExpandedKey(rowKey);
  };

  const handleDocumentFileInputChange = (agentId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setAgentDocumentDrafts((prev) => ({
      ...prev,
      [agentId]: {
        file,
        saving: false,
        error: null,
      },
    }));
  };

  const handleDocumentDraftClear = (agentId: string) => {
    setAgentDocumentDrafts((prev) => {
      const { [agentId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSaveDocument = async (agentId: string) => {
    const draft = agentDocumentDrafts[agentId];
    if (!draft?.file || draft.saving) return;
    if (!clientSlug) {
      setAgentDocumentDrafts((prev) => ({
        ...prev,
        [agentId]: { ...draft, saving: false, error: "Missing client context" },
      }));
      return;
    }

    setAgentDocumentDrafts((prev) => ({
      ...prev,
      [agentId]: { ...draft, saving: true, error: null },
    }));

    try {
      const file = draft.file;
      const uniqueName = `${uuidv4()}-${file.name}`;
      const storagePath = `clients/${clientSlug}/${agentId}/${uniqueName}`;
      const { error: uploadError } = await supabase.storage.from('docs').upload(storagePath, file, { upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = await supabase.storage.from('docs').getPublicUrl(storagePath);
      const publicUrl =
        (publicUrlData as any)?.publicUrl ??
        (publicUrlData as any)?.publicURL ??
        buildPublicUrl(storagePath);

      const { data: insertedDoc, error: insertError } = await supabase
        .from('agent_documents')
        .insert({
          agent_id: agentId,
          file_name: file.name,
          storage_path: storagePath,
          public_url: publicUrl,
          mime_type: file.type || null,
          file_size: file.size,
          source: 'storage',
          added_stage: 'seed',
        })
        .select()
        .single();
      if (insertError) throw new Error(insertError.message);

      setAgentDocuments((prev) => {
        const prevEntry = prev[agentId] ?? { docs: [], loading: false, error: null };
        return {
          ...prev,
          [agentId]: {
            docs: insertedDoc ? [insertedDoc as AgentDocumentRow, ...prevEntry.docs] : prevEntry.docs,
            loading: false,
            error: null,
          },
        };
      });

      setAgentDocumentDrafts((prev) => {
        const { [agentId]: _removed, ...rest } = prev;
        return rest;
      });
    } catch (e: any) {
      setAgentDocumentDrafts((prev) => ({
        ...prev,
        [agentId]: {
          file: prev[agentId]?.file ?? draft.file,
          saving: false,
          error: e?.message ?? "Failed to upload document",
        },
      }));
    }
  };

  const rowPendingDelete = confirmingKey ? docs.find((doc) => doc.key === confirmingKey) : null;
  const purposeNextDisabled = purposeSubmitting || (!selectedGuidance && !purposeText.trim());

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
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>Dialogues</h2>
        <div style={{ marginBottom: 32 }} />
        <div style={{ overflowX: "auto", width: "100%" }}>
          {loading || error || docs.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15, background: "#16213a" }}>
              <thead>
                <tr style={{ background: "#F6F7F9fff" }}>
                  <th style={thStyle}>Dialogue</th>
                  <th style={thStyle}>Audience</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Last Updated</th>
                  <th style={thStyle}>Prepare</th>
                  <th style={thStyle}>Progress</th>
                  <th style={{ ...thStyle, width: 24, minWidth: 18, maxWidth: 28, textAlign: 'center', padding: 0 }}></th>
                  <th style={{ ...thStyle, width: 24, minWidth: 18, maxWidth: 28, textAlign: 'center', padding: 0 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ color: '#a3c0ff', textAlign: 'center', padding: 24 }}>Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} style={{ color: '#ef4444', textAlign: 'center', padding: 24 }}>{error}</td></tr>
                ) : (
                  docs.map((row, i) => {
                  const rowKey = row?.key ?? String(i);
                  const isExpanded = expandedKey === rowKey;
                  const agentId = typeof row.agent_id === 'string' ? row.agent_id : null;
                  const docState = agentId ? agentDocuments[agentId] : undefined;
                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={() => handleDetailsToggle(row)}
                        aria-expanded={isExpanded}
                        style={{
                          background: isExpanded ? "#1c2744" : "#16213a",
                          borderBottom: '1px solid #22325a',
                          cursor: 'pointer',
                          transition: 'background 0.18s ease',
                        }}
                      >
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
                          }}>
                            {row.agent_name}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {row.audience_type ? (
                            (() => {
                              const chip = chipStyleMap[row.audience_type] ?? chipStyleMap.Placeholder;
                              return (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 10px',
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: chip.bg,
                                    color: chip.color,
                                    border: chip.border,
                                    minHeight: 22,
                                  }}
                                >
                                  {row.audience_type}
                                </span>
                              );
                            })()
                          ) : (
                            '-'
                          )}
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
                              color: row.status === 'Ready' ? '#F6F7F9' : '#a3c0ff',
                              opacity: row.status === 'Ready' ? 1 : 0.5,
                              cursor: row.status === 'Ready' ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              pointerEvents: row.status === 'Ready' ? 'auto' : 'none',
                            }}
                            disabled={row.status !== 'Ready'}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!row || row.status !== 'Ready') return;
                              handleDetailsToggle(row);
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                                <rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
                                <rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
                                <rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
                              </svg>
                            </span>
                            Start Prep
                          </button>
                        </td>
                        <td style={tdStyle}>
                          <button
                            style={{
                              ...buttonStyle,
                              background: row.status === 'Ready' ? '#525fe1' : '#22325a',
                              color: row.status === 'Ready' ? '#F6F7F9' : '#a3c0ff',
                              opacity: row.status === 'Ready' ? 1 : 0.5,
                              cursor: row.status === 'Ready' ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              pointerEvents: row.status === 'Ready' ? 'auto' : 'none',
                            }}
                            disabled={row.status !== 'Ready'}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!row || row.status !== 'Ready') return;
                              handleProgressToggle(row);
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                                <rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
                                <rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
                                <rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
                              </svg>
                            </span>
                            View Progress
                          </button>
                        </td>
                        <td style={{
                          width: 80,
                          minWidth: 64,
                          maxWidth: 100,
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
                              background: 'transparent',
                              border: 'none',
                              boxShadow: 'none',
                              color: row.status === 'Ready' ? '#7ea0e6' : '#6681bd',
                              opacity: row.status === 'Ready' ? 1 : 0.45,
                              cursor: row.status === 'Ready' ? 'pointer' : 'not-allowed',
                              pointerEvents: row.status === 'Ready' ? 'auto' : 'none',
                              minWidth: 0,
                              width: 'auto',
                              padding: '6px',
                              margin: 0,
                              fontSize: 14,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              height: 32,
                            }}
                            disabled={row.status !== 'Ready'}
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (row && row.key && row.status === 'Ready') {
                                const url = `https://embed.dialogue-ai.co/doc/${row.key}`;
                                try {
                                  await navigator.clipboard.writeText(url);
                                } catch {
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
                            <div style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                                style={{ opacity: copiedIdx === i ? 0 : 1, transition: 'opacity 120ms ease' }}
                              >
                                <path
                                  d="M13.3333 3.33333H16.6666C17.5871 3.33333 18.3333 4.07955 18.3333 5V8.33333"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10.8333 9.16667L16.6666 3.33334"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M16.6666 11.6667V15C16.6666 15.9205 15.9204 16.6667 15 16.6667H5.00002C4.07956 16.6667 3.33335 15.9205 3.33335 15V5.00001C3.33335 4.07955 4.07956 3.33334 5.00002 3.33334H8.33335"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                                style={{ position: 'absolute', inset: 0, opacity: copiedIdx === i ? 1 : 0, transition: 'opacity 120ms ease' }}
                              >
                                <path
                                  d="M4.16669 10.4167L7.50002 13.75L15.8334 5.41669"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <span style={{ position: 'absolute', clip: 'rect(0 0 0 0)', width: 1, height: 1, margin: -1, border: 0, padding: 0, overflow: 'hidden' }}>
                              {copiedIdx === i ? 'Copied' : 'Share'}
                            </span>
                          </button>
                        </td>
                        <td style={{ ...tdStyle, padding: '0 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            aria-label="Delete dialogue"
                            title="Delete dialogue"
                            disabled={deletingKey === row.key}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!row.key) return;
                              handleRowToggle(row);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: deletingKey === row.key ? '#ef4444' : '#7ea0e6',
                              cursor: deletingKey === row.key ? 'wait' : 'pointer',
                              padding: 6,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 20 20"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <circle cx="4" cy="10" r="1.4" fill="currentColor" />
                              <circle cx="10" cy="10" r="1.4" fill="currentColor" />
                              <circle cx="16" cy="10" r="1.4" fill="currentColor" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: 'transparent', borderBottom: 'none' }}>
                          <div
                            style={{
                              maxHeight: isExpanded ? 640 : 0,
                              opacity: isExpanded ? 1 : 0,
                              overflow: 'hidden',
                              transition: 'max-height 220ms ease, opacity 220ms ease',
                            }}
                          >
                            <div style={{ padding: '18px 28px 24px 28px', background: "#10192b", borderBottom: '1px solid #22325a' }}>
                              {!agentId ? (
                                <div style={{ color: '#a3c0ff' }}>No agent identifier available for this dialogue.</div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ color: '#7ea0e6', fontSize: 14, fontWeight: 600 }}>Documents & uploads</div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!row.key || deletingKey === row.key) return;
                                        setConfirmingKey(row.key);
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #c24141',
                                        background: '#2a1a1a',
                                        color: '#f9b4b4',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        letterSpacing: 0.4,
                                        cursor: deletingKey === row.key ? 'wait' : 'pointer',
                                        opacity: deletingKey === row.key ? 0.7 : 1,
                                      }}
                                      disabled={deletingKey === row.key}
                                    >
                                      Delete pitch
                                    </button>
                                  </div>
                                  {docState?.error && (
                                    <div style={{ color: '#ef4444', marginBottom: 12 }}>Failed to load documents: {docState.error}</div>
                                  )}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                                    {(() => {
                                      const draft = agentDocumentDrafts[agentId] ?? { file: null, saving: false, error: null };
                                      const uploadInputId = `doc-upload-${agentId}`;
                                    const draftHasFile = !!draft.file;
                                    const triggerFilePicker = () => {
                                      if (typeof document === "undefined") return;
                                      const input = document.getElementById(uploadInputId) as HTMLInputElement | null;
                                      input?.click();
                                    };
                                    return (
                                      <div
                                        key="upload-card"
                                        style={{
                                          flex: '0 0 160px',
                                          width: 160,
                                          height: 190,
                                          borderRadius: 12,
                                          border: '1px dashed #2d406b',
                                          background: '#111d35',
                                          boxShadow: '0 4px 14px rgba(10,22,40,0.16)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: draftHasFile ? 'flex-start' : 'center',
                                          padding: '16px 14px',
                                          cursor: draft.saving ? 'wait' : 'pointer',
                                          position: 'relative',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (draft.saving) return;
                                          if (!draftHasFile) {
                                            triggerFilePicker();
                                          }
                                        }}
                                      >
                                        <input
                                          id={uploadInputId}
                                          type="file"
                                          accept=".pdf,.docx,.txt,.html"
                                          style={{ display: 'none' }}
                                          onChange={(event) => handleDocumentFileInputChange(agentId, event)}
                                        />
                                        {!draftHasFile ? (
                                          <>
                                            <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #2d406b', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                                              <span style={{ fontSize: 24, color: '#7ea0e6', lineHeight: 1 }}>+</span>
                                            </div>
                                            <div style={{ color: '#e6eaff', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>Add document</div>
                                            <div style={{ marginTop: 6, fontSize: 12, color: '#7ea0e6', textAlign: 'center' }}>PDF, DOCX, TXT, HTML</div>
                                          </>
                                        ) : (
                                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                                            <div style={{ fontWeight: 700, color: '#e6eaff', fontSize: 14, lineHeight: 1.3, maxHeight: 40, overflow: 'hidden', wordBreak: 'break-word', textAlign: 'center' }}>
                                              {draft.file?.name}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#7ea0e6', textAlign: 'center' }}>
                                              {formatBytes(draft.file?.size)} · {draft.file?.type || 'Unknown type'}
                                            </div>
                                            {draft.error && (
                                              <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{draft.error}</div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleSaveDocument(agentId);
                                                }}
                                                disabled={draft.saving}
                                                style={{
                                                  padding: '7px 10px',
                                                  borderRadius: 8,
                                                  border: '1px solid #2d406b',
                                                  background: draft.saving ? '#374771' : '#2d406b',
                                                  color: '#F6F7F9fff',
                                                  fontWeight: 700,
                                                  fontSize: 13,
                                                  cursor: draft.saving ? 'wait' : 'pointer',
                                                }}
                                              >
                                                {draft.saving ? 'Saving…' : 'Save'}
                                              </button>
                                              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!draft.saving) {
                                                      triggerFilePicker();
                                                    }
                                                  }}
                                                  disabled={draft.saving}
                                                  style={{
                                                    flex: 1,
                                                    padding: '6px 8px',
                                                    borderRadius: 7,
                                                    border: '1px solid #2d406b',
                                                    background: '#192447',
                                                    color: '#a3c0ff',
                                                    fontSize: 12,
                                                    cursor: draft.saving ? 'not-allowed' : 'pointer',
                                                  }}
                                                >
                                                  Change
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!draft.saving) {
                                                      handleDocumentDraftClear(agentId);
                                                    }
                                                  }}
                                                  disabled={draft.saving}
                                                  style={{
                                                    flex: 1,
                                                    padding: '6px 8px',
                                                    borderRadius: 7,
                                                    border: '1px solid #40234b',
                                                    background: '#2b1637',
                                                    color: '#fda4af',
                                                    fontSize: 12,
                                                    cursor: draft.saving ? 'not-allowed' : 'pointer',
                                                  }}
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {(docState?.docs ?? []).map((doc) => (
                                    <div
                                      key={doc.id}
                                      style={{
                                        flex: '0 0 160px',
                                        width: 160,
                                        height: 190,
                                        borderRadius: 12,
                                        background: '#0f1a33',
                                        border: '1px solid #22325a',
                                        padding: '16px 14px',
                                        boxShadow: '0 4px 18px rgba(10,22,40,0.18)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        position: 'relative',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!agentId) return;
                                          setConfirmingDoc({ agentId, doc });
                                        }}
                                        aria-label="Delete document"
                                        title="Delete document"
                                        style={{
                                          position: 'absolute',
                                          top: 8,
                                          right: 8,
                                          width: 24,
                                          height: 24,
                                          borderRadius: 999,
                                          border: '1px solid #2d406b',
                                          background: 'rgba(15,26,51,0.85)',
                                          color: '#a3c0ff',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 13,
                                          boxShadow: '0 4px 12px rgba(10,22,40,0.18)',
                                        }}
                                      >
                                        ×
                                      </button>
                                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                                        <svg width="38" height="38" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <rect x="10" y="6" width="34" height="42" rx="5" fill="#22325a" stroke="#7ea0e6" strokeWidth="2.2"/>
                                          <rect x="17" y="16" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                                          <rect x="17" y="25" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                                          <rect x="17" y="34" width="12" height="3" rx="1.5" fill="#7ea0e6"/>
                                        </svg>
                                      </div>
                                      <div style={{ fontWeight: 700, color: '#e6eaff', fontSize: 14, lineHeight: 1.3, maxHeight: 38, overflow: 'hidden', wordBreak: 'break-word', textAlign: 'center' }}>
                                        {doc.file_name || 'Document'}
                                      </div>
                                      <div style={{ marginTop: 8, fontSize: 12, color: '#7ea0e6', textAlign: 'center' }}>
                                        {formatBytes(doc.file_size)} · {doc.mime_type ?? 'Unknown type'}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#a3c0ff', marginTop: 6, textAlign: 'center' }}>
                                        {doc.created_at
                                          ? `Added ${new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                                          : 'Added —'}
                                      </div>
                                      {doc.source && (
                                        <div style={{ marginTop: 6, fontSize: 11, color: '#9fb3ff', textAlign: 'center' }}>
                                          Source: {doc.source}
                                        </div>
                                      )}
                                      {doc.public_url ? (
                                        <a
                                          href={doc.public_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            marginTop: 12,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            color: '#7ea0e6',
                                            fontWeight: 600,
                                            fontSize: 13,
                                            textDecoration: 'none',
                                            padding: '6px 10px',
                                            borderRadius: 8,
                                            border: '1px solid #2d406b',
                                            background: '#1d2a4b',
                                          }}
                                        >
                                          Open file
                                        </a>
                                      ) : doc.storage_path ? (
                                        <div style={{ marginTop: 12, fontSize: 11, color: '#a3c0ff', wordBreak: 'break-all', textAlign: 'center' }}>
                                          {doc.storage_path}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                  {(!docState?.loading && (docState?.docs ?? []).length === 0) && (
                                    <div style={{ color: '#a3c0ff', alignSelf: 'center', padding: 18 }}>No documents are stored for this dialogue yet.</div>
                                  )}
                                </div>
                                {docState?.loading && (
                                  <div style={{ marginTop: 14, color: '#a3c0ff' }}>Loading associated documents…</div>
                                )}
                              </>
                            )}
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: 'transparent', borderBottom: 'none' }}>
                          <div
                            style={{
                              maxHeight: detailsExpandedKey === rowKey ? 360 : 0,
                              opacity: detailsExpandedKey === rowKey ? 1 : 0,
                              overflow: 'hidden',
                              transition: 'max-height 220ms ease, opacity 220ms ease',
                            }}
                          >
                            <div style={{ padding: '16px 28px 22px 28px', background: '#0f1628', borderBottom: '1px solid #22325a', color: '#a3c0ff', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.2 }}>Pitch preparation</div>
                              <PrepAgent
                                agentId={typeof row.agent_id === 'string' ? row.agent_id : undefined}
                                talkLabel="Start pitch"
                                panelExpanded={detailsExpandedKey === rowKey}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: 'transparent', borderBottom: 'none' }}>
                          <div
                            style={{
                              maxHeight: progressExpandedKey === rowKey ? 640 : 0,
                              opacity: progressExpandedKey === rowKey ? 1 : 0,
                              overflow: 'hidden',
                              transition: 'max-height 220ms ease, opacity 220ms ease',
                            }}
                          >
                            <div style={{ padding: '16px 28px 22px 28px', background: '#0f1628', borderBottom: '1px solid #22325a', color: '#a3c0ff', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1.2 }}>Dialogue progress</div>
                              <ProgressAgent
                                agentId={typeof row.agent_id === 'string' ? row.agent_id : undefined}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )
            }
            </tbody>
          </table>
          ) : (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 'min(640px, 100%)', background: '#192447', borderRadius: 18, boxShadow: '0 4px 24px rgba(10,22,40,0.18)', padding: '24px 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PurposeCard
                  guidanceTexts={guidanceTexts}
                  selectedGuidance={selectedGuidance}
                  purposeText={purposeText}
                  headingText="Create your first Dialogue"
                  onSelectGuidance={(key, purpose, audience) => {
                    setSelectedGuidance(key);
                    setSavedPurpose(purpose);
                    setAudienceType(audience ?? GUIDANCE_AUDIENCE_MAP[key] ?? "Custom");
                  }}
                  onCustomFocus={() => {
                    setSelectedGuidance(null);
                    setSavedPurpose(null);
                    setAudienceType("Custom");
                  }}
                  onPurposeChange={(value) => {
                    setPurposeText(value);
                  }}
                  onNext={async () => {
                    if (!clientSlug || purposeSubmitting) return;
                    setPurposeSubmitting(true);
                    const trimmedPurpose = purposeText.trim();
                    const resolvedPurpose = selectedGuidance && guidanceTexts[selectedGuidance]
                      ? guidanceTexts[selectedGuidance]
                      : savedPurpose ?? trimmedPurpose;
                    const payload = {
                      selectedGuidance,
                      purposeText: trimmedPurpose,
                      savedPurpose: resolvedPurpose || trimmedPurpose,
                      audienceType,
                    };
                    const params = new URLSearchParams();
                    params.set("stage", "upload");
                    params.set("purpose", JSON.stringify(payload));
                    router.push(`/client/${clientSlug}/upload?${params.toString()}`);
                  }}
                  nextDisabled={purposeNextDisabled || !clientSlug}
                  saving={purposeSubmitting}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {confirmingKey && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.72)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#142038',
              borderRadius: 16,
              padding: '24px 28px',
              width: 'min(360px, 90vw)',
              boxShadow: '0 14px 60px rgba(10,22,40,0.38)',
              border: '1px solid #22325a',
              color: '#e6eaff',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Delete dialogue?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: '#a3c0ff', lineHeight: 1.5 }}>
              {rowPendingDelete
                ? `This will permanently remove “${rowPendingDelete.agent_name ?? rowPendingDelete.key}” and its dialogue configuration.`
                : 'This will permanently remove the selected dialogue.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  if (deletingKey) return;
                  setConfirmingKey(null);
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #2d406b',
                  background: '#1c2b4a',
                  color: '#a3c0ff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const keyToDelete = confirmingKey;
                  const agentIdToDelete = rowPendingDelete?.agent_id;
                  if (!keyToDelete || deletingKey) return;
                  setDeletingKey(keyToDelete);
                  try {
                    let documentIds: string[] = [];
                    if (agentIdToDelete) {
                      const { data: docRows, error: docFetchError } = await supabase
                        .from('agent_documents')
                        .select('id')
                        .eq('agent_id', agentIdToDelete);
                      if (docFetchError) {
                        throw new Error(docFetchError.message);
                      }
                      documentIds = (docRows ?? []).map((doc: any) => doc?.id).filter((id: any): id is string => typeof id === 'string' && id.length > 0);

                      const res = await fetch('/api/eleven/delete-agent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agentId: agentIdToDelete, documentIds }),
                      });
                      if (!res.ok) {
                        const body = await res.json().catch(() => null);
                        throw new Error(body?.error ?? `Failed to delete ElevenLabs resources (${res.status})`);
                      }

                      const { error: docsDeleteError } = await supabase
                        .from('agent_documents')
                        .delete()
                        .eq('agent_id', agentIdToDelete);
                      if (docsDeleteError) {
                        throw new Error(docsDeleteError.message);
                      }
                    }

                    const { error: deleteError } = await supabase
                      .from('agent_map')
                      .delete()
                      .eq('key', keyToDelete);
                    if (deleteError) {
                      throw new Error(deleteError.message);
                    }
                    setDocs((prev) => prev.filter((doc) => doc.key !== keyToDelete));
                    setExpandedKey((prev) => (prev === keyToDelete ? null : prev));
                    if (agentIdToDelete) {
                      setAgentDocuments((prev) => {
                        if (!(agentIdToDelete in prev)) return prev;
                        const { [agentIdToDelete]: _removedDoc, ...rest } = prev;
                        return rest;
                      });
                      setAgentDocumentDrafts((prev) => {
                        if (!(agentIdToDelete in prev)) return prev;
                        const { [agentIdToDelete]: _removedDraft, ...restDrafts } = prev;
                        return restDrafts;
                      });
                    }
                    setConfirmingKey(null);
                  } catch (e: any) {
                    setError(e?.message ?? 'Failed to delete');
                  } finally {
                    setDeletingKey(null);
                  }
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #c24141',
                  background: '#ef4444',
                  color: '#F6F7F9',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: deletingKey ? 'wait' : 'pointer',
                  opacity: deletingKey ? 0.7 : 1,
                }}
                disabled={!!deletingKey}
              >
                {deletingKey ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmingDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,22,40,0.72)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#142038',
              borderRadius: 16,
              padding: '24px 28px',
              width: 'min(360px, 90vw)',
              boxShadow: '0 14px 60px rgba(10,22,40,0.38)',
              border: '1px solid #22325a',
              color: '#e6eaff',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Delete document?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 14, color: '#a3c0ff', lineHeight: 1.5 }}>
              This will remove “{confirmingDoc.doc.file_name || 'Document'}” from this dialogue.
            </p>
            {docDeleteError && (
              <div style={{ color: '#ef4444', marginBottom: 16, fontSize: 13 }}>{docDeleteError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  if (deletingDoc) return;
                  setConfirmingDoc(null);
                  setDocDeleteError(null);
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #2d406b',
                  background: '#1c2b4a',
                  color: '#a3c0ff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: deletingDoc ? 'not-allowed' : 'pointer',
                  opacity: deletingDoc ? 0.6 : 1,
                }}
                disabled={deletingDoc}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirmingDoc) return;
                  const { agentId, doc } = confirmingDoc;
                  setDeletingDoc(true);
                  setDocDeleteError(null);
                  try {
                    if (doc.storage_path) {
                      const { error: storageError } = await supabase.storage.from('docs').remove([doc.storage_path]);
                      if (storageError && storageError.message && storageError.message !== 'Object not found') {
                        console.warn('Failed to remove storage object', storageError.message);
                      }
                    }
                    const { error } = await supabase
                      .from('agent_documents')
                      .delete()
                      .eq('id', doc.id);
                    if (error) {
                      throw new Error(error.message);
                    }
                    setAgentDocuments((prev) => {
                      const entry = prev[agentId];
                      if (!entry) return prev;
                      return {
                        ...prev,
                        [agentId]: {
                          ...entry,
                          docs: entry.docs.filter((d) => d.id !== doc.id),
                          loading: false,
                          error: null,
                        },
                      };
                    });
                    setConfirmingDoc(null);
                  } catch (e: any) {
                    setDocDeleteError(e?.message ?? 'Failed to delete document');
                  } finally {
                    setDeletingDoc(false);
                  }
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: '1px solid #c24141',
                  background: '#ef4444',
                  color: '#F6F7F9',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: deletingDoc ? 'wait' : 'pointer',
                  opacity: deletingDoc ? 0.7 : 1,
                }}
                disabled={deletingDoc}
              >
                {deletingDoc ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}      <style>{`
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
