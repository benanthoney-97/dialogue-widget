"use client";

import { KeyboardEvent, MouseEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
const responsesIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#091F5B" viewBox="0 0 16 16">
    <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z" />
  </svg>
);
const newIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#001F3F" viewBox="0 0 16 16">
    <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z" />
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

type CampaignOutputType = "string" | "boolean" | "number";

type CampaignOutput = {
  type: CampaignOutputType;
  description: string;
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
    const type = normalizeOutputType(record.type);
    acc.push({ type, description });
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
  const [campaignSections, setCampaignSections] = useState<CampaignSection[]>([]);
  const [qrMenuFor, setQrMenuFor] = useState<string | null>(null);
  const [phoneMenuFor, setPhoneMenuFor] = useState<string | null>(null);
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
      setQrMenuFor(null);
      setPhoneMenuFor(null);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

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
      setQrMenuFor(null);
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
            imageUrl: campaign.image_url ?? null,
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

          return {
            ...campaign,
            personas,
            resultsCount,
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
  }, [fetchPersonaDetails, fetchResponseCounts, fetchCampaignLinks]);
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
          const metrics = [
            { label: "Results", value: formattedResultsValue, icon: responsesIcon },
            { label: "New", value: "15", icon: newIcon },
          ];
          return (
            <section
              key={container.title}
              className="campaign-card"
              style={{
                width: "100%",
                background: "#f8f9ff",
                borderRadius: "18px",
                padding: "32px",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
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
                    alignItems: "center",
                    gap: "16px",
                    flex: columnFlex,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.18)",
                    }}
                  >
                    <Image
                      src={container.imageUrl ?? FALLBACK_CAMPAIGN_IMAGE}
                      width={48}
                      height={48}
                      alt={container.title}
                      unoptimized
                      priority
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{container.title}</h2>
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
                        alignItems: "flex-end",
                        gap: "2px",
                        minWidth: 64,
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
                            fontSize: "16px",
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
                      border: "none",
                      borderRadius: "999px",
                      padding: "6px 16px",
                      background: "rgba(15, 23, 42, 0.08)",
                      color: "#0f172a",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
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
                                          <button
                                            key={`${entry.id}-${action.key}`}
                                            type="button"
                                            title={action.label}
                                            aria-label={`${action.label} for ${container.title}`}
                                            aria-disabled={disabled}
                                            style={{
                                              ...sharedStyle,
                                              cursor: disabled ? "not-allowed" : "pointer",
                                              opacity: disabled ? 0.6 : 1,
                                            }}
                                            onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                              preventCardToggle(event);
                                              if (!publicPath || disabled) {
                                                console.warn("[campaigns page] missing public campaign path for share link action");
                                                return;
                                              }
                                              router.push(publicPath);
                                            }}
                                          >
                                            {action.icon}
                                          </button>
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
                                                  onClick={() =>
                                                    handleDownloadQr(
                                                      entry.qrCodeUrl ?? "",
                                                      `${entry.linkId ?? entry.id ?? "qr"}-code.png`
                                                    )
                                                  }
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
                                                  onClick={() => handleCopyQr(entry.qrCodeUrl ?? "")}
                                                >
                                                  Copy Image
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
                                                  onClick={() =>
                                                    handleTestCall({
                                                      linkId: entry.linkId ?? undefined,
                                                    })
                                                  }
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
                                                  onClick={() =>
                                                    handleCopyPhoneNumber({
                                                      linkId: entry.linkId,
                                                    })
                                                  }
                                                >
                                                  Copy call link
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Outputs
              </h3>
              {overlayOutputs ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  {overlayOutputs.map((output, index) => (
                    <div
                      key={`${output.description}-${index}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        background: "#f5f7ff",
                        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                        flex: "1 1 calc(33.333% - 16px)",
                        maxWidth: "calc(33.333% - 16px)",
                        minWidth: "220px",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "13px",
                          color: "rgba(15,23,42,0.85)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "2px 10px",
                            borderRadius: "999px",
                            background: "rgba(21, 94, 239, 0.08)",
                            color: "#155EEF",
                            fontSize: "11px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatOutputType(output.type)}
                        </span>
                        <span style={{ lineHeight: 1.4 }}>{output.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "14px", color: "rgba(15, 23, 42, 0.6)" }}>
                  Define outputs for your campaign to summarize expected responses.
                </p>
              )}
            </div>
          </div>
        </div>
      </SlidingPanelOverlay>
    </div>
  );
}
