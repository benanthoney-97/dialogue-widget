"use client";
import React, { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "../Sidebar";
import PurposeCard, { defaultChipStyleMap } from "../../../components/PurposeCard";

type StagedDoc = {
  temp_id: string;
  agent_name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  lastModified: number;
  groupTempId: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const hasDecimal = value < 10 && exponent > 0;
  return `${hasDecimal ? value.toFixed(1) : Math.round(value)} ${units[exponent]}`;
}

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function mergeFileLists(existing: File[], additions: File[]): File[] {
  if (additions.length === 0) return existing;
  const map = new Map<string, File>();
  existing.forEach(file => map.set(fileKey(file), file));
  additions.forEach(file => map.set(fileKey(file), file));
  return Array.from(map.values());
}

export default function UploadPage() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [fileUrl, setFileUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tempId, setTempId] = useState<string | null>(null);
  const [createdDocs, setCreatedDocs] = useState<StagedDoc[]>([]);
  const [purposeText, setPurposeText] = useState<string>('');
  const [purposeSaving, setPurposeSaving] = useState<boolean>(false);
  const purposeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const hasHydratedFromParams = useRef<boolean>(false);
  const [selectedSetting, setSelectedSetting] = useState<string>('Friendly');
  // Settings state
  const [tone, setTone] = useState<string>('Neutral');
  const [voice, setVoice] = useState<'male' | 'female' | ''>('male');
  const [agentName, setAgentName] = useState<string>('');
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    setFiles(prev => mergeFileLists(prev, selected));
    setNotification(null); // Clear notification on new file selection
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
  const searchParams = useSearchParams();
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
    setNotification(null);

    try {
      if (uploadMode === 'upload' && files.length > 0) {
        const groupTempId = uuidv4();
        const stagedDocs = await Promise.all(
          files.map(async (file) => {
            const dataUrl = await fileToDataUrl(file);
            return {
              temp_id: uuidv4(),
              agent_name: file.name,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              dataUrl,
              lastModified: file.lastModified,
              groupTempId,
            } satisfies StagedDoc;
          })
        );
        setTempId(groupTempId);
    setCreatedDocs(stagedDocs);
        setCurrentStep(2);
      } else if (uploadMode === 'url' && fileUrl.trim()) {
        const groupTempId = uuidv4();
        const stagedDoc: StagedDoc = {
          temp_id: uuidv4(),
          agent_name: fileUrl.trim(),
          fileName: fileUrl.trim(),
          fileType: "text/url",
          fileSize: fileUrl.trim().length,
          dataUrl: fileUrl.trim(),
          lastModified: Date.now(),
          groupTempId,
        };
        setTempId(groupTempId);
  setCreatedDocs([stagedDoc]);
        setCurrentStep(2);
      } else {
        setNotification({ type: 'error', message: 'Please add at least one file or URL before continuing.' });
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setNotification({ type: 'error', message: `Failed to stage files: ${msg}` });
    } finally {
      setSubmitted(false);
    }
  }

  // Timeline refs and measurement state
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const circleRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Purpose, 1: Upload, 2: Confirm
  const [selectedGuidance, setSelectedGuidance] = useState<string | null>(null);
  // When a guidance card is selected we store its template here so it can be carried
  // forward even though the textarea remains visually empty.
  const [savedPurpose, setSavedPurpose] = useState<string | null>(null);
  // Hardcoded guidance texts stored in component state
  const initialGuidanceTexts: Record<string, string> = {
    Prepare: "I want to prepare for a presentation, seminar or meeting using the documents in your knowledge base.",
    Learn: "I want to learn in-depth about the topics discussed in the documents in your knowledge base.",
    Review: "I'm reviewing the document(s) in your knowledge base for a teammate, in order to provide them with detailed feedback, and would like your assistance.",
    'Go-to-market': "I'm a client of the author of the documents in your knowledge base and would like to analyse these materials with your assistance.",
  };
  const [guidanceTexts, setGuidanceTexts] = useState<Record<string, string>>(initialGuidanceTexts);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('temp-upload-docs');
      sessionStorage.removeItem('temp-upload-purpose');
    }
    return () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('temp-upload-docs');
        sessionStorage.removeItem('temp-upload-purpose');
      }
    };
  }, []);
  function setCircleRef(el: HTMLDivElement | null, idx: number) {
    circleRefs.current[idx] = el;
  }

  // Styles for labeled chips (keeps 'Personal' consistent across items)
  const chipStyleMap = defaultChipStyleMap;

  useEffect(() => {
    if (hasHydratedFromParams.current) return;
    const stageParam = searchParams?.get("stage");
    const purposeParam = searchParams?.get("purpose");
    if (!stageParam && !purposeParam) return;
    hasHydratedFromParams.current = true;

    if (stageParam === "upload") {
      setCurrentStep(1);
    }

    if (purposeParam) {
      try {
        const parsed = JSON.parse(purposeParam);
        if (parsed && typeof parsed === 'object') {
          const selected = typeof parsed.selectedGuidance === 'string' && parsed.selectedGuidance.length > 0
            ? parsed.selectedGuidance
            : null;
          const trimmedPurpose = typeof parsed.purposeText === 'string' ? parsed.purposeText : '';
          const saved = typeof parsed.savedPurpose === 'string' ? parsed.savedPurpose : null;

          if (selected) {
            setSelectedGuidance(selected);
            const template = guidanceTexts[selected] ?? saved ?? trimmedPurpose;
            setSavedPurpose(template ?? null);
            setPurposeText('');
          } else {
            const customText = (saved ?? trimmedPurpose) ?? '';
            setSelectedGuidance(null);
            setSavedPurpose(customText ? customText : null);
            setPurposeText(customText);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse purpose from query params', err);
      }
    }

    if (stageParam || purposeParam) {
      router.replace(pathname);
    }
  }, [searchParams, pathname, router, guidanceTexts]);

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

  // Hydrate staged data from session storage if available
  async function savePurpose(): Promise<boolean> {
    if (!createdDocs || createdDocs.length === 0) return true;
    // if a save is already in progress, return that promise so callers can await it
    if (purposeSavePromiseRef.current) return purposeSavePromiseRef.current;
    setPurposeSaving(true);
    const p = (async () => {
      try {
        // Do not persist purpose in session storage anymore
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


  // Finalize: ensure purpose/settings saved, then call server endpoint to move temp files and mark rows Ready
  async function handleFinalize() {
    if (finalizing) return;
    // Make sure purpose and settings are saved first
    const okPurpose = await savePurpose();
    if (!okPurpose) return;

    if (!tempId || !createdDocs || createdDocs.length === 0) {
      setNotification({ type: 'error', message: 'Nothing to finalize.' });
      return;
    }

    setFinalizing(true);
    try {
      const res = await fetch('/api/dialogues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempId,
          clientSlug,
          docs: createdDocs,
          purpose: savedPurpose ?? purposeText,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = (body && (body.error || body.message)) || `Server error: ${res.status}`;
        setNotification({ type: 'error', message: `Failed to finalize: ${msg}` });
        setFinalizing(false);
        return;
      }

      setNotification({ type: 'success', message: 'Dialogue created successfully.' });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem('temp-upload-docs');
        sessionStorage.removeItem('temp-upload-purpose');
      }
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
                {['Purpose','Upload','Confirm'].map((label, idx) => {
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
            width: 'min(640px, 92%)',
            marginTop: 56,
            background: '#192447',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(10,22,40,0.18)',
            padding: '24px 24px 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Conditionally render Purpose / Upload / Confirm card depending on currentStep */}
            {currentStep === 0 ? (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
                  <PurposeCard
                    guidanceTexts={guidanceTexts}
                    selectedGuidance={selectedGuidance}
                    purposeText={purposeText}
                    onSelectGuidance={(key, purpose) => {
                      setSelectedGuidance(key);
                      setSavedPurpose(purpose);
                    }}
                    onCustomFocus={() => {
                      setSelectedGuidance(null);
                      setSavedPurpose(null);
                    }}
                    onPurposeChange={(value) => {
                      setPurposeText(value);
                    }}
                    onPurposeBlur={() => { void savePurpose(); }}
                    onNext={async () => {
                      const ok = await savePurpose();
                      if (ok) setCurrentStep(1);
                    }}
                    nextDisabled={purposeSaving || (!selectedGuidance && !purposeText.trim())}
                    saving={purposeSaving}
                  />
                </div>
              </div>
            ) : currentStep === 1 ? (
              <>
            {/* Upload stage */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            {/* Removed decorative Document Icon for a more compact header */}
            {/* Heading */}
            <div style={{ position: 'relative', width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: '0 0 auto' }}>
                <button type="button" onClick={() => setCurrentStep(0)} disabled={purposeSaving} style={{ padding: '6px 12px', borderRadius: 8, background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', fontWeight: 600, fontSize: 13, opacity: purposeSaving ? 0.6 : 1, cursor: purposeSaving ? 'not-allowed' : 'pointer' }}>Back</button>
              </div>
              <h2 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 20, fontWeight: 800, color: "#e6eaff", fontFamily: "inherit", letterSpacing: 0.5, margin: 0 }}>Add your documents</h2>
            </div>
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
                      const dropped = Array.from(e.dataTransfer.files);
                      setFiles(prev => mergeFileLists(prev, dropped));
                      setNotification(null);
                      e.dataTransfer.clearData();
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
                    <>
                    <ul style={{ color: '#a3c0ff', fontSize: 15, paddingLeft: 0, margin: 0, width: '100%' }}>
                      {files.map((file, idx) => (
                        <li key={idx} style={{ marginBottom: 6, width: '100%', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', paddingTop: idx > 0 ? 8 : 0 }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360, textAlign: 'center', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{file.name}</span>
                            <button type="button" onClick={() => handleRemoveFile(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, position: 'absolute', right: 12 }}>Remove</button>
                          </div>
                        </li>
                      ))}
                      <li style={{ listStyle: 'none', marginTop: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#9fb3ff', opacity: 0.9 }}>Click to add more documents</div>
                      </li>
                    </ul>
                    </>
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
                {submitted ? 'Uploading...' : 'Next'}
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
                  Stay on the page while document is uploading.
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
                </div>
              )}
              </form>
            </div>
              </>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ position: 'relative', width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    <button type="button" onClick={() => setCurrentStep(1)} disabled={finalizing} style={{ padding: '6px 12px', borderRadius: 8, background: '#22325a', color: '#a3c0ff', border: '1px solid #2d406b', fontWeight: 600, fontSize: 13, opacity: finalizing ? 0.6 : 1, cursor: finalizing ? 'not-allowed' : 'pointer' }}>Back</button>
                  </div>
                  <h2 style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 20, fontWeight: 800, color: '#e6eaff', fontFamily: 'inherit', letterSpacing: 0.5, margin: 0 }}>Confirm</h2>
                </div>

                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
                  {createdDocs.length === 0 ? (
                    <div style={{ color: '#a3c0ff' }}>No uploaded documents</div>
                  ) : (
                    createdDocs.map((d) => (
                      <div key={d.temp_id} style={{ width: 120, height: 140, borderRadius: 8, background: '#0f1724', border: '1px solid #22325a', padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#e6eaff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.agent_name}</div>
                        <div style={{ fontSize: 11, color: '#9fb3ff', wordBreak: 'break-word' }}>
                          <div>{formatBytes(d.fileSize)} · {d.fileType || 'Unknown type'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  {/* Show guidance-style card if user selected a guidance OR typed a custom purpose */}
                  { (selectedGuidance || (purposeText && purposeText.trim() !== '')) ? (
                    <div
                      style={{
                        width: '100%',
                        background: '#122a48',
                        borderRadius: 10,
                        padding: 12,
                        border: '1px solid rgba(126,160,230,0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        position: 'relative',
                      }}
                    >
                      {/* Chip in top-right - use mapping for selected guidance, otherwise show 'Custom' */}
                      {(() => {
                        const isCustom = !selectedGuidance;
                        const label = isCustom ? 'Custom' : (selectedGuidance === 'Prepare' || selectedGuidance === 'Learn' ? 'Personal' : (selectedGuidance === 'Review' ? 'Team' : (selectedGuidance === 'Go-to-market' ? 'Client' : 'Placeholder')));
                        const s = isCustom ? chipStyleMap.Purpose : (chipStyleMap[label] ?? chipStyleMap.Placeholder);
                        return (
                          <div style={{ position: 'absolute', top: 8, right: 8, background: s.bg, color: s.color, border: s.border, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, height: 20, lineHeight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
                        );
                      })()}

                      {/* Title: show guidance title or 'Custom' for user-typed purpose */}
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#e6eaff' }}>{selectedGuidance ?? 'Custom description'}</div>

                      {/* Content: guidance text for selectedGuidance, otherwise the user's typed purpose */}
                      <div style={{ fontSize: 13, color: '#9bb5ff', lineHeight: 1.5 }}>{selectedGuidance ? (guidanceTexts[selectedGuidance] ?? (savedPurpose ?? purposeText) ?? '-') : (purposeText || '-')}</div>
                    </div>
                  ) : (
                    <div style={{ background: '#0f1a33', padding: 10, borderRadius: 8, color: '#e6eaff' }}>{(savedPurpose ?? purposeText) || '-'}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <button type="button" onClick={handleFinalize} disabled={finalizing} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, cursor: finalizing ? 'not-allowed' : 'pointer' }}>{finalizing ? 'Creating…' : 'Create Dialogue'}</button>
                </div>
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
