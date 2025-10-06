"use client";

import { useEffect, useState, type CSSProperties } from "react";
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

export default function DialogueBarTalkButton({
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

  const { startSession, endSession, status, sendUserActivity, sendUserMessage } =
    useConversation({
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
      micMuted,
    });

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
      setMicMuted(false);
      setIsPaused(false);
      setWasMutedBeforePause(false);
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
  const talkBackground = buttonColor;
  const talkTextColor = buttonTextColor;
  const cardBorderColor = buttonBorderColor ?? buttonColor ?? "#525fe1";
  const showIcons = connected;
  const containerMaxWidth = isNarrow ? "100%" : showIcons ? 420 : 260;
  const cardStyle: CSSProperties = {
    background: "rgba(255, 255, 255, 0.92)",
    border: `1px solid ${cardBorderColor}`,
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
    backdropFilter: "saturate(1.2) blur(6px)",
    WebkitBackdropFilter: "saturate(1.2) blur(6px)",
    padding: isNarrow ? 12 : 16,
    transition: "transform 160ms ease, padding 160ms ease",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    width: isNarrow ? "100%" : "auto",
    fontFamily: '"Cooper Light BT", "Cooper Lt BT", "Cooper", serif',
    fontWeight: 500,
    letterSpacing: "0.02em",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
  };
  const actionRowStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "nowrap",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: containerMaxWidth,
        margin: "0 auto",
        padding: isNarrow ? "0 8px" : "0 12px",
        boxSizing: "border-box",
        textAlign: "center",
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

        <div style={actionRowStyle}>
        {connected ? (
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
              transition: "background .15s ease, color .15s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="3" fill="currentColor" />
            </svg>
          </button>
        ) : null}

        {connected ? (
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
        ) : null}

        {connected ? (
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
              transition: "background .15s ease, color .15s ease, opacity .15s ease",
            }}
          >
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
              <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" />
              <rect x="8" y="1" width="3" height="12" rx="1" fill="currentColor" />
            </svg>
          </button>
        ) : null}

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
            padding: isNarrow ? "12px 16px" : "14px 18px",
            height: 48,
            minWidth: isNarrow ? 130 : 160,
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
              <span>{connected ? "Live" : "Talk"}</span>
            </>
          )}
        </button>
        </div>

        {err && (
          <div style={{ color: "#b91c1c", marginTop: 16, fontSize: 14 }}>{err}</div>
        )}
      </div>
    </div>
  );
}
