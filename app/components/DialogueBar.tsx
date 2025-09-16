"use client";

import { useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";

type Props = {
  agentId: string;                         // required
  useSignedUrl?: boolean;                  // true if your agent requires auth
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
        // public agent
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
      await sendUserMessage(text); // agent will speak the reply
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function onMicClick() {
    if (String(status) !== "connected") {
      await connect();
    } else {
      // already connected; optional: hint agent not to interrupt while typing
      sendUserActivity();
    }
  }

  const connected = String(status) === "connected";

  return (
    <div style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderRadius: 24,
          border: "1px solid rgba(0,0,0,.08)",
          background: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.5)",
        }}
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            sendUserActivity();
          }}
          placeholder={
            connected
              ? "Send a message to continue the conversation"
              : "Send a message to start the conversation"
          }
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 18,
            lineHeight: "24px",
            color: "#3f3f46",
            background: "transparent",
          }}
        />

        <button
          type="button"
          onClick={onMicClick}
          aria-label={connected ? "Speak" : "Connect and speak"}
          title={connected ? "Speak" : "Connect and speak"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "none",
            background: connected ? "#b01c2e" : "#9ca3af",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {/* simple equalizer icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2" y="6" width="3" height="8" rx="1" />
            <rect x="8.5" y="3" width="3" height="14" rx="1" />
            <rect x="15" y="8" width="3" height="6" rx="1" />
          </svg>
        </button>

        <button
          type="submit"
          disabled={!q.trim() || phase === "connecting"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 12,
            border: "none",
            background: connected ? "#b01c2e" : "#9ca3af",
            color: "#fff",
            fontWeight: 600,
            cursor: q.trim() ? "pointer" : "default",
          }}
        >
          {phase === "connecting" ? "Connecting…" : "Send"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 4px", fontSize: 14 }}>
        <button
          type="button"
          onClick={disconnect}
          disabled={!connected}
          style={{
            border: "none",
            background: "transparent",
            color: connected ? "#ef4444" : "rgba(239,68,68,.5)",
            cursor: connected ? "pointer" : "default",
          }}
        >
          End call
        </button>

        <span style={{ color: "#6b7280" }}>
          {connected
            ? (isSpeaking ? "Agent speaking — talk to interrupt" : "Listening")
            : phase === "connecting"
            ? "Connecting…"
            : "Ready"}
        </span>
      </div>

      {err && <div style={{ color: "#b91c1c", marginTop: 8, fontSize: 14 }}>{err}</div>}
    </div>
  );
}