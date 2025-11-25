"use client";

import { KeyboardEvent, MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
const responsesIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#091F5B" viewBox="0 0 16 16">
    <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z" />
  </svg>
);
const newIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#22325A" viewBox="0 0 16 16">
    <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022zm2.004.45a7 7 0 0 0-.985-.299l.219-.976q.576.129 1.126.342zm1.37.71a7 7 0 0 0-.439-.27l.493-.87a8 8 0 0 1 .979.654l-.615.789a7 7 0 0 0-.418-.302zm1.834 1.79a7 7 0 0 0-.653-.796l.724-.69q.406.429.747.91zm.744 1.352a7 7 0 0 0-.214-.468l.893-.45a8 8 0 0 1 .45 1.088l-.95.313a7 7 0 0 0-.179-.483m.53 2.507a7 7 0 0 0-.1-1.025l.985-.17q.1.58.116 1.17zm-.131 1.538q.05-.254.081-.51l.993.123a8 8 0 0 1-.23 1.155l-.964-.267q.069-.247.12-.501m-.952 2.379q.276-.436.486-.908l.914.405q-.24.54-.555 1.038zm-.964 1.205q.183-.183.35-.378l.758.653a8 8 0 0 1-.401.432z" />
    <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0z" />
    <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5" />
  </svg>
);
const personaLinkIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243z" />
  </svg>
);
const personaQrIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
    <path d="M2 2h2v2H2z" />
    <path d="M6 0v6H0V0zM5 1H1v4h4zM4 12H2v2h2z" />
    <path d="M6 10v6H0v-6zm-5 1v4h4v-4zm11-9h2v2h-2z" />
    <path d="M10 0v6h6V0zm5 1v4h-4V1zM8 1V0h1v2H8v2H7V1zm0 5V4h1v2zM6 8V7h1V6h1v2h1V7h5v1h-4v1H7V8zm0 0v1H2V8H1v1H0V7h3v1zm10 1h-1V7h1zm-1 0h-1v2h2v-1h-1zm-4 0h2v1h-1v1h-1zm2 3v-1h-1v1h-1v1H9v1h3v-2zm0 0h3v1h-2v1h-1zm-4-1v1h1v-2H7v1z" />
    <path d="M7 12h1v3h4v1H7zm9 2v2h-3v-1h2v-1z" />
  </svg>
);
const personaPhoneIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#22325A" viewBox="0 0 16 16">
    <path
      fillRule="evenodd"
      d="M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z"
    />
  </svg>
);
import Image from "next/image";
import Sidebar from "@/app/client/[client]/Sidebar";
import Topbar from "@/app/components/Topbar";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
const placeholderImages = [
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNlMGU3ZmYiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNkYmVhZmUiLz48L3N2Zz4=",
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiNjYmQ1ZjUiLz48L3N2Zz4=",
];
const FALLBACK_CAMPAIGN_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjY2JkNWY1Ii8+PGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMTYiIGZpbGw9IiM5NGEzYjgiLz48L3N2Zz4=";

const NO_RESPONSES_PLACEHOLDER = "No responses";

type CampaignOutputType = "string" | "boolean" | "number";

type CampaignOutput = {
  id?: string;
  type: CampaignOutputType;
  description: string;
};

type CampaignOutputResponse = {
  id: string;
  campaign_id: string;
  output_id?: string | null;
  value?: string | null;
  created_at?: string | null;
  reasoning?: string | null;
};

type CampaignOutputStat = {
  campaign_id: string;
  output_id: string;
  output_no?: string | null;
  output_type?: string | null;
  output_description?: string | null;
  true_count?: number | null;
  false_count?: number | null;
  true_ratio?: string | null;
  avg_numeric_value?: string | number | null;
  text_response_count?: number | null;
};

type CampaignPersona = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  linkId?: string | null;
  qrCodeUrl?: string | null;
  phoneNumber?: string | null;
  campaignId?: string | null;
};

type CampaignSection = {
  id?: string | null;
  title: string;
  description: string;
  imageUrl?: string | null;
  objective?: string | null;
  questions?: string[] | null;
  outputs?: CampaignOutput[] | null;
  personaIds?: string[];
  personas?: CampaignPersona[];
  resultsCount?: number;
  mostRecentResponseAt?: string | null;
  responses?: CampaignOutputResponse[];
};

type CampaignRow = {
  id?: string | number | null;
  name?: string | null;
  description?: string | null;
  objective?: string | null;
  image_url?: string | null;
  questions?: string[] | null;
  outputs?: unknown;
  persona_ids?: string[] | null;
};

function isCampaignRow(candidate: unknown): candidate is CampaignRow {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const record = candidate as Record<string, unknown>;
  if ("error" in record) {
    return false;
  }
  return (
    "id" in record ||
    "name" in record ||
    "description" in record ||
    "objective" in record ||
    "image_url" in record ||
    "questions" in record ||
    "outputs" in record ||
    "persona_ids" in record
  );
}

const personaRowActionIcons = [
  { key: "link", label: "Share link", icon: personaLinkIcon },
  { key: "qr", label: "Show QR code", icon: personaQrIcon },
  { key: "phone", label: "Call setup", icon: personaPhoneIcon },
];
const CAMPAIGN_SELECT_BASE = "id, name, description, objective, image_url, questions, persona_ids" as const;
const CAMPAIGN_SELECT_WITH_OUTPUTS = `${CAMPAIGN_SELECT_BASE}, outputs` as const;
type CampaignSelectColumns = typeof CAMPAIGN_SELECT_BASE | typeof CAMPAIGN_SELECT_WITH_OUTPUTS;
const CAMPAIGN_FETCH_LIMIT = 3;

