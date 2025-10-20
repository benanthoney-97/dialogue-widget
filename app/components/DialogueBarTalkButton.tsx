"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { createClient } from "@supabase/supabase-js";
import { useConversation } from "@elevenlabs/react";
import Image from "next/image";
// metadata now comes from Supabase agent_map; docMap is no longer used here
import { insertContactRequest } from "@/app/lib/contactRequests";
import { insertSummaryRequest } from "@/app/lib/summaryRequests";


const POST_CALL_BASE =
  process.env.NEXT_PUBLIC_POST_CALL_BASE_URL?.replace(/\/$/, "") ?? "";
const POST_CALL_ENDPOINT = POST_CALL_BASE
  ? `${POST_CALL_BASE}/api/eleven/post-call`
  : "/api/eleven/post-call";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  agentId: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  buttonBorderColor?: string;
  title?: string;
  talkLabel?: string;
};

type Phase = "idle" | "ready" | "connecting" | "connected";

export default function DialogueBarTalkButton({
  agentId,
  useSignedUrl = false,
  serverLocation = "us",
  buttonColor = "#525fe1",
  buttonTextColor = "#ffffff",
  buttonBorderColor,
  title = "",
  talkLabel = "Talk",
}: Props) {
  const [theme, setTheme] = useState<{
    background?: string;
    text_color?: string;
    border?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchTheme() {
      if (!agentId) return;
      const { data, error } = await supabase
        .from("theme_map")
        .select("background, text_color, border")
        .eq("agent_id", agentId)
        .single();
      if (data) setTheme(data);
    }
    fetchTheme();
  }, [agentId]);
  // load agent metadata from Supabase agent_map (if present)
  const [agentMap, setAgentMap] = useState<null | {
    idx?: number;
    key?: string | null;
    pdf_path?: string | null;
    agent_id?: string | null;
    agent_name?: string | null;
    region?: string | null;
    auth?: string | null;
    talk_label?: string | null;
    screenshot_path?: string | null;
    author?: string | null;
    work_label?: string | null;
    url?: string | null;
    client_id?: number | null;
    testing_mode?: boolean | null;
  }>(null);

  useEffect(() => {
    async function fetchAgentMap() {
      if (!agentId) return;
      try {
        const { data, error, status } = await supabase
          .from("agent_map")
          .select(
            "key, pdf_path, agent_id, agent_name, region, auth, talk_label, screenshot_path, author, work_label, url, client_id, background_image, testing_mode"
          )
          .eq("agent_id", agentId)
          .maybeSingle();
        if (error) {
          // Log warning but don't throw
        }
        if (data) setAgentMap(data as any);
      } catch (e) {
        // ignore - keep using passed agentId as fallback
        // console.debug('No agent_map row found for', agentId, e?.toString?.());
      }
    }
    fetchAgentMap();
  }, [agentId]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [wasMutedBeforePause, setWasMutedBeforePause] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [contactClosing, setContactClosing] = useState(false);
  const [contactHeight, setContactHeight] = useState(300);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const contactFormRef = useRef<HTMLFormElement | null>(null);
  const measureContactHeight = useCallback(() => {
    const node = contactFormRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    const height = rect.height;
    setContactHeight((prev) => (prev !== height ? height : prev));
    return height;
  }, []);
  const beginContactClose = useCallback(() => {
    if (contactClosing) return;
    const measured = measureContactHeight();
    if (!measured) {
      setContactHeight((prev) => (prev > 0 ? prev : 300));
    }
    setContactClosing(true);
    setContactOpen(false);
  }, [contactClosing, measureContactHeight]);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryClosing, setSummaryClosing] = useState(false);
  const [summaryHeight, setSummaryHeight] = useState(220);
  const [summarySubmitted, setSummarySubmitted] = useState(false);
  const [summaryEmail, setSummaryEmail] = useState("");
  const summaryFormRef = useRef<HTMLFormElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const measureSummaryHeight = useCallback(() => {
    const node = summaryFormRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    const height = rect.height;
    setSummaryHeight((prev) => (prev !== height ? height : prev));
    return height;
  }, []);
  const beginSummaryClose = useCallback(() => {
    if (summaryClosing) return;
    const measured = measureSummaryHeight();
    if (!measured) {
      setSummaryHeight((prev) => (prev > 0 ? prev : 220));
    }
    setSummaryClosing(true);
    setSummaryOpen(false);
  }, [measureSummaryHeight, summaryClosing]);

  const handleConversationConnect = useCallback(() => {
    setPhase("connected");
    setMicMuted(false);
    setIsPaused(false);
    setWasMutedBeforePause(false);
    setContactOpen(false);
    setContactClosing(false);
    setContactSubmitted(false);
    setSummaryOpen(false);
    setSummaryClosing(false);
    setSummarySubmitted(false);
  }, []);

  const handleConversationDisconnect = useCallback(() => {
    setPhase("ready");
    setMicMuted(false);
    setIsPaused(false);
    setWasMutedBeforePause(false);
    setContactOpen(false);
    setContactClosing(false);
    setContactSubmitted(false);
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setSummaryOpen(false);
    setSummaryClosing(false);
    setSummarySubmitted(false);
    setSummaryEmail("");
  }, []);

  const handleConversationError = useCallback((e: unknown) => {
    setErr(e instanceof Error ? e.message : String(e));
  }, []);

  const conversationClientTools = useMemo(
    () => ({
      contact_form_popup: async () => {
        setContactClosing(false);
        setContactSubmitted(false);
        setContactOpen((prev) => (prev ? prev : true));
      },
      // Handler for the `open_document` client tool. Forwards payload to session page.
      open_document: async (payload: any) => {
        try {
          const bc = new BroadcastChannel("elevenlabs");
          bc.postMessage({ type: "elevenlabs.openDocument", payload });
          bc.close();
        } catch (e) {
          // ignore
        }
        try {
          if (typeof window !== "undefined" && window.parent && window.parent !== window) {
            window.parent.postMessage({ type: "elevenlabs.openDocument", payload }, "*");
          }
        } catch (e) {
          // ignore
        }
      },
    }),
    []
  );

  // prefer region from agent_map if available
  const effectiveAgentId = agentMap?.agent_id || agentId;
  const effectiveServerLocation = (agentMap?.region as
    | "us"
    | "eu-residency"
    | "in-residency"
    | "global") || serverLocation;

  const conversationOptions = useMemo(
    () => ({
      serverLocation: effectiveServerLocation,
      onConnect: handleConversationConnect,
      onDisconnect: handleConversationDisconnect,
      onError: handleConversationError,
      clientTools: conversationClientTools,
      micMuted,
    }),
    [
      effectiveServerLocation,
      handleConversationConnect,
      handleConversationDisconnect,
      handleConversationError,
      conversationClientTools,
      micMuted,
    ]
  );

  const {
    startSession,
    endSession,
    status,
    sendUserActivity,
    sendUserMessage,
    getId,
  } =
    useConversation(conversationOptions);

  useEffect(() => {
    const id = getId?.();
    if (id) {
      conversationIdRef.current = id;
    }
  }, [getId, status]);

  useEffect(() => {
    const s = String(status);
    if (s === "connected") setPhase("connected");
    else if (s === "connecting") setPhase("connecting");
    else setPhase("ready");
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = matchMedia("(max-width: 428px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  async function ensureMicPerms() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("Mic permission error:", e);
    }
  }

  async function connect() {
    try {
      setErr("");
      setPhase("connecting");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
      await ensureMicPerms();

      const effectiveUseSignedUrl = agentMap?.auth === "signed" ? true : useSignedUrl;
      const effectiveAgent = agentMap?.agent_id || agentId;

      if (effectiveUseSignedUrl) {
        const res = await fetch('/api/eleven/get-signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: effectiveAgent })
        });
        let data;
        try {
          data = await res.json();
        } catch (err) {
          const text = await res.text();
          throw new Error(`Failed to parse JSON: ${err}\nResponse text: ${text}`);
        }
        if (!res.ok || !data?.signedUrl)
          throw new Error(data?.error || "Failed to get signed URL");
        // determine testing_mode preference: agentMap takes precedence, fall back to page global
        const testingModeFromAgent = agentMap?.testing_mode;
        const testingModeFromWindow = (typeof window !== "undefined" && (window as any).__DOC_TESTING_MODE__ !== undefined)
          ? Boolean((window as any).__DOC_TESTING_MODE__)
          : undefined;
        const testing_mode = typeof testingModeFromAgent !== "undefined" ? Boolean(testingModeFromAgent) : testingModeFromWindow;

        await startSession({
          signedUrl: data.signedUrl,
          connectionType: "websocket",
          dynamicVariables: testing_mode !== undefined ? { testing_mode } : undefined,
        });
      } else {
        // determine testing_mode preference: agentMap takes precedence, fall back to page global
        const testingModeFromAgent2 = agentMap?.testing_mode;
        const testingModeFromWindow2 = (typeof window !== "undefined" && (window as any).__DOC_TESTING_MODE__ !== undefined)
          ? Boolean((window as any).__DOC_TESTING_MODE__)
          : undefined;
        const testing_mode2 = typeof testingModeFromAgent2 !== "undefined" ? Boolean(testingModeFromAgent2) : testingModeFromWindow2;

        await startSession({ agentId: effectiveAgent, connectionType: "websocket", dynamicVariables: testing_mode2 !== undefined ? { testing_mode: testing_mode2 } : undefined });
      }

      const latestId = getId?.();
      if (latestId) {
        conversationIdRef.current = latestId;
      }

      setPhase("connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      setErr(message);
      setPhase("ready");
    }
  }

  async function disconnect() {
    try {
      await endSession();
      setPhase("ready");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      setErr(message);
    }
  }

  async function onMicClick() {
    if (String(status) !== "connected") {
      await connect();
    } else {
      sendUserActivity();
    }
  }

  const connected = String(status) === "connected";
  // prefer talk label from agent_map if present
  const effectiveTalkLabel = (agentMap?.talk_label || talkLabel)?.trim()
    ? (agentMap?.talk_label || talkLabel)!.trim()
    : "Talk";
  const talkBackground = theme?.background || buttonColor;
  const talkTextColor = theme?.text_color || buttonTextColor;
  const talkIdleAriaLabel = `Connect and ${effectiveTalkLabel}`;
  const talkActiveAriaLabel = effectiveTalkLabel;
  const cardBorderColor = theme?.border || buttonBorderColor || buttonColor || "#525fe1";
  // derive frontend metadata from agent_map row if present
  const agentSlug = agentMap?.key || "";
  const agentEntry = agentMap
    ? {
        pdfPath: agentMap.pdf_path ?? undefined,
        agentId: agentMap.agent_id ?? undefined,
        agentName: agentMap.agent_name ?? undefined,
        region: agentMap.region ?? undefined,
        auth: agentMap.auth ?? undefined,
        talkLabel: agentMap.talk_label ?? undefined,
        url: agentMap.url ?? undefined,
        screenshotPath: agentMap.screenshot_path ?? undefined,
        author: agentMap.author ?? undefined,
        workLabel: agentMap.work_label ?? undefined,
      }
    : undefined;

  const contactAuthorLabel = agentEntry?.author?.trim()
    ? agentEntry.author.trim()
    : "the author";
  const contactWorkLabel = agentEntry?.workLabel?.trim()
    ? agentEntry.workLabel.trim()
    : "research";
  const contactTitle = `Contact ${contactAuthorLabel} about this ${contactWorkLabel}`;
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base = window.location.origin;
    const resolvedUrl = agentEntry?.url
      ? agentEntry.url.startsWith("http")
        ? agentEntry.url
        : `${base}${agentEntry.url}`
      : agentSlug
      ? `${base}/widget/${agentSlug}`
      : window.location.href;
    setShareUrl(resolvedUrl);
  }, [agentEntry, agentSlug]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("Fallback copy command failed");
      }
      setCopyFeedback("copied");
    } catch (error) {
      console.error("Failed to copy agent link", error);
      setCopyFeedback("error");
    }
  }, [shareUrl]);

  useEffect(() => {
    if (copyFeedback === "idle") return;
    const timeout = window.setTimeout(() => setCopyFeedback("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const toggleContact = useCallback(() => {
    if (contactOpen) {
      setContactSubmitted(false);
      beginContactClose();
    } else if (!contactClosing) {
      setContactOpen(true);
    }
  }, [beginContactClose, contactClosing, contactOpen]);

  const toggleSummary = useCallback(() => {
    if (summaryOpen) {
      setSummarySubmitted(false);
      beginSummaryClose();
    } else if (!summaryClosing) {
      setSummaryOpen(true);
    }
  }, [beginSummaryClose, summaryClosing, summaryOpen]);

  const postSummaryOrContact = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        await fetch(POST_CALL_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId,
            callId: conversationIdRef.current ?? undefined,
            ...payload,
          }),
        });
      } catch (error) {
        console.error("Post-call webhook request failed", error);
      }
    },
    [agentId]
  );

  const handleContactSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setContactSubmitted(true);
      const conversationId = conversationIdRef.current;
      console.log("Submitting contact request", {
        agent_id: agentId,
        user_name: contactName,
        user_email: contactEmail,
        user_phone: contactPhone,
        conversation_id: conversationId,
      });
      try {
        const result = await insertContactRequest({
          agent_id: effectiveAgentId,
          name: contactName,
          user_email: contactEmail,
          phone: contactPhone,
          conversation_id: conversationId || undefined,
        });
        if (result.error) {
          console.error("Supabase insert error:", result.error, result);
        } else {
          console.log("insertContactRequest result", result);
        }
      } catch (e) {
      }
      // Optionally still call webhook for legacy/other flows
      const payload = {
        contact: {
          email: contactEmail,
          name: contactName,
          phone: contactPhone,
        },
      };
      await postSummaryOrContact(payload);
      window.setTimeout(() => {
        beginContactClose();
      }, 1200);
    },
    [
      beginContactClose,
      contactEmail,
      contactName,
      contactPhone,
      postSummaryOrContact,
    ]
  );

  useEffect(() => {
    if (!contactOpen) return;
    const measure = () => measureContactHeight();
    measure();
    if (!contactFormRef.current || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(() => measureContactHeight());
    observer.observe(contactFormRef.current);
    return () => observer.disconnect();
  }, [contactOpen, contactSubmitted, isNarrow, measureContactHeight]);

  const handleSummarySubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSummarySubmitted(true);
      // Insert into Supabase summary_requests
      const conversationId = conversationIdRef.current;
      if (agentId && summaryEmail && conversationId) {
        try {
          await insertSummaryRequest({
            agent_id: effectiveAgentId,
            user_email: summaryEmail,
            conversation_id: conversationId,
          });
        } catch (e) {
          console.error('Failed to insert summary request in Supabase', e);
        }
      }
      // Still call webhook for legacy/other flows
      const payload = {
        summary: {
          email: summaryEmail,
        },
      };
      await postSummaryOrContact(payload);
      window.setTimeout(() => {
        beginSummaryClose();
      }, 1200);
    },
    [beginSummaryClose, postSummaryOrContact, summaryEmail, agentId]
  );

  useEffect(() => {
    if (!summaryOpen) return;
    const measure = () => measureSummaryHeight();
    measure();
    if (!summaryFormRef.current || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(() => measureSummaryHeight());
    observer.observe(summaryFormRef.current);
    return () => observer.disconnect();
  }, [isNarrow, measureSummaryHeight, summaryOpen, summarySubmitted]);

  useEffect(() => {
    if (!contactOpen && contactClosing) {
      const timeout = window.setTimeout(() => {
        setContactClosing(false);
        if (contactSubmitted) {
          setContactSubmitted(false);
          setContactName("");
          setContactEmail("");
          setContactPhone("");
        }
      }, 240);
      return () => window.clearTimeout(timeout);
    }
  }, [contactClosing, contactOpen, contactSubmitted]);

  useEffect(() => {
    if (!summaryOpen && summaryClosing) {
      const timeout = window.setTimeout(() => {
        setSummaryClosing(false);
        if (summarySubmitted) {
          setSummarySubmitted(false);
          setSummaryEmail("");
        }
      }, 240);
      return () => window.clearTimeout(timeout);
    }
  }, [summaryClosing, summaryOpen, summarySubmitted]);

  const shareButtonLabel =
    copyFeedback === "copied"
      ? "Agent link copied"
      : copyFeedback === "error"
      ? "Copy failed, try again"
      : "Copy link";
  const contactVisible = contactOpen || contactClosing;
  const summaryVisible = summaryOpen || summaryClosing;
  const contactSectionHeight = Math.max(contactHeight + 24, 320);
  const summarySectionHeight = Math.max(summaryHeight + 24, 240);
  const baseExpandedWidth = 620;
  const baseCollapsedWidth = 220;
  const maxDesktopWidth = 780;
  const horizontalPadding = isNarrow ? 12 : 6;
  const verticalPadding = isNarrow ? 12 : 12;
  const expanded = connected || contactVisible || summaryVisible;
  const cardStyle: CSSProperties = {
    background: "rgb(229, 231, 235)",
    border: `1px solid ${cardBorderColor}`,
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
    backdropFilter: "saturate(1.2) blur(6px)",
    WebkitBackdropFilter: "saturate(1.2) blur(6px)",
    padding: `${verticalPadding}px ${horizontalPadding}px`,
    transition: "transform 160ms ease, padding 160ms ease",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    width: isNarrow ? "100%" : expanded ? "auto" : `${baseCollapsedWidth}px`,
    maxWidth: isNarrow ? "100%" : expanded ? `${baseExpandedWidth}px` : `${baseCollapsedWidth}px`,
    fontFamily: '"Cooper Light BT", "Cooper Lt BT", "Cooper", serif',
    fontWeight: 500,
    letterSpacing: "0.02em",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  };
  const actionRowJustify = isNarrow
    ? "stretch"
    : connected
    ? "space-between"
    : "center";
  const actionRowStyle: CSSProperties = {
    display: "flex",
    alignItems: isNarrow ? "stretch" : "center",
    justifyContent: actionRowJustify,
    gap: expanded || isNarrow ? (isNarrow ? 12 : 16) : 0,
    flexWrap: isNarrow ? "wrap" : "nowrap",
    width: expanded || isNarrow ? "100%" : "auto",
  };
  const leftGroupStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    flexWrap: isNarrow ? "wrap" : "nowrap",
    flex: isNarrow ? "1 1 100%" : "0 0 auto",
  };
  const middleGroupStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: isNarrow ? "flex-start" : "center",
    gap: 10,
    flexWrap: isNarrow ? "wrap" : "nowrap",
    flex: isNarrow ? "1 1 100%" : "0 0 auto",
  };
  const rightGroupStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "stretch",
    justifyContent: isNarrow ? "stretch" : "flex-end",
    flex: isNarrow ? "1 1 100%" : "0 0 auto",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isNarrow ? "100%" : `${maxDesktopWidth}px`,
        margin: "0 auto",
        padding: isNarrow ? "0 8px" : "0",
        boxSizing: "border-box",
        textAlign: "center",
        overflow: "visible",
      }}
    >
      <div style={cardStyle}>
        {title ? (
          <div
            style={{
              fontSize: isNarrow ? 16 : 18,
              fontWeight: 700,
              marginBottom: 12,
              color: "#111827",
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            width: isNarrow || contactVisible ? "100%" : "auto",
            overflow: "hidden",
            transition:
              "max-height 0.22s ease, opacity 0.18s ease, margin-bottom 0.22s ease",
            maxHeight: contactVisible ? contactSectionHeight : 0,
            opacity: contactOpen ? 1 : contactClosing ? 1 : 0,
            marginBottom: contactVisible ? 12 : 0,
            pointerEvents: contactOpen ? "auto" : "none",
          }}
          aria-hidden={!contactVisible}
        >
          <form
            ref={contactFormRef}
            onSubmit={handleContactSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "rgba(82,95,225,0.08)",
              border: "1px solid rgba(82,95,225,0.18)",
              borderRadius: 12,
              padding: 16,
              width: isNarrow ? "100%" : "auto",
              textAlign: "left",
              transform: contactOpen
                ? "translateY(0)"
                : contactClosing
                ? "translateY(28px)"
                : "translateY(-28px)",
              opacity: contactOpen ? 1 : contactClosing ? 1 : 0,
              transition: "transform 0.22s ease, opacity 0.18s ease",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: "#1f2937",
              }}
            >
              {contactTitle}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                Name
              </span>
              <input
                type="text"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                required
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(107,114,128,0.4)",
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                Email address
              </span>
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                required
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(107,114,128,0.4)",
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                Phone number <span style={{ fontWeight: 400 }}>(optional)</span>
              </span>
              <input
                type="tel"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="e.g. +1 202 555 0118"
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(107,114,128,0.4)",
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </label>
            <button
              type="submit"
              disabled={contactSubmitted}
              style={{
                marginTop: 4,
                alignSelf: "flex-start",
                borderRadius: 10,
                border: "none",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 14,
                background: contactSubmitted ? "#10b981" : "#525fe1",
                color: "#fff",
                cursor: contactSubmitted ? "default" : "pointer",
                transition: "background .18s ease, transform .18s ease",
              }}
            >
              {contactSubmitted ? "We'll be in touch" : "Submit"}
            </button>
          </form>
        </div>
        <div
          style={{
            width: isNarrow || summaryVisible ? "100%" : "auto",
            overflow: "hidden",
            transition:
              "max-height 0.22s ease, opacity 0.18s ease, margin-bottom 0.22s ease",
            maxHeight: summaryVisible ? summarySectionHeight : 0,
            opacity: summaryOpen ? 1 : summaryClosing ? 1 : 0,
            marginBottom: summaryVisible ? 12 : 0,
            pointerEvents: summaryOpen ? "auto" : "none",
          }}
          aria-hidden={!summaryVisible}
        >
          <form
            ref={summaryFormRef}
            onSubmit={handleSummarySubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "rgba(82,95,225,0.08)",
              border: "1px solid rgba(82,95,225,0.18)",
              borderRadius: 12,
              padding: 16,
              width: isNarrow ? "100%" : "auto",
              textAlign: "left",
              transform: summaryOpen
                ? "translateY(0)"
                : summaryClosing
                ? "translateY(28px)"
                : "translateY(-28px)",
              opacity: summaryOpen ? 1 : summaryClosing ? 1 : 0,
              transition: "transform 0.22s ease, opacity 0.18s ease",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: "#1f2937",
              }}
            >
              Get a summary of discussion
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                Email address
              </span>
              <input
                type="email"
                value={summaryEmail}
                onChange={(event) => setSummaryEmail(event.target.value)}
                required
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(107,114,128,0.4)",
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </label>
            <button
              type="submit"
              disabled={summarySubmitted}
              style={{
                marginTop: 4,
                alignSelf: "flex-start",
                borderRadius: 10,
                border: "none",
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 14,
                background: summarySubmitted ? "#10b981" : "#525fe1",
                color: "#fff",
                cursor: summarySubmitted ? "default" : "pointer",
                transition: "background .18s ease, transform .18s ease",
              }}
            >
              {summarySubmitted
                ? "You'll receive a summary to this email."
                : "Submit"}
            </button>
          </form>
        </div>

        <div
          style={{
            width: expanded || isNarrow ? "100%" : "auto",
            padding: expanded || isNarrow ? "0 12px" : "0",
            boxSizing: "border-box",
          }}
        >
        <div style={actionRowStyle}>
          {connected ? (
            <div style={leftGroupStyle}>
              <button
                type="button"
                onClick={handleCopyShareLink}
                aria-label={shareButtonLabel}
                title={shareButtonLabel}
                style={{
                  border: "1px solid rgba(0,0,0,.12)",
                  background:
                    copyFeedback === "copied"
                      ? "#dcfce7"
                      : copyFeedback === "error"
                      ? "#fee2e2"
                      : "#e5e7eb",
                  color:
                    copyFeedback === "copied"
                      ? "#15803d"
                      : copyFeedback === "error"
                      ? "#b91c1c"
                      : "#111827",
                  cursor: shareUrl ? "pointer" : "not-allowed",
                  padding: "8px 10px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  opacity: shareUrl ? 1 : 0.6,
                  transition:
                    "background .15s ease, color .15s ease, opacity .15s ease",
                }}
                disabled={!shareUrl}
              >
                {copyFeedback === "copied" ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M6.5 11.293 3.854 8.646a.5.5 0 0 0-.708.708l3 3a.5.5 0 0 0 .708 0l6-6a.5.5 0 0 0-.708-.708L6.5 11.293Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <Image
                    src="/icons/share (1).png"
                    alt=""
                    aria-hidden="true"
                    width={18}
                    height={18}
                    style={{
                      display: "block",
                      width: 18,
                      height: 18,
                      objectFit: "contain",
                    }}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={toggleSummary}
                aria-label={
                  summaryVisible ? "Hide summary form" : "Show summary form"
                }
                title={summaryVisible ? "Hide summary form" : "Get a summary"}
                disabled={summaryClosing && !summaryOpen}
                style={{
                  border: "1px solid rgba(0,0,0,.12)",
                  background: summaryVisible ? "#e0f2fe" : "#e5e7eb",
                  color: "#0f172a",
                  cursor:
                    summaryClosing && !summaryOpen ? "default" : "pointer",
                  padding: "8px 10px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  opacity: summaryClosing && !summaryOpen ? 0.7 : 1,
                  transition:
                    "background .15s ease, color .15s ease, opacity .15s ease",
                }}
              >
                {summaryVisible ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="3.5" cy="4.5" r="1.25" fill="currentColor" />
                    <rect x="6" y="3.75" width="7.5" height="1.5" rx="0.75" fill="currentColor" />
                    <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
                    <rect x="6" y="7.25" width="7.5" height="1.5" rx="0.75" fill="currentColor" />
                    <circle cx="3.5" cy="11.5" r="1.25" fill="currentColor" />
                    <rect x="6" y="10.75" width="7.5" height="1.5" rx="0.75" fill="currentColor" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={toggleContact}
                aria-label={
                  contactVisible ? "Hide contact form" : contactTitle
                }
                title={contactVisible ? "Hide contact form" : contactTitle}
                disabled={contactClosing && !contactOpen}
                style={{
                  border: "1px solid rgba(0,0,0,.12)",
                  background: contactVisible ? "#e0f2fe" : "#e5e7eb",
                  color: "#0f172a",
                  cursor:
                    contactClosing && !contactOpen ? "default" : "pointer",
                  padding: "8px 10px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  opacity: contactClosing && !contactOpen ? 0.7 : 1,
                  transition: "background .15s ease, color .15s ease, opacity .15s ease",
                }}
              >
                {contactVisible ? (
                  <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                      fill="currentColor"
                    />
                    <path
                      d="M4.5 9.5A2.5 2.5 0 0 1 7 7h2a2.5 2.5 0 0 1 2.5 2.5v.25a2.25 2.25 0 0 1-2.25 2.25h-2.5A2.75 2.75 0 0 1 4 9.25v-.25h.5Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          ) : null}
          {connected ? (
            <div style={middleGroupStyle}>
              <button
                type="button"
                onClick={disconnect}
                aria-label="End call"
                title="End call"
                style={{
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#b91c1c",
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 40,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  transition: "background .15s ease, color .15s ease",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="3" y="3" width="10" height="10" rx="3" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!connected) return;
                  setMicMuted((prev) => {
                    const next = !prev;
                    if (isPaused && !next) {
                      setIsPaused(false);
                      setWasMutedBeforePause(false);
                    }
                    return next;
                  });
                }}
                disabled={!connected || phase === "connecting"}
                aria-pressed={connected && micMuted}
                aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
                title={micMuted ? "Unmute" : "Mute"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 10px",
                  minHeight: 40,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: micMuted ? "#e0f2fe" : "#e5e7eb",
                  color: micMuted ? "#0f172a" : "#111827",
                  cursor: !connected || phase === "connecting" ? "default" : "pointer",
                  opacity: !connected || phase === "connecting" ? 0.6 : 1,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  transition: "background .15s ease, color .15s ease, opacity .15s ease",
                }}
              >
                <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
                  <path
                    d="M7 1a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 1 0 5 0v-4A2.5 2.5 0 0 0 7 1Z"
                    fill="currentColor"
                  />
                  <path
                    d="M3 8.5a1 1 0 1 0-2 0 6 6 0 0 0 5 5.917V16H4.75a.75.75 0 0 0 0 1.5h4.5a.75.75 0 1 0 0-1.5H8V14.417A6 6 0 0 0 13 8.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!connected) return;
                  if (!isPaused) {
                    setIsPaused(true);
                    setWasMutedBeforePause(micMuted);
                    setMicMuted(true);
                    try {
                      await sendUserMessage?.(
                        "Let's pause the conversation. Please Skip Turn and don't respond to this message."
                      );
                    } catch (error) {
                      console.error("Failed to send pause message", error);
                    }
                  } else {
                    setIsPaused(false);
                    setMicMuted(wasMutedBeforePause);
                    setWasMutedBeforePause(false);
                    try {
                      await sendUserMessage?.(
                        "Please continue from where we left off."
                      );
                    } catch (error) {
                      console.error("Failed to send resume message", error);
                    }
                  }
                }}
                disabled={!connected || phase === "connecting"}
                aria-pressed={connected && isPaused}
                aria-label={isPaused ? "Resume conversation" : "Pause conversation"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 10px",
                  minHeight: 40,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.12)",
                  background: isPaused ? "#fee2e2" : "#f3f4f6",
                  color: isPaused ? "#b91c1c" : "#111827",
                  cursor: !connected || phase === "connecting" ? "default" : "pointer",
                  opacity: !connected || phase === "connecting" ? 0.6 : 1,
                  minWidth: 44,
                  width: isNarrow ? "calc(33.33% - 8px)" : undefined,
                  flex: isNarrow ? "1 1 calc(33.33% - 8px)" : "0 0 auto",
                  transition: "background .15s ease, color .15s ease, opacity .15s ease",
                }}
              >
                <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
                  <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" />
                  <rect x="8" y="1" width="3" height="12" rx="1" fill="currentColor" />
                </svg>
              </button>
            </div>
          ) : null}
          <div style={rightGroupStyle}>
            <button
              type="button"
              onClick={async () => {
                if (phase !== "connecting") await onMicClick();
              }}
              aria-label={connected ? talkActiveAriaLabel : talkIdleAriaLabel}
              title={connected ? talkActiveAriaLabel : talkIdleAriaLabel}
              disabled={phase === "connecting"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: isNarrow ? "12px 16px" : "14px 18px",
                height: 48,
                minWidth: isNarrow ? 130 : 170,
                width: isNarrow ? "100%" : undefined,
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,.06)",
                background: phase === "connecting" ? "#d1d5db" : talkBackground,
                color: talkTextColor,
                fontWeight: 700,
                cursor: phase === "connecting" ? "default" : "pointer",
                transition: "background .15s ease, opacity .15s ease",
                opacity: phase === "connecting" ? 0.7 : 1,
              }}
            >
              {phase === "connecting" ? (
                <span>Connecting</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
                    <rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
                    <rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
                  </svg>
                  <span>{connected ? "Live" : effectiveTalkLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
        </div>

        {err && (
          <div style={{ color: "#b91c1c", marginTop: 16, fontSize: 14 }}>{err}</div>
        )}
      </div>
    </div>
  );
}
