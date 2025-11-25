"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { v4 as uuidv4 } from "uuid";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { slugify } from "@/app/lib/jump";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import Sidebar from "../Sidebar";
import Topbar from "../../../components/Topbar";
import ModalPortalContext from "../../../components/ModalPortalContext";
import { supabase } from "../../../lib/supabaseClient";
import PillButton from "../../../components/PillButton";
import {
  normalizeVoiceOptions,
  type VoiceOption,
  type ElevenLabsVoiceResponse,
} from "@/app/lib/voiceCatalog";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import ResearchOverlayContent from "@/app/components/ResearchOverlayContent";
import InternalKnowledgeOverlayContent from "@/app/components/InternalKnowledgeOverlayContent";
import { AgentDocumentRow, PersonaDocumentRecord } from "@/app/lib/documentTypes";
import { useResearchOverlayState } from "@/app/hooks/useResearchOverlayState";

const QUESTIONNAIRE_STORAGE_BUCKET = "questionnaires";
const PERSONA_IMAGES_BUCKET = "persona_images";
const STATUS_POLL_INTERVAL_MS = 10_000;
const STATUS_POLL_MAX_DURATION_MS = 5 * 60 * 1000;

type PersonaRow = {
  agent_id: string;
  agent_name: string | null;
  role_title?: string | null;
  audience_type: string | null;
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
  key_pain_points?: string | string | null;
  jobs_to_be_done?: string | string | null;
  key_traits?: string[] | null;
  profile_image?: string | null;
  voice_id?: string | null;
  active_status?: boolean | null;
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
function getClientIdFromPath(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
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

function getLatestDocumentDate(docs: AgentDocumentRow[]): string | null {
  let latest: string | null = null;
  docs.forEach((doc) => {
    if (!doc.created_at) return;
    if (!latest) {
      latest = doc.created_at;
      return;
    }
    const currentTime = new Date(doc.created_at).getTime();
    const previousTime = new Date(latest).getTime();
    if (currentTime > previousTime) {
      latest = doc.created_at;
    }
  });
  return latest;
}

function formatResearchUpdatedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function guessLinkMimeType(url: string): string {
  if (/\.pdf$/i.test(url)) return "application/pdf";
  if (/\.txt$/i.test(url)) return "text/plain";
  if (/\.docx$/i.test(url)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (/\.doc$/i.test(url)) return "application/msword";
  if (/\.html?$/i.test(url)) return "text/html";
  return "text/html";
}

function formatRelativeTime(value: string | null): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  const now = Date.now();
  const diffMillis = now - parsed;
  const diffSeconds = Math.round(diffMillis / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const divisions: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let valueToFormat = diffSeconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [divisor, nextUnit] of divisions) {
    if (Math.abs(valueToFormat) < divisor) {
      unit = nextUnit as Intl.RelativeTimeFormatUnit;
      break;
    }
    valueToFormat /= divisor;
  }
  const rounded = Math.trunc(valueToFormat);
  return rtf.format(-rounded, unit);
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

function normalizeListFieldToString(source: string[] | string | null | undefined): string {
  if (Array.isArray(source)) {
    return source
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0)
      .join(", ");
  }
  if (typeof source === "string") {
    return source
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(", ");
  }
  return "";
}

function normalizeCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildPersonaInitial(name: string | null | undefined): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

type PersonaTrait = {
  label: string;
  value: string;
};

type ExternalArticle = {
  url: string | null;
  title: string | null;
};

type PersonaExternalKnowledgeRow = {
  agent_id: string;
  sourced_articles?: ExternalArticle[] | null;
  added_articles?: ExternalArticle[] | null;
  knowledge_text?: string | null;
  updated_at?: string | null;
};

type LanguageRow = {
  code: string;
  english_name: string | null;
  emoji_flag: string | null;
};

type PersonaScalarTraitKey = "age" | "gender" | "location" | "customer_status";


type GridPosition = {
  gridColumn: string;
  gridRow: string;
};

type PersonaAvatarDraft = {
  file: File;
  previewUrl: string;
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

const EMPTY_SCALAR_TRAIT_VALUES: Record<PersonaScalarTraitKey, string> = {
  age: "",
  gender: "",
  location: "",
  customer_status: "",
};

function createScalarTraitValues(
  values?: Partial<Record<PersonaScalarTraitKey, string>>
): Record<PersonaScalarTraitKey, string> {
  return {
    age: values?.age ?? "",
    gender: values?.gender ?? "",
    location: values?.location ?? "",
    customer_status: values?.customer_status ?? "",
  };
}

function areScalarTraitRecordsEqual(
  a: Record<PersonaScalarTraitKey, string>,
  b: Record<PersonaScalarTraitKey, string>
): boolean {
  return SCALAR_TRAIT_KEYS.every((key) => (a[key] ?? "") === (b[key] ?? ""));
}

const PERSONA_META_CHIP_LABELS = ["Key Info", "Internal Data Sources"] as const;
type PersonaMetaChipLabel = (typeof PERSONA_META_CHIP_LABELS)[number];

const DOCUMENT_TITLE_MAX_CHARS = 32;
const PERSONA_COMPLETION_TOTAL_SLOTS = 6;

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

function buildStoragePublicUrl(bucket: string, path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

type PublicUrlResponse = {
  publicUrl?: string;
  publicURL?: string;
};

function resolvePersonaProfileImageUrl(value?: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return buildStoragePublicUrl(PERSONA_IMAGES_BUCKET, trimmed);
}

function buildPublicUrl(path: string) {
  return buildStoragePublicUrl("docs", path);
}

type PersonasFullscreenModalProps = {
  open: boolean;
  onCloseAction: () => void;
  children?: React.ReactNode;
  anchorRef?: React.RefObject<HTMLElement | null>;
  fillScreen?: boolean;
};

function PersonasFullscreenModal({
  open,
  onCloseAction,
  children,
  anchorRef,
  fillScreen = false,
}: PersonasFullscreenModalProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseAction();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open, onCloseAction]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchorRect(null);
      return;
    }
    const anchorEl = anchorRef?.current;
    if (!anchorEl || typeof window === "undefined") {
      setAnchorRect(null);
      return;
    }

    const updateRect = () => {
      const nextRect = anchorRef?.current?.getBoundingClientRect() ?? null;
      setAnchorRect(nextRect);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(anchorEl);
    }

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      resizeObserver?.disconnect();
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const anchorStyles = fillScreen
    ? { inset: 0 as const }
    : anchorRect !== null
    ? {
        top: anchorRect.top,
        left: Math.max(anchorRect.left, 0),
        width:
          typeof window !== "undefined"
            ? Math.min(anchorRect.width, window.innerWidth)
            : anchorRect.width,
        height: anchorRect.height,
      }
    : { inset: 0 as const };

  return (
    <div
      role="presentation"
      onClick={onCloseAction}
      style={{
        position: "fixed",
        ...anchorStyles,
        zIndex: 1000,
        background: "rgba(var(--accent-rgb, 43,108,176), 0.08)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 0,
        backdropFilter: "blur(6px)",
      }}
    >
      <ModalPortalContext.Provider value={innerRef.current}>
        <div
          ref={innerRef}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          style={{
            background: fillScreen ? "#f4f6fb" : "var(--panel, #0f172a)",
            color: fillScreen ? "#0f172a" : "var(--text, #F6F7F9fff)",
            borderRadius: 0,
            border: "none",
            boxShadow: "none",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            position: "relative",
          }}
        >
          {children}
        </div>
      </ModalPortalContext.Provider>
    </div>
  );
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

function buildPersonaSlug(persona: PersonaRow): string | null {
  const keySlug = persona.key?.trim();
  if (keySlug?.length) {
    return slugify(keySlug);
  }
  const name = persona.agent_name?.trim();
  if (name?.length) {
    return slugify(name);
  }
  if (persona.agent_id) {
    return slugify(persona.agent_id);
  }
  return null;
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
];

type PersonaActionsOptionKey = "share" | "feedback" | "delete";

type PersonaActionsOption = {
  key: PersonaActionsOptionKey;
  label: string;
  description?: string;
  intent?: "default" | "danger";
};

const PERSONA_ACTION_MODAL_OPTIONS: PersonaActionsOption[] = [
  {
    key: "share",
    label: "Share persona",
    description: "Send this persona to teammates.",
  },
  {
    key: "delete",
    label: "Delete persona",
    description: "Remove this persona from your workspace.",
    intent: "danger",
  },
];

const EDIT_OPTION = {
  key: "edit",
  title: "Edit",
  description: "Open the persona editor.",
  icon: <span className="persona-option-icon">✎</span>,
};

type StagePanelProps = {
  heading?: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const showTitles = Boolean(heading || subheading);
  const hasHeader = Boolean(showTitles || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : null}
          {showTitles ? (
            <div className="stage-panel__titles">
              {heading ? <h2>{heading}</h2> : null}
              {subheading ? <p>{subheading}</p> : null}
            </div>
          ) : null}
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
  const clientIdFromPath = useMemo(() => getClientIdFromPath(pathname), [pathname]);
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [columns, setColumns] = useState<number>(() =>
    typeof window === "undefined" ? 4 : determineColumns(window.innerWidth)
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<PersonaRow | null>(null);
  const [selectedKeyInfoTab, setSelectedKeyInfoTab] = useState<"Description" | "Traits" | "Pain Points" | "JTBD">(
    "Description"
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const selectionResetRef = useRef(false);
  const [personaDocuments, setPersonaDocuments] = useState<Record<string, AgentDocumentRow[]>>({});
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [resolvedClientSlug, setResolvedClientSlug] = useState<string | null>(null);
  const [personaExternalAddedArticles, setPersonaExternalAddedArticles] = useState<Record<string, ExternalArticle[]>>({});
  const [personaExternalUpdatedAt, setPersonaExternalUpdatedAt] = useState<Record<string, string | null>>({});
  const [personaExternalKnowledgeText, setPersonaExternalKnowledgeText] = useState<Record<string, string | null>>({});
  const [externalArticlesError, setExternalArticlesError] = useState<string | null>(null);
  const [externalArticlesLoading, setExternalArticlesLoading] = useState(false);
  const [personasViewLinkCopied, setPersonasViewLinkCopied] = useState(false);
  const personaSlugLookup = useMemo(() => {
    const slugMap = new Map<string, string>();
    personas.forEach((row) => {
      const slug = buildPersonaSlug(row);
      if (slug) {
        slugMap.set(row.agent_id, slug);
      }
    });
    return slugMap;
  }, [personas]);
  const [chipEditingIndex, setChipEditingIndex] = useState<number | null>(null);
  const [chipEditingValue, setChipEditingValue] = useState("");
  const [chipEditDirty, setChipEditDirty] = useState(false);
  const personasViewCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [personaShareLinkCopied, setPersonaShareLinkCopied] = useState(false);
  const personaShareCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [personaClockStates, setPersonaClockStates] = useState<Record<string, boolean>>({});
  const [chipRowsExpanded, setChipRowsExpanded] = useState<Record<string, boolean>>({});
  const personasViewHref = useMemo(() => {
    if (resolvedClientId) return `/app/${resolvedClientId}/explore`;
    if (resolvedClientSlug) return `/app/${resolvedClientSlug}/explore`;
    if (clientSlug) return `/app/${clientSlug}/explore`;
    return "/app/explore";
  }, [resolvedClientId, resolvedClientSlug, clientSlug]);
  const handleCopyPersonasViewHref = useCallback(async () => {
    if (typeof window === "undefined") return;
    const absoluteHref = new URL(personasViewHref, window.location.origin).toString();
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(absoluteHref);
          copied = true;
        } catch (error) {
          console.warn("Navigator clipboard copy failed, attempting fallback", error);
        }
      }
      if (!copied) {
        const fallbackInput = document.createElement("textarea");
        fallbackInput.value = absoluteHref;
        fallbackInput.setAttribute("readonly", "");
        fallbackInput.style.position = "absolute";
        fallbackInput.style.left = "-9999px";
        document.body.appendChild(fallbackInput);
        fallbackInput.select();
        copied = document.execCommand("copy");
        document.body.removeChild(fallbackInput);
      }
      if (copied) {
        setPersonasViewLinkCopied(true);
        if (personasViewCopyTimeoutRef.current) {
          clearTimeout(personasViewCopyTimeoutRef.current);
        }
        personasViewCopyTimeoutRef.current = setTimeout(() => {
          setPersonasViewLinkCopied(false);
          personasViewCopyTimeoutRef.current = null;
        }, 1800);
        return;
      }
      throw new Error("Clipboard API unavailable to copy personas view link");
    } catch (error) {
      console.error("Failed to copy personas view link", error);
    }
  }, [personasViewHref]);
  useEffect(() => {
    return () => {
      if (personasViewCopyTimeoutRef.current) {
        clearTimeout(personasViewCopyTimeoutRef.current);
      }
    };
  }, []);
  useEffect(() => {
    return () => {
      if (personaShareCopyTimeoutRef.current) {
        clearTimeout(personaShareCopyTimeoutRef.current);
      }
    };
  }, []);
  const copyPersonaShareHref = useCallback(
    async (persona: PersonaRow) => {
      if (typeof window === "undefined") return;
      const personaSlug = personaSlugLookup.get(persona.agent_id) ?? null;
      const targetClientSlug = resolvedClientId ?? resolvedClientSlug ?? clientSlug ?? null;
      if (!personaSlug || !targetClientSlug) return;
      const personaPath = `/app/${encodeURIComponent(targetClientSlug)}/${encodeURIComponent(personaSlug)}`;
      const absoluteHref = new URL(personaPath, window.location.origin).toString();
      try {
        let copied = false;
        if (navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(absoluteHref);
            copied = true;
          } catch (error) {
            console.warn("Navigator clipboard copy failed, attempting fallback", error);
          }
        }
        if (!copied) {
          const fallbackInput = document.createElement("textarea");
          fallbackInput.value = absoluteHref;
          fallbackInput.setAttribute("readonly", "");
          fallbackInput.style.position = "absolute";
          fallbackInput.style.left = "-9999px";
          document.body.appendChild(fallbackInput);
          fallbackInput.select();
          copied = document.execCommand("copy");
          document.body.removeChild(fallbackInput);
        }
        if (copied) {
          setPersonaShareLinkCopied(true);
          if (personaShareCopyTimeoutRef.current) {
            clearTimeout(personaShareCopyTimeoutRef.current);
          }
          personaShareCopyTimeoutRef.current = setTimeout(() => {
            setPersonaShareLinkCopied(false);
            personaShareCopyTimeoutRef.current = null;
          }, 1800);
        }
      } catch (error) {
        console.error("[personas] Failed to copy persona share link", error);
      }
    },
    [clientSlug, personaSlugLookup, resolvedClientSlug]
  );
  const {
    agentResearch,
    agentResearchLoading,
    agentResearchError,
    selectedAgent,
    selectAgentById,
    promptValue,
    isPromptDirty,
    isPromptSaving,
    promptSaveError,
    handlePromptChange,
    handlePromptSave,
    handleClearPrompt,
    handleRemoveSourcedArticle,
    addArticleToAgent,
    targetSources,
    toggleTargetSource,
    setSelectedAgent,
  } = useResearchOverlayState(resolvedClientId);
  const overlayTitleId = "research-overlay-title";
  const overlayDescriptionId = "research-overlay-description";
  const [activeOverlayTab, setActiveOverlayTab] = useState<"research" | "prompt" | "sources">("research");
  const handleOpenResearchOverlay = useCallback(
    (agentId: string) => {
      selectAgentById(agentId);
      setActiveOverlayTab("research");
    },
    [selectAgentById]
  );
  const closeResearchOverlay = useCallback(() => {
    setSelectedAgent(null);
  }, [setSelectedAgent]);
  const handlePromptSaveCurrent = useCallback(() => {
    void handlePromptSave(promptValue);
  }, [handlePromptSave, promptValue]);
  const handleAddResearchArticle = useCallback(
    async (article: ExternalArticle) => {
      if (!selectedAgent) return;
      const agentId = selectedAgent.agentId;
      const targetClientId = resolvedClientId ?? clientIdFromPath ?? null;
      const articleUrl = article.url?.trim() ?? "";
      if (!agentId || !targetClientId || !articleUrl) return;
      try {
        const response = await fetch(`/api/clients/${targetClientId}/agent-research`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, article: { title: article.title, url: articleUrl } }),
        });
        if (!response.ok) {
          console.error("[personas] Failed to add research", response.status, await response.text());
          return;
        }
        addArticleToAgent(agentId, { title: article.title, url: articleUrl });
      } catch (error) {
        console.error("[personas] Failed to add research", error);
      }
    },
    [clientIdFromPath, handleRemoveSourcedArticle, resolvedClientId, selectedAgent]
  );
  const personaPreviewHref = useMemo(() => {
    if (!selectedAgent) return null;
    const personaSlug = personaSlugLookup.get(selectedAgent.agentId);
    const targetClientSlug = resolvedClientId ?? resolvedClientSlug ?? clientSlug ?? null;
    if (!personaSlug || !targetClientSlug) return null;
    return `/app/${encodeURIComponent(targetClientSlug)}/${encodeURIComponent(personaSlug)}`;
  }, [clientSlug, personaSlugLookup, resolvedClientSlug, selectedAgent]);
  const [internalOverlayPersonaId, setInternalOverlayPersonaId] = useState<string | null>(null);
  const [docsUploadCardOpen, setDocsUploadCardOpen] = useState(false);
  const internalOverlayTitleId = "internal-knowledge-overlay-title";
  const internalOverlayDescriptionId = "internal-knowledge-overlay-description";
  const [descriptionOverlayPersonaId, setDescriptionOverlayPersonaId] = useState<string | null>(null);
  const descriptionOverlayTitleId = "description-overlay-title";
  const descriptionOverlayDescriptionId = "description-overlay-description";
  const [activeUploadMode, setActiveUploadMode] = useState<"upload" | "link">("upload");
  const openInternalOverlay = useCallback((personaId: string) => {
    setInternalOverlayPersonaId(personaId);
  }, []);
  const closeInternalOverlay = useCallback(() => {
    setInternalOverlayPersonaId(null);
    setDocsUploadCardOpen(false);
  }, []);
  const handleToggleUploadCard = useCallback(
    (mode: "upload" | "link") => {
      setDocsUploadCardOpen((prev) => (prev && activeUploadMode === mode ? false : true));
      setActiveUploadMode(mode);
    },
    [activeUploadMode]
  );
  const [isAddingLink, setIsAddingLink] = useState(false);
  const internalOverlayPersona = useMemo(
    () => (internalOverlayPersonaId ? personas.find((persona) => persona.agent_id === internalOverlayPersonaId) ?? null : null),
    [internalOverlayPersonaId, personas]
  );
  const handleAddDocumentLink = useCallback(
    async (links: string[]) => {
      if (!internalOverlayPersona || !clientSlug || links.length === 0) return;
      const agentId = internalOverlayPersona.agent_id;
      if (!agentId) {
        setDocumentsActionError("Missing agent identifier");
        return;
      }
      setDocumentsActionError(null);
      setIsAddingLink(true);
      const insertedLinks: AgentDocumentRow[] = [];
      try {
        for (const link of links) {
          const { data: insertedDoc, error } = await supabase
            .from("agent_documents")
            .insert({
              agent_id: agentId,
              file_name: link,
              document_url: link,
              public_url: link,
              source: "link",
              added_stage: "docs_overlay",
            })
            .select()
            .single<AgentDocumentRow>();
          if (error) throw error;
          if (insertedDoc) {
            insertedLinks.push(insertedDoc as AgentDocumentRow);
          }
        }
        setPersonaDocuments((prev) => {
          const prevDocs = prev[agentId] ?? [];
          return {
            ...prev,
            [agentId]: [...insertedLinks, ...prevDocs],
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[personas] Failed to add link document", error);
        setDocumentsActionError(message || "Unable to add link.");
      } finally {
        setIsAddingLink(false);
      }
    },
    [clientSlug, internalOverlayPersona, supabase]
  );
  const internalOverlayDocuments = useMemo(
    () => (internalOverlayPersonaId ? personaDocuments[internalOverlayPersonaId] ?? [] : []),
    [internalOverlayPersonaId, personaDocuments]
  );
  const internalOverlayLastUpdated = useMemo(
    () => getLatestDocumentDate(internalOverlayDocuments),
    [internalOverlayDocuments]
  );
  const internalOverlayLastUpdatedLabel = formatDate(internalOverlayLastUpdated);
  const descriptionOverlayPersona = useMemo(
    () =>
      descriptionOverlayPersonaId
        ? personas.find((persona) => persona.agent_id === descriptionOverlayPersonaId) ?? null
        : null,
    [descriptionOverlayPersonaId, personas]
  );
  const closeDescriptionOverlay = useCallback(() => {
    setDescriptionOverlayPersonaId(null);
  }, []);
  const [descriptionOverlayDraft, setDescriptionOverlayDraft] = useState("");
  const [descriptionOverlayError, setDescriptionOverlayError] = useState<string | null>(null);
  const [descriptionOverlayTraits, setDescriptionOverlayTraits] = useState("");
  const [descriptionOverlayChipEditingIndex, setDescriptionOverlayChipEditingIndex] = useState<number | null>(null);
  const [descriptionOverlayChipEditingValue, setDescriptionOverlayChipEditingValue] = useState("");
  const [descriptionOverlayTraitsError, setDescriptionOverlayTraitsError] = useState<string | null>(null);
  const [descriptionOverlayPainPoints, setDescriptionOverlayPainPoints] = useState("");
  const [descriptionOverlayJobsToBeDone, setDescriptionOverlayJobsToBeDone] = useState("");
  const [isSavingDescriptionOverlay, setIsSavingDescriptionOverlay] = useState(false);
  const [isSavingDescriptionOverlayTraits, setIsSavingDescriptionOverlayTraits] = useState(false);
  const resetDescriptionOverlayFields = useCallback(() => {
    if (!descriptionOverlayPersona) return;
    const initialPainPoints = Array.isArray(descriptionOverlayPersona.key_pain_points)
      ? descriptionOverlayPersona.key_pain_points
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0)
          .join(", ")
      : typeof descriptionOverlayPersona.key_pain_points === "string"
        ? descriptionOverlayPersona.key_pain_points
        : "";
    const initialJobs = Array.isArray(descriptionOverlayPersona.jobs_to_be_done)
      ? descriptionOverlayPersona.jobs_to_be_done
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0)
          .join(", ")
      : typeof descriptionOverlayPersona.jobs_to_be_done === "string"
        ? descriptionOverlayPersona.jobs_to_be_done
        : "";
    const initialTraits = Array.isArray(descriptionOverlayPersona.key_traits)
      ? descriptionOverlayPersona.key_traits
          .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
          .filter((trait) => trait.length > 0)
      : [];
    const normalizedTraits = normalizeTraitsInput(initialTraits.join(", "));

    setDescriptionOverlayDraft(descriptionOverlayPersona.description ?? "");
    setDescriptionOverlayError(null);
    setIsSavingDescriptionOverlay(false);
    setDescriptionOverlayPainPoints(initialPainPoints);
    setDescriptionOverlayJobsToBeDone(initialJobs);
    setDescriptionOverlayTraits(normalizedTraits);
    setDescriptionOverlayChipEditingIndex(null);
    setDescriptionOverlayChipEditingValue("");
    setDescriptionOverlayTraitsError(null);
    setIsSavingDescriptionOverlayTraits(false);
  }, [descriptionOverlayPersona]);

  useEffect(() => {
    if (descriptionOverlayPersona) {
      resetDescriptionOverlayFields();
    } else {
      setDescriptionOverlayDraft("");
      setDescriptionOverlayError(null);
      setIsSavingDescriptionOverlay(false);
      setDescriptionOverlayTraits("");
      setDescriptionOverlayChipEditingIndex(null);
      setDescriptionOverlayChipEditingValue("");
      setDescriptionOverlayTraitsError(null);
      setIsSavingDescriptionOverlayTraits(false);
      setDescriptionOverlayPainPoints("");
      setDescriptionOverlayJobsToBeDone("");
    }
  }, [descriptionOverlayPersona, resetDescriptionOverlayFields]);

  const descriptionOverlayNormalizedTraits = useMemo(
    () => normalizeTraitsInput(descriptionOverlayTraits),
    [descriptionOverlayTraits]
  );
  const descriptionOverlayTraitList = useMemo(() => {
    if (!descriptionOverlayNormalizedTraits) return [];
    return descriptionOverlayNormalizedTraits
      .split(",")
      .map((trait) => trait.trim())
      .filter((trait) => trait.length > 0);
  }, [descriptionOverlayNormalizedTraits]);
  const descriptionOverlayBaselineKeyTraitsNormalized = useMemo(() => {
    if (!descriptionOverlayPersona) return "";
    const traits = Array.isArray(descriptionOverlayPersona.key_traits)
      ? descriptionOverlayPersona.key_traits
          .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
          .filter((trait) => trait.length > 0)
      : [];
    return traits.length > 0 ? normalizeTraitsInput(traits.join(", ")) : "";
  }, [descriptionOverlayPersona]);
  const descriptionOverlayBaseline = useMemo(() => {
    if (!descriptionOverlayPersona) {
      return {
        description: "",
        painPoints: "",
        jobs: "",
      };
    }
    return {
      description: descriptionOverlayPersona.description ?? "",
      painPoints: normalizeListFieldToString(descriptionOverlayPersona.key_pain_points),
      jobs: normalizeListFieldToString(descriptionOverlayPersona.jobs_to_be_done),
    };
  }, [descriptionOverlayPersona]);
  const descriptionOverlayHasKeyTraitChanges = useMemo(() => {
    if (!descriptionOverlayPersona) return false;
    const normalizedCurrent = normalizeTraitsInput(descriptionOverlayTraitList.join(", "));
    return normalizedCurrent !== descriptionOverlayBaselineKeyTraitsNormalized;
  }, [descriptionOverlayPersona, descriptionOverlayBaselineKeyTraitsNormalized, descriptionOverlayTraitList]);

  const descriptionOverlayHasUnsavedChanges = useMemo(() => {
    if (!descriptionOverlayPersona) return false;
    return (
      descriptionOverlayDraft !== descriptionOverlayBaseline.description ||
      descriptionOverlayPainPoints !== descriptionOverlayBaseline.painPoints ||
      descriptionOverlayJobsToBeDone !== descriptionOverlayBaseline.jobs
    );
  }, [
    descriptionOverlayPersona,
    descriptionOverlayBaseline,
    descriptionOverlayDraft,
    descriptionOverlayPainPoints,
    descriptionOverlayJobsToBeDone,
  ]);
  const descriptionOverlayHasAnyChanges = useMemo(
    () => descriptionOverlayHasUnsavedChanges || descriptionOverlayHasKeyTraitChanges,
    [descriptionOverlayHasUnsavedChanges, descriptionOverlayHasKeyTraitChanges]
  );
  const handleCreateFirstPersona = useCallback(() => {
    if (clientSlug) {
      router.push(`/client/${clientSlug}/upload`);
      return;
    }
    router.push("/upload");
  }, [clientSlug, router]);
  const togglePersonaClock = useCallback(
    async (persona: PersonaRow) => {
      const personaId = persona.agent_id;
      if (!personaId) return;
      const previousValue = personaClockStates[personaId] ?? !!persona.active_status;
      const nextValue = !previousValue;
      setPersonaClockStates((prev) => ({
        ...prev,
        [personaId]: nextValue,
      }));
      setPersonas((prev) =>
        prev.map((item) =>
          item.agent_id === personaId ? { ...item, active_status: nextValue } : item
        )
      );
      try {
        const { error } = await supabase
          .from("agent_map")
          .update({ active_status: nextValue })
          .eq("agent_id", personaId);
        if (error) {
          throw error;
        }
      } catch (error) {
        console.error("Failed to update persona active status", error);
        setPersonaClockStates((prev) => ({
          ...prev,
          [personaId]: previousValue,
        }));
        setPersonas((prev) =>
          prev.map((item) =>
            item.agent_id === personaId ? { ...item, active_status: previousValue } : item
          )
        );
    }
  },
  [personaClockStates, supabase]
);
  const handleToggleChipRow = useCallback((personaId: string) => {
    setChipRowsExpanded((prev) => ({
      ...prev,
      [personaId]: !prev[personaId],
    }));
  }, []);
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const expandedCardRef = useRef<HTMLDivElement | null>(null);
  const quantUploadInputRef = useRef<HTMLInputElement | null>(null);
  const personasGridScrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
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
  const [descriptionEditingPersonaId, setDescriptionEditingPersonaId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState<string>("");
  const [isSavingDescriptionInline, setIsSavingDescriptionInline] = useState(false);
  const [descriptionInlineError, setDescriptionInlineError] = useState<string | null>(null);
  const nameWrapperRef = useRef<HTMLDivElement | null>(null);
  const nameMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [nameFieldWidth, setNameFieldWidth] = useState<number | null>(null);
  const [nameEditingPersonaId, setNameEditingPersonaId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<string>("");
  const [isSavingNameInline, setIsSavingNameInline] = useState(false);
  const [nameInlineError, setNameInlineError] = useState<string | null>(null);
  const [editingTraits, setEditingTraits] = useState<string>("");
  const [isSavingTraits, setIsSavingTraits] = useState(false);
  const [traitsError, setTraitsError] = useState<string | null>(null);
  useEffect(() => {
    if (activePersona) {
      console.log("Active persona key traits:", activePersona.key_traits);
    }
  }, [activePersona]);
  const [scalarTraitValues, setScalarTraitValues] = useState<Record<PersonaScalarTraitKey, string>>(
    () => createScalarTraitValues()
  );
  const [scalarTraitBaseline, setScalarTraitBaseline] = useState<
    Record<PersonaScalarTraitKey, string>
  >(() => createScalarTraitValues());
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
  const ensureDefaultScalarTraitMeta = useCallback(() => {
    setScalarTraitErrors((prev) => {
      const allClear = SCALAR_TRAIT_KEYS.every((key) => prev[key] === null);
      if (allClear) {
        return prev;
      }
      return {
        age: null,
        gender: null,
        location: null,
        customer_status: null,
      };
    });
    setScalarTraitSaving((prev) => {
      const allIdle = SCALAR_TRAIT_KEYS.every((key) => prev[key] === false);
      if (allIdle) {
        return prev;
      }
      return {
        age: false,
        gender: false,
        location: false,
        customer_status: false,
      };
    });
  }, []);
  const [scalarTraitsEditingPersonaId, setScalarTraitsEditingPersonaId] = useState<string | null>(
    null
  );
  const dataSourceInputRef = useRef<HTMLInputElement | null>(null);
  const avatarUploadInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlsRef = useRef<Set<string>>(new Set());
  const [avatarUploadPersonaId, setAvatarUploadPersonaId] = useState<string | null>(null);
  const [avatarDrafts, setAvatarDrafts] = useState<Record<string, PersonaAvatarDraft>>({});
  const [avatarInlineErrors, setAvatarInlineErrors] = useState<Record<string, string | null>>({});
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isSavingDocuments, setIsSavingDocuments] = useState(false);
  const [documentsActionError, setDocumentsActionError] = useState<string | null>(null);
  const handleRemoveAgentDocument = useCallback(
    async (doc: AgentDocumentRow) => {
      if (!doc?.id) return;
      setDocumentsActionError(null);
      try {
        if (doc.document_id) {
          const response = await fetch("/api/eleven/delete-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: doc.document_id }),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Failed to delete ElevenLabs document");
          }
        }

        const { error } = await supabase.from("agent_documents").delete().eq("id", doc.id);
        if (error) {
          throw error;
        }
        setPersonaDocuments((previous) => {
          if (!doc.agent_id) return previous;
          const next = { ...previous };
          next[doc.agent_id] = (next[doc.agent_id] ?? []).filter((item) => item.id !== doc.id);
          return next;
        });
      } catch (error) {
        console.error("[personas] Failed to remove document", error);
        setDocumentsActionError("Unable to remove document. Please try again.");
        throw error;
      }
    },
    [supabase]
  );
  const handleUploadDocuments = useCallback(
    async (files: File[]) => {
      if (!internalOverlayPersona || !clientSlug || files.length === 0) return;
      console.log("[personas] handleUploadDocuments start", files.map((file) => file.name));
      const agentId = internalOverlayPersona.agent_id;
      if (!agentId) {
        setDocumentsActionError("Missing agent identifier");
        return;
      }
      setIsUploadingDocument(true);
      setDocumentsActionError(null);
      const insertedDocs: AgentDocumentRow[] = [];
      try {
        for (const file of files) {
          const storagePath = `clients/${clientSlug}/${uuidv4()}/${file.name}`;
          console.log("[personas] uploading", file.name, storagePath);
          const { error: uploadError } = await supabase.storage.from("docs").upload(storagePath, file, { upsert: true });
          if (uploadError) throw uploadError;
          const { data: publicUrlData } = await supabase.storage.from("docs").getPublicUrl(storagePath);
          const publicUrlResponse = (publicUrlData as PublicUrlResponse) ?? {};
          const publicUrl =
            publicUrlResponse.publicUrl ??
            publicUrlResponse.publicURL ??
            buildPublicUrl(storagePath);
          const { data: insertedDoc, error: insertError } = await supabase
            .from("agent_documents")
            .insert({
              agent_id: agentId,
              file_name: file.name,
              storage_path: storagePath,
              public_url: publicUrl,
              mime_type: file.type || null,
              file_size: file.size,
              source: "storage",
              added_stage: "docs_overlay",
            })
            .select()
            .single<AgentDocumentRow>();
          if (insertError) throw insertError;
          console.log("[personas] inserted document", insertedDoc?.id);
          if (insertedDoc) {
            insertedDocs.push(insertedDoc as AgentDocumentRow);
          }
        }
        setPersonaDocuments((prev) => {
          const prevDocs = prev[agentId] ?? [];
          return {
            ...prev,
            [agentId]: [...insertedDocs, ...prevDocs],
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[personas] Failed to upload documents", message);
        setDocumentsActionError(message || "Failed to upload documents.");
      } finally {
        setIsUploadingDocument(false);
      }
    },
    [clientSlug, internalOverlayPersona, supabase]
  );
  const [documentsEditingPersonaId, setDocumentsEditingPersonaId] = useState<string | null>(null);
  const [documentUploadPersonaId, setDocumentUploadPersonaId] = useState<string | null>(null);
  const [selectedMetaChip, setSelectedMetaChip] = useState<PersonaMetaChipLabel>(
    "Key Info"
  );
  const [isMounted, setIsMounted] = useState(false);
  const [showDeletePersonaConfirm, setShowDeletePersonaConfirm] = useState(false);
  const [isDeletingPersona, setIsDeletingPersona] = useState(false);
  const [deletePersonaError, setDeletePersonaError] = useState<string | null>(null);
  const [personaActionsModalPersona, setPersonaActionsModalPersona] = useState<PersonaRow | null>(null);
  const personaActionsInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const [personaPendingDelete, setPersonaPendingDelete] = useState<PersonaRow | null>(null);
  const [personaActionsModalView, setPersonaActionsModalView] = useState<"options" | "confirm-delete">(
    "options"
  );
  const personaActionsCancelFocusRef = useRef<HTMLButtonElement | null>(null);
  const [voiceSettingsPersona, setVoiceSettingsPersona] = useState<PersonaRow | null>(null);
  const voiceSettingsCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const [personaVoiceSelections, setPersonaVoiceSelections] = useState<Record<string, string>>({});
  const [voiceSettingsSelection, setVoiceSettingsSelection] = useState<string | null>(null);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [voiceOptionsLoading, setVoiceOptionsLoading] = useState(false);
  const [voiceOptionsError, setVoiceOptionsError] = useState<string | null>(null);
  const [voiceSelectionSaving, setVoiceSelectionSaving] = useState(false);
  const [voiceSelectionError, setVoiceSelectionError] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageRow[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [languagesError, setLanguagesError] = useState<string | null>(null);
  const voiceOptionsFetchedRef = useRef(false);
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const voiceSelectRef = useRef<HTMLDivElement | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const isViewer = profileRole === "viewer";
  const canEdit = profileRole !== null && !isViewer;

  const stopVoicePreview = useCallback(() => {
    const audio = previewAudioRef.current;
    if (audio) {
      const completeHandler = (audio as any)._voiceHandleComplete;
      if (completeHandler) {
        audio.removeEventListener("ended", completeHandler);
        audio.removeEventListener("error", completeHandler);
        delete (audio as any)._voiceHandleComplete;
      }
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch (error) {
        // ignore if resetting currentTime fails
      }
      audio.onended = null;
      audio.onerror = null;
    }
    previewAudioRef.current = null;
    setPreviewingVoiceId(null);
  }, []);

  const toggleVoicePreview = useCallback(
    (voice: VoiceOption) => {
      if (!voice.preview_url) return;
      if (previewingVoiceId === voice.voice_id) {
        stopVoicePreview();
        return;
      }
      stopVoicePreview();
      const audio = new Audio(voice.preview_url);
      previewAudioRef.current = audio;
      setPreviewingVoiceId(voice.voice_id);
      const handleComplete = () => {
        audio.removeEventListener("ended", handleComplete);
        audio.removeEventListener("error", handleComplete);
        stopVoicePreview();
      };
      (audio as any)._voiceHandleComplete = handleComplete;
      audio.addEventListener("ended", handleComplete);
      audio.addEventListener("error", handleComplete);
      void audio.play().catch(() => {
        handleComplete();
      });
    },
    [previewingVoiceId, stopVoicePreview]
  );

  const registerAvatarObjectUrl = useCallback((url: string) => {
    avatarObjectUrlsRef.current.add(url);
  }, []);

  const revokeAvatarObjectUrl = useCallback((url: string | null | undefined) => {
    if (!url) return;
    if (typeof window === "undefined" || typeof URL === "undefined") return;
    if (!avatarObjectUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    avatarObjectUrlsRef.current.delete(url);
  }, []);

  const clearAvatarDrafts = useCallback(() => {
    setAvatarDrafts((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }
      Object.values(prev).forEach((draft) => {
        revokeAvatarObjectUrl(draft.previewUrl);
      });
      return {};
    });
    setAvatarInlineErrors((prev) => (Object.keys(prev).length > 0 ? {} : prev));
    setAvatarUploadPersonaId(null);
  }, [revokeAvatarObjectUrl, setAvatarDrafts, setAvatarInlineErrors, setAvatarUploadPersonaId]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || typeof URL === "undefined") return;
      avatarObjectUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      avatarObjectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!personaActionsModalPersona) return;
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPersonaActionsModalPersona(null);
        setPersonaActionsModalView("options");
        setPersonaPendingDelete(null);
        setDeletePersonaError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [personaActionsModalPersona]);

  useEffect(() => {
    if (!personaActionsModalPersona) return;
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      if (personaActionsModalView === "options") {
        personaActionsInitialFocusRef.current?.focus();
      } else {
        personaActionsCancelFocusRef.current?.focus();
      }
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [personaActionsModalPersona, personaActionsModalView]);

  useEffect(() => {
    if (!voiceSettingsPersona) return;
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopVoicePreview();
        setIsVoiceMenuOpen(false);
        setVoiceSettingsPersona(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [voiceSettingsPersona, stopVoicePreview]);

  useEffect(() => {
    if (!voiceSettingsPersona) return;
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      voiceSettingsCloseButtonRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [voiceSettingsPersona, supabase]);

  useEffect(() => {
    if (!voiceSettingsPersona) {
      stopVoicePreview();
      setIsVoiceMenuOpen(false);
    }
  }, [voiceSettingsPersona, stopVoicePreview]);

  useEffect(() => {
    return () => {
      stopVoicePreview();
    };
  }, [stopVoicePreview]);

  useEffect(() => {
    if (!voiceSettingsPersona) return;

    let isCancelled = false;
    setLanguagesLoading(true);
    setLanguagesError(null);

    const loadLanguages = async () => {
      try {
        const { data, error } = await supabase
          .from("languages")
          .select("code, english_name, emoji_flag")
          .order("english_name", { ascending: true });

        if (isCancelled) return;

        if (error) {
          throw error;
        }

        const rows = Array.isArray(data) ? (data as LanguageRow[]) : [];
        setAvailableLanguages(rows);
      } catch (error) {
        if (isCancelled) return;
        console.error("[Personas] Failed to load persona languages", error);
        setLanguagesError("Unable to load persona languages right now.");
        setAvailableLanguages([]);
      } finally {
        if (!isCancelled) {
          setLanguagesLoading(false);
        }
      }
    };

    void loadLanguages();

    return () => {
      isCancelled = true;
    };
  }, [voiceSettingsPersona]);

  useEffect(() => {
    if (!isVoiceMenuOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!voiceSelectRef.current) return;
      if (!voiceSelectRef.current.contains(event.target as Node)) {
        setIsVoiceMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsVoiceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVoiceMenuOpen]);

  const handleOpenVoiceSettings = useCallback(
    (persona: PersonaRow) => {
      stopVoicePreview();
      setVoiceSelectionError(null);
      setVoiceSelectionSaving(false);
      setLanguagesError(null);
      const personaId = persona.agent_id;
      const storedSelection = personaVoiceSelections[personaId] ?? null;
      const fallbackSelection = voiceOptions[0]?.voice_id ?? null;
      setVoiceSettingsSelection(storedSelection ?? fallbackSelection ?? null);
      setVoiceSettingsPersona(persona);
      setIsVoiceMenuOpen(false);
    },
    [personaVoiceSelections, voiceOptions, stopVoicePreview]
  );

  const handleCloseVoiceSettings = useCallback(() => {
    setVoiceSettingsPersona(null);
    setVoiceSettingsSelection(null);
    voiceOptionsFetchedRef.current = false;
    setIsVoiceMenuOpen(false);
    stopVoicePreview();
    setVoiceSelectionError(null);
    setVoiceSelectionSaving(false);
    setAvailableLanguages([]);
    setLanguagesLoading(false);
    setLanguagesError(null);
  }, [stopVoicePreview]);

  const persistVoiceSelection = useCallback(
    async (personaId: string, nextVoiceId: string | null, previousVoiceId: string | null) => {
      setVoiceSelectionSaving(true);
      setVoiceSelectionError(null);
      try {
        const { error } = await supabase
          .from("agent_map")
          .update({ voice_id: nextVoiceId })
          .eq("agent_id", personaId);
        if (error) {
          throw error;
        }

        setPersonas((prev) =>
          prev.map((item) =>
            item.agent_id === personaId ? { ...item, voice_id: nextVoiceId ?? null } : item
          )
        );
        setActivePersona((prev) =>
          prev && prev.agent_id === personaId ? { ...prev, voice_id: nextVoiceId ?? null } : prev
        );
      } catch (error) {
        console.error("[Personas] Failed to persist voice_id", error);
        setVoiceSelectionError("Unable to save voice selection. Please try again.");
        setVoiceSettingsSelection(previousVoiceId);
        setPersonaVoiceSelections((current) => {
          if (previousVoiceId) {
            return {
              ...current,
              [personaId]: previousVoiceId,
            };
          }
          if (!(personaId in current)) {
            return current;
          }
          const { [personaId]: _removed, ...rest } = current;
          return rest;
        });
      } finally {
        setVoiceSelectionSaving(false);
      }
    },
    [
      setPersonas,
      setActivePersona,
      setVoiceSelectionSaving,
      setVoiceSelectionError,
      setVoiceSettingsSelection,
      setPersonaVoiceSelections,
      supabase,
    ]
  );

  const handleVoiceSettingsSelectionChange = useCallback(
    (personaId: string, nextVoiceId: string | null): boolean => {
      if (!canEdit) {
        return false;
      }
      if (voiceSelectionSaving) {
        return false;
      }

      const previousVoiceId = personaVoiceSelections[personaId] ?? null;
      stopVoicePreview();
      setVoiceSelectionError(null);
      setVoiceSettingsSelection(nextVoiceId);

      if (previousVoiceId === nextVoiceId) {
        return true;
      }

      setPersonaVoiceSelections((previous) => {
        if (!nextVoiceId) {
          if (!(personaId in previous)) {
            return previous;
          }
          const { [personaId]: _removed, ...rest } = previous;
          return rest;
        }
        if (previous[personaId] === nextVoiceId) {
          return previous;
        }
        return {
          ...previous,
          [personaId]: nextVoiceId,
        };
      });
      void persistVoiceSelection(personaId, nextVoiceId, previousVoiceId);
      return true;
    },
    [
      canEdit,
      voiceSelectionSaving,
      personaVoiceSelections,
      stopVoicePreview,
      setPersonaVoiceSelections,
      persistVoiceSelection,
      setVoiceSelectionError,
      setVoiceSettingsSelection,
    ]
  );

  useEffect(() => {
    if (!voiceSettingsPersona) return;
    if (voiceOptionsFetchedRef.current) return;

    let isCancelled = false;
    const abortController = new AbortController();

    async function loadVoiceOptions() {
      voiceOptionsFetchedRef.current = true;
      setVoiceOptionsLoading(true);
      setVoiceOptionsError(null);
      try {
        const response = await fetch("/api/eleven/voices", { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = await response.json();
        if (isCancelled) return;
        const rawVoices: ElevenLabsVoiceResponse[] = Array.isArray(payload?.voices)
          ? payload.voices
          : [];
        const normalized = normalizeVoiceOptions(rawVoices);
        setVoiceOptions(normalized);
        setVoiceOptionsError(null);
      } catch (error) {
        if (isCancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        console.error("[Personas] Failed to load ElevenLabs voices", error);
        setVoiceOptionsError(
          "We couldn’t refresh voices from ElevenLabs. Showing recent selections instead."
        );
      } finally {
        setVoiceOptionsLoading(false);
      }
    }

    void loadVoiceOptions();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [voiceSettingsPersona]);

  useEffect(() => {
    if (!voiceSettingsPersona) return;
    if (voiceOptions.length === 0) {
      if (voiceSettingsSelection !== null) {
        setVoiceSettingsSelection(null);
      }
      return;
    }

    const personaId = voiceSettingsPersona.agent_id;
    const selectionExists =
      voiceSettingsSelection != null &&
      voiceOptions.some((voice) => voice.voice_id === voiceSettingsSelection);
    if (selectionExists) {
      return;
    }

    const persistedSelection = personaVoiceSelections[personaId] ?? null;
    if (
      persistedSelection &&
  voiceOptions.some((voice) => voice.voice_id === persistedSelection)
    ) {
      setVoiceSettingsSelection(persistedSelection);
      return;
    }

    const fallbackSelection = voiceOptions[0]?.voice_id ?? null;
    if (fallbackSelection !== (voiceSettingsSelection ?? null)) {
      setVoiceSettingsSelection(fallbackSelection ?? null);
    }
  }, [
    voiceOptions,
    voiceSettingsPersona,
    personaVoiceSelections,
    voiceSettingsSelection,
  ]);

  useEffect(() => {
    if (voiceOptions.length === 0) {
      setIsVoiceMenuOpen(false);
      stopVoicePreview();
    }
  }, [voiceOptions, stopVoicePreview]);

  useEffect(() => {
    if (voiceOptionsLoading) {
      setIsVoiceMenuOpen(false);
      stopVoicePreview();
    }
  }, [voiceOptionsLoading, stopVoicePreview]);

  const personaGridPositions = useMemo(() => {
    const total = personas.length;
    if (total === 0) return [] as GridPosition[];
    const safeColumns = Math.max(columns, 1);
    const positions: GridPosition[] = new Array(total);
    const expandedReadyId = (() => {
      if (!expandedPersonaId) return null;
      const match = personas.find((item) => item.agent_id === expandedPersonaId);
      if (!match) return null;
      const status = (match.status ?? "").toLowerCase();
      return status === "ready" ? expandedPersonaId : null;
    })();
    let currentRow = 1;
    for (let rowStart = 0; rowStart < total; rowStart += safeColumns) {
      const rowEnd = Math.min(rowStart + safeColumns, total);
      const rowItems = personas.slice(rowStart, rowEnd);
      const expandedIndexInRow =
        expandedReadyId && expandedReadyId.length > 0
          ? rowItems.findIndex((item) => item.agent_id === expandedReadyId)
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

  useEffect(() => {
    const grid = personasGridScrollRef.current;
    if (!grid) return;
    const lists = Array.from(grid.querySelectorAll<HTMLElement>(".persona-expanded-list"));
    if (lists.length === 0) return;

    const handleWheel = (event: WheelEvent) => {
      const target = event.currentTarget as HTMLElement;
      const canScroll = target.scrollHeight > target.clientHeight;
      const isAtTop = target.scrollTop <= 0;
      const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;

      if (!canScroll) {
        grid.scrollTop += event.deltaY;
        return;
      }

      if ((event.deltaY < 0 && isAtTop) || (event.deltaY > 0 && isAtBottom)) {
        event.preventDefault();
        grid.scrollTop += event.deltaY;
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const target = event.currentTarget as HTMLElement;
      const touchCurrent = event.touches[0]?.clientY;
      if (touchCurrent == null) return;
      const previousY = touchStartYRef.current;
      if (previousY == null) {
        touchStartYRef.current = touchCurrent;
        return;
      }
      const deltaY = previousY - touchCurrent;
      const canScroll = target.scrollHeight > target.clientHeight;
      const isAtTop = target.scrollTop <= 0;
      const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;

      if (!canScroll) {
        grid.scrollTop += deltaY;
        touchStartYRef.current = touchCurrent;
        event.preventDefault();
        return;
      }

      if ((deltaY < 0 && isAtTop) || (deltaY > 0 && isAtBottom)) {
        grid.scrollTop += deltaY;
        event.preventDefault();
      }
      touchStartYRef.current = touchCurrent;
    };

    lists.forEach((list) => {
      list.addEventListener("wheel", handleWheel, { passive: false });
      list.addEventListener("touchstart", handleTouchStart, { passive: true });
      list.addEventListener("touchmove", handleTouchMove, { passive: false });
    });

    return () => {
      lists.forEach((list) => {
        list.removeEventListener("wheel", handleWheel);
        list.removeEventListener("touchstart", handleTouchStart);
        list.removeEventListener("touchmove", handleTouchMove);
      });
    };
  }, [expandedPersonaId, personas]);

  const hasPendingPersonas = useMemo(
    () =>
      personas.some((persona) => {
        const status = typeof persona.status === "string" ? persona.status.trim().toLowerCase() : "";
        return status.length === 0 || status !== "ready";
      }),
    [personas]
  );

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    if (!hasPendingPersonas) return undefined;
    let isActive = true;
    const startTime = Date.now();

    const getPendingIds = () =>
      personas
        .filter((persona) => {
          const status = typeof persona.status === "string" ? persona.status.trim().toLowerCase() : "";
          return status.length === 0 || status !== "ready";
        })
        .map((persona) => persona.agent_id)
        .filter((agentId): agentId is string => typeof agentId === "string" && agentId.length > 0);

    async function pollStatuses() {
      if (!isActive) return;
      if (Date.now() - startTime > STATUS_POLL_MAX_DURATION_MS) {
        return;
      }
      const ids = getPendingIds();
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("agent_map")
        .select("agent_id,status")
        .in("agent_id", ids);

      if (!isActive) return;

      if (!error && Array.isArray(data)) {
        setPersonas((previous) =>
          previous.map((persona) => {
            const latest = data.find((row) => row.agent_id === persona.agent_id);
            return latest ? { ...persona, status: latest.status } : persona;
          })
        );
      }

      if (getPendingIds().length > 0) {
        timeoutId = window.setTimeout(pollStatuses, STATUS_POLL_INTERVAL_MS);
      }
    }

    let timeoutId = window.setTimeout(pollStatuses, STATUS_POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [hasPendingPersonas, personas, supabase, setPersonas]);

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
  const inlineNamePersona = useMemo(() => {
    if (!nameEditingPersonaId) return null;
    return personas.find((row) => row.agent_id === nameEditingPersonaId) ?? null;
  }, [nameEditingPersonaId, personas]);
  const baselineInlineName = inlineNamePersona ? (inlineNamePersona.agent_name ?? "") : "";
  const hasUnsavedNameInline = Boolean(
    inlineNamePersona && nameDraft.trim() !== baselineInlineName.trim()
  );
  const baselinePersonaDescription = activePersona ? activePersona.description ?? "" : "";
  const hasUnsavedDescription = Boolean(
    activePersona && editingDescription !== baselinePersonaDescription
  );
  const inlineDescriptionPersona = useMemo(() => {
    if (!descriptionEditingPersonaId) return null;
    return personas.find((row) => row.agent_id === descriptionEditingPersonaId) ?? null;
  }, [descriptionEditingPersonaId, personas]);
  const baselineInlineDescription = inlineDescriptionPersona
    ? inlineDescriptionPersona.description ?? ""
    : "";
  const hasUnsavedDescriptionInline = Boolean(
    inlineDescriptionPersona && descriptionDraft !== baselineInlineDescription
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
  const chipTraitsList = useMemo(() => {
    if (!normalizedEditingTraits) return [];
    return normalizedEditingTraits
      .split(",")
      .map((trait) => trait.trim())
      .filter((trait) => trait.length > 0);
  }, [normalizedEditingTraits]);
  const hasUnsavedKeyTraits = Boolean(
    activePersona && normalizedEditingTraits !== baselineKeyTraitsNormalized
  );
  const hasUnsavedKeyTraitEdits = chipEditDirty;
  const scalarTraitsSourcePersona = useMemo(() => {
    if (activePersona) {
      return activePersona;
    }
    if (scalarTraitsEditingPersonaId) {
      return personas.find((row) => row.agent_id === scalarTraitsEditingPersonaId) ?? null;
    }
    return null;
  }, [activePersona, scalarTraitsEditingPersonaId, personas]);
  const baselineScalarTraits = scalarTraitBaseline;
  const hasUnsavedScalarTraits = useMemo(
    () =>
      SCALAR_TRAIT_KEYS.some((key) => {
        const baselineValue = baselineScalarTraits[key];
        const currentValue = (scalarTraitValues[key] ?? "").trim();
        return currentValue !== baselineValue;
      }),
    [baselineScalarTraits, scalarTraitValues]
  );
  const hasUnsavedAvatarDraft = useMemo(
    () => Object.keys(avatarDrafts).length > 0,
    [avatarDrafts]
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

  const startAvatarUpload = useCallback(
    (persona: PersonaRow) => {
      if (!canEdit) return;
      setAvatarUploadPersonaId(persona.agent_id);
      setAvatarInlineErrors((prev) => {
        if (prev[persona.agent_id] == null) {
          return prev;
        }
        const next = { ...prev };
        next[persona.agent_id] = null;
        return next;
      });
      avatarUploadInputRef.current?.click();
    },
    [canEdit]
  );

  const handleAvatarUploadChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canEdit) {
        event.target.value = "";
        return;
      }
      const files = event.target.files;
      const personaId = avatarUploadPersonaId;
      if (!files || files.length === 0 || !personaId) {
        setAvatarUploadPersonaId(null);
        event.target.value = "";
        return;
      }
      const file = files[0];
      if (!file || (file.type && !file.type.startsWith("image/"))) {
        setAvatarInlineErrors((prev) => ({
          ...prev,
          [personaId]: "Please choose an image file (PNG, JPG, or GIF).",
        }));
        setAvatarUploadPersonaId(null);
        event.target.value = "";
        return;
      }
      if (
        typeof window === "undefined" ||
        typeof URL === "undefined" ||
        typeof URL.createObjectURL !== "function"
      ) {
        setAvatarInlineErrors((prev) => ({
          ...prev,
          [personaId]: "Image preview is not supported in this browser.",
        }));
        setAvatarUploadPersonaId(null);
        event.target.value = "";
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      registerAvatarObjectUrl(objectUrl);
      let previousUrl: string | null = null;
      setAvatarDrafts((prev) => {
        const prior = prev[personaId];
        previousUrl = prior?.previewUrl ?? null;
        return {
          ...prev,
          [personaId]: { file, previewUrl: objectUrl },
        };
      });
      if (previousUrl) {
        revokeAvatarObjectUrl(previousUrl);
      }
      setAvatarInlineErrors((prev) => {
        if (prev[personaId] == null) {
          return prev;
        }
        const next = { ...prev };
        next[personaId] = null;
        return next;
      });
      setAvatarUploadPersonaId(null);
      event.target.value = "";
    },
    [
      canEdit,
      avatarUploadPersonaId,
      registerAvatarObjectUrl,
      revokeAvatarObjectUrl,
      setAvatarDrafts,
      setAvatarInlineErrors,
      setAvatarUploadPersonaId,
    ]
  );

  useEffect(() => {
    if (canEdit) return;
    setNameEditingPersonaId(null);
    setNameDraft("");
    setNameInlineError(null);
    setIsSavingNameInline(false);
  }, [canEdit]);

  useEffect(() => {
    const resetScalarTraitState = () => {
      setScalarTraitValues((prev) =>
        areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
          ? prev
          : createScalarTraitValues()
      );
      setScalarTraitBaseline((prev) =>
        areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
          ? prev
          : createScalarTraitValues()
      );
      ensureDefaultScalarTraitMeta();
    };

    if (!canEdit) {
      if (scalarTraitsEditingPersonaId !== null) {
        setScalarTraitsEditingPersonaId(null);
      }
      if (!activePersona) {
        resetScalarTraitState();
      }
      return;
    }

    if (!expandedPersonaId) {
      if (scalarTraitsEditingPersonaId !== null) {
        setScalarTraitsEditingPersonaId(null);
      }
      if (!activePersona) {
        resetScalarTraitState();
      }
      return;
    }

    const persona = personas.find((row) => row.agent_id === expandedPersonaId);
    if (!persona) {
      return;
    }

    const nextScalarTraits = createScalarTraitValues({
      age: readScalarTraitValue(persona, "age"),
      gender: readScalarTraitValue(persona, "gender"),
      location: readScalarTraitValue(persona, "location"),
      customer_status: readScalarTraitValue(persona, "customer_status"),
    });

    if (scalarTraitsEditingPersonaId !== expandedPersonaId) {
      setScalarTraitsEditingPersonaId(expandedPersonaId);
    }

    const hasPendingScalarTraitDraft = !areScalarTraitRecordsEqual(
      scalarTraitValues,
      scalarTraitBaseline
    );

    if (!hasPendingScalarTraitDraft) {
      setScalarTraitValues((prev) =>
        areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
      );
      setScalarTraitBaseline((prev) =>
        areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
      );
    }

    ensureDefaultScalarTraitMeta();
  }, [
    canEdit,
    expandedPersonaId,
    scalarTraitsEditingPersonaId,
    personas,
    activePersona,
    scalarTraitBaseline,
    scalarTraitValues,
    ensureDefaultScalarTraitMeta,
  ]);

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
  }, [isViewer, selectedOption]);

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
  const isDataSourcesSelected = selectedMetaChip === "Internal Data Sources";

  useEffect(() => {
    async function fetchPersonas() {
      if (!clientSlug) {
        setError("Workspace not found");
        setPersonas([]);
        setPersonaVoiceSelections({});
        setProfileRole(null);
        setResolvedClientId(null);
        setResolvedClientSlug(null);
        return;
      }
      setLoading(true);
      setError(null);
      setDocumentsError(null);
      setPersonaDocuments({});
      setDocumentsLoading(false);
      setExternalArticlesError(null);
      setPersonaExternalAddedArticles({});
      setPersonaExternalUpdatedAt({});
      setPersonaExternalKnowledgeText({});
      setExternalArticlesLoading(false);
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
          setPersonaVoiceSelections({});
          setProfileRole(null);
          setResolvedClientId(null);
          setResolvedClientSlug(null);
          if (clientQueryError) {
            // eslint-disable-next-line no-console
            console.error("[personas] Failed to resolve client", clientQueryError);
          }
          return;
        }

        setResolvedClientId(client.id);
        const canonicalSlug = (() => {
          if (client.name) {
            const slug = slugify(client.name);
            if (slug) return slug;
          }
          if (clientSlug) return clientSlug;
          return null;
        })();
        setResolvedClientSlug(canonicalSlug);

        const { data, error: personaError } = await supabase
          .from("agent_map")
          .select(
            "agent_id, agent_name, role_title, audience_type, description, status, dialogue_created_date, key, customer_status, key_pain_points, jobs_to_be_done, key_traits, profile_image, voice_id, active_status"
          )
          .eq("client_id", client.id)
          .order("created_at", { ascending: false });
        if (personaError) {
          setError("Unable to load personas");
          setPersonas([]);
          setPersonaVoiceSelections({});
          return;
        }
        const personaRows = (data ?? []).filter((row) => row.agent_id);
        setPersonas(personaRows);
        const initialVoiceSelections = personaRows.reduce((acc, row) => {
          if (row.agent_id && row.voice_id) {
            acc[row.agent_id] = row.voice_id;
          }
          return acc;
        }, {} as Record<string, string>);
        setPersonaVoiceSelections(initialVoiceSelections);
        const initialActiveStates = personaRows.reduce((acc, row) => {
          if (row.agent_id) {
            acc[row.agent_id] = !!row.active_status;
          }
          return acc;
        }, {} as Record<string, boolean>);
        setPersonaClockStates(initialActiveStates);

        if (personaRows.length > 0) {
          const agentIds = personaRows.map((row) => row.agent_id);
          if (agentIds.length > 0) {
            setDocumentsLoading(true);
            setExternalArticlesLoading(true);
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

              const { data: externalData, error: externalFetchError } = await supabase
                .from("persona_external_knowledge")
                .select("agent_id, sourced_articles, added_articles, knowledge_text, updated_at")
                .in("agent_id", agentIds);

              if (externalFetchError) {
                setExternalArticlesError("Unable to load external data sources.");
                setPersonaExternalAddedArticles({});
              } else {
                const groupedAdded = ((externalData as PersonaExternalKnowledgeRow[]) ?? []).reduce(
                  (acc, row) => {
                    if (!row.agent_id) return acc;
                    const rawArticles: unknown[] = Array.isArray(row.added_articles)
                      ? row.added_articles
                      : [];
                    const cleanedArticles: ExternalArticle[] = rawArticles
                      .map((article): ExternalArticle | null => {
                        if (!article || typeof article !== "object") return null;
                        const record = article as Record<string, unknown>;
                        const url =
                          typeof record.url === "string" && record.url.trim().length > 0
                            ? record.url.trim()
                            : null;
                        const title =
                          typeof record.title === "string" && record.title.trim().length > 0
                            ? record.title.trim()
                            : null;
                        if (!url && !title) {
                          return null;
                        }
                        return { url, title };
                      })
                      .filter((article): article is ExternalArticle => article !== null);
                    acc[row.agent_id] = cleanedArticles;
                    return acc;
                  },
                  {} as Record<string, ExternalArticle[]>
                );
                const groupedUpdated = ((externalData as PersonaExternalKnowledgeRow[]) ?? []).reduce(
                  (acc, row) => {
                    if (!row.agent_id) return acc;
                    acc[row.agent_id] = row.updated_at ?? null;
                    return acc;
                  },
                  {} as Record<string, string | null>
                );
                const groupedKnowledge = ((externalData as PersonaExternalKnowledgeRow[]) ?? []).reduce(
                  (acc, row) => {
                    if (!row.agent_id) return acc;
                    acc[row.agent_id] =
                      typeof row.knowledge_text === "string" && row.knowledge_text.trim().length > 0
                        ? row.knowledge_text.trim()
                        : null;
                    return acc;
                  },
                  {} as Record<string, string | null>
                );
                setPersonaExternalAddedArticles(groupedAdded);
                setPersonaExternalUpdatedAt(groupedUpdated);
                setPersonaExternalKnowledgeText(groupedKnowledge);
              }
            } finally {
              setDocumentsLoading(false);
              setExternalArticlesLoading(false);
            }
          } else {
            setDocumentsLoading(false);
            setExternalArticlesLoading(false);
          }
        } else {
          setDocumentsLoading(false);
          setExternalArticlesLoading(false);
        }
      } finally {
        setLoading(false);
        setDocumentsLoading(false);
        setExternalArticlesLoading(false);
      }
    }
    fetchPersonas();
  }, [clientSlug]);

  useEffect(() => {
    if (personas.length === 0) {
      selectionResetRef.current = false;
      return;
    }
    if (selectionResetRef.current) {
      return;
    }
    setExpandedPersonaId(null);
    setActivePersona(null);
    setSelectedOption(null);
    selectionResetRef.current = true;
  }, [personas.length, setExpandedPersonaId, setActivePersona, setSelectedOption]);

  useEffect(() => {
    selectionResetRef.current = false;
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

  const handleTogglePersonaCard = useCallback(
    (persona: PersonaRow) => {
      setExpandedPersonaId((previous) => {
        const isClosing = previous === persona.agent_id;
        const nextId = isClosing ? null : persona.agent_id;
        if (!canEdit) {
          return nextId;
        }
        if (isClosing) {
          setNameEditingPersonaId(null);
          setNameDraft("");
          setNameInlineError(null);
          setIsSavingNameInline(false);
          setAvatarUploadPersonaId(null);
          setAvatarInlineErrors((prev) => {
            if (!prev[persona.agent_id]) {
              return prev;
            }
            const next = { ...prev };
            delete next[persona.agent_id];
            return next;
          });
          setDescriptionEditingPersonaId(null);
          setDescriptionDraft("");
          setDescriptionInlineError(null);
          setIsSavingDescriptionInline(false);
          setDocumentsEditingPersonaId(null);
          setDocumentUploadPersonaId(null);
          setDocumentsActionError(null);
          setIsSavingDocuments(false);
          setIsUploadingDocument(false);
          setScalarTraitsEditingPersonaId(null);
          setScalarTraitValues((prev) =>
            areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
              ? prev
              : createScalarTraitValues()
          );
          setScalarTraitBaseline((prev) =>
            areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
              ? prev
              : createScalarTraitValues()
          );
          ensureDefaultScalarTraitMeta();
        } else {
          setNameEditingPersonaId(null);
          setNameDraft("");
          setNameInlineError(null);
          setIsSavingNameInline(false);
          setAvatarUploadPersonaId(null);
          setAvatarInlineErrors((prev) => {
            if (!prev[persona.agent_id]) {
              return prev;
            }
            const next = { ...prev };
            delete next[persona.agent_id];
            return next;
          });
          setDescriptionEditingPersonaId(persona.agent_id);
          setDescriptionDraft(persona.description ?? "");
          setDescriptionInlineError(null);
          setIsSavingDescriptionInline(false);
          setDocumentsEditingPersonaId(persona.agent_id);
          setDocumentUploadPersonaId(null);
          setDocumentsActionError(null);
          setIsSavingDocuments(false);
          setIsUploadingDocument(false);
          setScalarTraitsEditingPersonaId(persona.agent_id);
          const nextScalarTraits = createScalarTraitValues({
            age: readScalarTraitValue(persona, "age"),
            gender: readScalarTraitValue(persona, "gender"),
            location: readScalarTraitValue(persona, "location"),
            customer_status: readScalarTraitValue(persona, "customer_status"),
          });
          setScalarTraitValues((prev) =>
            areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
          );
          setScalarTraitBaseline((prev) =>
            areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
          );
          ensureDefaultScalarTraitMeta();
        }
        return nextId;
      });
    },
    [
      canEdit,
      setNameEditingPersonaId,
      setNameDraft,
      setNameInlineError,
      setIsSavingNameInline,
  setDescriptionEditingPersonaId,
  setDescriptionDraft,
  setDescriptionInlineError,
  setIsSavingDescriptionInline,
  setDocumentsEditingPersonaId,
      setDocumentUploadPersonaId,
      setDocumentsActionError,
      setIsSavingDocuments,
      setIsUploadingDocument,
      setAvatarUploadPersonaId,
      setAvatarInlineErrors,
      ensureDefaultScalarTraitMeta,
    ]
  );

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

  useEffect(() => {
    if (!canEdit) {
      setDescriptionEditingPersonaId(null);
      setDescriptionDraft("");
      setDescriptionInlineError(null);
      setIsSavingDescriptionInline(false);
      return;
    }
    if (!expandedPersonaId) {
      setDescriptionEditingPersonaId(null);
      setDescriptionDraft("");
      setDescriptionInlineError(null);
      setIsSavingDescriptionInline(false);
      setSelectedKeyInfoTab("Description");
      return;
    }
    if (descriptionEditingPersonaId !== expandedPersonaId) {
      const persona = personas.find((item) => item.agent_id === expandedPersonaId);
      setDescriptionEditingPersonaId(expandedPersonaId);
      setDescriptionDraft(persona?.description ?? "");
      setDescriptionInlineError(null);
      setIsSavingDescriptionInline(false);
      setSelectedKeyInfoTab("Description");
    }
  }, [canEdit, expandedPersonaId, descriptionEditingPersonaId, personas]);

  useEffect(() => {
    if (!canEdit) {
      setDocumentsEditingPersonaId(null);
      setDocumentUploadPersonaId(null);
      return;
    }
    if (!expandedPersonaId) {
      setDocumentsEditingPersonaId(null);
      setDocumentUploadPersonaId(null);
      return;
    }
    if (documentsEditingPersonaId !== expandedPersonaId) {
      setDocumentsEditingPersonaId(expandedPersonaId);
      setDocumentUploadPersonaId(null);
    }
  }, [canEdit, expandedPersonaId, documentsEditingPersonaId]);

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
    setShowDeletePersonaConfirm(false);
    setDeletePersonaError(null);
    setPersonaPendingDelete(null);
    setVoiceSettingsPersona(null);
    setVoiceSettingsSelection(null);
  };

  const handleStartNameInlineEdit = useCallback(
    (persona: PersonaRow) => {
      if (!canEdit) return;
      setNameEditingPersonaId(persona.agent_id);
      setNameDraft(persona.agent_name ?? "");
      setNameInlineError(null);
    },
    [canEdit]
  );

  const handleSaveNameInline = useCallback(
    async (persona: PersonaRow) => {
      if (!canEdit || !nameEditingPersonaId || nameEditingPersonaId !== persona.agent_id) {
        return;
      }
      if (isSavingNameInline) return;

      const trimmed = nameDraft.trim();
      const previous = persona.agent_name ? persona.agent_name.trim() : "";
      if (!trimmed) {
        setNameInlineError("Name cannot be empty.");
        return;
      }
      if (trimmed === previous) {
        setNameInlineError(null);
        setNameEditingPersonaId(null);
        setNameDraft(persona.agent_name ?? "");
        return;
      }

      setIsSavingNameInline(true);
      setNameInlineError(null);

      const { error } = await supabase
        .from("agent_map")
        .update({ agent_name: trimmed })
        .eq("agent_id", persona.agent_id);

      if (error) {
        setNameInlineError("Unable to update name. Please try again.");
        setIsSavingNameInline(false);
        return;
      }

      setPersonas((prev) =>
        prev.map((item) =>
          item.agent_id === persona.agent_id ? { ...item, agent_name: trimmed } : item
        )
      );
      setActivePersona((prev) =>
        prev && prev.agent_id === persona.agent_id ? { ...prev, agent_name: trimmed } : prev
      );

      setIsSavingNameInline(false);
      setNameEditingPersonaId(null);
      setNameDraft(trimmed);
      setNameInlineError(null);
    },
    [
      canEdit,
      nameEditingPersonaId,
      isSavingNameInline,
      nameDraft,
      supabase,
      setPersonas,
      setActivePersona,
      setNameInlineError,
      setIsSavingNameInline,
      setNameEditingPersonaId,
      setNameDraft,
    ]
  );

  const handleNameInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, persona: PersonaRow) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        void handleSaveNameInline(persona);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setNameDraft(persona.agent_name ?? "");
        setNameInlineError(null);
        setNameEditingPersonaId(null);
      }
    },
    [handleSaveNameInline, setNameDraft, setNameInlineError, setNameEditingPersonaId]
  );

  const handleSaveDescriptionEdit = useCallback(
    async (persona: PersonaRow) => {
      if (!canEdit || !descriptionEditingPersonaId || descriptionEditingPersonaId !== persona.agent_id) {
        return;
      }
      if (isSavingDescriptionInline) return;

      const previous = persona.description ?? "";
      if (descriptionDraft === previous) {
        setDescriptionInlineError(null);
        return;
      }

      setIsSavingDescriptionInline(true);
      setDescriptionInlineError(null);

      const { error } = await supabase
        .from("agent_map")
        .update({ description: descriptionDraft })
        .eq("agent_id", persona.agent_id);

      if (error) {
        setDescriptionInlineError("Unable to update description. Please try again.");
        setIsSavingDescriptionInline(false);
        return;
      }

      setPersonas((prev) =>
        prev.map((item) =>
          item.agent_id === persona.agent_id ? { ...item, description: descriptionDraft } : item
        )
      );
      setActivePersona((prev) =>
        prev && prev.agent_id === persona.agent_id ? { ...prev, description: descriptionDraft } : prev
      );

      setIsSavingDescriptionInline(false);
      setDescriptionInlineError(null);
    },
    [canEdit, descriptionDraft, descriptionEditingPersonaId, isSavingDescriptionInline, supabase]
  );

  const persistDescriptionOverlayKeyTraits = useCallback(
    async (agentId: string, nextTraits: string[]) => {
      if (isSavingDescriptionOverlayTraits || !descriptionOverlayPersona) return false;
      setIsSavingDescriptionOverlayTraits(true);
      setDescriptionOverlayTraitsError(null);
      const normalizedTraits = nextTraits
        .map((trait) => trait.trim())
        .filter((trait) => trait.length > 0);
      const { error } = await supabase.from("agent_map").update({ key_traits: normalizedTraits }).eq("agent_id", agentId);
      if (error) {
        setDescriptionOverlayTraitsError("Unable to update key traits. Please try again.");
        setIsSavingDescriptionOverlayTraits(false);
        return false;
      }
      const normalizedString = normalizeTraitsInput(normalizedTraits.join(", "));
      setDescriptionOverlayTraits(normalizedString);
      setPersonas((prev) =>
        prev.map((persona) =>
          persona.agent_id === agentId ? { ...persona, key_traits: normalizedTraits } : persona
        )
      );
      setActivePersona((prev) =>
        prev && prev.agent_id === agentId ? { ...prev, key_traits: normalizedTraits } : prev
      );
      setIsSavingDescriptionOverlayTraits(false);
      return true;
    },
    [descriptionOverlayPersona, isSavingDescriptionOverlayTraits, supabase]
  );

  const handleSaveDescriptionOverlay = useCallback(async () => {
    if (!canEdit || !descriptionOverlayPersona || isSavingDescriptionOverlay) {
      return;
    }
    const previousDescription = descriptionOverlayPersona.description ?? "";
    const previousPainPoints = normalizeListFieldToString(descriptionOverlayPersona.key_pain_points);
    const previousJobs = normalizeListFieldToString(descriptionOverlayPersona.jobs_to_be_done);
    const descriptionChanged =
      descriptionOverlayDraft !== previousDescription ||
      descriptionOverlayPainPoints !== previousPainPoints ||
      descriptionOverlayJobsToBeDone !== previousJobs;
    const keyTraitsChanged = descriptionOverlayHasKeyTraitChanges;

    if (!descriptionChanged && !keyTraitsChanged) {
      setDescriptionOverlayError(null);
      return;
    }

    setSuppressUnsavedChangesBanner(true);
    setIsSavingDescriptionOverlay(true);
    setDescriptionOverlayError(null);

    if (descriptionChanged) {
      const normalizedPainPoints = normalizeCommaSeparatedList(descriptionOverlayPainPoints);
      const normalizedJobs = normalizeCommaSeparatedList(descriptionOverlayJobsToBeDone);
      const payloadPainPoints =
        normalizedPainPoints.length > 0 ? normalizedPainPoints.join("\n") : null;
      const payloadJobs = normalizedJobs.length > 0 ? normalizedJobs.join("\n") : null;

      const { error } = await supabase
        .from("agent_map")
        .update({
          description: descriptionOverlayDraft,
          key_pain_points: payloadPainPoints,
          jobs_to_be_done: payloadJobs,
        })
        .eq("agent_id", descriptionOverlayPersona.agent_id);

      if (error) {
        setDescriptionOverlayError("Unable to update description. Please try again.");
        setIsSavingDescriptionOverlay(false);
        return;
      }

      setPersonas((prev) =>
        prev.map((item) =>
          item.agent_id === descriptionOverlayPersona.agent_id
            ? {
                ...item,
                description: descriptionOverlayDraft,
                key_pain_points: payloadPainPoints,
                jobs_to_be_done: payloadJobs,
              }
            : item
        )
      );
      setActivePersona((prev) =>
        prev && prev.agent_id === descriptionOverlayPersona.agent_id
          ? {
              ...prev,
              description: descriptionOverlayDraft,
              key_pain_points: payloadPainPoints,
              jobs_to_be_done: payloadJobs,
            }
          : prev
      );
    }

    if (keyTraitsChanged) {
      const success = await persistDescriptionOverlayKeyTraits(
        descriptionOverlayPersona.agent_id,
        descriptionOverlayTraitList
      );
      if (!success) {
        setIsSavingDescriptionOverlay(false);
        return;
      }
    }

    setDescriptionOverlayError(null);
    setSuppressUnsavedChangesBanner(false);
    setIsSavingDescriptionOverlay(false);
  }, [
    canEdit,
    descriptionOverlayPersona,
    descriptionOverlayDraft,
    descriptionOverlayPainPoints,
    descriptionOverlayJobsToBeDone,
    descriptionOverlayHasKeyTraitChanges,
    descriptionOverlayTraitList,
    isSavingDescriptionOverlay,
    persistDescriptionOverlayKeyTraits,
    setActivePersona,
    setDescriptionOverlayError,
    setPersonas,
    supabase,
  ]);
const handleConfirmDeletePersona = useCallback(async () => {
    if (!personaPendingDelete || !canEdit) return;
    const agentId = personaPendingDelete.agent_id;
    setIsDeletingPersona(true);
    setDeletePersonaError(null);
    try {
      const { error: deleteDocsError } = await supabase
        .from("agent_documents")
        .delete()
        .eq("agent_id", agentId);
      if (deleteDocsError) {
        throw deleteDocsError;
      }

      const { error: deleteAgentError } = await supabase
        .from("agent_map")
        .delete()
        .eq("agent_id", agentId);
      if (deleteAgentError) {
        throw deleteAgentError;
      }

      setPersonas((previous) => previous.filter((persona) => persona.agent_id !== agentId));
      setPersonaDocuments((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      setPersonaExternalAddedArticles((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      setPersonaExternalUpdatedAt((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      setPersonaExternalKnowledgeText((previous) => {
        const next = { ...previous };
        delete next[agentId];
        return next;
      });
      setExpandedPersonaId((previous) => (previous === agentId ? null : previous));
      const shouldClosePersonaModal = Boolean(activePersona && activePersona.agent_id === agentId);
      if (shouldClosePersonaModal) {
        handleClosePersona();
      } else {
        setShowDeletePersonaConfirm(false);
      }
      setPersonaActionsModalPersona((current) =>
        current && current.agent_id === agentId ? null : current
      );
      setPersonaActionsModalView("options");
      setPersonaPendingDelete(null);
    } catch (error) {
      console.error("[personas] Failed to delete persona", error);
      setDeletePersonaError("Unable to delete this persona right now. Please try again.");
    } finally {
      setIsDeletingPersona(false);
    }
  }, [
    activePersona,
    canEdit,
    handleClosePersona,
    personaPendingDelete,
    setPersonaActionsModalPersona,
    setPersonaActionsModalView,
    setPersonaPendingDelete,
    setExpandedPersonaId,
    setPersonaDocuments,
        setPersonaExternalAddedArticles,
    setPersonaExternalKnowledgeText,
    setPersonaExternalUpdatedAt,
    setPersonas,
    setShowDeletePersonaConfirm,
    setDeletePersonaError,
    supabase,
  ]);

  const handleOpenPersonaActionsModal = useCallback(
    (persona: PersonaRow) => {
      setPersonaPendingDelete(null);
      setPersonaActionsModalView("options");
      setDeletePersonaError(null);
      setPersonaActionsModalPersona(persona);
    },
    []
  );

  const handleClosePersonaActionsModal = useCallback(() => {
    setPersonaActionsModalPersona(null);
    setPersonaActionsModalView("options");
    setPersonaPendingDelete(null);
    setDeletePersonaError(null);
  }, []);

  const handlePersonaActionsOptionSelect = useCallback(
    (option: PersonaActionsOptionKey) => {
      if (!personaActionsModalPersona) return;
      if (option === "delete") {
        setPersonaPendingDelete(personaActionsModalPersona);
        setPersonaActionsModalView("confirm-delete");
        return;
      }
      if (option === "share") {
        void copyPersonaShareHref(personaActionsModalPersona);
        return;
      }
      setPersonaActionsModalPersona(null);
      setPersonaActionsModalView("options");
    },
    [personaActionsModalPersona, copyPersonaShareHref]
  );

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
      const initialTraitsList = Array.isArray(activePersona.key_traits)
        ? activePersona.key_traits
            .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
            .filter((trait) => trait.length > 0)
        : [];
      const normalizedInitialTraits = normalizeTraitsInput(initialTraitsList.join(", "));
      setEditingTraits(normalizedInitialTraits);
      setScalarTraitsEditingPersonaId(activePersona.agent_id);
      const nextScalarTraits = createScalarTraitValues({
        age: readScalarTraitValue(activePersona, "age"),
        gender: readScalarTraitValue(activePersona, "gender"),
        location: readScalarTraitValue(activePersona, "location"),
        customer_status: readScalarTraitValue(activePersona, "customer_status"),
      });
      setScalarTraitValues((prev) =>
        areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
      );
      setScalarTraitBaseline((prev) =>
        areScalarTraitRecordsEqual(prev, nextScalarTraits) ? prev : nextScalarTraits
      );
      ensureDefaultScalarTraitMeta();
      setDocumentsActionError(null);
      setIsUploadingDocument(false);
      setIsSavingDocuments(false);
    } else {
      setEditingName("");
      setEditingDescription("");
      setTraitsError(null);
      setIsSavingTraits(false);
      setEditingTraits("");
      if (!scalarTraitsEditingPersonaId) {
        setScalarTraitValues((prev) =>
          areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
            ? prev
            : createScalarTraitValues()
        );
        setScalarTraitBaseline((prev) =>
          areScalarTraitRecordsEqual(prev, EMPTY_SCALAR_TRAIT_VALUES)
            ? prev
            : createScalarTraitValues()
        );
        ensureDefaultScalarTraitMeta();
      }
      setDocumentsActionError(null);
      setIsUploadingDocument(false);
      setIsSavingDocuments(false);
    }
  }, [activePersona, scalarTraitsEditingPersonaId, ensureDefaultScalarTraitMeta]);

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

  const persistPersonaKeyTraits = useCallback(
    async (agentId: string, nextTraits: string[]) => {
      if (isSavingTraits) return false;
      setIsSavingTraits(true);
      setTraitsError(null);
      const normalizedTraits = nextTraits
        .map((trait) => trait.trim())
        .filter((trait) => trait.length > 0);
      const { error } = await supabase.from("agent_map").update({ key_traits: normalizedTraits }).eq("agent_id", agentId);
      if (error) {
        setTraitsError("Unable to update key traits. Please try again.");
        setIsSavingTraits(false);
        return false;
      }
      const normalizedString = normalizeTraitsInput(normalizedTraits.join(", "));
      setEditingTraits(normalizedString);
      setActivePersona((prev) =>
        prev && prev.agent_id === agentId ? { ...prev, key_traits: normalizedTraits } : prev
      );
      setPersonas((prev) =>
        prev.map((persona) => (persona.agent_id === agentId ? { ...persona, key_traits: normalizedTraits } : persona))
      );
      setIsSavingTraits(false);
      return true;
    },
    [isSavingTraits, supabase]
  );

  const handleStartChipEdit = useCallback((index: number, trait: string) => {
    setChipEditingIndex(index);
    setChipEditingValue(trait);
    setChipEditDirty(true);
  }, []);

  const handleCancelChipEdit = useCallback(() => {
    setChipEditingIndex(null);
    setChipEditingValue("");
    setChipEditDirty(false);
  }, []);

  const handleChipDelete = useCallback(
    (index: number) => {
      const traits = chipTraitsList;
      if (index < 0 || index >= traits.length) return;
      const nextTraits = [...traits];
      nextTraits.splice(index, 1);
      const nextString = normalizeTraitsInput(nextTraits.join(", "));
      setEditingTraits(nextString);
      setChipEditDirty(true);
    },
    [chipTraitsList]
  );

  const handleChipEditCommit = useCallback(async () => {
    if (
      chipEditingIndex === null ||
      chipEditingIndex < 0 ||
      !activePersona ||
      !activePersona.agent_id
    ) {
      handleCancelChipEdit();
      return;
    }
    const currentTraits = Array.isArray(activePersona.key_traits)
      ? activePersona.key_traits.map((trait) => trait.trim())
      : [];
    const nextTraits = [...currentTraits];
    const trimmedValue = chipEditingValue.trim();
    if (trimmedValue.length === 0) {
      nextTraits.splice(chipEditingIndex, 1);
    } else if (chipEditingIndex < nextTraits.length) {
      nextTraits[chipEditingIndex] = trimmedValue;
    } else {
      nextTraits[chipEditingIndex] = trimmedValue;
    }
    await persistPersonaKeyTraits(activePersona.agent_id, nextTraits);
    handleCancelChipEdit();
  }, [activePersona, chipEditingIndex, chipEditingValue, handleCancelChipEdit, persistPersonaKeyTraits]);

  const handleAddKeyTrait = useCallback(() => {
    setChipEditingIndex(chipTraitsList.length);
    setChipEditingValue("");
    setChipEditDirty(true);
  }, [chipTraitsList.length]);

  const handleDescriptionOverlayStartEdit = useCallback((index: number, trait: string) => {
    setDescriptionOverlayChipEditingIndex(index);
    setDescriptionOverlayChipEditingValue(trait);
  }, []);

  const handleDescriptionOverlayCancelEdit = useCallback(() => {
    setDescriptionOverlayChipEditingIndex(null);
    setDescriptionOverlayChipEditingValue("");
  }, []);

  const handleDescriptionOverlayDelete = useCallback(
    (index: number) => {
      const traits = descriptionOverlayTraitList;
      if (index < 0 || index >= traits.length) return;
      const nextTraits = [...traits];
      nextTraits.splice(index, 1);
      const nextString = normalizeTraitsInput(nextTraits.join(", "));
      setDescriptionOverlayTraits(nextString);
      setDescriptionOverlayChipEditingIndex(null);
      setDescriptionOverlayChipEditingValue("");
    },
    [descriptionOverlayTraitList]
  );

  const handleDescriptionOverlayAddTrait = useCallback(() => {
    setDescriptionOverlayChipEditingIndex(descriptionOverlayTraitList.length);
    setDescriptionOverlayChipEditingValue("");
  }, [descriptionOverlayTraitList.length]);

  const handleDescriptionOverlayChipCommit = useCallback(async () => {
    if (
      descriptionOverlayChipEditingIndex === null ||
      descriptionOverlayChipEditingIndex < 0 ||
      !descriptionOverlayPersona ||
      !descriptionOverlayPersona.agent_id
    ) {
      handleDescriptionOverlayCancelEdit();
      return;
    }
    const currentTraits = Array.isArray(descriptionOverlayPersona.key_traits)
      ? descriptionOverlayPersona.key_traits.map((trait) => trait.trim())
      : [];
    const nextTraits = [...currentTraits];
    const trimmedValue = descriptionOverlayChipEditingValue.trim();
    if (trimmedValue.length === 0) {
      if (descriptionOverlayChipEditingIndex < nextTraits.length) {
        nextTraits.splice(descriptionOverlayChipEditingIndex, 1);
      }
    } else if (descriptionOverlayChipEditingIndex < nextTraits.length) {
      nextTraits[descriptionOverlayChipEditingIndex] = trimmedValue;
    } else {
      nextTraits[descriptionOverlayChipEditingIndex] = trimmedValue;
    }
    setDescriptionOverlayTraits(normalizeTraitsInput(nextTraits.join(", ")));
    handleDescriptionOverlayCancelEdit();
  }, [
    descriptionOverlayChipEditingIndex,
    descriptionOverlayChipEditingValue,
    descriptionOverlayPersona,
    handleDescriptionOverlayCancelEdit,
    persistDescriptionOverlayKeyTraits,
  ]);

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
    await persistPersonaKeyTraits(currentAgentId, nextTraits);
  }, [activePersona, baselineKeyTraitsNormalized, editingTraits, isSavingTraits]);

  const handleClearKeyTraits = useCallback(() => {
    if (!activePersona) return;
    setEditingTraits(baselineKeyTraitsNormalized);
    setTraitsError(null);
  }, [activePersona, baselineKeyTraitsNormalized]);

  const commitScalarTrait = useCallback(
    async (traitKey: PersonaScalarTraitKey) => {
      const persona = scalarTraitsSourcePersona;
      if (!persona || scalarTraitSaving[traitKey]) return;

      const currentAgentId = persona.agent_id;
      const rawValue = scalarTraitValues[traitKey] ?? "";
      const trimmedValue = rawValue.trim();
      const previousRaw = persona[traitKey];
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
        setScalarTraitValues((prev) => {
          if (prev[traitKey] === previousString) {
            return prev;
          }
          return { ...prev, [traitKey]: previousString };
        });
        setScalarTraitSaving((prev) => ({ ...prev, [traitKey]: false }));
        return;
      }

      const nextDisplayValue = trimmedValue.length > 0 ? trimmedValue : "";
      setScalarTraitValues((prev) => {
        if (prev[traitKey] === nextDisplayValue) {
          return prev;
        }
        return { ...prev, [traitKey]: nextDisplayValue };
      });
      setScalarTraitBaseline((prev) => {
        if (prev[traitKey] === nextDisplayValue) {
          return prev;
        }
        return { ...prev, [traitKey]: nextDisplayValue };
      });
      setScalarTraitSaving((prev) => ({ ...prev, [traitKey]: false }));
      setScalarTraitErrors((prev) => ({ ...prev, [traitKey]: null }));
      setActivePersona((prev) =>
        prev && prev.agent_id === currentAgentId ? { ...prev, [traitKey]: payloadValue } : prev
      );
      setPersonas((prev) =>
        prev.map((persona) =>
          persona.agent_id === currentAgentId
            ? { ...persona, [traitKey]: payloadValue }
            : persona
        )
      );
    },
    [scalarTraitsSourcePersona, scalarTraitSaving, scalarTraitValues]
  );

  const commitUnsavedScalarTraits = useCallback(async () => {
    const persona = scalarTraitsSourcePersona;
    if (!persona) return;
    const keysToCommit = SCALAR_TRAIT_KEYS.filter((key) => {
      const baselineValue = baselineScalarTraits[key];
      const currentValue = (scalarTraitValues[key] ?? "").trim();
      return currentValue !== baselineValue;
    });
    if (keysToCommit.length === 0) return;
    for (const key of keysToCommit) {
      await commitScalarTrait(key);
    }
  }, [scalarTraitsSourcePersona, baselineScalarTraits, scalarTraitValues, commitScalarTrait]);

  // Persist any staged avatar uploads to Supabase storage and agent_map.
  const commitAvatarDrafts = useCallback(async () => {
    if (!canEdit) return;
    const entries = Object.entries(avatarDrafts);
    if (entries.length === 0) return;

    const storageClientSlug = resolvedClientSlug ?? clientSlug ?? null;
    if (!storageClientSlug) {
      setAvatarInlineErrors((prev) => {
        const next = { ...prev };
        entries.forEach(([personaId]) => {
          next[personaId] = "Missing workspace context. Please refresh and try again.";
        });
        return next;
      });
      return;
    }

    setIsSavingAvatar(true);
    try {
      for (const [personaId, draft] of entries) {
        if (!draft?.file) {
          setAvatarInlineErrors((prev) => ({
            ...prev,
            [personaId]: "Selected image is no longer available. Please choose a new file.",
          }));
          setAvatarDrafts((prev) => {
            const next = { ...prev };
            delete next[personaId];
            return next;
          });
          continue;
        }

        try {
          const file = draft.file;
          const uniqueName = `${uuidv4()}-${file.name}`;
          const storagePath = `clients/${storageClientSlug}/${personaId}/${uniqueName}`;
          const { error: uploadError } = await supabase.storage
            .from(PERSONA_IMAGES_BUCKET)
            .upload(storagePath, file, {
              upsert: true,
              contentType: file.type || undefined,
            });
          if (uploadError) {
            throw new Error(uploadError.message);
          }

          const { data: publicUrlData } = await supabase.storage
            .from(PERSONA_IMAGES_BUCKET)
            .getPublicUrl(storagePath);
          const publicUrl =
            (publicUrlData as any)?.publicUrl ??
            (publicUrlData as any)?.publicURL ??
            buildStoragePublicUrl(PERSONA_IMAGES_BUCKET, storagePath);

          const { error: updateError } = await supabase
            .from("agent_map")
            .update({ profile_image: publicUrl })
            .eq("agent_id", personaId);
          if (updateError) {
            throw new Error(updateError.message ?? "Unable to save image.");
          }

          setPersonas((prev) =>
            prev.map((persona) =>
              persona.agent_id === personaId ? { ...persona, profile_image: publicUrl } : persona
            )
          );
          setActivePersona((prev) =>
            prev && prev.agent_id === personaId ? { ...prev, profile_image: publicUrl } : prev
          );
          revokeAvatarObjectUrl(draft.previewUrl);
          setAvatarDrafts((prev) => {
            const next = { ...prev };
            delete next[personaId];
            return next;
          });
          setAvatarInlineErrors((prev) => {
            if (prev[personaId] == null) {
              return prev;
            }
            const next = { ...prev };
            delete next[personaId];
            return next;
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : "Unable to save image. Please try again.";
          setAvatarInlineErrors((prev) => ({
            ...prev,
            [personaId]: message,
          }));
        }
      }
    } finally {
      setIsSavingAvatar(false);
    }
  }, [
    canEdit,
    avatarDrafts,
    resolvedClientSlug,
    clientSlug,
    setAvatarInlineErrors,
    setAvatarDrafts,
    supabase,
    setPersonas,
    setActivePersona,
    revokeAvatarObjectUrl,
  ]);

  const handleDataSourceUploadClick = useCallback(
    (personaId?: string) => {
      if (!canEdit || isUploadingDocument || isSavingDocuments) return;
      const targetPersonaId = personaId ?? activePersona?.agent_id ?? null;
      if (!targetPersonaId) {
        setDocumentsActionError("Select a persona before uploading a document.");
        return;
      }
      setDocumentUploadPersonaId(targetPersonaId);
      dataSourceInputRef.current?.click();
    },
    [activePersona, canEdit, isUploadingDocument, isSavingDocuments]
  );

  const handleDataSourceUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      event.target.value = "";
      const personaId = documentUploadPersonaId ?? activePersona?.agent_id ?? null;
      setDocumentUploadPersonaId(null);
      if (!personaId) {
        setDocumentsActionError("Unable to determine which persona to update.");
        return;
      }
      if (!canEdit) {
        setDocumentsActionError("You do not have permission to add documents.");
        return;
      }
      if (!clientSlug) {
        setDocumentsActionError("Missing workspace context.");
        return;
      }

      setIsUploadingDocument(true);
      setIsSavingDocuments(true);
      setDocumentsActionError(null);

      try {
        const uniqueName = `${uuidv4()}-${file.name}`;
        const storagePath = `clients/${clientSlug}/${personaId}/${uniqueName}`;
        const { error: uploadError } = await supabase.storage
          .from("docs")
          .upload(storagePath, file, { upsert: true });
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
            agent_id: personaId,
            file_name: file.name,
            storage_path: storagePath,
            public_url: publicUrl,
            document_url: null,
            document_id: null,
            mime_type: file.type || null,
            file_size: file.size,
            source: "storage",
            added_stage: "persona-edit",
          })
          .select()
          .single<AgentDocumentRow>();

        if (insertError || !insertedDoc) {
          throw new Error(insertError?.message ?? "Unable to save document.");
        }

        setPersonaDocuments((prev) => {
          const existing = prev[personaId] ?? [];
          const next = [insertedDoc, ...existing];
          return {
            ...prev,
            [personaId]: next,
          };
        });
        setDocumentsActionError(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to upload document. Please try again.";
        setDocumentsActionError(message);
      } finally {
        setIsUploadingDocument(false);
        setIsSavingDocuments(false);
      }
    },
    [
      activePersona,
      canEdit,
      clientSlug,
      documentUploadPersonaId,
      supabase,
      setPersonaDocuments,
    ]
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

  const [suppressUnsavedChangesBanner, setSuppressUnsavedChangesBanner] = useState(false);

  const hasAnyUnsavedChanges =
    hasUnsavedName ||
    hasUnsavedNameInline ||
    hasUnsavedDescription ||
    hasUnsavedDescriptionInline ||
    hasUnsavedKeyTraits ||
    hasUnsavedKeyTraitEdits ||
    hasUnsavedScalarTraits ||
    hasUnsavedAvatarDraft;
  const showUnsavedChangesBanner =
    canEdit && hasAnyUnsavedChanges && !suppressUnsavedChangesBanner;

  useEffect(() => {
    if (!hasAnyUnsavedChanges) {
      setSuppressUnsavedChangesBanner(false);
    }
  }, [hasAnyUnsavedChanges]);
  const handleClearUnsavedChanges = useCallback(() => {
    if (hasUnsavedAvatarDraft) {
      clearAvatarDrafts();
    }
    if (hasUnsavedName) {
      handleClearPersonaName();
    }
    if (hasUnsavedNameInline) {
      if (nameEditingPersonaId) {
        const persona = personas.find((item) => item.agent_id === nameEditingPersonaId);
        const baseline = persona?.agent_name ?? "";
        setNameDraft(baseline);
      } else {
        setNameDraft("");
      }
      setNameInlineError(null);
    }
    if (hasUnsavedDescription) {
      handleClearPersonaDescription();
    }
    if (hasUnsavedDescriptionInline) {
      if (descriptionEditingPersonaId) {
        const persona = personas.find((item) => item.agent_id === descriptionEditingPersonaId);
        const baseline = persona?.description ?? "";
        setDescriptionDraft(baseline);
      } else {
        setDescriptionDraft("");
      }
      setDescriptionInlineError(null);
    }
    if (hasUnsavedKeyTraits || hasUnsavedKeyTraitEdits) {
      handleClearKeyTraits();
      setChipEditDirty(false);
      handleCancelChipEdit();
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
  }, [
    hasUnsavedName,
    handleClearPersonaName,
    hasUnsavedNameInline,
    nameEditingPersonaId,
    personas,
    setNameDraft,
    setNameInlineError,
    hasUnsavedDescription,
    handleClearPersonaDescription,
    hasUnsavedDescriptionInline,
    descriptionEditingPersonaId,
    hasUnsavedKeyTraitEdits,
    handleClearKeyTraits,
    hasUnsavedScalarTraits,
    baselineScalarTraits,
    hasUnsavedAvatarDraft,
    clearAvatarDrafts,
  ]);
  const handleSaveUnsavedChanges = useCallback(async () => {
    if (!hasAnyUnsavedChanges) return;
    if (hasUnsavedName) {
      await commitPersonaName();
    }
    if (hasUnsavedNameInline && nameEditingPersonaId) {
      const persona = personas.find((item) => item.agent_id === nameEditingPersonaId);
      if (persona) {
        await handleSaveNameInline(persona);
      }
    }
    if (hasUnsavedDescription) {
      await commitPersonaDescription();
    }
    if (hasUnsavedDescriptionInline && descriptionEditingPersonaId) {
      const persona = personas.find((item) => item.agent_id === descriptionEditingPersonaId);
      if (persona) {
        await handleSaveDescriptionEdit(persona);
      }
    }
    if (hasUnsavedKeyTraitEdits) {
      await handleChipEditCommit();
    }
    if (hasUnsavedKeyTraits) {
      await commitPersonaTraits();
    }
    if (hasUnsavedScalarTraits) {
      await commitUnsavedScalarTraits();
    }
    if (hasUnsavedAvatarDraft) {
      await commitAvatarDrafts();
    }
  }, [
    hasAnyUnsavedChanges,
    hasUnsavedName,
    commitPersonaName,
    hasUnsavedNameInline,
    nameEditingPersonaId,
    personas,
    handleSaveNameInline,
    hasUnsavedDescription,
    commitPersonaDescription,
    hasUnsavedDescriptionInline,
    descriptionEditingPersonaId,
    handleSaveDescriptionEdit,
    hasUnsavedKeyTraitEdits,
    handleChipEditCommit,
    hasUnsavedKeyTraits,
    commitPersonaTraits,
    hasUnsavedScalarTraits,
    commitUnsavedScalarTraits,
    hasUnsavedAvatarDraft,
    commitAvatarDrafts,
  ]);
  const isSavingScalarTraits = useMemo(
    () => Object.values(scalarTraitSaving).some(Boolean),
    [scalarTraitSaving]
  );
  const isSavingAny =
    isSavingName ||
    isSavingNameInline ||
    isSavingDescription ||
  isSavingDescriptionInline ||
  isSavingTraits ||
  isSavingScalarTraits ||
  isSavingAvatar ||
    isSavingDocuments;

  const showEmptyState = !loading && !error && personas.length === 0;

  const unsavedChangesBanner = showUnsavedChangesBanner ? (
    <div
      className="persona-unsaved-banner persona-unsaved-banner--visible"
      role="alert"
      aria-live="polite"
      aria-hidden="false"
    >
      <span
        className="persona-unsaved-message"
                style={{ fontFamily: HEADING_FONT_STACK, background: "rgba(248, 250, 252, 0.92)" }}
      >
        You have unsaved changes
      </span>
      <div className="persona-unsaved-actions">
        <button
          type="button"
          className="persona-unsaved-clear"
          onClick={handleClearUnsavedChanges}
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
  ) : null;

  return (
    <>
      <input
        ref={avatarUploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarUploadChange}
      />
      <input
        ref={dataSourceInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xlsx,.csv,.txt"
        style={{ display: "none" }}
        onChange={handleDataSourceUploadChange}
      />
      <div
        className="personas-stage"
        style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
      >
      <Topbar
          title="Personas"
          offsetLeft="var(--stage-topbar-offset, 0px)"
          hideCadenceControls
          hideProfileAvatar
          centerSlot={
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Link
                href={personasViewHref}
                prefetch={false}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  background: "#1e293b",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: HEADING_FONT_STACK,
                  textDecoration: "none",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.7)";
                  event.currentTarget.style.background = "#15203b";
                  event.currentTarget.style.boxShadow = "0 12px 26px rgba(15, 23, 42, 0.3)";
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
                  event.currentTarget.style.background = "#1e293b";
                  event.currentTarget.style.boxShadow = "none";
                  event.currentTarget.style.transform = "none";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.7)";
                  event.currentTarget.style.background = "#15203b";
                  event.currentTarget.style.boxShadow = "0 12px 26px rgba(15, 23, 42, 0.3)";
                  event.currentTarget.style.transform = "translateY(-1px)";
                  event.currentTarget.style.outline = "none";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.4)";
                  event.currentTarget.style.background = "#1e293b";
                  event.currentTarget.style.boxShadow = "none";
                  event.currentTarget.style.transform = "none";
                }}
              >
                Talk to Personas
              </Link>
              <button
                type="button"
                aria-label="Copy personas link"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  color: "#1a2a44",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, color 0.2s ease",
                }}
                onClick={handleCopyPersonasViewHref}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = "#0b1526";
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = "#1a2a44";
                  event.currentTarget.style.transform = "none";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.color = "#0b1526";
                  event.currentTarget.style.transform = "translateY(-1px)";
                  event.currentTarget.style.outline = "none";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.color = "#1a2a44";
                  event.currentTarget.style.transform = "none";
                }}
              >
                <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 0 }}>
                  {personasViewLinkCopied ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      width={22}
                      height={22}
                      fill="#1a2a44"
                      aria-hidden="true"
                    >
                      <path d="M9.5 0a.5.5 0 0 1 .5.5.5.5 0 0 0 .5.5.5.5 0 0 1 .5.5V2a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 5 2v-.5a.5.5 0 0 1 .5-.5.5.5 0 0 0 .5-.5.5.5 0 0 1 .5-.5z" />
                      <path d="M3 2.5a.5.5 0 0 1 .5-.5H4a.5.5 0 0 0 0-1h-.5A1.5 1.5 0 0 0 2 2.5v12A1.5 1.5 0 0 0 3.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 12.5 1H12a.5.5 0 0 0 0 1h.5a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5z" />
                      <path d="M10.854 7.854a.5.5 0 0 0-.708-.708L7.5 9.793 6.354 8.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      width={18}
                      height={18}
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                      />
                    </svg>
                  )}
                </span>
              </button>
            </div>
          }
          rightSlot={
            <div className="personas-topbar-actions">
              {clientSlug && canEdit ? (
                <StageButton
                  type="button"
                  variant="primary"
                  onClick={() => router.push(`/client/${clientSlug}/upload`)}
                  className="personas-new-button"
                  style={{ fontFamily: HEADING_FONT_STACK }}
                >
                  <span className="stage-button__icon" aria-hidden="true">
                    +
                  </span>
                  <span>New persona</span>
                </StageButton>
              ) : null}
            </div>
          }
        />
        {showEmptyState ? (
          <div className="personas-empty-overlay" aria-hidden="true" />
        ) : null}
        <main
          className="stage-layout persona-root"
          data-expanded={expandedPersonaId ? "true" : "false"}
        >
          <aside className="stage-layout__sidebar">
            <Sidebar />
          </aside>

          {showEmptyState ? (
            <div
              ref={contentContainerRef}
              className="personas-empty personas-empty-full"
            >
              <div className="personas-empty-shell">
                <div className="personas-empty-card">
                  <h1 className="personas-empty-heading">Let's create your first persona</h1>
                  <div className="personas-empty-video">
                    <iframe
                      src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                      title="Persona creation demo"
                      aria-label="Demo video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <StageButton
                    type="button"
                    variant="primary"
                    className="personas-empty-button"
                    onClick={handleCreateFirstPersona}
                  >
                    Create first persona
                  </StageButton>
                </div>
              </div>
            </div>
          ) : (
            <div ref={contentContainerRef} className="stage-layout__content">
              <div className="stage-shell">
                <StagePanel>
                <section className="personas-section">
                  <div ref={personasGridScrollRef} className="personas-grid-scroll">
                    <div className="personas-grid">
            {loading && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  color: "#1e293b",
                  fontSize: 14,
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
            {!loading &&
              !error &&
              personas.map((persona, index) => {
                const rawIsExpanded = expandedPersonaId === persona.agent_id;
                const gridPosition = personaGridPositions[index];
                const normalizedStatus = (persona.status ?? "").toLowerCase();
                const isReady = normalizedStatus === "ready";
                const statusDisplayRaw =
                  persona.status && persona.status.trim().length > 0 ? persona.status : "processing";
                const statusDisplay = statusDisplayRaw.replace(/_/g, " ");
                const statusText = statusDisplay.charAt(0).toUpperCase() + statusDisplay.slice(1);
                const isExpanded = isReady && rawIsExpanded;
                const cardButtonStyle: React.CSSProperties = {};
                if (gridPosition?.gridColumn) {
                  cardButtonStyle.gridColumn = gridPosition.gridColumn;
                }
                if (gridPosition?.gridRow) {
                  cardButtonStyle.gridRow = gridPosition.gridRow;
                }
                if (!isReady) {
                  cardButtonStyle.cursor = "not-allowed";
                }
                const traitChips = buildPersonaTraits(persona);
                const keyTraits = Array.isArray(persona.key_traits)
                  ? persona.key_traits
                      .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
                      .filter((trait): trait is string => trait.length > 0)
                  : [];
                const isChipRowExpanded = chipRowsExpanded[persona.agent_id] ?? false;
                const avatarDraft = avatarDrafts[persona.agent_id];
                const personaProfileImage = resolvePersonaProfileImageUrl(persona.profile_image);
                const profileImageUrl = avatarDraft?.previewUrl ?? personaProfileImage;
                const placeholderImageUrl = !profileImageUrl && personaProfileImage ? personaProfileImage : null;
                const placeholderHasImage = Boolean(placeholderImageUrl);
                const personaInitial = buildPersonaInitial(persona.agent_name);
                const avatarInlineError = avatarInlineErrors[persona.agent_id] ?? null;
                const profileImageAlt = `${persona.agent_name ?? "Persona"} profile image`;
                const roleTitle =
                  typeof persona.role_title === "string" && persona.role_title.trim().length > 0
                    ? persona.role_title.trim()
                    : null;
                const documents = (personaDocuments[persona.agent_id] ?? [])
                  .slice()
                  .sort((a, b) => {
                    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return bTime - aTime;
                  });
                const documentsUpdatedAt = (() => {
                  let latest: string | null = null;
                  documents.forEach((doc) => {
                    if (doc.created_at) {
                      if (!latest) {
                        latest = doc.created_at;
                      } else if (new Date(doc.created_at).getTime() > new Date(latest).getTime()) {
                        latest = doc.created_at;
                      }
                    }
                  });
                  return latest;
                })();
                const externalArticles = personaExternalAddedArticles[persona.agent_id] ?? [];
                const externalKnowledgeText = personaExternalKnowledgeText[persona.agent_id] ?? null;
                const externalUpdatedAt = personaExternalUpdatedAt[persona.agent_id] ?? null;
                const externalUpdatedRelative = externalUpdatedAt ? formatRelativeTime(externalUpdatedAt) : null;
                const hasDescription =
                  typeof persona.description === "string" && persona.description.trim().length > 0;
                const descriptionText = hasDescription
                  ? persona.description
                  : "No description has been added yet.";
                const isDescriptionEditing = descriptionEditingPersonaId === persona.agent_id;
                const isNameEditing = nameEditingPersonaId === persona.agent_id;
                const personaTitleClasses = ["persona-card__title"];
                if (canEdit && isExpanded && !isNameEditing) {
                  personaTitleClasses.push("persona-card__title--editable");
                }
                const hasProfileImage =
                  typeof persona.profile_image === "string" && persona.profile_image.trim().length > 0;
                const hasName = typeof persona.agent_name === "string" && persona.agent_name.trim().length > 0;
                const hasRole = typeof persona.role_title === "string" && persona.role_title.trim().length > 0;
                const hasInternalSources = documents.length > 0;
                const hasExternalSources =
                  externalArticles.length > 0 || (externalKnowledgeText && externalKnowledgeText.length > 0);
                const isDocumentsEditing = canEdit && documentsEditingPersonaId === persona.agent_id;
                const isScalarTraitsEditing = canEdit && scalarTraitsEditingPersonaId === persona.agent_id;
                const completedSlots = [
                  hasProfileImage,
                  hasName,
                  hasRole,
                  hasDescription,
                  hasInternalSources,
                  hasExternalSources,
                ].reduce((acc, item) => acc + (item ? 1 : 0), 0);
                const painPointsList = (() => {
                  const source = persona.key_pain_points;
                  if (!source) return [] as string[];
                  if (Array.isArray(source)) {
                    return source.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
                  }
                  if (typeof source === "string") {
                    return source
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                  }
                  return [] as string[];
                })();
                const jobsToBeDoneList = (() => {
                  const source = persona.jobs_to_be_done;
                  if (!source) return [] as string[];
                  if (Array.isArray(source)) {
                    return source.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
                  }
                  if (typeof source === "string") {
                    return source
                      .split(",")
                      .map((item) => item.trim())
                      .filter((item) => item.length > 0);
                  }
                  return [] as string[];
                })();
                const completionPercent = Math.round(
                  (completedSlots / PERSONA_COMPLETION_TOTAL_SLOTS) * 100
                );
                const completionVariant =
                  completionPercent >= 90 ? "complete" : completionPercent >= 50 ? "warning" : "danger";
                const personaSlug = personaSlugLookup.get(persona.agent_id) ?? null;
                const targetClientSlug = resolvedClientId ?? resolvedClientSlug ?? clientSlug ?? "";
                const personaResearchRecord =
                  agentResearch.find((record) => record.agentId === persona.agent_id) ?? null;
                const canEditAvatar = canEdit && isExpanded;
                const isClockEnabled =
                  personaClockStates[persona.agent_id] ?? !!persona.active_status;
                const statusLabel = isClockEnabled ? "Active" : "Inactive";
                const statusColor = isClockEnabled ? "#13cd67" : "#475569";
                return (
                  <div
                    key={persona.agent_id}
                    role="button"
                    tabIndex={isReady ? 0 : undefined}
                    className="persona-card-button"
                    onClick={() => {
                      if (!isReady) return;
                      handleTogglePersonaCard(persona);
                    }}
                    onKeyDown={(event) => {
                      if (!isReady) return;
                      handlePersonaCardKeyDown(event, persona);
                    }}
                    aria-expanded={isReady ? isExpanded : undefined}
                    aria-disabled={!isReady}
                    title={!isReady ? `${statusText}. Persona setup in progress.` : undefined}
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
                      {profileImageUrl && !isExpanded ? (
                        <div className="persona-card__avatar-floating">
                          <img
                            src={profileImageUrl}
                            alt={profileImageAlt}
                            className="persona-card__avatar"
                          />
                        </div>
                      ) : null}
                      <div className="persona-card__body">
                        <div className="persona-card__title-row">
                          <div
                            className={`persona-card__title-left${isExpanded ? " persona-card__title-left--expanded" : ""}`}
                          >
                            <div className="persona-card__title-main">
                              <div className="persona-card__title-top">
                                {isExpanded ? (
                                  <div className="persona-card__avatar-stack">
                                    <button
                                      type="button"
                                      className={`persona-card__avatar-inline${canEditAvatar ? "" : " persona-card__avatar-inline--disabled"}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (!canEditAvatar) return;
                                        startAvatarUpload(persona);
                                      }}
                                      onKeyDown={(event) => event.stopPropagation()}
                                      onFocus={(event) => event.stopPropagation()}
                                      disabled={!canEditAvatar}
                                      aria-label={canEditAvatar ? "Upload persona image" : undefined}
                                      data-has-image={profileImageUrl ? "true" : "false"}
                                    >
                                      {profileImageUrl ? (
                                        <img
                                          src={profileImageUrl}
                                          alt={profileImageAlt}
                                          className="persona-card__avatar"
                                        />
                                      ) : (
                                        <span
                                          className={`persona-card__avatar-placeholder${
                                            placeholderHasImage ? " persona-card__avatar-placeholder--image" : ""
                                          }`}
                                          style={
                                            placeholderHasImage
                                              ? {
                                                  backgroundImage: `url(${placeholderImageUrl})`,
                                                }
                                              : undefined
                                          }
                                          aria-hidden="true"
                                        >
                                          {!placeholderHasImage ? personaInitial : null}
                                        </span>
                                      )}
                                      {canEditAvatar ? (
                                        <div className="persona-card__avatar-overlay" aria-hidden="true">
                                          <svg
                                            className="persona-card__avatar-upload-icon"
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path d="M12 3L6 9H9V15H15V9H18L12 3Z" fill="currentColor" />
                                            <rect x="5" y="17" width="14" height="2" rx="0.8" fill="currentColor" />
                                          </svg>
                                        </div>
                                      ) : null}
                                    </button>
                                    {canEditAvatar && avatarInlineError ? (
                                      <p className="persona-inline-error persona-inline-error--avatar">{avatarInlineError}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {isExpanded && canEdit && isNameEditing ? (
                                  <div className="persona-card__name-editor">
                                    <input
                                      className="persona-card__name-input"
                                      value={nameDraft}
                                      onChange={(event) => setNameDraft(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                      onFocus={(event) => event.stopPropagation()}
                                      onKeyDown={(event) => handleNameInputKeyDown(event, persona)}
                                      disabled={isSavingNameInline}
                                      autoFocus
                                    />
                                    {isNameEditing && nameInlineError ? (
                                      <p className="persona-inline-error">{nameInlineError}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <h3
                                    className={personaTitleClasses.join(" ")}
                                    title={canEdit && isExpanded ? "Click to edit name" : undefined}
                                    tabIndex={canEdit && isExpanded ? 0 : -1}
                                    onClick={(event) => {
                                      if (!canEdit || !isExpanded) return;
                                      event.stopPropagation();
                                      handleStartNameInlineEdit(persona);
                                    }}
                                    onKeyDown={(event) => {
                                      if (!canEdit || !isExpanded) return;
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        handleStartNameInlineEdit(persona);
                                      }
                                    }}
                                  >
                                    {persona.agent_name ?? "Untitled persona"}
                                  </h3>
                                )}
                                {isExpanded ? (
                                  <div className="persona-completion persona-completion--inline">
                                    <span className="persona-completion__label">Persona setup</span>
                                    <span
                                      className={`persona-completion__value persona-completion__value--${completionVariant}`}
                                    >
                                      {completionPercent}%
                                    </span>
                                    <button
                                      type="button"
                                      className="persona-completion__menu"
                                      aria-label="Persona actions"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenPersonaActionsModal(persona);
                                      }}
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        padding: "0 0 0 8px",
                                        lineHeight: 1,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        alignSelf: "center",
                                        gap: 4,
                                      }}
                                    >
                                      {[0, 1, 2].map((index) => (
                                        <span
                                          key={index}
                                          aria-hidden="true"
                                          style={{
                                            display: "block",
                                            width: 4,
                                            height: 4,
                                            borderRadius: "50%",
                                            background: "#64748b",
                                          }}
                                        />
                                      ))}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                                {!isExpanded && roleTitle ? (
                                  <div className="persona-card__role-container">
                                    <p className="persona-card__role-title">{roleTitle}</p>
                                  </div>
                                ) : null}
                                {!isExpanded && Array.isArray(persona.key_traits) && persona.key_traits.length > 0 ? (
                                  <div className="persona-card__collapsed-traits persona-card__collapsed-traits--summary">
                                    {persona.key_traits
                                      .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
                                      .filter((trait) => trait.length > 0)
                                      .slice(0, 3)
                                      .map((trait) => (
                                        <span key={`${persona.agent_id}-summary-${trait}`} className="persona-card__trait-chip">
                                          {trait}
                                        </span>
                                      ))}
                                    {persona.key_traits.filter(
                                      (trait) => typeof trait === "string" && trait.trim().length > 0
                                    ).length > 3 ? (
                                      <span className="persona-card__trait-chip persona-card__trait-chip--more">
                                        +
                                        {
                                          persona.key_traits.filter(
                                            (trait) => typeof trait === "string" && trait.trim().length > 0
                                          ).length - 3
                                        }
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            {isExpanded && isScalarTraitsEditing ? null : null}
                            </div>
                          <div className="persona-card__title-right">
                            {isExpanded ? (
                              <div className="persona-title-actions persona-title-actions--inline">
                                <div className="persona-title-actions__group">
                                  <button
                                    type="button"
                                    className="persona-toggle"
                                    role="switch"
                                    aria-label="Toggle clock"
                                    aria-checked={isClockEnabled}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void togglePersonaClock(persona);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === " " || event.key === "Enter") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void togglePersonaClock(persona);
                                      }
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 8,
                                      cursor: "pointer",
                                      border: "none",
                                      background: "transparent",
                                      padding: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: isClockEnabled ? "#13cd67" : "#334155",
                                        letterSpacing: 0.3,
                                      }}
                                    >
                                      {isClockEnabled ? "Active" : "Inactive"}
                                    </span>
                                    <span
                                      style={{
                                        position: "relative",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        width: 36,
                                        height: 20,
                                        borderRadius: 999,
                                        background: isClockEnabled ? "#13cd67" : "rgba(148, 163, 184, 0.45)",
                                        transition: "background 0.2s ease",
                                        padding: 2,
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: "absolute",
                                          inset: 2,
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: isClockEnabled ? "flex-end" : "flex-start",
                                          width: "calc(100% - 4px)",
                                          height: "calc(100% - 4px)",
                                        }}
                                      >
                                        <span
                                          aria-hidden="true"
                                          style={{
                                            display: "inline-block",
                                            width: 16,
                                            height: 16,
                                            borderRadius: "50%",
                                            background: "#fff",
                                            boxShadow: "0 2px 6px rgba(15, 23, 42, 0.25)",
                                            transition: "transform 0.2s ease",
                                          }}
                                        />
                                      </span>
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className="persona-title-cta persona-title-cta--compact"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenVoiceSettings(persona);
                                    }}
                                  >
                                    <span className="persona-title-cta__label">Voice & Language</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="persona-title-cta persona-title-cta--primary"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (personaSlug && targetClientSlug) {
                                        const clientSegment = encodeURIComponent(targetClientSlug);
                                        const personaSegment = encodeURIComponent(personaSlug);
                                        router.push(`/app/${clientSegment}/${personaSegment}`);
                                        return;
                                      }
                                      setActivePersona(persona);
                                      setSelectedOption(null);
                                    }}
                                  >
                                    <span className="persona-title-cta__label">
                                      Speak to {persona.agent_name?.trim() || "this persona"}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            ) : null}
                            {!isReady ? (
                              <span className="persona-status" aria-label={`Status: ${statusText}`}>
                                <span className="persona-status__spinner" aria-hidden="true" />
                                <span>{statusText}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    <div className="persona-card__expanded" data-visible={isExpanded ? "true" : "false"}>
                      <div className="persona-card__expanded-inner">
                        <div
                          className="persona-expanded-scroll"
                          role="region"
                          aria-label="Persona overview sections"
                        >
                          <div className="persona-expanded-track">
                            <div className="persona-expanded-block persona-expanded-block--description">
                              <div className="persona-expanded-block__header persona-expanded-block__header--description">
                                <div className="persona-expanded-block__header-labels">
                                  <h4>Key Info</h4>
                                </div>
                                <button
                                  type="button"
                                  className="persona-expanded-manage"
                                  aria-label="Open description details"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (persona.agent_id) {
                                      setDescriptionOverlayPersonaId(persona.agent_id);
                                    }
                                  }}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="#22325A"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z"
                                    />
                                  </svg>
                                  <span className="sr-only">Open description details</span>
                                </button>
                              </div>
                              <div className="persona-keyinfo-chips" aria-label="Key info sections">
                                {["Description", "Traits", "Pain Points", "JTBD"].map((label) => (
                                  <button
                                    key={label}
                                    type="button"
                                    className={`persona-keyinfo-chip${
                                      selectedKeyInfoTab === label ? " persona-keyinfo-chip--active" : ""
                                    }`}
                                    onClick={(event) => {
                                      // Prevent collapsing the expanded card when interacting with chips.
                                      event.stopPropagation();
                                      setSelectedKeyInfoTab(label as "Description" | "Traits" | "Pain Points" | "JTBD");
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            <div
                              className={`persona-description${
                                isDescriptionEditing
                                  ? " persona-description--editing"
                                  : hasDescription
                                    ? ""
                                    : " persona-description--empty"
                              }`}
                              style={isDescriptionEditing && canEdit ? { height: "100%" } : undefined}
                            >
                              {selectedKeyInfoTab === "Traits" ? (
                                keyTraits.length > 0 ? (
                                  <div className="persona-description__traits">
                                    {keyTraits.map((trait) => (
                                      <span key={trait} className="persona-description__trait-chip">
                                        {trait}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="persona-description-section__empty">No key traits added yet.</p>
                                )
                              ) : selectedKeyInfoTab === "Pain Points" ? (
                                painPointsList.length > 0 ? (
                                  <div className="persona-description__scroll">
                                    <ul className="persona-description__list">
                                      {painPointsList.map((painPoint, index) => (
                                        <li key={`${persona.agent_id}-pain-${index}`}>{painPoint}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <p className="persona-description-section__empty">No pain points added yet.</p>
                                )
                              ) : selectedKeyInfoTab === "JTBD" ? (
                                jobsToBeDoneList.length > 0 ? (
                                  <div className="persona-description__scroll">
                                    <ul className="persona-description__list">
                                      {jobsToBeDoneList.map((job, index) => (
                                        <li key={`${persona.agent_id}-jtdb-${index}`}>{job}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <p className="persona-description-section__empty">No jobs to be done added yet.</p>
                                )
                              ) : (
                                <div className="persona-description__scroll">
                                  <p className="persona-description__text">{descriptionText}</p>
                                </div>
                              )}
                            </div>
                          </div>
                            <div
                              className={`persona-expanded-block${
                                isDocumentsEditing ? " persona-expanded-block--documents" : ""
                              }`}
                            >
                              <div className="persona-expanded-block__header">
                                <div className="persona-expanded-block__header-labels">
                                  <h4>Docs & Links</h4>
                                </div>
                                <button
                                  type="button"
                                  className="persona-expanded-manage"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openInternalOverlay(persona.agent_id);
                                  }}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="#22325A"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z"
                                    />
                                  </svg>
                                  <span className="sr-only">Manage documents</span>
                                </button>
                              </div>
                              {isDocumentsEditing ? (
                                <>
                                  {documentsActionError ? (
                                    <p className="persona-inline-error">{documentsActionError}</p>
                                  ) : null}
                                  {documentsLoading ? (
                                    <div className="persona-edit-documents--empty">Loading data sources…</div>
                                  ) : documentsError ? (
                                    <div className="persona-edit-documents--empty">Unable to load data sources.</div>
                                  ) : documents.length === 0 ? (
                                    <div className="persona-edit-documents--empty">No data sources added yet.</div>
                                  ) : (
                                    <div className="persona-expanded-block__list-wrapper persona-expanded-block__list-wrapper--documents">
                                      <div className="persona-edit-documents persona-edit-documents--inline" role="list">
                                        {documents.map((doc) => {
                                        const metaParts: string[] = [];
                                        const title =
                                          doc.file_name && doc.file_name.trim().length > 0
                                            ? doc.file_name.trim()
                                            : "Untitled document";
                                        if (typeof doc.file_size === "number" && doc.file_size > 0) {
                                          metaParts.push(formatBytes(doc.file_size));
                                        }
                                        const createdLabel = doc.created_at ? formatDate(doc.created_at) : null;
                                        if (createdLabel && createdLabel !== "—") {
                                          metaParts.push(`Added ${createdLabel}`);
                                        }
                                        const displayTitle =
                                          title.length > DOCUMENT_TITLE_MAX_CHARS
                                            ? `${title.slice(0, DOCUMENT_TITLE_MAX_CHARS).trimEnd()}…`
                                            : title;
                                          return (
                                            <div key={doc.id} className="persona-edit-document-card" role="listitem">
                                              <div className="persona-edit-document-meta">
                                                <strong className="persona-edit-document-title" title={title}>
                                                  {displayTitle}
                                                </strong>
                                                {metaParts.length > 0 ? (
                                                  <span className="persona-edit-document-details">
                                                    {metaParts.join(" · ")}
                                                  </span>
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
                                    </div>
                                  )}
                                  {isSavingDocuments ? (
                                    <span className="persona-edit-status persona-edit-status--documents">
                                      {isUploadingDocument ? "Uploading…" : "Saving…"}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <div className="persona-expanded-block__list-wrapper persona-expanded-block__list-wrapper--documents">
                                  <ul className="persona-expanded-list">
                                    {documents.length > 0 ? (
                                      documents.map((doc) => {
                                      const metaParts: string[] = [];
                                      const title =
                                        doc.file_name && doc.file_name.trim().length > 0
                                          ? doc.file_name.trim()
                                          : "Untitled document";
                                      if (typeof doc.file_size === "number" && doc.file_size > 0) {
                                        const sizeInKb = doc.file_size / 1024;
                                        const sizeLabel =
                                          sizeInKb >= 1024
                                            ? `${(sizeInKb / 1024).toFixed(1)} MB`
                                            : `${Math.max(sizeInKb, 1).toFixed(0)} KB`;
                                        metaParts.push(sizeLabel);
                                      }
                                      const createdLabel = doc.created_at ? formatDate(doc.created_at) : null;
                                      if (createdLabel && createdLabel !== "—") {
                                        metaParts.push(`Added ${createdLabel}`);
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
                                </div>
                              )}
                            {documentsUpdatedAt ? (
                              <span className="persona-expanded-block__updated-flag">
                                Updated {formatDate(documentsUpdatedAt)}
                              </span>
                            ) : null}
                          </div>
                            <div className="persona-expanded-block persona-expanded-block--external">
                              <div className="persona-expanded-block__header">
                                <div className="persona-expanded-block__header-labels">
                                  <h4>Supporting Research</h4>
                                  </div>
                                <button
                                  type="button"
                                  className="persona-expanded-external-manage"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenResearchOverlay(persona.agent_id);
                                  }}
                                  disabled={agentResearchLoading || !personaResearchRecord}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="#22325A"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0z"
                                    />
                                  </svg>
                                  <span className="sr-only">Manage external sources</span>
                                </button>
                              </div>
                              <div className="persona-expanded-block__list-wrapper">
                                <ul className="persona-expanded-list">
                                {externalArticles.length > 0 ? (
                                  externalArticles.map((article, index) => {
                                    const displayTitle = article.title || article.url || "Untitled source";
                                    return (
                                      <li key={`external-article-${persona.agent_id}-${index}`}>
                                        <div className="persona-expanded-list-item persona-expanded-list-item--document">
                                          {article.url ? (
                                            <a
                                              href={article.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="persona-doc-title"
                                            >
                                              {displayTitle}
                                            </a>
                                          ) : (
                                            <span className="persona-doc-title">{displayTitle}</span>
                                          )}
                                          {article.url ? (
                                            <span className="persona-doc-meta">{article.url}</span>
                                          ) : null}
                                        </div>
                                      </li>
                                    );
                                  })
                                ) : externalKnowledgeText ? (
                                  <li>
                                    <div className="persona-expanded-list-item">
                                      {externalKnowledgeText}
                                    </div>
                                  </li>
                                ) : (
                                  <li>
                                    <div className="persona-expanded-list-item">
                                      {externalArticlesLoading
                                        ? "Loading external data sources…"
                                        : externalArticlesError
                                          ? externalArticlesError
                                          : "External data sources will appear automatically after creating your persona."}
                                    </div>
                                  </li>
                                )}
                                </ul>
                                {externalUpdatedAt ? (
                                  <span className="persona-expanded-block__updated-flag">
                                    Updated {formatDate(externalUpdatedAt)}
                                  </span>
                                ) : null}
                                {personaResearchRecord?.currentJobStatus === "pending" && (
                                      <div className="persona-expanded-block__overlay">
                                        <span
                                          aria-hidden="true"
                                          className="persona-research-spinner"
                                        />
                                        <span>Researching</span>
                                        {externalUpdatedAt ? (
                                          <span className="persona-expanded-block__overlay-note">
                                            Started {formatDate(externalUpdatedAt)}
                                            {externalUpdatedRelative ? ` · ${externalUpdatedRelative}` : ""}
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      className="persona-card__footer"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        gap: 6,
                        width: "100%",
                      }}
                    >
                      {!isExpanded ? (
                        <>
                          <div className="persona-card__collapsed-status-row">
                            <span className="persona-card__status" style={{ color: statusColor }}>
                              {statusLabel}
                            </span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </article>
                  </div>
                );
              })}
                    </div>
                  </div>
                </section>
              </StagePanel>
            </div>
          </div>
        )}
        <PersonasFullscreenModal
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
                            {personaEditMetaChips.length > 0 || canEdit ? (
                              <div className="persona-edit-meta-row">
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
                                ) : (
                                  <div style={{ flex: "1 1 auto" }} />
                                )}
                                {canEdit ? (
                                  <button
                                    type="button"
                                    className="persona-edit-delete-chip"
                                    onClick={() => {
                                      if (!activePersona) return;
                                      setPersonaPendingDelete(activePersona);
                                      setShowDeletePersonaConfirm(true);
                                    }}
                                  >
                                    Delete persona
                                  </button>
                                ) : null}
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
                                    <div className="persona-edit-key-traits__chips">
                                      {chipTraitsList.map((trait, index) => (
                                        <div key={`persona-key-trait-${index}`} className="persona-edit-key-trait">
                                          {chipEditingIndex === index ? (
                                            <input
                                              id={`persona-edit-key-trait-${index}`}
                                              className="persona-edit-key-trait__input"
                                              value={chipEditingValue}
                                              placeholder="Add key trait"
                                              autoFocus
                                              onChange={(event) => {
                                                setChipEditingValue(event.target.value);
                                                setChipEditDirty(true);
                                              }}
                                              onBlur={() => {
                                                void handleChipEditCommit();
                                              }}
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                  event.preventDefault();
                                                  void handleChipEditCommit();
                                                } else if (event.key === "Escape") {
                                                  event.preventDefault();
                                                  handleCancelChipEdit();
                                                }
                                              }}
                                            />
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                className="persona-edit-key-trait__label"
                                                onClick={() => handleStartChipEdit(index, trait)}
                                              >
                                                {trait}
                                              </button>
                                              <button
                                                type="button"
                                                className="persona-edit-key-trait__remove"
                                                aria-label={`Remove ${trait}`}
                                                onClick={() => handleChipDelete(index)}
                                              >
                                                ×
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                      {chipEditingIndex === chipTraitsList.length && (
                                        <div className="persona-edit-key-trait">
                                          <input
                                            id="persona-edit-key-trait-new"
                                            className="persona-edit-key-trait__input"
                                            value={chipEditingValue}
                                            placeholder="Add key trait"
                                            onChange={(event) => {
                                              setChipEditingValue(event.target.value);
                                              setChipEditDirty(true);
                                            }}
                                            onBlur={() => {
                                              void handleChipEditCommit();
                                            }}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                void handleChipEditCommit();
                                              } else if (event.key === "Escape") {
                                                event.preventDefault();
                                                handleCancelChipEdit();
                                              }
                                            }}
                                            autoFocus
                                          />
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        className="persona-edit-key-traits__add"
                                        onClick={handleAddKeyTrait}
                                      >
                                        Add trait
                                      </button>
                                    </div>
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
                                  <h4>Internal Data Sources</h4>
                                  <div className="persona-edit-documents-actions">
                                    {canEdit ? (
                                      <PillButton
                                        type="button"
                                        onClick={() => handleDataSourceUploadClick(activePersona?.agent_id)}
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
                                ) : activePersonaDocuments.length === 0 ? (
                                  <div className="persona-edit-documents--empty">No data sources added yet.</div>
                                ) : (
                                  <div className="persona-edit-documents" role="list">
                                    {activePersonaDocuments.map((doc) => {
                                      const metaParts: string[] = [];
                                      const title =
                                        doc.file_name && doc.file_name.trim().length > 0
                                          ? doc.file_name.trim()
                                          : "Untitled document";
                                      if (typeof doc.file_size === "number" && doc.file_size > 0) {
                                        metaParts.push(formatBytes(doc.file_size));
                                      }
                                      const createdLabel = doc.created_at ? formatDate(doc.created_at) : null;
                                      if (createdLabel && createdLabel !== "—") {
                                        metaParts.push(`Added ${createdLabel}`);
                                      }
                                      const displayTitle =
                                        title.length > DOCUMENT_TITLE_MAX_CHARS
                                          ? `${title.slice(0, DOCUMENT_TITLE_MAX_CHARS).trimEnd()}…`
                                          : title;
                                      return (
                                        <div key={doc.id} className="persona-edit-document-card" role="listitem">
                                          <div className="persona-edit-document-meta">
                                            <strong
                                              className="persona-edit-document-title"
                                              title={title}
                                            >
                                              {displayTitle}
                                            </strong>
                                            {metaParts.length > 0 ? (
                                              <span className="persona-edit-document-details">
                                                {metaParts.join(" · ")}
                                              </span>
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
        </PersonasFullscreenModal>

        {voiceSettingsPersona
          ? (() => {
              const modalTitleId = `persona-voice-modal-title-${voiceSettingsPersona.agent_id}`;
              const modalDescriptionId = `persona-voice-modal-description-${voiceSettingsPersona.agent_id}`;
              const personaLabel = voiceSettingsPersona.agent_name?.trim() || "this persona";
              const availableVoices = voiceOptions;
              const personaId = voiceSettingsPersona.agent_id;
              const currentSelection =
                voiceSettingsSelection ??
                personaVoiceSelections[personaId] ??
                availableVoices[0]?.voice_id ??
                null;
              const selectedVoice = currentSelection
                ? availableVoices.find((voice) => voice.voice_id === currentSelection) ?? null
                : null;
              return (
                <div
                  className="persona-voice-modal-backdrop"
                  role="presentation"
                  onClick={handleCloseVoiceSettings}
                >
                  <div
                    className="persona-voice-modal-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={modalTitleId}
                    aria-describedby={modalDescriptionId}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header className="persona-voice-modal-header">
                      <div className="persona-voice-modal-heading">
                        <h3 id={modalTitleId}>Voice & Language</h3>
                        <p id={modalDescriptionId}>
                          Configure how {personaLabel} sounds in interview mode.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="persona-voice-modal-close"
                        onClick={handleCloseVoiceSettings}
                        aria-label="Close voice settings"
                        ref={voiceSettingsCloseButtonRef}
                      >
                        ×
                      </button>
                    </header>
                    <div className="persona-voice-modal-body">
                      <div className="persona-voice-layout">
                        <section className="persona-voice-panel persona-voice-panel--form">
                          {voiceOptionsLoading ? (
                            <p className="persona-voice-status" role="status">
                              Loading available voices…
                            </p>
                          ) : availableVoices.length > 0 ? (
                            <>
                              <div className="persona-voice-select" ref={voiceSelectRef}>
                                <button
                                  type="button"
                                  className="persona-voice-select__trigger"
                                  onClick={() => setIsVoiceMenuOpen((previous) => !previous)}
                                  aria-haspopup="listbox"
                                  aria-expanded={isVoiceMenuOpen}
                                >
                                  <span className="persona-voice-select__trigger-label">
                                    {selectedVoice?.name ?? "Select a voice"}
                                  </span>
                                  <span className="persona-voice-select__trigger-meta">
                                    <span className="persona-voice-select__chip-row">
                                      {selectedVoice?.accent ? (
                                        <span className="persona-voice-chip persona-voice-chip--neutral">{selectedVoice.accent}</span>
                                      ) : null}
                                      {selectedVoice?.gender ? (
                                        <span className="persona-voice-chip persona-voice-chip--neutral">
                                          {selectedVoice.gender}
                                        </span>
                                      ) : null}
                                      {selectedVoice?.age ? (
                                        <span className="persona-voice-chip persona-voice-chip--neutral">
                                          {selectedVoice.age}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="persona-voice-select__chevron" aria-hidden="true" />
                                  </span>
                                </button>
                                {isVoiceMenuOpen ? (
                                  <div
                                    className="persona-voice-select__menu"
                                    role="listbox"
                                    aria-activedescendant={
                                      currentSelection ? `persona-voice-option-${currentSelection}` : undefined
                                    }
                                  >
                                    {availableVoices.map((voice) => {
                                      const isActive = voice.voice_id === currentSelection;
                                      const isPreviewing = previewingVoiceId === voice.voice_id;
                                      const canPreview = Boolean(voice.preview_url);
                                      return (
                                        <div
                                          key={voice.voice_id}
                                          role="option"
                                          id={`persona-voice-option-${voice.voice_id}`}
                                          className={[
                                            "persona-voice-select__option",
                                            isActive ? "persona-voice-select__option--active" : "",
                                          ]
                                            .filter(Boolean)
                                            .join(" ")}
                                          aria-selected={isActive}
                                          tabIndex={0}
                                          onClick={() => {
                                            const didChange = handleVoiceSettingsSelectionChange(
                                              personaId,
                                              voice.voice_id
                                            );
                                            if (didChange) {
                                              setIsVoiceMenuOpen(false);
                                            }
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              const didChange = handleVoiceSettingsSelectionChange(
                                                personaId,
                                                voice.voice_id
                                              );
                                              if (didChange) {
                                                setIsVoiceMenuOpen(false);
                                              }
                                            }
                                          }}
                                        >
                                          <div className="persona-voice-select__option-main">
                                            <div className="persona-voice-select__option-title">
                                              <button
                                                type="button"
                                                className={[
                                                  "persona-voice-preview-btn",
                                                  isPreviewing ? "persona-voice-preview-btn--playing" : "",
                                                  !canPreview ? "persona-voice-preview-btn--disabled" : "",
                                                ]
                                                  .filter(Boolean)
                                                  .join(" ")}
                                                onClick={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  if (!canPreview) return;
                                                  toggleVoicePreview(voice);
                                                }}
                                                disabled={!canPreview}
                                                aria-label={
                                                  canPreview
                                                    ? `${isPreviewing ? "Pause" : "Play"} preview for ${voice.name}`
                                                    : `Preview unavailable for ${voice.name}`
                                                }
                                              >
                                                <span className="persona-voice-preview-icon" aria-hidden="true">
                                                  {isPreviewing ? (
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                      <rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor" />
                                                      <rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor" />
                                                    </svg>
                                                  ) : (
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                      <path d="M3 2.5L9 6L3 9.5V2.5Z" fill="currentColor" />
                                                    </svg>
                                                  )}
                                                </span>
                                              </button>
                                              <span className="persona-voice-select__option-label">{voice.name}</span>
                                            </div>
                                          </div>
                                          <div className="persona-voice-select__option-actions">
                                            <span className="persona-voice-select__chip-row">
                                              {voice.accent ? (
                                                <span className="persona-voice-chip persona-voice-chip--neutral">{voice.accent}</span>
                                              ) : null}
                                              {voice.gender ? (
                                                <span className="persona-voice-chip persona-voice-chip--neutral">
                                                  {voice.gender}
                                                </span>
                                              ) : null}
                                              {voice.age ? (
                                                <span className="persona-voice-chip persona-voice-chip--neutral">
                                                  {voice.age}
                                                </span>
                                              ) : null}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                              {voiceSelectionSaving ? (
                                <p className="persona-voice-status" role="status">
                                  Saving voice selection…
                                </p>
                              ) : null}
                              {voiceSelectionError ? (
                                <p className="persona-voice-error" role="alert">
                                  {voiceSelectionError}
                                </p>
                              ) : null}
                              {voiceOptionsError ? (
                                <p className="persona-voice-error" role="alert">
                                  {voiceOptionsError}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <div className="persona-voice-empty">
                              {voiceOptionsError
                                ? "Unable to load ElevenLabs voices right now. Please try again."
                                : "We couldn’t find any available voices yet. Add voices in ElevenLabs and refresh."}
                            </div>
                          )}
                        </section>
                        <section className="persona-voice-panel persona-voice-panel--languages">
                          <h4 className="persona-voice-panel__heading">Persona Languages</h4>
                          <p className="persona-voice-panel__subtext">
                            Just ask your persona to change language during the conversation.
                          </p>
                          {languagesLoading ? (
                            <p className="persona-voice-status" role="status">
                              Loading languages…
                            </p>
                          ) : null}
                          {languagesError ? (
                            <p className="persona-voice-error" role="alert">
                              {languagesError}
                            </p>
                          ) : null}
                          {!languagesLoading && !languagesError ? (
                            availableLanguages.length > 0 ? (
                              <div className="persona-language-chip-row">
                                {availableLanguages.map((language) => {
                                  const key = language.code ?? `language-${language.english_name ?? "unknown"}`;
                                  return (
                                    <span key={key} className="persona-language-chip">
                                      {language.emoji_flag ? (
                                        <span className="persona-language-chip__emoji" aria-hidden="true">
                                          {language.emoji_flag}
                                        </span>
                                      ) : null}
                                      <span className="persona-language-chip__label">
                                        {language.english_name ?? "Unnamed language"}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="persona-voice-status">No persona languages found yet.</p>
                            )
                          ) : null}
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          : null}

        {personaActionsModalPersona
          ? (() => {
              const modalTitleId = `persona-actions-modal-title-${personaActionsModalPersona.agent_id}`;
              const modalDescriptionId = `persona-actions-modal-description-${personaActionsModalPersona.agent_id}`;
              const personaLabel =
                personaActionsModalPersona.agent_name?.trim() || "this persona";
              return (
                <div
                  className="persona-actions-modal-backdrop"
                  role="presentation"
                  onClick={handleClosePersonaActionsModal}
                >
                  <div
                    className="persona-actions-modal-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={modalTitleId}
                    aria-describedby={modalDescriptionId}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="persona-actions-modal-close"
                      onClick={handleClosePersonaActionsModal}
                      aria-label="Close persona actions"
                    >
                      ×
                    </button>
                    <div className="persona-actions-modal-content">
                      {personaActionsModalView === "confirm-delete" ? (
                        <>
                          <h3 id={modalTitleId} className="persona-actions-modal-title">
                            Delete persona
                          </h3>
                          <p id={modalDescriptionId} className="persona-actions-modal-description">
                            This will permanently remove {personaLabel} and its data. Are you sure you want to continue?
                          </p>
                          <div className="persona-actions-confirm">
                            <button
                              type="button"
                              className="persona-actions-confirm-cancel"
                              ref={personaActionsCancelFocusRef}
                              onClick={() => {
                                setPersonaActionsModalView("options");
                                setDeletePersonaError(null);
                              }}
                              disabled={isDeletingPersona}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="persona-actions-confirm-delete"
                              onClick={() => {
                                void handleConfirmDeletePersona();
                              }}
                              disabled={isDeletingPersona}
                            >
                              Delete persona
                            </button>
                          </div>
                          {deletePersonaError ? (
                            <p className="persona-actions-confirm-error" role="alert">
                              {deletePersonaError}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <h3 id={modalTitleId} className="persona-actions-modal-title">
                            Persona actions
                          </h3>
                          <p
                            id={modalDescriptionId}
                            className="persona-actions-modal-description"
                          >
                            Choose how you'd like to work with {personaLabel}.
                          </p>
                          <div className="persona-actions-modal-options">
                            {PERSONA_ACTION_MODAL_OPTIONS.map((option, index) => (
                              <button
                                key={option.key}
                                type="button"
                                className={`persona-actions-modal-option${
                                  option.intent === "danger"
                                    ? " persona-actions-modal-option--danger"
                                    : ""
                                }`}
                                onClick={() => handlePersonaActionsOptionSelect(option.key)}
                                ref={index === 0 ? personaActionsInitialFocusRef : undefined}
                              >
                                <span className="persona-actions-modal-option-label">
                                  {option.label}
                                </span>
                                {option.description ? (
                                  <span className="persona-actions-modal-option-description">
                                    {option.description}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                            {personaShareLinkCopied ? (
                              <p className="persona-actions-modal-share-status" role="status">
                                Persona link copied to clipboard.
                              </p>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          : null}

        {showDeletePersonaConfirm ? (
          <div className="persona-delete-confirm-backdrop" role="presentation">
            <div
              className="persona-delete-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="persona-delete-confirm-title"
              aria-describedby="persona-delete-confirm-message"
            >
              <button
                type="button"
                className="persona-delete-confirm-close"
                onClick={() => {
                  if (isDeletingPersona) return;
                  setShowDeletePersonaConfirm(false);
                  setPersonaPendingDelete(null);
                }}
                aria-label="Close delete confirmation"
              >
                ×
              </button>
              <div className="persona-delete-confirm-content">
                <h3 id="persona-delete-confirm-title">Delete persona</h3>
                <p id="persona-delete-confirm-message">
                  This persona and its data will be removed. Are you sure you want to continue?
                </p>
                <div className="persona-delete-confirm-actions">
                  <button
                    type="button"
                    className="persona-delete-confirm-cancel"
                    onClick={() => {
                      if (isDeletingPersona) return;
                      setShowDeletePersonaConfirm(false);
                      setDeletePersonaError(null);
                      setPersonaPendingDelete(null);
                    }}
                    disabled={isDeletingPersona}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="persona-delete-confirm-delete"
                    onClick={handleConfirmDeletePersona}
                    disabled={isDeletingPersona}
                  >
                    Delete persona
                  </button>
                </div>
                {deletePersonaError ? (
                  <div className="persona-delete-confirm-error">{deletePersonaError}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <style>{`
          .personas-stage {
            position: relative;
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
          }
          .stage-layout {
            min-height: 100dvh;
            background: var(--bg, #f4f8ff);
            padding: 0;
            font-family: var(--font-body, var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif));
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
            align-items: stretch;
            padding: 64px 64px 32px;
            min-height: 100dvh;
            height: 100dvh;
            overflow: hidden;
            box-sizing: border-box;
          }
          .stage-layout__content[data-modal-open="true"] {
            padding: 0;
            overflow: visible;
          }
          .stage-shell {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 32px;
            color: var(--text);
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
          }
          .stage-layout__content[data-modal-open="true"] .stage-shell {
            height: 100%;
          }
          .persona-unsaved-save {
            display: inline-flex;
            justify-content: center;
            border-radius: 12px;
            border: 1px solid rgba(148, 195, 255, 0.45);
            background: #ffffff;
            color: #052033;
            padding: 8px 18px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.4px;
            font-family: var(--font-heading, var(--font-body, var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif)));
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
          .personas-topbar-actions {
            display: inline-flex;
            align-items: center;
            gap: 20px;
          }
          .personas-toggle-button {
            min-width: 0;
            width: 40px;
            height: 40px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: transparent;
            box-shadow: none;
            border-color: transparent;
          }
          .personas-toggle-button:hover,
          .personas-toggle-button:focus-visible {
            background: transparent;
            box-shadow: none;
            border-color: rgba(15, 23, 42, 0.28);
          }
          .personas-toggle-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .personas-toggle-icon svg {
            width: 18px;
            height: 18px;
          }
          .stage-panel {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
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
            gap: 12px;
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
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
            background: none;
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
            color: #073a70;
            font-weight: 800;
            font-size: 16px;
          }
          .personas-new-button {
            padding: 8px 16px;
            font-size: 13px;
            height: 40px;
          }
          .personas-new-button.stage-button--primary {
            box-shadow: none;
            background: rgba(248, 250, 252, 0.92);
            color: #0f172a;
            border: 1px solid #1e293b;
          }
          .personas-new-button.stage-button--primary:not(:disabled):hover {
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
            transform: translateY(-1px);
          }
          .personas-new-button .stage-button__icon {
            margin-right: 0px;
            width: 16px;
            height: 16px;
            font-size: 14px;
          }
          .personas-section {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
            height: 100%;
          }
          .personas-grid-scroll {
            width: 100%;
            flex: 1 1 auto;
            overflow-y: auto;
            padding-right: 6px;
            min-height: calc(100dvh - 120px);
            max-height: calc(100dvh - 220px);
          }
          .personas-grid {
            display: grid;
            gap: 20px;
            padding-top: 12px;
            padding-bottom: 12px;
            align-items: stretch;
            justify-items: center;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-auto-flow: row;
          }
          .personas-empty {
            width: 100%;
            min-height: calc(100dvh - 220px);
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .personas-empty-full {
            width: 100%;
            height: 100%;
            min-height: calc(100dvh - 220px);
            padding: 70px 0 0;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .personas-empty-shell {
            width: 100%;
            max-width: 700px;
            padding: 0px 36px;
            background: #e6f0ff;
            border-radius: 24px;
            box-shadow: 0 30px 60px rgba(15, 23, 42, 0.12);
            border: 1px solid rgba(15, 23, 42, 0.08);
            position: relative;
            z-index: 130;
          }
          .personas-empty-overlay {
            position: fixed;
            inset: 0;
            background: rgba(5, 10, 30, 0.6);
            z-index: 125;
            pointer-events: none;
          }
          .personas-empty-card {
            width: 100%;
            height: 100%;
            max-width: 660px;
            border-radius: 18px;
            padding: 38px 32px;
            border: none;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: space-between;
            gap: 0;
            background: transparent;
            min-height: 420px;
          }
          .personas-empty-heading {
            margin: 0 0 24px;
            font-size: clamp(28px, 4vw, 38px);
            text-align: center;
            font-weight: 700;
            color: #0f172a;
          }
          .personas-empty-video {
            width: 100%;
            max-width: 560px;
            position: relative;
            padding-top: 56.25%;
            flex: 1;
            margin: 0 auto 40px;
          }
          .personas-empty-video iframe {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 14px;
          }
          .personas-empty-button {
            padding: 14px 28px;
            border-radius: 14px;
            background: #0f172a;
            color: #f8fafc;
            font-weight: 600;
            border: none;
            cursor: pointer;
            width: auto;
            height: auto;
            font-size: 17px;
            align-self: center;
            margin-top: 0px;
          }
          @media (max-width: 960px) {
            .personas-grid-scroll {
              min-height: calc(100dvh - 200px);
              max-height: calc(100dvh - 200px);
            }
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
            position: relative;
          }
          .persona-card-button[aria-expanded="true"] {
            grid-column: 1 / -1;
            align-self: stretch;
          }
          .persona-card-button:focus-visible {
            outline: 2px solid rgba(43, 108, 176, 0.85);
            outline-offset: 6px;
            border-radius: 20px;
          }
          .persona-card-button[aria-disabled="true"] {
            cursor: not-allowed;
          }
          .persona-card-button[aria-disabled="true"] .persona-card {
            cursor: not-allowed;
            opacity: 0.68;
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
  background: rgba(248, 250, 252, 0.65);
  background-image: none;
  box-shadow: 0 18px 36px rgba(10, 22, 40, 0.12);
  padding: 24px;
  padding-top: 10px;
  padding-bottom: 24px; /* 👈 overrides just the bottom padding */
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 240px;
  width: 100%;
  transition: transform 0.32s ease, box-shadow 0.32s ease, border-color 0.32s ease, background-color 0.32s ease;
  cursor: pointer;
}
          .persona-card-button[aria-expanded="true"] {
            width: 100%;
            justify-self: stretch;
          }
          .persona-card-button[aria-expanded="true"] .persona-card {
            background-color: rgba(255, 255, 255, 0.99);
            height: clamp(540px, calc(100vh - 240px), 1080px);
            flex: 1 1 auto;
            max-height: clamp(540px, calc(100vh - 240px), 1080px);
          }
          .persona-card__expanded {
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transform: translateY(-6px);
            transition: max-height 0.44s ease, opacity 0.36s ease, transform 0.36s ease;
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
            min-height: 0;
          }
          .persona-card__expanded[data-visible="true"] {
            max-height: max(420px, calc(100vh - 260px));
            height: 100%;
            opacity: 1;
            transform: translateY(0);
            flex: 1 1 auto;
          }
          .persona-card__expanded-inner {
            padding-top: 0;
            color: rgba(30, 41, 59, 0.72);
            font-size: 14px;
            line-height: 1.5;
            text-align: left;
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            min-height: 0;
          }
          .persona-card__title-top {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }
          .persona-completion {
            display: inline-flex;
            align-items: flex-end;
            gap: 6px;
          }
          .persona-completion__label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: rgba(30, 41, 59, 0.6);
            font-weight: 600;
          }
          .persona-completion__value {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
          }
          .persona-completion__value--complete {
            background: rgba(59, 130, 246, 0.16);
            color: #1d4ed8;
          }
          .persona-completion__value--warning {
            background: rgba(234, 179, 8, 0.2);
            color: #b45309;
          }
          .persona-completion__value--danger {
            background: rgba(248, 113, 113, 0.24);
            color: #b91c1c;
          }
          .persona-completion--collapsed {
            align-items: center;
          }
          .persona-card__collapsed-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            gap: 12px;
            margin-bottom: 6px;
          }
          .persona-card__collapsed-traits {
            display: inline-flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
          }
          .persona-card__trait-chip {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid rgba(59, 130, 246, 0.4);
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
            line-height: 1;
          }
          .persona-card__status {
            font-size: 13px;
            font-weight: 600;
            font-family: ${HEADING_FONT_STACK};
          }
          .persona-card__collapsed-status-row {
            display: flex;
            justify-content: flex-end;
            width: 100%;
            margin-top: 6px;
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
          .persona-card__scalar-traits--editing {
            align-items: flex-start;
          }
          .persona-card-trait-edit {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
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
            margin-top: 16px;
            flex: 1 1 auto;
            min-height: 0;
            overflow-x: auto;
            overflow-y: visible;
            padding: 0 4px 0px;
            scrollbar-width: thin;
            scrollbar-color: rgba(148, 163, 184, 0.5) transparent;
            overscroll-behavior: contain;
            display: flex;
            align-items: stretch;
            max-height: 100%;
          }
          .persona-card__expanded-meta + .persona-expanded-scroll {
            margin-top: 8px;
          }
          .persona-expanded-scroll::-webkit-scrollbar {
            height: 8px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-thumb {
            background-color: rgba(148, 163, 184, 0.55);
            border-radius: 999px;
          }
          .persona-expanded-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .persona-expanded-track {
            display: flex;
            align-items: stretch;
            gap: 18px;
            min-height: 0;
            flex: 1 1 auto;
            padding-right: 4px;
            max-height: 100%;
          }
          .persona-expanded-block {
            flex: 0 0 min(360px, calc(100% - 32px));
            padding: 18px 20px;
            color: rgba(30, 41, 59, 0.85);
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 12px;
            border-radius: 16px;
            border: 1px solid rgba(43, 108, 176, 0.14);
            background: rgba(30, 41, 59, 0.04);
            position: relative;
          }
          .persona-expanded-block--overlay {
            border: none;
            background: transparent;
            padding-left: 0;
            max-height: none;
            height: auto;
            overflow: visible;
            box-shadow: none;
          }
          .persona-expanded-block__list-wrapper {
            position: relative;
            flex: 1 1 auto;
            overflow: auto;
            padding-right: 4px;
            border-radius: 12px
          }
          .persona-expanded-block__list-wrapper--documents {
            max-height: min(370px, 45vh);
            overflow-y: auto;
          }
          .persona-expanded-block--description {
            flex-basis: min(420px, calc(100% - 32px));
          }
          .persona-expanded-block h4 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 0.4px;
          }
          .persona-expanded-block__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .persona-keyinfo-chips {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin: 6px 0 10px;
          }
          .persona-keyinfo-chip {
            display: inline-flex;
            align-items: center;
            padding: 6px 10px;
            border-radius: 999px;
            background: #e2e8f0;
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.2px;
            line-height: 1.2;
            border: none;
            cursor: pointer;
            transition: background 0.15s ease, box-shadow 0.15s ease;
          }
          .persona-keyinfo-chip:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.4);
            outline-offset: 2px;
          }
          .persona-keyinfo-chip:hover {
            background: #d9e4f3;
            box-shadow: 0 4px 8px rgba(15, 23, 42, 0.08);
          }
          .persona-keyinfo-chip--active {
            background: #d0e2ff;
            box-shadow: 0 6px 12px rgba(34, 56, 96, 0.15);
          }
          .persona-expanded-block__overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 24px;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.92);
            font-weight: 500;
            color: #fff;
            z-index: 2;
            box-shadow: 0 16px 32px rgba(15, 23, 42, 0.45);
            pointer-events: none;
          }
          .persona-expanded-block__overlay-note {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.75);
            font-weight: 500;
          }
          .persona-expanded-block__updated-flag {
            position: absolute;
            bottom: 12px;
            right: 14px;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.95);
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
            opacity: 0;
            transform: translateY(2px);
            transition: opacity 0.15s ease, transform 0.15s ease;
            pointer-events: none;
          }
          .persona-expanded-block--external:hover .persona-expanded-block__updated-flag,
          .persona-expanded-block--external:focus-within .persona-expanded-block__updated-flag,
          .persona-expanded-block--documents:hover .persona-expanded-block__updated-flag,
          .persona-expanded-block--documents:focus-within .persona-expanded-block__updated-flag {
            opacity: 1;
            transform: translateY(0);
          }
          .persona-updated-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: transparent;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.55);
            white-space: nowrap;
          }
          .persona-research-spinner {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 3px solid rgba(15, 23, 42, 0.25);
            border-top-color: #0f172a;
            animation: persona-research-spinner 1s linear infinite;
            display: inline-block;
          }
          @keyframes persona-research-spinner {
            to {
              transform: rotate(360deg);
            }
          }
          .persona-description {
            flex: 1 1 auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            color: rgba(30, 41, 59, 0.78);
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
            max-height: 360px;
            overflow: hidden;
          }
          .persona-description-overlay {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-description-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .persona-description-section__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
          }
          .persona-description-section__reset {
            background: transparent;
            border: none;
            color: rgba(15, 23, 42, 0.65);
            font-size: 13px;
            font-weight: 600;
            padding: 0;
            cursor: pointer;
          }
          .persona-description-section__reset:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .persona-description__heading {
            margin: 0 0 6px;
            font-size: 12px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.65);
            letter-spacing: 0.3px;
          }
          .persona-description__traits {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 10px;
          }
          .persona-description__trait-chip {
            padding: 4px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid rgba(59, 130, 246, 0.4);
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
          }
          .persona-description__traits {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
          }
          .persona-description__trait-chip {
            padding: 4px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid rgba(59, 130, 246, 0.4);
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
          }
          .persona-description__chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
            margin-bottom: 6px;
            max-height: calc(3 * 32px + 12px);
            overflow: hidden;
            position: relative;
            cursor: pointer;
            padding: 4px 0;
          }
          .persona-description__chip-row::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 18px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(248, 250, 252, 0.92));
            pointer-events: none;
          }
          .persona-description__chip-row--expanded {
            max-height: none;
            overflow: visible;
          }
          .persona-description__chip-row--expanded::after {
            display: none;
          }
          .persona-description__chip--editable {
            background: rgba(43, 108, 176, 0.12);
          }
          .persona-description__chip-input {
            border: 1px solid rgba(15, 23, 42, 0.35);
            border-radius: 8px;
            padding: 4px 8px;
            font-size: 13px;
            font-family: inherit;
            color: rgba(15, 23, 42, 0.9);
            background: #fff;
          }
          .persona-description__chip {
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 999px;
            background: rgba(248, 250, 252, 0.92);
            color: #1f2a37;
            font-weight: 600;
            border: 1px dashed rgba(148, 163, 184, 0.8);
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .persona-description__scroll {
            max-height: 290px;
            overflow-y: auto;
            margin-top: 10px;
            padding-right: 6px;
          }
          .persona-description__text {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(15, 23, 42, 0.92);
            white-space: pre-line;
          }
          .persona-description__list {
            margin: 0;
            padding-left: 20px;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(15, 23, 42, 0.92);
          }
          .persona-description__list li + li {
            margin-top: 8px;
          }
          .persona-description__input {
            width: 100%;
            flex: 1;
            min-height: 160px;
            max-height: 220px;
            border-radius: 12px;
            border: 1px solid rgba(15, 23, 42, 0.35);
            padding: 10px;
            font-size: 14px;
            font-family: inherit;
            line-height: 1.5;
            background: #f8fafc;
            box-sizing: border-box;
            resize: vertical;
            overflow-y: auto;
          }
          .persona-description__input {
            width: 100%;
            min-height: 160px;
            max-height: 220px;
            border-radius: 12px;
            border: 1px solid rgba(15, 23, 42, 0.35);
            padding: 10px;
            font-size: 14px;
            font-family: inherit;
            line-height: 1.5;
            background: #f8fafc;
            box-sizing: border-box;
            resize: vertical;
            overflow-y: auto;
          }
          .persona-description__chip-close {
            font-size: 11px;
            color: rgba(15, 23, 42, 0.6);
            margin-left: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .persona-description__chip-close:focus-visible,
          .persona-description__chip-close:hover {
            cursor: pointer;
          }
          .persona-description--empty {
            color: rgba(30, 41, 59, 0.48);
            font-style: italic;
          }
          .persona-description--editing {
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
            height: 100%;
          }
          .persona-description p {
            margin: 0;
            word-break: break-word;
          }
          .persona-description-section__heading {
            margin: 0;
            font-size: 12px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.65);
            letter-spacing: 0.3px;
          }
          .persona-description-overlay__footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 4px;
            align-items: center;
          }
          .persona-description-overlay__footer .persona-description-section__reset {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 20px;
            font-size: 14px;
            border-radius: 12px;
            font-weight: 700;
            border: 1px solid #052033 !important;
            background: transparent;
            color: #052033;
            box-shadow: none;
            appearance: none;
            line-height: 1.2;
          }
          .persona-description-overlay__footer .persona-description-section__reset:disabled {
            opacity: 0.6;
          }
          .persona-description-overlay__save {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 20px !important;
            font-size: 14px !important;
            border-radius: 12px !important;
            font-weight: 700 !important;
            background: #052033 !important;
            color: #fff !important;
            border: 1px solid #052033 !important;
            box-shadow: none !important;
            appearance: none;
            line-height: 1.2;
          }
          .persona-description-section__empty {
            margin: 0;
            font-size: 13px;
            color: rgba(15, 23, 42, 0.6);
          }
          .persona-description__input {
            width: 100%;
            min-height: 100%;
            height: 100%;
            resize: vertical;
            border-radius: 12px;
            border: 1px solid rgba(30, 41, 59, 0.2);
            padding: 12px 14px;
            font-size: 14px;
            font-family: inherit;
            color: rgba(15, 23, 42, 0.92);
            background: rgba(30, 41, 59, 0.06);
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }
          .persona-description__input--overlay {
            min-height: 90px;
            max-height: 150px;
            height: auto;
          }
          .persona-description__input:focus {
            outline: none;
            border-color: rgba(37, 99, 235, 0.65);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
            background: #fff;
          }
          .persona-description__input:disabled {
            opacity: 0.6;
            cursor: progress;
          }
          .persona-expanded-block__header--description {
            align-items: center;
          }
          .persona-inline-edit-button {
            border: none;
            background: rgba(248, 250, 252, 0.9);
            color: rgba(37, 99, 235, 0.85);
            border-radius: 999px;
            width: 30px;
            height: 30px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
          }
          .persona-inline-edit-button:hover {
            background: rgba(37, 99, 235, 0.1);
            color: rgba(37, 99, 235, 1);
            transform: translateY(-1px);
          }
          .persona-inline-edit-button:focus-visible {
            outline: 2px solid rgba(37, 99, 235, 0.6);
            outline-offset: 2px;
          }
          .persona-inline-edit-actions {
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .persona-inline-edit-action {
            border: none;
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            color: #fff;
            background: rgba(37, 99, 235, 0.92);
            transition: background 0.2s ease, transform 0.2s ease;
          }
          .persona-inline-edit-action:hover {
            background: rgba(30, 64, 175, 0.92);
            transform: translateY(-1px);
          }
          .persona-inline-edit-action:disabled {
            opacity: 0.6;
            cursor: progress;
            transform: none;
          }
          .persona-inline-edit-action--secondary {
            background: rgba(148, 163, 184, 0.28);
            color: rgba(15, 23, 42, 0.76);
          }
          .persona-inline-edit-action--secondary:hover {
            background: rgba(148, 163, 184, 0.45);
            color: rgba(15, 23, 42, 0.88);
          }
          .persona-inline-error {
            margin: 0;
            color: #ef4444;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.4;
          }
          .persona-inline-error--avatar {
            text-align: center;
            font-size: 11px;
          }
          .persona-expanded-block ul {
            margin: 0;
            padding-left: 0;
            list-style-position: inside;
            font-size: 13px;
            line-height: 1.5;
            color: rgba(30, 41, 59, 0.75);
            flex: 1 1 auto;
            min-height: 0;
          }
          .persona-expanded-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding-right: 4px;
            max-height: 100%;
          }
          .persona-expanded-list-item {
            width: 100%;
            background: rgba(30, 41, 59, 0.06);
            border-radius: 10px;
            padding: 10px 12px;
            padding-right: 44px;
            word-break: break-word;
            overflow-wrap: anywhere;
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
            word-break: break-word;
            overflow-wrap: anywhere;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .persona-doc-meta {
            font-size: 12px;
            color: rgba(30, 41, 59, 0.65);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .persona-expanded-add {
            align-self: flex-start;
            margin-top: auto;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 50%;
            border: 1px solid rgba(43, 108, 176, 0.35);
            background: transparent;
            color: rgba(43, 108, 176, 0.85);
            font-size: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: border-color 0.18s ease;
          }
          .persona-expanded-add__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 16px;
            font-weight: 700;
            line-height: 1;
          }
          .persona-expanded-block--intent-signals {
            position: relative;
            padding-bottom: 76px;
          }
          .persona-expanded-block--intent-signals .persona-edit-intent-list,
          .persona-expanded-block--intent-signals .persona-edit-intent-empty,
          .persona-expanded-block--intent-signals .persona-expanded-list {
            margin-bottom: 0;
          }
          .persona-expanded-block--documents,
          .persona-expanded-block--external {
            padding-bottom: 10;
          }
          .persona-expanded-block--documents .persona-edit-documents,
          .persona-expanded-block--documents .persona-edit-documents--inline,
          .persona-expanded-block--documents .persona-edit-documents--empty {
            margin-bottom: 0;
          }
          .persona-expanded-block__header-labels {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .persona-expanded-manage,
          .persona-expanded-external-manage {
            border-radius: 999px;
            border: none;
            background: transparent;
            color: #0f172a;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: none;
            padding: 6px 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: pointer;
            transition: transform 0.2s ease;
          }
          .persona-expanded-manage svg,
          .persona-expanded-external-manage svg {
            display: block;
          }
          .persona-expanded-add--floating {
            position: absolute;
            right: 20px;
            bottom: 20px;
            margin-top: 0;
          }
          .persona-expanded-add:hover {
            border-color: rgba(59, 130, 246, 0.6);
          }
          .persona-expanded-add:focus-visible {
            border-color: rgba(59, 130, 246, 0.6);
            outline: 2px solid rgba(59, 130, 246, 0.45);
            outline-offset: 2px;
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
          .persona-card-button[aria-disabled="true"]:hover .persona-card,
          .persona-card-button[aria-disabled="true"]:focus-visible .persona-card {
            transform: none;
            box-shadow: 0 18px 36px rgba(10, 22, 40, 0.12);
            border-color: rgba(43, 108, 176, 0.18);
            background-color: rgba(255, 255, 255, 0.96);
          }
          .persona-card__body {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 8px;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 14px;
            flex: 1 1 auto;
          }
          .persona-card-button[aria-expanded="true"] .persona-card__body {
            margin-bottom: 0;
            display: block;
            gap: 0;
            flex: 0 0 auto;
            min-height: auto;
          }
          .persona-card__footer {
            margin-top: auto;
            width: 100%;
          }
          .persona-card__title-row {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            flex-wrap: wrap;
            justify-content: space-between;
            flex: 0 0 auto;
          }
          .persona-card__title-left {
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 0;
            padding-right: 60px;
          }
          .persona-card__title-left--expanded {
            padding-right: 0;
          }
          .persona-card__title-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
            flex: 0 0 auto;
            margin-top: 6px;
          }
          .persona-card__avatar-floating {
            position: absolute;
            top: 10px;
            right: 12px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            overflow: hidden;
            background: rgba(248, 250, 252, 0.92);
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .persona-card__avatar-stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            min-width: 56px;
          }
          .persona-card__avatar-inline {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            overflow: hidden;
            border: 1px solid rgba(15, 23, 42, 0.12);
            background: rgba(248, 250, 252, 0.92);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            cursor: pointer;
            transition: box-shadow 0.2s ease;
            padding: 0;
            appearance: none;
            font: inherit;
          }
          .persona-card__avatar-inline:hover,
          .persona-card__avatar-inline:focus-visible {
            box-shadow: 0 10px 22px rgba(15, 23, 42, 0.22);
          }
          .persona-card__avatar-inline:focus-visible {
            outline: 2px solid rgba(37, 99, 235, 0.45);
            outline-offset: 3px;
          }
          .persona-card__avatar-inline--disabled,
          .persona-card__avatar-inline:disabled {
            cursor: default;
            pointer-events: none;
          }
          .persona-card__avatar-inline--disabled:hover,
          .persona-card__avatar-inline--disabled:focus-visible,
          .persona-card__avatar-inline:disabled:hover,
          .persona-card__avatar-inline:disabled:focus-visible {
            box-shadow: none;
            outline: none;
          }
          .persona-card__avatar {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .persona-card__avatar-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 20px;
            color: rgba(15, 23, 42, 0.68);
            background: rgba(241, 245, 249, 0.88);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
          }
          .persona-card__avatar-placeholder--image {
            color: transparent;
            background-color: transparent;
          }
          .persona-card__avatar-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 23, 42, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(241, 245, 249, 0.94);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }
          .persona-card__avatar-inline:hover .persona-card__avatar-overlay,
          .persona-card__avatar-inline:focus-visible .persona-card__avatar-overlay {
            opacity: 1;
          }
          .persona-card__avatar-inline--disabled .persona-card__avatar-overlay,
          .persona-card__avatar-inline:disabled .persona-card__avatar-overlay {
            display: none;
          }
          .persona-card__avatar-upload-icon {
            width: 24px;
            height: 24px;
          }
          .persona-card__title-main {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 0;
            flex-wrap: wrap;
          }
          .persona-card__title {
            margin: 0;
            font-weight: 700;
            font-size: 18px;
            color: var(--text);
            border: 1px solid transparent;
            border-radius: 10px;
            padding: 0px 8px 0px;
            padding-left: 0;
            transition: border-color 0.2s ease, background-color 0.2s ease;
            margin-bottom: 0px;
          }
          .persona-card__title--editable:hover {
            border-color: rgba(15, 23, 42, 0.16);
            background-color: rgba(248, 250, 252, 0.65);
            cursor: text;
          }
          .persona-card__name-editor {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .persona-card__name-input {
            width: 100%;
            border-radius: 10px;
            border: 1px solid rgba(30, 41, 59, 0.2);
            padding: 4px 8px;
            font-size: 18px;
            font-weight: 700;
            font-family: inherit;
            color: var(--text);
            background: rgba(248, 250, 252, 0.9);
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
          }
          .persona-card__name-input:focus {
            outline: none;
            border-color: rgba(37, 99, 235, 0.65);
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18);
            background: #fff;
          }
          .persona-card__name-input:disabled {
            opacity: 0.6;
            cursor: progress;
          }
          .persona-card__scalar-traits {
            margin-top: 8px;
            margin-bottom: 6px;
          }
          .persona-card-button[aria-expanded="true"] .persona-card__scalar-traits {
            margin-bottom: 0;
          }
          .persona-card__traits-inline {
            margin: 6px 0 0;
            font-size: 13px;
            color: rgba(30, 41, 59, 0.7);
          }
          .persona-card__expanded-meta {
            display: flex;
            justify-content: flex-end;
            margin-top: 4px;
            margin-bottom: 6px;
          }
          .persona-title-actions {
            display: inline-flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
            height: 100%;
          }
          .persona-title-actions--inline {
            justify-content: flex-end;
          }
          .persona-title-actions__group {
            display: inline-flex;
            align-items: center;
            gap: 22px;
            flex-wrap: wrap;
          }
          .persona-title-cta {
            border: none;
            background: #0f172a;
            color: #f8fafc;
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.4px;
            text-transform: none;
            padding: 8px 16px;
            border-radius: 999px;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 10px;
          }
          .persona-title-cta--compact {
            background: transparent;
            color: rgba(15, 23, 42, 0.72);
            font-weight: 600;
            font-size: 11px;
            letter-spacing: 0.15px;
            text-transform: none;
            padding: 4px 10px;
            border: 1px solid rgba(15, 23, 42, 0.12);
            gap: 6px;
            transform: none;
            transition: color 0.2s ease, border-color 0.2s ease;
          }
          .persona-title-cta--compact:hover {
            background: rgba(15, 23, 42, 0.12);
            color: rgba(15, 23, 42, 0.88);
            transform: none;
            border-color: rgba(15, 23, 42, 0.18);
          }
          .persona-title-cta:not(.persona-title-cta--compact):hover {
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
          .persona-card__role-container {
            margin-top: 0px;
            padding-right: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .persona-card__role-title {
            margin: 0;
            font-size: 13px;
            line-height: 1.35;
            color: #475569;
            font-family: var(--font-heading, var(--font-body, var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif)));
            font-weight: 500;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
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
            gap: 6px;
            z-index: 1;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          .persona-status__spinner {
            width: 12px;
            height: 12px;
            border-radius: 999px;
            border: 2px solid rgba(15, 23, 42, 0.35);
            border-top-color: #0f172a;
            animation: persona-status-spin 0.9s linear infinite;
            flex-shrink: 0;
          }
          @keyframes persona-status-spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
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
            margin-top: 0px;
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
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
            width: 100%;
            border-radius: 10px;
            border: none;
            background: rgba(30, 41, 59, 0.06);
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            text-align: left;
            box-shadow: none;
          }
          .persona-edit-document-card--note {
            padding: 16px 18px;
            padding-right: 52px;
            gap: 0;
          }
          .persona-edit-document-meta {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
            color: rgba(30, 41, 59, 0.65);
          }
          .persona-edit-document-meta--note {
            gap: 10px;
            min-height: 48px;
          }
          .persona-edit-document-title {
            font-weight: 700;
            font-size: 13px;
            color: #1e293b;
            letter-spacing: 0.2px;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .persona-edit-document-input {
            width: 100%;
            border-radius: 10px;
            border: none;
            background: rgba(30, 41, 59, 0.06);
            color: #1e293b;
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.5;
            transition: outline 0.18s ease;
            font-family: inherit;
          }
          .persona-edit-document-input::placeholder {
            color: rgba(71, 85, 105, 0.6);
          }
          .persona-edit-document-input:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.45);
            outline-offset: 2px;
          }
          .persona-edit-document-input:disabled {
            opacity: 0.6;
            cursor: default;
          }
          .persona-edit-document-note-text {
            font-size: 13px;
            color: #1e293b;
            line-height: 1.6;
            white-space: pre-line;
          }
          .persona-edit-document-details {
            line-height: 1.4;
          }
          .persona-edit-document-actions {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
          }
          .persona-edit-document-open {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            border: none;
            background: transparent;
            color: rgba(41, 98, 255, 0.9);
            padding: 0;
            font-size: 12px;
            letter-spacing: 0.2px;
            font-weight: 600;
            cursor: pointer;
            transition: color 0.16s ease;
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
            color: rgba(29, 78, 216, 1);
            text-decoration: underline;
            outline: none;
          }
          .persona-edit-document-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(148, 163, 184, 0.4);
            background: rgba(255, 255, 255, 0.7);
            color: rgba(71, 85, 105, 0.85);
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
          }
          .persona-edit-document-close:hover,
          .persona-edit-document-close:focus-visible {
            background: rgba(226, 232, 240, 0.85);
            border-color: rgba(148, 163, 184, 0.6);
            color: rgba(30, 41, 59, 0.9);
            outline: none;
          }
          /* Empty two-column grid placeholder shown at top of expanded Edit card */
          .persona-edit-meta-row {
            display: flex;
            align-items: center;
            justifyContent: space-between;
            gap: 12px;
            margin-bottom: 14px;
            width: 100%;
          }
          .persona-edit-meta-chips {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
            margin-bottom: 0;
            padding: 4px;
            width: 100%;
            flex: 1 1 auto;
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
          .persona-edit-delete-chip {
            border: 1px solid rgba(239, 68, 68, 0.35);
            background: rgba(239, 68, 68, 0.12);
            color: rgba(252, 165, 165, 0.92);
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 6px 18px;
            border-radius: 999px;
            letter-spacing: 0.5px;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
          }
          .persona-edit-delete-chip:hover,
          .persona-edit-delete-chip:focus-visible {
            background: rgba(220, 38, 38, 0.2);
            border-color: rgba(239, 68, 68, 0.55);
            color: rgba(254, 202, 202, 0.96);
            outline: none;
          }
          .persona-actions-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            z-index: 1200;
          }
          .persona-actions-modal-dialog {
            position: relative;
            width: min(440px, 100%);
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
            padding: 32px 28px 28px;
          }
          .persona-actions-modal-close {
            position: absolute;
            top: 12px;
            right: 12px;
            border: none;
            background: transparent;
            color: #0f172a;
            font-size: 26px;
            line-height: 1;
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .persona-actions-modal-close:focus-visible {
            outline: 2px solid #2563eb;
            outline-offset: 2px;
          }
          .persona-actions-modal-content {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .persona-actions-modal-title {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
          }
          .persona-actions-modal-description {
            margin: 0;
            font-size: 14px;
            color: #475569;
          }
          .persona-voice-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.58);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 32px 16px;
            z-index: 1100;
          }
          .persona-voice-modal-dialog {
            background: #ffffff;
            color: #0f172a;
            border-radius: 28px;
            width: min(880px, 100%);
            max-height: min(94vh, 1040px);
            min-height: min(78vh, 820px);
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.32);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
          }
          .persona-voice-modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 24px;
            padding: 32px 36px 24px;
          }
          .persona-voice-modal-heading h3 {
            margin: 0;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 0.3px;
          }
          .persona-voice-modal-heading p {
            margin: 8px 0 0;
            font-size: 15px;
            color: rgba(15, 23, 42, 0.68);
            line-height: 1.6;
            max-width: 480px;
          }
          .persona-voice-modal-close {
            border: none;
            background: rgba(15, 23, 42, 0.08);
            color: #0f172a;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 24px;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s ease, transform 0.2s ease;
            flex-shrink: 0;
          }
          .persona-voice-modal-close:hover {
            background: rgba(15, 23, 42, 0.16);
            transform: translateY(-1px);
          }
          .persona-voice-modal-close:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.55);
            outline-offset: 2px;
          }
          .persona-voice-modal-body {
            flex: 1 1 auto;
            padding: 0 36px 36px;
            overflow-y: auto;
            display: flex;
          }
          .persona-voice-layout {
            display: flex;
            flex-direction: column;
            gap: 24px;
            width: 100%;
            align-items: stretch;
          }
          .persona-voice-panel {
            border-radius: 24px;
            padding: 28px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            position: relative;
          }
          .persona-voice-panel__heading {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: #0f172a;
          }
          .persona-voice-panel__subtext {
            margin: 0;
            font-size: 13px;
            letter-spacing: 0.2px;
            color: rgba(71, 85, 105, 0.85);
            margin-bottom: 12px;
          }
          .persona-voice-panel--form {
            background: linear-gradient(135deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.88));
            border: 1px solid rgba(148, 163, 184, 0.25);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
          }
          .persona-voice-panel--languages {
            background: rgba(248, 250, 252, 0.85);
            border: 1px solid rgba(148, 163, 184, 0.22);
          }
          .persona-voice-select {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .persona-voice-select__trigger {
            border: 1px solid rgba(148, 163, 184, 0.6);
            border-radius: 14px;
            padding: 12px 48px 12px 16px;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.2px;
            color: #0f172a;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            cursor: pointer;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          }
          .persona-voice-select__trigger:hover {
            border-color: rgba(71, 85, 105, 0.8);
            background: rgba(248, 250, 252, 0.92);
          }
          .persona-voice-select__trigger:focus-visible {
            outline: 2px solid rgba(59, 130, 246, 0.55);
            outline-offset: 3px;
            border-color: rgba(59, 130, 246, 0.75);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
          }
          .persona-voice-select__trigger-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .persona-voice-select__trigger-meta {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }
          .persona-voice-select__chip-row {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-wrap: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            justify-content: flex-end;
          }
          .persona-voice-select__chevron {
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid rgba(71, 85, 105, 0.8);
          }
          .persona-voice-select__menu {
            position: absolute;
            top: calc(100% + 8px);
            left: 0;
            right: 0;
            background: #ffffff;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 16px;
            box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 240px;
            overflow-y: auto;
            z-index: 10;
          }
          .persona-voice-select__option {
            border: none;
            background: transparent;
            border-radius: 12px;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
            cursor: pointer;
            transition: background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
          }
          .persona-voice-select__option:hover,
          .persona-voice-select__option:focus-visible {
            background: rgba(59, 130, 246, 0.08);
            outline: none;
          }
          .persona-voice-select__option--active {
            background: rgba(59, 130, 246, 0.12);
            box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.35);
          }
          .persona-voice-select__option-label {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.25px;
            color: rgba(15, 23, 42, 0.85);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
          }
          .persona-voice-select__option-main {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            max-width: 45%;
            flex: 1;
          }
          .persona-voice-select__option-title {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
          }
          .persona-voice-select__option-actions {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
            max-width: 60%;
            justify-content: flex-end;
            min-width: 0;
          }
          .persona-voice-preview-btn {
            border: 1px solid rgba(59, 130, 246, 0.4);
            background: rgba(59, 130, 246, 0.1);
            color: #1d4ed8;
            border-radius: 999px;
            padding: 6px;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .persona-voice-preview-btn:hover,
          .persona-voice-preview-btn:focus-visible {
            background: rgba(59, 130, 246, 0.18);
            border-color: rgba(59, 130, 246, 0.6);
            transform: translateY(-1px);
            outline: none;
          }
          .persona-voice-preview-btn--playing {
            background: rgba(15, 23, 42, 0.12);
            border-color: rgba(15, 23, 42, 0.35);
            color: #0f172a;
          }
          .persona-voice-preview-btn--disabled {
            opacity: 0.55;
            cursor: default;
            background: rgba(148, 163, 184, 0.18);
            border-color: rgba(148, 163, 184, 0.35);
            color: rgba(71, 85, 105, 0.8);
            transform: none;
          }
          .persona-voice-preview-icon {
            display: inline-flex;
          }
          .persona-voice-preview-btn--disabled:hover,
          .persona-voice-preview-btn--disabled:focus-visible {
            transform: none;
            background: rgba(148, 163, 184, 0.18);
            border-color: rgba(148, 163, 184, 0.35);
          }
          .persona-voice-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid rgba(37, 99, 235, 0.25);
            background: rgba(59, 130, 246, 0.12);
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .persona-voice-chip--neutral {
            border-color: rgba(15, 23, 42, 0.2);
            background: rgba(15, 23, 42, 0.08);
            color: #0f172a;
          }
          .persona-language-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .persona-language-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(59, 130, 246, 0.08);
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.2px;
            white-space: nowrap;
          }
          .persona-language-chip__emoji {
            font-size: 16px;
            line-height: 1;
          }
          .persona-language-chip__label {
            display: inline-flex;
            align-items: center;
          }
          .persona-voice-status {
            margin: 0;
            font-size: 13px;
            letter-spacing: 0.2px;
            color: rgba(71, 85, 105, 0.85);
            background: rgba(226, 232, 240, 0.6);
            border: 1px solid rgba(148, 163, 184, 0.35);
            border-radius: 16px;
            padding: 14px 16px;
          }
          .persona-voice-error {
            margin: 0;
            font-size: 13px;
            letter-spacing: 0.2px;
            color: #b91c1c;
          }
          .persona-voice-empty {
            border: 1px dashed rgba(148, 163, 184, 0.55);
            border-radius: 18px;
            padding: 24px;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(71, 85, 105, 0.82);
          }
          @media (max-width: 720px) {
            .persona-voice-modal-dialog {
              border-radius: 20px;
              max-height: 96vh;
              min-height: 88vh;
            }
            .persona-voice-modal-header {
              padding: 24px;
              gap: 18px;
            }
            .persona-voice-modal-body {
              padding: 0 24px 24px;
            }
            .persona-voice-panel {
              padding: 24px;
              border-radius: 20px;
            }
          }
          .persona-actions-modal-options {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .persona-actions-modal-option {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.45);
            border-radius: 14px;
            background: rgba(248, 250, 252, 0.85);
            padding: 14px 16px;
            text-align: left;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 4px;
            transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
            color: #0f172a;
            font-size: 15px;
            font-weight: 600;
          }
          .persona-actions-modal-option:hover,
          .persona-actions-modal-option:focus-visible {
            border-color: rgba(15, 23, 42, 0.3);
            background: rgba(248, 250, 252, 1);
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
            outline: none;
          }
          .persona-actions-modal-option-label {
            font-weight: 600;
          }
          .persona-actions-modal-option-description {
            font-size: 13px;
            color: #64748b;
            font-weight: 400;
          }
          .persona-actions-modal-option--danger {
            border-color: rgba(248, 113, 113, 0.45);
            background: rgba(254, 242, 242, 0.9);
            color: #b91c1c;
          }
          .persona-actions-modal-option--danger:hover,
          .persona-actions-modal-option--danger:focus-visible {
            border-color: rgba(185, 28, 28, 0.8);
            background: rgba(254, 226, 226, 1);
            box-shadow: 0 12px 24px rgba(185, 28, 28, 0.2);
            outline: none;
          }
          .persona-actions-modal-option--danger .persona-actions-modal-option-description {
            color: #b91c1c;
          }
          .persona-actions-modal-share-status {
            margin-top: 12px;
            font-size: 12px;
            color: rgba(15, 23, 42, 0.7);
          }
          .persona-actions-confirm {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 12px;
            margin-top: 24px;
          }
          .persona-actions-confirm-cancel {
            border: 1px solid rgba(148, 163, 184, 0.6);
            background: transparent;
            color: #0f172a;
            border-radius: 12px;
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
          }
          .persona-actions-confirm-cancel:hover,
          .persona-actions-confirm-cancel:focus-visible {
            border-color: rgba(15, 23, 42, 0.4);
            background: rgba(241, 245, 249, 1);
            outline: none;
          }
          .persona-actions-confirm-delete {
            border: none;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: #ffffff;
            border-radius: 12px;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 10px 20px rgba(220, 38, 38, 0.25);
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          .persona-actions-confirm-delete:hover,
          .persona-actions-confirm-delete:focus-visible {
            transform: translateY(-1px);
            box-shadow: 0 14px 28px rgba(220, 38, 38, 0.3);
            outline: none;
          }
          .persona-actions-confirm-delete:disabled {
            opacity: 0.7;
            cursor: default;
            transform: none;
            box-shadow: none;
          }
          .persona-actions-confirm-cancel:disabled {
            opacity: 0.7;
            cursor: default;
          }
          .persona-actions-confirm-error {
            margin: 16px 0 0;
            color: #b91c1c;
            font-size: 13px;
          }
          .persona-delete-confirm-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(7, 15, 35, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1300;
            padding: 24px;
          }
          .persona-delete-confirm-dialog {
            position: relative;
            max-width: 420px;
            width: 100%;
            background: #0f1628;
            border: 1px solid rgba(239, 68, 68, 0.35);
            border-radius: 18px;
            box-shadow: 0 28px 80px rgba(7, 15, 35, 0.45);
            padding: 28px 32px 32px;
            color: rgba(226, 232, 240, 0.92);
          }
          .persona-delete-confirm-close {
            position: absolute;
            top: 14px;
            right: 14px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 1px solid rgba(239, 68, 68, 0.35);
            background: transparent;
            color: rgba(252, 165, 165, 0.92);
            font-size: 20px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-delete-confirm-close:hover,
          .persona-delete-confirm-close:focus-visible {
            background: rgba(220, 38, 38, 0.22);
            border-color: rgba(239, 68, 68, 0.55);
            outline: none;
          }
          .persona-delete-confirm-content h3 {
            margin: 0 0 12px;
            font-size: 18px;
            font-weight: 700;
            color: rgba(252, 165, 165, 0.95);
          }
          .persona-delete-confirm-content p {
            margin: 0 0 22px;
            font-size: 14px;
            line-height: 1.55;
            color: rgba(226, 232, 240, 0.9);
          }
          .persona-delete-confirm-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }
          .persona-delete-confirm-cancel {
            border: 1px solid rgba(148, 163, 184, 0.45);
            background: rgba(15, 22, 40, 0.9);
            color: rgba(226, 232, 240, 0.9);
            border-radius: 10px;
            padding: 8px 18px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-delete-confirm-cancel:disabled {
            opacity: 0.6;
            cursor: default;
          }
          .persona-delete-confirm-cancel:hover,
          .persona-delete-confirm-cancel:focus-visible {
            background: rgba(30, 41, 59, 0.95);
            border-color: rgba(148, 163, 184, 0.75);
            outline: none;
          }
          .persona-delete-confirm-delete {
            border: 1px solid rgba(239, 68, 68, 0.45);
            background: rgba(239, 68, 68, 0.16);
            color: rgba(252, 165, 165, 0.96);
            border-radius: 10px;
            padding: 8px 20px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.18s ease, border-color 0.18s ease;
          }
          .persona-delete-confirm-delete:disabled {
            opacity: 0.6;
            cursor: default;
            background: rgba(239, 68, 68, 0.12);
          }
          .persona-delete-confirm-delete:hover,
          .persona-delete-confirm-delete:focus-visible {
            background: rgba(220, 38, 38, 0.24);
            border-color: rgba(239, 68, 68, 0.65);
            outline: none;
          }
          .persona-delete-confirm-error {
            margin-top: 14px;
            font-size: 13px;
            color: rgba(252, 165, 165, 0.95);
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
            width: 100%;
          }
          .persona-edit-key-traits__chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .persona-edit-key-trait {
            border: 1px dashed rgba(15, 23, 42, 0.3);
            border-radius: 999px;
            background: rgba(248, 250, 252, 0.8);
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            transition: border 0.18s ease, background 0.18s ease;
          }
          .persona-edit-key-trait__label {
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
          .persona-edit-key-trait__remove {
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
          .persona-edit-key-trait__remove:hover,
          .persona-edit-key-trait__remove:focus-visible {
            background: rgba(248, 113, 113, 0.3);
            outline: none;
          }
          .persona-edit-key-trait__input {
            border: none;
            background: transparent;
            font-size: 13px;
            font-weight: 600;
            color: rgba(15, 23, 42, 0.85);
            min-width: 80px;
          }
          .persona-edit-key-trait__input:focus-visible {
            outline: none;
          }
          .persona-edit-key-traits__add {
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
            min-width: 16px;
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
          .persona-edit-intent-add {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0;
            border-radius: 50%;
            border: 1px solid transparent;
            background: transparent;
            font-size: 16px;
            line-height: 1;
            cursor: pointer;
            transition: border-color 0.18s ease, color 0.18s ease;
          }
          .persona-edit-intent-add {
            border-color: rgba(59, 130, 246, 0.35);
            color: rgba(59, 130, 246, 0.85);
          }
          .persona-edit-intent-add:hover {
            border-color: rgba(59, 130, 246, 0.6);
          }
          .persona-edit-intent-add:focus-visible {
            border-color: rgba(59, 130, 246, 0.6);
            outline: 2px solid rgba(59, 130, 246, 0.45);
            outline-offset: 2px;
          }
          .persona-edit-intent-add__icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            font-size: 16px;
            font-weight: 700;
            line-height: 1;
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
          .persona-edit-intent-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
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
            font-family: var(--font-heading, var(--font-body, var(--font-sans, 'Inter', ui-sans-serif, system-ui, sans-serif)));
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
            background: rgba(30, 41, 59, 0.06);
            border: none;
            box-shadow: none;
            color: #052033;
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
        :global(.persona-root table) {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
          font-family: ${BODY_FONT_STACK};
          font-size: 15px;
        background: transparent;
      }
      :global(.internal-knowledge-overlay__upload-button) {
        background: #1e293b;
        color: #f6f7f9;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
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
        margin-left: 12px;

      }
      :global(.persona-root table th) {
        text-align: left;
          padding: 10px 8px;
          color: rgba(15, 23, 42, 0.65);
          font-size: 13px;
          font-weight: 700;
          border-bottom: 1px solid rgba(15, 23, 42, 0.12);
          position: sticky;
          top: 0;
          z-index: 1;
          background: none;
        }
        :global(.persona-root table td) {
          padding: 10px 8px;
          color: var(--text, #052033);
          background: var(--panel-2, #F6F7F9fff);
          font-size: 15px;
          vertical-align: middle;
        }
        `}</style>
          {internalOverlayPersona ? (
            <SlidingPanelOverlay
              open
              onRequestClose={closeInternalOverlay}
              titleElement={
                <div className="internal-knowledge-overlay__header-row">
                  <span>
                    {internalOverlayPersona.agent_name
                      ? `Docs & Links - ${internalOverlayPersona.agent_name}`
                      : "Docs & Links"}
                  </span>
                </div>
              }
              titleId={internalOverlayTitleId}
              descriptionId={internalOverlayDescriptionId}
              title=""
            >
            <InternalKnowledgeOverlayContent
              personaName={internalOverlayPersona.agent_name ?? "Persona"}
              documents={internalOverlayDocuments}
              isLoading={documentsLoading}
              overlayTitleId={internalOverlayTitleId}
              overlayDescriptionId={internalOverlayDescriptionId}
              onRemoveDocument={handleRemoveAgentDocument}
              showUploadCard={docsUploadCardOpen}
              onUploadDocuments={handleUploadDocuments}
              isUploadingDocuments={isUploadingDocument}
              onRequestShowUploadCard={handleToggleUploadCard}
              onAddDocumentLink={handleAddDocumentLink}
              isAddingLink={isAddingLink}
              activeUploadMode={activeUploadMode}
            />
            </SlidingPanelOverlay>
          ) : null}
          {selectedAgent ? (
            <SlidingPanelOverlay
              open
              onRequestClose={closeResearchOverlay}
              title={`Supporting Research for ${selectedAgent.personaName}`}
              titleElement={
                <div className="research-overlay__title">
                  <div>{`Supporting Research for ${selectedAgent.personaName}`}</div>
                  <p className="research-overlay__updated research-overlay__updated--title">
                    Last updated {" "}
                    <strong>{formatResearchUpdatedAt(selectedAgent.updatedAt)}</strong> {" "}
                    <span className="research-overlay__refresh-note">(refreshes weekly)</span>
                  </p>
                </div>
              }
              titleId={overlayTitleId}
              descriptionId={overlayDescriptionId}
            >
              <ResearchOverlayContent
                agent={selectedAgent}
                activeTab={activeOverlayTab}
                setActiveTabAction={setActiveOverlayTab}
                promptValue={promptValue}
                isPromptDirty={isPromptDirty}
                isPromptSaving={isPromptSaving}
                promptSaveError={promptSaveError}
                onPromptChangeAction={handlePromptChange}
                onPromptSaveAction={handlePromptSaveCurrent}
                onClearPrompt={handleClearPrompt}
                onRemoveArticle={handleRemoveSourcedArticle}
                onAddArticle={handleAddResearchArticle}
                overlayTitleId={overlayTitleId}
                overlayDescriptionId={overlayDescriptionId}
                selectedSources={targetSources}
                onSourceToggle={toggleTargetSource}
              />
            </SlidingPanelOverlay>
          ) : null}
          {descriptionOverlayPersona ? (
            <SlidingPanelOverlay
              open
              onRequestClose={closeDescriptionOverlay}
              title={
                <div className="persona-expanded-block__header-labels">
                  Key Info - {descriptionOverlayPersona.agent_name}
                </div>
              }
              titleId={descriptionOverlayTitleId}
              descriptionId={descriptionOverlayDescriptionId}
            >
            <section className="persona-expanded-block persona-expanded-block--description persona-expanded-block--overlay">
                <div className="persona-description-overlay">
                  <div className="persona-description-section">
                    <p className="persona-description-section__heading">Key traits</p>
                    {canEdit ? (
                      <div className="persona-edit-key-traits">
                        <div className="persona-edit-key-traits__chips">
                          {descriptionOverlayTraitList.map((trait, index) => (
                            <div
                              key={`description-overlay-trait-${trait}-${index}`}
                              className="persona-edit-key-trait"
                            >
                              {descriptionOverlayChipEditingIndex === index ? (
                                <input
                                  id={`description-overlay-trait-${index}`}
                                  className="persona-edit-key-trait__input"
                                  value={descriptionOverlayChipEditingValue}
                                  placeholder="Add key trait"
                                  autoFocus
                                  onChange={(event) => {
                                    setDescriptionOverlayChipEditingValue(event.target.value);
                                  }}
                                  onBlur={() => {
                                    void handleDescriptionOverlayChipCommit();
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleDescriptionOverlayChipCommit();
                                    } else if (event.key === "Escape") {
                                      event.preventDefault();
                                      handleDescriptionOverlayCancelEdit();
                                    }
                                  }}
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="persona-edit-key-trait__label"
                                    onClick={() => handleDescriptionOverlayStartEdit(index, trait)}
                                  >
                                    {trait}
                                  </button>
                                  <button
                                    type="button"
                                    className="persona-edit-key-trait__remove"
                                    aria-label={`Remove ${trait}`}
                                    onClick={() => handleDescriptionOverlayDelete(index)}
                                  >
                                    ×
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          {descriptionOverlayChipEditingIndex === descriptionOverlayTraitList.length && (
                            <div className="persona-edit-key-trait">
                              <input
                                id="description-overlay-trait-new"
                                className="persona-edit-key-trait__input"
                                value={descriptionOverlayChipEditingValue}
                                placeholder="Add key trait"
                                autoFocus
                                onChange={(event) => {
                                  setDescriptionOverlayChipEditingValue(event.target.value);
                                }}
                                onBlur={() => {
                                  void handleDescriptionOverlayChipCommit();
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleDescriptionOverlayChipCommit();
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleDescriptionOverlayCancelEdit();
                                  }
                                }}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className="persona-edit-key-traits__add"
                            onClick={handleDescriptionOverlayAddTrait}
                          >
                            Add trait
                          </button>
                        </div>
                        {descriptionOverlayTraitList.length === 0 ? (
                          <p className="persona-description-section__empty">No key traits added yet.</p>
                        ) : null}
                        {isSavingDescriptionOverlayTraits ? (
                          <span className="persona-edit-status">Saving…</span>
                        ) : descriptionOverlayTraitsError ? (
                          <span className="persona-edit-error persona-edit-error--inline">
                            {descriptionOverlayTraitsError}
                          </span>
                        ) : null}
                      </div>
                    ) : descriptionOverlayTraitList.length > 0 ? (
                      <div className="persona-description__traits">
                        {descriptionOverlayTraitList.map((trait) => (
                          <span key={trait} className="persona-description__trait-chip">
                            {trait}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="persona-description-section__empty">No key traits added yet.</p>
                    )}
                  </div>
                  <div className="persona-description-section">
                    <p className="persona-description-section__heading">Persona description</p>
                    {canEdit ? (
                      <>
                        <textarea
                          className="persona-description__input persona-description__input--overlay"
                          value={descriptionOverlayDraft}
                          placeholder={
                            descriptionOverlayPersona.description && descriptionOverlayPersona.description.trim().length > 0
                              ? undefined
                              : "No description provided yet."
                          }
                          onChange={(event) => {
                            setDescriptionOverlayDraft(event.target.value);
                            setDescriptionOverlayError(null);
                          }}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault();
                              void handleSaveDescriptionOverlay();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              setDescriptionOverlayDraft(descriptionOverlayPersona.description ?? "");
                              setDescriptionOverlayError(null);
                              (event.currentTarget as HTMLTextAreaElement).blur();
                            }
                          }}
                          disabled={isSavingDescriptionOverlay}
                        />
                        {descriptionOverlayError ? (
                          <p className="persona-edit-error">{descriptionOverlayError}</p>
                        ) : null}
                      </>
                    ) : (
                    <p>
                      {descriptionOverlayPersona.description && descriptionOverlayPersona.description.trim().length > 0
                        ? descriptionOverlayPersona.description
                        : "No description provided yet."}
                    </p>
                  )}
                  </div>
                  <div className="persona-description-section">
                    <p className="persona-description-section__heading">Pain Points</p>
                    {canEdit ? (
                      <textarea
                        className="persona-description__input persona-description__input--overlay"
                        value={descriptionOverlayPainPoints}
                        placeholder="Describe the persona’s pain points"
                        onChange={(event) => {
                          setDescriptionOverlayPainPoints(event.target.value);
                        }}
                        disabled={isSavingDescriptionOverlay}
                      />
                    ) : descriptionOverlayPainPoints.trim().length > 0 ? (
                      <p>{descriptionOverlayPainPoints}</p>
                    ) : (
                      <p className="persona-description-section__empty">Pain points will appear once added.</p>
                    )}
                  </div>
                  <div className="persona-description-section">
                    <p className="persona-description-section__heading">Jobs To Be Done</p>
                    {canEdit ? (
                      <textarea
                        className="persona-description__input persona-description__input--overlay"
                        value={descriptionOverlayJobsToBeDone}
                        placeholder="Describe the persona’s jobs to be done"
                        onChange={(event) => {
                          setDescriptionOverlayJobsToBeDone(event.target.value);
                        }}
                        disabled={isSavingDescriptionOverlay}
                      />
                    ) : descriptionOverlayJobsToBeDone.trim().length > 0 ? (
                      <p>{descriptionOverlayJobsToBeDone}</p>
                    ) : (
                      <p className="persona-description-section__empty">Jobs to be done will appear once added.</p>
                    )}
                  </div>
                  {canEdit ? (
                    <div className="persona-description-overlay__footer">
                      <button
                        type="button"
                        className="persona-description-section__reset"
                        onClick={() => {
                          resetDescriptionOverlayFields();
                        }}
                        disabled={isSavingDescriptionOverlay}
                      >
                        Clear
                      </button>
                      <PillButton
                        type="button"
                        onClick={() => {
                          void handleSaveDescriptionOverlay();
                        }}
                        disabled={isSavingDescriptionOverlay || !descriptionOverlayHasAnyChanges}
                        className="persona-description-overlay__save"
                      >
                        {isSavingDescriptionOverlay ? "Saving…" : "Save"}
                      </PillButton>
                    </div>
                  ) : null}
                </div>
              </section>
            </SlidingPanelOverlay>
          ) : null}
        </main>
      </div>
      {isMounted && unsavedChangesBanner
        ? createPortal(unsavedChangesBanner, document.body)
        : null}
    </>
  );
}
