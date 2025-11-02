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
  personaName?: string;
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
const PDF_PAGE_WIDTH = 612; // 8.5in
const PDF_PAGE_HEIGHT = 792; // 11in
const PDF_MARGIN = 72; // 1in
const PDF_FONT_SIZE = 12;
const PDF_LINE_HEIGHT = 16;
const PDF_LINE_WRAP = 90;
const PDF_LINES_PER_PAGE = Math.floor(
  (PDF_PAGE_HEIGHT - PDF_MARGIN * 2) / PDF_LINE_HEIGHT
);
const textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");

const wrapText = (value: string, max = PDF_LINE_WRAP) => {
  const lines: string[] = [];
  let current = "";
  const words = value.split(/\s+/);
  for (const word of words) {
    if (!word) continue;
    if (word.length >= max) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += max) {
        lines.push(word.slice(i, i + max));
      }
      continue;
    }
    const prospective = current ? `${current} ${word}` : word;
    if (prospective.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = prospective;
    }
  }
  if (current) {
    lines.push(current);
  }
  if (!lines.length) {
    return [""];
  }
  return lines;
};

const chunkTranscriptLines = (lines: string[]) => {
  if (!lines.length) return [["Transcript empty."]];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += PDF_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + PDF_LINES_PER_PAGE));
  }
  return pages;
};

const buildPageContent = (lines: string[]) => {
  const startY = PDF_PAGE_HEIGHT - PDF_MARGIN - (PDF_LINE_HEIGHT - PDF_FONT_SIZE);
  const content: string[] = [
    "BT",
    `/F1 ${PDF_FONT_SIZE} Tf`,
    `${PDF_LINE_HEIGHT} TL`,
    `${PDF_MARGIN} ${startY} Td`,
  ];
  lines.forEach((line, index) => {
    const escaped = escapePdfText(line);
    if (index === 0) {
      content.push(`(${escaped}) Tj`);
    } else {
      content.push("T*");
      content.push(`(${escaped}) Tj`);
    }
  });
  content.push("ET");
  return content.join("\n");
};

