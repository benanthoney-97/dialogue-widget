"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { v4 as uuidv4 } from "uuid";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "../../../lib/supabaseClient";
import FullscreenModal from "../../../components/FullscreenModal";
import PrepAgent from "../../../components/PrepAgent";
import DialogueText from "../../../components/DialogueText";
import QuestionnaireModal from "../../../components/QuestionnaireModal";
import PillButton from "../../../components/PillButton";

const QUESTIONNAIRE_STORAGE_BUCKET = "questionnaires";

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  audience_type: string | null;
  content_type: string | null;
  description: string | null;
  status: string | null;
  dialogue_created_date: string | null;
  key: string | null;
  updated_at?: string | null;
  research_type?: string | null;
  age?: string | number | null;
  gender?: string | null;
  location?: string | null;
  customer_status?: string | null;
  key_pain_points?: string[] | null;
  intent_signals?: string[] | null;
  key_traits?: string[] | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  client_id: string | null;
  display_name?: string | null;
};

type ClientRow = {
  id: string;
  name?: string | null;
};

type AgentDocumentRow = {
  id: string;
  agent_id: string;
  file_name: string;
  storage_path?: string | null;
  public_url?: string | null;
  document_url?: string | null;
  document_id?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  source?: string | null;
  created_at?: string | null;
  added_stage?: string | null;
};

type DisplayDocumentRow = AgentDocumentRow & {
  isStaged?: boolean;
  objectUrl?: string;
};

type StagedDocumentAdd = {
  id: string;
  file: File;
  objectUrl: string;
  name: string;
  size: number;
  mimeType: string | null;
};

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  if (!match) return "";
  const rawSlug = match[1];
  try {
    return decodeURIComponent(rawSlug);
  } catch (error) {
    // Fallback to the raw segment if decoding fails (malformed URI component)
    return rawSlug;
  }
}
function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function determineColumns(width: number): number {
  if (width <= 680) return 1;
  if (width <= 960) return 2;
  if (width <= 1280) return 3;
  return 4;
}

function normalizeTraitsInput(value: string): string {
  return value
    .split(",")
    .map((trait) => trait.trim())
    .filter((trait) => trait.length > 0)
    .join(", ");
}

type PersonaTrait = {
  label: string;
  value: string;
};

type PersonaScalarTraitKey = "age" | "gender" | "location" | "customer_status";

type GridPosition = {
  gridColumn: string;
  gridRow: string;
};

const PERSONA_SCALAR_TRAITS: Array<{
  key: PersonaScalarTraitKey;
  label: string;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}> = [
  { key: "age", label: "Age", placeholder: "Not set", inputMode: "numeric" },
  { key: "gender", label: "Gender", placeholder: "Not set" },
  { key: "location", label: "Location", placeholder: "Not set" },
  { key: "customer_status", label: "Customer status", placeholder: "Not set" },
];

const SCALAR_TRAIT_KEYS: PersonaScalarTraitKey[] = PERSONA_SCALAR_TRAITS.map((trait) => trait.key);

const PERSONA_META_CHIP_LABELS = ["Key Info", "Data Sources", "Pain Points", "Intent Signals"] as const;
type PersonaMetaChipLabel = (typeof PERSONA_META_CHIP_LABELS)[number];

const DOCUMENT_TITLE_MAX_CHARS = 32;

function readScalarTraitValue(persona: PersonaRow | null, traitKey: PersonaScalarTraitKey): string {
  if (!persona) return "";
  const rawValue = persona[traitKey];
  if (rawValue === null || rawValue === undefined) return "";
  return `${rawValue}`.trim();
}

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

function buildPersonaTraits(persona: PersonaRow): PersonaTrait[] {
  const traits: PersonaTrait[] = [];
  traits.push({
    label: "Age",
    value:
      persona.age !== undefined && persona.age !== null && `${persona.age}`.trim()
        ? `${persona.age}`
        : "Not set",
  });
  traits.push({
    label: "Gender",
    value:
      persona.gender && persona.gender.trim().length > 0 ? persona.gender.trim() : "Not set",
  });
  traits.push({
    label: "Location",
    value:
      persona.location && persona.location.trim().length > 0
        ? persona.location.trim()
        : "Not set",
  });
  traits.push({
    label: "Customer status",
    value:
      persona.customer_status && persona.customer_status.trim().length > 0
        ? persona.customer_status.trim()
        : "Not set",
  });
  return traits;
}

function decodeStorageFileName(path: string | null): string | null {
  if (!path) return null;
  const segments = path.split("/");
  let raw = segments[segments.length - 1] ?? "";
  if (!raw) return null;
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep raw as-is if it cannot be decoded
  }
  const hyphenIndex = raw.indexOf("-");
  if (hyphenIndex > 0) {
    const prefix = raw.slice(0, hyphenIndex);
    if (/^\d+$/.test(prefix)) {
      raw = raw.slice(hyphenIndex + 1) || raw;
    }
  }
  return raw;
}

function inferMimeTypeFromFilename(fileName: string | null): string | null {
  if (!fileName) return null;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  return null;
}

function buildUpdatedLabel(dateString: string | null): string {
  return formatDate(dateString);
}

const MODAL_OPTIONS: Array<{
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: "questionnaire",
    title: "Questionnaire",
    description: "Get instant responses to questionnaires.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="4" height="20" rx="1.6" fill="#7ea0e6" opacity="0.8" />
        <rect x="12" y="2" width="4" height="24" rx="1.6" fill="#93c5fd" />
        <rect x="20" y="10" width="4" height="16" rx="1.6" fill="#60a5fa" opacity="0.9" />
        <rect x="28" y="14" width="4" height="12" rx="1.6" fill="#3b82f6" />
      </svg>
    ),
  },
  {
    key: "chat",
    title: "Chat",
    description: "Quickfire answers to questions.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
        <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
        <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
      </svg>
    ),
  },
  {
    key: "interview",
    title: "Interview",
    description: "In-depth audio interview to validate new concepts and pitch ideas.",
    icon: (
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
        <path d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" />
        <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
        <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
      </svg>
    ),
  },
];

const QUICK_PERSONA_ACTION_KEYS = ["interview", "chat", "questionnaire"] as const;
type QuickPersonaActionKey = (typeof QUICK_PERSONA_ACTION_KEYS)[number];

type QuickPersonaAction = {
  key: QuickPersonaActionKey;
  title: string;
  icon?: React.ReactNode;
};

const QUICK_PERSONA_ACTIONS: QuickPersonaAction[] = QUICK_PERSONA_ACTION_KEYS.map((key) => {
  const option = MODAL_OPTIONS.find((item) => item.key === key);
  if (option) {
    return {
      key: option.key as QuickPersonaActionKey,
      title: option.title,
      icon: option.icon,
    };
  }
  return { key, title: key.charAt(0).toUpperCase() + key.slice(1) };
});

const EDIT_OPTION = {
  key: "edit",
  title: "Edit",
  description: "Open the persona editor.",
  icon: <span className="persona-option-icon">✎</span>,
};

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
          {leading ? <div className="stage-panel__leading">{leading}</div> : null}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : null}
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
  const classes = [
    "stage-button",
    `stage-button--${variant}`,
    width === "full" ? "stage-button--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={`${classes} ${className}`.trim()} {...props} />;
}

