"use client";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Sidebar from "../Sidebar";
import PurposeCard from "../../../components/PurposeCard";
import ExecutiveAgent from "@/app/components/BriefingAgent";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";

const GUIDANCE_AUDIENCE_MAP: Record<string, string> = {
  Prepare: "Personal",
  Learn: "Personal",
  Review: "Team",
  "Go-to-market": "Client",
};

const STAGE_CHIPS = ["Basic Info", "Image", "Description", "Documents", "Links", "Web Research"];
const PERSONA_CATEGORIES = [
  { value: "existing", label: "Existing customer" },
  { value: "prospective", label: "Prospective customer" },
  { value: "internal", label: "Internal Stakeholder" },
] as const;
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

function isValidUrl(value: string): boolean {
  if (!value.trim()) {
    return false;
  }
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
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

type ExternalSource = {
  id: string;
  name: string;
  accent: string;
  logoUrl: string | null;
};

function deriveInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "WS";
}

function deriveAccent(name: string): string {
  const palette = [
    "#2563eb",
    "#0ea5e9",
    "#10b981",
    "#f97316",
    "#6366f1",
    "#dc2626",
    "#7c3aed",
    "#14b8a6",
    "#f59e0b",
  ];
  if (!name) return palette[0];
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
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
        setCurrentStep(4);
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
        setCurrentStep(4);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await stageFiles();
  }

  const [currentStep, setCurrentStep] = useState<number>(0); // 0: Basic info, 1: Persona image, 2: Description, 3: Data, 4: Links, 5: Briefing, 6: Confirm
  const [personaName, setPersonaName] = useState<string>("");
  const [personaNameTouched, setPersonaNameTouched] = useState<boolean>(false);
  const [selectedGuidance, setSelectedGuidance] = useState<string | null>(null);
  const [personaTagline, setPersonaTagline] = useState<string>("");
  const [personaCategory, setPersonaCategory] = useState<typeof PERSONA_CATEGORIES[number]["value"]>(
    PERSONA_CATEGORIES[0].value
  );
  const [keyTraits, setKeyTraits] = useState<KeyTrait[]>(DEFAULT_KEY_TRAITS);
  const [editingKeyTraitId, setEditingKeyTraitId] = useState<string | null>(null);

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
  useEffect(() => {
    setKnowledgePanelExpanded(linksUrls.length > 0);
  }, [linksUrls.length]);
  useEffect(() => {
    if (currentStep === 4) {
      setTargetPanelExpanded(linksUrls.length > 0);
      setTargetPanelCompleted(false);
      setKnowledgePanelCompleted(false);
    }
  }, [linksUrls.length, currentStep]);
  const isLinksUrlValid = isValidUrl(linksUrl);
  const canAddCurrentLink = !!linksUrl.trim() && isLinksUrlValid && !linksUrls.includes(linksUrl.trim());
  const [availableExternalSources, setAvailableExternalSources] = useState<ExternalSource[]>([]);
  const [selectedExternalSources, setSelectedExternalSources] = useState<string[]>([]);

  function handleAddLink() {
    const trimmed = linksUrl.trim();
    if (!trimmed || !isValidUrl(trimmed)) {
      return;
    }
    setLinksUrls((prev) => [...prev, trimmed]);
    setLinksUrl("");
  }
  function handleRemoveLink(target: string) {
    setLinksUrls((prev) => prev.filter((url) => url !== target));
  }
  function stageLinks() {
    if (linksUrls.length === 0) return;
    setKnowledgePanelExpanded(false);
    setTargetPanelExpanded(false);
    setKnowledgePanelCompleted(true);
    setTargetPanelCompleted(true);
    setCurrentStep(5);
  }
  const handleExternalSourceToggle = useCallback(
    async (sourceName: string) => {
      if (!clientSlug) return;
      const previous = selectedExternalSources;
      const isActive = previous.includes(sourceName);
      const nextSources = isActive
        ? previous.filter((name) => name !== sourceName)
        : [...previous, sourceName];

      setSelectedExternalSources(nextSources);

      try {
        const response = await fetch(`/api/clients/${clientSlug}/research-priorities`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target_sources: nextSources }),
        });

        if (!response.ok) {
          const errorDetail = await response.text().catch(() => null);
          console.error(
            "[Upload] Failed to update target sources",
            response.status,
            errorDetail
          );
          setSelectedExternalSources(previous);
          return;
        }

        const payload = (await response.json()) as {
          priority?: { target_sources?: string[] | null } | null;
        };

        if (payload.priority?.target_sources && Array.isArray(payload.priority.target_sources)) {
          setSelectedExternalSources(payload.priority.target_sources);
        }
      } catch (error) {
        console.error("[Upload] Unexpected error updating target sources", error);
        setSelectedExternalSources(previous);
      }
    },
    [clientSlug, selectedExternalSources]
  );
  const canSkipUpload = isDescribeMode;
  const personaNameTrimmed = personaName.trim();
  const personaTaglineTrimmed = personaTagline.trim();
  const personaNameDisplay = personaNameTrimmed || "Campaign name";
  const personaNameHeadline = personaNameTrimmed || "campaign name";
  const personaNamePossessive = personaNameTrimmed ? `${personaNameTrimmed}'s` : "campaign name's";
  const personaNameFormId = "persona-name-form";
  const personaImageInputId = "persona-image-upload";
  const [personaDescription, setPersonaDescription] = useState<string>("");
  const [painPoints, setPainPoints] = useState<string>("");
  const [jobsToBeDone, setJobsToBeDone] = useState<string>("");
  const [activeResourceDetail, setActiveResourceDetail] = useState<
    "description" | "painPoints" | "jobs" | ""
  >("");
  const personaDescriptionHasContent = Boolean(personaDescription.trim());
  const painPointsHaveContent = Boolean(painPoints.trim());
  const jobsHaveContent = Boolean(jobsToBeDone.trim());
  const internalDataHasContent = files.length > 0;
  const knowledgeLinksHaveContent = linksUrls.length > 0;
  const targetSourcesHaveContent = selectedExternalSources.length > 0;
  const [knowledgePanelExpanded, setKnowledgePanelExpanded] = useState(false);
  const [knowledgePanelCompleted, setKnowledgePanelCompleted] = useState(false);
  const [targetPanelExpanded, setTargetPanelExpanded] = useState(false);
  const [targetPanelCompleted, setTargetPanelCompleted] = useState(false);
  const joinClasses = (...classes: (string | false | undefined)[]) =>
    classes.filter(Boolean).join(" ");
  const toggleResourceDetail = (panel: "description" | "painPoints" | "jobs") => {
    setActiveResourceDetail((prev) => (prev === panel ? "" : panel));
  };
  const toggleKnowledgePanel = () => {
    if (linksUrls.length === 0) return;
    setKnowledgePanelExpanded((prev) => !prev);
  };

  const descriptionPanelClass = joinClasses(
    "upload-layout__resource-description",
    activeResourceDetail === "description"
      ? "upload-layout__resource-description--active"
      : "upload-layout__resource-description--collapsed",
    personaDescriptionHasContent
      ? "upload-layout__resource-description--completed"
      : "upload-layout__resource-description--empty"
  );
  const painPointsPanelClass = joinClasses(
    "upload-layout__resource-description",
    activeResourceDetail === "painPoints"
      ? "upload-layout__resource-description--active"
      : "upload-layout__resource-description--collapsed",
    painPointsHaveContent
      ? "upload-layout__resource-description--completed"
      : "upload-layout__resource-description--empty"
  );
  const jobsPanelClass = joinClasses(
    "upload-layout__resource-description",
    activeResourceDetail === "jobs"
      ? "upload-layout__resource-description--active"
      : "upload-layout__resource-description--collapsed",
    jobsHaveContent ? "upload-layout__resource-description--completed" : "upload-layout__resource-description--empty"
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
  const targetSourcesPanelClass = joinClasses(
    "upload-layout__target-sources",
    targetPanelExpanded
      ? "upload-layout__target-sources--expanded"
      : "upload-layout__target-sources--collapsed",
    targetPanelCompleted
      ? "upload-layout__target-sources--completed"
      : targetSourcesHaveContent
      ? "upload-layout__target-sources--filled"
      : "upload-layout__target-sources--empty"
  );
  const personaRoleDisplay = personaTaglineTrimmed || "Their role";
  const [personaImagePreview, setPersonaImagePreview] = useState<string | null>(null);
  const resourceImageStyle = personaImagePreview
    ? {
        backgroundImage: `url(${personaImagePreview})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

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
    if (currentStep === 4) {
      if (briefingConversationId && briefingEndedAt) {
        setBriefingComplete(true);
      } else {
        setBriefingComplete(false);
      }
    }
  }, [currentStep, briefingConversationId, briefingEndedAt]);

  useEffect(() => {
    if (selectedGuidance === 'Describe persona' && currentStep === 2) {
      setCurrentStep(4);
    }
  }, [selectedGuidance, currentStep]);

  useEffect(() => {
    if (!clientSlug) {
      setSelectedExternalSources([]);
      return;
    }
    let isMounted = true;
    const controller = new AbortController();

    async function fetchResearchPriorities() {
      try {
        const response = await fetch(`/api/clients/${clientSlug}/research-priorities`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error("[Upload] Failed to load research priorities", response.status);
          return;
        }
        const payload = (await response.json()) as {
          priority?: { target_sources?: string[] | null } | null;
        };

        if (!isMounted) return;

        const sources = payload.priority?.target_sources;
        if (Array.isArray(sources)) {
          setSelectedExternalSources(sources);
        } else {
          setSelectedExternalSources([]);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Upload] Unexpected error loading research priorities", error);
      }
    }

    void fetchResearchPriorities();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientSlug]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchExternalSources() {
      try {
        const response = await fetch("/api/external-sources", {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error("[Upload] Failed to load external sources", response.status);
          return;
        }

        const payload = (await response.json()) as {
          sources?: Array<{ id: string; name?: string | null; logo?: string | null }>;
        };

        if (!isMounted) return;

        const normalized = (payload.sources ?? []).map((source) => {
          const name = source.name?.trim() ?? "";
          const safeName = name.length > 0 ? name : "Unknown source";
          const rawLogo = typeof source.logo === "string" ? source.logo.trim() : "";
          return {
            id: source.id,
            name: safeName,
            accent: deriveAccent(safeName),
            logoUrl: rawLogo.length > 0 ? rawLogo : null,
          } satisfies ExternalSource;
        });

        setAvailableExternalSources(normalized);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Upload] Unexpected error loading external sources", error);
      }
    }

    void fetchExternalSources();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (hasHydratedFromParams.current) return;
    const stageParam = searchParams?.get("stage");
    const purposeParam = searchParams?.get("purpose");
    if (!stageParam && !purposeParam) return;
    hasHydratedFromParams.current = true;

    if (stageParam === "upload") {
      setCurrentStep(3);
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

    const keyTraitsPayload = keyTraits
      .map((trait) => trait.value.trim())
      .filter((value) => value.length > 0);

    console.log("[Upload] Starting persona create flow", {
      personaName: personaNameDisplay,
      personaTagline: personaTagline.trim(),
      linksCount: linksUrls.length,
      keyTraits: keyTraitsPayload,
    });
    setFinalizing(true);
    try {
      console.log("[Upload] Calling dialogues create API", { tempId, docsCount: docsPayload.length });
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
          personaName: personaNameDisplay,
          personaImage: personaImagePreview
            ? {
                fileName: buildPersonaImageFileName(personaImageFile, personaImagePreview),
                dataUrl: personaImagePreview,
                mimeType: personaImageFile?.type ?? extractMimeFromDataUrl(personaImagePreview),
              }
            : undefined,
          personaTagline: personaTagline.trim() || null,
          personaDescription: personaDescription.trim() || null,
          painPoints: painPoints.trim() || null,
          jobsToBeDone: jobsToBeDone.trim() || null,
          customer_status: personaCategory,
          personaGuidance: selectedGuidance ?? null,
          personaSetting: selectedSetting ?? null,
          personaTone: tone || null,
          personaVoice: voice || null,
          personaLinks: linksUrls,
          key_traits: keyTraitsPayload,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Server error: ${res.status}`;
        console.error("[Upload] Dialogues API failure", { status: res.status, message: msg });
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
      router.push(`/client/${clientSlug}/personas`);
    } catch (e: any) {
      console.error("[Upload] Failed to finalize", e);
      setNotification({ type: 'error', message: `Failed to finalize: ${e?.message ?? e}` });
      setFinalizing(false);
    }
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Persona name</span>
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
                      placeholder="e.g. Jane Doe"
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Persona title</span>
                    <input
                      type="text"
                      value={personaTagline}
                      onChange={(event) => setPersonaTagline(event.target.value)}
                      placeholder="e.g. Head of Procurement at Global Logistics Firm / Busy Parent of Two Young Children"
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
                  <div className="persona-category">
                    <span className="persona-category__label">Persona category</span>
                    <div className="persona-category__options">
                      {PERSONA_CATEGORIES.map((category) => (
                        <button
                          key={category.value}
                          type="button"
                          className={`persona-category__option ${
                            personaCategory === category.value ? "persona-category__option--active" : ""
                          }`}
                          onClick={() => setPersonaCategory(category.value)}
                          aria-pressed={personaCategory === category.value}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              </StagePanel>
            )}
            {currentStep === 1 && (
              <StagePanel
                heading="Persona image"
                footer={
                  <div className="stage-button-row stage-button-row--with-back">
                    <button
                      type="button"
                      className="stage-back"
                      onClick={() => setCurrentStep(0)}
                      style={{ width: "25%" }}
                    >
                      Back
                    </button>
                    <StageButton
                      type="button"
                      variant="primary"
                      onClick={() => setCurrentStep(2)}
                      style={{ width: "25%" }}
                    >
                      Continue
                    </StageButton>
                  </div>
                }
              >
                <label
                  className="image-stage-placeholder"
                  htmlFor={personaImageInputId}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handlePersonaImageDrop}
                  aria-label="Upload persona image"
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
              </StagePanel>
            )}
            {currentStep === 2 && (
              <StagePanel
                className="stage-panel--align-left"
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
                      onClick={() => setCurrentStep(3)}
                      style={{ width: "25%" }}
                    >
                      Continue
                    </StageButton>
                  </div>
                }
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="persona-description-input-label">Persona description</span>
                  <textarea
                    value={personaDescription}
                    onChange={(event) => setPersonaDescription(event.target.value)}
                    onFocus={() => setActiveResourceDetail("description")}
                    onBlur={() => setActiveResourceDetail("")}
                    placeholder="Describe your persona. The more detail, the better."
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
                <div className="key-traits">
                  <div className="key-traits__heading">Key traits</div>
                  <div className="key-traits__chips">
                        {keyTraits.map((trait) => (
                          <div key={trait.id} className="key-traits__item">
                            {editingKeyTraitId === trait.id ? (
                              <>
                                <label
                                  className="key-traits__label sr-only"
                                  htmlFor={`key-trait-${trait.id}`}
                                >
                                  {trait.placeholder}
                                </label>
                                <input
                                  id={`key-trait-${trait.id}`}
                                  className="key-traits__input"
                                  value={trait.value}
                                  placeholder={trait.placeholder}
                                  onChange={(event) =>
                                    handleKeyTraitChange(trait.id, event.target.value)
                                  }
                                  onBlur={() => setEditingKeyTraitId(null)}
                                  autoFocus
                                />
                              </>
                            ) : (
                              <div className="key-traits__chip">
                                <button
                                  type="button"
                                  className="key-traits__chip-label"
                                  onClick={() => setEditingKeyTraitId(trait.id)}
                                >
                                  {trait.value || trait.placeholder}
                                </button>
                                <button
                                  type="button"
                                  className="key-traits__chip-remove"
                                  onClick={() => handleRemoveKeyTrait(trait.id)}
                                  aria-label={`Remove ${trait.placeholder}`}
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                    <button
                      type="button"
                      className="key-traits__add"
                      onClick={handleAddKeyTrait}
                      aria-label="Add key trait"
                    >
                      New trait
                    </button>
                  </div>
                </div>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 20,
                  }}
                >
                  <span className="persona-description-input-label">Pain Points</span>
                  <textarea
                    value={painPoints}
                    onChange={(event) => setPainPoints(event.target.value)}
                    onFocus={() => setActiveResourceDetail("painPoints")}
                    onBlur={() => setActiveResourceDetail("")}
                    placeholder="List 2-3 key pain points that drive this persona's decisions."
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
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 16,
                  }}
                >
                  <span className="persona-description-input-label">Jobs To Be Done</span>
                  <textarea
                    value={jobsToBeDone}
                    onChange={(event) => setJobsToBeDone(event.target.value)}
                    onFocus={() => setActiveResourceDetail("jobs")}
                    onBlur={() => setActiveResourceDetail("")}
                    placeholder="Describe the key outcomes this persona is trying to achieve."
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
            {currentStep === 3 && (
              <StagePanel
                heading={`Upload documents for ${personaNamePossessive} persona`}
              >
              <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {uploadMode === 'upload' ? (
                <label
                  htmlFor="file-upload"
                  className="image-stage-placeholder data-upload-placeholder"
                  style={{
                    minHeight: files.length > 0 ? 218 : 186,
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
                      <div className="data-upload-placeholder__heading">Drag & drop files here</div>
                      <div className="data-upload-placeholder__subheading">
                        or <span className="data-upload-placeholder__link">click to select from computer</span>
                      </div>
                      <div className="data-upload-placeholder__types">
                        {['PDF', 'TXT', 'DOCX', 'HTML'].map((type) => (
                          <span key={type} className="data-upload-placeholder__chip">
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
              {/* Uploading message and notification below the button */}
              {submitted && !notification && (
                <StageAlert type="info" message="Stay on the page while document is uploading." />
              )}
              {notification && <StageAlert type={notification.type} message={notification.message} />}
              </form>
              <div className="stage-button-row stage-button-row--with-back" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="stage-back"
                  onClick={() => setCurrentStep(2)}
                  style={{ width: "25%" }}
                >
                  Back
                </button>
                <div className="stage-button-row__group">
                  <StageButton
                    type="button"
                    variant="ghost"
                    className="stage-button--outline"
                    onClick={() => setCurrentStep(4)}
                  >
                    Skip
                  </StageButton>
                  <StageButton
                    type="button"
                    variant="primary"
                    onClick={() => stageFiles()}
                    disabled={
                      (uploadMode === "upload" && (files.length === 0 || submitted)) ||
                      (uploadMode === "url" && (fileUrl.trim() === "" || submitted))
                    }
                  >
                    Continue
                  </StageButton>
                </div>
              </div>
            </StagePanel>
          )}
            {currentStep === 4 && (
              <StagePanel heading={`Paste links to ${personaNameDisplay}'s knowledge`}>
                <div className="links-stage__url-input">
                <div className="links-stage__url-wrapper">
                    <input
                      type="url"
                      placeholder="https://"
                      value={linksUrl}
                      onChange={(event) => setLinksUrl(event.target.value)}
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
                        Add link
                      </button>
                    )}
                  </div>
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
                  >
                    Skip
                  </StageButton>
                  <StageButton
                    type="button"
                    variant="primary"
                    onClick={() => stageLinks()}
                    disabled={linksUrls.length === 0}
                  >
                    Continue
                  </StageButton>
                </div>
                </div>
              </StagePanel>
            )}
            {currentStep === 5 && (
              <StagePanel
                heading="Tell our AI agents where to research"
              >
                <div className="web-research-sources">
                  {availableExternalSources.length === 0 ? (
                    <p className="web-research-sources__empty">Loading sources…</p>
                  ) : (
                    <div className="web-research-sources-grid">
                      {availableExternalSources.map((source) => {
                        const active = selectedExternalSources.includes(source.name);
                        const logoStyle = source.logoUrl
                          ? undefined
                          : {
                              background: `linear-gradient(135deg, ${source.accent} 0%, ${source.accent} 60%, rgba(255,255,255,0.9) 100%)`,
                            };
                        return (
                          <button
                            type="button"
                            key={source.id}
                            className={`web-research-source-card${active ? " web-research-source-card--active" : ""}`}
                            onClick={() => handleExternalSourceToggle(source.name)}
                            aria-pressed={active}
                          >
                            <div className="web-research-source-logo" style={logoStyle}>
                              {source.logoUrl ? (
                                <Image
                                  src={source.logoUrl}
                                  alt={source.name}
                                  width={52}
                                  height={52}
                                  className="web-research-source-logo__image"
                                  unoptimized
                                />
                              ) : (
                                <span aria-hidden="true">{deriveInitials(source.name)}</span>
                              )}
                            </div>
                            <span className="web-research-source-name">{source.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="stage-button-row stage-button-row--with-back" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="stage-back"
                    onClick={() => setCurrentStep(4)}
                    style={{ width: '25%' }}
                  >
                    Back
                  </button>
                  <div className="stage-button-row__group" style={{ flex: '0 0 50%' }}>
                    <StageButton
                      type="button"
                      variant="primary"
                      width="full"
                      onClick={handleFinalize}
                      disabled={finalizing}
                    >
                      {finalizing ? 'Creating…' : 'Create Persona'}
                    </StageButton>
                  </div>
                </div>
              </StagePanel>
            )}
          </div>
          <div className="upload-layout__separator" aria-hidden="true" />
          <div className="upload-layout__side-panel">
            <div className="upload-layout__resource-card" aria-label="Resource placeholder card">
              <div className="upload-layout__resource-card__top">
                <div className="upload-layout__resource-card__image" style={resourceImageStyle} />
                <div className="upload-layout__resource-card__stack">
                  <div className="upload-layout__resource-card__copy">
                    <p className="upload-layout__resource-card__name">{personaNameDisplay}</p>
                    <p className="upload-layout__resource-card__role">{personaRoleDisplay}</p>
                    {keyTraits.some((trait) => trait.value.trim().length > 0) ? (
                      <div className="upload-layout__resource-key-traits">
                        {keyTraits
                          .filter((trait) => trait.value.trim().length > 0)
                          .slice(0, 3)
                          .map((trait) => (
                            <span
                              key={trait.id}
                              className="upload-layout__resource-key-trait"
                            >
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
              <div className="upload-layout__resource-actions-row">
                <button type="button" className="upload-layout__resource-action">
                  <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
                    <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
                    <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
                  </svg>
                  <span>Chat</span>
                </button>
                <button type="button" className="upload-layout__resource-action">
                  <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
                    <path
                      d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14"
                      stroke="#c084fc"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
                    <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
                  </svg>
                  <span>Interview</span>
                </button>
              </div>
            </div>
            <div
              className={descriptionPanelClass}
              role="button"
              tabIndex={0}
              onClick={() => toggleResourceDetail("description")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleResourceDetail("description");
                }
              }}
            >
              <div className="upload-layout__resource-description__header">
                <h4>Persona description</h4>
                {personaDescriptionHasContent && (
                  <span className="upload-layout__resource-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </div>
            <div className="upload-layout__resource-description__body">
              <p className="upload-layout__panel-body-text">{personaDescription}</p>
            </div>
            </div>
            <div
              className={painPointsPanelClass}
              role="button"
              tabIndex={0}
              onClick={() => toggleResourceDetail("painPoints")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleResourceDetail("painPoints");
                }
              }}
            >
              <div className="upload-layout__resource-description__header">
                <h4>Pain Points</h4>
                {painPointsHaveContent && (
                  <span className="upload-layout__resource-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </div>
              <div className="upload-layout__resource-description__body">
                <p className="upload-layout__panel-body-text">{painPoints}</p>
              </div>
            </div>
            <div
              className={jobsPanelClass}
              role="button"
              tabIndex={0}
              onClick={() => toggleResourceDetail("jobs")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleResourceDetail("jobs");
                }
              }}
            >
              <div className="upload-layout__resource-description__header">
                <h4>Jobs To Be Done</h4>
                {jobsHaveContent && (
                  <span className="upload-layout__resource-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </div>
              <div className="upload-layout__resource-description__body">
                <p className="upload-layout__panel-body-text">{jobsToBeDone}</p>
              </div>
            </div>
          <div className={internalDataPanelClass}>
            <div className="upload-layout__resource-description__header">
              <h4>Internal data</h4>
              {internalDataHasContent && (
                <span className="upload-layout__resource-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
            <div className="upload-layout__internal-data__body">
              {files.length === 0 ? null : (
                <div className="upload-layout__doc-card-list">
                  {files.map((file) => (
                    <div className="upload-layout__doc-card" key={fileKey(file)}>
                      <div className="upload-layout__doc-card__icon" aria-hidden="true" />
                      <div className="upload-layout__doc-card__copy">
                        <p className="upload-layout__doc-card__title">{file.name}</p>
                        <p className="upload-layout__doc-card__meta">
                          {normalizeFileType(file)}
                          {file.size ? ` · ${formatFileSize(file.size)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            <div
              className={knowledgeLinksPanelClass}
              role="button"
              tabIndex={0}
              aria-expanded={knowledgePanelExpanded}
              aria-disabled={!knowledgeLinksHaveContent}
              onClick={toggleKnowledgePanel}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleKnowledgePanel();
                }
              }}
            >
              <div className="upload-layout__resource-description__header">
                <h4>Knowledge links</h4>
                {knowledgeLinksHaveContent && (
                  <span className="upload-layout__resource-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </div>
              <div className="upload-layout__resource-description__body">
                {linksUrls.length === 0 ? null : (
                  <ul>
                    {linksUrls.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          <div
            className={targetSourcesPanelClass}
            role="button"
            tabIndex={0}
            aria-expanded={targetPanelExpanded}
            onClick={() => setTargetPanelExpanded((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setTargetPanelExpanded((prev) => !prev);
              }
            }}
          >
            <div className="upload-layout__resource-description__header">
              <h4>Target sources</h4>
              {selectedExternalSources.length > 0 && (
                <span className="upload-layout__resource-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </div>
            <div className="upload-layout__resource-description__body">
              {selectedExternalSources.length === 0 ? null : (
                <ul>
                  {selectedExternalSources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              )}
            </div>
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
          .upload-layout__resource-card {
            display: flex;
            flex-direction: column;
            width: min(320px, 80vw);
            padding: 8px;
            gap: 12px;
          }
          .upload-layout__resource-card__top {
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .upload-layout__resource-card__stack {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            flex: 1;
            min-height: 20px;
          }
          .upload-layout__resource-actions-row {
            display: flex;
            gap: 12px;
            width: 100%;
            justify-content: flex-start;
            margin-top: 6px;
          }
          .upload-layout__resource-card__image {
            width: 110px;
            height: 160px;
            border-radius: 16px;
            background: linear-gradient(180deg, #e2e8f0 0%, #cbd5f5 45%, #bae6fd 100%);
            box-shadow: 0 18px 30px rgba(15, 23, 42, 0.15);
            border: 1px solid rgba(15, 23, 42, 0.08);
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
          .upload-layout__resource-card__name {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }
          .upload-layout__resource-card__role {
            margin: 0;
            font-size: 14px;
            color: rgba(15, 23, 42, 0.6);
            letter-spacing: 0.01em;
          }
          .upload-layout__resource-actions {
            display: flex;
            gap: 12px;
            width: 100%;
            justify-content: flex-start;
            align-items: flex-end;
          }
          .upload-layout__resource-action {
            min-width: 120px;
            border-radius: 999px;
            border: 1px solid rgba(15, 23, 42, 0.2);
            background: #fff;
            color: #0f172a;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            font-size: 12px;
            padding: 10px 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease;
          }
          .upload-layout__resource-action:hover,
          .upload-layout__resource-action:focus-visible {
            transform: translateY(-2px);
            border-color: rgba(59, 130, 246, 0.6);
            outline: none;
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
          .upload-layout__resource-description--completed {
            border-color: rgba(59, 130, 246, 0.5);
            background: rgba(59, 130, 246, 0.08);
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
          }
          .upload-layout__internal-data {
            width: 100%;
            border-radius: 16px;
            padding: 14px 16px;
            border: 1px solid rgba(15, 23, 42, 0.1);
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            flex-direction: column;
            gap: 8px;
            position: relative;
          }
          .upload-layout__internal-data--collapsed .upload-layout__internal-data__body {
            max-height: 0;
            overflow: hidden;
          }
          .upload-layout__internal-data--expanded .upload-layout__internal-data__body {
            max-height: 200px;
          }
          .upload-layout__internal-data__body {
            transition: max-height 0.28s ease;
          }
          .upload-layout__data--completed {
            border-color: rgba(59, 130, 246, 0.5) !important;
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
            background: rgba(59, 130, 246, 0.04) !important;
          }
          .upload-layout__internal-data h4 {
            margin: 0 0 0px;
            font-size: 14px;
            letter-spacing: 0.08em;
            color: rgba(15, 23, 42, 0.6);
          }
          .upload-layout__internal-data p {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
            line-height: 1.5;
          }
          .upload-layout__internal-data__empty {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
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
          .upload-layout__knowledge-links--empty,
          .upload-layout__target-sources--empty {
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
          .upload-layout__knowledge-links {
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
          .upload-layout__knowledge-links h4 {
            margin: 0 0 0px;
            font-size: 14px;
            letter-spacing: 0.08em;
            color: rgba(15, 23, 42, 0.6);
          }
          .upload-layout__knowledge-links__empty {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
          }
          .upload-layout__knowledge-links--collapsed .upload-layout__resource-description__body {
            max-height: 0;
            overflow: hidden;
          }
          .upload-layout__knowledge-links--expanded .upload-layout__resource-description__body {
            max-height: 150px;
          }
          .upload-layout__knowledge-links--completed {
            border-color: rgba(59, 130, 246, 0.5) !important;
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
            background: rgba(59, 130, 246, 0.04) !important;
          }
          .upload-layout__knowledge-links--filled {
            min-height: 40px;
          }
          .upload-layout__knowledge-links .upload-layout__resource-description__header,
          .upload-layout__target-sources .upload-layout__resource-description__header {
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .upload-layout__knowledge-links .upload-layout__resource-description__header h4,
          .upload-layout__target-sources .upload-layout__resource-description__header h4 {
            flex: 1;
            min-width: 0;
          }
          .upload-layout__knowledge-links .upload-layout__resource-check,
          .upload-layout__target-sources .upload-layout__resource-check {
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
          .upload-layout__target-sources {
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
          .upload-layout__target-sources h4 {
            margin: 0 0 0px;
            font-size: 14px;
            letter-spacing: 0.08em;
            color: rgba(15, 23, 42, 0.6);
          }
          .upload-layout__target-sources__empty {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.7);
          }
          .upload-layout__target-sources--collapsed .upload-layout__resource-description__body {
            max-height: 0;
            overflow: hidden;
          }
          .upload-layout__target-sources--expanded .upload-layout__resource-description__body {
            max-height: 150px;
          }
          .upload-layout__target-sources--filled {
            min-height: 40px;
          }
          .upload-layout__target-sources--completed {
            border-color: rgba(59, 130, 246, 0.5) !important;
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.15);
            background: rgba(59, 130, 246, 0.04) !important;
          }
          .upload-layout__target-sources ul {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .upload-layout__target-sources li {
          margin: 0;
    font-size: 13px;
    color: rgba(15, 23, 42, 0.7);
    line-height: 1.5;
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
          .web-research-sources {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .web-research-sources__empty {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.65);
          }
          .web-research-sources-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 14px;
          }
          .web-research-source-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            border-radius: 18px;
            border: 1px solid rgba(15, 23, 42, 0.12);
            padding: 14px 12px;
            background: #fff;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease;
            color: #0f172a;
          }
          .web-research-source-card:hover,
          .web-research-source-card:focus-visible {
            outline: none;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
          }
          .web-research-source-card--active {
            border-color: rgba(59, 130, 246, 0.3);
            box-shadow: 0 12px 24px rgba(59, 130, 246, 0.15);
            background: rgba(59, 130, 246, 0.08);
          }
          .web-research-source-logo {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.04);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: #1e293b;
          }
          .web-research-source-logo__image {
            width: 48px;
            height: 48px;
            border-radius: 10px;
            object-fit: contain;
          }
          .web-research-source-name {
            font-size: 13px;
            font-weight: 600;
            text-align: center;
            color: #0f172a;
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