function formatReceivedAt(timestamp?: string | null): string {
  if (!timestamp) {
    return NO_RESPONSES_PLACEHOLDER;
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return NO_RESPONSES_PLACEHOLDER;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
let campaignsHasOutputsColumn = true;
const missingCampaignColumnWarnings = new Set<"outputs">();

const OUTPUT_TYPE_LABELS: Record<CampaignOutputType, string> = {
  string: "Text",
  boolean: "Yes/No",
  number: "Numeric",
};

function formatOutputType(type: CampaignOutputType): string {
  return OUTPUT_TYPE_LABELS[type] ?? "Text";
}

function getCampaignSelectColumns(includeOutputs: boolean): CampaignSelectColumns {
  if (includeOutputs) {
    return CAMPAIGN_SELECT_WITH_OUTPUTS;
  }
  return CAMPAIGN_SELECT_BASE;
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { message?: string; details?: string; code?: string };
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  const details = typeof candidate.details === "string" ? candidate.details.toLowerCase() : "";
  const code = typeof candidate.code === "string" ? candidate.code : "";
  if (code === "42703") {
    return true;
  }
  if (!message && !details) {
    return false;
  }
  const normalizedMessage = `${message} ${details}`;
  const needle = `column \"${columnName.toLowerCase()}\"`;
  return normalizedMessage.includes(needle) || normalizedMessage.includes(`column ${columnName.toLowerCase()}`);
}

function normalizeOutputType(value: unknown): CampaignOutputType {
  if (typeof value !== "string") {
    return "string";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "boolean" || normalized === "number" || normalized === "string") {
    return normalized;
  }
  return "string";
}

function normalizeCampaignOutputs(value: unknown): CampaignOutput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value.reduce<CampaignOutput[]>((acc, item) => {
    if (!item || typeof item !== "object") {
      return acc;
    }
    const record = item as Record<string, unknown>;
    const descriptionRaw = record.description;
    if (typeof descriptionRaw !== "string") {
      return acc;
    }
    const description = descriptionRaw.trim();
    if (!description) {
      return acc;
    }
      const typeColumn = typeof record.output_type === "string" ? record.output_type : undefined;
      const descriptionColumnCandidate =
        typeof record.output_description === "string" ? record.output_description : record.description;
      const descriptionColumn =
        typeof descriptionColumnCandidate === "string" ? descriptionColumnCandidate : undefined;
      const type = normalizeOutputType(typeColumn);
      const id =
        (typeof record.id === "string" && record.id.trim().length > 0
          ? record.id
          : typeof record.output_id === "string" && record.output_id.trim().length > 0
          ? record.output_id
          : null) ?? undefined;
      acc.push({ id, type, description: descriptionColumn ?? description });
    return acc;
  }, []);
  return normalized.length > 0 ? normalized : null;
}

function preventCardToggle(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function buildCampaignPublicPath(clientSlug: string, slug?: string | null): string | null {
  if (!clientSlug) {
    return null;
  }
  const trimmed = typeof slug === "string" ? slug.trim() : slug;
  if (!trimmed) {
    return null;
  }
  return `/campaign/${clientSlug}/${trimmed}`;
}

function logMissingColumnOnce(column: "outputs", error: unknown) {
  if (missingCampaignColumnWarnings.has(column)) {
    return;
  }
  missingCampaignColumnWarnings.add(column);
  console.warn(`[campaigns page] ${column} column missing on campaigns table, falling back without it`, error);
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams<{ client?: string }>();
  const clientSlug = typeof params?.client === "string" ? params.client : "";
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [resultsOverlaySection, setResultsOverlaySection] = useState<CampaignSection | null>(null);
  const [isResultsOverlayOpen, setIsResultsOverlayOpen] = useState(false);
  const [overlayResponses, setOverlayResponses] = useState<CampaignOutputResponse[] | null>(null);
  const [overlayResponseOutputMap, setOverlayResponseOutputMap] = useState<Map<string, CampaignOutput> | null>(null);
  const [isOverlayResponsesLoading, setIsOverlayResponsesLoading] = useState(false);
  const [overlayStats, setOverlayStats] = useState<CampaignOutputStat[] | null>(null);
  const [campaignSections, setCampaignSections] = useState<CampaignSection[]>([]);
  const [qrMenuFor, setQrMenuFor] = useState<string | null>(null);
  const [phoneMenuFor, setPhoneMenuFor] = useState<string | null>(null);
  const [linkMenuFor, setLinkMenuFor] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | Event) => {
      const target = event.target as HTMLElement | null;
      const shareableMenu = target?.closest(
        "[data-qr-menu], [data-phone-menu], [data-link-menu], [data-qr-menu-button], [data-phone-menu-button], [data-link-menu-button]"
      );
      if (!shareableMenu) {
        setQrMenuFor(null);
        setPhoneMenuFor(null);
        setLinkMenuFor(null);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [copiedQrKey, setCopiedQrKey] = useState<string | null>(null);
  const [copiedPhoneKey, setCopiedPhoneKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const toggleCard = (title: string) => {
    setOpenCard((prev) => (prev === title ? null : title));
  };
  const columnFlex = "1 1 0";
  const overlayOutputs =
    resultsOverlaySection?.outputs && resultsOverlaySection.outputs.length > 0
      ? resultsOverlaySection.outputs
      : null;

  useEffect(() => {
    const closeMenu = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        setQrMenuFor(null);
        setPhoneMenuFor(null);
        return;
      }
      if (
        target.closest("[data-qr-menu]") ||
        target.closest("[data-qr-menu-button]") ||
        target.closest("[data-phone-menu]") ||
        target.closest("[data-phone-menu-button]")
      ) {
        return;
      }
      // setQrMenuFor(null); // keep dropdown open so "Copied!" is visible
      setPhoneMenuFor(null);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    let isActive = true;
    if (!resultsOverlaySection?.id) {
      setOverlayResponses(null);
      setOverlayResponseOutputMap(null);
      setIsOverlayResponsesLoading(false);
      setOverlayStats(null);
      return;
    }
    setIsOverlayResponsesLoading(true);
    setOverlayResponses(null);

    const fetchResponses = async () => {
      try {
        const { data, error } = await supabase
          .from("campaign_output_responses")
          .select("id, campaign_id, output_id, value, reasoning, created_at")
          .eq("campaign_id", resultsOverlaySection.id)
          .order("created_at", { ascending: false });
        if (!isActive) {
          return;
        }
        if (error) {
          console.error("[campaigns page] failed to load campaign output responses", { campaignId: resultsOverlaySection.id, error });
          setOverlayResponses([]);
          return;
        }
        if (Array.isArray(data)) {
          setOverlayResponses(data);
          const outputIds = data
            .map((item) => (typeof item.output_id === "string" ? item.output_id : null))
            .filter((id): id is string => id !== null && id.trim().length > 0);
          if (outputIds.length > 0) {
            try {
              const { data: outputRecords, error: outputError } = await supabase
                .from("campaign_outputs")
                .select("id, output_type, output_description")
                .in("id", outputIds);
              if (!isActive) {
                return;
              }
              if (outputError) {
                console.error(
                  "[campaigns page] failed to load matching outputs",
                  {
                    campaignId: resultsOverlaySection.id,
                    error: outputError,
                  }
                );
                setOverlayResponseOutputMap(null);
              } else if (Array.isArray(outputRecords)) {
                const map = new Map<string, CampaignOutput>();
                outputRecords.forEach((output) => {
                  if (typeof output.id === "string" && output.id.trim().length > 0) {
                    map.set(output.id, {
                      id: output.id,
                      type: normalizeOutputType(output.output_type),
                      description: output.output_description ?? "",
                    });
                  }
                });
                setOverlayResponseOutputMap(map);
              } else {
                setOverlayResponseOutputMap(null);
              }
            } catch (outputErr) {
              console.error("[campaigns page] unexpected error loading campaign outputs", {
                campaignId: resultsOverlaySection.id,
                err: outputErr,
              });
              if (isActive) {
                setOverlayResponseOutputMap(null);
              }
            }
          } else {
            setOverlayResponseOutputMap(null);
          }
        } else {
          setOverlayResponses([]);
          setOverlayResponseOutputMap(null);
        }
      } catch (err) {
        console.error("[campaigns page] unexpected error loading campaign output responses", { campaignId: resultsOverlaySection.id, err });
        if (isActive) {
          setOverlayResponses([]);
          setOverlayResponseOutputMap(null);
        }
      } finally {
        if (isActive) {
          setIsOverlayResponsesLoading(false);
        }
      }
    };

    fetchResponses();
    const fetchStats = async () => {
      try {
          const { data, error } = await supabase
            .from("v_campaign_output_stats")
            .select(
              "campaign_id, output_id, output_no, output_type, output_description, true_count, false_count, true_ratio, avg_numeric_value, text_response_count"
            )
          .eq("campaign_id", resultsOverlaySection.id);
        if (!isActive) {
          return;
        }
        if (error) {
          console.error("[campaigns page] failed to load campaign stats", {
            campaignId: resultsOverlaySection.id,
            error,
          });
          setOverlayStats(null);
          return;
        }
        if (Array.isArray(data)) {
          setOverlayStats(data);
        } else {
          setOverlayStats(null);
        }
      } catch (err) {
        console.error("[campaigns page] unexpected error loading campaign stats", {
          campaignId: resultsOverlaySection.id,
          err,
        });
        if (isActive) {
          setOverlayStats(null);
        }
      }
    };
    fetchStats();
    return () => {
      isActive = false;
    };
  }, [resultsOverlaySection]);

  const handleTestCall = useCallback(
    (payload: { linkId?: string | null }) => {
      if (!payload.linkId) {
        setPhoneMenuFor(null);
        return;
      }
      router.push(`/campaign/${clientSlug}/${payload.linkId}/call`);
      setPhoneMenuFor(null);
    },
    [clientSlug, router]
  );

  const handleCopyPhoneNumber = useCallback(
    async (entry: { linkId?: string | null | undefined }) => {
      if (!entry.linkId || !clientSlug) {
        return;
      }
      const link = `${window.location.origin}/campaign/${clientSlug}/${entry.linkId}/call`;
      try {
        await navigator.clipboard.writeText(link);
      } catch (error) {
        console.error("[campaigns page] failed to copy call link", error);
      }
    },
    [clientSlug]
  );

  type PersonaMetadata = {
    imageUrl: string | null;
    name: string | null;
  };

  const fetchPersonaDetails = useCallback(async (personaIds: Set<string>) => {
    const lookup = new Map<string, PersonaMetadata>();
    if (personaIds.size === 0) {
      return lookup;
    }
    const identities = Array.from(personaIds).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (identities.length === 0) {
      return lookup;
    }

    const rows: Array<{ agent_id?: string | null; key?: string | null; agent_name?: string | null; profile_image?: string | null; background_image?: string | null }> = [];

    const [{ data: agentMatches, error: agentError } = {}, { data: keyMatches, error: keyError } = {}] = await Promise.all([
      supabase
        .from("agent_map")
        .select("agent_id, key, agent_name, profile_image, background_image")
        .in("agent_id", identities),
      supabase
        .from("agent_map")
        .select("agent_id, key, agent_name, profile_image, background_image")
        .in("key", identities),
    ]);

    if (agentError) {
      console.error("[campaigns page] failed to load persona images by agent_id", agentError);
    } else if (agentMatches) {
      rows.push(...agentMatches);
    }

    if (keyError) {
      console.error("[campaigns page] failed to load persona images by key", keyError);
    } else if (keyMatches) {
      rows.push(...keyMatches);
    }

    rows.forEach((row) => {
      const imageUrl = row.profile_image ?? row.background_image ?? null;
      const displayName = row.agent_name ?? null;
      [row.agent_id, row.key]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .forEach((identity) => {
          const existing = lookup.get(identity);
          if (existing) {
            lookup.set(identity, {
              imageUrl: existing.imageUrl ?? imageUrl,
              name: existing.name ?? displayName,
            });
            return;
          }
          lookup.set(identity, {
            imageUrl,
            name: displayName,
          });
        });
    });

    return lookup;
  }, []);

  const fetchResponseCounts = useCallback(async (campaignIds: string[]) => {
    const lookup = new Map<string, number>();
    if (campaignIds.length === 0) {
      return lookup;
    }
    const uniqueIds = Array.from(new Set(campaignIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
    await Promise.all(
      uniqueIds.map(async (campaignId) => {
        try {
          const { count, error } = await supabase
            .from("campaign_responses")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", campaignId);
          if (error) {
            console.error("[campaigns page] failed to count campaign_responses", { campaignId, error });
            lookup.set(campaignId, 0);
            return;
          }
          lookup.set(campaignId, count ?? 0);
        } catch (err) {
          console.error("[campaigns page] unexpected error counting campaign_responses", { campaignId, err });
          lookup.set(campaignId, 0);
        }
      })
    );
    return lookup;
  }, []);

  const fetchMostRecentResponseAt = useCallback(async (campaignIds: string[]) => {
    const lookup = new Map<string, string | null>();
    if (campaignIds.length === 0) {
      return lookup;
    }
    const uniqueIds = Array.from(new Set(campaignIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
    await Promise.all(
      uniqueIds.map(async (campaignId) => {
        try {
          const { data, error } = await supabase
            .from("campaign_responses")
            .select("received_at")
            .eq("campaign_id", campaignId)
            .order("received_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) {
            console.error("[campaigns page] failed to fetch most recent campaign_response", { campaignId, error });
            lookup.set(campaignId, null);
            return;
          }
          const receivedAtValue =
            data && typeof data.received_at === "string" && data.received_at.trim().length > 0 ? data.received_at : null;
          lookup.set(campaignId, receivedAtValue);
        } catch (err) {
          console.error("[campaigns page] unexpected error fetching most recent campaign_response", { campaignId, err });
          lookup.set(campaignId, null);
        }
      })
    );
    return lookup;
  }, []);

  const fetchCampaignLinks = useCallback(async (campaignIds: string[]) => {
    const lookup = new Map<
      string,
      {
        personas: Map<string, { linkId: string; qrCodeUrl: string | null; phoneNumber: string | null }>;
        tags: { linkId: string; qrCodeUrl: string | null; phoneNumber: string | null; tag: string }[];
      }
    >();
    if (campaignIds.length === 0) {
      return lookup;
    }
    const uniqueIds = Array.from(new Set(campaignIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
    if (uniqueIds.length === 0) {
      return lookup;
    }
    const { data, error } = await supabase
      .from("campaign_links")
      .select("id, campaign_id, persona_id, qr_code_image, phone_number, tag")
      .in("campaign_id", uniqueIds);
    if (error) {
      console.error("[campaigns page] failed to load campaign links", error);
      return lookup;
    }
    if (!Array.isArray(data)) {
      return lookup;
    }
    data.forEach((row) => {
      const campaignId =
        typeof row.campaign_id === "string" && row.campaign_id.trim().length > 0
          ? row.campaign_id
          : null;
      const personaId =
        typeof row.persona_id === "string" && row.persona_id.trim().length > 0
          ? row.persona_id
          : null;
      const linkId =
        typeof row.id === "string" && row.id.trim().length > 0 ? row.id : null;
      const qrCodeUrl =
        typeof row.qr_code_image === "string" && row.qr_code_image.trim().length > 0
          ? row.qr_code_image
          : null;
      const phoneNumber =
        typeof row.phone_number === "string" && row.phone_number.trim().length > 0
          ? row.phone_number.trim()
          : null;
      const tag =
        typeof row.tag === "string" && row.tag.trim().length > 0
          ? row.tag.trim()
          : null;
      if (!campaignId || !linkId) {
        return;
      }
      let campaignEntry = lookup.get(campaignId);
      if (!campaignEntry) {
        campaignEntry = {
          personas: new Map<string, { linkId: string; qrCodeUrl: string | null; phoneNumber: string | null }>(),
          tags: [],
        };
        lookup.set(campaignId, campaignEntry);
      }
      if (personaId) {
        if (!campaignEntry.personas.has(personaId)) {
          campaignEntry.personas.set(personaId, { linkId, qrCodeUrl, phoneNumber });
        }
      } else if (tag) {
        campaignEntry.tags.push({ linkId, qrCodeUrl, phoneNumber, tag });
      }
    });
    return lookup;
  }, []);

  useEffect(() => {
    const closeMenu = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        setQrMenuFor(null);
        return;
      }
      if (target.closest("[data-qr-menu]") || target.closest("[data-qr-menu-button]")) {
        return;
      }
      setQrMenuFor(null);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  const handleDownloadQr = useCallback((url: string, fallbackFileName: string) => {
    if (!url) {
      setQrMenuFor(null);
      return;
    }
    const deriveFileName = () => {
      try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split("/");
        const last = segments[segments.length - 1];
        return last?.length ? last : fallbackFileName;
      } catch {
        return fallbackFileName;
      }
    };
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = deriveFileName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setQrMenuFor(null);
  }, []);

  const handleCopyQr = useCallback(async (url: string) => {
    if (!url || !navigator?.clipboard) {
      setQrMenuFor(null);
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch QR image (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const mime = response.headers.get("content-type") || "image/png";
      const blob = new Blob([arrayBuffer], { type: mime });
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
    } catch (error) {
      console.error("[campaigns page] failed to copy QR code image", error);
    } finally {
      // keep dropdown open until clicked elsewhere
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadCampaigns() {
      try {
        const selectCampaigns = (includeOutputs: boolean) => {
          return supabase
            .from("campaigns")
            .select(getCampaignSelectColumns(includeOutputs))
            .order("created_at", { ascending: false })
            .limit(CAMPAIGN_FETCH_LIMIT);
        };

        let includeOutputs = campaignsHasOutputsColumn;
        let { data, error } = await selectCampaigns(includeOutputs);

        const retryWithoutColumn = async (column: "outputs") => {
          if (column === "outputs" && includeOutputs) {
            includeOutputs = false;
            campaignsHasOutputsColumn = false;
          } else {
            return;
          }
          const retryResult = await selectCampaigns(includeOutputs);
          data = retryResult.data;
          error = retryResult.error;
        };

        if (error && isMissingColumnError(error, "outputs")) {
          logMissingColumnOnce("outputs", error);
          await retryWithoutColumn("outputs");
        }

        if (!isActive) return;
        if (error) {
          console.error("[campaigns page] failed to load campaigns", error);
          return;
        }
        if (!data || data.length === 0) {
          return;
        }
        const rows: unknown[] = data as unknown[];
        const validCampaigns = rows.filter(isCampaignRow);
        if (validCampaigns.length === 0) {
          return;
        }
        const mapped = validCampaigns.map((campaign) => {
          console.log("[campaigns page] campaign image_url", campaign.id, campaign.image_url);
          const campaignId =
            typeof campaign.id === "string"
              ? campaign.id
              : typeof campaign.id === "number"
              ? String(campaign.id)
              : null;
          return {
            id: campaignId ?? undefined,
            title: campaign.name ?? "Untitled campaign",
            description: campaign.description ?? "No description yet",
            imageUrl: campaign.image_url && typeof campaign.image_url === "string" ? campaign.image_url : null,
            objective:
              typeof campaign.objective === "string" && campaign.objective.trim().length > 0
                ? campaign.objective.trim()
                : null,
            questions: Array.isArray(campaign.questions)
              ? campaign.questions.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
              : null,
            outputs: normalizeCampaignOutputs(campaign.outputs),
            personaIds: Array.isArray(campaign.persona_ids)
              ? campaign.persona_ids.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
              : [],
            personas: [],
          };
        });
        if (mapped.length === 0) {
          return;
        }

        const campaignIds = mapped
          .map((campaign) => campaign.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        const responseCounts = await fetchResponseCounts(campaignIds);
        const recentResponseLookup = await fetchMostRecentResponseAt(campaignIds);

        const personaIdSet = new Set<string>();
        mapped.forEach((campaign) => {
          campaign.personaIds?.forEach((id: string) => {
            if (id) {
              personaIdSet.add(id);
            }
          });
        });

        const personaDetailsLookup = await fetchPersonaDetails(personaIdSet);
        if (!isActive) return;
        const campaignLinksLookup = await fetchCampaignLinks(campaignIds);
        if (!isActive) return;

        const enriched = mapped.map((campaign) => {
          const personaLinkLookup = campaign.id ? campaignLinksLookup.get(campaign.id) : undefined;
          const personaEntries = campaign.personaIds
            ? campaign.personaIds.map((id) => {
                const detail = personaDetailsLookup.get(id);
                const linkMeta = personaLinkLookup?.personas.get(id);
                return {
                  id,
                  name: detail?.name ?? null,
                  imageUrl: detail?.imageUrl ?? null,
                  linkId: linkMeta?.linkId ?? null,
                  qrCodeUrl: linkMeta?.qrCodeUrl ?? null,
                  phoneNumber: linkMeta?.phoneNumber ?? null,
                };
              })
            : [];
          const tagEntries =
            personaLinkLookup?.tags.length
              ? personaLinkLookup.tags.map((tagRow) => ({
                  id: tagRow.linkId,
                  name: tagRow.tag,
                  imageUrl: null,
                  linkId: tagRow.linkId,
                  qrCodeUrl: tagRow.qrCodeUrl ?? null,
                  phoneNumber: tagRow.phoneNumber ?? null,
                }))
              : [];
          const personas = [...personaEntries, ...tagEntries];
          const resultsCount = campaign.id ? responseCounts.get(campaign.id) ?? 0 : 0;
          const mostRecentResponseAt = campaign.id ? recentResponseLookup.get(campaign.id) ?? null : null;

          return {
            ...campaign,
            personas,
            resultsCount,
            mostRecentResponseAt,
          };
        });

        setCampaignSections(enriched);
      } catch (error) {
        console.error("[campaigns page] unexpected error loading campaigns", error);
      }
    }

    loadCampaigns();
    return () => {
      isActive = false;
    };
  }, [fetchPersonaDetails, fetchResponseCounts, fetchCampaignLinks, fetchMostRecentResponseAt]);
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
      }}
    >
      <Sidebar />
      <Topbar
        title="Campaigns"
        offsetLeft="var(--sidebar-width)"
        hideAdminView
        hideProfileAvatar
      />
      <main
        style={{
          marginLeft: "var(--sidebar-width)",
          padding: "80px 48px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {campaignSections.length === 0 ? (
          <section
            style={{
              padding: "36px",
              borderRadius: 20,
              background: "#f5f7ff",
              border: "1px dashed rgba(15,23,42,0.2)",
              textAlign: "center",
              color: "rgba(15,23,42,0.7)",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            No campaigns to display yet. Create one to see it appear here.
          </section>
        ) : null}
        {campaignSections.map((container) => {
          const isOpen = openCard === container.title;
          const personaDetailImages: string[] = container.personas && container.personas.length > 0
            ? container.personas
                .map((persona) => persona.imageUrl)
                .filter((src): src is string => typeof src === "string" && src.length > 0)
                .slice(0, 3)
            : placeholderImages;
          const questionList = container.questions && container.questions.length > 0
            ? container.questions
            : null;
          const outputList = container.outputs && container.outputs.length > 0
            ? container.outputs
            : null;
          const personaEntries = container.personas && container.personas.length > 0 ? container.personas : null;
          const formattedResultsValue = typeof container.resultsCount === "number"
            ? container.resultsCount.toLocaleString()
            : "0";
          const formattedMostRecentValue = formatReceivedAt(container.mostRecentResponseAt);
          const metrics = [
            { label: "Responses", value: formattedResultsValue, icon: responsesIcon },
            { label: "Most recent", value: formattedMostRecentValue, icon: newIcon },
          ];
          return (
            <section
              key={container.title}
              className="campaign-card"
              style={{
                width: "100%",
                background: "transparent",
                borderRadius: "18px",
                padding: "20px",
                boxShadow: "none",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                cursor: "pointer",
              }}
              onClick={(event) => {
                if (event.defaultPrevented) {
                  return;
                }
                toggleCard(container.title);
              }}
              onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleCard(container.title);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    flex: columnFlex,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{container.title}</h2>
                    {container.imageUrl ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          overflow: "hidden",
                          boxShadow: "0 6px 14px rgba(15, 23, 42, 0.12)",
                          flexShrink: 0,
                        }}
                      >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundImage: `url(${container.imageUrl})`,
                          backgroundSize: "contain",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }}
                        aria-label={container.title}
                      />
                      </div>
                    ) : null}
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(15, 23, 42, 0.7)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {container.description}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flex: columnFlex,
                    minWidth: 0,
                    marginLeft: "auto",
                    justifyContent: "flex-end",
                  }}
                >
                  {metrics.map((metric) => (
                    <div
                      key={metric.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                    minWidth: 96,
                    }}
                  >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "14px",
                          color: "rgba(15,23,42,0.6)",
                        }}
                      >
                        {metric.icon}
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "#091F5B",
                        }}
                        >
                          {metric.value}
                        </span>
                      </span>
                      <span style={{ fontSize: "12px", color: "rgba(15,23,42,0.5)" }}>{metric.label}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    flex: columnFlex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0",
                    minWidth: 0,
                  }}
                >
                  {personaDetailImages.map((src: string, index: number) => (
                    <div
                      key={`${src}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        marginLeft: index === 0 ? 0 : -6,
                        borderRadius: "50%",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={src}
                        width={32}
                        height={32}
                        alt={`Placeholder icon ${index + 1}`}
                        unoptimized
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    flex: columnFlex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 0,
                  }}
                >
                                                    <button
                                                      type="button"
                                                      style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 18px",
                      borderRadius: "999px",
                      border: "1px solid rgba(255, 255, 255, 0.4)",
                      background: "#1e293b",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 700,
                      fontFamily: "var(--font-heading, var(--font-body))",
                      textDecoration: "none",
                      transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s, background 0.2s",
                      boxShadow: "none",
                      transform: "none",
                      outline: "none",
                      cursor: "pointer",
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setResultsOverlaySection(container);
                      setIsResultsOverlayOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setResultsOverlaySection(container);
                        setIsResultsOverlayOpen(true);
                      }
                    }}
                  >
                    View Results
                  </button>
                </div>
              </div>
              {isOpen && (
                <div
                  className="campaign-dropdown-details"
                  style={{
                    borderRadius: "14px",
                    padding: "0",
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0",
                  }}
                >
                  <div className="persona-expanded-track campaign-dropdown-track">
                    <div className="persona-expanded-block persona-expanded-block--personas">
                      <div className="persona-expanded-block__header">
                        <h4>Shareable Links</h4>
                      </div>
                      <div
                        className="persona-expanded-block__list-wrapper"
                        style={{ overflow: "visible" }}
                      >
                        {personaEntries ? (
                          <ul
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              margin: 0,
                              paddingLeft: 0,
                            }}
                          >
                            {personaEntries.map((entry, personaIndex) => {
                              const personaMenuKey = `${container.id ?? container.title}-${
                                entry.linkId ?? entry.id ?? personaIndex
                              }`;
                              const qrAvailable = Boolean(entry.qrCodeUrl && entry.qrCodeUrl.length > 0);
                              return (
                                <li
                                  key={entry.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "12px",
                                    margin: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        overflow: "hidden",
                                        background: "rgba(15, 23, 42, 0.08)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        color: "#0f172a",
                                      }}
                                    >
                                      {entry.imageUrl ? (
                                        <Image
                                          src={entry.imageUrl}
                                          alt={entry.name ?? entry.id}
                                          width={32}
                                          height={32}
                                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                          unoptimized
                                        />
                                      ) : (
                                        ""
                                      )}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        color: "rgba(15, 23, 42, 0.75)",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {entry.name ?? entry.id}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    {personaRowActionIcons.map((action) => {
                                      const sharedStyle = {
                                        width: 28,
                                        height: 28,
                                        borderRadius: "999px",
                                        border: "1px solid rgba(15, 23, 42, 0.12)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "#fff",
                                      } as const;

                                      if (action.key === "link") {
                                        const shareSlug = entry.linkId ?? container.id ?? null;
                                        const publicPath = buildCampaignPublicPath(clientSlug, shareSlug);
                                        const disabled = !publicPath;
                                        return (
                                            <div
                                              key={`${entry.id}-${action.key}`}
                                              style={{ position: "relative", display: "inline-flex" }}
                                            >
                                              <button
                                                type="button"
                                                title={action.label}
                                                aria-label={`${action.label} for ${container.title}`}
                                                aria-controls={`link-menu-${personaMenuKey}`}
                                                aria-expanded={linkMenuFor === personaMenuKey}
                                                data-link-menu-button
                                                style={{
                                                  ...sharedStyle,
                                                  cursor: publicPath ? "pointer" : "not-allowed",
                                                  opacity: publicPath ? 1 : 0.5,
                                                }}
                                                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                                  preventCardToggle(event);
                                                  if (!publicPath) {
                                                    console.warn("[campaigns page] missing public campaign path for share link action");
                                                    return;
                                                  }
                                                setQrMenuFor(null);
                                                setPhoneMenuFor(null);
                                                setLinkMenuFor((prev) =>
                                                  prev === personaMenuKey ? null : personaMenuKey
                                                );
                                                }}
                                              >
                                              {action.icon}
                                            </button>
                                              {linkMenuFor === personaMenuKey && publicPath && (
                                                <div
                                                  id={`link-menu-${personaMenuKey}`}
                                                  data-link-menu
                                                  style={{
                                                    position: "absolute",
                                                    top: "calc(100% + 6px)",
                                                    right: 0,
                                                    background: "#fff",
                                                    borderRadius: 12,
                                                    boxShadow: "0 10px 25px rgba(15,23,42,0.2)",
                                                    border: "1px solid rgba(15,23,42,0.08)",
                                                    padding: "8px",
                                                    minWidth: 160,
                                                    zIndex: 20,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "4px",
                                                  }}
                                                >
                                                  <button
                                                    type="button"
                                                    style={{
                                                      border: "none",
                                                      background: "transparent",
                                                      textAlign: "left",
                                                      padding: "6px 8px",
                                                      borderRadius: 8,
                                                      cursor: "pointer",
                                                      fontSize: 13,
                                                    }}
                                                    onClick={(event) => {
                                                      preventCardToggle(event);
                                                      setLinkMenuFor(null);
                                                      if (publicPath) {
                                                        window.open(`${window.location.origin}${publicPath}`, "_blank", "noreferrer");
                                                      }
                                                    }}
                                                  >
                                                    Test URL
                                                  </button>
                                                  <button
                                                    type="button"
                                                    style={{
                                                      border: "none",
                                                      background: "transparent",
                                                      textAlign: "left",
                                                      padding: "6px 8px",
                                                      borderRadius: 8,
                                                      cursor: "pointer",
                                                      fontSize: 13,
                                                    }}
                                                    onClick={async (event) => {
                                                      preventCardToggle(event);
                                                      if (navigator && navigator.clipboard && publicPath) {
                                                        try {
                                                          const fullUrl = `${window.location.origin}${publicPath}`;
                                                          await navigator.clipboard.writeText(fullUrl);
                                                          setCopiedLinkKey(personaMenuKey);
                                                          if (copyTimeoutRef.current) {
                                                            window.clearTimeout(copyTimeoutRef.current);
                                                          }
                                                          copyTimeoutRef.current = window.setTimeout(() => {
                                                            setCopiedLinkKey(null);
                                                          }, 2000);
                                                        } catch (copyErr) {
                                                          console.error("[campaigns page] failed to copy share URL", copyErr);
                                                        }
                                                      }
                                                    }}
                                                  >
                                                    {copiedLinkKey === personaMenuKey ? "Copied!" : "Copy URL"}
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }

                                      if (action.key === "qr") {
                                        return (
                                          <div
                                            key={`${entry.id}-${action.key}`}
                                            style={{ position: "relative", display: "inline-flex" }}
                                          >
                                                    <button
                                                      type="button"
                                                      title={action.label}
                                                      aria-label={action.label}
                                                      aria-controls={`qr-menu-${personaMenuKey}`}
                                                      aria-expanded={qrMenuFor === personaMenuKey}
                                                      disabled={!qrAvailable}
                                                      data-qr-menu-button
                                                      style={{
                                                        ...sharedStyle,
                                                cursor: qrAvailable ? "pointer" : "not-allowed",
                                                opacity: qrAvailable ? 1 : 0.5,
                                              }}
                                              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                                event.stopPropagation();
                                                preventCardToggle(event);
                                                if (!qrAvailable) {
                                                  return;
                                                }
                                                setLinkMenuFor(null);
                                                setPhoneMenuFor(null);
                                                setQrMenuFor((prev) =>
                                                  prev === personaMenuKey ? null : personaMenuKey
                                                );
                                              }}
                                                    >
                                                      {action.icon}
                                                    </button>
                                                    {qrMenuFor === personaMenuKey && qrAvailable && (
                                                      <div
                                                id={`qr-menu-${personaMenuKey}`}
                                                data-qr-menu
                                                style={{
                                                  position: "absolute",
                                                  top: "calc(100% + 6px)",
                                                  right: 0,
                                                  background: "#fff",
                                                  borderRadius: 12,
                                                  boxShadow: "0 10px 25px rgba(15,23,42,0.2)",
                                                  border: "1px solid rgba(15,23,42,0.08)",
                                                  padding: "8px",
                                                  minWidth: 160,
                                                  zIndex: 20,
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "4px",
                                                        }}
                                                      >
                                                        <button
                                                          type="button"
                                                          style={{
                                                            border: "none",
                                                            background: "transparent",
                                                            textAlign: "left",
                                                            padding: "6px 8px",
                                                            borderRadius: 8,
                                                            cursor: "pointer",
                                                            fontSize: 13,
                                                          }}
                                                          onClick={(event) => {
                                                            preventCardToggle(event);
                                                            setCopiedQrKey(null);
                                                            handleDownloadQr(
                                                              entry.qrCodeUrl ?? "",
                                                              `${entry.linkId ?? entry.id ?? "qr"}-code.png`
                                                            );
                                                          }}
                                                        >
                                                          Download Image
                                                        </button>
                                                        <button
                                                          type="button"
                                                  style={{
                                                    border: "none",
                                                    background: "transparent",
                                                    textAlign: "left",
                                                    padding: "6px 8px",
                                                    borderRadius: 8,
                                                    cursor: "pointer",
                                                    fontSize: 13,
                                                  }}
                                                          onClick={async (event) => {
                                                            event.stopPropagation();
                                                            preventCardToggle(event);
                                                            handleCopyQr(entry.qrCodeUrl ?? "");
                                                            setCopiedQrKey(personaMenuKey);
                                                            setQrMenuFor(personaMenuKey);
                                                            if (copyTimeoutRef.current) {
                                                              window.clearTimeout(copyTimeoutRef.current);
                                                            }
                                                            copyTimeoutRef.current = window.setTimeout(() => {
                                                              setCopiedQrKey(null);
                                                            }, 2000);
                                                          }}
                                                        >
                                                          {copiedQrKey === personaMenuKey ? "Copied!" : "Copy Image"}
                                                        </button>
                                                      </div>
                                                    )}
                                          </div>
                                        );
                                      }

                                      if (action.key === "phone") {
                                        const phoneAvailable = Boolean(entry.phoneNumber);
                                        return (
                                          <div
                                            key={`${entry.id}-${action.key}`}
                                            style={{ position: "relative", display: "inline-flex" }}
                                          >
                                            <button
                                              type="button"
                                              title="Call actions"
                                              aria-label="Call actions"
                                              aria-controls={`phone-menu-${personaMenuKey}`}
                                              aria-expanded={phoneMenuFor === personaMenuKey}
                                              disabled={!phoneAvailable}
                                              data-phone-menu-button
                                              style={{
                                                ...sharedStyle,
                                                cursor: phoneAvailable ? "pointer" : "not-allowed",
                                                opacity: phoneAvailable ? 1 : 0.5,
                                              }}
                                              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                                event.stopPropagation();
                                                preventCardToggle(event);
                                                if (!phoneAvailable) {
                                                  return;
                                                }
                                                setLinkMenuFor(null);
                                                setQrMenuFor(null);
                                                setPhoneMenuFor((prev) =>
                                                  prev === personaMenuKey ? null : personaMenuKey
                                                );
                                              }}
                                            >
                                              {action.icon}
                                            </button>
                                            {phoneMenuFor === personaMenuKey && phoneAvailable && (
                                              <div
                                                id={`phone-menu-${personaMenuKey}`}
                                                data-phone-menu
                                                style={{
                                                  position: "absolute",
                                                  top: "calc(100% + 6px)",
                                                  right: 0,
                                                  background: "#fff",
                                                  borderRadius: 12,
                                                  boxShadow: "0 10px 25px rgba(15,23,42,0.2)",
                                                  border: "1px solid rgba(15,23,42,0.08)",
                                                  padding: "8px",
                                                  minWidth: 160,
                                                  zIndex: 20,
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "4px",
                                                }}
                                              >
                                                <button
                                                  type="button"
                                                  style={{
                                                    border: "none",
                                                    background: "transparent",
                                                    textAlign: "left",
                                                    padding: "6px 8px",
                                                    borderRadius: 8,
                                                    cursor: "pointer",
                                                    fontSize: 13,
                                                  }}
                                                  onClick={(event) => {
                                                    preventCardToggle(event);
                                                    const shareSlug = entry.linkId ?? undefined;
                                                    if (!shareSlug || !clientSlug) return;
                                                    const url = `${window.location.origin}/campaign/${clientSlug}/${shareSlug}/call`;
                                                    window.open(url, "_blank", "noreferrer");
                                                  }}
                                                >
                                                  Test call
                                                </button>
                                                  <button
                                                    type="button"
                                                    style={{
                                                      border: "none",
                                                      background: "transparent",
                                                      textAlign: "left",
                                                      padding: "6px 8px",
                                                      borderRadius: 8,
                                                      cursor: "pointer",
                                                      fontSize: 13,
                                                    }}
                                                    onClick={async (event) => {
                                                      preventCardToggle(event);
                                                      handleCopyPhoneNumber({
                                                        linkId: entry.linkId,
                                                      });
                                                      setCopiedPhoneKey(personaMenuKey);
                                                      setPhoneMenuFor(personaMenuKey);
                                                      if (copyTimeoutRef.current) {
                                                        window.clearTimeout(copyTimeoutRef.current);
                                                      }
                                                      copyTimeoutRef.current = window.setTimeout(() => {
                                                        setCopiedPhoneKey(null);
                                                      }, 2000);
                                                    }}
                                                  >
                                                    {copiedPhoneKey === personaMenuKey ? "Copied!" : "Copy call link"}
                                                  </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      return (
                                        <span
                                          key={`${entry.id}-${action.key}`}
                                          title={action.label}
                                          aria-label={action.label}
                                          style={sharedStyle}
                                          onClick={preventCardToggle}
                                        >
                                    {action.icon}
                                  </span>
                                );
                              })}
                                 </div>
                               </li>
                           );
                           })}
                          </ul>
                        ) : (
                          <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.6)" }}>
                            Assign personas to this campaign to see them here.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="persona-expanded-block persona-expanded-block--description">
                      <div className="persona-expanded-block__header">
                        <h4>Objective</h4>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          width: "100%",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.7)" }}>
                          {container.objective ?? "Add an objective to see it here."}
                        </p>
                      </div>
                    </div>
                    <div
                      className="persona-expanded-block persona-expanded-block--documents"
                      style={{ background: "rgba(248, 250, 252, 0.92)" }}
                    >
                      <div className="persona-expanded-block__header">
                        <h4>Questions</h4>
                      </div>
                      <div className="persona-expanded-block__list-wrapper">
                        {questionList ? (
                          <ul
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              margin: 0,
                              paddingLeft: 0,
                              listStyle: "none",
                              color: "rgba(15, 23, 42, 0.75)",
                              fontSize: "13px",
                            }}
                          >
                            {questionList.map((question) => (
                              <li
                                key={question}
                                style={{
                                  margin: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                {question}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.6)" }}>
                            Add questions to your campaign to see them here.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </main>
      <style jsx>{`
        .campaign-card {
          transition: transform 0.24s ease, box-shadow 0.24s ease;
        }
        .campaign-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 26px 48px rgba(15, 23, 42, 0.12);
        }
      `}</style>
      <SlidingPanelOverlay
        open={isResultsOverlayOpen}
        onRequestClose={() => setIsResultsOverlayOpen(false)}
        onAfterClose={() => setResultsOverlaySection(null)}
        title={
          resultsOverlaySection?.title
            ? `Campaign outputs - ${resultsOverlaySection.title}`
            : "Campaign outputs"
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
        </div>
        <div>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Results
          </h3>
          {overlayStats && overlayStats.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              {overlayStats.map((stat) => {
                const type = formatOutputType((stat.output_type as CampaignOutputType) ?? "string");
                const description = stat.output_description ?? "Output";
                const isNumeric = type === "number";
                const formatTrueRatio = (value?: string | null) => {
                  const ratio = parseFloat(value ?? "0");
                  if (Number.isNaN(ratio)) {
                    return "0%";
                  }
                  return `${(ratio * 100).toFixed(0)}%`;
                };
                const statValue = (() => {
                  if (isNumeric) {
                    if (typeof stat.avg_numeric_value === "number") {
                      return stat.avg_numeric_value.toFixed(2);
                    }
                    return stat.avg_numeric_value ?? "—";
                  }
                  if (type === "boolean") {
                    return `${formatTrueRatio(stat.true_ratio)} Yes`;
                  }
                  if (type === "string") {
                    return `${stat.text_response_count ?? 0} text responses`;
                  }
                  return `${formatTrueRatio(stat.true_ratio)} Yes`;
                })();
                return (
                    <div
                      key={`${stat.output_id}-${stat.output_no}`}
                      style={{
                        flex: "1 1 calc(33.333% - 16px)",
                        maxWidth: "calc(33.333% - 16px)",
                        borderRadius: "12px",
                        padding: "12px",
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        background: "#fff",
                        boxShadow: "0 6px 14px rgba(15, 23, 42, 0.05)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#0f172a",
                        }}
                      >
                        {statValue}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "2px 10px",
                          borderRadius: "999px",
                          background: "rgba(21, 94, 239, 0.08)",
                          color: "#155EEF",
                          fontSize: "10px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {type}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(15, 23, 42, 0.85)", textAlign: "center" }}>
                        {description}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.7)" }}>
              {(resultsOverlaySection?.resultsCount ?? 0).toLocaleString()} responses recorded for this campaign.
            </p>
          )}
        </div>
        <div>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Output responses
          </h3>
          {isOverlayResponsesLoading ? (
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.6)" }}>
              Loading responses...
            </p>
          ) : overlayResponses && overlayResponses.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {overlayResponses.map((response) => {
        const relatedOutput =
          overlayResponseOutputMap?.get(response.output_id ?? "") ??
          overlayOutputs?.find((output) => output.id === response.output_id) ??
          null;
        if (!relatedOutput) {
          console.log("[campaigns page] unable to resolve output metadata for response", {
            campaignId: resultsOverlaySection?.id,
            responseId: response.id,
            outputId: response.output_id,
            overlayOutputsCount: overlayOutputs?.length ?? 0,
          });
        }
                return (
                  <div
                    key={response.id}
                    style={{
                      borderRadius: "12px",
                      padding: "12px 14px",
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      background: "#fff",
                      boxShadow: "0 6px 14px rgba(15, 23, 42, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          flex: "1 1 0",
                        }}
                      >
                        {relatedOutput ? (
                          <div
                            style={{
                              display: "inline-flex",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "2px 10px",
                            borderRadius: "999px",
                            background: "rgba(21, 94, 239, 0.08)",
                            color: "#155EEF",
                            fontSize: "10px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                              {formatOutputType(relatedOutput.type)}
                            </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "rgba(15, 23, 42, 0.85)",
                            lineHeight: 1.4,
                          }}
                        >
                              {relatedOutput.description}
                            </span>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: "15px",
                              fontWeight: 500,
                              color: "rgba(15, 23, 42, 0.85)",
                              lineHeight: 1.4,
                            }}
                          >
                            Output response
                          </span>
                        )}
                      </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "4px",
                      }}
                    >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {{
                            true: "Yes",
                            false: "No",
                          }[String(response.value).toLowerCase() as "true" | "false"] ??
                            response.value ??
                            "—"}
                        </span>
                      {response.reasoning ? (
                        <p style={{ margin: 0, fontSize: "13px", color: "rgba(15, 23, 42, 0.75)", textAlign:"right" }}>
                          {response.reasoning}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(15, 23, 42, 0.6)",
                      textAlign: "left",
                    }}
                  >
                    {formatReceivedAt(response.created_at)}
                  </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.6)" }}>
              No responses have been submitted yet.
            </p>
          )}
        </div>
      </SlidingPanelOverlay>
    </div>
  );
}
