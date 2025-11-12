"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createClient } from "@supabase/supabase-js";
import { useConversation } from "@elevenlabs/react";
import {
  exportTranscriptToPdf,
  type PdfTranscriptMessage,
  type TranscriptPdfPayload,
} from "@/app/lib/exportTranscriptPdf";

type Props = {
  agentId: string;
  useSignedUrl?: boolean;
  serverLocation?: "us" | "eu-residency" | "in-residency" | "global";
  buttonColor?: string;
  buttonTextColor?: string;
  buttonBorderColor?: string;
  personaName?: string;
  userId?: string;
  personaKeyTraits?: string[] | null;
  personaIntentSignals?: string[] | null;
  personaCustomerStatus?: string | null;
  personaKeyPainPoints?: string[] | null;
  autoStart?: boolean;
  promptTemplate?: string;
  promptContext?: string | null;
  firstMessage?: string;
  autoStartUserMessage?: string;
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

const MIN_TEXTAREA_HEIGHT = 46;
const MAX_TEXTAREA_HEIGHT = 200;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function DialogueText({
  agentId,
  useSignedUrl = true,
  serverLocation = "us",
  buttonColor = "#60a5fa",
  buttonTextColor = "#0f172a",
  personaName,
  userId,
  personaKeyTraits,
  personaIntentSignals,
  personaCustomerStatus,
  personaKeyPainPoints,
  autoStart = false,
  promptTemplate,
  promptContext,
  firstMessage,
  autoStartUserMessage,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [isNarrow, setIsNarrow] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [endedTranscript, setEndedTranscript] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const autoStartRef = useRef(false);
  const [knowledgeText, setKnowledgeText] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLocalUserMessageRef = useRef<string>("");
  const lastRemoteUserTranscriptRef = useRef<string>("");
  const lastAgentResponseRef = useRef<string>("");
  const lastAgentMessageIdRef = useRef<string | null>(null);
  const isAgentStreamingRef = useRef(false);
  const copyInfoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [copyFeedback, setCopyFeedback] = useState<{ messageId: string; text: string } | null>(
    null
  );

  const handleCopyAgentMessage = useCallback(async (messageId: string, text: string) => {
    const value = text.trim();
    if (!value) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyFeedback({ messageId, text: "Copy unavailable in this browser" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback({ messageId, text: "Copied!" });
    } catch (error) {
      console.error("[DialogueText] Failed to copy message", error);
      setCopyFeedback({ messageId, text: "Copy failed" });
    }
  }, []);

  useEffect(() => {
    if (!copyFeedback) return;
    if (copyInfoTimeoutRef.current) {
      clearTimeout(copyInfoTimeoutRef.current);
    }
    copyInfoTimeoutRef.current = setTimeout(() => {
      setCopyFeedback(null);
      copyInfoTimeoutRef.current = null;
    }, 1600);
    return () => {
      if (copyInfoTimeoutRef.current) {
        clearTimeout(copyInfoTimeoutRef.current);
        copyInfoTimeoutRef.current = null;
      }
    };
  }, [copyFeedback]);

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

  useEffect(() => {
    async function fetchKnowledgeText() {
      if (!agentId) {
        setKnowledgeText(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("persona_external_knowledge")
          .select("knowledge_text")
          .eq("agent_id", agentId)
          .maybeSingle<{ knowledge_text: string | null }>();
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[DialogueText] failed to load knowledge text", error);
        }
        setKnowledgeText(data?.knowledge_text ?? null);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[DialogueText] unexpected error fetching knowledge text", error);
        setKnowledgeText(null);
      }
    }

    void fetchKnowledgeText();
  }, [agentId]);

  const dynamicVariables = useMemo(() => {
    const joinValues = (values?: string[] | null) => {
      if (!Array.isArray(values)) return "";
      return values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
        .join(", ");
    };

    const variables: Record<string, string> = {
      research_type: "chat",
      user_id: userId ?? "",
      agent_name: personaName?.trim() ?? "",
      key_traits: joinValues(personaKeyTraits),
      intent_signals: joinValues(personaIntentSignals),
      customer_status: personaCustomerStatus?.trim() ?? "",
      key_pain_points: joinValues(personaKeyPainPoints),
    };

    if (knowledgeText && knowledgeText.trim().length > 0) {
      variables.knowledge_text = knowledgeText.trim();
    }

    return variables;
  }, [
    knowledgeText,
    personaCustomerStatus,
    personaIntentSignals,
    personaKeyPainPoints,
    personaKeyTraits,
    personaName,
    userId,
  ]);

  const composedPrompt = useMemo(() => {
    const baseTemplate = promptTemplate ?? CHAT_PROMPT_TEMPLATE;
    if (!promptContext || !promptContext.trim()) return baseTemplate;
    return `${baseTemplate}\n\n${promptContext.trim()}`;
  }, [promptContext, promptTemplate]);

  const overrides = useMemo(
    () =>
      ({
        agent: {
          firstMessage: firstMessage ?? "Hi, I'm here to help. What would you like to know?",
          prompt: {
            prompt: composedPrompt,
          },
        },
      }) as unknown as {
        agent: { firstMessage?: string; prompt?: { prompt: string } };
      },
    [composedPrompt, firstMessage]
  );

  const hasEndedCall = endedTranscript.length > 0;

  const handleResetChat = () => {
    setEndedTranscript([]);
    setMessages([]);
    setDraft("");
    setPhase("ready");
    setErr("");
  };
  const connect = useCallback(async () => {
    try {
      if (String(status) === "connected" || String(status) === "connecting") return;
      setPhase("connecting");
      setEndedTranscript([]);
      if (useSignedUrl) {
        const payload: Record<string, unknown> = { agent_id: agentId };
        if (dynamicVariables) {
          payload.dynamic_variables = dynamicVariables;
        }
        const res = await fetch("/api/eleven/get-signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
        const sessionOptions = {
          signedUrl: data.signedUrl,
          connectionType: "websocket" as const,
          ...(dynamicVariables ? { dynamicVariables } : {}),
          overrides,
        };
        await startSession(sessionOptions);
      } else {
        const sessionOptions = {
          agentId,
          connectionType: "websocket" as const,
          ...(dynamicVariables ? { dynamicVariables } : {}),
          overrides,
        };
        await startSession(sessionOptions);
      }
      setPhase("connected");
    } catch (error) {
      setPhase("ready");
      throw error;
    }
  }, [agentId, dynamicVariables, overrides, startSession, status, useSignedUrl]);

  useEffect(() => {
    if (!autoStart || autoStartRef.current) return;
    autoStartRef.current = true;
    let messageQueued = false;

    const run = async () => {
      try {
        await connect();
        const initialMessage = autoStartUserMessage?.trim();
        if (initialMessage) {
          appendUserMessage(initialMessage);
          lastLocalUserMessageRef.current = initialMessage;
          setIsSending(true);
          messageQueued = true;
          setErr("");
          setEndedTranscript([]);
          await sendUserMessage?.(initialMessage);
        }
      } catch (error) {
        console.error("[DialogueText] auto-start failed", error);
        setErr(error instanceof Error ? error.message : String(error ?? "Unknown error"));
      } finally {
        if (messageQueued) {
          setIsSending(false);
        }
      }
    };

    run();
  }, [
    appendUserMessage,
    autoStart,
    autoStartUserMessage,
    connect,
    sendUserMessage,
    setEndedTranscript,
  ]);

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

  const showEndedActions = messages.length === 0 && endedTranscript.length > 0;

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
    const isAssistant = message.role === "assistant";
    const handleAssistantClick = isAssistant
      ? () => {
          void handleCopyAgentMessage(message.id, message.text);
        }
      : undefined;
    const isCopyFeedbackVisible =
      isAssistant && copyFeedback?.messageId === message.id ? copyFeedback.text : null;
    return (
      <div
        key={message.id}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
          gap: 6,
        }}
      >
        <div
          style={{
            alignSelf: isUser ? "flex-end" : "flex-start",
            maxWidth: "85%",
            background: isUser ? buttonColor : "rgba(148, 163, 184, 0.16)",
            color: isUser ? buttonTextColor : "#0f172a",
            padding: "10px 14px",
            borderRadius: isUser ? "15px 15px 4px 15px" : "15px 15px 15px 4px",
            fontSize: 14,
            lineHeight: 1.45,
            wordBreak: "break-word",
            boxShadow: "0 6px 16px rgba(6, 10, 20, 0.35)",
            cursor: isAssistant ? "pointer" : "default",
          }}
          role={isAssistant ? "button" : undefined}
          tabIndex={isAssistant ? 0 : undefined}
          aria-label={isAssistant ? "Copy persona message" : undefined}
          onClick={handleAssistantClick}
          onKeyDown={
            isAssistant
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void handleCopyAgentMessage(message.id, message.text);
                  }
                }
              : undefined
          }
          title={isAssistant ? "Click to copy" : undefined}
        >
          {message.text}
        </div>
        {isCopyFeedbackVisible ? (
          <span style={{ color: "#94a3b8", fontSize: 11 }}>{isCopyFeedbackVisible}</span>
        ) : null}
      </div>
    );
  };

  const sendDisabled = isSending || phase === "connecting" || isEnding;
  const trimmedDraft = draft.trim();
  const showSendButton = trimmedDraft.length > 0;

  const handleDownloadTranscript = useCallback(async () => {
    const source = endedTranscript.length ? endedTranscript : messages;
    if (!source.length) return;

    const transcriptMessages: PdfTranscriptMessage[] = [];
    const fallbackSegments: string[] = [];

    source.forEach((message) => {
      const normalized = message.text.replace(/\r?\n/g, " ").trim();
      if (!normalized) return;

      if (message.role === "user" || message.role === "assistant") {
        transcriptMessages.push({
          role: message.role === "user" ? "user" : "agent",
          text: normalized,
        });
      }

      const label =
        message.role === "assistant"
          ? personaName?.trim() || "Persona"
          : message.role === "user"
          ? "User"
          : message.role === "system"
          ? "System"
          : message.role;
      fallbackSegments.push(`${label}: ${normalized}`);
    });

    const rawResearchType =
      typeof dynamicVariables?.research_type === "string"
        ? dynamicVariables.research_type.trim()
        : "";
    const formattedResearchType = rawResearchType
      ? `${rawResearchType.charAt(0).toUpperCase()}${rawResearchType.slice(1)}`
      : undefined;

    const timestampLabel = new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());

    const payload: TranscriptPdfPayload = {
      conversationTitle: personaName?.trim()
        ? `Session with ${personaName.trim()}`
        : "Dialogue Session",
      personaName: personaName?.trim() || "Unknown persona",
      researchType: formattedResearchType,
      timestampLabel,
      messages: transcriptMessages,
      fallbackText: fallbackSegments.join("\n\n"),
    };

    try {
      await exportTranscriptToPdf(payload);
    } catch (error) {
      console.error("[DialogueText] Failed to export transcript", error);
    }
  }, [dynamicVariables, endedTranscript, messages, personaName]);

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
            justifyContent: showEndedActions ? "center" : transcriptStyle.justifyContent,
            alignItems: showEndedActions ? "center" : transcriptStyle.alignItems,
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadTranscript();
                  }}
                  style={{
                    padding: "0 22px",
                    height: 46,
                    borderRadius: 14,
                    border: "1px solid #0f172a",
                    background: "transparent",
                    color: "#0f172a",
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 200,
                    transition:
                      "background .18s ease, color .18s ease, opacity .18s ease",
                  }}
                >
                  Download transcript
                </button>
                <button
                  type="button"
                  onClick={handleResetChat}
                  style={{
                    padding: "0 22px",
                    height: 46,
                    borderRadius: 14,
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    background: "#0f172a",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 200,
                    transition:
                      "background .18s ease, color .18s ease, opacity .18s ease",
                  }}
                >
                  Start new chat
                </button>
              </div>
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

        {!hasEndedCall ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(14, 21, 36, 0.9)",
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.25)",
              padding: "8px 12px",
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
              placeholder="Type…"
              aria-label="Type"
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
                padding: "12px 0",
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
              {showSendButton ? (
                <button
                  type="submit"
                  disabled={sendDisabled}
                  style={{
                    padding: 0,
                    height: 46,
                    borderRadius: 999,
                    border: "1px solid rgba(59, 130, 246, 0.45)",
                    background: sendDisabled
                      ? "rgba(148, 163, 184, 0.2)"
                      : buttonColor,
                    color: sendDisabled
                      ? "rgba(226, 232, 240, 0.6)"
                      : buttonTextColor,
                    cursor: sendDisabled ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    transition:
                      "background .18s ease, color .18s ease, opacity .18s ease",
                  }}
                  aria-label={sendDisabled ? "Sending" : "Send message"}
                >
                  <svg
                    aria-hidden="true"
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    style={{ display: "block" }}
                  >
                    <path
                      d="M12 5l6 6h-4v8h-4v-8H6l6-6z"
                      fill={sendDisabled ? "rgba(226, 232, 240, 0.6)" : buttonTextColor}
                    />
                  </svg>
                </button>
              ) : null}
              {phase === "connected" ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleEndCall();
                  }}
                  disabled={isEnding}
                  style={{
                    padding: 0,
                    height: 46,
                    width: 46,
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
                    transition:
                      "background .18s ease, color .18s ease, opacity .18s ease",
                  }}
                  aria-label={isEnding ? "Ending call" : "End call"}
                >
                  {isEnding ? (
                    <span style={{ fontSize: 12, letterSpacing: 1 }}>…</span>
                  ) : (
                    <svg
                      aria-hidden="true"
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      style={{ display: "block" }}
                    >
                      <rect
                        x={7}
                        y={7}
                        width={10}
                        height={10}
                        rx={2}
                        fill={"currentColor"}
                      />
                    </svg>
                  )}
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {err ? (
          <div style={{ color: "#fca5a5", fontSize: 13 }}>{err}</div>
        ) : null}
      </div>
    </div>
  );
}
const CHAT_PROMPT_TEMPLATE =
  "You are assuming the role of customer persona who the user is having a conversation with. Your role is to produce hyper-realistic responses, emotions and views using what's in your knowledge base. Analyse the documents and links in your knowledge base to act as your brain, and to generate highly realistic, human reactions to the user's questions and proposals. As well as the documents in your knowledge base, here are the critical details about your persona: Name:{{agent_name}}; Key traits:{{key_traits}}; Intent Signals:{{intent_signals}}; Customer Status:{{customer_status}}; Key Pain Points:{{key_pain_points}}. Be direct and ask deep contextual questions based on what's in your knowledge base. Always try to provide justification for your responses using the data that's in your knowledge base. Don't be afraid to push back on responses and ask strings of follow up questions, just as a real customer would. The user might have a presentation document up in front of them on the screen during your interview, so it's very helpful if you can reference which page or part of the document you're referencing at the start of your responses. Be assertive in how you engage with the user. For example, instead of asking “Do you want to focus on X or Y next?”, you should say “Now let’s move on to X”. Regularly refer to specific text or references from the documents during the session. But do not mention their \"script\". Once the user has completed the interview, thank them for their time and end the call.   CRITICAL RULES: - Never, for any reason, generate responses or reactions that don't align with the script's text. You can provide factual explanations and definitions to help the user. But always guide them back to the session's focus based on the script's text. User ID:{{user_id}}. Research Type:{{research_type}}.";
