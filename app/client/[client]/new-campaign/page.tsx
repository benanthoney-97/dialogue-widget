"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "../Sidebar";
import PurposeCard from "../../../components/PurposeCard";
import ExecutiveAgent from "@/app/components/BriefingAgent";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import { supabase } from "@/app/lib/supabaseClient";
import { slugify } from "@/app/lib/jump";

const GUIDANCE_AUDIENCE_MAP: Record<string, string> = {
  Prepare: "Personal",
  Learn: "Personal",
  Review: "Team",
  "Go-to-market": "Client",
};

const STAGE_CHIPS = ["Basic Info", "Documents", "Personas", "Objective", "Questions", "Output"];
const OUTPUT_OPTIONS = [
  {
      id: "text",
      title: "Text Response",
      description:
        "Rich qualitative insight or narrative feedback generated from the interview.",
    },
    {
      id: "yesno",
      title: "Yes/No",
      description: "A quick binary verdict to validate assumptions or direction.",
    },
    {
      id: "number",
      title: "Number",
      description:
        "A measurable score or estimate to quantify confidence, impact, or preference.",
    },
  ] as const;
type OutputOptionId = (typeof OUTPUT_OPTIONS)[number]["id"];
const OUTPUT_PLACEHOLDER_MAP: Record<OutputOptionId, string> = {
  text: "text output",
  yesno: "Yes/No output",
  number: "numerical output",
};
type PrimitiveOutputType = "string" | "boolean" | "number";
const OUTPUT_TYPE_MAP: Record<OutputOptionId, PrimitiveOutputType> = {
  text: "string",
  yesno: "boolean",
  number: "number",
};
type PersonaCardData = {
  id: string;
  name: string;
  title: string;
  image?: string | null;
  agentId?: string | null;
};
const DEFAULT_PERSONA_OPTIONS: PersonaCardData[] = [
  { id: "bella", name: "Bella Thomas", title: "Single Mum of 2", agentId: null },
  { id: "jane", name: "Jane Doe", title: "Head of Procurement", agentId: null },
] as const;
const getPersonaIdentity = (persona: PersonaCardData): string => persona.agentId ?? persona.id;
const MAX_OUTPUTS = 3;
const renderOutputIcon = (optionId: string) => {
  if (optionId === "yesno") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="#0a2540"
        className="bi bi-signpost-split-fill"
        viewBox="0 0 16 16"
      >
        <path d="M7 16h2V6h5a1 1 0 0 0 .8-.4l.975-1.3a.5.5 0 0 0 0-.6L14.8 2.4A1 1 0 0 0 14 2H9v-.586a1 1 0 0 0-2 0V7H2a1 1 0 0 0-.8.4L.225 8.7a.5.5 0 0 0 0 .6l.975 1.3a1 1 0 0 0 .8.4h5z" />
      </svg>
    );
  }
  if (optionId === "number") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        fill="#0a2540"
        className="bi bi-123"
        viewBox="0 0 16 16"
      >
        <path d="M2.873 11.297V4.142H1.699L0 5.379v1.137l1.64-1.18h.06v5.961zm3.213-5.09v-.63c0-.618.44-1.169 1.196-1.169.676 0 1.174.44 1.174 1.106 0 .624-.42 1.101-.807 1.526L4.99 10.553v.744h4.78v-.99H6.643v-.069L8.41 8.252c.65-.724 1.237-1.332 1.237-2.27C9.646 4.849 8.723 4 7.308 4c-1.573 0-2.36 1.064-2.36 2.15v.057zm6.559 1.883h.786c.823 0 1.374.481 1.379 1.179.01.707-.55 1.216-1.421 1.21-.77-.005-1.326-.419-1.379-.953h-1.095c.042 1.053.938 1.918 2.464 1.918 1.478 0 2.642-.839 2.62-2.144-.02-1.143-.922-1.651-1.551-1.714v-.063c.535-.09 1.347-.66 1.326-1.678-.026-1.053-.933-1.855-2.359-1.845-1.5.005-2.317.88-2.348 1.898h1.116c.032-.498.498-.944 1.206-.944.703 0 1.206.435 1.206 1.07.005.64-.504 1.106-1.2 1.106h-.75z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="#0a2540"
      className="bi bi-justify"
      viewBox="0 0 16 16"
    >
      <path
        fillRule="evenodd"
        d="M2 12.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5m0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5m0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5m0-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5"
      />
    </svg>
  );
};
const KEY_TRAIT_PLACEHOLDERS = [
  "Age range",
  "Location",
  "Gender",
  "No. employees",
  "Company Turnover",
] as const;
const CUSTOM_KEY_TRAIT_PLACEHOLDER = "Custom trait";
type KeyTrait = { id: string; placeholder: string; value: string };
const DEFAULT_KEY_TRAITS: KeyTrait[] = KEY_TRAIT_PLACEHOLDERS.map((placeholder) => ({
  id: placeholder.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  placeholder,
  value: "",
}));

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

function extractMimeFromDataUrl(dataUrl: string | null): string | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(.*?);/);
  return match ? match[1] : null;
}

