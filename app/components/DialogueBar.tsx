"use client";

import { useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type Props = {
  agentId: string;                         
  useSignedUrl?: boolean;                  
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
};


type Phase = "idle" | "ready" | "connecting" | "connected";

export default function DialogueBar({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
}: Props) {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);

  const {
    startSession,
    endSession,
    status,
    isSpeaking,
    sendUserMessage,
    sendUserActivity,
  } = useConversation({
    serverLocation,
    onConnect: () => setPhase("connected"),
    onDisconnect: () => setPhase("ready"),
    onError: (e: unknown) =>
      setErr(e instanceof Error ? e.message : String(e)),
  });

  // Track connection state
  useEffect(() => {
    const s = String(status);
    if (s === "connected") setPhase("connected");
    else if (s === "connecting") setPhase("connecting");
    else setPhase("ready");
  }, [status]);

  // Track viewport width
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
    }
  }

  async function disconnect() {
    try {
      await endSession();
      setPhase("ready");
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setQ("");
    if (String(status) !== "connected") await connect();
    try {
      await sendUserMessage(text);
    } catch (e: any) {
      setErr(e?.message || String(e));
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
  const hasText = q.trim().length > 0;
  // inside your component
const inputRef = useRef<HTMLInputElement | null>(null);

useEffect(() => {
  if (inputRef.current) {
    inputRef.current.focus();
  }
}, []);

  return (
    <div style={{
      width: "100%",
      maxWidth: 920,
      margin: "0 auto",
      padding: isNarrow ? "0 8px" : "0 12px",
      boxSizing: "border-box",
    }}>
      {/* Top tip */}
      <div
        style={{
          textAlign: "left",
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 8,
        }}
      >
        <strong>Tip:</strong> Press <strong>Enter</strong> to send • Tap <strong>Talk</strong> to speak
      </div>

<form
  onSubmit={onSubmit}
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 0,
    borderRadius: 20,
    // background: "#fff",   ❌ removed
    // boxShadow: "0 4px 16px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.5)", ❌ removed
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
  }}
  aria-label="Dialogue input"
>
        {/* Input wrapper */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isNarrow ? 8 : 10,
            flex: "1 1 0%",
            minWidth: 0,
            padding: isNarrow ? "8px 12px" : "10px 14px",
            borderRadius: 14,
          }}
        >
<input
  ref={inputRef}   // 👈 this ensures the cursor is ready
  value={q}
  onChange={(e) => {
    setQ(e.target.value);
    sendUserActivity();
  }}
  placeholder={connected ? "Type a question..." : "Type a question..."}
  aria-label="Type your question"
  style={{
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    fontSize: "clamp(15px, 2.5vw, 18px)",
    lineHeight: "22px",
    color: "#111827",
    background: "transparent",
  }}
/>
        </div>

        {/* tiny “or” */}
        {!hasText && (
          <div
            aria-hidden="true"
            style={{
              color: "#9ca3af",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.2,
              padding: "0 2px",
              userSelect: "none",
              display: isNarrow ? "none" : "block",
            }}
          >
            or
          </div>
        )}

        {/* Right action: Talk OR Send */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "0 0 auto",
        }}>
          {!hasText ? (
            <button
              type="button"
              onClick={async () => {
                if (phase !== "connecting") await onMicClick();
              }}
              aria-label={connected ? "Start talking" : "Connect and start talking"}
              title={connected ? "Talk" : "Connect and talk"}
              disabled={phase === "connecting"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: isNarrow ? "10px 12px" : "10px 14px",
                height: 44,
                minWidth: isNarrow ? 96 : 116,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,.06)",
                background: phase === "connecting" ? "#d1d5db" : connected ? "#b01c2e" : "#9ca3af",
                color: "#fff",
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
                    <rect x="2" y="6" width="3" height="8" rx="1" />
                    <rect x="8.5" y="3" width="3" height="14" rx="1" />
                    <rect x="15" y="8" width="3" height="6" rx="1" />
                  </svg>
                  <span>{connected ? "Live" : "Talk"}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={phase === "connecting"}
              aria-label="Send message"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: isNarrow ? "10px 12px" : "10px 16px",
                height: 44,
                borderRadius: 12,
                border: "none",
                background: connected ? "#b01c2e" : "#9ca3af",
                color: "#fff",
                fontWeight: 500,
                cursor: phase === "connecting" ? "default" : "pointer",
                transition: "background .15s ease",
              }}
            >
              {phase === "connecting" ? "Connecting" : "Send"}
            </button>
          )}
        </div>
      </form>

{/* Bottom row with reserved space for End call */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "center",
    gap: 8,
    padding: "8px 6px",
    fontSize: 12,
    color: "#6b7280",
  }}
>
  {/* Left cell: End call or invisible placeholder (keeps layout stable) */}
  <div>
    {connected ? (
      <button
        type="button"
        onClick={disconnect}
        style={{
          border: "none",
          background: "transparent",
          color: "#ef4444",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        End call
      </button>
    ) : (
      <span
        aria-hidden="true"
        style={{
          visibility: "hidden",      // occupies space, not visible
          display: "inline-block",
          fontWeight: 600,
        }}
      >
        End call
      </span>
    )}
  </div>

  {/* Right cell: status stays right-aligned regardless */}
  <div style={{ textAlign: "right" }}>
    {connected
      ? isSpeaking
        ? "Agent speaking — talk to interrupt"
        : "Listening"
      : phase === "connecting"
      ? "Connecting…"
      : "Ready"}
  </div>
</div>

      {err && (
        <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{err}</div>
      )}
    </div>
  );
}