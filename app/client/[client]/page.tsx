"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useConversation } from "@elevenlabs/react";

import {
  clientMap,
  getClientAgentId,
  getClientDataPath,
  getClientReports,
} from "@/app/lib/clientMap";
import { docMap } from "@/app/lib/docMap";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const QUICK_QUESTIONS = [
  "What are customers asking about our latest report?",
  "Summarise engagement trends this week.",
  "Highlight notable questions from enterprise prospects.",
];

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function ClientInsightsChat() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();

  const entry = client ? clientMap[client] : undefined;
  const reports = useMemo(() => (client ? getClientReports(client) : []), [client]);
  const queryAgentId = searchParams?.get("agentId") ?? "";
  const clientAgentId = queryAgentId || (client ? getClientAgentId(client) ?? "" : "");

  if (!client || !entry) {
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

  const dataFeedUrl = getClientDataPath(client);
  const associatedLabels = reports
    .map(({ slug, doc }) => doc?.talkLabel || doc?.pdfPath || slug)
    .filter(Boolean);
  const introMessage = buildIntroMessage(entry.displayName, associatedLabels, dataFeedUrl);

  const [messages, setMessages] = useState<Message[]>([
    { id: makeMessageId(), role: "assistant", content: introMessage },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [err, setErr] = useState("");

  const chatRef = useRef<HTMLDivElement | null>(null);
  const lastLocalUserRef = useRef<string>("");
  const lastRemoteUserRef = useRef<string>("");
  const lastAgentResponseRef = useRef<string>("");
  const lastAgentMessageIdRef = useRef<string | null>(null);

  const primaryDoc = entry.slugKeys[0];
  const serverLocation = (primaryDoc && docMap[primaryDoc]?.region) || "us";

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const appendUserMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: makeMessageId(), role: "user", content: trimmed }]);
  }, []);

  const appendAgentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = makeMessageId();
    lastAgentMessageIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: "assistant", content: trimmed }]);
  }, []);

  const replaceLastAgentMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !lastAgentMessageIdRef.current) return;
    setMessages((prev) => {
      const next = [...prev];
      const idx = next.findIndex((m) => m.id === lastAgentMessageIdRef.current);
      if (idx === -1) return prev;
      next[idx] = { ...next[idx], content: trimmed };
      return next;
    });
  }, []);

  const handleClientEvent = useCallback(
    ({ type, text }: { type: "user_transcript" | "agent_response"; text: string }) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (type === "user_transcript") {
        if (trimmed === lastLocalUserRef.current) {
          lastLocalUserRef.current = "";
          return;
        }
        if (trimmed === lastRemoteUserRef.current) return;
        lastRemoteUserRef.current = trimmed;
        appendUserMessage(trimmed);
        return;
      }

      if (trimmed === lastAgentResponseRef.current) return;
      lastAgentResponseRef.current = trimmed;
      setIsThinking(false);
      appendAgentMessage(trimmed);
    },
    [appendAgentMessage, appendUserMessage]
  );

  const handleAgentCorrection = useCallback(
    (text?: string) => {
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
    sendUserMessage,
  } = useConversation({
    serverLocation,
    onConnect: () => setErr(""),
    onDisconnect: () => {
      lastAgentMessageIdRef.current = null;
    },
    onError: (error: unknown) =>
      setErr(error instanceof Error ? error.message : String(error ?? "Unknown error")),
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
    micMuted: true,
  });

  const connect = useCallback(async () => {
    try {
      if (String(status) === "connected" || String(status) === "connecting") return;
      const res = await fetch(
        `/api/eleven/get-signed-url?agent_id=${encodeURIComponent(clientAgentId)}`
      );
      const data = await res.json();
      if (!res.ok || !data?.signedUrl)
        throw new Error(data?.error || "Failed to get signed URL");
      await startSession({ signedUrl: data.signedUrl, connectionType: "websocket" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
      setErr(message);
      throw error;
    }
  }, [clientAgentId, startSession, status]);

  useEffect(() => {
    return () => {
      endSession().catch(() => undefined);
    };
  }, [endSession]);

  const sendPrompt = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      appendUserMessage(trimmed);
      lastLocalUserRef.current = trimmed;
      setIsThinking(true);

      (async () => {
        try {
          await connect();
          await sendUserMessage(trimmed);
        } catch (error) {
          setIsThinking(false);
          setMessages((prev) => [
            ...prev,
            {
              id: makeMessageId(),
              role: "assistant",
              content:
                "Sorry, I couldn't reach the insights agent just now. Please try again in a moment.",
            },
          ]);
          console.error("[client-chat] Failed to send message", error);
        }
      })();
    },
    [appendUserMessage, connect, sendUserMessage]
  );

  const handleSend = useCallback(
    (event?: FormEvent) => {
      if (event) event.preventDefault();
      if (isThinking) return;
      const trimmed = input.trim();
      if (!trimmed) return;
      setInput("");
      sendPrompt(trimmed);
    },
    [input, isThinking, sendPrompt]
  );

  return (
    <main
      style={{
        minHeight: "100dvh",
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
          {err ? (
            <span style={{ color: "#fca5a5" }}>Connection issue: {err}</span>
          ) : null}
        </div>
      </header>

      <div
        ref={chatRef}
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          padding: "30px clamp(16px, 4vw, 48px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "radial-gradient(circle at top, rgba(37, 99, 235, 0.22), transparent 60%)",
        }}
      >
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {isThinking ? <TypingIndicator /> : null}
      </div>

      <QuickPrompts
        onSelect={(prompt) => {
          setInput("");
          if (isThinking) return;
          sendPrompt(prompt);
        }}
      />

      <form
        onSubmit={handleSend}
        style={{
          padding: "18px 24px 26px",
          background: "rgba(11, 18, 32, 0.94)",
          borderTop: "1px solid rgba(148, 163, 184, 0.16)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              background: "#111c34",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              borderRadius: 18,
              padding: "12px 14px",
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about engagement trends, questions customers are asking, or top-performing reports…"
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                color: "#e2e8f0",
                fontSize: 15,
                lineHeight: 1.5,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              style={{
                alignSelf: "flex-end",
                padding: "8px 18px",
                borderRadius: 12,
                border: "none",
                background: !input.trim() || isThinking
                  ? "rgba(148, 163, 184, 0.35)"
                  : "#38bdf8",
                color: "#0b1220",
                fontWeight: 600,
                cursor: !input.trim() || isThinking ? "default" : "pointer",
                transition: "background .18s ease",
              }}
            >
              Send
            </button>
          </div>
          <span style={{ fontSize: 12, color: "rgba(226, 232, 240, 0.65)" }}>
            Responses are powered by the customer insights agent and refreshed with your latest
            knowledge feed.
          </span>
        </div>
      </form>
    </main>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "min(720px, 80%)",
          padding: "12px 16px",
          borderRadius: 18,
          background: isUser ? "#38bdf8" : "rgba(15, 23, 42, 0.72)",
          color: isUser ? "#0b1220" : "#e2e8f0",
          lineHeight: 1.55,
          fontSize: 15,
          whiteSpace: "pre-wrap",
          boxShadow: isUser
            ? "0 16px 32px rgba(56, 189, 248, 0.25)"
            : "0 16px 32px rgba(7, 11, 23, 0.65)",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 6, padding: "6px 0 14px" }}>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "rgba(148, 163, 184, 0.7)",
            animation: "pulse 1.2s ease-in-out infinite",
            animationDelay: `${dot * 0.16}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function QuickPrompts({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div
      style={{
        padding: "10px clamp(16px, 4vw, 32px)",
        background: "rgba(11, 18, 32, 0.86)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {QUICK_QUESTIONS.map((question) => (
        <button
          key={question}
          type="button"
          onClick={() => onSelect(question)}
          style={{
            borderRadius: 999,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: "rgba(17, 28, 52, 0.9)",
            color: "#e2e8f0",
            padding: "8px 14px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {question}
        </button>
      ))}
    </div>
  );
}

function FallbackState({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
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

function buildIntroMessage(name: string, reports: string[], dataFeedUrl: string) {
  const lines = [
    `Hi, you're viewing ${name}'s engagement workspace.`,
    "I'll surface insights from customers as soon as the knowledge feed refreshes.",
  ];
  if (reports.length) {
    lines.push(`Right now, I'm tracking these customer agents: ${reports.join(", ")}.`);
  }
  lines.push(`New conversations are synced to ${dataFeedUrl}. Ask me anything to explore.`);
  return lines.join("\n\n");
}