const createTranscriptPdf = (lines: string[]) => {
  const pages = chunkTranscriptLines(lines);
  const pageCount = pages.length;
  const contentStartNumber = 3 + pageCount;
  const fontObjectNumber = contentStartNumber + pageCount;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  let objectNumber = 0;
  const appendObject = (body: string) => {
    objectNumber += 1;
    offsets[objectNumber] = pdf.length;
    pdf += `${objectNumber} 0 obj\n${body}\nendobj\n`;
  };
  const appendStreamObject = (content: string) => {
    const length = textEncoder?.encode(content).length ?? content.length;
    appendObject(`<< /Length ${length} >>\nstream\n${content}\nendstream`);
  };

  // 1: Catalog
  appendObject("<< /Type /Catalog /Pages 2 0 R >>");

  const kidRefs = pages
    .map((_, index) => `${3 + index} 0 R`)
    .join(" ");
  // 2: Pages
  appendObject(`<< /Type /Pages /Count ${pageCount} /Kids [${kidRefs}] >>`);

  // Page objects
  pages.forEach((_, index) => {
    const contentNumber = contentStartNumber + index;
    appendObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Contents ${contentNumber} 0 R /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> >>`
    );
  });

  // Content streams
  pages.forEach((pageLines) => {
    appendStreamObject(buildPageContent(pageLines));
  });

  // Font object
  appendObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectNumber + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objectNumber; i += 1) {
    const offset = offsets[i];
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new Blob([pdf], { type: "application/pdf" });
};

export default function DialogueText({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
  buttonColor = "#60a5fa",
  buttonTextColor = "#0f172a",
  personaName,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [endedTranscript, setEndedTranscript] = useState<TranscriptMessage[]>([]);
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
    textOnly: true,
    onConnect: () => {
      console.log("[DialogueText] Connected", { agentId, serverLocation });
      setPhase("connected");
    },
    onDisconnect: () => {
      console.log("[DialogueText] Disconnected");
      setPhase("ready");
    },
    onError: (error: unknown) =>
      setErr(error instanceof Error ? error.message : String(error ?? "Unknown error")),
    onMessage: ({ source, message }) => {
      const text = message ?? "";
      console.log("[DialogueText] onMessage", { source, text });
      if (source === "user") {
        handleClientEvent({ type: "user_transcript", text });
      } else {
        handleClientEvent({ type: "agent_response", text });
      }
    },
    onDebug: (event: unknown) => {
      if (!event || typeof event !== "object") return;

      type DebugEvent = {
        type?: string;
        agent_response_correction_event?: { corrected_agent_response?: string };
        tentative_agent_response_internal_event?: { tentative_agent_response?: string };
        response?: string;
      };

      const debugEvent = event as DebugEvent;

      if (debugEvent.type === "agent_response_correction") {
        handleAgentCorrection(
          debugEvent.agent_response_correction_event?.corrected_agent_response
        );
        return;
      }
      if (debugEvent.type === "tentative_agent_response") {
        handleAgentTentative(
          typeof debugEvent.response === "string"
            ? debugEvent.response
            : debugEvent.tentative_agent_response_internal_event?.tentative_agent_response
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
      setEndedTranscript([]);
      if (useSignedUrl) {
        const res = await fetch("/api/eleven/get-signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId }),
        });
        let data: { signedUrl?: string; error?: string } | null = null;
        try {
          data = await res.json();
        } catch (parseError) {
          const text = await res.text();
          throw new Error(
            `Failed to parse signed URL response: ${parseError}\nResponse text: ${text}`
          );
        }
        console.log("[DialogueText] Signed URL response", {
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
    setEndedTranscript([]);

    try {
      await connect();
      console.log("[DialogueText] Sending message", { text });
      await sendUserMessage?.(text);
    } catch (error) {
      console.error("[DialogueText] Failed to send", error);
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
      setEndedTranscript(messages);
      await end();
      setPhase("ready");
      setMessages([]);
      setDraft("");
      lastLocalUserMessageRef.current = "";
      lastRemoteUserTranscriptRef.current = "";
      lastAgentResponseRef.current = "";
    } catch (error) {
      console.error("[DialogueText] Failed to end session", error);
      setErr(
        error instanceof Error ? error.message : String(error ?? "Unknown error")
      );
    } finally {
      setIsEnding(false);
    }
  }, [isEnding, messages]);

  const containerWidth = useMemo(() => (isNarrow ? "100%" : "100%"), [isNarrow]);

  const transcriptStyle: CSSProperties = {
    padding: isNarrow ? 12 : 16,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    justifyContent: "flex-start",
    alignItems: "stretch",
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

  const handleDownloadTranscript = useCallback(() => {
    const source = endedTranscript.length ? endedTranscript : messages;
    if (!source.length) return;
    const lines: string[] = [];
    const personaTitle = personaName?.trim();
    if (personaTitle) {
      wrapText(personaTitle.toUpperCase()).forEach((line) => lines.push(line));
      lines.push("");
    }
    source.forEach((message, index) => {
      const normalized = message.text.replace(/\r?\n/g, " ").trim();
      const role =
        message.role === "assistant"
          ? "Persona"
          : message.role === "user"
          ? "User"
          : message.role === "system"
          ? "System"
          : message.role;
      const prefix = `${role}: ${normalized}`.trim();
      wrapText(prefix).forEach((line) => lines.push(line));
      if (index < source.length - 1) {
        lines.push("");
      }
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `conversation-${agentId || "agent"}-${timestamp}.pdf`;
    const blob = createTranscriptPdf(lines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [agentId, endedTranscript, messages, personaName]);

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
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        <div
          ref={transcriptRef}
          style={{
            ...transcriptStyle,
            background: "transparent",
            borderRadius: 0,
            border: "none",
            boxShadow: "none",
          }}
          aria-live="polite"
        >
          {messages.length ? (
            messages.map((message) => messageBubble(message))
          ) : endedTranscript.length ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                width: "100%",
                height: "100%",
              }}
            >
              <button
                type="button"
                onClick={handleDownloadTranscript}
                style={{
                  padding: "0 22px",
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  background: "rgba(59, 130, 246, 0.18)",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 200,
                  transition: "background .18s ease, color .18s ease, opacity .18s ease",
                }}
              >
                Download transcript
              </button>
            </div>
          ) : (
            <div
              style={{
                color: "rgba(226, 232, 240, 0.65)",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                width: "100%",
                height: "100%",
              }}
            >
              Chat to your persona to get answers to quickfire quesstions
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
            background: "rgba(14, 21, 36, 0.9)",
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.25)",
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
            {phase === "connected" && (
              <button
                type="button"
                onClick={() => {
                  void handleEndCall();
                }}
                disabled={isEnding}
                style={{
                  padding: "0 14px",
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.35)",
                  background: isEnding
                    ? "rgba(30, 41, 59, 0.35)"
                    : "rgba(30, 41, 59, 0.85)",
                  color: isEnding ? "rgba(226, 232, 240, 0.6)" : "#e2e8f0",
                  cursor: isEnding ? "not-allowed" : "pointer",
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
            )}
          </div>
        </form>

        {err ? (
          <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>
        ) : null}
      </div>
    </div>
  );
}
