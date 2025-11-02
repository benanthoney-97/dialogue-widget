"use client";
import React, { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "../Sidebar";
import PurposeCard from "../../../components/PurposeCard";
import ExecutiveAgent from "@/app/components/BriefingAgent";

const GUIDANCE_AUDIENCE_MAP: Record<string, string> = {
  Prepare: "Personal",
  Learn: "Personal",
  Review: "Team",
  "Go-to-market": "Client",
};

const TIMELINE_STEPS = ["Create", "Upload", "Briefing", "Confirm"];

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

type TranscriptMessage = { role: "user" | "ai"; text: string };

function base64Encode(content: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).Buffer) {
    return (globalThis as any).Buffer.from(content, "utf8").toString("base64");
  }
  throw new Error("Base64 encoding not supported");
}

function stringToDataUrl(content: string, mimeType = "text/plain"): string {
  const base64 = base64Encode(content);
  return `data:${mimeType};base64,${base64}`;
}

function stringByteLength(content: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(content).length;
  }
  if (typeof globalThis !== "undefined" && (globalThis as any).Buffer) {
    return (globalThis as any).Buffer.from(content, "utf8").length;
  }
  return content.length;
}

function buildTranscriptContent(
  messages: TranscriptMessage[],
  conversationId: string | null,
  endedAt: number | null
): string {
  const lines: string[] = [];
  if (conversationId) {
    lines.push(`Conversation ID: ${conversationId}`);
  }
  if (endedAt) {
    lines.push(`Completed At: ${new Date(endedAt).toISOString()}`);
  }
  if (lines.length > 0 && messages.length > 0) {
    lines.push("");
  }
  for (const entry of messages) {
    const speaker = entry.role === "ai" ? "Agent" : "User";
    lines.push(`${speaker}: ${entry.text}`);
  }
  return lines.join("\n").trim();
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
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

type StagePanelProps = {
  heading: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? (
            <div className="stage-panel__leading">{leading}</div>
          ) : (
            <div className="stage-panel__spacer" aria-hidden="true" />
          )}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? (
            <div className="stage-panel__trailing">{trailing}</div>
          ) : (
            <div className="stage-panel__spacer" aria-hidden="true" />
          )}
        </header>
      )}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

type StageButtonVariant = "primary" | "secondary" | "ghost";

type StageButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StageButtonVariant;
  width?: "auto" | "full";
};

function StageButton({ variant = "primary", width = "auto", className = "", ...props }: StageButtonProps) {
  const classes = ["stage-button", `stage-button--${variant}`, width === "full" ? "stage-button--full" : ""]
    .filter(Boolean)
    .join(" ");
  return <button className={`${classes} ${className}`.trim()} {...props} />;
}

type StageAlertProps = {
  type: "success" | "error" | "info";
  message: string;
};

function StageAlert({ type, message }: StageAlertProps) {
  return (
    <div className={`stage-alert stage-alert--${type}`}>
      <span>{message}</span>
    </div>
  );
}

type TimelineStepState = "pending" | "current" | "done" | "skipped";

type TimelineStep = {
  label: string;
  state: TimelineStepState;
  optional?: boolean;
};

type TimelineContext = {
  currentStep: number;
  canSkipUpload: boolean;
  canSkipBriefing: boolean;
  hasDocs: boolean;
  hasBriefing: boolean;
};

function buildTimelineSteps({
  currentStep,
  canSkipUpload,
  canSkipBriefing,
  hasDocs,
  hasBriefing,
}: TimelineContext): TimelineStep[] {
  const steps: TimelineStep[] = TIMELINE_STEPS.map((label) => ({
    label,
    state: "pending" as TimelineStepState,
  }));

  steps.forEach((step, idx) => {
    if (idx < currentStep) {
      step.state = "done";
    } else if (idx === currentStep) {
      step.state = "current";
    } else {
      step.state = "pending";
    }
  });

  const uploadStep = steps[1];
  const briefingStep = steps[2];

  if (canSkipUpload) {
    uploadStep.optional = true;
    if (currentStep > 1 && !hasDocs) {
      uploadStep.state = "skipped";
    }
  }

  if (canSkipBriefing) {
    briefingStep.optional = true;
    if (currentStep > 2 && !hasBriefing) {
      briefingStep.state = "skipped";
    }
  }

  return steps;
}