export default function PersonasPage() {
  const pathname = usePathname();
  const router = useRouter();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [columns, setColumns] = useState<number>(() =>
    typeof window === "undefined" ? 4 : determineColumns(window.innerWidth)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaRow | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [personaDocuments, setPersonaDocuments] = useState<Record<string, AgentDocumentRow[]>>({});
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const quantUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [quantFileName, setQuantFileName] = useState<string | null>(null);
  const [quantFileURL, setQuantFileURL] = useState<string | null>(null);
  const [quantFileType, setQuantFileType] = useState<string | null>(null);
  const [quantFile, setQuantFile] = useState<File | null>(null);
  const [isCreatingQuestionnaireJob, setIsCreatingQuestionnaireJob] = useState(false);
  const [isHydratingQuestionnaireJob, setIsHydratingQuestionnaireJob] = useState(false);
  const [questionnaireJobError, setQuestionnaireJobError] = useState<string | null>(null);
  const [questionnaireJobId, setQuestionnaireJobId] = useState<string | null>(null);
  const [questionnaireJobStatus, setQuestionnaireJobStatus] = useState<string | null>(null);
  const [questionnaireExtractionResult, setQuestionnaireExtractionResult] = useState<string | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState<string>("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const nameWrapperRef = useRef<HTMLDivElement | null>(null);
  const nameMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [nameFieldWidth, setNameFieldWidth] = useState<number | null>(null);
  const [editingTraits, setEditingTraits] = useState<string>("");
  const [isSavingTraits, setIsSavingTraits] = useState(false);
  const [traitsError, setTraitsError] = useState<string | null>(null);
  const [scalarTraitValues, setScalarTraitValues] = useState<Record<PersonaScalarTraitKey, string>>({
    age: "",
    gender: "",
    location: "",
    customer_status: "",
  });
  const [scalarTraitSaving, setScalarTraitSaving] = useState<Record<PersonaScalarTraitKey, boolean>>({
    age: false,
    gender: false,
    location: false,
    customer_status: false,
  });
  const [scalarTraitErrors, setScalarTraitErrors] = useState<
    Record<PersonaScalarTraitKey, string | null>
  >({
    age: null,
    gender: null,
    location: null,
    customer_status: null,
  });
  const dataSourceInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isSavingDocuments, setIsSavingDocuments] = useState(false);
  const [documentsActionError, setDocumentsActionError] = useState<string | null>(null);
  const [painPointValues, setPainPointValues] = useState<string[]>([]);
  const [isSavingPainPoints, setIsSavingPainPoints] = useState(false);
  const [painPointsError, setPainPointsError] = useState<string | null>(null);
  const [intentSignalValues, setIntentSignalValues] = useState<string[]>([]);
  const [isSavingIntentSignals, setIsSavingIntentSignals] = useState(false);
  const [intentSignalsError, setIntentSignalsError] = useState<string | null>(null);
  const [stagedDocumentAdds, setStagedDocumentAdds] = useState<StagedDocumentAdd[]>([]);
  const [stagedDocumentRemovals, setStagedDocumentRemovals] = useState<string[]>([]);
  const [selectedMetaChip, setSelectedMetaChip] = useState<PersonaMetaChipLabel>(
    "Key Info"
  );
  const [isMounted, setIsMounted] = useState(false);

  const personaGridPositions = useMemo(() => {
    const total = personas.length;
    if (total === 0) return [] as GridPosition[];
    const safeColumns = Math.max(columns, 1);
    const positions: GridPosition[] = new Array(total);
    let currentRow = 1;
    for (let rowStart = 0; rowStart < total; rowStart += safeColumns) {
      const rowEnd = Math.min(rowStart + safeColumns, total);
      const rowItems = personas.slice(rowStart, rowEnd);
      const expandedIndexInRow =
        expandedPersonaId && expandedPersonaId.length > 0
          ? rowItems.findIndex((item) => item.agent_id === expandedPersonaId)
          : -1;
      if (expandedIndexInRow === -1) {
        for (let i = 0; i < rowItems.length; i += 1) {
          const globalIndex = rowStart + i;
          positions[globalIndex] = {
            gridColumn: `${i + 1}`,
            gridRow: `${currentRow}`,
          };
        }
        currentRow += 1;
      } else {
        const globalExpandedIndex = rowStart + expandedIndexInRow;
        positions[globalExpandedIndex] = {
          gridColumn: "1 / -1",
          gridRow: `${currentRow}`,
        };
        currentRow += 1;
        let colPointer = 1;
        for (let i = 0; i < rowItems.length; i += 1) {
          if (i === expandedIndexInRow) continue;
          const globalIndex = rowStart + i;
          positions[globalIndex] = {
            gridColumn: `${colPointer}`,
            gridRow: `${currentRow}`,
          };
          colPointer += 1;
          if (colPointer > safeColumns) {
            colPointer = 1;
            currentRow += 1;
          }
        }
        if (colPointer !== 1) {
          currentRow += 1;
        }
      }
    }
    return positions;
  }, [columns, personas, expandedPersonaId]);

  const stagedDocumentAddsRef = useRef<StagedDocumentAdd[]>([]);
  useEffect(() => {
    stagedDocumentAddsRef.current = stagedDocumentAdds;
  }, [stagedDocumentAdds]);
  useEffect(() => {
    return () => {
      stagedDocumentAddsRef.current.forEach((add) => {
        try {
          URL.revokeObjectURL(add.objectUrl);
        } catch (error) {
          // ignore revoke failures
        }
      });
    };
  }, []);

  const resetStagedDocuments = useCallback(() => {
    setStagedDocumentAdds((prev) => {
      prev.forEach((add) => {
        try {
          URL.revokeObjectURL(add.objectUrl);
        } catch (error) {
          // ignore revoke failures
        }
      });
      return [];
    });
    setStagedDocumentRemovals([]);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setColumns(determineColumns(window.innerWidth));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const baselinePersonaName = activePersona ? (activePersona.agent_name ?? "").trim() : "";
  const hasUnsavedName = Boolean(activePersona && editingName.trim() !== baselinePersonaName);
  const baselinePersonaDescription = activePersona ? activePersona.description ?? "" : "";
  const hasUnsavedDescription = Boolean(
    activePersona && editingDescription !== baselinePersonaDescription
  );
  const baselineKeyTraitsList = useMemo(() => {
    if (!activePersona || !Array.isArray(activePersona.key_traits)) {
      return [] as string[];
    }
    return activePersona.key_traits
      .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
      .filter((trait) => trait.length > 0);
  }, [activePersona, supabase]);
  const baselineKeyTraitsNormalized = baselineKeyTraitsList.length > 0
    ? normalizeTraitsInput(baselineKeyTraitsList.join(", "))
    : "";
  const normalizedEditingTraits = useMemo(() => normalizeTraitsInput(editingTraits), [editingTraits]);
  const hasUnsavedKeyTraits = Boolean(
    activePersona && normalizedEditingTraits !== baselineKeyTraitsNormalized
  );
  const baselinePainPointsList = useMemo(() => {
    if (!activePersona || !Array.isArray(activePersona.key_pain_points)) {
      return [] as string[];
    }
    return activePersona.key_pain_points
      .map((point) => (typeof point === "string" ? point.trim() : ""))
      .filter((point) => point.length > 0);
  }, [activePersona]);
  const normalizedPainPointValues = useMemo(
    () =>
      painPointValues
        .map((point) => point.trim())
        .filter((point) => point.length > 0),
    [painPointValues]
  );
  const hasUnsavedPainPoints = useMemo(() => {
    if (!activePersona) return false;
    if (normalizedPainPointValues.length !== baselinePainPointsList.length) return true;
    return normalizedPainPointValues.some(
      (value, index) => value !== baselinePainPointsList[index]
    );
  }, [activePersona, normalizedPainPointValues, baselinePainPointsList]);
  const baselineIntentSignalsList = useMemo(() => {
    if (!activePersona || !Array.isArray(activePersona.intent_signals)) {
      return [] as string[];
    }
    return activePersona.intent_signals
      .map((signal) => (typeof signal === "string" ? signal.trim() : ""))
      .filter((signal) => signal.length > 0);
  }, [activePersona]);
  const normalizedIntentSignalValues = useMemo(
    () =>
      intentSignalValues
        .map((signal) => signal.trim())
        .filter((signal) => signal.length > 0),
    [intentSignalValues]
  );
  const hasUnsavedIntentSignals = useMemo(() => {
    if (!activePersona) return false;
    if (normalizedIntentSignalValues.length !== baselineIntentSignalsList.length) return true;
    return normalizedIntentSignalValues.some(
      (value, index) => value !== baselineIntentSignalsList[index]
    );
  }, [activePersona, normalizedIntentSignalValues, baselineIntentSignalsList]);
  const activeIntentSignals = normalizedIntentSignalValues;
  const hasUnsavedDocuments =
    stagedDocumentAdds.length > 0 || stagedDocumentRemovals.length > 0;
  const baselineScalarTraits = useMemo(() => {
    return {
      age: readScalarTraitValue(activePersona, "age"),
      gender: readScalarTraitValue(activePersona, "gender"),
      location: readScalarTraitValue(activePersona, "location"),
      customer_status: readScalarTraitValue(activePersona, "customer_status"),
    } satisfies Record<PersonaScalarTraitKey, string>;
  }, [activePersona]);
  const hasUnsavedScalarTraits = useMemo(
    () =>
      SCALAR_TRAIT_KEYS.some((key) => {
        const baselineValue = baselineScalarTraits[key];
        const currentValue = (scalarTraitValues[key] ?? "").trim();
        return currentValue !== baselineValue;
      }),
    [baselineScalarTraits, scalarTraitValues]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    if (expandedPersonaId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedPersonaId]);

  const isViewer = profileRole === "viewer";
  const canEdit = profileRole !== null && !isViewer;

  const miniOptions = useMemo(() => {
    if (!selectedOption) {
      return [];
    }
    const options = MODAL_OPTIONS.filter((option) => option.key !== selectedOption);
    if (canEdit && selectedOption !== "edit") {
      options.push(EDIT_OPTION);
    }
    return isViewer ? options.filter((option) => option.key !== "edit") : options;
  }, [canEdit, isViewer, selectedOption]);

  const selectedOptionMeta = useMemo(() => {
    if (!selectedOption) {
      return null;
    }
    if (selectedOption === EDIT_OPTION.key) {
      if (isViewer) {
        return null;
      }
      return EDIT_OPTION;
    }
    return MODAL_OPTIONS.find((option) => option.key === selectedOption) ?? null;
  }, [canEdit, isViewer, selectedOption]);

  const personaEditMetaChips = useMemo<PersonaMetaChipLabel[]>(() => {
    if (selectedOption !== "edit") return [];
    return [...PERSONA_META_CHIP_LABELS];
  }, [selectedOption]);

  useEffect(() => {
    if (selectedOption === "edit") {
      setSelectedMetaChip("Key Info");
    }
  }, [selectedOption, activePersona?.agent_id]);

  const isKeyInfoSelected = selectedMetaChip === "Key Info";
  const isDataSourcesSelected = selectedMetaChip === "Data Sources";
  const isPainPointsSelected = selectedMetaChip === "Pain Points";
  const isIntentSignalsSelected = selectedMetaChip === "Intent Signals";

  useEffect(() => {
    async function fetchPersonas() {
      if (!clientSlug) {
        setError("Workspace not found");
        setPersonas([]);
        setProfileRole(null);
        setResolvedClientId(null);
        return;
      }
      setLoading(true);
      setError(null);
      setDocumentsError(null);
      setPersonaDocuments({});
      setDocumentsLoading(false);
      setResolvedClientId(null);
      try {
        let client: ClientRow | null = null;
        let clientQueryError: unknown = null;

        const { data: clientByName, error: clientByNameError } = await supabase
          .from("clients")
          .select("id, name")
          .eq("name", clientSlug)
          .maybeSingle<ClientRow>();
        if (clientByNameError) {
          clientQueryError = clientByNameError;
        }
        if (clientByName) {
          client = clientByName;
        }

        if (!client) {
          const { data: clientById, error: clientByIdError } = await supabase
            .from("clients")
            .select("id, name")
            .eq("id", clientSlug)
            .maybeSingle<ClientRow>();
          if (clientByIdError) {
            clientQueryError = clientByIdError;
          }
          if (clientById) {
            client = clientById;
          }
        }

        if (!client) {
          setError("Workspace not found");
          setPersonas([]);
          setProfileRole(null);
          setResolvedClientId(null);
          if (clientQueryError) {
            // eslint-disable-next-line no-console
            console.error("[personas] Failed to resolve client", clientQueryError);
          }
          return;
        }

        setResolvedClientId(client.id);

        const { data, error: personaError } = await supabase
          .from("agent_map")
          .select(
            "agent_id, agent_name, audience_type, content_type, description, status, dialogue_created_date, key, age, gender, location, customer_status, key_pain_points, intent_signals, key_traits"
          )
          .eq("client_id", client.id)
          .order("created_at", { ascending: false });
        if (personaError) {
          setError("Unable to load personas");
          setPersonas([]);
          return;
        }
        const personaRows = (data ?? []).filter((row) => row.agent_id);
        setPersonas(personaRows);

        if (personaRows.length > 0) {
          const agentIds = personaRows.map((row) => row.agent_id);
          if (agentIds.length > 0) {
            setDocumentsLoading(true);
            try {
              const { data: documentData, error: documentsFetchError } = await supabase
                .from("agent_documents")
                .select(
                  "id, agent_id, file_name, storage_path, public_url, mime_type, file_size, source, created_at"
                )
                .in("agent_id", agentIds);

              if (documentsFetchError) {
                setDocumentsError("Unable to load data sources.");
                setPersonaDocuments({});
              } else {
                const groupedDocuments = ((documentData as AgentDocumentRow[]) ?? []).reduce(
                  (acc, doc) => {
                    if (!doc.agent_id) return acc;
                    if (!acc[doc.agent_id]) {
                      acc[doc.agent_id] = [];
                    }
                    acc[doc.agent_id].push(doc);
                    return acc;
                  },
                  {} as Record<string, AgentDocumentRow[]>
                );
                setPersonaDocuments(groupedDocuments);
              }
            } finally {
              setDocumentsLoading(false);
            }
          } else {
            setDocumentsLoading(false);
          }
        } else {
          setDocumentsLoading(false);
        }
      } finally {
        setLoading(false);
        setDocumentsLoading(false);
      }
    }
    fetchPersonas();
  }, [clientSlug]);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileRole() {
      if (!clientSlug) {
        if (isMounted) {
          setProfileRole(null);
          setCurrentUserId(null);
        }
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;
      if (userError) {
        setProfileRole(null);
        setCurrentUserId(null);
        return;
      }
      const user = userData?.user ?? null;
      if (!user) {
        setProfileRole(null);
        setCurrentUserId(null);
        setCurrentUserDisplayName(null);
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, client_id, display_name")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();
      if (!isMounted) return;
      if (error || !profile) {
        setProfileRole(null);
        setCurrentUserId(null);
        setCurrentUserDisplayName(null);
        return;
      }
      const profileClientId = profile.client_id ?? null;
      const matchesResolvedClient =
        resolvedClientId && profileClientId ? profileClientId === resolvedClientId : false;
      const matchesSlug = profileClientId === clientSlug;
      if (!matchesResolvedClient && !matchesSlug) {
        setProfileRole(null);
        setCurrentUserId(null);
        setCurrentUserDisplayName(null);
        return;
      }
      setCurrentUserId(user.id);
      setProfileRole(profile.role ?? null);
      setCurrentUserDisplayName(profile.display_name ?? null);
    }
    fetchProfileRole();
    return () => {
      isMounted = false;
    };
  }, [clientSlug, resolvedClientId]);
  useEffect(() => {
    if (
      !questionnaireJobId ||
      questionnaireJobStatus === "parsed" ||
      questionnaireJobStatus === "failed"
    ) {
      return undefined;
    }

    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!isActive) return;
      try {
        const { data, error } = await supabase
          .from("questionnaire_jobs")
          .select("status, extraction_result")
          .eq("id", questionnaireJobId)
          .maybeSingle();
        if (error) {
          console.error("[questionnaire] polling failed", error);
        } else if (data) {
          const nextStatus = data.status ?? null;
          if (nextStatus) {
            setQuestionnaireJobStatus(nextStatus);
          }
          if (data.extraction_result !== undefined) {
            const serialized =
              data.extraction_result === null
                ? null
                : typeof data.extraction_result === "string"
                  ? data.extraction_result
                  : JSON.stringify(data.extraction_result, null, 2);
            setQuestionnaireExtractionResult((prev) =>
              prev === serialized ? prev : serialized
            );
          }
          if (nextStatus === "parsed" || nextStatus === "failed") {
            isActive = false;
            return;
          }
        }
      } catch (error) {
        console.error("[questionnaire] polling unexpected error", error);
      }
      timer = setTimeout(poll, 4000);
    };

    poll();

    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [questionnaireJobId, questionnaireJobStatus]);

  const handleTogglePersonaCard = useCallback((persona: PersonaRow) => {
    setExpandedPersonaId((prev) => (prev === persona.agent_id ? null : persona.agent_id));
  }, []);

  useEffect(() => {
    const container = contentContainerRef.current;
    if (!container) return;
    if (activePersona) {
      container.setAttribute("data-modal-open", "true");
    } else {
      container.removeAttribute("data-modal-open");
    }
    return () => {
      container.removeAttribute("data-modal-open");
    };
  }, [activePersona]);

  const handlePersonaCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, persona: PersonaRow) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleTogglePersonaCard(persona);
      }
    },
    [handleTogglePersonaCard]
  );

  const handleClosePersona = () => {
    setActivePersona(null);
    setSelectedOption(null);
  };

  const handleQuantUploadClick = () => {
    quantUploadInputRef.current?.click();
  };

  const handleRunQuestionnaire = useCallback(async () => {
    if (!activePersona) {
      setQuestionnaireJobError("No persona selected.");
      return;
    }
    if (!quantFile) {
      setQuestionnaireJobError("Upload a questionnaire document first.");
      return;
    }

    setIsCreatingQuestionnaireJob(true);
    setQuestionnaireJobError(null);
    setQuestionnaireJobStatus(null);
    setQuestionnaireJobId(null);
    setQuestionnaireExtractionResult(null);

    try {
      const safeName = quantFile.name
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      const fileName = safeName.length > 0 ? safeName : `questionnaire-${Date.now()}`;
      const storagePath = `${activePersona.agent_id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(QUESTIONNAIRE_STORAGE_BUCKET)
        .upload(storagePath, quantFile, {
          contentType: quantFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        setQuestionnaireJobError("Unable to upload questionnaire. Please try again.");
        return;
      }


      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[questionnaire] failed to read session", sessionError);
      }

      const accessToken = sessionData?.session?.access_token ?? null;
      console.log("[questionnaire] session snapshot", {
        hasSession: Boolean(sessionData?.session),
        tokenPrefix: accessToken ? `${accessToken.slice(0, 8)}…` : null,
        expiresAt: sessionData?.session?.expires_at ?? null,
      });

      if (!accessToken) {
        setQuestionnaireJobError("Missing authentication. Please sign in again.");
        return;
      }

      const response = await fetch("/api/questionnaires/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({
          agent_id: activePersona.agent_id,
          file_path: storagePath,
          file_size: quantFile.size,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: "Failed to create job." }));
        setQuestionnaireJobError(errorPayload?.error || "Unable to create questionnaire job.");
        return;
      }

      const { job } = (await response.json()) as { job?: { id: string; status: string } };
      if (!job?.id) {
        setQuestionnaireJobError("Unexpected response creating questionnaire job.");
        return;
      }

      setQuestionnaireJobId(job.id);
      setQuestionnaireJobStatus(job.status ?? "queued");

      setQuantFile(null);

      const derivedName = decodeStorageFileName(storagePath) ?? quantFile.name;
      setQuantFileName(quantFile.name || derivedName);
      setQuantFileType(quantFile.type || inferMimeTypeFromFilename(quantFile.name || derivedName));

      try {
        const { data: signedData } = await supabase.storage
          .from(QUESTIONNAIRE_STORAGE_BUCKET)
          .createSignedUrl(storagePath, 60 * 60);
        let resolvedUrl = signedData?.signedUrl ?? null;
        if (!resolvedUrl) {
          const { data: publicData } = supabase.storage
            .from(QUESTIONNAIRE_STORAGE_BUCKET)
            .getPublicUrl(storagePath);
          resolvedUrl =
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicUrl ??
            (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicURL ??
            null;
        }
        if (resolvedUrl) {
          setQuantFileURL(resolvedUrl);
        }
      } catch (storageError) {
        console.error("[questionnaire] failed to resolve storage url", storageError);
      }
    } catch (error) {
      console.error("[questionnaire] job creation failed", error);
      setQuestionnaireJobError("Unexpected error creating questionnaire job.");
    } finally {
      setIsCreatingQuestionnaireJob(false);
    }
  }, [activePersona, quantFile]);

  const handleQuantUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    // Revoke previous object URL if present
    if (quantFileURL && quantFileURL.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(quantFileURL);
      } catch (e) {
        // ignore
      }
    }
    const objectUrl = URL.createObjectURL(file);
    setQuantFileURL(objectUrl);
    setQuantFileType(file.type || inferMimeTypeFromFilename(file.name));
    setQuantFileName(file.name);
    setQuantFile(file);
    setQuestionnaireJobError(null);
    setQuestionnaireJobStatus(null);
    setQuestionnaireJobId(null);
    setQuestionnaireExtractionResult(null);
    // Clear the input so the same file can be selected again if needed
    event.currentTarget.value = "";
  };

  // Revoke object URL on unmount or when quantFileURL changes (cleanup previous)
  React.useEffect(() => {
    if (!quantFileURL || !quantFileURL.startsWith("blob:")) {
      return undefined;
    }
    const urlToRevoke = quantFileURL;
    return () => {
      try {
        URL.revokeObjectURL(urlToRevoke);
      } catch (e) {
        // ignore
      }
    };
  }, [quantFileURL]);


  useEffect(() => {
    if (activePersona) {
      setEditingName(activePersona.agent_name ?? "");
      setEditingDescription(activePersona.description ?? "");
      setNameError(null);
      setDescriptionError(null);
      setTraitsError(null);
      setIsSavingTraits(false);
      resetStagedDocuments();
      const initialTraitsList = Array.isArray(activePersona.key_traits)
        ? activePersona.key_traits
            .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
            .filter((trait) => trait.length > 0)
        : [];
      const normalizedInitialTraits = normalizeTraitsInput(initialTraitsList.join(", "));
      setEditingTraits(normalizedInitialTraits);
      setScalarTraitValues({
        age: readScalarTraitValue(activePersona, "age"),
        gender: readScalarTraitValue(activePersona, "gender"),
        location: readScalarTraitValue(activePersona, "location"),
        customer_status: readScalarTraitValue(activePersona, "customer_status"),
      });
      setScalarTraitErrors({ age: null, gender: null, location: null, customer_status: null });
      setScalarTraitSaving({ age: false, gender: false, location: false, customer_status: false });
      const initialPainPoints = Array.isArray(activePersona.key_pain_points)
        ? activePersona.key_pain_points
            .map((point) => (typeof point === "string" ? point.trim() : ""))
            .filter((point) => point.length > 0)
        : [];
      setPainPointValues(initialPainPoints);
      setPainPointsError(null);
      setIsSavingPainPoints(false);
      const initialIntentSignals = Array.isArray(activePersona.intent_signals)
        ? activePersona.intent_signals
            .map((signal) => (typeof signal === "string" ? signal.trim() : ""))
            .filter((signal) => signal.length > 0)
        : [];
      setIntentSignalValues(initialIntentSignals);
      setIntentSignalsError(null);
      setIsSavingIntentSignals(false);
      setDocumentsActionError(null);
      setIsUploadingDocument(false);
      setIsSavingDocuments(false);
    } else {
      setEditingName("");
      setEditingDescription("");
      setTraitsError(null);
      setIsSavingTraits(false);
      setEditingTraits("");
      setScalarTraitValues({ age: "", gender: "", location: "", customer_status: "" });
      setScalarTraitErrors({ age: null, gender: null, location: null, customer_status: null });
      setScalarTraitSaving({ age: false, gender: false, location: false, customer_status: false });
      setPainPointValues([]);
      setPainPointsError(null);
      setIsSavingPainPoints(false);
      setIntentSignalValues([]);
      setIntentSignalsError(null);
      setIsSavingIntentSignals(false);
      setDocumentsActionError(null);
      setIsUploadingDocument(false);
      setIsSavingDocuments(false);
      resetStagedDocuments();
    }
  }, [activePersona, resetStagedDocuments]);

  useEffect(() => {
    let cancelled = false;

    const resetQuestionnaireState = () => {
      setQuantFile(null);
      setQuantFileName(null);
      setQuantFileType(null);
      setQuantFileURL(null);
      setQuestionnaireJobId(null);
      setQuestionnaireJobStatus(null);
      setQuestionnaireExtractionResult(null);
      setQuestionnaireJobError(null);
    };

    if (!activePersona) {
      resetQuestionnaireState();
      setIsCreatingQuestionnaireJob(false);
      setIsHydratingQuestionnaireJob(false);
      return undefined;
    }

    resetQuestionnaireState();
    setIsCreatingQuestionnaireJob(false);
    setIsHydratingQuestionnaireJob(true);

    const hydrate = async () => {
      try {
        const { data, error } = await supabase
          .from("questionnaire_jobs")
          .select("id, status, extraction_result, file_path, created_at")
          .eq("agent_id", activePersona.agent_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("[questionnaire] failed to load previous job", error);
          setQuestionnaireJobError("Unable to load previous questionnaire run.");
          return;
        }

        if (!data) {
          return;
        }

        setQuestionnaireJobId(data.id ?? null);
        setQuestionnaireJobStatus(data.status ?? null);

        if (data.extraction_result !== undefined) {
          const serialized =
            data.extraction_result === null
              ? null
              : typeof data.extraction_result === "string"
              ? data.extraction_result
              : (() => {
                  try {
                    return JSON.stringify(data.extraction_result, null, 2);
                  } catch {
                    return null;
                  }
                })();
          setQuestionnaireExtractionResult(serialized);
        }

        if (data.file_path) {
          const decodedName = decodeStorageFileName(data.file_path);
          setQuantFileName(decodedName);
          setQuantFileType(inferMimeTypeFromFilename(decodedName));
          try {
            const { data: signedData } = await supabase.storage
              .from(QUESTIONNAIRE_STORAGE_BUCKET)
              .createSignedUrl(data.file_path, 60 * 60);
            let resolvedUrl = signedData?.signedUrl ?? null;
            if (!resolvedUrl) {
              const { data: publicData } = supabase.storage
                .from(QUESTIONNAIRE_STORAGE_BUCKET)
                .getPublicUrl(data.file_path);
              resolvedUrl =
                (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicUrl ??
                (publicData as { publicUrl?: string; publicURL?: string } | null)?.publicURL ??
                null;
            }
            if (!cancelled && resolvedUrl) {
              setQuantFileURL(resolvedUrl);
            }
          } catch (storageError) {
            if (!cancelled) {
              console.error("[questionnaire] failed to resolve stored questionnaire", storageError);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[questionnaire] unexpected hydration error", error);
          setQuestionnaireJobError("Unable to load previous questionnaire run.");
        }
      } finally {
        if (!cancelled) {
          setIsHydratingQuestionnaireJob(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [activePersona]);

  useEffect(() => {
    if (!nameWrapperRef.current || !nameMeasureRef.current) return;
    const wrapperWidth = nameWrapperRef.current.clientWidth;
    const measureWidth = nameMeasureRef.current.offsetWidth + 8;
    setNameFieldWidth(Math.min(measureWidth, wrapperWidth));
  }, [editingName, activePersona]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function handleResize() {
      if (!nameWrapperRef.current || !nameMeasureRef.current) return;
      const wrapperWidth = nameWrapperRef.current.clientWidth;
      const measureWidth = nameMeasureRef.current.offsetWidth + 8;
      setNameFieldWidth(Math.min(measureWidth, wrapperWidth));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const commitPersonaName = useCallback(async () => {
    if (!activePersona || isSavingName) return;
    const trimmed = editingName.trim();
    const baselineName = baselinePersonaName;
    if (!trimmed) {
      setEditingName(baselineName);
      setNameError("Name cannot be empty.");
      return;
    }
    if (trimmed === baselineName) {
      setNameError(null);
      if (editingName !== baselineName) {
        setEditingName(baselineName);
      }
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    const currentAgentId = activePersona.agent_id;
    const { error } = await supabase
      .from("agent_map")
      .update({ agent_name: trimmed })
      .eq("agent_id", currentAgentId);
    if (error) {
      setNameError("Unable to update name. Please try again.");
      setEditingName(baselineName);
      setIsSavingName(false);
      return;
    }
    setEditingName(trimmed);
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId ? { ...prev, agent_name: trimmed } : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId ? { ...persona, agent_name: trimmed } : persona
      )
    );
    setIsSavingName(false);
  }, [activePersona, baselinePersonaName, editingName, isSavingName]);

  const handleClearPersonaName = useCallback(() => {
    if (!activePersona) return;
    setEditingName(activePersona.agent_name ?? "");
    setNameError(null);
  }, [activePersona]);

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commitPersonaName();
        (event.currentTarget as HTMLInputElement).blur();
      } else if (event.key === "Escape" && activePersona) {
        event.preventDefault();
        setEditingName(activePersona.agent_name ?? "");
        setNameError(null);
        (event.currentTarget as HTMLInputElement).blur();
      }
    },
    [activePersona, commitPersonaName]
  );

  const commitPersonaDescription = useCallback(async () => {
    if (!activePersona || isSavingDescription) return;
    const currentAgentId = activePersona.agent_id;
    const previous = activePersona.description ?? "";
    if (editingDescription === previous) {
      setDescriptionError(null);
      return;
    }
    setIsSavingDescription(true);
    setDescriptionError(null);
    const { error } = await supabase
      .from("agent_map")
      .update({ description: editingDescription })
      .eq("agent_id", currentAgentId);
    if (error) {
      setDescriptionError("Unable to update description. Please try again.");
      setEditingDescription(previous);
      setIsSavingDescription(false);
      return;
    }
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId ? { ...prev, description: editingDescription } : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId ? { ...persona, description: editingDescription } : persona
      )
    );
    setIsSavingDescription(false);
  }, [activePersona, editingDescription, isSavingDescription]);

  const handleClearPersonaDescription = useCallback(() => {
    if (!activePersona) return;
    setEditingDescription(baselinePersonaDescription);
    setDescriptionError(null);
  }, [activePersona, baselinePersonaDescription]);

  const commitPersonaTraits = useCallback(async () => {
    if (!activePersona || isSavingTraits) return;
    const currentAgentId = activePersona.agent_id;
    const baselineNormalized = baselineKeyTraitsNormalized;
    const normalizedNext = normalizeTraitsInput(editingTraits);

    if (normalizedNext === baselineNormalized) {
      setTraitsError(null);
      if (editingTraits !== baselineNormalized) {
        setEditingTraits(baselineNormalized);
      }
      return;
    }

    const nextTraits = normalizedNext.length > 0 ? normalizedNext.split(", ").map((trait) => trait.trim()) : [];

    setIsSavingTraits(true);
    setTraitsError(null);
    const { error } = await supabase
      .from("agent_map")
      .update({ key_traits: nextTraits })
      .eq("agent_id", currentAgentId);
    if (error) {
      setTraitsError("Unable to update key traits. Please try again.");
      setIsSavingTraits(false);
      return;
    }

    setEditingTraits(normalizedNext);
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId ? { ...prev, key_traits: nextTraits } : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId ? { ...persona, key_traits: nextTraits } : persona
      )
    );
    setIsSavingTraits(false);
  }, [activePersona, baselineKeyTraitsNormalized, editingTraits, isSavingTraits]);

  const handleClearKeyTraits = useCallback(() => {
    if (!activePersona) return;
    setEditingTraits(baselineKeyTraitsNormalized);
    setTraitsError(null);
  }, [activePersona, baselineKeyTraitsNormalized]);

  const commitScalarTrait = useCallback(
    async (traitKey: PersonaScalarTraitKey) => {
      if (!activePersona || scalarTraitSaving[traitKey]) return;

      const currentAgentId = activePersona.agent_id;
      const rawValue = scalarTraitValues[traitKey] ?? "";
      const trimmedValue = rawValue.trim();
      const previousRaw = activePersona[traitKey];
      const previousString =
        previousRaw === null || previousRaw === undefined ? "" : `${previousRaw}`.trim();

      if (trimmedValue === previousString) {
        setScalarTraitErrors((prev) => ({ ...prev, [traitKey]: null }));
        if (rawValue !== previousString) {
          setScalarTraitValues((prev) => ({ ...prev, [traitKey]: previousString }));
        }
        return;
      }

      setScalarTraitSaving((prev) => ({ ...prev, [traitKey]: true }));
      setScalarTraitErrors((prev) => ({ ...prev, [traitKey]: null }));

      let payloadValue: string | number | null = null;
      if (trimmedValue.length > 0) {
        if (traitKey === "age") {
          const numericValue = Number(trimmedValue);
          payloadValue = Number.isNaN(numericValue) ? trimmedValue : numericValue;
        } else {
          payloadValue = trimmedValue;
        }
      }

      const { error } = await supabase
        .from("agent_map")
        .update({ [traitKey]: payloadValue })
        .eq("agent_id", currentAgentId);

      if (error) {
        setScalarTraitErrors((prev) => ({
          ...prev,
          [traitKey]: "Unable to update field. Please try again.",
        }));
        setScalarTraitValues((prev) => ({ ...prev, [traitKey]: previousString }));
        setScalarTraitSaving((prev) => ({ ...prev, [traitKey]: false }));
        return;
      }

      const nextDisplayValue = trimmedValue.length > 0 ? trimmedValue : "";
      setScalarTraitValues((prev) => ({ ...prev, [traitKey]: nextDisplayValue }));
      setScalarTraitSaving((prev) => ({ ...prev, [traitKey]: false }));
      setScalarTraitErrors((prev) => ({ ...prev, [traitKey]: null }));
      setActivePersona((prev) =>
        prev && prev.agent_id === currentAgentId
          ? { ...prev, [traitKey]: payloadValue }
          : prev
      );
      setPersonas((prev) =>
        prev.map((persona) =>
          persona.agent_id === currentAgentId
            ? { ...persona, [traitKey]: payloadValue }
            : persona
        )
      );
    },
    [activePersona, scalarTraitSaving, scalarTraitValues]
  );

  const commitUnsavedScalarTraits = useCallback(async () => {
    if (!activePersona) return;
    const keysToCommit = SCALAR_TRAIT_KEYS.filter((key) => {
      const baselineValue = baselineScalarTraits[key];
      const currentValue = (scalarTraitValues[key] ?? "").trim();
      return currentValue !== baselineValue;
    });
    if (keysToCommit.length === 0) return;
    for (const key of keysToCommit) {
      await commitScalarTrait(key);
    }
  }, [activePersona, baselineScalarTraits, scalarTraitValues, commitScalarTrait]);

  const handlePainPointChange = useCallback((index: number, value: string) => {
    setPainPointValues((prev) => {
      const next = prev.slice();
      next[index] = value;
      return next;
    });
    setPainPointsError(null);
  }, []);

  const handleAddPainPoint = useCallback(() => {
    if (!canEdit) return;
    setPainPointValues((prev) => [...prev, ""]);
    setPainPointsError(null);
  }, [canEdit]);

  const handleRemovePainPoint = useCallback(
    (index: number) => {
      if (!canEdit) return;
      setPainPointValues((prev) => prev.filter((_, idx) => idx !== index));
      setPainPointsError(null);
    },
    [canEdit]
  );

  const handleClearPainPoints = useCallback(() => {
    setPainPointValues([...baselinePainPointsList]);
    setPainPointsError(null);
  }, [baselinePainPointsList]);

  const handleSavePainPoints = useCallback(async () => {
    if (!activePersona || !canEdit || isSavingPainPoints) return;

    const currentAgentId = activePersona.agent_id;
    const previousPainPoints = Array.isArray(activePersona.key_pain_points)
      ? activePersona.key_pain_points
          .map((point) => (typeof point === "string" ? point.trim() : ""))
          .filter((point) => point.length > 0)
      : [];
    const nextPainPoints = painPointValues
      .map((point) => point.trim())
      .filter((point) => point.length > 0);

    if (JSON.stringify(previousPainPoints) === JSON.stringify(nextPainPoints)) {
      setPainPointsError(null);
      setPainPointValues(previousPainPoints);
      return;
    }

    setIsSavingPainPoints(true);
    setPainPointsError(null);

    const { error } = await supabase
      .from("agent_map")
      .update({ key_pain_points: nextPainPoints })
      .eq("agent_id", currentAgentId);

    if (error) {
      setPainPointsError("Unable to update pain points. Please try again.");
      setPainPointValues(previousPainPoints);
      setIsSavingPainPoints(false);
      return;
    }

    setPainPointValues(nextPainPoints);
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId
        ? { ...prev, key_pain_points: nextPainPoints }
        : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId
          ? { ...persona, key_pain_points: nextPainPoints }
          : persona
      )
    );
    setIsSavingPainPoints(false);
  }, [activePersona, canEdit, isSavingPainPoints, painPointValues]);

  const handleIntentSignalChange = useCallback((index: number, value: string) => {
    setIntentSignalValues((prev) => {
      const next = prev.slice();
      next[index] = value;
      return next;
    });
    setIntentSignalsError(null);
  }, []);

  const handleAddIntentSignal = useCallback(() => {
    if (!canEdit) return;
    setIntentSignalValues((prev) => [...prev, ""]);
    setIntentSignalsError(null);
  }, [canEdit]);

  const handleRemoveIntentSignal = useCallback(
    (index: number) => {
      if (!canEdit) return;
      setIntentSignalValues((prev) => prev.filter((_, idx) => idx !== index));
      setIntentSignalsError(null);
    },
    [canEdit]
  );

  const handleClearIntentSignals = useCallback(() => {
    setIntentSignalValues([...baselineIntentSignalsList]);
    setIntentSignalsError(null);
  }, [baselineIntentSignalsList]);

  const handleSaveIntentSignals = useCallback(async () => {
    if (!activePersona || !canEdit || isSavingIntentSignals) return;

    const currentAgentId = activePersona.agent_id;
    const previousIntentSignals = Array.isArray(activePersona.intent_signals)
      ? activePersona.intent_signals
          .map((signal) => (typeof signal === "string" ? signal.trim() : ""))
          .filter((signal) => signal.length > 0)
      : [];
    const nextIntentSignals = intentSignalValues
      .map((signal) => signal.trim())
      .filter((signal) => signal.length > 0);

    if (JSON.stringify(previousIntentSignals) === JSON.stringify(nextIntentSignals)) {
      setIntentSignalsError(null);
      setIntentSignalValues(previousIntentSignals);
      return;
    }

    setIsSavingIntentSignals(true);
    setIntentSignalsError(null);

    const { error } = await supabase
      .from("agent_map")
      .update({ intent_signals: nextIntentSignals })
      .eq("agent_id", currentAgentId);

    if (error) {
      setIntentSignalsError("Unable to update intent signals. Please try again.");
      setIntentSignalValues(previousIntentSignals);
      setIsSavingIntentSignals(false);
      return;
    }

    setIntentSignalValues(nextIntentSignals);
    setActivePersona((prev) =>
      prev && prev.agent_id === currentAgentId
        ? { ...prev, intent_signals: nextIntentSignals }
        : prev
    );
    setPersonas((prev) =>
      prev.map((persona) =>
        persona.agent_id === currentAgentId
          ? { ...persona, intent_signals: nextIntentSignals }
          : persona
      )
    );
    setIsSavingIntentSignals(false);
  }, [activePersona, canEdit, intentSignalValues, isSavingIntentSignals]);

  const handleDataSourceUploadClick = useCallback(() => {
    if (!canEdit || isUploadingDocument || isSavingDocuments) return;
    dataSourceInputRef.current?.click();
  }, [canEdit, isUploadingDocument, isSavingDocuments]);

  const handleDataSourceUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      event.target.value = "";
      if (!activePersona) return;
      if (isSavingDocuments) return;
      if (!canEdit) {
        setDocumentsActionError("You do not have permission to add documents.");
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setDocumentsActionError(null);
      setStagedDocumentAdds((prev) => [
        {
          id: uuidv4(),
          file,
          objectUrl,
          name: file.name,
          size: file.size,
          mimeType: file.type || null,
        },
        ...prev,
      ]);
    },
    [activePersona, canEdit, isSavingDocuments]
  );

  const activePersonaDocuments = useMemo(() => {
    if (!activePersona) return [] as AgentDocumentRow[];
    const rows = personaDocuments[activePersona.agent_id] ?? [];
    return rows
      .slice()
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [activePersona, personaDocuments]);

  const visiblePersonaDocuments = useMemo<DisplayDocumentRow[]>(() => {
    if (!activePersona) return [];
    const baseline = activePersonaDocuments.filter(
      (doc) => !stagedDocumentRemovals.includes(doc.id)
    );
    const staged = stagedDocumentAdds.map<DisplayDocumentRow>((add) => ({
      id: add.id,
      agent_id: activePersona.agent_id,
      file_name: add.name,
      storage_path: null,
      public_url: add.objectUrl,
      mime_type: add.mimeType ?? null,
      file_size: add.size,
      source: "Pending upload",
      created_at: null,
      isStaged: true,
      objectUrl: add.objectUrl,
    }));
    return [...staged, ...baseline];
  }, [activePersona, activePersonaDocuments, stagedDocumentAdds, stagedDocumentRemovals]);

  const displayedIntentSignals = canEdit ? intentSignalValues : activeIntentSignals;

  const handleRemoveStagedDocumentAdd = useCallback(
    (id: string) => {
      if (isSavingDocuments) return;
      setStagedDocumentAdds((prev) => {
        const next = prev.filter((item) => item.id !== id);
        const removed = prev.find((item) => item.id === id);
        if (removed) {
          try {
            URL.revokeObjectURL(removed.objectUrl);
          } catch (error) {
            // ignore revoke failures
          }
        }
        return next;
      });
    },
    [isSavingDocuments]
  );

  const handleStageDocumentRemoval = useCallback(
    (doc: AgentDocumentRow) => {
      if (!activePersona || !canEdit || isSavingDocuments) return;
      setDocumentsActionError(null);
      setStagedDocumentRemovals((prev) => {
        if (prev.includes(doc.id)) {
          return prev;
        }
        return [...prev, doc.id];
      });
    },
    [activePersona, canEdit, isSavingDocuments]
  );

  const commitStagedDocuments = useCallback(async () => {
    if (!activePersona || !canEdit) return;
    if (stagedDocumentAdds.length === 0 && stagedDocumentRemovals.length === 0) return;
    if (!clientSlug) {
      setDocumentsActionError("Missing workspace context.");
      return;
    }
    if (isSavingDocuments) return;

    const currentAgentId = activePersona.agent_id;
    const currentDocuments = personaDocuments[currentAgentId] ?? [];
    const nextDocuments = currentDocuments.slice();

    setIsSavingDocuments(true);
    setDocumentsActionError(null);

    try {
      for (const docId of stagedDocumentRemovals) {
        const doc = currentDocuments.find((row) => row.id === docId);
        if (doc?.storage_path) {
          const { error: storageError } = await supabase.storage
            .from("docs")
            .remove([doc.storage_path]);
          if (storageError && storageError.message && storageError.message !== "Object not found") {
            // eslint-disable-next-line no-console
            console.warn("[personas] Failed to remove storage object", storageError.message);
          }
        }

        const { error: deleteError } = await supabase
          .from("agent_documents")
          .delete()
          .eq("id", docId);
        if (deleteError) {
          throw new Error(deleteError.message);
        }

        const index = nextDocuments.findIndex((row) => row.id === docId);
        if (index !== -1) {
          nextDocuments.splice(index, 1);
        }
      }

      for (const staged of stagedDocumentAdds.slice().reverse()) {
        const uniqueName = `${uuidv4()}-${staged.name}`;
        const storagePath = `clients/${clientSlug}/${currentAgentId}/${uniqueName}`;
        const { error: uploadError } = await supabase.storage
          .from("docs")
          .upload(storagePath, staged.file, { upsert: true });
        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = await supabase.storage
          .from("docs")
          .getPublicUrl(storagePath);
        const publicUrl =
          (publicUrlData as any)?.publicUrl ??
          (publicUrlData as any)?.publicURL ??
          buildPublicUrl(storagePath);

        const { data: insertedDoc, error: insertError } = await supabase
          .from("agent_documents")
          .insert({
            agent_id: currentAgentId,
            file_name: staged.name,
            storage_path: storagePath,
            public_url: publicUrl,
            document_url: null,
            document_id: null,
            mime_type: staged.mimeType,
            file_size: staged.size,
            source: "storage",
            added_stage: "persona-edit",
          })
          .select()
          .single<AgentDocumentRow>();

        if (insertError || !insertedDoc) {
          throw new Error(insertError?.message ?? "Unable to save document.");
        }

        nextDocuments.unshift(insertedDoc);
      }

      setPersonaDocuments((prev) => ({
        ...prev,
        [currentAgentId]: nextDocuments,
      }));
      resetStagedDocuments();
      setDocumentsError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save document changes.";
      setDocumentsActionError(message);
    } finally {
      setIsSavingDocuments(false);
    }
  }, [
    activePersona,
    canEdit,
    stagedDocumentAdds,
    stagedDocumentRemovals,
    clientSlug,
    isSavingDocuments,
    personaDocuments,
    resetStagedDocuments,
  ]);

  const hasAnyUnsavedChanges =
    hasUnsavedName ||
    hasUnsavedDescription ||
    hasUnsavedKeyTraits ||
    hasUnsavedScalarTraits ||
    hasUnsavedPainPoints ||
    hasUnsavedIntentSignals ||
    hasUnsavedDocuments;
  const showUnsavedChangesBanner = selectedOption === "edit" && canEdit && hasAnyUnsavedChanges;
  const handleClearUnsavedChanges = useCallback(() => {
    if (hasUnsavedName) {
      handleClearPersonaName();
    }
    if (hasUnsavedDescription) {
      handleClearPersonaDescription();
    }
    if (hasUnsavedKeyTraits) {
      handleClearKeyTraits();
    }
    if (hasUnsavedScalarTraits) {
      setScalarTraitValues((prev) => {
        const next: Record<PersonaScalarTraitKey, string> = { ...prev };
        SCALAR_TRAIT_KEYS.forEach((key) => {
          next[key] = baselineScalarTraits[key];
        });
        return next;
      });
      setScalarTraitErrors({
        age: null,
        gender: null,
        location: null,
        customer_status: null,
      });
    }
    if (hasUnsavedPainPoints) {
      handleClearPainPoints();
    }
    if (hasUnsavedIntentSignals) {
      handleClearIntentSignals();
    }
    if (hasUnsavedDocuments) {
      resetStagedDocuments();
      setDocumentsActionError(null);
    }
  }, [
    hasUnsavedName,
    handleClearPersonaName,
    hasUnsavedDescription,
    handleClearPersonaDescription,
    hasUnsavedKeyTraits,
    handleClearKeyTraits,
    hasUnsavedScalarTraits,
    baselineScalarTraits,
    hasUnsavedPainPoints,
    handleClearPainPoints,
    hasUnsavedIntentSignals,
    handleClearIntentSignals,
    hasUnsavedDocuments,
    resetStagedDocuments,
    setDocumentsActionError,
  ]);
  const handleSaveUnsavedChanges = useCallback(async () => {
    if (!hasAnyUnsavedChanges) return;
    if (hasUnsavedName) {
      await commitPersonaName();
    }
    if (hasUnsavedDescription) {
      await commitPersonaDescription();
    }
    if (hasUnsavedKeyTraits) {
      await commitPersonaTraits();
    }
    if (hasUnsavedScalarTraits) {
      await commitUnsavedScalarTraits();
    }
    if (hasUnsavedPainPoints) {
      await handleSavePainPoints();
    }
    if (hasUnsavedIntentSignals) {
      await handleSaveIntentSignals();
    }
    if (hasUnsavedDocuments) {
      await commitStagedDocuments();
    }
  }, [
    hasAnyUnsavedChanges,
    hasUnsavedName,
    commitPersonaName,
    hasUnsavedDescription,
    commitPersonaDescription,
    hasUnsavedKeyTraits,
    commitPersonaTraits,
    hasUnsavedScalarTraits,
    commitUnsavedScalarTraits,
    hasUnsavedPainPoints,
    handleSavePainPoints,
    hasUnsavedIntentSignals,
    handleSaveIntentSignals,
    hasUnsavedDocuments,
    commitStagedDocuments,
  ]);
  const isSavingScalarTraits = useMemo(
    () => Object.values(scalarTraitSaving).some(Boolean),
    [scalarTraitSaving]
  );
  const isSavingAny =
    isSavingName ||
    isSavingDescription ||
    isSavingTraits ||
    isSavingScalarTraits ||
    isSavingPainPoints ||
    isSavingIntentSignals ||
    isSavingDocuments;

  const unsavedChangesBanner = (
    <div
      className={`persona-unsaved-banner${showUnsavedChangesBanner ? " persona-unsaved-banner--visible" : ""}`}
      role="alert"
      aria-live="polite"
      aria-hidden={showUnsavedChangesBanner ? "false" : "true"}
    >
      <span className="persona-unsaved-message" style={{ fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif" }}>
        You have unsaved changes
      </span>
      <div className="persona-unsaved-actions">
        <button
          type="button"
          className="persona-unsaved-clear"
          onClick={handleClearUnsavedChanges}
          disabled={isSavingAny}
        >
          Clear
        </button>
        <button
          type="button"
          className="persona-unsaved-save"
          onClick={() => {
            void handleSaveUnsavedChanges();
          }}
          disabled={isSavingAny}
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <>
      <main
      className="stage-layout persona-root"
      data-expanded={expandedPersonaId ? "true" : "false"}
    >
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div ref={contentContainerRef} className="stage-layout__content">
        <div className="stage-shell">
        <StagePanel
          heading="Personas"
          trailing={
            clientSlug && canEdit ? (
              <StageButton
                type="button"
                variant="secondary"
                onClick={() => router.push(`/client/${clientSlug}/upload`)}
                className="personas-new-button"
              >
                <span className="stage-button__icon" aria-hidden="true">+</span>
                <span>New persona</span>
              </StageButton>
            ) : undefined
          }
        >
        <section className="personas-section">
          <div className="personas-grid">
            {loading && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 16,
                }}
              >
                Loading personas…
              </div>
            )}
            {!loading && error && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid rgba(239,68,68,0.35)",
                  background: "rgba(239,68,68,0.12)",
                  color: "#fecaca",
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}
            {!loading && !error && personas.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 16,
                }}
              >
                No personas configured yet.
              </div>
            )}
            {!loading &&
              !error &&
              personas.map((persona, index) => {
                const isExpanded = expandedPersonaId === persona.agent_id;
                const gridPosition = personaGridPositions[index];
                const cardButtonStyle: React.CSSProperties = {};
                if (gridPosition?.gridColumn) {
                  cardButtonStyle.gridColumn = gridPosition.gridColumn;
                }
                if (gridPosition?.gridRow) {
                  cardButtonStyle.gridRow = gridPosition.gridRow;
                }
                const traitChips = buildPersonaTraits(persona);
                const updatedLabel = buildUpdatedLabel(persona.dialogue_created_date);
                const painPoints = Array.isArray(persona.key_pain_points)
                  ? persona.key_pain_points.filter((point): point is string =>
                      typeof point === "string" && point.trim().length > 0
                    )
                  : [];
                const intentSignals = Array.isArray(persona.intent_signals)
                  ? persona.intent_signals.filter((signal): signal is string =>
                      typeof signal === "string" && signal.trim().length > 0
                    )
                  : [];
                const keyTraits = Array.isArray(persona.key_traits)
                  ? persona.key_traits
                      .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
                      .filter((trait): trait is string => trait.length > 0)
                  : [];
                const documents = personaDocuments[persona.agent_id] ?? [];
                return (
                  <div
                    key={persona.agent_id}
                    role="button"
                    tabIndex={0}
                    className="persona-card-button"
                    onClick={() => handleTogglePersonaCard(persona)}
                    onKeyDown={(event) => {
                      handlePersonaCardKeyDown(event, persona);
                    }}
                    aria-expanded={isExpanded}
                    style={cardButtonStyle}
                  >
                    <article
                      className="persona-card"
                      style={
                        isExpanded
                          ? {
                              borderColor: "rgba(30, 41, 59, 0.28)",
                              boxShadow: "0 18px 44px rgba(15, 23, 42, 0.18)",
                            }
                          : undefined
                      }
                    >
                    <div className="persona-card__body">
                      <div className="persona-card__title-row">
                        <div className="persona-card__title-block">
                          <h3 className="persona-card__title">{persona.agent_name ?? "Untitled persona"}</h3>
                          {isExpanded && keyTraits.length > 0 ? (
                            <p className="persona-card__traits-inline">{keyTraits.join(", ")}</p>
                          ) : null}
                        </div>
                        {isExpanded ? (
                          <div className="persona-title-actions">
                            <div className="persona-title-actions__group">
                              {QUICK_PERSONA_ACTIONS.map((action) => {
                                const classes = ["persona-title-cta"];
                                return (
                                  <button
                                    key={`${persona.agent_id}-${action.key}`}
                                    type="button"
                                    className={classes.join(" ")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setActivePersona(persona);
                                      setSelectedOption(action.key);
                                    }}
                                  >
                                    {action.icon ? (
                                      <span className="persona-title-cta__icon" aria-hidden="true">
                                        {action.icon}
                                      </span>
                                    ) : null}
                                    <span className="persona-title-cta__label">{action.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {canEdit ? (
                              <button
                                type="button"
                                className="persona-title-cta persona-title-cta--ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActivePersona(persona);
                                  setSelectedOption("edit");
                                }}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <p className="persona-card__type">{persona.content_type ?? ""}</p>
                    </div>
                    <div
                      className="persona-card__expanded"
                      data-visible={isExpanded ? "true" : "false"}
                    >
                      <div className="persona-card__expanded-inner">
                        <div className="persona-traits" role="list">
                          <div className="persona-traits__chips">
                            {traitChips.map((trait) => (
                              <span key={trait.label} className="persona-trait-chip" role="listitem">
                                <strong>{trait.label}:</strong>
                                <span>{trait.value}</span>
                              </span>
                            ))}
                          </div>
                          {isExpanded ? (
                            <span className="persona-title-updated persona-title-updated--inline">
                              <span className="persona-updated__label">Updated:</span>
                              {updatedLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="persona-description">
                          <p>
                            {persona.description && persona.description.trim().length > 0
                              ? persona.description
                              : "No description has been added yet."}
                          </p>
                        </div>
                        <div className="persona-expanded-scroll">
                          <div className="persona-expanded-grid">
                            <div className="persona-expanded-block">
                              <h4>Key pain points</h4>
                              <ul className="persona-expanded-list">
                                {painPoints.length > 0 ? (
                                  painPoints.map((point, index) => (
                                    <li key={`pain-point-${persona.agent_id}-${index}`}>
                                      <div className="persona-expanded-list-item">{point}</div>
                                    </li>
                                  ))
                                ) : (
                                  <li>
                                    <div className="persona-expanded-list-item">No pain points captured yet.</div>
                                  </li>
                                )}
                              </ul>
                              {canEdit && painPoints.length === 0 ? (
                                <button
                                  type="button"
                                  className="persona-expanded-add"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActivePersona(persona);
                                    setSelectedOption("edit");
                                    setExpandedPersonaId(persona.agent_id);
                                  }}
                                >
                                  Add pain points in editor
                                </button>
                              ) : null}
                            </div>
                            <div className="persona-expanded-block">
                              <h4>Intent signals</h4>
                              <ul className="persona-expanded-list">
                                {intentSignals.length > 0 ? (
                                  intentSignals.map((signal, index) => (
                                    <li key={`intent-signal-${persona.agent_id}-${index}`}>
                                      <div className="persona-expanded-list-item">{signal}</div>
                                    </li>
                                  ))
                                ) : (
                                  <li>
                                    <div className="persona-expanded-list-item">No intent signals captured yet.</div>
                                  </li>
                                )}
                              </ul>
                              {canEdit && intentSignals.length === 0 ? (
                                <button
                                  type="button"
                                  className="persona-expanded-add"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActivePersona(persona);
                                    setSelectedOption("edit");
                                    setExpandedPersonaId(persona.agent_id);
                                  }}
                                >
                                  Add intent signals in editor
                                </button>
                              ) : null}
                            </div>
                            <div className="persona-expanded-block">
                              <h4>Data sources</h4>
                              <ul className="persona-expanded-list">
                                {documents.length > 0 ? (
                                  documents.map((doc) => {
                                    const metaParts: string[] = [];
                                    const title = doc.file_name && doc.file_name.trim().length > 0 ? doc.file_name.trim() : "Untitled document";
                                    const trimmedSource = doc.source && doc.source.trim().length > 0 ? doc.source.trim() : null;
                                    if (trimmedSource) {
                                      metaParts.push(trimmedSource);
                                    } else if (doc.mime_type && doc.mime_type.trim().length > 0) {
                                      metaParts.push(doc.mime_type.trim());
                                    }
                                    if (typeof doc.file_size === "number" && doc.file_size > 0) {
                                      const sizeInKb = doc.file_size / 1024;
                                      const sizeLabel = sizeInKb >= 1024
                                        ? `${(sizeInKb / 1024).toFixed(1)} MB`
                                        : `${Math.max(sizeInKb, 1).toFixed(0)} KB`;
                                      metaParts.push(sizeLabel);
                                    }
                                    const createdLabel = doc.created_at ? formatDate(doc.created_at) : null;
                                    if (createdLabel && createdLabel !== "—") {
                                      metaParts.push(createdLabel);
                                    }
                                    return (
                                      <li key={`persona-document-${persona.agent_id}-${doc.id}`}>
                                        <div className="persona-expanded-list-item persona-expanded-list-item--document">
                                          <span className="persona-doc-title">{title}</span>
                                          {metaParts.length > 0 ? (
                                            <span className="persona-doc-meta">{metaParts.join(" · ")}</span>
                                          ) : null}
                                        </div>
                                      </li>
                                    );
                                  })
                                ) : (
                                  <li>
                                    <div className="persona-expanded-list-item">
                                      {documentsLoading
                                        ? "Loading data sources…"
                                        : documentsError
                                          ? "Unable to load data sources."
                                          : "No data sources added yet."}
                                    </div>
                                  </li>
                                )}
                              </ul>
                              {canEdit && !documentsLoading && !documentsError && documents.length === 0 ? (
                                <button
                                  type="button"
                                  className="persona-expanded-add"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActivePersona(persona);
                                    setSelectedOption("edit");
                                    setExpandedPersonaId(persona.agent_id);
                                  }}
                                >
                                  Add data sources in editor
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                    <div
                      className="persona-card__footer"
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}
                    >
                      {!isExpanded ? (
                        <div className="persona-traits persona-traits--collapsed" role="list">
                          <div className="persona-traits__chips">
                            {traitChips.map((trait) => (
                              <span key={`collapsed-${trait.label}`} className="persona-trait-chip" role="listitem">
                                <strong>{trait.label}:</strong>
                                <span>{trait.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                  </div>
                );
              })}
          </div>
        </section>
        </StagePanel>

        <FullscreenModal
          open={!!activePersona}
          onCloseAction={handleClosePersona}
          anchorRef={contentContainerRef}
        >
          {activePersona && (
            <><div
              ref={modalPanelRef}
              className={`persona-modal-container${selectedOption ? " persona-modal-container--expanded" : ""}`}
            >
              <header className={`persona-modal-header${selectedOption ? " persona-modal-header--with-mini" : ""}${selectedOption && selectedOption !== "edit" ? " persona-modal-header--with-selection" : ""}`}>
                <div className="persona-modal-heading">
                  <div className="persona-modal-title-row">
                    <div className="persona-modal-title-left">
                      <PillButton
                        className="persona-modal-close"
                        onClick={handleClosePersona}
                        aria-label="Back to personas"
                        style={{ padding: "6px 10px", border: "none", background: "transparent", color: "#052033" }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            fontSize: 28,
                            lineHeight: 1,
                            display: "inline-flex",
                            transform: "translateX(-2px)",
                          }}
                        >
                          ‹
                        </span>
                      </PillButton>
                      <div className="persona-modal-title-wrapper" role="heading" aria-level={2}>
                        <span
                          id="persona-modal-title"
                          className="persona-modal-title-display"
                          aria-label="Persona name"
                        >
                          {editingName && editingName.trim().length > 0
                            ? editingName
                            : "Untitled persona"}
                        </span>
                        {isSavingName ? (
                          <span className="persona-modal-title-status">Saving…</span>
                        ) : nameError ? (
                          <span className="persona-modal-title-error">{nameError}</span>
                        ) : null}
                      </div>
                    </div>
                    {selectedOption && (
                      <div className="persona-modal-title-chips">
                        {miniOptions.map((option) => (
                          <PillButton
                            key={`mini-${option.key}`}
                            type="button"
                            variant="subtle"
                            className="persona-modal-mini-card"
                            onClick={() => setSelectedOption(option.key as string)}
                            style={{ gap: 18, padding: "10px 18px", fontSize: 14 }}
                          >
                            <span className="persona-modal-icon persona-modal-icon--mini">{option.icon}</span>
                            <div className="persona-modal-mini-meta">
                              <strong>{option.title}</strong>
                            </div>
                          </PillButton>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="persona-modal-subheading-wrapper">
                    {selectedOptionMeta ? (
                      <div className="persona-modal-subheading persona-modal-subheading--card">
                        <span className="persona-modal-subheading-icon" aria-hidden="true">
                          {selectedOptionMeta.icon}
                        </span>
                        <span>{`${selectedOptionMeta.title}: ${selectedOptionMeta.description}`}</span>
                      </div>
                    ) : (
                      <p className="persona-modal-subheading">
                        Pick the format you want to run with this persona.
                      </p>
                    )}
                  </div>
                </div>
              </header>
              <div className={`persona-modal-body${selectedOption === "edit" ? " persona-modal-body--edit" : ""}`}>
                {selectedOption === "edit" ? (
                  <>
                    <div className="persona-modal-option persona-modal-option--expanded persona-modal-option--edit">
                      <div className="persona-modal-option-body persona-modal-option-body--edit">
                        <div className="persona-edit-scroll">
                          <div className="persona-edit-layout">
                            <div className="persona-edit-column" style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
                            {personaEditMetaChips.length > 0 ? (
                              <div className="persona-edit-meta-chips" role="list">
                                {personaEditMetaChips.map((chipLabel) => {
                                  const isSelected = selectedMetaChip === chipLabel;
                                  return (
                                    <button
                                      key={chipLabel}
                                      type="button"
                                      className="persona-edit-meta-chip"
                                      role="listitem"
                                      data-selected={isSelected ? "true" : "false"}
                                      aria-pressed={isSelected}
                                      onClick={() => {
                                        setSelectedMetaChip(chipLabel);
                                      }}
                                    >
                                      {chipLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                            {isKeyInfoSelected ? (
                              <div className="persona-edit-top-grid" aria-hidden="true">
                                <div className="persona-edit-top-left">
                                  <div className="persona-edit-name-wrapper" ref={nameWrapperRef}>
                                    <span
                                      ref={nameMeasureRef}
                                      className="persona-edit-name-measure"
                                      aria-hidden="true"
                                    >
                                      {editingName || "Untitled persona"}
                                    </span>
                                    <input
                                      id="persona-edit-name"
                                      type="text"
                                      value={editingName}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setEditingName(nextValue);
                                        setNameError(null);
                                      }}
                                      onKeyDown={handleNameKeyDown}
                                      className="persona-edit-name-input"
                                      placeholder="Untitled persona"
                                      disabled={isSavingName}
                                      style={nameFieldWidth ? { width: `${nameFieldWidth}px` } : undefined}
                                    />

                                  </div>
                                  <div className="persona-edit-key-traits">
                                    <textarea
                                      id="persona-edit-key-traits-input"
                                      value={editingTraits}
                                      onChange={(event) => {
                                        setEditingTraits(event.target.value);
                                        setTraitsError(null);
                                      }}
                                      onKeyDown={(event) => {
                                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                          event.preventDefault();
                                          void commitPersonaTraits();
                                        } else if (event.key === "Escape") {
                                          event.preventDefault();
                                          handleClearKeyTraits();
                                          (event.currentTarget as HTMLTextAreaElement).blur();
                                        }
                                      }}
                                      placeholder="Enter key traits separated by commas"
                                      rows={2}
                                      disabled={isSavingTraits}
                                      aria-label="Key traits"
                                    />
                                    {isSavingTraits ? (
                                      <span className="persona-edit-status">Saving…</span>
                                    ) : traitsError ? (
                                      <span className="persona-edit-error persona-edit-error--inline">{traitsError}</span>
                                    ) : null}
                                  </div>
                                  <div className="persona-edit-static-traits" aria-live="polite">
                                    <div className="persona-edit-static-traits__chips">
                                      {PERSONA_SCALAR_TRAITS.map(({ key, label, placeholder, inputMode }) => {
                                        const isSavingField = scalarTraitSaving[key];
                                        const errorMessage = scalarTraitErrors[key];
                                        return (
                                          <div key={`persona-trait-edit-${key}`} className="persona-edit-static-trait">
                                            <label className="persona-trait-chip persona-trait-chip--editable">
                                              <strong>{label}:</strong>
                                              <input
                                                type="text"
                                                value={scalarTraitValues[key]}
                                                onChange={(event) => {
                                                  const nextValue = event.target.value;
                                                  setScalarTraitValues((prev) => ({ ...prev, [key]: nextValue }));
                                                  setScalarTraitErrors((prev) => ({ ...prev, [key]: null }));
                                                }}
                                                onKeyDown={(event) => {
                                                  if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    (event.currentTarget as HTMLInputElement).blur();
                                                  } else if (event.key === "Escape") {
                                                    event.preventDefault();
                                                    const previousValue = readScalarTraitValue(activePersona, key);
                                                    setScalarTraitValues((prev) => ({ ...prev, [key]: previousValue }));
                                                    setScalarTraitErrors((prev) => ({ ...prev, [key]: null }));
                                                    (event.currentTarget as HTMLInputElement).blur();
                                                  }
                                                }}
                                                placeholder={placeholder}
                                                disabled={isSavingField}
                                                inputMode={inputMode}
                                                aria-label={label}
                                              />
                                            </label>
                                            {isSavingField ? (
                                              <span className="persona-edit-status persona-edit-status--chip">Saving…</span>
                                            ) : errorMessage ? (
                                              <span className="persona-edit-error persona-edit-error--chip">{errorMessage}</span>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {isSavingName ? (
                                    <span className="persona-edit-status">Saving…</span>
                                  ) : nameError ? (
                                    <span className="persona-edit-error">{nameError}</span>
                                  ) : null}
                                </div>

                                <div className="persona-edit-description">
                                  <textarea
                                    id="persona-edit-description"
                                    value={editingDescription}
                                    placeholder="No description has been added for this persona yet."
                                    onChange={(event) => {
                                      setEditingDescription(event.target.value);
                                      setDescriptionError(null);
                                    }}
                                    onKeyDown={(event) => {
                                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                        event.preventDefault();
                                        void commitPersonaDescription();
                                      } else if (event.key === "Escape") {
                                        event.preventDefault();
                                        handleClearPersonaDescription();
                                        (event.currentTarget as HTMLTextAreaElement).blur();
                                      }
                                    }}
                                    disabled={isSavingDescription}
                                  />
                                  {isSavingDescription ? (
                                    <span className="persona-edit-status">Saving…</span>
                                  ) : descriptionError ? (
                                    <span className="persona-edit-error">{descriptionError}</span>
                                  ) : null}

                                </div>
                              </div>
                            ) : null}
                            {isDataSourcesSelected ? (
                              <div className="persona-edit-documents-section">
                                <div className="persona-edit-documents-header">
                                  <h4>Data sources</h4>
                                  <div className="persona-edit-documents-actions">
                                    <input
                                      ref={dataSourceInputRef}
                                      type="file"
                                      accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
                                      style={{ display: "none" }}
                                      onChange={handleDataSourceUploadChange}
                                    />
                                    {canEdit ? (
                                      <PillButton
                                        type="button"
                                        onClick={handleDataSourceUploadClick}
                                        disabled={isUploadingDocument || isSavingDocuments}
                                        className="persona-edit-documents-upload"
                                      >
                                        {isUploadingDocument
                                          ? "Uploading…"
                                          : isSavingDocuments
                                            ? "Saving…"
                                            : "Upload file"}
                                      </PillButton>
                                    ) : null}
                                  </div>
                                </div>
                                {documentsActionError ? (
                                  <span className="persona-edit-error persona-edit-error--documents">{documentsActionError}</span>
                                ) : null}
                                {documentsError ? (
                                  <span className="persona-edit-error persona-edit-error--documents">{documentsError}</span>
                                ) : null}
                                {isSavingDocuments ? (
                                  <span className="persona-edit-status persona-edit-status--documents">Saving changes…</span>
                                ) : null}
                                {documentsLoading ? (
                                  <div className="persona-edit-documents--empty">Loading data sources…</div>
                                ) : visiblePersonaDocuments.length === 0 ? (
                                  <div className="persona-edit-documents--empty">No data sources added yet.</div>
                                ) : (
                                  <div className="persona-edit-documents" role="list">
                                    {visiblePersonaDocuments.map((doc) => {
                                      const isStaged = doc.isStaged === true;
                                      const metaParts: string[] = [];
                                      const title = doc.file_name && doc.file_name.trim().length > 0 ? doc.file_name.trim() : "Untitled document";
                                      const trimmedSource = doc.source && doc.source.trim().length > 0 ? doc.source.trim() : null;
                                      if (trimmedSource) {
                                        metaParts.push(trimmedSource);
                                      } else if (doc.mime_type && doc.mime_type.trim().length > 0) {
                                        metaParts.push(doc.mime_type.trim());
                                      }
                                      if (typeof doc.file_size === "number" && doc.file_size > 0) {
                                        metaParts.push(formatBytes(doc.file_size));
                                      }
                                      const createdLabel = doc.created_at ? formatDate(doc.created_at) : null;
                                      if (createdLabel && createdLabel !== "—") {
                                        metaParts.push(createdLabel);
                                      }
                                      const displayTitle =
                                        title.length > DOCUMENT_TITLE_MAX_CHARS
                                          ? `${title.slice(0, DOCUMENT_TITLE_MAX_CHARS).trimEnd()}…`
                                          : title;
                                      return (
                                        <div key={doc.id} className="persona-edit-document-card" role="listitem">
                                          {canEdit ? (
                                            <button
                                              type="button"
                                              className="persona-edit-document-close"
                                              onClick={() => {
                                                if (isStaged) {
                                                  handleRemoveStagedDocumentAdd(doc.id);
                                                } else {
                                                  handleStageDocumentRemoval(doc);
                                                }
                                              }}
                                              aria-label={`Remove ${title}`}
                                              disabled={isSavingDocuments}
                                            >
                                              ×
                                            </button>
                                          ) : null}
                                          <div className="persona-edit-document-meta">
                                            <strong className="persona-edit-document-title" title={title}>{displayTitle}</strong>
                                            {metaParts.length > 0 ? (
                                              <span className="persona-edit-document-details">{metaParts.join(" · ")}</span>
                                            ) : null}
                                          </div>
                                          <div className="persona-edit-document-actions">
                                            {doc.public_url ? (
                                              <a
                                                className="persona-edit-document-open"
                                                href={doc.public_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                              >
                                                Open
                                              </a>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {isPainPointsSelected ? (
                              <div className="persona-edit-pain-points-section">
                                <div className="persona-edit-pain-points-header">
                                  <h4>Key pain points</h4>
                                  {canEdit ? (
                                    <PillButton
                                      type="button"
                                      onClick={handleAddPainPoint}
                                      disabled={isSavingPainPoints}
                                      className="persona-edit-pain-points-add"
                                    >
                                      Add pain point
                                    </PillButton>
                                  ) : null}
                                </div>
                                {painPointsError ? (
                                  <span className="persona-edit-error persona-edit-error--pain-points">{painPointsError}</span>
                                ) : null}
                                {painPointValues.length === 0 ? (
                                  <div className="persona-edit-pain-points-empty">No key pain points added yet.</div>
                                ) : (
                                  <ul className="persona-edit-pain-points-list" role="list">
                                    {painPointValues.map((value, index) => (
                                      <li key={`persona-pain-point-${index}`} className="persona-edit-pain-point-row">
                                        {canEdit ? (
                                          <>
                                            <input
                                              type="text"
                                              value={value}
                                              onChange={(event) => {
                                                handlePainPointChange(index, event.target.value);
                                              }}
                                              placeholder="Enter pain point"
                                              className="persona-edit-pain-point-input"
                                              disabled={isSavingPainPoints}
                                            />
                                            <button
                                              type="button"
                                              className="persona-edit-pain-point-remove"
                                              onClick={() => {
                                                handleRemovePainPoint(index);
                                              }}
                                              aria-label={`Remove pain point ${index + 1}`}
                                              disabled={isSavingPainPoints}
                                            >
                                              ×
                                            </button>
                                          </>
                                        ) : (
                                          <span className="persona-edit-pain-point-label">{value}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {canEdit && isSavingPainPoints ? (
                                  <span className="persona-edit-status">Saving…</span>
                                ) : null}
                              </div>
                            ) : null}
                            {isIntentSignalsSelected ? (
                              <div className="persona-edit-intent-section">
                                <div className="persona-edit-intent-header">
                                  <h4>Intent signals</h4>
                                  {canEdit ? (
                                    <PillButton
                                      type="button"
                                      onClick={handleAddIntentSignal}
                                      disabled={isSavingIntentSignals}
                                      className="persona-edit-intent-add"
                                    >
                                      Add intent signal
                                    </PillButton>
                                  ) : null}
                                </div>
                                {intentSignalsError ? (
                                  <span className="persona-edit-error persona-edit-error--intent-signals">{intentSignalsError}</span>
                                ) : null}
                                {displayedIntentSignals.length === 0 ? (
                                  <div className="persona-edit-intent-empty">No intent signals captured yet.</div>
                                ) : (
                                  <ul className="persona-edit-intent-list" role="list">
                                    {displayedIntentSignals.map((signal, index) => (
                                      <li key={`persona-intent-signal-${index}`} className="persona-edit-intent-row">
                                        {canEdit ? (
                                          <>
                                            <input
                                              type="text"
                                              value={signal}
                                              onChange={(event) => {
                                                handleIntentSignalChange(index, event.target.value);
                                              }}
                                              placeholder="Enter intent signal"
                                              className="persona-edit-intent-input"
                                              disabled={isSavingIntentSignals}
                                            />
                                            <button
                                              type="button"
                                              className="persona-edit-intent-remove"
                                              onClick={() => {
                                                handleRemoveIntentSignal(index);
                                              }}
                                              aria-label={`Remove intent signal ${index + 1}`}
                                              disabled={isSavingIntentSignals}
                                            >
                                              ×
                                            </button>
                                          </>
                                        ) : (
                                          <span className="persona-edit-intent-label">{signal}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {canEdit && isSavingIntentSignals ? (
                                  <span className="persona-edit-status">Saving…</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`persona-modal-options${selectedOption ? " persona-modal-options--has-selection" : ""}`}
                    >
                      {MODAL_OPTIONS.map((option) => {
                        const isSelected = selectedOption === option.key;
                        const isDismissed = Boolean(selectedOption && selectedOption !== option.key);
                        const optionClasses = isSelected || isDismissed
                          ? [
                            "persona-modal-option",
                            isSelected ? "persona-modal-option--expanded" : "",
                            isDismissed ? "persona-modal-option--dismissed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")
                          : "persona-modal-option persona-modal-option--initial";

                        const content = (
                          <>
                            {!isSelected && (
                              <div
                                className={`persona-modal-option-header$${isSelected ? " persona-modal-option-header--expanded" : ""}`.replace("$", "")}
                              >
                                <span className="persona-modal-icon">{option.icon}</span>
                                <div className="persona-modal-option-copy">
                                  <div className="persona-modal-option-titles">
                                    <h3>{option.title}</h3>
                                    <p>{option.description}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            {isSelected && option.key === "questionnaire" && (
                              <div className="persona-modal-option-body">
                                <QuestionnaireModal
                                  expandedCardRef={expandedCardRef}
                                  quantUploadInputRef={quantUploadInputRef}
                                  quantFileURL={quantFileURL}
                                  quantFileName={quantFileName}
                                  quantFileType={quantFileType}
                                  hasQuantFile={Boolean(quantFile)}
                                  isCreatingJob={isCreatingQuestionnaireJob}
                                  isHydratingJob={isHydratingQuestionnaireJob}
                                  jobError={questionnaireJobError}
                                  jobStatus={questionnaireJobStatus}
                                  jobId={questionnaireJobId}
                                  extractionResult={questionnaireExtractionResult}
                                  onUploadClickAction={handleQuantUploadClick}
                                  onUploadChangeAction={handleQuantUploadChange}
                                  onRunAction={handleRunQuestionnaire}
                                  personaName={activePersona.agent_name}
                                  personaUpdatedAt={activePersona.updated_at ?? undefined}
                                  personaResearchType={activePersona.research_type ?? undefined}
                                  personaOwnerName={currentUserDisplayName ?? undefined}
                                />
                              </div>
                            )}
                            {isSelected && option.key === "interview" && (
                              <div className="persona-modal-option-body">
                                <div ref={expandedCardRef} className="persona-modal-option-body-content">
                                  <PrepAgent
                                    agentId={activePersona.agent_id ?? undefined}
                                    panelExpanded={true}
                                    panelRootRef={expandedCardRef}
                                    userId={currentUserId || undefined}
                                  />
                                </div>
                              </div>
                            )}
                            {isSelected && option.key === "chat" && (
                              <div className="persona-modal-option-body">
                                <div ref={expandedCardRef} className="persona-modal-option-body-content persona-modal-option-body-content--agent">
                                  <DialogueText
                                    agentId={activePersona.agent_id ?? ""}
                                    personaName={activePersona.agent_name || undefined}
                                    personaKeyTraits={Array.isArray(activePersona.key_traits) ? activePersona.key_traits : undefined}
                                    personaIntentSignals={Array.isArray(activePersona.intent_signals) ? activePersona.intent_signals : undefined}
                                    personaCustomerStatus={
                                      typeof activePersona.customer_status === "string"
                                        ? activePersona.customer_status
                                        : undefined
                                    }
                                    personaKeyPainPoints={Array.isArray(activePersona.key_pain_points) ? activePersona.key_pain_points : undefined}
                                    userId={currentUserId || undefined}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        );

                        if (isSelected) {
                          return (
                            <div key={option.key} className={optionClasses}>
                              {content}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={optionClasses}
                            onClick={() => setSelectedOption(option.key)}
                          >
                            {content}
                          </button>
                        );
                      })}
                    </div>
                  </>)}
              </div>
            </div>
          </>)}
        </FullscreenModal>

        <style>{`
          @font-face {
            font-family: 'CooperBT';
            src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          .stage-layout {
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
            padding: 0;
            font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
            display: flex;
            flex-direction: row;
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
            padding: 64px 24px 96px;
            min-height: 100dvh;
            overflow-y: auto;
          }
          .stage-layout__content[data-modal-open="true"] {
            padding: 0;
          }
          .stage-shell {
            width: min(1120px, 96%);
            display: flex;
            flex-direction: column;
            gap: 32px;
            color: var(--text);
          }
          .persona-unsaved-save {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            border: 1px solid rgba(148, 195, 255, 0.45);
            background: #ffffff;
            color: #052033;
            padding: 8px 18px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.4px;
            font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
            text-transform: none;
          }
          .persona-unsaved-save:hover,
          .persona-unsaved-save:focus-visible {
            background: #f8fafc;
            border-color: rgba(129, 178, 245, 0.75);
            color: #03152a;
            box-shadow: 0 6px 18px rgba(10, 22, 40, 0.28);
            outline: none;
          }
          .persona-unsaved-save:active {
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.24);
          }
          .persona-unsaved-save:disabled {
            opacity: 0.6;
            cursor: default;
            box-shadow: none;
          }
          .stage-panel__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            width: 100%;
            flex-wrap: nowrap;
          }
          .stage-panel__leading,
          .stage-panel__trailing {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }
          .stage-panel__leading {
            justify-content: flex-start;
          }
          .stage-panel__trailing {
            justify-content: flex-end;
            margin-left: auto;
          }
          .stage-panel__spacer {
            flex: 0 0 auto;
            width: 0;
            height: 0;
            visibility: hidden;
          }
          @media (max-width: 640px) {
            .stage-panel__header {
              flex-wrap: wrap;
              gap: 12px;
            }
            .stage-panel__trailing {
              margin-left: 0;
              width: 100%;
              justify-content: flex-start;
            }
          }
          .stage-panel__titles {
            flex: 1 1 auto;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }
          .stage-panel__titles h2 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #1e293b;
          }
          .stage-panel__titles p {
            margin: 0;
            font-size: 14px;
            color: rgba(30, 41, 59, 0.68);
          }
          .stage-panel__body {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .stage-panel__footer {
            margin-top: 12px;
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
            font-family: inherit;
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
          .stage-button__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            background: var(--accent, #2b6cb0);
            color: #f6f7f9;
            font-weight: 800;
            font-size: 16px;
          }
          .personas-new-button {
            padding: 10px 18px;
          }
          .personas-new-button .stage-button__icon {
            margin-right: 6px;
          }
          .personas-grid {
            display: grid;
            gap: 20px;
            padding-top: 12px;
            align-items: stretch;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            grid-auto-flow: row;
          }
          .persona-root[data-expanded="true"] .personas-section {
            overflow: visible;
            max-height: none;
            padding-right: 0;
            margin-right: 0;
          }
          .persona-card-button {
            background: none;
            border: none;
            padding: 0;
            text-align: left;
            color: inherit;
            display: flex;
            flex-direction: column;
            width: 100%;
          }
          .persona-card-button[aria-expanded="true"] {
            grid-column: 1 / -1;
          }
          .persona-card-button:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.85);
            outline-offset: 6px;
            border-radius: 20px;
          }
          @media (max-width: 1280px) {
            .personas-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }
          @media (max-width: 960px) {
            .personas-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 680px) {
            .personas-grid {
              grid-template-columns: 1fr;
            }
          }
          .persona-card {
            position: relative;
            border-radius: 16px;
            border: 1px solid rgba(43, 108, 176, 0.18);
            background-color: rgba(255, 255, 255, 0.96);
            background-image: none;
            box-shadow: 0 18px 36px rgba(10, 22, 40, 0.12);
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 0;
            min-height: 200px;
            width: 100%;
            transition: transform 0.32s ease, box-shadow 0.32s ease, border-color 0.32s ease, background-color 0.32s ease;
            cursor: pointer;
          }
          .persona-card-button[aria-expanded="true"] .persona-card {
            background-color: rgba(255, 255, 255, 0.99);
          }
          .persona-card__expanded {
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transform: translateY(-6px);
            transition: max-height 0.44s ease, opacity 0.36s ease, transform 0.36s ease;
          }
          .persona-card__expanded[data-visible="true"] {
            max-height: 800px;
            opacity: 1;
            transform: translateY(0);
          }
          .persona-card__expanded-inner {
            padding-top: 6px;
            color: rgba(30, 41, 59, 0.72);
            font-size: 14px;
            line-height: 1.5;
            text-align: left;
          }
          .persona-traits {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
            margin-top: 6px;
          }
          .persona-traits--collapsed {
            justify-content: flex-start;
            align-items: flex-start;
            margin-top: 8px;
            margin-bottom: 0;
            gap: 8px;
          }
          .persona-traits--collapsed .persona-traits__chips {
            gap: 8px;
          }
          .persona-traits--collapsed .persona-trait-chip {
            padding: 2px 7px;
            font-size: 10px;
            line-height: 1.2;
            gap: 3px;
          }
          .persona-traits--collapsed .persona-trait-chip strong {
            font-size: 8px;
            letter-spacing: 0.3px;
          }
          .persona-traits__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .persona-trait-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(43, 108, 176, 0.12);
            color: #1e293b;
            font-size: 12px;
            font-weight: 600;
          }
          .persona-trait-chip strong {
            font-weight: 700;
            color: #1c3d68;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 10px;
          }
          .persona-trait-chip span {
            font-weight: 600;
          }
          .persona-expanded-placeholder {
            color: rgba(30, 41, 59, 0.5);
            font-style: italic;
          }
          .persona-expanded-scroll {
            margin-top: 20px;
            max-height: clamp(220px, 48vh, 360px);
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 4px;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
            overscroll-behavior: contain;
          }
          .persona-expanded-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(148, 163, 184, 0.55);
            border-radius: 999px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .persona-expanded-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }
          @media (max-width: 960px) {
            .persona-expanded-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 680px) {
            .persona-expanded-grid {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          .persona-expanded-block {
            padding: 16px 18px;
            color: rgba(30, 41, 59, 0.85);
            min-height: 140px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .persona-expanded-block h4 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 0.4px;
          }
          .persona-expanded-block ul {
            margin: 0;
            padding-left: 0;
            list-style-position: inside;
            font-size: 13px;
            line-height: 1.5;
            color: rgba(30, 41, 59, 0.75);
          }
          .persona-expanded-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .persona-expanded-list-item {
            width: 100%;
            background: rgba(30, 41, 59, 0.06);
            border-radius: 10px;
            padding: 10px 12px;
          }
          .persona-expanded-list-item--document {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .persona-doc-title {
            font-weight: 700;
            font-size: 13px;
            color: #1e293b;
          }
          .persona-doc-meta {
            font-size: 12px;
            color: rgba(30, 41, 59, 0.65);
          }
          .persona-expanded-add {
            align-self: flex-start;
            padding: 6px 16px;
            border-radius: 999px;
            border: 1px solid rgba(30, 64, 175, 0.26);
            background: rgba(59, 130, 246, 0.12);
            color: #1d4ed8;
            font-weight: 700;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease;
            margin-top: 12px;
          }
          .persona-expanded-add:hover {
            background: rgba(59, 130, 246, 0.18);
            transform: translateY(-1px);
          }
          .persona-expanded-add:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.5);
            outline-offset: 2px;
          }
          .persona-description {
            margin-bottom: 14px;
            color: rgba(30, 41, 59, 0.82);
            font-size: 14px;
            line-height: 1.6;
          }
          .persona-description p {
            margin: 0;
          }
          .persona-description--empty {
            color: rgba(71, 85, 105, 0.75);
            font-style: italic;
          }
          .persona-card-button:hover .persona-card,
          .persona-card-button:focus-visible .persona-card {
            transform: translateY(-6px);
            box-shadow: 0 24px 60px rgba(10, 22, 40, 0.16);
            border-color: rgba(43, 108, 176, 0.42);
            background-color: rgba(255, 255, 255, 0.99);
          }
          .persona-card__body {
            display: flex;
            flex-direction: column;
            gap: 8px;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 14px;
            flex: 1 1 auto;
          }
          .persona-card__footer {
            margin-top: auto;
            width: 100%;
          }
          .persona-card__title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: space-between;
          }
          .persona-card__title-block {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .persona-card__title {
            margin: 0;
            font-weight: 700;
            font-size: 18px;
            color: var(--text);
          }
          .persona-card__traits-inline {
            margin: 0;
            font-size: 13px;
            color: rgba(30, 41, 59, 0.7);
          }
          .persona-title-actions {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }
          .persona-title-actions__group {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .persona-title-cta {
            border: none;
            background: #0f172a;
            color: #f8fafc;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            padding: 8px 16px;
            border-radius: 999px;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 10px;
          }
          .persona-title-cta:hover {
            background: #1e293b;
            color: #f8fafc;
            transform: translateY(-1px);
          }
          .persona-title-cta:focus-visible {
            outline: 2px solid rgba(29, 78, 216, 0.65);
            outline-offset: 2px;
          }
          .persona-title-cta--ghost {
            background: transparent;
            color: #1e3a8a;
            border: 1px solid rgba(30, 64, 175, 0.28);
            padding: 8px 16px;
          }
          .persona-title-cta--ghost:hover {
            background: rgba(30, 64, 175, 0.08);
            color: #1d4ed8;
          }
          .persona-title-cta__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            flex-shrink: 0;
          }
          .persona-title-cta__icon svg {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
          }
          .persona-title-updated {
            display: inline-flex;
            align-items: baseline;
            gap: 6px;
            font-size: 13px;
            color: var(--muted);
          }
          .persona-title-updated--inline {
            background: rgba(43, 108, 176, 0.08);
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 12px;
            color: rgba(30, 41, 59, 0.65);
            gap: 6px;
            display: inline-flex;
            align-items: center;
          }
          .persona-card__type {
            margin: 0;
            color: var(--muted);
          }
          .persona-card__footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 16px;
          }
          .persona-card-button[aria-expanded="false"] .persona-card__footer {
            margin-top: auto;
          }
          .persona-updated {
            font-size: 13px;
            color: var(--muted);
            display: inline-flex;
            align-items: baseline;
            gap: 4px;
          }
          .persona-updated__label {
            color: var(--accent-2);
            font-weight: 600;
          }
          .persona-status {
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.9px;
            background: rgba(var(--accent-rgb, 43,108,176), 0.12);
            color: var(--accent-2);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
          }
          .persona-modal-container {
            display: flex;
            flex-direction: column;
            padding: 28px 56px 32px;
            gap: 28px;
            color: var(--text);
            height: 100%;
            box-sizing: border-box;
            flex: 1;
            overflow-y: auto;
            position: relative;
          }
          .persona-modal-container--expanded {
            overflow: visible;
            gap: 32px;
          }
          @media (max-width: 900px) {
            .persona-modal-container {
              padding: 36px 24px 32px;
              gap: 28px;
            }
            .persona-modal-title-left {
              justify-content: center;
            }
            .persona-modal-title-chips {
              justify-content: center;
            }
            .persona-quant-actions {
              justify-content: center;
            }
            .persona-modal-secondary-row {
              grid-template-columns: 1fr;
            }
            .persona-edit-layout {
              grid-template-columns: 1fr;
            }
          }
          .persona-modal-title-wrapper {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 0 1 auto;
            min-width: 0;
            align-items: flex-start;
          }
          .persona-modal-title-display {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.4px;
            color: inherit;
            min-width: 140px;
            max-width: 100%;
            line-height: 1.2;
            background: transparent;
            border-radius: 8px;
            box-sizing: border-box;
            word-break: break-word;
          }
          .persona-modal-title-status {
            font-size: 12px;
            color: var(--muted);
            font-weight: 600;
          }
          .persona-modal-title-error {
            font-size: 12px;
            color: rgba(248, 163, 163, 0.95);
            font-weight: 600;
          }
          .persona-modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 0;
            flex-wrap: wrap;
          }
          .persona-modal-header--with-mini {
            justify-content: space-between;
          }
          .persona-modal-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 16px;
            flex-wrap: wrap;
          }
          .persona-modal-title-left {
            display: flex;
            align-items: center;
            gap: 16px;
            flex: 2 1 600px;
            min-width: min(100%, 600px);
          }
          .persona-modal-title-chips {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
            flex: 0 0 auto;
          }
          .persona-modal-close {
            white-space: nowrap;
            background: transparent !important;
            color: #052033 !important;
          }
          .persona-modal-heading {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
            flex: 1 1 320px;
          }
          .persona-modal-option-body--edit {
            padding: 20px 0 12px;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
          }
          .persona-edit-scroll {
            flex: 1;
            height: 100%;
            min-height: 0;
            overflow-y: auto;
            padding-right: 18px;
            margin-right: -18px;
            overscroll-behavior: contain;
          }
          .persona-edit-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .persona-edit-scroll::-webkit-scrollbar-thumb {
            background: rgba(43, 108, 176, 0.2);
            border-radius: 999px;
          }
          .persona-edit-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .persona-edit-layout {
            display: flex;
            width: 100%;
            gap: 24px;
            align-items: flex-start;
            flex-wrap: nowrap;
          }
          .persona-edit-column {
            flex: 1 1 0%;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-edit-aside {
            flex: 0 0 33%;
            max-width: 33%;
            min-width: 260px;
            display: flex;
            justify-content: flex-end;
          }
          .persona-edit-aside-grid {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-edit-aside-inner {
            width: 100%;
            max-width: none;
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(43, 108, 176, 0.28);
            border-radius: 18px;
            padding: 18px;
            box-shadow: 0 12px 28px rgba(10, 22, 40, 0.35);
            display: flex;
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }
          .persona-edit-aside-heading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          .persona-edit-aside-inner strong {
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(203, 213, 245, 0.75);
          }
          .persona-edit-aside-inner--secondary {
            background: rgba(14, 23, 48, 0.7);
          }
          .persona-edit-aside-button {
            border-radius: 999px;
            border: none; /* removed border entirely */
            background: transparent;
            color: var(--text);
            padding: 6px 14px;
            font-size: 12px;
            letter-spacing: 0.4px;
            cursor: pointer;
            transition: background 0.18s ease, box-shadow 0.18s ease;
          }
          .persona-edit-aside-button:hover,
          .persona-edit-aside-button:focus-visible {
            background: transparent; /* keep hover transparent */
            border: none;
            /* Keep an accessible focus ring for keyboard users */
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          @media (max-width: 1100px) {
            .persona-edit-layout {
              flex-direction: column;
            }
            .persona-edit-aside {
              flex: 0 0 auto;
              max-width: none;
              width: 100%;
              justify-content: center;
            }
            .persona-edit-aside-inner {
              max-width: 420px;
            }
            .persona-edit-name-wrapper {
              max-width: 100%;
            }
          }
          @media (max-width: 720px) {
            .persona-edit-scroll {
              padding-right: 12px;
              margin-right: -12px;
            }
          }
          .persona-edit-documents {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          @media (max-width: 1180px) {
            .persona-edit-documents {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 720px) {
            .persona-edit-documents {
              grid-template-columns: minmax(0, 1fr);
            }
          }
          .persona-edit-documents--empty {
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px dashed rgba(43, 108, 176, 0.35);
            border-radius: 14px;
            padding: 18px;
            color: rgba(203, 213, 245, 0.68);
            font-size: 12px;
            letter-spacing: 0.3px;
          }
          .persona-edit-documents-placeholder {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .persona-edit-document-card {
            position: relative;
            border-radius: 18px;
            border: 1px solid rgba(43, 108, 176, 0.28);
            background: rgba(14, 22, 40, 0.85);
            padding: 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            text-align: center;
            box-shadow: 0 12px 25px rgba(8, 15, 30, 0.35);
          }
          .persona-edit-document-meta {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: rgba(226, 232, 240, 0.85);
          }
          .persona-edit-document-title {
            font-size: 13px;
            color: #0b1f44;
            letter-spacing: 0.2px;
            word-break: break-word;
          }
          .persona-edit-document-details {
            line-height: 1.4;
          }
          .persona-edit-document-actions {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .persona-edit-document-open {
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.45);
            background: rgba(24, 38, 66, 0.85);
            color: var(--accent-2);
            padding: 6px 16px;
            font-size: 12px;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-live-sources {
            margin-top: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .persona-live-source-card {
            border-radius: 16px;
            border: 1px solid rgba(43, 108, 176, 0.25);
            background: rgba(18, 27, 46, 0.85);
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            align-items: center;
          }
          .persona-live-source-name {
            font-size: 13px;
            color: #e6eaff;
            letter-spacing: 0.4px;
            text-transform: uppercase;
          }
          .persona-live-source-meta {
            font-size: 11px;
            color: rgba(203, 213, 245, 0.75);
          }
          .persona-live-source-manage {
            margin-top: 4px;
            border-radius: 10px;
            border: 1px solid rgba(43, 108, 176, 0.4);
            background: rgba(24, 38, 66, 0.8);
            color: var(--accent-2);
            padding: 4px 12px;
            font-size: 11px;
            letter-spacing: 0.3px;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-live-source-manage:hover,
          .persona-live-source-manage:focus-visible {
            background: rgba(32, 48, 76, 0.95);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          .persona-edit-document-open:hover,
          .persona-edit-document-open:focus-visible {
            background: rgba(32, 48, 76, 0.95);
            border-color: rgba(140, 170, 240, 0.7);
            outline: none;
          }
          .persona-edit-document-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            color: rgba(210, 222, 255, 0.85);
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-edit-document-close:hover,
          .persona-edit-document-close:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          /* Empty two-column grid placeholder shown at top of expanded Edit card */
          .persona-edit-meta-chips {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
            padding: 4px;
            width: 100%;
          }
          .persona-edit-meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px solid rgba(43, 108, 176, 0.28);
            background: rgba(14, 22, 40, 0.75);
            color: rgba(226, 232, 240, 0.88);
            font-size: 11px;
            letter-spacing: 0.5px;
            font-weight: 700;
            text-transform: uppercase;
            cursor: pointer;
            font-family: inherit;
            appearance: none;
            transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
          }
          .persona-edit-meta-chip:hover {
            background: rgba(20, 32, 58, 0.82);
          }
          .persona-edit-meta-chip:focus-visible {
            outline: 2px solid rgba(129, 178, 245, 0.75);
            outline-offset: 3px;
          }
          .persona-edit-meta-chip[data-selected="true"] {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(129, 178, 245, 0.6);
            color: var(--accent, #2b6cb0);
            box-shadow: 0 8px 20px rgba(10, 22, 40, 0.28);
            transform: translateY(-1px);
          }
          .persona-edit-meta-chip[data-selected="true"]:hover {
            background: rgba(59, 130, 246, 0.26);
            color: var(--accent, #2b6cb0);
          }
          .persona-edit-top-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 16px;
            width: 100%;
            margin-bottom: 12px;
            min-height: 40px; /* reserve visible space for future content */
            align-items: start;
            align-content: start;
          }
          .persona-edit-top-left {
            grid-column: 1 / -1;
            width: 100%;
          }
          .persona-edit-name-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            max-width: none;
            min-width: 0;
            position: relative;
            padding: 10px 14px;
            border-radius: 14px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
          }
          .persona-edit-name-wrapper:focus-within {
            border-color: rgba(129, 178, 245, 0.65);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.22);
          }
          .persona-edit-name-measure {
            position: absolute;
            visibility: hidden;
            white-space: pre;
            pointer-events: none;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.3px;
            font-family: inherit;
          }
          .persona-edit-name-input {
            width: 100%;
            flex: 1 1 auto;
            min-width: 0;
            border-radius: 14px;
            border: none;
            background: transparent;
            color: #e6eaff;
            padding: 0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.3px;
          }
          .persona-edit-name-icon {
            font-size: 14px;
            color: rgba(148, 195, 255, 0.75);
            flex-shrink: 0;
          }
          .persona-edit-name-input::placeholder {
            color: rgba(203, 213, 245, 0.5);
          }
          .persona-edit-name-input:focus-visible {
            outline: none;
          }
          .persona-edit-key-traits {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 16px;
            width: 100%;
          }
          .persona-edit-key-traits label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: rgba(226, 232, 240, 0.75);
          }
          .persona-edit-key-traits textarea {
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            color: #052033;
            padding: 10px 14px;
            font-size: 13px;
            line-height: 1.5;
            resize: vertical;
            min-height: 56px;
          }
          .persona-edit-key-traits textarea::placeholder {
            color: rgba(203, 213, 245, 0.55);
          }
          .persona-edit-key-traits textarea:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          .persona-edit-static-traits {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 16px;
          }
          .persona-edit-static-traits__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .persona-edit-static-trait {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
          }
          .persona-trait-chip--editable {
            cursor: text;
            background: transparent;
            border: 1px solid rgba(129, 178, 245, 0.45);
            color: #052033;
            box-shadow: inset 0 1px 0 rgba(10, 22, 40, 0.18);
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
          }
          .persona-trait-chip--editable:focus-within {
            border-color: rgba(129, 178, 245, 0.75);
            box-shadow: inset 0 1px 0 rgba(10, 22, 40, 0.18), 0 0 0 2px rgba(59, 130, 246, 0.22);
          }
          .persona-trait-chip--editable strong,
          .persona-trait-chip--editable span {
            color: inherit;
          }
          .persona-trait-chip--editable input {
            border: none;
            background: transparent;
            color: inherit;
            font: inherit;
            padding: 0;
            margin: 0;
            min-width: 56px;
            max-width: 220px;
          }
          .persona-trait-chip--editable input:focus-visible {
            outline: none;
          }
          .persona-trait-chip--editable input::placeholder {
            color: rgba(5, 32, 51, 0.5);
            font-weight: 500;
          }
          .persona-edit-status--chip,
          .persona-edit-error--chip {
            font-size: 10px;
            padding-left: 6px;
          }
          .persona-edit-status {
            font-size: 12px;
            color: rgba(43, 108, 176, 0.8);
          }
          .persona-edit-error {
            font-size: 12px;
            color: #fca5a5;
          }
          .persona-edit-error--inline {
            margin-top: 6px;
            display: inline-block;
          }
          .persona-edit-description {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }
          .persona-edit-description textarea {
            width: 100%;
            min-height: 40px;
            border-radius: 14px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: rgba(15, 23, 42, 0.7);
            color: #e6eaff;
            padding: 18px;
            font-size: 14px;
            line-height: 1.6;
            resize: vertical;
          }
          .persona-edit-description textarea:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          .persona-edit-documents-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
            min-height: 0;
          }
          .persona-edit-pain-points-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
          }
          .persona-edit-pain-points-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .persona-edit-pain-points-header h4 {
            margin: 0;
            font-size: 14px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(203, 213, 245, 0.85);
          }
          .persona-edit-pain-points-empty {
            border: 1px dashed rgba(43, 108, 176, 0.35);
            border-radius: 14px;
            padding: 18px;
            color: rgba(203, 213, 245, 0.68);
            font-size: 12px;
            letter-spacing: 0.3px;
            text-align: center;
          }
          .persona-edit-pain-points-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .persona-edit-pain-point-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }
          .persona-edit-pain-point-input {
            flex: 1;
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: rgba(15, 23, 42, 0.7);
            color: #e6eaff;
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.6;
          }
          .persona-edit-pain-point-input::placeholder {
            color: rgba(203, 213, 245, 0.55);
          }
          .persona-edit-pain-point-input:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.6);
            outline-offset: 3px;
          }
          .persona-edit-pain-point-remove {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            color: rgba(226, 232, 240, 0.85);
            font-size: 16px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-edit-pain-point-remove:hover,
          .persona-edit-pain-point-remove:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(43, 108, 176, 0.6);
            outline: none;
          }
          .persona-edit-pain-point-label {
            flex: 1;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.18);
            background: rgba(15, 23, 42, 0.7);
            color: rgba(226, 232, 240, 0.85);
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.6;
          }
          .persona-edit-intent-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 20px;
          }
          .persona-edit-intent-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .persona-edit-intent-header h4 {
            margin: 0;
            font-size: 14px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(203, 213, 245, 0.85);
          }
          .persona-edit-intent-empty {
            border: 1px dashed rgba(59, 130, 246, 0.35);
            border-radius: 14px;
            padding: 18px;
            color: rgba(203, 213, 245, 0.68);
            font-size: 12px;
            letter-spacing: 0.3px;
            text-align: center;
          }
          .persona-edit-intent-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .persona-edit-intent-row {
            display: flex;
            align-items: flex-start;
            gap: 10px;
          }
          .persona-edit-intent-label {
            flex: 1;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.18);
            background: rgba(15, 23, 42, 0.7);
            color: rgba(226, 232, 240, 0.85);
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.6;
          }
          .persona-edit-intent-input {
            flex: 1;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.35);
            background: rgba(15, 23, 42, 0.7);
            color: #e6eaff;
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.6;
          }
          .persona-edit-intent-input::placeholder {
            color: rgba(203, 213, 245, 0.55);
          }
          .persona-edit-intent-input:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.6);
            outline-offset: 3px;
          }
          .persona-edit-intent-remove {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 1px solid rgba(59, 130, 246, 0.35);
            background: transparent;
            color: rgba(226, 232, 240, 0.85);
            font-size: 16px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-edit-intent-remove:hover,
          .persona-edit-intent-remove:focus-visible {
            background: rgba(31, 46, 74, 0.85);
            border-color: rgba(59, 130, 246, 0.6);
            outline: none;
          }
          .persona-edit-intent-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
          }
          .persona-edit-pain-points-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
          }
          .persona-edit-error--pain-points {
            font-size: 12px;
          }
          .persona-edit-error--intent-signals {
            font-size: 12px;
          }
          .persona-unsaved-banner {
            position: fixed;
            left: 50%;
            bottom: -120px;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 16px 22px;
            border-radius: 16px;
            border: 1px solid rgba(59, 130, 246, 0.3);
            background: rgba(15, 23, 42, 0.92);
            box-shadow: 0 16px 40px rgba(10, 22, 40, 0.35);
            color: rgba(226, 232, 240, 0.9);
            z-index: 1200;
            -webkit-backdrop-filter: blur(4px);
            backdrop-filter: blur(4px);
            width: min(520px, calc(100vw - 40px));
            opacity: 0;
            pointer-events: none;
            transition: transform 0.3s ease, opacity 0.3s ease, bottom 0.3s ease;
          }
          .persona-unsaved-banner--visible {
            bottom: 32px;
            opacity: 1;
            pointer-events: auto;
          }
          .persona-unsaved-message {
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: none;
          }
          .persona-unsaved-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .persona-unsaved-clear {
            border-radius: 12px;
            border: 1px solid rgba(148, 195, 255, 0.45);
            background: transparent;
            color: rgba(226, 232, 240, 0.85);
            padding: 8px 18px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.4px;
            font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
            text-transform: none;
          }
          .persona-unsaved-clear:hover,
          .persona-unsaved-clear:focus-visible {
            background: rgba(59, 130, 246, 0.18);
            border-color: rgba(129, 178, 245, 0.65);
            color: rgba(241, 245, 249, 0.95);
            outline: none;
          }
          .persona-unsaved-clear:disabled {
            opacity: 0.5;
            cursor: default;
          }
 
          .persona-edit-documents-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .persona-edit-documents-header h4 {
            margin: 0;
            font-size: 14px;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: rgba(203, 213, 245, 0.85);
          }
          .persona-edit-documents-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .persona-edit-documents-upload {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.4px;
            min-height: 32px;
          }
          .persona-edit-error--documents {
            font-size: 12px;
            margin-top: -4px;
          }
          .persona-results-table-wrapper {
            max-height: 220px;
            overflow-y: auto;
            margin-top: 4px;
            width: 100%;
          }
          .persona-results-table-wrapper::-webkit-scrollbar {
            width: 6px;
          }
          .persona-results-table-wrapper::-webkit-scrollbar-thumb {
            background: rgba(43, 108, 176, 0.12);
            border-radius: 999px;
          }
          .persona-results-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .persona-results-table th,
          .persona-results-table td {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(43, 108, 176, 0.12);
          }
          .persona-results-table th:nth-child(1),
          .persona-results-table td:nth-child(1) {
            width: 28%;
          }
          .persona-results-table th:nth-child(2),
          .persona-results-table td:nth-child(2) {
            width: 22%;
          }
          .persona-results-table th:nth-child(3),
          .persona-results-table td:nth-child(3) {
            width: 18%;
          }
          .persona-results-table th:nth-child(4),
          .persona-results-table td:nth-child(4) {
            width: 16%;
          }
          .persona-results-table th:nth-child(5),
          .persona-results-table td:nth-child(5) {
            text-align: right;
            width: 16%;
          }
          .persona-results-table th {
            text-transform: uppercase;
            letter-spacing: 0.6px;
            font-size: 11px;
            color: #052033;
          }
          .persona-results-table tbody tr:hover {
            background: rgba(15, 23, 42, 0.55);
          }
          .persona-results-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 6px 16px;
            border-radius: 999px;
            font-weight: 600;
            font-size: 12px;
            background: rgba(43, 108, 176, 0.08);
            color: #052033;
            border: 1px solid rgba(43, 108, 176, 0.28);
            cursor: pointer;
          }
          .persona-results-chip:hover {
            background: rgba(43, 108, 176, 0.12);
          }
          .persona-results-chip--ghost {
            padding: 6px 14px;
            background: rgba(43, 108, 176, 0.06);
          }
          .persona-results-chip--ghost:hover {
            background: rgba(43, 108, 176, 0.08);
          }
          .persona-results-download {
            background: rgba(43, 108, 176, 0.06);
            color: #e6eaff;
            border: 1px solid rgba(43, 108, 176, 0.28);
            border-radius: 12px;
            padding: 6px 10px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .persona-results-download:hover {
            background: rgba(43, 108, 176, 0.12);
          }
          .persona-secondary-card-content--narrow {
            align-items: center;
            text-align: center;
          }
          .persona-secondary-card-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: rgba(43, 108, 176, 0.08);
            color: var(--accent-2);
            font-size: 18px;
            box-shadow: 0 8px 20px rgba(10, 22, 40, 0.28);
          }
          .persona-secondary-card h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: #e6eaff;
          }
          .persona-secondary-card.persona-secondary-card--wide h3 {
            color: #052033;
          }
          .persona-secondary-card.persona-secondary-card--narrow h3 {
            color: #052033;
          }
          .persona-secondary-card p {
            margin: 0;
            color: #052033;
            font-size: 14px;
            line-height: 1.6;
          }
          .persona-modal-option-body--quant {
            display: flex;
            flex-direction: column;
            gap: 28px;
            width: 100%;
          }
          .persona-quant-actions {
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
            align-items: center;
          }
          .persona-quant-grid {
            display: grid;
            grid-template-columns: minmax(320px, 460px) minmax(0, 1fr);
            gap: 24px;
            width: 100%;
            align-items: stretch;
          }
          .persona-quant-preview {
            width: 100%;
            min-height: 360px;
            /* Allow taller previews on desktop but cap to avoid taking entire viewport */
            max-height: 720px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(43, 108, 176, 0.12);
            background: rgba(15, 23, 42, 0.9);
            display: flex;
            /* stretch children so embedded iframe can fill the container */
            align-items: stretch;
            justify-content: center;
          }
          .persona-quant-preview iframe {
            width: 100%;
            height: 100%;
            display: block;
            border: none;
          }
          .persona-quant-actions-col {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 14px;
            height: 100%;
            min-height: 0;
          }
          .persona-quant-status {
            font-size: 13px;
            margin: 4px 0 0;
            text-align: center;
          }
          .persona-quant-status--error {
            color: #fca5a5;
          }
          .persona-quant-status--success {
            color: #bbf7d0;
          }
          .persona-quant-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            margin-top: 12px;
            padding: 14px;
            border-radius: 10px;
            border: 1px solid rgba(59, 130, 246, 0.25);
            background: rgba(30, 41, 59, 0.6);
            color: #bfdbfe;
            font-weight: 600;
            font-size: 14px;
          }
          .persona-quant-spinner {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid rgba(148, 197, 255, 0.65);
            border-top-color: transparent;
            animation: persona-quant-spin 0.8s linear infinite;
          }
          @keyframes persona-quant-spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          .persona-quant-results {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            background: rgba(15, 23, 42, 0.75);
            border: 1px solid rgba(59, 130, 246, 0.18);
            border-radius: 12px;
            padding: 18px;
            color: #e2e8f0;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
          }
          .persona-quant-results-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
          }
          .persona-quant-results-header h4 {
            font-size: 16px;
            font-weight: 700;
            margin: 0;
          }
          .persona-quant-results-count {
            font-size: 13px;
            color: rgba(148, 163, 184, 0.9);
            font-weight: 600;
            white-space: nowrap;
          }
          .persona-quant-results-scroll {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding-right: 4px;
          }
          .persona-quant-results-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
            align-content: start;
          }
          .persona-quant-results-item {
            border: 1px solid rgba(59, 130, 246, 0.18);
            border-radius: 10px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: rgba(30, 41, 59, 0.65);
            height: 100%;
          }
          .persona-quant-results-question {
            font-weight: 700;
            font-size: 14px;
            color: #bfdbfe;
          }
          .persona-quant-results-answer {
            display: flex;
            gap: 6px;
            font-size: 13px;
            line-height: 1.4;
            word-break: break-word;
          }
          .persona-quant-results-label {
            color: #94a3b8;
            font-weight: 600;
            flex-shrink: 0;
          }
          .persona-quant-results-raw {
            margin: 0;
            font-family: var(--font-mono, monospace);
            font-size: 12px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(59, 130, 246, 0.2);
            border-radius: 10px;
            padding: 12px;
            white-space: pre-wrap;
            word-break: break-word;
            color: #f8fafc;
          }
          .persona-quant-results-placeholder {
            font-size: 13px;
            padding: 14px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.5);
            border: 1px dashed rgba(59, 130, 246, 0.3);
            color: #cbd5f5;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 140px;
          }
          .persona-quant-options-bar {
            display: flex;
            gap: 12px;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: wrap;
            margin-top: 12px;
            width: 100%;
            align-self: stretch;
          }
          .persona-quant-option-button {
            appearance: none;
            border: 1px solid rgba(59, 130, 246, 0.35);
            background: rgba(15, 23, 42, 0.78);
            color: #e2e8f0;
            border-radius: 999px;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
          }
          .persona-quant-option-button:hover,
          .persona-quant-option-button:focus-visible {
            background: rgba(59, 130, 246, 0.22);
            border-color: rgba(59, 130, 246, 0.6);
          }
          .persona-quant-option-button:active {
            transform: translateY(1px);
          }
          .persona-quant-option-button:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.7);
            outline-offset: 2px;
          }
          @media (max-width: 1500px) {
            .persona-quant-results-list {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          @media (max-width: 900px) {
            .persona-quant-results-list {
              grid-template-columns: 1fr;
            }
          }
          .persona-quant-file-card {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            justify-content: center;
            padding: 18px;
            border-radius: 12px;
            border: 1px solid rgba(43, 108, 176, 0.12);
            background: rgba(20, 28, 48, 0.8);
            color: #e6eaff;
            width: calc(100% - 40px);
            max-width: 560px;
          }
          .persona-quant-file-name {
            font-size: 14px;
            color: var(--muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 100%;
          }
          .persona-quant-download {
            display: inline-flex;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(43, 108, 176, 0.06);
            color: #e6eaff;
            text-decoration: none;
            font-weight: 600;
          }
          .persona-quant-action-square {
            width: 100%;
            height: 56px; /* taller rectangular touch target */
            min-height: 56px;
            border-radius: 8px; /* small corner radius, not pill */
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(20, 28, 48, 0.85);
            color: #e6eaff;
            border: 1px solid rgba(43, 108, 176, 0.28);
            cursor: pointer;
            padding: 0 12px; /* horizontal padding while vertical height comes from height */
          }
          .persona-quant-action-square:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.65);
            outline-offset: 3px;
          }
          .persona-quant-file {
            color: var(--muted);
            font-size: 13px;
            max-width: 520px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            align-self: center;
          }

          /* Make the quant preview stack on narrow screens for better responsiveness */
          @media (max-width: 1100px) {
            .persona-quant-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }
            .persona-quant-preview {
              flex: none;
              width: 100%;
              max-width: none;
              min-width: 0;
              min-height: 220px;
              /* On smaller screens limit height relative to viewport so it doesn't overflow */
              max-height: 60vh;
            }
            .persona-quant-actions-col {
              width: 100%;
              justify-content: flex-start; /* stacked: keep actions at top */
            }
            .persona-quant-results-list {
              grid-template-columns: 1fr;
            }
          }

          /* Make the quant content fill available vertical space so preview can stretch
             (previously centered which limited the grid/preview height). */
          .persona-modal-option-body-content.persona-modal-option-body-content--quant {
            display: flex;
            align-items: stretch; /* allow children to grow vertically */
            justify-content: center;
            width: 100%;
            height: 100%;
            min-height: 0;
          }
          .persona-quant-grid {
            /* let the grid expand to the available vertical space inside the content */
            height: 100%;
            min-height: 0;
          }
          .persona-quant-preview {
            /* allow the preview to take full height of the grid */
            height: 100%;
            min-height: 0;
          }
          .persona-modal-subheading-wrapper {
            margin-top: 12px;
            display: flex;
            justify-content: center;
          }
          .persona-modal-header--with-selection .persona-modal-subheading-wrapper {
            justify-content: flex-start;
          }
          .persona-modal-subheading {
            font-size: 15px;
            color: rgba(15, 23, 42, 0.78);
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
          }
          .persona-modal-subheading--card {
            font-size: 16px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.88);
            margin: 0;
          }
          .persona-modal-subheading-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            flex-shrink: 0;
          }
          .persona-modal-subheading-icon svg {
            width: 100%;
            height: 100%;
          }
            .persona-quant-actions {
              justify-content: center;
            }
            .persona-modal-secondary-row {
              grid-template-columns: 1fr;
            }
          }
          .persona-modal-body {
            display: flex;
            flex-direction: column;
            gap: 16px;
            width: 100%;
            flex: 1 1 0%;
            min-height: 0;
          }
          .persona-modal-body--edit {
            flex: 1 1 0%;
          }
          .persona-modal-option--edit {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .persona-modal-option-body--edit {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            position: relative;
            overflow: hidden;
          }
          .persona-modal-options {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 28px;
            width: 100%;
            transition: all 0.28s ease;
          }
          .persona-modal-options--has-selection {
            display: flex;
            justify-content: flex-start;
            align-items: stretch;
            gap: 0;
            flex: 1 1 0%;
            width: 100%;
            min-height: 0;
            height: 100%;
          }

          /* When a run option (questionnaire/chat/interview) is selected, let the card
             stretch to fill the modal body so it sits just above the footer edge. */
          .persona-modal-options--has-selection .persona-modal-option--expanded:not(.persona-modal-option--edit) {
            min-height: 0;
            flex: 1 1 0%;
            height: 100%;
            width: 100%;
            max-width: none;
            align-items: stretch;
            display: flex;
            flex-direction: column;
          }
          @media (min-height: 640px) {
            .persona-modal-options--has-selection .persona-modal-option--expanded:not(.persona-modal-option--edit) {
              min-height: calc(100vh - 220px);
            }
          }

          @media (max-width: 900px) {
            .persona-modal-options--has-selection .persona-modal-option--expanded:not(.persona-modal-option--edit) {
              min-height: auto;
              height: auto;
            }
          }
          @media (max-width: 1100px) {
            .persona-modal-options {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .persona-modal-options--has-selection {
              display: flex;
            }
            .persona-modal-option--initial {
              flex: 1 1 calc((100% - 24px) / 2);
            }
          }
          @media (max-width: 720px) {
            .persona-modal-options {
              grid-template-columns: minmax(0, 1fr);
            }
            .persona-modal-option--initial {
              flex: 1 1 100%;
            }
          }
          .persona-modal-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            padding: 32px 28px;
            border-radius: 24px;
            border: 1px solid rgba(43, 108, 176, 0.28);
            background: #d2e4ff;
            box-shadow: 0 16px 42px rgba(10, 22, 40, 0.38);
            color: inherit;
            text-align: center;
            cursor: pointer;
            transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease,
              background 0.24s ease, opacity 0.2s ease, max-width 0.28s ease, flex 0.28s ease,
              height 0.28s ease;
            max-width: 320px;
            width: 100%;
          }
          .persona-modal-option--initial {
            flex: 1 1 calc((100% - 48px) / 3);
            max-width: none;
            align-items: center;
            text-align: center;
            padding: 36px 32px;
          }
          .persona-modal-option:hover,
          .persona-modal-option:focus-visible {
            transform: translateY(-6px);
            border-color: rgba(43, 108, 176, 0.58);
            box-shadow: 0 22px 52px rgba(10, 22, 40, 0.46);
            outline: none;
            color: inherit;
          }
          .persona-modal-option--expanded:not(.persona-modal-option--edit) {
            flex: 1 1 0%;
            max-width: none;
            width: 100%;
            height: 100%;
            max-height: calc(100vh - 220px);
            min-height: 0;
            align-items: stretch;
            text-align: left;
            transform: none;
            background: rgba(28, 44, 74, 0.98);
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
            padding: 22px 30px;
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            margin: 0;
            cursor: default;
            overflow: hidden;
          }
          @media (min-height: 640px) {
            .persona-modal-option--expanded:not(.persona-modal-option--edit) {
              min-height: calc(100vh - 220px);
              max-height: calc(100vh - 220px);
            }
          }
          .persona-modal-option--edit {
            flex: 1;
            max-width: none;
            width: 100%;
            height: auto;
            max-height: calc(100vh - 260px);
            min-height: 0;
            align-items: flex-start;
            text-align: left;
            transform: none;
            background: rgba(28, 44, 74, 0.98);
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
            padding: 22px 30px;
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            margin: 0;
            cursor: default;
          }
          .persona-modal-option--expanded:hover,
          .persona-modal-option--expanded:focus-visible {
            transform: none;
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
            background: rgba(28, 44, 74, 0.98);
          }
          .persona-modal-option--dismissed {
            opacity: 0;
            transform: translateY(40px) scale(0.92);
            pointer-events: none;
            max-width: 0;
            width: 0;
            padding: 0;
            margin: 0;
            border-width: 0;
          }
          .persona-modal-option-header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 18px;
            width: 50%;
          }
          .persona-modal-option--initial .persona-modal-option-header {
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            width: 100%;
          }
          .persona-modal-option-copy {
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: left;
            text-align: inherit;
            width: 100%;
          }
          .persona-modal-option--initial .persona-modal-option-copy {
            align-items: center;
            text-align: center;
            gap: 12px;
          }
          .persona-modal-option-titles {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .persona-modal-option--expanded .persona-modal-option-titles h3 {
            margin: 0;
          }
          .persona-modal-option-body {
            margin-top: 8px;
            width: 100%;
            flex: 1 1 0%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .persona-modal-option-body-content {
            flex: 1 1 0%;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .persona-modal-option-body-content > * {
            flex: 1 1 0%;
            min-height: 0;
          }
          .persona-modal-option-body > * {
            flex: 1 1 0%;
            min-height: 0;
          }
          .persona-modal-option h3 {
            margin: 0 0 10px;
            font-size: 20px;
            font-weight: 700;
          }
          .persona-modal-option--initial h3 {
            font-size: 22px;
          }
          .persona-modal-option p {
            margin: 0;
            font-size: 15px;
            color: #052033;
            line-height: 1.6;
          }
          .persona-modal-icon {
            width: 58px;
            height: 58px;
            border-radius: 20px;
            background: rgba(43, 108, 176, 0.08);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 0 1px rgba(43, 108, 176, 0.12);
            margin-bottom: 6px;
          }
          .persona-modal-icon--mini {
            width: 16px;
            height: 16px;
            margin-bottom: 0;
            background: none;
            box-shadow: none;
            border-radius: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
          }
          /* Light theme refresh for persona modal cards */
          .persona-modal-option {
            background: #f4f8ff;
            border: 1px solid rgba(43, 108, 176, 0.18);
            color: #052033;
          }
          .persona-modal-option--initial {
            background: #f4f8ff;
          }
          .persona-modal-option:hover,
          .persona-modal-option:focus-visible {
            background: #ffffff;
            border-color: rgba(43, 108, 176, 0.32);
            box-shadow: 0 18px 42px rgba(15, 40, 90, 0.14);
          }
          .persona-modal-option:hover h3,
          .persona-modal-option:focus-visible h3,
          .persona-modal-option:hover p,
          .persona-modal-option:focus-visible p {
            color: #052033;
          }
          .persona-modal-option--expanded {
            background: #ffffff;
            border-color: rgba(43, 108, 176, 0.35);
            box-shadow: 0 24px 60px rgba(15, 40, 90, 0.18);
            color: #052033;
          }
          .persona-modal-option--expanded:hover,
          .persona-modal-option--expanded:focus-visible {
            background: #ffffff;
            border-color: rgba(43, 108, 176, 0.42);
            box-shadow: 0 28px 72px rgba(15, 40, 90, 0.2);
          }
          .persona-modal-option--expanded .persona-modal-option-titles h3,
          .persona-modal-option--expanded .persona-modal-option-copy p {
            color: #052033;
          }
          .persona-modal-option--expanded .persona-modal-option-body,
          .persona-modal-option--expanded .persona-modal-option-body-content {
            background: transparent;
            color: #052033;
          }
          .persona-modal-option--expanded .persona-edit-aside-inner {
            background: #ffffff;
            border: 1px solid rgba(43, 108, 176, 0.18);
            box-shadow: 0 12px 32px rgba(15, 40, 90, 0.12);
            color: #1e293b;
          }
          .persona-modal-option--expanded .persona-edit-aside-inner--secondary {
            background: #f1f6ff;
          }
          .persona-modal-option--expanded .persona-edit-aside-inner strong {
            color: rgba(15, 40, 90, 0.76);
          }
          .persona-modal-option--expanded .persona-edit-aside-button {
            color: #1e3a8a;
          }
          .persona-modal-option--expanded .persona-edit-documents--empty {
            border-color: rgba(43, 108, 176, 0.25);
            color: rgba(51, 65, 85, 0.7);
          }
          .persona-modal-option--expanded .persona-edit-document-card {
            background: #ffffff;
            border: 1px solid rgba(43, 108, 176, 0.18);
            color: #052033;
            box-shadow: 0 14px 36px rgba(15, 40, 90, 0.14);
          }
          .persona-modal-option--expanded .persona-edit-document-meta {
            color: rgba(30, 41, 59, 0.72);
          }
          .persona-modal-option--expanded .persona-edit-document-open {
            background: #eef4ff;
            color: #1d4ed8;
            border-color: rgba(59, 130, 246, 0.28);
          }
          .persona-modal-option--expanded .persona-edit-document-open:hover,
          .persona-modal-option--expanded .persona-edit-document-open:focus-visible {
            background: #e2ecff;
            border-color: rgba(59, 130, 246, 0.4);
          }
          .persona-modal-option--expanded:not(.persona-modal-option--edit) {
            background: rgba(28, 44, 74, 0.98);
            color: #f6f7f9;
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
          }
          .persona-modal-option--expanded:not(.persona-modal-option--edit):hover,
          .persona-modal-option--expanded:not(.persona-modal-option--edit):focus-visible {
            background: rgba(28, 44, 74, 0.98);
            border-color: rgba(43, 108, 176, 0.6);
            box-shadow: 0 28px 64px rgba(10, 22, 40, 0.5);
          }
          .persona-modal-option--expanded:not(.persona-modal-option--edit) .persona-modal-option-titles h3,
          .persona-modal-option--expanded:not(.persona-modal-option--edit) .persona-modal-option-copy p {
            color: #f6f7f9;
          }
          .persona-modal-option--expanded:not(.persona-modal-option--edit) .persona-modal-option-body,
          .persona-modal-option--expanded:not(.persona-modal-option--edit) .persona-modal-option-body-content {
            color: #f6f7f9;
          }
          .persona-modal-option--expanded .persona-edit-document-close {
            color: rgba(30, 41, 59, 0.7);
            border-color: rgba(43, 108, 176, 0.28);
          }
          .persona-modal-option--expanded .persona-edit-document-close:hover,
          .persona-modal-option--expanded .persona-edit-document-close:focus-visible {
            background: rgba(226, 238, 255, 0.85);
            border-color: rgba(43, 108, 176, 0.45);
          }
          .persona-modal-option--expanded .persona-live-source-card {
            background: #ffffff;
            color: #052033;
            border: 1px solid rgba(43, 108, 176, 0.18);
            box-shadow: 0 12px 28px rgba(15, 40, 90, 0.12);
          }
          .persona-modal-option--expanded .persona-live-source-name {
            color: #1e3a8a;
          }
          .persona-modal-option--expanded .persona-live-source-meta {
            color: rgba(71, 85, 105, 0.75);
          }
          .persona-modal-option--expanded .persona-live-source-manage {
            background: #eef4ff;
            color: #1d4ed8;
            border-color: rgba(59, 130, 246, 0.3);
          }
          .persona-modal-option--expanded .persona-live-source-manage:hover,
          .persona-modal-option--expanded .persona-live-source-manage:focus-visible {
            background: #e0ecff;
            border-color: rgba(59, 130, 246, 0.45);
          }
          .persona-modal-option--expanded .persona-edit-trait {
            background: rgba(59, 130, 246, 0.12);
            border-color: rgba(59, 130, 246, 0.24);
            color: #1e3a8a;
          }
          .persona-modal-option--expanded .persona-edit-trait:hover,
          .persona-modal-option--expanded .persona-edit-trait:focus-visible {
            background: rgba(59, 130, 246, 0.18);
            border-color: rgba(59, 130, 246, 0.32);
          }
          .persona-modal-option--expanded .persona-edit-trait--add {
            color: #1e3a8a;
          }
          .persona-modal-option--expanded .persona-edit-trait-input,
          .persona-modal-option--expanded .persona-edit-description textarea {
            background: #ffffff;
            color: #052033;
            border: 1px solid rgba(43, 108, 176, 0.25);
          }
          .persona-modal-option--expanded .persona-edit-trait-save,
          .persona-modal-option--expanded .persona-edit-trait-cancel {
            background: #eef4ff;
            color: #1d4ed8;
            border-color: rgba(59, 130, 246, 0.3);
          }
          .persona-modal-option--expanded .persona-edit-trait-save:hover,
          .persona-modal-option--expanded .persona-edit-trait-save:focus-visible,
          .persona-modal-option--expanded .persona-edit-trait-cancel:hover,
          .persona-modal-option--expanded .persona-edit-trait-cancel:focus-visible {
            background: #e0ecff;
            border-color: rgba(59, 130, 246, 0.45);
          }
          .persona-modal-option--expanded .persona-edit-name-input {
            color: #052033;
          }
          .persona-modal-option--expanded .persona-edit-name-input::placeholder {
            color: rgba(100, 116, 139, 0.6);
          }
          .persona-modal-option--expanded .persona-quant-preview {
            background: #f4f8ff;
            border: 1px solid rgba(43, 108, 176, 0.16);
          }
          .persona-modal-option--expanded .persona-quant-file-card {
            background: #ffffff;
            border: 1px solid rgba(43, 108, 176, 0.18);
            color: #052033;
          }
          .persona-modal-option--expanded .persona-quant-action-square {
            background: #f4f8ff;
            color: #1d4ed8;
            border: 1px solid rgba(59, 130, 246, 0.3);
          }
          .persona-modal-option--expanded .persona-quant-action-square:hover,
          .persona-modal-option--expanded .persona-quant-action-square:focus-visible {
            background: #e0ecff;
            border-color: rgba(59, 130, 246, 0.45);
          }
          .persona-modal-option--expanded .persona-quant-file {
            color: rgba(30, 41, 59, 0.68);
          }
          .persona-modal-option--expanded .persona-results-table tbody tr:hover {
            background: rgba(59, 130, 246, 0.12);
          }
          .persona-modal-option--expanded .persona-results-download {
            background: rgba(59, 130, 246, 0.1);
            color: #1d4ed8;
            border-color: rgba(59, 130, 246, 0.28);
          }
          .persona-modal-option--expanded .persona-results-download:hover {
            background: rgba(59, 130, 246, 0.16);
          }
        /* Theme variables for a lighter navy-themed palette. Adjust here to tune the theme. */
        :global(.persona-root) {
          --bg: #f4f8ff; /* page background (very light bluish) */
          --panel: #f4f8ff; /* panel/card background */
          --panel-2: #f4f8ff; /* slightly bluish panel */
          --accent: #2b6cb0; /* primary accent (navy-blue) */
          --accent-2: #7fb3ff; /* lighter accent */
          --accent-rgb: 43,108,176;
          --text: #052033; /* primary text (dark navy) */
          --muted: #475569; /* muted text */
          --muted-2: #6b7280; /* secondary muted */
          --danger: #ef4444;
        }

        `}</style>
        </div>
      </div>
    </main>
      {isMounted && unsavedChangesBanner
        ? createPortal(unsavedChangesBanner, document.body)
        : null}
    </>
  );
}
