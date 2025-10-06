"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useConversation } from "@elevenlabs/react";

type Props = {
  agentId: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  buttonBorderColor?: string;
  title?: string;
};

type Phase = "idle" | "ready" | "connecting" | "connected";

type TranscriptMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
};

type ClientEvent =
  | { type: "user_transcript"; text: string }
  | { type: "agent_response"; text: string };

const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 200;

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function DialogueText({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
  buttonColor = "#525fe1",
  buttonTextColor = "#ffffff",
  buttonBorderColor,
  title = "",
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [wasMutedBeforePause, setWasMutedBeforePause] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState("");

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLocalUserMessageRef = useRef<string>("");
  const lastRemoteUserTranscriptRef = useRef<string>("");
  const lastAgentMessageIdRef = useRef<string | null>(null);
  const lastAgentResponseRef = useRef<string>("");

  const handleScrollToBottom = useCallback(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    handleScrollToBottom();
  }, [messages, handleScrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = matchMedia("(max-width: 428px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    const el = draftInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.max(
      MIN_TEXTAREA_HEIGHT,
      Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
    );
    el.style.height = `${nextHeight}px`;
  }, [draft]);

  const appendUserMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = makeMessageId();
    setMessages((prev) => [...prev, { id, role: "user", text: trimmed }]);
    handleScrollToBottom();
  }, [handleScrollToBottom]);

  const appendAgentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = makeMessageId();
    lastAgentMessageIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: "agent", text: trimmed }]);
    handleScrollToBottom();
  }, [handleScrollToBottom]);

  const replaceLastAgentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !lastAgentMessageIdRef.current) return;
    setMessages((prev) => {
      const next = [...prev];
      const idx = next.findIndex((m) => m.id === lastAgentMessageIdRef.current);
      if (idx === -1) return prev;
      next[idx] = { ...next[idx], text: trimmed };
      return next;
    });
    handleScrollToBottom();
  }, [handleScrollToBottom]);

  const handleClientEvent = useCallback(
    ({ type, text }: ClientEvent) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (type === "user_transcript") {
        if (trimmed === lastLocalUserMessageRef.current) {
          lastLocalUserMessageRef.current = "";
          return;
        }
        if (trimmed === lastRemoteUserTranscriptRef.current) return;
        lastRemoteUserTranscriptRef.current = trimmed;
        appendUserMessage(trimmed);
        return;
      }

      if (trimmed === lastAgentResponseRef.current) return;
      lastAgentResponseRef.current = trimmed;
      appendAgentMessage(trimmed);
    },
    [appendAgentMessage, appendUserMessage]
  );

  const handleAgentCorrection = useCallback(
    (text: string | undefined) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      lastAgentResponseRef.current = trimmed;
      replaceLastAgentMessage(trimmed);
    },
    [replaceLastAgentMessage]
  );

  const {
    startSession,
    endSession,
    status,
    sendUserActivity,
    sendUserMessage,
  } = useConversation({
    serverLocation,
    onConnect: () => {
      setPhase("connected");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
    },
    onDisconnect: () => {
      setPhase("ready");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
    },
    onError: (e: unknown) =>
      setErr(e instanceof Error ? e.message : String(e)),
    onMessage: ({ source, message }) => {
      const text = message ?? "";
      if (source === "user") {
        handleClientEvent({ type: "user_transcript", text });
      } else {
        handleClientEvent({ type: "agent_response", text });
      }
    },
    onDebug: (event: any) => {
      if (!event || typeof event !== "object") return;
      if (event.type === "agent_response_correction") {
        handleAgentCorrection(
          event.agent_response_correction_event?.corrected_agent_response
        );
      }
    },
    micMuted,
  });

  useEffect(() => {
    const s = String(status);
    if (s === "connected") setPhase("connected");
    else if (s === "connecting") setPhase("connecting");
    else setPhase("ready");
  }, [status]);

  async function ensureMicPerms() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("Mic permission error:", e);
    }
  }

  const connect = useCallback(async () => {
    try {
      setErr("");
      setPhase("connecting");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
      await ensureMicPerms();

      if (useSignedUrl) {
        const res = await fetch(
          `/api/eleven/get-signed-url?agent_id=${encodeURIComponent(agentId)}`
        );
        const data = await res.json();
        if (!res.ok || !data?.signedUrl)
          throw new Error(data?.error || "Failed to get signed URL");
        await startSession({
          signedUrl: data.signedUrl,
          connectionType: "websocket",
        });
      } else {
        await startSession({ agentId, connectionType: "websocket" });
      }

      setPhase("connected");
    } catch (e: any) {
      setErr(e?.message || String(e));
      setPhase("ready");
      throw e;
    }
  }, [agentId, startSession, useSignedUrl]);

  const disconnect = useCallback(async () => {
    try {
      await endSession();
      setPhase("ready");
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }, [endSession]);

  const handleStop = useCallback(async () => {
    try {
      await disconnect();
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: "system",
          text: "You ended the dialogue.",
        },
      ]);
    } catch (error) {
      console.error("Failed to end session", error);
    }
  }, [disconnect]);

  const onMicClick = useCallback(async () => {
    if (String(status) !== "connected") {
      try {
        await connect();
      } catch (error) {
        console.error("Failed to connect", error);
      }
    } else {
      sendUserActivity();
    }
  }, [connect, sendUserActivity, status]);

  const connected = String(status) === "connected";
  const talkBackground = buttonColor;
  const talkTextColor = buttonTextColor;

  const containerMaxWidth = useMemo(
    () => (isNarrow ? "100%" : 520),
    [isNarrow]
  );

  const showConversationUI = connected || messages.length > 0 || draft.trim().length > 0;
  const cardWidth = isNarrow ? "100%" : "420px";
  const containerWidth = showConversationUI ? cardWidth : containerMaxWidth;

  const renderTalkButton = () => {
    if (connected) return null;
    return (
      <button
        type="button"
        onClick={async () => {
          if (phase !== "connecting") await onMicClick();
        }}
        aria-label="Connect and start talking"
        title="Connect and talk"
        disabled={phase === "connecting"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "0 12px",
          height: 40,
          minWidth: isNarrow ? 90 : 110,
          borderRadius: 12,
          border: `1px solid ${buttonBorderColor ?? "rgba(0,0,0,.06)"}`,
          background: phase === "connecting" ? "#d1d5db" : talkBackground,
          color: talkTextColor,
          fontWeight: 700,
          cursor: phase === "connecting" ? "default" : "pointer",
          transition: "background .15s ease, opacity .15s ease",
          opacity: phase === "connecting" ? 0.7 : 1,
          flexShrink: 0,
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
            <span>Talk</span>
          </>
        )}
      </button>
    );
  };

  const talkButtonElement = renderTalkButton();

  const actionRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  };

  const talkButton = renderTalkButton();

