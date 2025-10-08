"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  clientMap,
  getClientReports,
  getClientAgentId,
  getClientDataPath,
} from "@/app/lib/clientMap";
import { docMap } from "@/app/lib/docMap";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const QUICK_QUESTIONS = [
  "What are customers asking about our latest report?",
  "Summarise engagement trends this week.",
  "Highlight notable questions from enterprise prospects.",
];

export default function ClientInsightsChat() {
  const { client } = useParams<{ client: string }>();
  const sp = useSearchParams();

  const entry = client ? clientMap[client] : undefined;
  const reports = useMemo(() => (client ? getClientReports(client) : []), [client]);
  const queryAgent = sp?.get("agentId") ?? "";
  const clientAgentId = queryAgent || (client ? getClientAgentId(client) ?? "" : "");

  if (!client || !entry) {
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
            maxWidth: 420,
            textAlign: "center",
            color: "#e2e8f0",
          }}
        >
          <strong>Unknown client slug:</strong> <code>{client ?? "—"}</code>
        </div>
      </main>
    );
  }

  if (!clientAgentId) {
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
          <strong>{entry.displayName}</strong> does not yet have an insights agent configured.
          Add <code>clientAgentId</code> in <code>clientMap</code> or provide{" "}
          <code>?agentId=</code> in the URL to continue.
        </div>
      </main>
    );
  }

  const dataFeedUrl = getClientDataPath(client);
  const associatedLabels = reports
    .map(({ slug, doc }) => doc?.talkLabel || doc?.pdfPath || slug)
    .filter(Boolean);

  const introMessage = buildIntroMessage(entry.displayName, associatedLabels, dataFeedUrl);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "assistant-intro",
      role: "assistant",
      content: introMessage,
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(event?: FormEvent) {
    if (event) event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);

    window.setTimeout(() => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: buildPlaceholderReply(trimmed, associatedLabels, dataFeedUrl),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);
    }, 420);
  }

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

      <QuickPrompts onSelect={(prompt) => setInput(prompt)} />

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
              background: !input.trim() || isThinking ? "rgba(148, 163, 184, 0.35)" : "#38bdf8",
              color: "#0b1220",
              fontWeight: 600,
              cursor: !input.trim() || isThinking ? "default" : "pointer",
              transition: "background .18s ease",
            }}
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
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

function buildIntroMessage(name: string, reports: string[], dataFeedUrl: string) {
  const introLines = [
    `Hi, you're viewing ${name}'s engagement workspace.`,
    "I'll surface insights from customers as soon as the knowledge feed refreshes.",
  ];
  if (reports.length) {
    introLines.push(`Right now, I'm tracking these customer agents: ${reports.join(", ")}.`);
  }
  introLines.push(`New conversations are synced to ${dataFeedUrl}. Ask me anything to explore.`);
  return introLines.join("\n\n");
}

function buildPlaceholderReply(question: string, reports: string[], dataFeedUrl: string) {
  const lines = [
    `You asked: "${question}".`,
    "I'm capturing that request — shortly I'll use the refreshed knowledge feed to respond with live data.",
  ];
  if (reports.length) {
    lines.push(`Insights will draw from: ${reports.join(", ")}.`);
  }
  lines.push(`You can review the raw conversations at ${dataFeedUrl}.`);
  return lines.join("\n\n");
}
