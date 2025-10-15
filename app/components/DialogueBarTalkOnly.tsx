"use client";

import { useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type Props = {
  agentId: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  title?: string;
};

type Phase = "idle" | "ready" | "connecting" | "connected";

export default function DialogueBarTalkOnly({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
  buttonColor = "#525fe1",
  buttonTextColor = "#ffffff",
  title = "",
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);

  const { startSession, endSession, status, isSpeaking, sendUserActivity } =
    useConversation({
      serverLocation,
      onConnect: () => setPhase("connected"),
      onDisconnect: () => setPhase("ready"),
      onError: (e: unknown) =>
        setErr(e instanceof Error ? e.message : String(e)),
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

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 920,
        margin: "0 auto",
        padding: isNarrow ? "0 8px" : "0 12px",
        boxSizing: "border-box",
        fontFamily: "'Cooper Light BT', Cooper, serif",
      }}
    >
      {title ? (
        <div
          style={{
            textAlign: "left",
            fontSize: isNarrow ? 16 : 18,
            fontWeight: 700,
            marginBottom: 8,
            color: "#111827",
          }}
        >
          {title}
        </div>
      ) : null}

      <div
        style={{
          textAlign: "left",
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 8,
        }}
      >
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: isNarrow ? "12px 0" : "16px 0",
        }}
      >
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
            padding: isNarrow ? "12px 16px" : "14px 20px",
            height: 48,
            minWidth: isNarrow ? 140 : 180,
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
              <span>{connected ? "Live" : "Speak to Dialogue"}</span>
            </>
          )}
        </button>
      </div>

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
                visibility: "hidden",
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              End call
            </span>
          )}
        </div>

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