const transcriptStyle: CSSProperties = {
  padding: isNarrow ? 10 : 14,
  maxHeight: isNarrow ? "70vh" : "70vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  justifyContent: "flex-start",
  alignItems: "stretch",
};

  const messageBubble = (message: TranscriptMessage) => {
    if (message.role === "system") {
      return (
        <div
          key={message.id}
          style={{
            alignSelf: "center",
            color: "#6b7280",
            fontSize: 12,
          }}
        >
          {message.text}
        </div>
      );
    }
    const isUser = message.role === "user";
    return (
      <div
        key={message.id}
        style={{
          alignSelf: isUser ? "flex-end" : "flex-start",
          maxWidth: "85%",
          background: isUser ? "#4f46e5" : "#e0e7ff",
          color: isUser ? "#fff" : "#1e1b4b",
          padding: "10px 14px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          fontSize: 14,
          lineHeight: 1.4,
          textAlign: isUser ? "right" : "left",
          boxShadow: "0 4px 12px rgba(0,0,0,.08)",
          wordBreak: "break-word",
        }}
      >
        {message.text}
      </div>
    );
  };

  async function handleSubmitMessage() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    lastLocalUserMessageRef.current = text;
    try {
      if (!connected) {
        await connect();
      }
      appendUserMessage(text);
      await sendUserMessage?.(text);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  return (
    <div
      style={{
        width: containerWidth,
        maxWidth: containerWidth,
        margin: "0 auto",
        padding: isNarrow ? "0 8px" : "0 12px",
        boxSizing: "border-box",
        textAlign: "center",
        fontFamily: '"Cooper Light BT", "Cooper Lt BT", "Cooper", serif',
        fontWeight: 500,
        letterSpacing: "0.02em",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: isNarrow ? 16 : 18,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 12,
          }}
        >
          {title}
        </div>
      ) : null}

      {showConversationUI ? (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${buttonBorderColor ?? "rgba(0,0,0,.08)"}`,
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,.12)",
            backdropFilter: "saturate(1.1) blur(6px)",
            WebkitBackdropFilter: "saturate(1.1) blur(6px)",
            padding: isNarrow ? 12 : 16,
            marginTop: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: "100%",
            minHeight: isNarrow ? undefined : "60vh",
            maxHeight: isNarrow ? undefined : "60vh",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            ref={transcriptRef}
            style={{
              ...transcriptStyle,
              flex: 1,
              minHeight: 0,
              width: "100%",
              overflowY: "auto",
              justifyContent: "flex-start",
            }}
            aria-live="polite"
          >
            {messages.map((message) => messageBubble(message))}
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              width: "100%",
              flexShrink: 0,
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (phase !== "connecting") {
                  void handleSubmitMessage();
                }
              }}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                background: "rgba(255,255,255,0.9)",
                borderRadius: 14,
                border: "1px solid rgba(82,95,225,0.18)",
                padding: 0,
                flex: 1,
                minWidth: 0,
              }}
              >
                <textarea
                  ref={draftInputRef}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    sendUserActivity();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (phase !== "connecting") {
                        void handleSubmitMessage();
                      }
                    }
                  }}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  rows={1}
                  style={{
                    flex: 1,
                    minHeight: MIN_TEXTAREA_HEIGHT,
                    height: MIN_TEXTAREA_HEIGHT,
                    resize: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 14,
                    lineHeight: 1.4,
                    color: "#111827",
                    background: "transparent",
                    overflow: "hidden",
                    padding: "10px 12px",
                    boxSizing: "border-box",
                  }}
                  onInput={(event) => {
                    const el = event.currentTarget;
                    el.style.height = "auto";
                    const nextHeight = Math.max(
                      MIN_TEXTAREA_HEIGHT,
                      Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
                    );
                    el.style.height = `${nextHeight}px`;
                  }}
                />
              {draft.trim() ? (
                <button
                  type="submit"
                  disabled={phase === "connecting"}
                  aria-label="Send message"
                  style={{
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: talkBackground,
                    cursor: phase === "connecting" ? "not-allowed" : "pointer",
                    transition: "background .15s ease, color .15s ease",
                    height: 40,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2.294 3.353a1 1 0 0 1 1.053-.162l13 5.5a1 1 0 0 1 0 1.818l-13 5.5A1 1 0 0 1 2 15.1V4.9a1 1 0 0 1 .294-.647ZM4 6.618v6.764L12.382 10 4 6.618Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              ) : null}
            </form>

            {connected ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="End call"
                title="End call"
                style={{
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#b91c1c",
                  cursor: "pointer",
                  padding: "0 16px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 40,
                  transition: "background .15s ease, color .15s ease",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="3" y="3" width="10" height="10" rx="3" fill="currentColor" />
                </svg>
              </button>
            ) : (
              talkButtonElement
            )}
          </div>
        </div>
      ) : (
        <div style={actionRowStyle}>{talkButtonElement}</div>
      )}

      {err && (
        <div style={{ color: "#b91c1c", fontSize: 14, marginTop: 12 }}>{err}</div>
      )}
    </div>
  );
}