function buildPersonaImageFileName(file: File | null, dataUrl: string | null): string {
  if (file?.name && file.name.trim().length > 0) {
    return file.name.trim();
  }
  const mime = extractMimeFromDataUrl(dataUrl) ?? "image/png";
  const extension = mime.includes("/") ? mime.split("/").pop() : "png";
  return `persona-image-${Date.now()}.${extension ?? "png"}`;
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

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(kb)} KB`;
}

function normalizeFileType(file: File): string {
  if (file.type) {
    return file.type.replace(/^.*\//, '').toUpperCase();
  }
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
}

function mergeFileLists(existing: File[], additions: File[]): File[] {
  if (additions.length === 0) return existing;
  const map = new Map<string, File>();
  existing.forEach(file => map.set(fileKey(file), file));
  additions.forEach(file => map.set(fileKey(file), file));
  return Array.from(map.values());
}

type StagePanelProps = {
  heading?: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children, className = "" }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className={`stage-panel ${className}`.trim()}>
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

export default function UploadPage() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [fileUrl, setFileUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const personaImageInputRef = useRef<HTMLInputElement | null>(null);
  const [personaImageFile, setPersonaImageFile] = useState<File | null>(null);
  const [tempId, setTempId] = useState<string | null>(null);
  const [createdDocs, setCreatedDocs] = useState<StagedDoc[]>([]);
  const [briefingConversationId, setBriefingConversationId] = useState<string | null>(null);
  const [briefingEndedAt, setBriefingEndedAt] = useState<number | null>(null);
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

  function loadPersonaImageFile(file: File | null) {
    if (!file) {
      setPersonaImagePreview(null);
      setPersonaImageFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      return;
    }
    setPersonaImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setPersonaImagePreview(result);
    };
    reader.readAsDataURL(file);
  }

  function handlePersonaImageInput(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files && event.target.files[0];
    loadPersonaImageFile(nextFile ?? null);
    event.target.value = "";
  }

  function handlePersonaImageDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    const dropped = event.dataTransfer.files && event.dataTransfer.files[0];
    if (dropped) {
      loadPersonaImageFile(dropped);
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
    if (!match) return "";
    const rawSlug = match[1];
    try {
      return decodeURIComponent(rawSlug);
    } catch {
      return rawSlug;
    }
  }
  const clientSlug = getClientSlug(pathname);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  useEffect(() => {
    if (!clientSlug) {
      setResolvedClientId(null);
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(clientSlug)) {
      setResolvedClientId(clientSlug);
      return;
    }
    setResolvedClientId(null);
  }, [clientSlug]);

  useEffect(() => {
    if (!clientSlug) {
      setPersonaCards(DEFAULT_PERSONA_OPTIONS);
      return;
    }
    let isActive = true;
    async function loadPersonas() {
      try {
        const response = await fetch(`/api/clients/${encodeURIComponent(clientSlug)}/personas`);
        if (!isActive) return;
        if (!response.ok) {
          throw new Error(`Failed to load personas: ${response.status}`);
        }
        const payload = (await response.json().catch(() => null)) as
          | { clientId?: string | null; personas?: PersonaCardData[] }
          | null;
        if (!isActive) return;
        if (payload?.clientId) {
          setResolvedClientId((prev) => prev ?? payload.clientId ?? null);
        }
        if (Array.isArray(payload?.personas) && payload.personas.length > 0) {
          setPersonaCards(payload.personas);
          return;
        }
        setPersonaCards(DEFAULT_PERSONA_OPTIONS);
      } catch (error) {
        console.error("[new-campaign] failed to load personas", error);
        if (isActive) {
          setPersonaCards(DEFAULT_PERSONA_OPTIONS);
        }
      }
    }
    loadPersonas();
    return () => {
      isActive = false;
    };
  }, [clientSlug]);
  async function stageFiles() {
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
        setInternalPanelExpanded(false);
  await handleFinalize({ docsOverride: stagedDocs, tempIdOverride: groupTempId });
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
        setInternalPanelExpanded(false);
  await handleFinalize({ docsOverride: [stagedDoc], tempIdOverride: groupTempId });
      } else {
        setTempId(null);
        setCreatedDocs([]);
        await handleFinalize();
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setNotification({ type: 'error', message: `Failed to stage files: ${msg}` });
    } finally {
      setSubmitted(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await stageFiles();
  }

  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Basic Info, 1: Documents, 2: Personas, 3: Objective, 4: Questions, 5: Output
  const [personaName, setPersonaName] = useState<string>("");
  const [personaNameTouched, setPersonaNameTouched] = useState<boolean>(false);
  const [selectedGuidance, setSelectedGuidance] = useState<string | null>(null);
  const [personaTagline, setPersonaTagline] = useState<string>("");
  const [keyTraits, setKeyTraits] = useState<KeyTrait[]>(DEFAULT_KEY_TRAITS);
  const [editingKeyTraitId, setEditingKeyTraitId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string>("");
  const [campaignTags, setCampaignTags] = useState<string[]>([]);

  function handleKeyTraitChange(id: string, value: string) {
    setKeyTraits((prev) =>
      prev.map((trait) => (trait.id === id ? { ...trait, value } : trait))
    );
  }

  function handleRemoveKeyTrait(id: string) {
    setKeyTraits((prev) => prev.filter((trait) => trait.id !== id));
    if (editingKeyTraitId === id) {
      setEditingKeyTraitId(null);
    }
  }

  function handleAddKeyTrait() {
    const newTrait: KeyTrait = {
      id: `custom-${Date.now()}`,
      placeholder: CUSTOM_KEY_TRAIT_PLACEHOLDER,
      value: "",
    };
    setKeyTraits((prev) => [...prev, newTrait]);
    setEditingKeyTraitId(newTrait.id);
  }
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
  const [linksUrl, setLinksUrl] = useState<string>("");
  const [linksUrls, setLinksUrls] = useState<string[]>([]);
  const questionInputRef = useRef<HTMLInputElement | null>(null);
  const [personaCards, setPersonaCards] = useState<PersonaCardData[]>(DEFAULT_PERSONA_OPTIONS);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>(() => [getPersonaIdentity(DEFAULT_PERSONA_OPTIONS[0])]);
  const hasPersonaSelection = selectedPersonaIds.length > 0;
  useEffect(() => {
    setKnowledgePanelExpanded(linksUrls.length > 0);
  }, [linksUrls.length]);
  const canAddCurrentLink = !!linksUrl.trim() && !linksUrls.includes(linksUrl.trim());
  function addQuestionToList(question: string): boolean {
    const trimmed = question.trim();
    if (!trimmed) {
      return false;
    }
    let added = false;
    setLinksUrls((prev) => {
      if (prev.includes(trimmed)) {
        return prev;
      }
      added = true;
      return [...prev, trimmed];
    });
    return added;
  }

  function addQuestionsToList(questions: string[]) {
    if (questions.length === 0) return;
    setLinksUrls((prev) => {
      const next = [...prev];
      const seen = new Set(prev);
      questions.forEach((item) => {
        const trimmed = item.trim();
        if (!trimmed || seen.has(trimmed)) {
          return;
        }
        seen.add(trimmed);
        next.push(trimmed);
      });
      return next;
    });
  }

  function handleAddLink() {
    const added = addQuestionToList(linksUrl);
    setLinksUrl("");
    questionInputRef.current?.focus();
    return added;
  }

  function splitQuestionsFromPaste(text: string) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function handleQuestionPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    const questions = splitQuestionsFromPaste(pasted);
    if (questions.length <= 1) return;
    event.preventDefault();
    addQuestionsToList(questions);
    setLinksUrl("");
    questionInputRef.current?.focus();
  }
  function handleRemoveLink(target: string) {
    setLinksUrls((prev) => prev.filter((url) => url !== target));
  }
  function stageLinks() {
    if (linksUrls.length === 0) return;
    setKnowledgePanelExpanded(false);
    setKnowledgePanelCompleted(true);
    setCurrentStep(5);
  }
  useEffect(() => {
    if (personaCards.length === 0) {
      setSelectedPersonaIds([]);
      return;
    }
    setSelectedPersonaIds((prev) => {
      const available = new Set(personaCards.map((card) => getPersonaIdentity(card)));
      const filtered = prev.filter((id) => available.has(id));
      if (filtered.length > 0) {
        return filtered;
      }
      return [getPersonaIdentity(personaCards[0])];
    });
  }, [personaCards]);

  const [outputDescription, setOutputDescription] = useState<string>("");
  const [selectedOutputType, setSelectedOutputType] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("selectedOutputType");
    }
    return null;
  });
  const [savedOutputs, setSavedOutputs] = useState<{ type: OutputOptionId; description: string }[]>([]);
  const canSkipUpload = isDescribeMode;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedOutputType) {
      window.sessionStorage.setItem("selectedOutputType", selectedOutputType);
    } else {
      window.sessionStorage.removeItem("selectedOutputType");
    }
  }, [selectedOutputType]);
  const selectedOutputOption = selectedOutputType
    ? OUTPUT_OPTIONS.find((option) => option.id === selectedOutputType) ?? null
    : null;
  const [editingOutputIndex, setEditingOutputIndex] = useState<number | null>(null);
  const hasReachedOutputLimit = savedOutputs.length >= MAX_OUTPUTS;
  const canAddMoreOutputs = editingOutputIndex !== null || !hasReachedOutputLimit;
  const hasOutputDescription = outputDescription.trim().length > 0;
  const hasSavedOutputs = savedOutputs.length > 0;
  function resetOutputSelection() {
    setSelectedOutputType(null);
    setOutputDescription("");
  }

  function editSavedOutput(index: number) {
    const entry = savedOutputs[index];
    setSelectedOutputType(entry.type);
    setOutputDescription(entry.description);
    setEditingOutputIndex(index);
  }

  function removeSavedOutput(index: number) {
    setSavedOutputs((prev) => prev.filter((_, idx) => idx !== index));
    setEditingOutputIndex((prev) => {
      if (prev === null) {
        return null;
      }
      if (prev === index) {
        resetOutputSelection();
        return null;
      }
      if (prev > index) {
        return prev - 1;
      }
      return prev;
    });
  }

  function commitOutput(advance = false) {
    if (!selectedOutputOption) {
      if (advance) {
        setCurrentStep(1);
      }
      return;
    }
    const trimmedDescription = outputDescription.trim();
    setSavedOutputs((prev) => {
      if (editingOutputIndex !== null) {
        const updated = [...prev];
        updated[editingOutputIndex] = {
          type: selectedOutputOption.id,
          description: trimmedDescription,
        };
        return updated;
      }
      if (!canAddMoreOutputs) {
        return prev;
      }
      return [...prev, { type: selectedOutputOption.id, description: trimmedDescription }];
    });
    resetOutputSelection();
    setEditingOutputIndex(null);
    if (advance) {
      setCurrentStep(1);
    }
  }
  const personaNameTrimmed = personaName.trim();
  const personaTaglineTrimmed = personaTagline.trim();
  const personaNameDisplay = personaNameTrimmed || "Campaign name";
  const personaNameHeadline = personaNameTrimmed || "campaign name";
  const personaNamePossessive = personaNameTrimmed ? `${personaNameTrimmed}'s` : "campaign name's";
  const personaNameFormId = "persona-name-form";
  const personaImageInputId = "persona-image-upload";
  const [personaDescription, setPersonaDescription] = useState<string>("");
  const personaDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const handleDescriptionLinkClick = () => {
    setCurrentStep(3);
    if (currentStep === 3 && personaDescriptionRef.current) {
      personaDescriptionRef.current.focus();
    }
  };
  const sidebarDescriptionText = personaTaglineTrimmed;
  const [activeResourceDetail, setActiveResourceDetail] = useState<"description" | "">("");
  const personaDescriptionHasContent = Boolean(personaDescription.trim());
  const internalDataHasContent = files.length > 0;
  const knowledgeLinksHaveContent = linksUrls.length > 0;
  const [knowledgePanelExpanded, setKnowledgePanelExpanded] = useState(false);
  const [knowledgePanelCompleted, setKnowledgePanelCompleted] = useState(false);
  const joinClasses = (...classes: (string | false | undefined)[]) =>
    classes.filter(Boolean).join(" ");
  const toggleResourceDetail = (panel: "description") => {
    setActiveResourceDetail((prev) => (prev === panel ? "" : panel));
  };
  const toggleKnowledgePanel = () => {
    if (linksUrls.length === 0) return;
    setKnowledgePanelExpanded((prev) => !prev);
  };

  useEffect(() => {
    if (currentStep === 3 && personaDescriptionRef.current) {
      personaDescriptionRef.current.focus();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 4 && questionInputRef.current) {
      questionInputRef.current.focus();
    }
  }, [currentStep]);

  const descriptionPanelClass = joinClasses(
    "upload-layout__resource-description",
    activeResourceDetail === "description"
      ? "upload-layout__resource-description--active"
      : "upload-layout__resource-description--collapsed",
    personaDescriptionHasContent
      ? "upload-layout__resource-description--completed"
      : "upload-layout__resource-description--empty"
  );
  const [internalPanelExpanded, setInternalPanelExpanded] = useState(false);
  useEffect(() => {
    setInternalPanelExpanded(files.length > 0);
  }, [files.length]);
  const internalDataPanelClass = joinClasses(
    "upload-layout__internal-data",
    internalPanelExpanded ? "upload-layout__internal-data--expanded" : "upload-layout__internal-data--collapsed",
    internalDataHasContent ? "upload-layout__data--completed" : "upload-layout__data--empty"
  );
  const knowledgeLinksPanelClass = joinClasses(
    "upload-layout__knowledge-links",
    knowledgePanelExpanded
      ? "upload-layout__knowledge-links--expanded"
      : "upload-layout__knowledge-links--collapsed",
    knowledgePanelCompleted
      ? "upload-layout__knowledge-links--completed"
      : knowledgeLinksHaveContent
      ? "upload-layout__knowledge-links--filled"
      : "upload-layout__knowledge-links--empty"
  );
  const RESOURCE_TABS = ["Link", "QR Code", "Phone call"] as const;
  type ResourceTab = (typeof RESOURCE_TABS)[number];
  const [selectedResourceTab, setSelectedResourceTab] = useState<ResourceTab>("Link");
  const personaRoleDisplay = personaTaglineTrimmed || "Their role";
  const [personaImagePreview, setPersonaImagePreview] = useState<string | null>(null);
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);

  const resourceImageStyle = personaImagePreview
    ? {
        backgroundImage: `url(${personaImagePreview})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  async function waitForClientId(): Promise<string | null> {
    if (resolvedClientId) return resolvedClientId;
    const start = Date.now();
    const timeout = 3000;
    while (!resolvedClientId && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return resolvedClientId;
  }

async function createCampaignRecord(docsPayload: StagedDoc[], campaignTags: string[]): Promise<string> {
    if (createdCampaignId) {
      return createdCampaignId;
    }
    const clientId = await waitForClientId();
    if (!clientId) {
      console.error("createCampaignRecord missing resolved client", {
        clientSlug,
        resolvedClientId,
        personaNameTrimmed,
        selectedPersonaIds,
        linksUrls,
      });
      throw new Error("Client context missing");
    }
    if (!personaNameTrimmed) {
      throw new Error("Campaign name is required");
    }
    const outputsPayload = savedOutputs.map((entry) => ({
      type: OUTPUT_TYPE_MAP[entry.type] ?? "string",
      description: entry.description,
    }));
    const personaIdsPayload = Array.from(new Set(selectedPersonaIds.filter(Boolean)));
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.warn("Failed to resolve user for campaign creation", userError);
    }
    const personaImageUploadPayload = personaImagePreview
      ? {
          fileName: buildPersonaImageFileName(personaImageFile, personaImagePreview),
          dataUrl: personaImagePreview,
          mimeType: personaImageFile?.type ?? extractMimeFromDataUrl(personaImagePreview) ?? undefined,
        }
      : null;

    const documentsUploadPayload = Array.isArray(docsPayload) && docsPayload.length > 0 ? docsPayload : null;

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        name: personaNameTrimmed,
        description: personaTaglineTrimmed || null,
        objective: personaDescription.trim() || null,
        questions: linksUrls,
        outputs: outputsPayload,
        personaIds: personaIdsPayload,
        clientSlug,
        createdBy: userData?.user?.id ?? null,
        documentIds: [],
        personaImageUpload: personaImageUploadPayload,
        documentsUpload: documentsUploadPayload,
        tags: campaignTags,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { id?: string; agentId?: string; error?: string }
      | null;
    if (!response.ok) {
      const msg =
        payload && typeof payload === "object" && typeof payload.error === "string"
          ? payload.error
          : `Server error: ${response.status}`;
      throw new Error(msg);
    }
    if (!payload?.id) {
      throw new Error("Failed to create campaign record");
    }
    setCreatedCampaignId(payload.id);
    return payload.id;
  }

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
  }, [clientSlug]);

  useEffect(() => {
    if (selectedGuidance === 'Describe persona' && currentStep === 2) {
      setCurrentStep(5);
    }
  }, [selectedGuidance, currentStep]);

  useEffect(() => {
    if (hasHydratedFromParams.current) return;
    const stageParam = searchParams?.get("stage");
    const purposeParam = searchParams?.get("purpose");
    if (!stageParam && !purposeParam) return;
    hasHydratedFromParams.current = true;

    if (stageParam === "upload") {
      setCurrentStep(4);
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
  type FinalizeOptions = {
    docsOverride?: StagedDoc[];
    tempIdOverride?: string | null;
  };

  async function handleFinalize(options?: FinalizeOptions) {
    if (finalizing) return;
    // Make sure purpose and settings are saved first
    const okPurpose = await savePurpose();
    if (!okPurpose) return;

    const docsOverride = options?.docsOverride;
    const docsSource = Array.isArray(docsOverride) ? docsOverride : createdDocs;
    const docsAvailable = Array.isArray(docsSource) && docsSource.length > 0;
    const briefingAvailable = Boolean(briefingConversationId && briefingEndedAt);
    const effectiveTempId = options?.tempIdOverride ?? tempId;
    if (docsAvailable && !effectiveTempId) {
      setNotification({ type: 'error', message: 'Upload session expired. Please re-upload your documents.' });
      return;
    }

    const docsPayload: StagedDoc[] = docsAvailable ? [...docsSource] : [];
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

    let campaignId = createdCampaignId;

    const keyTraitsPayload = keyTraits
      .map((trait) => trait.value.trim())
      .filter((value) => value.length > 0);

    if (!campaignId) {
      try {
        campaignId = await createCampaignRecord(docsPayload, campaignTags);
      } catch (err: any) {
        const message =
          err && typeof err === "object" && "message" in err
            ? (err as Error).message
            : "Failed to create campaign record";
        setNotification({ type: "error", message });
        setFinalizing(false);
        return;
      }
    }

    console.log("[Upload] Starting persona create flow", {
      personaName: personaNameDisplay,
      personaTagline: personaTagline.trim(),
      linksCount: linksUrls.length,
      keyTraits: keyTraitsPayload,
    });
    setFinalizing(true);

    setNotification({ type: 'success', message: 'Campaign created successfully.' });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem('temp-upload-docs');
      sessionStorage.removeItem('temp-upload-purpose');
    }
    setFinalizing(false);
    router.push(`/client/${clientSlug}/campaigns`);
  }

  return (
    <>
      <main className="upload-layout" style={{ fontFamily: BODY_FONT_STACK }}>
        <aside className="upload-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="upload-layout__content">
          <div className="stage-shell">
            <div className="stage-chip-row" role="list">
              {STAGE_CHIPS.map((label, index) => {
                const completed = index < currentStep;
                const isCurrent = index === currentStep;
                const classes = [
                  "stage-chip",
                  completed ? "stage-chip--complete" : "",
                  !completed && isCurrent ? "stage-chip--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div key={label} role="listitem" className={classes}>
                    {label}
                  </div>
                );
              })}
            </div>
            {currentStep === 0 && (
              <StagePanel
                footer={
                  <div className="stage-button-row stage-button-row--with-back">
                    <span className="stage-button-note">
                      Don't worry, you can edit these later
                    </span>
                    <StageButton
                      type="submit"
                      form={personaNameFormId}
                      variant="primary"
                      disabled={!personaNameTrimmed || !personaTaglineTrimmed}
                      style={{ width: "25%" }}
                    >
                      Continue
                    </StageButton>
                  </div>
                }
              >
                <>
                  <form
                    id={personaNameFormId}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const nextName = personaName.trim();
                      if (!nextName) {
                        setPersonaNameTouched(true);
                        return;
                      }
                      setPersonaName(nextName);
                      setPersonaNameTouched(false);
                      setCurrentStep(1);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Campaign name</span>
                      <input
                        type="text"
                        value={personaName}
                        onChange={(event) => {
                          setPersonaName(event.target.value);
                          if (!personaNameTouched) {
                            setPersonaNameTouched(true);
                          }
                        }}
                        onBlur={() => setPersonaNameTouched(true)}
                        placeholder="New Customer Interview Campaign"
                        maxLength={120}
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: personaNameTouched && !personaNameTrimmed
                            ? "2px solid rgba(220, 38, 38, 0.65)"
                            : "2px solid rgba(30, 41, 59, 0.18)",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#0f172a",
                          background: "rgba(255,255,255,0.9)",
                          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                          transition: "border 0.18s ease, box-shadow 0.18s ease",
                        }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Campaign description</span>
                      <input
                        type="text"
                        value={personaTagline}
                        onChange={(event) => setPersonaTagline(event.target.value)}
                        placeholder="Summarise the campaign’s goal, audience, or key focus in a sentence"
                        maxLength={120}
                        style={{
                          width: "100%",
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: "2px solid rgba(30, 41, 59, 0.18)",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#0f172a",
                          background: "rgba(255,255,255,0.9)",
                          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                          transition: "border 0.18s ease, box-shadow 0.18s ease",
                        }}
                      />
                    </label>
                  </form>
                  <label
                    className="image-stage-placeholder image-stage-placeholder--basic-info"
                    htmlFor={personaImageInputId}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handlePersonaImageDrop}
                    aria-label="Upload persona image"
                    style={{ marginTop: 16 }}
                  >
                    <input
                      id={personaImageInputId}
                      ref={personaImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePersonaImageInput}
                        style={{ display: "none" }}
                      />
                    <div className="image-stage-placeholder__icon" aria-hidden="true">
                      {personaImagePreview ? (
                        <img src={personaImagePreview} alt="Persona preview" />
                      ) : (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 16 16"
                          fill="#22325a"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5" />
                          <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z" />
                        </svg>
                      )}
                    </div>
                    <div className="image-stage-placeholder__copy">
                      <p className="image-stage-placeholder__title">
                        {personaImagePreview ? "Change image" : "Click or drop an image"}
                      </p>
                      <p className="image-stage-placeholder__hint">PNG, JPG, or GIF up to 5MB</p>
                    </div>
                  </label>
                </>
              </StagePanel>
            )}
              {currentStep === 1 && (
                <StagePanel heading="Upload context documents for your AI interviewer">
                  <form onSubmit={handleSubmit} style={{ width: "100%" }}>
                    {uploadMode === "upload" ? (
                      <label
                        htmlFor="file-upload"
                        className="image-stage-placeholder data-upload-placeholder"
                        style={{
                          minHeight: files.length > 0 ? 218 : 186,
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            const dropped = Array.from(e.dataTransfer.files);
                            setFiles((prev) => mergeFileLists(prev, dropped));
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
                          style={{ display: "none" }}
                        />
                        {files.length === 0 ? (
                          <>
                            <div className="data-upload-placeholder__heading">Drag & drop files here</div>
                            <div className="data-upload-placeholder__subheading">
                              or <span className="data-upload-placeholder__link">click to select from computer</span>
                            </div>
                            <div className="data-upload-placeholder__types">
                              {["PDF", "TXT", "DOCX", "HTML"].map((type) => (
                                <span key={type} className="data-upload-placeholder__chip">
                                  {type}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <ul
                              style={{
                                color: "#a3c0ff",
                                fontSize: 15,
                                paddingLeft: 0,
                                margin: 0,
                                width: "100%",
                                display: "flex",
                                gap: 12,
                                overflowX: "auto",
                                alignItems: "center",
                              }}
                            >
                              {files.map((file, idx) => (
                                <li
                                  key={idx}
                                  style={{
                                    marginBottom: 6,
                                    flexGrow: 0,
                                    flexShrink: 0,
                                    flexBasis: "130px",
                                    width: "130px",
                                    maxWidth: "130px",
                                    boxSizing: "border-box",
                                    height: 186,
                                    borderTop: idx > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                                    paddingTop: 8,
                                    listStyle: "none",
                                  }}
                                >
                                  <div
                                    style={{
                                      position: "relative",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      height: "100%",
                                      padding: "30px 12px 24px",
                                      borderRadius: 10,
                                      background: "rgba(255,255,255,0.02)",
                                      border: "1px solid #1e293b",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-start",
                                        gap: 12,
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: 36,
                                          height: 36,
                                          flex: "0 0 36px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderRadius: 6,
                                        }}
                                      >
                                        <svg
                                          width="20"
                                          height="20"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                          aria-hidden="true"
                                          focusable="false"
                                        >
                                          <path
                                            d="M6 6L18 18M6 18L18 6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                          />
                                        </svg>
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                          title={file.name}
                                          style={{
                                            maxWidth: "100%",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            fontSize: 12,
                                            color: "#1e293b",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {file.name.length > 12 ? `${file.name.slice(0, 12)}…` : file.name}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            color: "#1e293b",
                                            marginTop: 4,
                                            textAlign: "left",
                                          }}
                                        >
                                          {file.type ? file.type : `${(file.size / 1024).toFixed(0)} KB`}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFile(idx)}
                                      aria-label="Remove file"
                                      title="Remove"
                                      style={{
                                        position: "absolute",
                                        top: -12,
                                        right: -12,
                                        width: 30,
                                        height: 30,
                                        borderRadius: "50%",
                                        background: "#1e293b",
                                        border: "1px solid rgba(255,255,255,0.04)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#9fb3ff",
                                        cursor: "pointer",
                                        padding: 0,
                                        zIndex: 5,
                                        boxShadow: "0 6px 16px rgba(2,6,23,0.45)",
                                      }}
                                    >
                                      <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        xmlns="http://www.w3.org/2000/svg"
                                        aria-hidden="true"
                                        focusable="false"
                                      >
                                        <path
                                          d="M6 6L18 18M6 18L18 6"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          fill="none"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </li>
                              ))}
                              <li
                                style={{
                                  listStyle: "none",
                                  marginBottom: 6,
                                  flexGrow: 0,
                                  flexShrink: 0,
                                  flexBasis: "130px",
                                  width: "130px",
                                  maxWidth: "130px",
                                  boxSizing: "border-box",
                                  height: 186,
                                  paddingTop: 8,
                                }}
                              >
                                <div
                                  style={{
                                    position: "relative",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: 12,
                                    height: "100%",
                                    padding: "30px 12px 24px",
                                    borderRadius: 10,
                                    background: "rgba(255,255,255,0.02)",
                                    border: "1px dashed #1e293b",
                                    color: "#1e293b",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    textAlign: "center",
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
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "2px dashed #2d406b",
                          background: "#22325a",
                          borderRadius: 12,
                          padding: 0,
                          marginBottom: 22,
                          color: "#a3c0ff",
                          fontSize: 16,
                          fontWeight: 600,
                          minHeight: 186,
                          width: "100%",
                          textAlign: "center",
                        }}
                      >
                        <input
                          type="url"
                          value={fileUrl}
                          onChange={(e) => {
                            setFileUrl(e.target.value);
                            setNotification(null); // Clear notification on new URL
                          }}
                          placeholder="Paste file URL here..."
                          style={{
                            width: "80%",
                            padding: "12px 14px",
                            borderRadius: 8,
                            border: "1px solid #2d406b",
                            fontSize: 15,
                            color: "#a3c0ff",
                            background: "#192447",
                            marginBottom: 0,
                          }}
                        />
                      </div>
                    )}
                    {submitted && !notification && (
                      <StageAlert type="info" message="Stay on the page while document is uploading." />
                    )}
                    {notification && <StageAlert type={notification.type} message={notification.message} />}
                  </form>
                  <div className="stage-button-row stage-button-row--with-back" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="stage-back"
                      onClick={() => setCurrentStep(0)}
                      style={{ width: "25%" }}
                    >
                      Back
                    </button>
                    <div className="stage-button-row__group" style={{ flex: "0 0 25%" }}>
                      <StageButton
                        type="button"
                        variant="primary"
                        onClick={() => setCurrentStep(2)}
                        disabled={finalizing || files.length === 0}
                      >
                        Continue
                      </StageButton>
                    </div>
                  </div>
                </StagePanel>
              )}
            {currentStep === 2 && (
              <StagePanel
                heading="Add personas to this campaign"
                subheading="Each persona will get a unique link to simplify tracking"
                footer={
                  <div className="stage-button-row stage-button-row--with-back">
                    <button
                      type="button"
                      className="stage-back"
                      onClick={() => setCurrentStep(1)}
                      style={{ width: "25%" }}
                    >
                      Back
                    </button>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (!hasPersonaSelection) return;
                        setCurrentStep(3);
                      }}
                      disabled={!hasPersonaSelection}
                      style={{ width: "25%" }}
                    >
                      Continue
                    </StageButton>
                  </div>
                }
              >
            <div className="personas-stage__grid" role="list">
              {personaCards.map((persona) => {
                    const personaIdentity = getPersonaIdentity(persona);
                    const isSelected = selectedPersonaIds.includes(personaIdentity);
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        role="listitem"
                        className={`personas-stage__card${isSelected ? " personas-stage__card--active" : ""}`}
                        onClick={() => {
                          setSelectedPersonaIds((prev) =>
                            prev.includes(personaIdentity)
                              ? prev.filter((id) => id !== personaIdentity)
                              : [...prev, personaIdentity]
                          );
                        }}
                        aria-pressed={isSelected}
                      >
                        <div
                          className="personas-stage__card-image"
                          aria-hidden="true"
                          style={
                            persona.image
                              ? { backgroundImage: `url(${persona.image})`, backgroundSize: "cover" }
                              : undefined
                          }
                        />
                        <div>
                          <p className="personas-stage__card-name">{persona.name}</p>
                          <p className="personas-stage__card-title">{persona.title}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
              <div
                style={{
                  marginTop: 24,
                  padding: "16px",
                  borderRadius: 12,
                  border: "1px dashed rgba(15, 23, 42, 0.2)",
                  background: "#f8f9ff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 16 }}>Use tags instead of personas</h3>
                  <button
                    type="button"
                    onClick={() => setCampaignTags([])}
                    style={{
                      fontSize: 12,
                      color: "#155EEF",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    color: "rgba(15, 23, 42, 0.6)",
                  }}
                >
                  Use tags (e.g., “Female customers in London, “Power users”) to track the campaign instead of creating personas.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {campaignTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(31, 41, 55, 0.08)",
                        color: "#0f172a",
                        fontSize: 12,
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => setCampaignTags((prev) => prev.filter((value) => value !== tag))}
                        style={{
                          border: "none",
                          background: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "#0f172a",
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && tagInput.trim()) {
                        event.preventDefault();
                        const normalized = tagInput.trim();
                        if (!campaignTags.includes(normalized)) {
                          setCampaignTags((prev) => [...prev, normalized]);
                        }
                        setTagInput("");
                      }
                    }}
                    placeholder="Add a tag and press Enter"
                    style={{
                      border: "1px solid rgba(15,23,42,0.22)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 13,
                      flex: "1 1 180px",
                    }}
                  />
                </div>
              </div>
            </StagePanel>
          )}
            {currentStep === 3 && (
              <StagePanel
                className="stage-panel--align-left"
                footer={
                  <div className="stage-button-row stage-button-row--with-back">
                    <button
                      type="button"
                      className="stage-back"
                      onClick={() => setCurrentStep(2)}
                      style={{ width: "25%" }}
                    >
                      Back
                    </button>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (!personaDescriptionHasContent) return;
                        setCurrentStep(4);
                      }}
                      disabled={!personaDescriptionHasContent}
                      style={{ width: "25%" }}
                    >
                      Continue
                    </StageButton>
                  </div>
                }
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="persona-description-input-label">Campaign objective</span>
                  <textarea
                    ref={personaDescriptionRef}
                    value={personaDescription}
                    onChange={(event) => setPersonaDescription(event.target.value)}
                    onFocus={() => setActiveResourceDetail("description")}
                    onBlur={() => setActiveResourceDetail("")}
                    placeholder="Summarise the campaign’s goal, desired impact, and target audience."
                    rows={3}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      borderRadius: 12,
                      border: "1px solid rgba(30, 41, 59, 0.18)",
                      padding: "14px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#0f172a",
                      background: "rgba(255,255,255,0.9)",
                      boxShadow: "inset 0 1px 3px rgba(15, 23, 42, 0.08)",
                      resize: "vertical",
                    }}
                  />
                </label>
              </StagePanel>
            )}
            {currentStep === 4 && (
              <StagePanel heading={`Add critical questions for ${personaNameDisplay}`}>
                <div className="links-stage__url-input">
                  <div className="links-stage__url-wrapper">
                    <input
                      ref={questionInputRef}
                      type="text"
                      placeholder="Type a critical question"
                      value={linksUrl}
                      onChange={(event) => setLinksUrl(event.target.value)}
                      onPaste={handleQuestionPaste}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddLink();
                        }
                      }}
                    />
                    {canAddCurrentLink && (
                      <button
                        type="button"
                        className="links-stage__add-link"
                        onClick={handleAddLink}
                      >
                        Save question
                      </button>
                    )}
                  </div>
                    <p
                      className="links-stage__bulk-hint"
                      style={{ fontSize: "12px", marginTop: 8, color: "#0f172a", paddingLeft: 5 }}
                    >
                    Shortcut: Paste multiple questions
                  </p>
                  {linksUrls.length > 0 && (
                    <div className="links-stage__urls-wrapper">
                      <div className="links-stage__urls-list">
                        {linksUrls.map((url) => (
                          <div className="links-stage__url-chip" key={url}>
                            <span>{url}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${url}`}
                              onClick={() => handleRemoveLink(url)}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="stage-button-row stage-button-row--with-back" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="stage-back"
                    onClick={() => setCurrentStep(3)}
                    style={{ width: '25%' }}
                  >
                    Back
                  </button>
                  <div className="stage-button-row__group" style={{ flex: '0 0 50%' }}>
                    <StageButton
                      type="button"
                      variant="ghost"
                      className="stage-button--outline"
                      onClick={() => setCurrentStep(5)}
                      disabled={finalizing}
                    >
                      Skip
                    </StageButton>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={() => stageLinks()}
                      disabled={linksUrls.length === 0 || finalizing}
                    >
                      Continue
                    </StageButton>
                  </div>
                </div>
              </StagePanel>
            )}
            {currentStep === 5 && (
              <StagePanel heading="Choose what data is collected from interivews">
                <div className="output-stage-content">
                  {!selectedOutputOption ? (
                    canAddMoreOutputs ? (
                      <div className="output-stage-cards">
                        {OUTPUT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`output-stage-card${selectedOutputType === option.id ? " output-stage-card--active" : ""}`}
                            onClick={() => setSelectedOutputType(option.id)}
                            disabled={!canAddMoreOutputs}
                          >
                            <div className="output-stage-card__icon" aria-hidden="true">
                              {renderOutputIcon(option.id)}
                            </div>
                            <h5>{option.title}</h5>
                            <p>{option.description}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="output-stage-limit">
                        <p>
                          You’ve reached the maximum of {MAX_OUTPUTS} outputs for this campaign.
                          Review or finalize the existing entries before continuing.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="output-stage-input">
                      <div className="output-stage-selected">
                        <div className="output-stage-card__icon" aria-hidden="true">
                          {renderOutputIcon(selectedOutputOption.id)}
                        </div>
                        <div className="output-stage-selected__text">
                          <h5>{selectedOutputOption.title}</h5>
                          <p>{selectedOutputOption.description}</p>
                        </div>
                        <button
                          type="button"
                          className="output-stage-input__change"
                          onClick={resetOutputSelection}
                        >
                          Choose a different output
                        </button>
                      </div>
                      <label className="output-stage-input__label">
                        <span className="output-stage-input__label-text">
                          Output description
                        </span>
                        <textarea
                          className="output-stage-input__textarea"
                          value={outputDescription}
                          onChange={(event) => setOutputDescription(event.target.value)}
                          placeholder={
                            selectedOutputOption
                              ? `Describe the ${OUTPUT_PLACEHOLDER_MAP[selectedOutputOption.id]} you want from individual campaign interviews`
                              : "Describe the text / Yes/No / numerical output you want from individual campaign interviews"
                          }
                          rows={4}
                        />
                      </label>
                    </div>
                  )}
                </div>
                {savedOutputs.length > 0 && (
                  <div className="output-stage-saved">
                    <p className="output-stage-saved__title">Added outputs</p>
                      <ul className="output-stage-saved__list">
                        {savedOutputs.map((entry, idx) => {
                          const option = OUTPUT_OPTIONS.find((opt) => opt.id === entry.type);
                          return (
                            <li key={`${entry.type}-${idx}`} className="output-stage-saved__item">
                              <div className="output-stage-saved__row">
                                <button
                                  type="button"
                                  className="output-stage-saved__entry"
                                  onClick={() => editSavedOutput(idx)}
                                >
                                  <span className="output-stage-saved__badge">
                                    {option?.title ?? entry.type}
                                  </span>
                                  <span className="output-stage-saved__description">
                                    {entry.description || "No description provided"}
                                  </span>
                                  <span className="output-stage-saved__hint">Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="output-stage-saved__remove"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeSavedOutput(idx);
                                  }}
                                  aria-label={`Remove ${option?.title ?? entry.type} output`}
                                >
                                  ×
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                  </div>
                )}
                <div className="stage-button-row stage-button-row--with-back" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="stage-back"
                    onClick={() => setCurrentStep(4)}
                    style={{ width: '25%' }}
                  >
                    Back
                  </button>
                  <div className="stage-button-row__group" style={{ flex: '0 0 60%' }}>
                    {selectedOutputOption && (
                      <StageButton
                        type="button"
                        variant="ghost"
                        className="stage-button--outline"
                        onClick={() => commitOutput()}
                        disabled={!selectedOutputOption || !canAddMoreOutputs}
                      >
                        {hasOutputDescription ? "Save output" : "Add another output"}
                      </StageButton>
                    )}
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={() => stageFiles()}
                      disabled={!hasSavedOutputs || finalizing || submitted}
                    >
                      {finalizing ? "Creating…" : "Create Campaign"}
                    </StageButton>
                  </div>
                </div>
              </StagePanel>
            )}
          </div>
          <div className="upload-layout__separator" aria-hidden="true" />
          <div className="upload-layout__side-panel">
            <div className="upload-layout__resource-tabs" role="tablist" aria-label="Launch options">
              {RESOURCE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`upload-layout__resource-tab${selectedResourceTab === tab ? " upload-layout__resource-tab--active" : ""}`}
                  onClick={() => setSelectedResourceTab(tab)}
                  aria-pressed={selectedResourceTab === tab}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="upload-layout__resource-card" aria-label="Resource placeholder card">
              <div className="upload-layout__resource-card__image" style={resourceImageStyle}>
                <button
                  type="button"
                  className="upload-layout__resource-card__image-link"
                  onClick={handleDescriptionLinkClick}
                >
                  <div className="upload-layout__resource-card__image-overlay">
                    {selectedResourceTab === "QR Code" && (
                      <span
                        aria-hidden="true"
                        className="upload-layout__resource-card__image-icon"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="#22325A"
                          viewBox="0 0 16 16"
                        >
                          <path d="M2 2h2v2H2z" />
                          <path d="M6 0v6H0V0zM5 1H1v4h4zM4 12H2v2h2z" />
                          <path d="M6 10v6H0v-6zm-5 1v4h4v-4zm11-9h2v2h-2z" />
                          <path d="M10 0v6h6V0zm5 1v4h-4V1zM8 1V0h1v2H8v2H7V1zm0 5V4h1v2zM6 8V7h1V6h1v2h1V7h5v1h-4v1H7V8zm0 0v1H2V8H1v1H0V7h3v1zm10 1h-1V7h1zm-1 0h-1v2h2v-1h-1zm-4 0h2v1h-1v1h-1zm2 3v-1h-1v1h-1v1H9v1h3v-2zm0 0h3v1h-2v1h-1zm-4-1v1h1v-2H7v1z" />
                          <path
                            fillRule="evenodd"
                            d="M7 12h1v3h4v1H7zm9 2v2h-3v-1h2v-1z"
                          />
                        </svg>
                      </span>
                    )}
                    {selectedResourceTab === "Phone call" && (
                      <span
                        aria-hidden="true"
                        className="upload-layout__resource-card__image-icon"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="#22325A"
                          viewBox="0 0 16 16"
                        >
                          <path fillRule="evenodd" d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z" />
                        </svg>
                      </span>
                    )}
                    {selectedResourceTab === "Link" && (
                      <span
                        aria-hidden="true"
                        className="upload-layout__resource-card__image-icon"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="#22325A"
                          viewBox="0 0 16 16"
                        >
                          <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
                          <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
                        </svg>
                      </span>
                    )}
                    <p className="upload-layout__resource-card__image-title">{personaNameDisplay}</p>
                    <p className="upload-layout__resource-card__image-description">
                      {sidebarDescriptionText ? (
                        sidebarDescriptionText
                      ) : (
                        <span className="upload-layout__resource-card__image-description--link">
                          Your campaign description
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              </div>
              {keyTraits.some((trait) => trait.value.trim().length > 0) ? (
                <div className="upload-layout__resource-key-traits upload-layout__resource-key-traits--bottom">
                  {keyTraits
                    .filter((trait) => trait.value.trim().length > 0)
                    .slice(0, 3)
                    .map((trait) => (
                      <span key={trait.id} className="upload-layout__resource-key-trait">
                        {trait.value.trim()}
                      </span>
                    ))}
                  {keyTraits.filter((trait) => trait.value.trim().length > 0).length > 3 ? (
                    <span className="upload-layout__resource-key-trait upload-layout__resource-key-trait--overflow">
                      +{keyTraits.filter((trait) => trait.value.trim().length > 0).length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
        </div>
      </div>
        <style>{`
          .upload-layout {
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
            padding: 0;
            font-family: ${BODY_FONT_STACK};
            display: flex;
            flex-direction: row;
          }
          .upload-layout__sidebar {
            width: var(--sidebar-width);
            flex-shrink: 0;
          }
          .upload-layout__content {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 64px 24px 96px;
            min-height: 100dvh;
            overflow: hidden;
            gap: 32px;
            flex-wrap: wrap;
          }
          .upload-layout__separator {
            width: 1px;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.45));
            align-self: stretch;
            flex-shrink: 0;
            margin: 8px 4px 0;
          }
          .upload-layout__side-panel {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
            width: min(320px, 80vw);
            align-self: flex-start;
            max-height: calc(100dvh - 96px);
            overflow-y: auto;
            position: sticky;
            top: 64px;
            padding-bottom: 16px;
          }
          .upload-layout__resource-tabs {
            display: flex;
            gap: 8px;
            width: 100%;
            margin-bottom: 12px;
            padding-top: 4px;
          }
          .upload-layout__resource-tab {
            flex: 1;
            border: 1px solid rgba(15, 23, 42, 0.1);
            background: #fff;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
            cursor: pointer;
            transition: border-color 0.2s ease, transform 0.2s ease;
          }
          .upload-layout__resource-tab:hover,
          .upload-layout__resource-tab:focus-visible {
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.2);
            transform: translateY(-2px);
          }
          .upload-layout__resource-tab--active {
            background: linear-gradient(180deg, #e0f2fe, #bae6fd);
            border-color: rgba(37, 99, 235, 0.8);
            color: #0b1f3f;
            box-shadow: 0 6px 14px rgba(37, 99, 235, 0.25);
            transform: none;
          }
          .upload-layout__resource-card {
            display: flex;
            flex-direction: column;
            width: 100%;
            padding: 8px;
            gap: 12px;
          }
          .upload-layout__resource-card__image {
            width: 100%;
            height: 360px;
            border-radius: 16px;
            background: linear-gradient(180deg, #e2e8f0 0%, #cbd5f5 45%, #bae6fd 100%);
            box-shadow: 0 18px 30px rgba(15, 23, 42, 0.15);
            border: 1px solid rgba(15, 23, 42, 0.08);
            position: relative;
          }
          .upload-layout__resource-key-traits--bottom {
            flex-wrap: wrap;
            gap: 6px;
          }
          .upload-layout__resource-card__image-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 16px;
            border-radius: 16px;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.9) 100%);
            color: #fff;
            text-shadow: 0 2px 8px rgba(15, 23, 42, 0.75);
            text-align: center;
          }
          .upload-layout__resource-card__image-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 6px;
            width: 64px;
            height: 64px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.2);
          }
          .upload-layout__resource-card__image-icon svg {
            width: 40px;
            height: 40px;
          }
          .upload-layout__resource-card__image-link {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            color: inherit;
            text-transform: none;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            padding: 0;
          }
          .upload-layout__resource-card__image-link:hover,
          .upload-layout__resource-card__image-link:focus-visible {
            outline: none;
            text-shadow: 0 6px 16px rgba(15, 23, 42, 0.85);
          }
          .upload-layout__resource-card__image-title {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            text-align: center;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.3;
            max-height: calc(1.3em * 2);
            overflow-wrap: anywhere;
          }
          .upload-layout__resource-card__image-description {
            margin: 2px 0 0;
            font-size: 11px;
            line-height: 1.4;
            text-align: center;
            white-space: normal;
            word-break: break-word;
          }
          .upload-layout__resource-card__image-description--link {
            font-weight: 600;
            letter-spacing: 0.01em;
          }
          .upload-layout__resource-card__copy {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .upload-layout__resource-card__role {
            margin: 0;
            font-size: 14px;
            color: rgba(15, 23, 42, 0.6);
            letter-spacing: 0.01em;
          }
          .upload-layout__resource-key-traits {
            margin-top: 4px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .upload-layout__resource-key-trait {
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid rgba(15, 23, 42, 0.25);
            background: rgba(255, 255, 255, 0.9);
            font-size: 11px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.75);
            letter-spacing: 0.04em;
            text-transform: none;
          }
          .upload-layout__resource-key-trait--overflow {
            border-style: dashed;
          }
          .upload-layout__resource-card__label {
            margin: 0;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(15, 23, 42, 0.6);
          }
          .upload-layout__resource-description {
            width: 100%;
            border-radius: 16px;
            padding: 14px 16px;
            border: 1px solid rgba(15, 23, 42, 0.1);
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            flex-direction: column;
            gap: 8px;
            cursor: pointer;
          }
          .upload-layout__resource-description--active {
            border-color: rgba(59, 130, 246, 0.6);
            background: rgba(59, 130, 246, 0.08);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
          }
          .upload-layout__resource-description h4 {
            margin: 0 0 0px;
            font-size: 14px;
            letter-spacing: 0.08em;
            color: rgba(15, 23, 42, 0.6);
          }
          .upload-layout__resource-description__header {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: space-between !important;
            width: 100%;
          }
          .upload-layout__resource-description__header h4 {
            flex: 1;
          }
          .upload-layout__resource-check {
            margin-left: auto;
            font-size: 16px;
            font-weight: 700;
            color: rgba(34, 68, 174, 0.9);
          }
          .upload-layout__resource-description__body {
            max-height: 0;
            overflow-y: hidden;
            transition: max-height 0.28s ease;
          }
          .upload-layout__resource-description--active .upload-layout__resource-description__body {
            max-height: 120px;
          }
          .upload-layout__panel-body-text {
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            max-height: 120px;
          }
          .upload-layout__resource-description--empty,
          .upload-layout__internal-data--empty,
          .upload-layout__knowledge-links--empty {
            min-height: 40px;
            justify-content: center;
            align-items: flex-start;
            gap: 0;
          }
          .upload-layout__resource-description p {
            margin: 0;
            font-size: 14px;
            color: #0f172a;
            line-height: 1.5;
          }
          .upload-layout__knowledge-links--filled {
            min-height: 40px;
          }
          .upload-layout__knowledge-links .upload-layout__resource-description__header {
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .upload-layout__knowledge-links .upload-layout__resource-description__header h4 {
            flex: 1;
            min-width: 0;
          }
          .upload-layout__knowledge-links .upload-layout__resource-check {
            margin-left: auto;
          }
          .upload-layout__knowledge-links ul {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .upload-layout__panel-body-text {
            margin: 0;
            font-size: 14px;
            color: rgba(15, 23, 42, 0.7);
            line-height: 1.5;
          }
          .upload-layout__knowledge-links li a {
            color: rgba(15, 23, 42, 0.7);
            text-decoration: underline;
            font-size: 13px;
            word-break: break-all;
          }
          .upload-layout__doc-card {
            margin-top: 8px;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: rgba(248, 250, 252, 0.9);
            min-width: 0;
          }
          .upload-layout__doc-card-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
            max-height: 216px;
            padding-right: 8px;
          }
          .upload-layout__doc-card__icon {
            width: 34px;
            height: 42px;
            border-radius: 8px;
            background: linear-gradient(180deg, #dbeafe, #bfdbfe 70%, #a5b4fc);
            position: relative;
          }
          .upload-layout__doc-card__icon::after {
            content: "";
            position: absolute;
            inset: 10px 12px auto;
            height: 12px;
            border-radius: 2px;
            background: rgba(59, 130, 246, 0.7);
          }
          .upload-layout__doc-card__copy {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 0;
          }
          .upload-layout__doc-card__title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .upload-layout__doc-card__meta {
            margin: 0;
            font-size: 12px;
            color: rgba(15, 23, 42, 0.6);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .links-stage__url-input {
            display: flex;
            flex-direction: column;
            gap: 6px;
            text-align: left;
            font-size: 14px;
            color: #0f172a;
          }
          .links-stage__url-wrapper {
            position: relative;
            display: flex;
          }
          .links-stage__url-input input {
            width: 100%;
            padding: 12px 14px;
            padding-right: 140px;
            border-radius: 10px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            background: rgba(255, 255, 255, 0.9);
            font-size: 15px;
          }
          .links-stage__url-input input:disabled {
            opacity: 0.8;
            cursor: not-allowed;
          }
          .links-stage__add-link {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            padding: 8px 14px;
            border-radius: 10px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            background: #f8fafc;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease, border 0.2s ease;
            z-index: 3;
          }
          .links-stage__add-link:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .links-stage__urls-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 8px 0;
          }
          .links-stage__urls-wrapper {
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 12px;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.9);
          }
          .links-stage__url-chip {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 4px 6px;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.03);
          }
          .links-stage__url-chip button {
            margin: 0;
            padding: 0 6px;
            border: none;
            background: transparent;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
          }
          .links-stage__url-helper {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.6);
          }
          .personas-stage__grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-top: 12px;
          }
          .personas-stage__card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 14px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            background: #fff;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.05);
            cursor: pointer;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
            text-align: left;
            width: 100%;
            min-height: 60px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            background: #fff;
            outline: none;
          }
          .personas-stage__card:hover,
          .personas-stage__card:focus-visible {
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 6px 12px rgba(59, 130, 246, 0.15);
            transform: translateY(-2px);
          }
          .personas-stage__card--active {
            border-color: rgba(59, 130, 246, 0.8);
            background: rgba(59, 130, 246, 0.08);
          }
          .personas-stage__card-image {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #38bdf8, #6366f1);
          }
          .personas-stage__card-name {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
          }
          .personas-stage__card-title {
            margin: 0;
            font-size: 12px;
            color: rgba(15, 23, 42, 0.6);
          }
          .output-stage-summary {
            border-radius: 14px;
            padding: 18px 16px;
            background: rgba(59, 130, 246, 0.08);
            border: 1px solid rgba(59, 130, 246, 0.2);
          }
          .output-stage-summary p {
            margin: 0 0 12px;
            color: #0f172a;
            font-size: 14px;
          }
          .output-stage-question-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .output-stage-question-item {
            padding: 8px 12px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.05);
            font-size: 14px;
            color: #0f172a;
          }
          .output-stage-cards {
            display: flex;
            gap: 12px;
            justify-content: space-between;
            flex-wrap: wrap;
          }
          .output-stage-card {
            flex: 1;
            min-width: 180px;
            border-radius: 14px;
            padding: 16px;
            border: 1px solid rgba(30, 41, 59, 0.08);
            background: #fff;
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .output-stage-card__icon {
            margin: 0 auto 8px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .output-stage-card h5 {
            margin: 0 0 6px;
            font-size: 15px;
            color: #111827;
          }
          .output-stage-card p {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.75);
          }
          .output-stage-card--active {
            border-color: rgba(59, 130, 246, 0.7);
            box-shadow: 0 12px 20px rgba(59, 130, 246, 0.2);
            background: rgba(59, 130, 246, 0.08);
          }
          .output-stage-card:not(.output-stage-card--active):hover {
            transform: translateY(-4px);
            box-shadow: 0 14px 24px rgba(15, 23, 42, 0.15);
          }
          .output-stage-content {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .output-stage-input {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .output-stage-selected {
            display: flex;
            align-items: center;
            gap: 12px;
            border-radius: 14px;
            border: 1px solid rgba(30, 41, 59, 0.15);
            background: rgba(59, 130, 246, 0.08);
            padding: 12px 16px;
          }
          .output-stage-selected__text {
            flex: 1;
            text-align: left;
          }
          .output-stage-input__change {
            border: 1px solid rgba(15, 23, 42, 0.25);
            border-radius: 10px;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            background: #fff;
            cursor: pointer;
            transition: border-color 0.2s ease, background 0.2s ease;
            white-space: nowrap;
          }
          .output-stage-input__change:hover {
            border-color: rgba(15, 23, 42, 0.55);
            background: rgba(15, 23, 42, 0.04);
          }
          .output-stage-input__label {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .output-stage-input__label-text {
            font-size: 13px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.65);
          }
          .output-stage-input__textarea {
            width: 100%;
            min-height: 140px;
            border-radius: 14px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            padding: 14px 16px;
            font-size: 14px;
            font-weight: 500;
            color: #0f172a;
            background: rgba(255, 255, 255, 0.95);
            resize: vertical;
            box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.08);
            font-family: inherit;
          }
          .output-stage-input__textarea:focus {
            outline: none;
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
          }
          .output-stage-limit {
            border-radius: 12px;
            border: 1px solid rgba(15, 23, 42, 0.15);
            background: rgba(229, 231, 235, 0.7);
            padding: 16px;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
          }
          .output-stage-saved {
            border: 1px dashed rgba(15, 23, 42, 0.2);
            border-radius: 12px;
            padding: 12px 16px;
            background: rgba(226, 232, 240, 0.5);
          }
          .output-stage-saved__title {
            margin: 0;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 13px;
            color: #0f172a;
          }
          .output-stage-saved__list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .output-stage-saved__item {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.75);
          }
          .output-stage-saved__row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 8px;
          }
          .output-stage-saved__entry {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            width: 100%;
            flex: 1;
            border: none;
            background: transparent;
            padding: 0;
            text-align: left;
            cursor: pointer;
          }
          .output-stage-saved__remove {
            border: none;
            background: rgba(15, 23, 42, 0.08);
            color: rgba(15, 23, 42, 0.65);
            font-weight: 700;
            font-size: 16px;
            line-height: 1;
            width: 32px;
            height: 32px;
            border-radius: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease, color 0.2s ease;
            cursor: pointer;
          }
          .output-stage-saved__remove:hover,
          .output-stage-saved__remove:focus-visible {
            background: rgba(15, 23, 42, 0.18);
            color: #0f172a;
            outline: none;
          }
          .output-stage-saved__badge {
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.02em;
            color: #0f172a;
          }
          .output-stage-saved__description {
            margin: 0;
            line-height: 1.4;
          }
          .output-stage-saved__hint {
            font-size: 11px;
            color: rgba(15, 23, 42, 0.45);
          }
          .stage-shell {
            width: min(760px, 92%);
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .stage-chip-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .stage-chip {
            padding: 8px 14px;
            border-radius: 12px;
            border: 1px solid rgba(30, 41, 59, 0.12);
            background: rgba(15, 23, 42, 0.04);
            color: #0f172a;
            font-size: 13px;
            font-weight: 600;
            transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
          }
          .stage-chip--complete {
            background: #a7f3d0;
            color: #0f172a;
            border-color: #bbf7d0;
            box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
          }
          .stage-chip--current {
            background: linear-gradient(180deg, #0f172a, #1e293b);
            color: #f8fafc;
            border-color: rgba(15, 23, 42, 0.4);
          }
          .stage-panel {
            background: transparent;
            border: none;
            border-radius: 18px;
            padding: 28px 0;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            gap: 24px;
            color: #1e293b;
            flex: 1;
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
          .stage-panel--align-left .stage-panel__spacer {
            display: none;
          }
          .stage-panel__titles {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .stage-panel--align-left .stage-panel__titles {
            text-align: left;
          }
          .stage-panel__titles h2 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
            color: #1e293b;
            font-family: ${HEADING_FONT_STACK};
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
            flex: 1;
          }
          .key-traits {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .key-traits__heading {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            letter-spacing: 0.02em;
          }
          .key-traits__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .key-traits__item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .key-traits__chip {
            border: 1px dashed rgba(15, 23, 42, 0.3);
            border-radius: 999px;
            background: rgba(248, 250, 252, 0.8);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            transition: border 0.18s ease, background 0.18s ease;
          }
          .key-traits__chip-label {
            background: transparent;
            border: none;
            padding: 0;
            margin: 0;
            color: rgba(15, 23, 42, 0.85);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
          }
          .key-traits__chip-remove {
            width: 20px;
            height: 20px;
            border-radius: 999px;
            border: none;
            background: rgba(15, 23, 42, 0.1);
            color: #0f172a;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            line-height: 1;
            cursor: pointer;
            transition: background 0.18s ease;
          }
          .key-traits__chip-remove:hover,
          .key-traits__chip-remove:focus-visible {
            background: rgba(248, 113, 113, 0.2);
            outline: none;
          }
          .key-traits__add {
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px dashed rgba(15, 23, 42, 0.3);
            background: rgba(248, 250, 252, 0.8);
            color: rgba(15, 23, 42, 0.85);
            font-size: 13px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
            cursor: pointer;
            transition: border 0.18s ease, background 0.18s ease;
          }
          .key-traits__add:hover,
          .key-traits__add:focus-visible {
            border-color: rgba(37, 99, 235, 0.7);
            background: rgba(37, 99, 235, 0.08);
            outline: none;
          }
          .key-traits__label {
            font-size: 12px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.75);
          }
          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
            white-space: nowrap;
          }
          .key-traits__input {
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid rgba(37, 99, 235, 0.4);
            background: rgba(255, 255, 255, 0.95);
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            min-width: 140px;
            outline: none;
            transition: border 0.18s ease, box-shadow 0.18s ease;
          }
          .key-traits__input:focus {
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
          }
          .persona-category {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .persona-category__label {
            font-size: 13px;
            font-weight: 600;
            color: #0f172a;
            letter-spacing: 0.02em;
          }
          .persona-category__options {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .persona-category__option {
            padding: 10px 18px;
            border-radius: 12px;
            border: 1px solid rgba(30, 41, 59, 0.16);
            background: rgba(255, 255, 255, 0.9);
            color: #0f172a;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: border 0.18s ease, background 0.18s ease, transform 0.18s ease;
          }
          .persona-category__option--active {
            border-color: #2563eb;
            background: rgba(37, 99, 235, 0.08);
          }
          .persona-category__option:focus-visible,
          .persona-category__option:focus {
            outline: 2px solid rgba(59, 130, 246, 0.5);
            outline-offset: 2px;
          }
          .persona-description-input-label {
            font-size: 13px;
            font-weight: 600;
            color: rgb(15, 23, 42);
          }
          .stage-panel__footer {
            margin-top: 12px;
          }
          .stage-back,
          .stage-button {
            font-family: inherit;
          }
          .stage-back {
            padding: 12px 20px;
            border-radius: 12px;
            background: transparent;
            border: 1px solid rgba(15, 23, 42, 0.2);
            color: #1e293b;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-weight: 700;
            font-size: 15px;
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
          .stage-button-row {
            display: flex;
            gap: 12px;
            width: 100%;
            justify-content: flex-end;
            margin-top: auto;
          }
          .stage-button-row--with-back {
            justify-content: space-between;
            align-items: center;
          }
          .stage-button-row__group {
            display: flex;
            gap: 12px;
            flex: 0 0 50%;
            justify-content: space-between;
          }
          .stage-button-row__group .stage-button {
            flex: 1;
          }
          .image-stage-placeholder {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 18px;
            border: 1px dashed rgba(30, 41, 59, 0.25);
            border-radius: 16px;
            background: rgba(226, 232, 240, 0.35);
            max-width: 360px;
            margin: 0 auto;
            cursor: pointer;
            transition: border 0.18s ease, background 0.18s ease;
          }
          .image-stage-placeholder:hover {
            border-color: rgba(37, 99, 235, 0.6);
            background: rgba(226, 232, 240, 0.7);
          }
          .image-stage-placeholder__icon {
            width: 60px;
            height: 60px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #e0e7ff;
            flex-shrink: 0;
          }
          .image-stage-placeholder__icon img {
            width: 100%;
            height: 100%;
            border-radius: 14px;
            object-fit: cover;
          }
          .image-stage-placeholder__copy {
            display: flex;
            flex-direction: column;
            gap: 4px;
            text-align: left;
          }
          .image-stage-placeholder__title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
          }
          .image-stage-placeholder__hint {
            margin: 0;
            font-size: 12px;
            color: rgba(15, 23, 42, 0.7);
          }
          .data-upload-placeholder {
            width: 100%;
            max-width: none;
            margin: 0;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 12px;
            text-align: center;
            padding: 18px 12px;
            box-sizing: border-box;
          }
          .image-stage-placeholder--basic-info {
            margin: 16px 0 0 0;
            max-width: none;
            justify-content: flex-start;
          }
          .data-upload-placeholder__heading {
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
          }
          .data-upload-placeholder__subheading {
            font-size: 14px;
            color: #1e293b;
          }
          .data-upload-placeholder__link {
            text-decoration: underline;
            color: #1e293b;
            cursor: pointer;
          }
          .data-upload-placeholder__types {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 6px;
            width: 100%;
            justify-content: center;
          }
          .data-upload-placeholder__chip {
            background: var(--bg, #f4f8ff);
            color: #1e293b;
            border: 1px solid rgba(30, 41, 59, 0.16);
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            text-align: center;
          }
          .stage-button-note {
            align-self: center;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
            margin-right: auto;
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
          .stage-button--outline {
            border: 1px solid #1e293b;
            background: transparent;
            color: #1e293b;
            box-shadow: none;
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
        `}</style>
      </main>
    </>
  );
}
