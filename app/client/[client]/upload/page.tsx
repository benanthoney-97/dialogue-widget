"use client";
import React, { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "../Sidebar";

export default function UploadPage() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [fileUrl, setFileUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tempId, setTempId] = useState<string | null>(null);
  const [createdAgentIds, setCreatedAgentIds] = useState<string[]>([]);
  const [createdDocs, setCreatedDocs] = useState<Array<{ agent_id: string; agent_name: string; document_url: string }>>([]);
  const [purposeText, setPurposeText] = useState<string>('');
  const [purposeSaving, setPurposeSaving] = useState<boolean>(false);
  const purposeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const [selectedSetting, setSelectedSetting] = useState<string>('Friendly');
  // Settings state
  const [tone, setTone] = useState<string>('Neutral');
  const [voice, setVoice] = useState<'male' | 'female' | ''>('male');
  const [agentName, setAgentName] = useState<string>('');
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setNotification(null); // Clear notification on new file selection
    }
  }

  function handleRemoveFile(idx: number) {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (updated.length === 0) {
        setNotification(null); // Clear notification if all files removed
      }
      return updated;
    });
  }


  const pathname = usePathname();
  // Get client slug from URL
  function getClientSlug(pathname: string | null): string {
    if (!pathname) return "";
    const match = pathname.match(/^\/client\/([^\/]+)/);
    return match ? match[1] : "";
  }
  const clientSlug = getClientSlug(pathname);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    let allSuccess = true;
    let firstError = null;
        let client_id: number | null = null;
        // Query clients table for client_id using clientSlug (field is 'name')
        if (clientSlug) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id')
            .eq('name', clientSlug)
            .single();
          if (clientError || !clientData) {
            setNotification({ type: 'error', message: 'Client not found.' });
            setSubmitted(false);
            return;
          }
          client_id = clientData.id;
        }
        if (uploadMode === 'upload' && files.length > 0 && clientSlug && client_id) {
      // create a temp id and upload to a temp/ folder so we can confirm later
      const newTempId = uuidv4();
      const createdIds: string[] = [];
      const createdDocsLocal: Array<{ agent_id: string; agent_name: string; document_url: string }> = [];
      for (const file of files) {
        const storagePath = `clients/${clientSlug}/temp/${newTempId}/${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('docs')
          .upload(storagePath, file, { upsert: true });

        if (!uploadError) {
          // Try to get a public URL for the uploaded object
          const { data: urlData } = await supabase.storage.from('docs').getPublicUrl(storagePath);
          // supabase client may return publicUrl or publicURL depending on version
          const publicURL = (urlData as any)?.publicUrl ?? (urlData as any)?.publicURL ?? null;

          // Fallback: construct expected public object URL (works if bucket is public)
          const fallbackUrl =
            (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "") +
            `/storage/v1/object/public/docs/${encodeURIComponent(storagePath)}`;

          const documentUrl = publicURL || fallbackUrl;

          // Insert placeholder row into agent_map with document_url set
          const agent_id = uuidv4();
          const { error: insertError } = await supabase
            .from('agent_map')
            .insert([
              {
                agent_id,
                client_id,
                agent_name: file.name,
                status: 'Pending',
                created_at: new Date().toISOString(),
                key: file.name,
                document_url: documentUrl,
              },
            ]);
          if (!insertError) {
            createdIds.push(agent_id);
            createdDocsLocal.push({ agent_id, agent_name: file.name, document_url: documentUrl });
          } else {
            allSuccess = false;
            if (!firstError) firstError = insertError.message;
          }
        } else {
          allSuccess = false;
          if (!firstError) firstError = uploadError.message;
        }
      }
      if (allSuccess) {
        setNotification({ type: 'success', message: 'Upload successful!' });
        // keep tempId and created agent ids/docs in state so we can finalize later
        setTempId(newTempId);
        setCreatedAgentIds(createdIds);
        setCreatedDocs(createdDocsLocal);
        // advance to Purpose step
        setCurrentStep(1);
      } else {
        setNotification({ type: 'error', message: `Upload failed: ${firstError}` });
      }
    }
    // (You can add logic for fileUrl mode here if needed)
    setSubmitted(false);
  }

  // Timeline refs and measurement state
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const circleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Upload, 1: Purpose, 2: Settings, 3: Confirm

  function setCircleRef(el: HTMLDivElement | null, idx: number) {
    circleRefs.current[idx] = el;
  }

  useEffect(() => {
    function updateLine() {
      const first = circleRefs.current[0];
      const last = circleRefs.current[circleRefs.current.length - 1];
      const wrap = timelineWrapRef.current;
      const line = lineRef.current;
      const progress = progressRef.current;
      if (!first || !last || !wrap || !line) return;
      const wrapRect = wrap.getBoundingClientRect();
      // compute centers for all circles
      const centers: number[] = circleRefs.current.map(c => {
        if (!c) return 0;
        const r = c.getBoundingClientRect();
        return r.left + r.width / 2 - wrapRect.left;
      });
      const firstCenter = centers[0] ?? 0;
      const lastCenter = centers[centers.length - 1] ?? firstCenter;
      const leftPx = Math.max(0, Math.round(firstCenter));
      const widthPx = Math.max(0, Math.round(lastCenter - firstCenter));
      line.style.left = `${leftPx}px`;
      line.style.width = `${widthPx}px`;
      // progress up to currentStep
      if (progress) {
        const stepIndex = Math.max(0, Math.min(currentStep, centers.length - 1));
        const stepCenter = centers[stepIndex] ?? firstCenter;
        const progLeft = Math.max(0, Math.round(firstCenter));
        const progWidth = Math.max(0, Math.round(stepCenter - firstCenter));
        progress.style.left = `${progLeft}px`;
        progress.style.width = `${progWidth}px`;
      }

    }

    // Initial update
    updateLine();

    // Update on resize
    const ro = new ResizeObserver(updateLine);
    if (timelineWrapRef.current) ro.observe(timelineWrapRef.current);
    window.addEventListener('resize', updateLine);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateLine);
    };
  }, [files, currentStep]);

  // When entering Purpose step, prefill purposeText from the first draft agent_map row (if any)
  useEffect(() => {
    async function fetchPurpose() {
      if (currentStep !== 1) return;
      if (!createdAgentIds || createdAgentIds.length === 0) return;
      try {
        const firstAgentId = createdAgentIds[0];
        const { data, error } = await supabase.from('agent_map').select('description').eq('agent_id', firstAgentId).single();
        if (!error && data && typeof data.description === 'string') {
          setPurposeText(data.description);
        }
      } catch (e) {
        // ignore fetch errors for now
      }
    }
    fetchPurpose();
  }, [currentStep, createdAgentIds]);

  async function savePurpose(): Promise<boolean> {
    if (!createdAgentIds || createdAgentIds.length === 0) return true;
    // if a save is already in progress, return that promise so callers can await it
    if (purposeSavePromiseRef.current) return purposeSavePromiseRef.current;
    setPurposeSaving(true);
    const p = (async () => {
      try {
        // Update each agent_map row individually to avoid postgREST / .in() encoding issues
        const results = await Promise.all(
          createdAgentIds.map((agentId) =>
            supabase
              .from('agent_map')
              .update({ description: purposeText, updated_at: new Date().toISOString() })
              .eq('agent_id', agentId)
          )
        );

        const failed = results.find((r: any) => r && r.error);
        if (failed && failed.error) {
          const err = failed.error;
          const msg = (err && (err.message ?? err)) || 'Unknown error';
          setNotification({ type: 'error', message: `Failed to save purpose: ${msg}` });
          return false;
        }

        setNotification(null);
        return true;
      } catch (e: any) {
        setNotification({ type: 'error', message: `Failed to save purpose: ${e?.message ?? e}` });
        return false;
      } finally {
        setPurposeSaving(false);
        purposeSavePromiseRef.current = null;
      }
    })();
    purposeSavePromiseRef.current = p;
    return p;
  }

  // Save settings (tone, voice -> voice_id, agent_name) to all created agent_map rows
  async function saveSettings(): Promise<boolean> {
    if (!createdAgentIds || createdAgentIds.length === 0) return true;
    setSettingsSaving(true);
    try {
      const results = await Promise.all(
        createdAgentIds.map((agentId) =>
          supabase
            .from('agent_map')
            .update({ tone: tone || null, voice_id: voice || null, agent_name: agentName || null, updated_at: new Date().toISOString() })
            .match({ agent_id: agentId })
        )
      );

      const failed = results.find((r: any) => r && r.error);
      if (failed && failed.error) {
        const err = failed.error;
        const msg = (err && (err.message ?? err)) || 'Unknown error';
        setNotification({ type: 'error', message: `Failed to save settings: ${msg}` });
        setSettingsSaving(false);
        return false;
      }

      setNotification(null);
      setSettingsSaving(false);
      return true;
    } catch (e: any) {
      setNotification({ type: 'error', message: `Failed to save settings: ${e?.message ?? e}` });
      setSettingsSaving(false);
      return false;
    }
  }

  // Finalize: ensure purpose/settings saved, then call server endpoint to move temp files and mark rows Ready
  async function handleFinalize() {
    if (finalizing) return;
    // Make sure purpose and settings are saved first
    const okPurpose = await savePurpose();
    if (!okPurpose) return;
    const okSettings = await saveSettings();
    if (!okSettings) return;

    if (!tempId || !createdAgentIds || createdAgentIds.length === 0) {
      setNotification({ type: 'error', message: 'Nothing to finalize.' });
      return;
    }

    setFinalizing(true);
    try {
      const res = await fetch('/api/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempId, agentIds: createdAgentIds, clientSlug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = (body && (body.error || body.message)) || `Server error: ${res.status}`;
        setNotification({ type: 'error', message: `Failed to finalize: ${msg}` });
        setFinalizing(false);
        return;
      }

      setNotification({ type: 'success', message: 'Dialogue created successfully.' });
      setFinalizing(false);
      // navigate to documents or dialogues list
      router.push(`/client/${clientSlug}/documents`);
    } catch (e: any) {
      setNotification({ type: 'error', message: `Failed to finalize: ${e?.message ?? e}` });
      setFinalizing(false);
    }
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "inherit",
          position: 'relative',
          minHeight: '100dvh',
          overflow: 'auto',
        }}>
          {/* Timeline positioned at top of main content (full width of content area) */}
          <div style={{ position: 'absolute', top: 20, left: 24, right: 24, zIndex: 20 }}>
            <div ref={timelineWrapRef} style={{ position: 'relative', height: 64 }}>
              {/* connecting line that starts/ends at first/last circles */}
              <div ref={lineRef} style={{ position: 'absolute', top: '50%', transform: 'translateY(-1px)', height: 2, background: 'rgba(255,255,255,0.04)', zIndex: 0, left: 0, width: '0px', transition: 'left 160ms ease, width 160ms ease' }} />
              {/* progress line up to current step */}
              <div ref={progressRef} style={{ position: 'absolute', top: '50%', transform: 'translateY(-1px)', height: 2, background: '#7ea0e6', zIndex: 1, left: 0, width: '0px', transition: 'left 200ms ease, width 200ms ease' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 2 }}>
                {['Upload','Purpose','Settings','Confirm'].map((label, idx) => {
                  const completed = idx < currentStep;
                  const active = idx === currentStep;
                  return (
                    <div key={label} style={{ position: 'relative', flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <div
                        ref={(el) => setCircleRef(el, idx)}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          background: completed || active ? '#7ea0e6' : 'rgba(255,255,255,0.06)',
                          boxShadow: active ? '0 0 0 6px rgba(126,160,230,0.06)' : undefined,
                          zIndex: 2,
                        }}
                      />
                      <div style={{ marginTop: 34, fontSize: 14, color: active ? '#ffffff' : '#a3c0ff', fontWeight: 800 }}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{
            width: 420,
            background: '#192447',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(10,22,40,0.18)',
            padding: '24px 24px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Conditionally render Purpose / Settings / Upload card depending on currentStep */}
            {currentStep === 1 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: '#e6eaff' }}>Purpose</h2>
                <div style={{ marginBottom: 12, color: '#a3c0ff' }}>Tell us why you're uploading this document (basic form)</div>
                <textarea
                  placeholder="Enter purpose..."
                  value={purposeText}
                  onChange={(e) => setPurposeText(e.target.value)}
                  onBlur={() => { void savePurpose(); }}
                  style={{ width: '100%', minHeight: 120, borderRadius: 8, padding: 10, background: '#0f1a33', color: '#e6eaff', border: '1px solid #22325a' }}
                />
                <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      // ensure purpose saved before going back
                      if (!purposeSaving) {
                        const ok = await savePurpose();
                        if (ok) setCurrentStep(0);
                      }
                    }}
                    disabled={purposeSaving}
                    style={{ padding: '8px 14px', borderRadius: 8, background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', fontWeight: 700, opacity: purposeSaving ? 0.6 : 1, cursor: purposeSaving ? 'not-allowed' : 'pointer' }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await savePurpose();
                      if (ok) setCurrentStep(2);
                    }}
                    style={{ padding: '8px 14px', borderRadius: 8, background: '#525fe1', color: '#fff', border: 'none', fontWeight: 700, opacity: purposeSaving ? 0.9 : 1, cursor: purposeSaving ? 'wait' : 'pointer' }}
                  >
                    {purposeSaving ? 'Saving...' : 'Next'}
                  </button>
                </div>
              </div>
            ) : currentStep === 2 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: '#e6eaff' }}>Settings</h2>
                <div style={{ marginBottom: 8, color: '#a3c0ff' }}>Tone</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {['Neutral','Formal','Casual','Assertive'].map((opt) => {
                    const active = opt === tone;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTone(opt)}
                        disabled={settingsSaving}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: active ? '#525fe1' : '#22325a',
                          color: active ? '#fff' : '#a3c0ff',
                          border: active ? '2px solid #7ea0e6' : '1px solid #2d406b',
                          cursor: settingsSaving ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                          opacity: settingsSaving ? 0.65 : 1,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 8, color: '#a3c0ff' }}>Voice</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {['male','female'].map((v) => {
                    const active = v === voice;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVoice(v as 'male' | 'female')}
                        disabled={settingsSaving}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: active ? '#525fe1' : '#22325a',
                          color: active ? '#fff' : '#a3c0ff',
                          border: active ? '2px solid #7ea0e6' : '1px solid #2d406b',
                          cursor: settingsSaving ? 'not-allowed' : 'pointer',
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          opacity: settingsSaving ? 0.65 : 1,
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginBottom: 8, color: '#a3c0ff' }}>Dialogue name</div>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter a display name for your Dialogue"
                  disabled={settingsSaving}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#0f1a33',
                    color: '#e6eaff',
                    border: '1px solid #22325a',
                    marginBottom: 12,
                    opacity: settingsSaving ? 0.75 : 1,
                  }}
                />

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    disabled={settingsSaving}
                    style={{ padding: '8px 14px', borderRadius: 8, background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', fontWeight: 700, opacity: settingsSaving ? 0.6 : 1, cursor: settingsSaving ? 'not-allowed' : 'pointer' }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (settingsSaving) return;
                      const ok = await saveSettings();
                      if (ok) setCurrentStep(3);
                    }}
                    disabled={settingsSaving}
                    style={{ padding: '8px 14px', borderRadius: 8, background: '#525fe1', color: '#fff', border: 'none', fontWeight: 700, opacity: settingsSaving ? 0.9 : 1, cursor: settingsSaving ? 'not-allowed' : 'pointer' }}
                  >
                    {settingsSaving ? 'Saving...' : 'Next'}
                  </button>
                </div>
              </div>
            ) : currentStep === 3 ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: '#e6eaff' }}>Confirm</h2>
                <div style={{ color: '#a3c0ff', marginBottom: 12 }}>Review uploaded files, purpose and settings before creating the Dialogue.</div>

                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
                  {createdDocs.length === 0 ? (
                    <div style={{ color: '#a3c0ff' }}>No uploaded documents</div>
                  ) : (
                    createdDocs.map((d) => (
                      <div key={d.agent_id} style={{ width: 120, height: 140, borderRadius: 8, background: '#0f1724', border: '1px solid #22325a', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#e6eaff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.agent_name}</div>
                        <div style={{ fontSize: 11, color: '#9fb3ff', wordBreak: 'break-all' }}>{d.document_url}</div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: '#a3c0ff', marginBottom: 6 }}>Purpose</div>
                  <div style={{ background: '#0f1a33', padding: 10, borderRadius: 8, color: '#e6eaff' }}>{purposeText || '-'}</div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: '#a3c0ff', marginBottom: 6 }}>Settings</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ color: '#9fb3ff' }}>Tone: <span style={{ color: '#e6eaff', fontWeight: 800 }}>{tone || '-'}</span></div>
                    <div style={{ color: '#9fb3ff' }}>Voice: <span style={{ color: '#e6eaff', fontWeight: 800 }}>{voice || '-'}</span></div>
                    <div style={{ color: '#9fb3ff' }}>Name: <span style={{ color: '#e6eaff', fontWeight: 800 }}>{agentName || '-'}</span></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={() => setCurrentStep(2)} disabled={finalizing} style={{ padding: '8px 14px', borderRadius: 8, background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', fontWeight: 700, opacity: finalizing ? 0.6 : 1, cursor: finalizing ? 'not-allowed' : 'pointer' }}>Back</button>
                  <button type="button" onClick={handleFinalize} disabled={finalizing} style={{ padding: '8px 14px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, cursor: finalizing ? 'not-allowed' : 'pointer' }}>{finalizing ? 'Creating…' : 'Create Dialogue'}</button>
                </div>
              </div>
            ) : (
              <>
            {/* ...existing code... */}
            {/* Document Icon */}
            <div style={{ marginBottom: 18 }}>
              <svg width="54" height="54" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="6" width="34" height="42" rx="5" fill="#22325a" stroke="#7ea0e6" strokeWidth="2.2"/>
                <rect x="17" y="16" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                <rect x="17" y="25" width="20" height="3" rx="1.5" fill="#7ea0e6"/>
                <rect x="17" y="34" width="12" height="3" rx="1.5" fill="#7ea0e6"/>
              </svg>
            </div>
            {/* Heading */}
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18, color: "#e6eaff", fontFamily: "inherit", letterSpacing: 0.5 }}>Add a file for processing</h2>
            {/* Chips for Upload/File URL */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignSelf: 'center', justifyContent: 'center', width: '80%' }}>
              <button
                type="button"
                onClick={() => setUploadMode('upload')}
                style={{
                  width: '50%',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: uploadMode === 'upload' ? '#2d406b' : '#22325a',
                  color: uploadMode === 'upload' ? '#fff' : '#a3c0ff',
                  fontWeight: 700,
                  fontSize: 15,
                  border: uploadMode === 'upload' ? '2px solid #7ea0e6' : '1px solid #2d406b',
                  cursor: 'pointer',
                  boxShadow: uploadMode === 'upload' ? '0 2px 12px #22325a' : '0 2px 8px rgba(10,22,40,0.13)',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                style={{
                  width: '50%',
                  padding: '10px 0',
                  borderRadius: 999,
                  background: uploadMode === 'url' ? '#2d406b' : '#22325a',
                  color: uploadMode === 'url' ? '#fff' : '#a3c0ff',
                  fontWeight: 700,
                  fontSize: 15,
                  border: uploadMode === 'url' ? '2px solid #7ea0e6' : '1px solid #2d406b',
                  cursor: 'pointer',
                  boxShadow: uploadMode === 'url' ? '0 2px 12px #22325a' : '0 2px 8px rgba(10,22,40,0.13)',
                  transition: 'background 0.18s, color 0.18s, border 0.18s',
                }}
              >
                File URL
              </button>
            </div>
            {/* Upload form */}
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {uploadMode === 'upload' ? (
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #2d406b',
                    background: '#22325a',
                    borderRadius: 12,
                    padding: '36px 0',
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    transition: 'border 0.18s',
                    minHeight: 120,
                    width: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      setFiles(Array.from(e.dataTransfer.files));
                    }
                  }}
                >
                  <input
                    id="file-upload"
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.html"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  {files.length === 0 ? (
                    <>
                      <div style={{ marginBottom: 8 }}>Drag & drop files here</div>
                      <div style={{ fontSize: 15, color: '#7ea0e6', fontWeight: 400 }}>or <span style={{ textDecoration: 'underline', color: '#7ea0e6', cursor: 'pointer' }}>click to select from computer</span></div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
                        {['PDF', 'TXT', 'DOCX', 'HTML'].map(type => (
                          <span
                            key={type}
                            style={{
                              background: '#22325a',
                              color: '#7ea0e6',
                              border: '1px solid #2d406b',
                              borderRadius: 8,
                              padding: '2px 10px',
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                            }}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <ul style={{ color: '#a3c0ff', fontSize: 15, paddingLeft: 0, margin: 0, width: '100%' }}>
                      {files.map((file, idx) => (
                        <li key={idx} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{file.name}</span>
                          <button type="button" onClick={() => handleRemoveFile(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </label>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #2d406b',
                    background: '#22325a',
                    borderRadius: 12,
                    padding: '36px 0',
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    minHeight: 120,
                    width: '100%',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="url"
                    value={fileUrl}
                    onChange={e => {
                      setFileUrl(e.target.value);
                      setNotification(null); // Clear notification on new URL
                    }}
                    placeholder="Paste file URL here..."
                    style={{
                      width: '80%',
                      padding: '12px 14px',
                      borderRadius: 8,
                      border: '1px solid #2d406b',
                      fontSize: 15,
                      color: '#a3c0ff',
                      background: '#192447',
                      marginBottom: 0,
                    }}
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={
                  (uploadMode === 'upload' && (files.length === 0 || submitted)) ||
                  (uploadMode === 'url' && (fileUrl.trim() === '' || submitted))
                }
                style={{
                  background:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? '#525fe1'
                      : '#2d406b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? 'pointer'
                      : 'not-allowed',
                  marginTop: 18,
                  width: '100%',
                  boxShadow:
                    (uploadMode === 'upload' && files.length > 0 && !submitted) ||
                    (uploadMode === 'url' && fileUrl.trim() && !submitted)
                      ? '0 2px 8px #525fe1'
                      : 'none',
                  transition: 'background 0.18s, box-shadow 0.18s',
                }}
              >
                {submitted ? 'Uploading...' : 'Submit'}
              </button>
              {/* Uploading message and notification below the button */}
              {submitted && !notification && (
                <div style={{
                  marginTop: 18,
                  color: '#fff',
                  background: '#22325a',
                  border: '2px solid #fff',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: 15,
                  textAlign: 'center',
                  width: '100%',
                  letterSpacing: 0.1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  Do not leave this page while your document is uploading.
                </div>
              )}
              {notification && (
                <div style={{
                  marginTop: 18,
                  marginBottom: 0,
                  color: notification.type === 'success' ? '#22c55e' : '#ef4444',
                  background: notification.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1.5px solid ${notification.type === 'success' ? '#22c55e' : '#ef4444'}`,
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: 15,
                  textAlign: 'center',
                  width: '100%',
                  letterSpacing: 0.1,
                  display: 'flex',
                  flexDirection: notification.type === 'success' ? 'row' : 'column',
                  alignItems: 'center',
                  gap: notification.type === 'success' ? 16 : 10,
                  justifyContent: notification.type === 'success' ? 'center' : 'initial',
                }}>
                  <span>{notification.message}</span>
                  {notification.type === 'success' && (
                    <button
                      style={{
                        background: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '7px 18px',
                        fontWeight: 700,
                        fontSize: 15,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px #22c55e33',
                        transition: 'background 0.18s',
                      }}
                      onClick={() => router.push(`/client/${clientSlug}/documents`)}
                    >
                      Track Progress
                    </button>
                  )}
                </div>
              )}
              </form>
              </>
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