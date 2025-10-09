"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useSearchParams } from "next/navigation";

import {
  clientMap,
  getClientDataPath,
  getClientReports,
} from "@/app/lib/clientMap";
import { docMap } from "@/app/lib/docMap";
import { useConversation } from "@elevenlabs/react";

type DialogueProps = {
  agentId: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  buttonBorderColor?: string;
};

type Phase = "idle" | "ready" | "connecting" | "connected";

type TranscriptMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type ClientEvent =
  | { type: "user_transcript"; text: string }
  | { type: "agent_response"; text: string };

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 220;

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

function ClientDialogue({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
  buttonColor = "#60a5fa",
  buttonTextColor = "#0f172a",
  buttonBorderColor,
}: DialogueProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLocalUserMessageRef = useRef<string>("");
  const lastRemoteUserTranscriptRef = useRef<string>("");
  const lastAgentResponseRef = useRef<string>("");
  const lastAgentMessageIdRef = useRef<string | null>(null);
  const isAgentStreamingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = matchMedia("(max-width: 640px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

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
    setMessages((prev) => [...prev, { id: makeMessageId(), role: "user", text: trimmed }]);
  }, []);

  const appendAgentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = makeMessageId();
    lastAgentMessageIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: "assistant", text: trimmed }]);
  }, []);

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
  }, []);

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

      if (trimmed === lastAgentResponseRef.current) {
        isAgentStreamingRef.current = false;
        return;
      }
      lastAgentResponseRef.current = trimmed;
      if (isAgentStreamingRef.current && lastAgentMessageIdRef.current) {
        replaceLastAgentMessage(trimmed);
      } else {
        appendAgentMessage(trimmed);
      }
      isAgentStreamingRef.current = false;
    },
    [appendAgentMessage, appendUserMessage, replaceLastAgentMessage]
  );

  const handleAgentCorrection = useCallback(
    (text?: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      lastAgentResponseRef.current = trimmed;
      replaceLastAgentMessage(trimmed);
      isAgentStreamingRef.current = false;
    },
    [replaceLastAgentMessage]
  );

  const handleAgentTentative = useCallback(
    (text?: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      if (!isAgentStreamingRef.current || !lastAgentMessageIdRef.current) {
        isAgentStreamingRef.current = true;
        lastAgentResponseRef.current = trimmed;
        appendAgentMessage(trimmed);
        return;
      }
      if (trimmed === lastAgentResponseRef.current) return;
      lastAgentResponseRef.current = trimmed;
      replaceLastAgentMessage(trimmed);
    },
    [appendAgentMessage, replaceLastAgentMessage]
  );

  const { startSession, endSession, status, sendUserMessage } = useConversation({
    serverLocation,
    onConnect: () => {
      console.log("[ClientDialogue] Connected", { agentId, serverLocation });
      setPhase("connected");
    },
    onDisconnect: () => {
      console.log("[ClientDialogue] Disconnected");
      setPhase("ready");
    },
    onError: (error: unknown) =>
      setErr(error instanceof Error ? error.message : String(error ?? "Unknown error")),
    onMessage: ({ source, message }) => {
      const text = message ?? "";
      console.log("[ClientDialogue] onMessage", { source, text });
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
        return;
      }
      if (event.type === "tentative_agent_response") {
        handleAgentTentative(
          typeof event.response === "string"
            ? event.response
            : event.tentative_agent_response_internal_event?.tentative_agent_response
        );
      }
    },
    micMuted: true,
  });

  const endSessionRef = useRef(endSession);

  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  useEffect(() => {
    const s = String(status);
    if (s === "connected") setPhase("connected");
    else if (s === "connecting") setPhase("connecting");
    else setPhase("ready");
  }, [status]);

  useEffect(() => {
    return () => {
      const end = endSessionRef.current;
      if (end) {
        end().catch(() => undefined);
      }
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      if (String(status) === "connected" || String(status) === "connecting") return;
      setPhase("connecting");
      if (useSignedUrl) {
        const res = await fetch(
          `/api/eleven/get-signed-url?agent_id=${encodeURIComponent(agentId)}`
        );
        const data = await res.json();
        console.log("[ClientDialogue] Signed URL response", {
          status: res.status,
          ok: res.ok,
        });
        if (!res.ok || !data?.signedUrl)
          throw new Error(data?.error || "Failed to get signed URL");
        await startSession({
          signedUrl: data.signedUrl,
          connectionType: "websocket",
        });
      } else {
        await startSession({
          agentId,
          connectionType: "websocket",
        });
      }
      setPhase("connected");
    } catch (error) {
      setPhase("ready");
      throw error;
    }
  }, [agentId, startSession, status, useSignedUrl]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    setDraft("");
    appendUserMessage(text);
    lastLocalUserMessageRef.current = text;
    setIsSending(true);
    setErr("");

    try {
      await connect();
      console.log("[ClientDialogue] Sending message", { text });
      await sendUserMessage?.(text);
    } catch (error) {
      console.error("[ClientDialogue] Failed to send", error);
      setErr(error instanceof Error ? error.message : String(error ?? "Unknown error"));
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: "system",
          text: "Sorry, I couldn't send that message. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [appendUserMessage, connect, draft, isSending, sendUserMessage]);

  const handleEndCall = useCallback(async () => {
    if (isEnding) return;
    const end = endSessionRef.current;
    if (!end) return;
    setErr("");
    setIsEnding(true);
    isAgentStreamingRef.current = false;
    lastAgentMessageIdRef.current = null;
    try {
      await end();
      setPhase("ready");
    } catch (error) {
      console.error("[ClientDialogue] Failed to end session", error);
      setErr(
        error instanceof Error ? error.message : String(error ?? "Unknown error")
      );
    } finally {
      setIsEnding(false);
    }
  }, [isEnding]);

  const containerWidth = useMemo(() => (isNarrow ? "100%" : "100%"), [isNarrow]);

  const transcriptStyle: CSSProperties = {
    padding: isNarrow ? 12 : 16,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    justifyContent: "flex-start",
    alignItems: "stretch",
    background: "rgba(17, 24, 39, 0.55)",
    borderRadius: 16,
    border: "1px solid rgba(148, 163, 184, 0.25)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    flex: "1 1 auto",
    minHeight: 0,
  };

  const messageBubble = (message: TranscriptMessage) => {
    if (message.role === "system") {
      return (
        <div
          key={message.id}
          style={{
            alignSelf: "center",
            color: "#cbd5f5",
            fontSize: 12,
            opacity: 0.75,
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
          background: isUser ? buttonColor : "rgba(148, 163, 184, 0.16)",
          color: isUser ? buttonTextColor : "#e2e8f0",
          padding: "10px 14px",
          borderRadius: isUser ? "15px 15px 4px 15px" : "15px 15px 15px 4px",
          fontSize: 14,
          lineHeight: 1.45,
          wordBreak: "break-word",
          boxShadow: "0 6px 16px rgba(6, 10, 20, 0.35)",
        }}
      >
        {message.text}
      </div>
    );
  };

  const sendDisabled = isSending || phase === "connecting" || isEnding;

  return (
    <div
      style={{
        width: containerWidth,
        margin: "0 auto",
        padding: isNarrow ? "0 8px" : "0",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          background: "rgba(11, 18, 32, 0.9)",
          border: `1px solid ${buttonBorderColor ?? "rgba(148, 163, 184, 0.28)"}`,
          borderRadius: 20,
          boxShadow: "0 24px 48px rgba(7, 11, 23, 0.65)",
          padding: isNarrow ? 16 : 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          width: "100%",
          flex: "1 1 auto",
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      >
        <div ref={transcriptRef} style={transcriptStyle} aria-live="polite">
          {messages.length ? (
            messages.map((message) => messageBubble(message))
          ) : (
            <div
              style={{
                color: "rgba(226, 232, 240, 0.65)",
                fontSize: 14,
              }}
            >
              Ask a question to see engagement insights powered by your knowledge feed.
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            background: "rgba(17, 28, 52, 0.9)",
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            padding: "10px 12px",
            marginTop: "auto",
          }}
        >
          <textarea
            ref={draftInputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type your question…"
            aria-label="Type your question"
            rows={1}
            style={{
              flex: 1,
              minHeight: MIN_TEXTAREA_HEIGHT,
              resize: "none",
              border: "none",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.5,
              color: "#e2e8f0",
              background: "transparent",
              overflow: "hidden",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "nowrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                void handleEndCall();
              }}
              disabled={phase !== "connected" || isEnding}
              style={{
                padding: "0 14px",
                height: 42,
                borderRadius: 12,
                border: "1px solid rgba(239, 68, 68, 0.45)",
                background:
                  phase !== "connected" || isEnding
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(239, 68, 68, 0.85)",
                color:
                  phase !== "connected" || isEnding
                    ? "rgba(248, 250, 252, 0.65)"
                    : "#f8fafc",
                cursor:
                  phase !== "connected" || isEnding ? "not-allowed" : "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 110,
                transition:
                  "background .18s ease, color .18s ease, opacity .18s ease",
              }}
            >
              {isEnding ? "Ending…" : "End call"}
            </button>
            <button
              type="submit"
              disabled={sendDisabled || !draft.trim()}
              style={{
                padding: "0 16px",
                height: 42,
                borderRadius: 12,
                border: "1px solid rgba(59, 130, 246, 0.45)",
                background: sendDisabled ? "rgba(148, 163, 184, 0.2)" : buttonColor,
                color: sendDisabled ? "rgba(226, 232, 240, 0.6)" : buttonTextColor,
                cursor: sendDisabled ? "not-allowed" : "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 110,
                transition:
                  "background .18s ease, color .18s ease, opacity .18s ease",
              }}
            >
              {sendDisabled ? "Sending…" : "Send"}
            </button>
          </div>
        </form>

        {err ? (
          <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function ClientInsightsChat() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();

  const normalizedClient = client?.toLowerCase() ?? "";
  const entry = normalizedClient ? clientMap[normalizedClient] : undefined;
  const reports = useMemo(
    () => (normalizedClient ? getClientReports(normalizedClient) : []),
    [normalizedClient]
  );
  const queryAgentId = searchParams?.get("agentId") ?? "";
  const clientAgentId = entry?.clientAgentId ?? queryAgentId ?? "";
  const dataFeedUrl = normalizedClient ? getClientDataPath(normalizedClient) : "";
  const [questions, setQuestions] = useState<string[]>([]);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!normalizedClient || !dataFeedUrl) {
      setQuestions([]);
      return;
    }

    const fetchQuestions = async () => {
      setIsQuestionsLoading(true);
      setQuestionsError(null);
      try {
        const res = await fetch(dataFeedUrl, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load questions (status ${res.status})`);
        }
        const payload = (await res.json()) as {
          questions?: unknown;
        };
        if (cancelled) return;
        const fromPayload = Array.isArray(payload.questions)
          ? (payload.questions as unknown[])
              .map((item) => (typeof item === "string" ? item.trim() : ""))
              .filter((item) => item.length > 0)
          : [];
        setQuestions(fromPayload);
      } catch (error) {
        if (cancelled) return;
        setQuestionsError(
          error instanceof Error ? error.message : "Unable to load questions."
        );
        setQuestions([]);
      } finally {
        if (!cancelled) setIsQuestionsLoading(false);
      }
    };

    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [dataFeedUrl, normalizedClient]);

  if (!normalizedClient || !entry) {
    return (
      <FallbackState
        title="Unknown client"
        description={
          <>
            <strong>Unknown client slug:</strong> <code>{client ?? "—"}</code>
          </>
        }
      />
    );
  }

  if (!clientAgentId) {
    return (
      <FallbackState
        title={`${entry.displayName} has no insights agent configured`}
        description={
          <>
            Add <code>clientAgentId</code> to <code>clientMap</code> or pass <code>?agentId=</code>.
          </>
        }
      />
    );
  }

  const associatedLabels = reports
    .map(({ slug, doc }) => doc?.talkLabel || doc?.pdfPath || slug)
    .filter(Boolean);

  const primaryDoc = entry.slugKeys[0];
  const serverLocation = (primaryDoc && docMap[primaryDoc]?.region) || "us";

  return (
    <main
      style={{
        height: "100dvh",
        background: "#0b1220",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
          background: "linear-gradient(135deg, rgba(11,18,32,0.92), rgba(30,58,138,0.55))",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
          {entry.displayName} Customer Insights
        </h1>
        {entry.description ? (
          <p
            style={{
              margin: "8px 0 0",
              color: "rgba(226, 232, 240, 0.78)",
              maxWidth: 660,
              lineHeight: 1.5,
            }}
          >
            {entry.description}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
            color: "rgba(226, 232, 240, 0.65)",
          }}
        >
          <span>
            <strong>Insights agent:</strong> <code>{clientAgentId}</code>
          </span>
          <span>
            <strong>Knowledge feed:</strong>{" "}
            <a
              href={dataFeedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#38bdf8", textDecoration: "none" }}
            >
              {dataFeedUrl}
            </a>
          </span>
          {associatedLabels.length ? (
            <span>
              <strong>Customer agents:</strong> {associatedLabels.join(", ")}
            </span>
          ) : null}
        </div>
      </header>

      <section
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          background: "radial-gradient(circle at top, rgba(37, 99, 235, 0.22), transparent 60%)",
          minHeight: 0,
          overflow: "hidden",
          padding: "16px clamp(16px, 4vw, 32px)",
          gap: 20,
        }}
      >
        <div
          style={{
            width: "min(960px, 96vw)",
            margin: "0 auto",
            background: "rgba(17, 24, 39, 0.65)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 12px 30px rgba(7, 11, 23, 0.45)",
            backdropFilter: "blur(6px)",
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 18,
              fontWeight: 600,
              color: "#f1f5f9",
            }}
          >
            Questions asked so far
          </h2>
          {questionsError ? (
            <p style={{ margin: 0, color: "#fca5a5", fontSize: 14 }}>{questionsError}</p>
          ) : isQuestionsLoading ? (
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
              Loading questions…
            </p>
          ) : questions.length ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                display: "grid",
                gap: 8,
                fontSize: 14,
                color: "rgba(226, 232, 240, 0.85)",
              }}
            >
              {questions.map((question, index) => (
                <li key={`${question}-${index}`}>{question}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.7)", fontSize: 14 }}>
              No questions captured yet.
            </p>
          )}
        </div>

        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            width: "100%",
            maxWidth: "min(960px, 96vw)",
            margin: "0 auto",
          }}
        >
          <ClientDialogue
            agentId={clientAgentId}
            useSignedUrl
            serverLocation={serverLocation}
            buttonColor="#38bdf8"
            buttonTextColor="#0b1220"
            buttonBorderColor="#1d4ed8"
          />
        </div>
      </section>
    </main>
  );
}

function FallbackState({ title, description }: { title: string; description: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0f172a",
      }}
    >
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          background: "#111827",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          maxWidth: 520,
          textAlign: "center",
          color: "#e2e8f0",
          lineHeight: 1.6,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div>{description}</div>
      </div>
    </main>
  );
}