function StagesTimeline({ steps }: { steps: TimelineStep[] }) {
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const progressIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;

  return (
    <nav className="stage-timeline" aria-label="Persona creation progress">
      {steps.map((step, index) => {
        const connectorClasses = ["stage-timeline__connector"];
        if (index < progressIndex) {
          connectorClasses.push("stage-timeline__connector--complete");
        } else if (index === progressIndex) {
          connectorClasses.push("stage-timeline__connector--active");
        }
        if (step.state === "skipped") {
          connectorClasses.push("stage-timeline__connector--skipped");
        }

        return (
          <React.Fragment key={step.label}>
            <div className="stage-timeline__step">
              <div
                className={[
                  "stage-timeline__node",
                  `stage-timeline__node--${step.state}`,
                  step.optional ? "stage-timeline__node--optional" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span>{index + 1}</span>
              </div>
              <div className="stage-timeline__label">
                <span>{step.label}</span>
                {step.optional && (
                  <small>{step.state === "skipped" ? "Skipped" : "Optional"}</small>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={connectorClasses.join(" ")} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
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
  const [briefingConversationId, setBriefingConversationId] = useState<string | null>(null);
  const [briefingEndedAt, setBriefingEndedAt] = useState<number | null>(null);
  const [briefingComplete, setBriefingComplete] = useState<boolean>(false);
  const [briefingTranscript, setBriefingTranscript] = useState<TranscriptMessage[]>([]);
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

  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Purpose, 1: Upload, 2: Briefing, 3: Confirm
  const [selectedGuidance, setSelectedGuidance] = useState<string | null>(null);
  // When a guidance card is selected we store its template here so it can be carried
  // forward even though the textarea remains visually empty.
  const [savedPurpose, setSavedPurpose] = useState<string | null>(null);
  const [audienceType, setAudienceType] = useState<string>("Custom");
  // Hardcoded guidance texts stored in component state
  const initialGuidanceTexts: Record<string, string> = {
    Prepare: "I want to prepare for a presentation, seminar or meeting using the documents in your knowledge base.",
    Learn: "I want to learn in-depth about the topics discussed in the documents in your knowledge base.",
    Review: "I'm reviewing the document(s) in your knowledge base for a teammate, in order to provide them with detailed feedback, and would like your assistance.",
    'Go-to-market': "I'm a client of the author of the documents in your knowledge base and would like to analyse these materials with your assistance.",
  };
  const [guidanceTexts, setGuidanceTexts] = useState<Record<string, string>>(initialGuidanceTexts);
  const hasDocs = createdDocs.length > 0;
  const hasBriefing = Boolean(briefingConversationId && briefingEndedAt);
  const isDescribeMode = selectedGuidance === "Describe persona";
  const isDataMode = selectedGuidance === "Add my data" || (!isDescribeMode && hasDocs);
  const canSkipBriefing = isDataMode && hasDocs;
  const canContinueFromBriefing = hasBriefing || canSkipBriefing;
  const canSkipUpload = isDescribeMode;
  const timelineStepsData = buildTimelineSteps({
    currentStep,
    canSkipUpload,
    canSkipBriefing,
    hasDocs,
    hasBriefing,
  });

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

  useEffect(() => {
    if (currentStep === 2) {
      if (briefingConversationId && briefingEndedAt) {
        setBriefingComplete(true);
      } else {
        setBriefingComplete(false);
      }
    }
  }, [currentStep, briefingConversationId, briefingEndedAt]);

  useEffect(() => {
    if (selectedGuidance === 'Describe persona' && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [selectedGuidance, currentStep]);

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
          const audience =
            typeof parsed.audienceType === 'string' && parsed.audienceType.length > 0
              ? parsed.audienceType
              : undefined;

          if (selected) {
            setSelectedGuidance(selected);
            const template = guidanceTexts[selected] ?? saved ?? trimmedPurpose;
            setSavedPurpose(template ?? null);
            setAudienceType(audience ?? GUIDANCE_AUDIENCE_MAP[selected] ?? "Custom");
            setPurposeText('');
          } else {
            const customText = (saved ?? trimmedPurpose) ?? '';
            setSelectedGuidance(null);
            setSavedPurpose(customText ? customText : null);
            setPurposeText(customText);
            setAudienceType(audience ?? "Custom");
          }
        }
      } catch (err) {
         
        console.warn('Failed to parse purpose from query params', err);
      }
    }

    if (stageParam || purposeParam) {
      router.replace(pathname);
    }
  }, [searchParams, pathname, router, guidanceTexts]);

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

    const docsAvailable = Array.isArray(createdDocs) && createdDocs.length > 0;
    const briefingAvailable = Boolean(briefingConversationId && briefingEndedAt);

    if (!docsAvailable && !briefingAvailable) {
      setNotification({ type: 'error', message: 'Please upload at least one document or complete a briefing before finalizing.' });
      return;
    }

    if (docsAvailable && !tempId) {
      setNotification({ type: 'error', message: 'Upload session expired. Please re-upload your documents.' });
      return;
    }

    const docsPayload: StagedDoc[] = docsAvailable ? [...createdDocs] : [];
    if (briefingAvailable && briefingTranscript.length > 0) {
      const transcriptText = buildTranscriptContent(
        briefingTranscript,
        briefingConversationId,
        briefingEndedAt
      );
      if (transcriptText) {
        const transcriptFileName = briefingConversationId
          ? `briefing-transcript-${briefingConversationId}.txt`
          : 'briefing-transcript.txt';
        docsPayload.push({
          temp_id: uuidv4(),
          agent_name: 'Briefing transcript',
          fileName: transcriptFileName,
          fileType: 'text/plain',
          fileSize: stringByteLength(transcriptText),
          dataUrl: stringToDataUrl(transcriptText),
          lastModified: briefingEndedAt ?? Date.now(),
          groupTempId: 'briefing-transcript',
        });
      }
    }

    setFinalizing(true);
    try {
      const res = await fetch('/api/dialogues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempId,
          clientSlug,
          docs: docsPayload,
          purpose: savedPurpose ?? purposeText,
          audienceType: audienceType || "Custom",
          briefingConversationId,
          briefingEndedAt,
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
  router.push(`/client/${clientSlug}/personas`);
    } catch (e: any) {
      setNotification({ type: 'error', message: `Failed to finalize: ${e?.message ?? e}` });
      setFinalizing(false);
    }
  }

  return (
    <>
      <main className="upload-layout">
        <aside className="upload-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="upload-layout__content">
          <div className="stage-shell">
            <StagesTimeline steps={timelineStepsData} />
            {currentStep === 0 && (
              <StagePanel
                heading="How are you creating your persona?"
                subheading="Choose or describe what type of pitch you're preparing for."
              >
                <PurposeCard
                  guidanceTexts={guidanceTexts}
                  selectedGuidance={selectedGuidance}
                  purposeText={purposeText}
                  onSelectGuidance={async (key, purpose, audience) => {
                    setSelectedGuidance(key);
                    setSavedPurpose(purpose);
                    setAudienceType(audience ?? "Custom");
                    if (key === "Add my data") {
                      try {
                        const ok = await savePurpose();
                        if (ok) setCurrentStep(1);
                      } catch (e) {
                        // handled within savePurpose
                      }
                    }
                    if (key === "Describe persona") {
                      try {
                        const ok = await savePurpose();
                        if (ok) setCurrentStep(2);
                      } catch (e) {
                        // handled within savePurpose
                      }
                    }
                  }}
                  onCustomFocus={() => {
                    setSelectedGuidance(null);
                    setSavedPurpose(null);
                    setAudienceType("Custom");
                  }}
                  onPurposeChange={(value) => {
                    setPurposeText(value);
                  }}
                  onPurposeBlur={() => {
                    void savePurpose();
                  }}
                  onNext={async () => {
                    const ok = await savePurpose();
                    if (!ok) return;
                    if (selectedGuidance === "Describe persona") {
                      setCurrentStep(2);
                    } else {
                      setCurrentStep(1);
                    }
                  }}
                  nextDisabled={purposeSaving || (!selectedGuidance && !purposeText.trim())}
                  saving={purposeSaving}
                  headingText=""
                  subheadingText=""
                />
              </StagePanel>
            )}
            {currentStep === 1 && (
              <StagePanel
                heading="Build your persona's knowledge"
                leading={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    disabled={purposeSaving}
                    aria-label="Back"
                    title="Back"
                    className="stage-back"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </button>
                }
              >
                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {uploadMode === 'upload' ? (
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #2d406b',
                    background: 'var(--bg, #f4f8ff)',
                    borderRadius: 12,
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    transition: 'border 0.18s',
                    minHeight: files.length > 0 ? 218 : 186,
                    width: '100%',
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: files.length > 0 ? '12px 16px 16px' : 0,
                    overflow: files.length > 0 ? 'visible' : 'hidden',
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
                      <div style={{ marginBottom: 8, color: '#1e293b' }}>Drag & drop files here</div>
                      <div style={{ fontSize: 15, color: '#1e293b', fontWeight: 400 }}>or <span style={{ textDecoration: 'underline', color: '#1e293b', cursor: 'pointer' }}>click to select from computer</span></div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center' }}>
                        {['PDF', 'TXT', 'DOCX', 'HTML'].map(type => (
                          <span
                            key={type}
                            style={{
                              background: 'var(--bg, #f4f8ff)',
                              color: '#1e293b',
                              border: '1px solid rgba(30,41,59,0.16)',
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
                    <ul style={{ color: '#a3c0ff', fontSize: 15, paddingLeft: 0, margin: 0, width: '100%', display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'center' }}>
                      {files.map((file, idx) => (
                        <li
                          key={idx}
                          style={{
                            marginBottom: 6,
                            flexGrow: 0,
                            flexShrink: 0,
                            flexBasis: '130px',
                            width: '130px',
                            maxWidth: '130px',
                            boxSizing: 'border-box',
                            height: 186,
                            borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            paddingTop: 8,
                            listStyle: 'none',
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 12,
                              height: '100%',
                              padding: '30px 12px 24px',
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid #1e293b',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                              <div style={{ width: 36, height: 36, flex: '0 0 36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#1e293b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                  <path d="M14 2v6h6" stroke="#1e293b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  title={file.name}
                                  style={{
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: 12,
                                    color: '#1e293b',
                                    fontWeight: 600,
                                  }}
                                >
                                  {file.name.length > 12 ? `${file.name.slice(0, 12)}…` : file.name}
                                </div>
                                <div style={{ fontSize: 12, color: '#1e293b', marginTop: 4, textAlign: 'left' }}>{file.type ? file.type : `${(file.size / 1024).toFixed(0)} KB`}</div>
                              </div>
                            </div>

                            {/* Circular X remove button in top-right of the card */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              aria-label="Remove file"
                              title="Remove"
                              style={{
                                position: 'absolute',
                                top: -12,
                                right: -12,
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.04)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#9fb3ff',
                                cursor: 'pointer',
                                padding: 0,
                                zIndex: 5,
                                boxShadow: '0 6px 16px rgba(2,6,23,0.45)'
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      ))}
                      <li
                        style={{
                          listStyle: 'none',
                          marginBottom: 6,
                          flexGrow: 0,
                          flexShrink: 0,
                          flexBasis: '130px',
                          width: '130px',
                          maxWidth: '130px',
                          boxSizing: 'border-box',
                          height: 186,
                          paddingTop: 8,
                        }}
                      >
                        <div
                          style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 12,
                            height: '100%',
                            padding: '30px 12px 24px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed #1e293b',
                            color: '#1e293b',
                            fontSize: 13,
                            fontWeight: 600,
                            textAlign: 'center',
                          }}
                        >
                          Click to add more documents
                        </div>
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
                    padding: 0,
                    marginBottom: 22,
                    color: '#a3c0ff',
                    fontSize: 16,
                    fontWeight: 600,
                    minHeight: 186,
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
              <StageButton
                type="submit"
                variant="primary"
                width="full"
                disabled={
                  (uploadMode === "upload" && (files.length === 0 || submitted)) ||
                  (uploadMode === "url" && (fileUrl.trim() === "" || submitted))
                }
                style={{ marginTop: 18 }}
              >
                {submitted ? "Uploading..." : "Next"}
              </StageButton>
              {/* Uploading message and notification below the button */}
              {submitted && !notification && (
                <StageAlert type="info" message="Stay on the page while document is uploading." />
                  )}
                  {notification && <StageAlert type={notification.type} message={notification.message} />}
              </form>
              </StagePanel>
            )}
            {currentStep === 2 && (
              <StagePanel
                heading="Let's define your persona"
                leading={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(selectedGuidance === 'Describe persona' ? 0 : 1)}
                    disabled={finalizing}
                    aria-label="Back"
                    title="Back"
                    className="stage-back"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </button>
                }
              >
                <ExecutiveAgent
                  talkLabel="Start chat"
                  onConversationStart={(conversationId) => {
                    setBriefingComplete(false);
                    setBriefingConversationId(conversationId ?? null);
                    setBriefingEndedAt(null);
                    setBriefingTranscript([]);
                  }}
                  onConversationEnd={({ conversationId, endedAt }) => {
                    setBriefingComplete(true);
                    setBriefingConversationId(conversationId ?? null);
                    setBriefingEndedAt(endedAt ?? null);
                  }}
                  onTranscriptUpdate={(messages) => {
                    setBriefingTranscript(messages.slice());
                  }}
                />

                {briefingConversationId && briefingEndedAt ? (
                  <p style={{ color: 'rgba(30,41,59,0.7)', fontSize: 14, textAlign: 'center', margin: 0 }}>
                    Briefing saved on {new Date(briefingEndedAt).toLocaleString()}. Restart briefing call to replace.
                  </p>
                ) : null}

                <StageButton
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  disabled={!canContinueFromBriefing}
                  variant="primary"
                  width="full"
                  style={{ marginTop: 8 }}
                >
                  {hasBriefing
                    ? 'Continue to confirm'
                    : canSkipBriefing
                    ? 'Skip briefing and continue'
                    : 'Continue to confirm'}
                </StageButton>
                {!hasBriefing && canSkipBriefing ? (
                  <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 6 }}>
                    You can record a briefing later if needed.
                  </p>
                ) : null}
              </StagePanel>
            )}
            {currentStep === 3 && (
              <StagePanel
                heading="Confirm"
                leading={
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={finalizing}
                    aria-label="Back"
                    title="Back"
                    className="stage-back"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </button>
                }
              >
                <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'nowrap', justifyContent: 'center', overflowX: 'auto', paddingBottom: 6 }}>
                  {[
                    {
                      title: 'Pitch type',
                      value: selectedGuidance ?? (savedPurpose ? 'Custom brief' : 'Not set'),
                    },
                    {
                      title: 'Documents',
                      value: hasDocs
                        ? `${createdDocs.length} document${createdDocs.length === 1 ? '' : 's'}`
                        : 'No documents',
                    },
                    {
                      title: 'Briefing',
                      value: hasBriefing
                        ? 'Call completed'
                        : canSkipBriefing
                        ? 'Skipped (optional)'
                        : 'Pending call',
                    },
                  ].map((card) => (
                    <div
                        key={card.title}
                        style={{
                          position: 'relative',
                          /* fixed small width so cards line up horizontally */
                          flex: '0 0 120px',
                          minWidth: 120,
                          maxWidth: 160,
                          aspectRatio: '1 / 1',
                          /* slightly tighter corners */
                          borderRadius: 12,
                          background: '#f4f8ff',
                          border: '1px solid rgba(30,41,59,0.12)',
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          color: '#1e293b',
                          boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
                        }}
                      >
                      <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: '#3b82f6', marginBottom: 6, textAlign: 'center' }}>
                        {card.title}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, textAlign: 'center' }}>
                        {card.value}
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          right: 10,
                          bottom: 10,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: '#1e40af',
                          border: '2px solid rgba(59,130,246,0.65)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f8fafc',
                          boxShadow: '0 0 10px rgba(59,130,246,0.35)',
                        }}
                        aria-hidden="true"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6.33333 10.2733L4.06 8L3 9.05333L6.33333 12.3867L13.3333 5.38667L12.28 4.33333L6.33333 10.2733Z" fill="currentColor" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <StageButton
                    type="button"
                    onClick={handleFinalize}
                    disabled={finalizing}
                    variant="primary"
                    width="full"
                  >
                    {finalizing ? 'Creating…' : 'Create Dialogue'}
                  </StageButton>
                </div>
              </StagePanel>
            )}
          </div>
        </div>
        <style>{`
          .upload-layout {
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
            padding: 0;
            font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
            display: flex;
            flex-direction: row;
          }
          .upload-layout__sidebar {
            width: 180px;
            flex-shrink: 0;
          }
          .upload-layout__content {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 64px 24px 96px;
            min-height: 100dvh;
            overflow-y: auto;
          }
          .stage-shell {
            width: min(760px, 92%);
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .stage-timeline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 12px;
            margin-bottom: 4px;
          }
          .stage-timeline__step {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .stage-timeline__node {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 2px solid rgba(30, 41, 59, 0.2);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 16px;
            color: #1e293b;
            background: rgba(255, 255, 255, 0.85);
            transition: background 0.18s ease, border 0.18s ease, color 0.18s ease;
          }
          .stage-timeline__node--done {
            background: #1e293b;
            border-color: #1e293b;
            color: #f8fafc;
          }
          .stage-timeline__node--current {
            background: rgba(59, 130, 246, 0.15);
            border-color: rgba(59, 130, 246, 0.65);
            color: #1d4ed8;
          }
          .stage-timeline__node--skipped {
            background: rgba(148, 163, 184, 0.12);
            border-style: dashed;
            border-color: rgba(148, 163, 184, 0.75);
            color: rgba(71, 85, 105, 0.9);
          }
          .stage-timeline__node--optional {
            border-style: dashed;
          }
          .stage-timeline__label {
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 13px;
            color: rgba(30, 41, 59, 0.8);
            text-align: left;
          }
          .stage-timeline__label small {
            font-size: 11px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: rgba(59, 130, 246, 0.75);
          }
          .stage-timeline__connector {
            flex: 1;
            height: 2px;
            background: rgba(148, 163, 184, 0.3);
            border-radius: 999px;
          }
          .stage-timeline__connector--complete {
            background: rgba(30, 41, 59, 0.75);
          }
          .stage-timeline__connector--active {
            background: rgba(59, 130, 246, 0.65);
          }
          .stage-timeline__connector--skipped {
            background: repeating-linear-gradient(
              to right,
              rgba(148, 163, 184, 0.6),
              rgba(148, 163, 184, 0.6) 6px,
              rgba(148, 163, 184, 0.25) 6px,
              rgba(148, 163, 184, 0.25) 12px
            );
          }
          .stage-panel {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(30, 41, 59, 0.12);
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
            display: flex;
            flex-direction: column;
            gap: 24px;
            color: #1e293b;
          }
          .stage-panel__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .stage-panel__leading,
          .stage-panel__trailing,
          .stage-panel__spacer {
            flex: 0 0 auto;
            min-width: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .stage-panel__spacer {
            visibility: hidden;
          }
          .stage-panel__titles {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .stage-panel__titles h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #1e293b;
          }
          .stage-panel__titles p {
            margin: 0;
            font-size: 14px;
            color: rgba(30, 41, 59, 0.7);
          }
          .stage-panel__body {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .stage-panel__footer {
            margin-top: 12px;
          }
          .stage-back,
          .stage-button {
            font-family: inherit;
          }
          .stage-back {
            padding: 6px 12px;
            border-radius: 8px;
            background: rgba(30, 41, 59, 0.08);
            border: none;
            color: #1e293b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.18s ease, transform 0.18s ease;
          }
          .stage-back:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .stage-back:not(:disabled):hover {
            background: rgba(30, 41, 59, 0.16);
            transform: translateX(-2px);
          }
          .stage-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 20px;
            border-radius: 12px;
            border: none;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease;
          }
          .stage-button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }
          .stage-button--full {
            width: 100%;
          }
          .stage-button--primary {
            background: #1e293b;
            color: #f6f7f9;
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
          }
          .stage-button--primary:not(:disabled):hover {
            transform: translateY(-1px);
            box-shadow: 0 16px 32px rgba(15, 23, 42, 0.24);
          }
          .stage-button--secondary {
            background: rgba(30, 41, 59, 0.08);
            color: #1e293b;
          }
          .stage-button--secondary:not(:disabled):hover {
            background: rgba(30, 41, 59, 0.16);
            transform: translateY(-1px);
          }
          .stage-button--ghost {
            background: transparent;
            color: #1e293b;
          }
          .stage-button--ghost:not(:disabled):hover {
            color: #0f172a;
          }
          .stage-alert {
            margin-top: 18px;
            width: 100%;
            border-radius: 12px;
            padding: 12px 18px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
          }
          .stage-alert--success {
            color: #166534;
            background: rgba(34, 197, 94, 0.12);
            border: 1px solid rgba(34, 197, 94, 0.35);
          }
          .stage-alert--error {
            color: #b91c1c;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.35);
          }
          .stage-alert--info {
            color: #1d4ed8;
            background: rgba(59, 130, 246, 0.12);
            border: 1px solid rgba(59, 130, 246, 0.28);
          }
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
