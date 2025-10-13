"use client";

import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { useConversation } from "@elevenlabs/react";
import Image from "next/image";
import { docMap } from "@/app/lib/docMap";
import { insertContactRequest } from "@/app/lib/contactRequests";
import { insertSummaryRequest } from "@/app/lib/summaryRequests";

const POST_CALL_BASE =
  process.env.NEXT_PUBLIC_POST_CALL_BASE_URL?.replace(/\/$/, "") ?? "";
const POST_CALL_ENDPOINT = POST_CALL_BASE
  ? `${POST_CALL_BASE}/api/eleven/post-call`
  : "/api/eleven/post-call";

interface BriefMeButtonProps {
  agentId: string;
  transcript?: any;
  conversationId?: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  buttonBorderColor?: string;
  title?: string;
  talkLabel?: string;
}

type Phase = "idle" | "ready" | "connecting" | "connected";

import { createPortal } from "react-dom";

export const BriefMeButton: React.FC<BriefMeButtonProps> = ({
  agentId,
  transcript,
  conversationId,
  useSignedUrl = false,
  serverLocation = "us",
  buttonColor = "#525fe1",
  buttonTextColor = "#ffffff",
  buttonBorderColor,
  title = "",
  talkLabel = "Talk",
}) => {
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
    // Enhanced error logging for debugging CloseEvent and other errors
    if (e instanceof Error) {
      setErr(e.message);
      // Log stack and error object
      // eslint-disable-next-line no-console
      console.error("BriefMeButton error:", e, e.stack);
    } else if (typeof e === "object" && e !== null && "code" in e && "reason" in e) {
      // Likely a CloseEvent
      const ce = e as CloseEvent;
      const msg = `Connection closed (code: ${ce.code}, reason: ${ce.reason || "no reason"})`;
      setErr(msg);
      // eslint-disable-next-line no-console
      console.error("BriefMeButton CloseEvent:", ce);
    } else {
      setErr(String(e));
      // eslint-disable-next-line no-console
      console.error("BriefMeButton unknown error:", e);
    }
  }, []);

  const conversationClientTools = useMemo(
    () => ({
      contact_form_popup: async () => {
        setContactClosing(false);
        setContactSubmitted(false);
        setContactOpen((prev) => (prev ? prev : true));
      },
    }),
    []
  );

  const conversationOptions = useMemo(
    () => ({
      serverLocation,
      onConnect: handleConversationConnect,
      onDisconnect: handleConversationDisconnect,
      onError: handleConversationError,
      clientTools: conversationClientTools,
      micMuted,
    }),
    [
      serverLocation,
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

      // Prepare session options with transcript and conversationId as dynamic variables (per ElevenLabs docs)
      const dynamicVars: Record<string, any> = {};
      if (transcript) dynamicVars.transcript = transcript;
      if (conversationId) dynamicVars.conversation_id = conversationId;
      // Log the dynamic variables for verification
      // eslint-disable-next-line no-console
      console.log("[BriefMeButton] connect() dynamicVars:", dynamicVars);
      const sessionOptions: any = {
        agentId,
        connectionType: "websocket",
        ...(Object.keys(dynamicVars).length > 0 ? { dynamicVariables: dynamicVars } : {}),
      };
      // Log the session options for verification
      // eslint-disable-next-line no-console
      console.log("[BriefMeButton] connect() sessionOptions:", sessionOptions);

      if (useSignedUrl) {
        const res = await fetch('/api/eleven/get-signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId })
        });
        let data;
        try {
          data = await res.json();
        } catch (err) {
          const text = await res.text();
          // eslint-disable-next-line no-console
          console.error("Failed to parse JSON from get-signed-url:", err, text);
          throw new Error(`Failed to parse JSON: ${err}\nResponse text: ${text}`);
        }
        if (!res.ok || !data?.signedUrl) {
          // eslint-disable-next-line no-console
          console.error("get-signed-url error:", data);
          throw new Error(data?.error || "Failed to get signed URL");
        }
        // Log the startSession call for verification
        // eslint-disable-next-line no-console
        console.log("[BriefMeButton] startSession (signedUrl) dynamicVars:", dynamicVars);
        await startSession({
          signedUrl: data.signedUrl,
          connectionType: "websocket",
          ...(Object.keys(dynamicVars).length > 0 ? { dynamicVariables: dynamicVars } : {}),
        });
      } else {
        // Log the startSession call for verification
        // eslint-disable-next-line no-console
        console.log("[BriefMeButton] startSession (no signedUrl) sessionOptions:", sessionOptions);
        await startSession(sessionOptions);
      }

      const latestId = getId?.();
      if (latestId) {
        conversationIdRef.current = latestId;
      }

      setPhase("connected");
    } catch (error) {
      // Enhanced error logging
      // eslint-disable-next-line no-console
      console.error("BriefMeButton connect() error:", error);
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
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
  const effectiveTalkLabel = talkLabel?.trim() ? talkLabel.trim() : "Talk";
  const talkBackground = buttonColor;
  const talkTextColor = buttonTextColor;
  const talkIdleAriaLabel = `Connect and ${effectiveTalkLabel}`;
  const talkActiveAriaLabel = effectiveTalkLabel;
  const cardBorderColor = buttonBorderColor ?? buttonColor ?? "#525fe1";
  const agentMatch = useMemo(() => {
    for (const [slug, entry] of Object.entries(docMap)) {
      if (entry.agentId === agentId)
        return { slug, entry };
    }
    return undefined;
  }, [agentId]);
  const agentSlug = agentMatch?.slug ?? "";
  const agentEntry = agentMatch?.entry;
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
      try {
        const result = await insertContactRequest({
          agent_id: agentId,
          name: contactName,
          user_email: contactEmail,
          phone: contactPhone,
          conversation_id: conversationId || undefined,
        });
        if (result.error) {
          console.error("Supabase insert error:", result.error, result);
        }
      } catch (e) {
        console.error("Failed to insert contact request in Supabase (exception)", e);
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
      agentId,
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
            agent_id: agentId,
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
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!expanded) return;
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    // Position overlay as a floating popover above and to the left of the button
    const overlayWidth = 260; // fixed width for compact overlay
    const overlayHeight = 56; // slightly taller for popover
    const verticalOffset = 8; // space between overlay and button
    setOverlayStyle({
      position: "absolute",
      // Position so the bottom right of overlay is near the top left of the button
      top: rect.top + scrollY - overlayHeight - verticalOffset,
      left: rect.left + scrollX - overlayWidth + 8, // 8px gap from left of button
      zIndex: 9999,
      width: `${overlayWidth}px`,
      height: `${overlayHeight}px`,
      maxWidth: isNarrow ? "100vw" : `${overlayWidth}px`,
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
    });
  }, [expanded, isNarrow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let root = document.getElementById("briefme-overlay-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "briefme-overlay-root";
      document.body.appendChild(root);
    }
    setOverlayRoot(root);
    return () => {
      // Optionally clean up
    };
  }, []);

  const cardStyle: CSSProperties = {
    background: "rgb(229, 231, 235)",
    border: `1px solid ${cardBorderColor}`,
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,.10)",
    backdropFilter: "saturate(1.2) blur(3px)",
    WebkitBackdropFilter: "saturate(1.2) blur(3px)",
    padding: "4px 10px",
    transition: "transform 120ms ease, padding 120ms ease",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: "100%",
    minHeight: 0,
    minWidth: 0,
    fontFamily: '"Cooper Light BT", "Cooper Lt BT", "Cooper", serif',
    fontWeight: 500,
    letterSpacing: "0.02em",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    fontSize: 13,
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
    <>
      {/* The inline button, always visible, acts as the trigger and anchor */}
      <div ref={buttonRef} style={{ display: "inline-block", width: "100%" }}>
        <div style={rightGroupStyle}>
          <button
            type="button"
            onClick={async () => {
              if (phase !== "connecting") {
                if (connected) {
                  await disconnect();
                } else {
                  await onMicClick();
                }
              }
            }}
            aria-label={connected ? "Stop briefing" : talkIdleAriaLabel}
            title={connected ? "Stop briefing" : talkIdleAriaLabel}
            disabled={phase === "connecting"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "7px 16px",
              borderRadius: 8,
              border: "1px solid #2d406b",
              background: connected ? "#ef4444" : "#525fe1",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: phase === "connecting" ? "default" : "pointer",
              boxShadow: "0 2px 8px rgba(10,22,40,0.13)",
              transition: "background 0.18s, color 0.18s",
              opacity: phase === "connecting" ? 0.7 : 1,
              minWidth: 90,
              width: "100%",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                <rect x="2" y="6" width="3" height="8" rx="1" fill="currentColor" />
                <rect x="8.5" y="3" width="3" height="14" rx="1" fill="currentColor" />
                <rect x="15" y="8" width="3" height="6" rx="1" fill="currentColor" />
              </svg>
            </span>
            {connected ? "Stop" : "Brief Me"}
          </button>
        </div>
      </div>
      {/* Overlay card, rendered in portal when expanded */}
      {overlayRoot && expanded &&
        createPortal(
          <div style={overlayStyle}>
            <div style={cardStyle}>
              {/* Compact overlay: show leftGroup and middleGroup icon buttons, compacted */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {/* Left group: share only */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      padding: "4px 6px",
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 28,
                      minWidth: 28,
                      width: 28,
                      height: 28,
                      opacity: shareUrl ? 1 : 0.6,
                      transition:
                        "background .15s ease, color .15s ease, opacity .15s ease",
                    }}
                    disabled={!shareUrl}
                  >
                    {copyFeedback === "copied" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
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
                        width={16}
                        height={16}
                        style={{
                          display: "block",
                          width: 16,
                          height: 16,
                          objectFit: "contain",
                        }}
                      />
                    )}
                  </button>
                </div>
                {/* Middle group: end call, mute, pause */}
                {connected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10 }}>
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
                        padding: "4px 6px",
                        borderRadius: 8,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 28,
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        transition: "background .15s ease, color .15s ease",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
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
                        padding: "4px 6px",
                        minHeight: 28,
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,.12)",
                        background: micMuted ? "#e0f2fe" : "#e5e7eb",
                        color: micMuted ? "#0f172a" : "#111827",
                        cursor: !connected || phase === "connecting" ? "default" : "pointer",
                        opacity: !connected || phase === "connecting" ? 0.6 : 1,
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        transition: "background .15s ease, color .15s ease, opacity .15s ease",
                      }}
                    >
                      <svg width="12" height="16" viewBox="0 0 14 18" aria-hidden="true">
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
                        padding: "4px 6px",
                        minHeight: 28,
                        borderRadius: 8,
                        border: "1px solid rgba(0,0,0,.12)",
                        background: isPaused ? "#fee2e2" : "#f3f4f6",
                        color: isPaused ? "#b91c1c" : "#111827",
                        cursor: !connected || phase === "connecting" ? "default" : "pointer",
                        opacity: !connected || phase === "connecting" ? 0.6 : 1,
                        minWidth: 28,
                        width: 28,
                        height: 28,
                        transition: "background .15s ease, color .15s ease, opacity .15s ease",
                      }}
                    >
                      <svg width="10" height="14" viewBox="0 0 12 14" aria-hidden="true">
                        <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" />
                        <rect x="8" y="1" width="3" height="12" rx="1" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {err && (
                <div style={{ color: "#b91c1c", marginLeft: 8, fontSize: 12 }}>{err}</div>
              )}
            </div>
          </div>,
          overlayRoot
        )}
    </>
  );
};