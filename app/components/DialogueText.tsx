"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
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
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
  }>;
};

type ClientEvent =
  | { type: "user_transcript"; text: string }
  | { type: "agent_response"; text: string };

type StoredAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  previewUrl: string | null;
  status: "pending" | "ready" | "error";
  text: string;
  error?: string;
};

type PdfJsLib = typeof import("pdfjs-dist");

const MIN_TEXTAREA_HEIGHT = 46;
const MAX_TEXTAREA_HEIGHT = 200;
const bodyFontStyle: CSSProperties = { fontFamily: BODY_FONT_STACK };
const headingFontStyle: CSSProperties = { fontFamily: HEADING_FONT_STACK };
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ATTACHMENT_PROCESSING_MESSAGE =
  "Please wait for document processing to finish.";

const makeMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const extensionOf = (file: File) => {
  const parts = file.name.toLowerCase().split(".");
  if (parts.length < 2) return "";
  return parts.pop() ?? "";
};

const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

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
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);

  const hasPendingAttachments = useMemo(
    () => attachments.some((attachment) => attachment.status === "pending"),
    [attachments]
  );

  const hasReadyAttachments = useMemo(
    () => attachments.some((attachment) => attachment.status === "ready"),
    [attachments]
  );

  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<StoredAttachment[]>([]);
  const lastLocalUserMessageRef = useRef<string>("");
  const lastRemoteUserTranscriptRef = useRef<string>("");
  const lastAgentResponseRef = useRef<string>("");
  const lastAgentMessageIdRef = useRef<string | null>(null);
  const isAgentStreamingRef = useRef(false);
  const copyInfoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    if (!hasPendingAttachments) {
      setErr((prev) => (prev === ATTACHMENT_PROCESSING_MESSAGE ? "" : prev));
    }
  }, [hasPendingAttachments]);

  const updateAttachment = useCallback(
    (id: string, updates: Partial<StoredAttachment>) => {
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id ? { ...attachment, ...updates } : attachment
        )
      );
    },
    []
  );

  const parseAttachment = useCallback(
    async (attachment: StoredAttachment) => {
      const { file, id } = attachment;
      try {
        const mime = file.type.toLowerCase();
        const ext = extensionOf(file);

        const readAsText = () =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              if (typeof result === "string") {
                resolve(result);
              } else if (result instanceof ArrayBuffer) {
                resolve(new TextDecoder().decode(result));
              } else {
                resolve("");
              }
            };
            reader.onerror = () =>
              reject(reader.error ?? new Error("Failed to read file"));
            reader.readAsText(file);
          });

        const parsePdf = async () => {
          const buffer = await file.arrayBuffer();
          const pdfjsModule = (await import("pdfjs-dist/build/pdf")) as unknown as PdfJsLib & {
            default?: PdfJsLib;
          };
          const pdfjsLib = pdfjsModule.default ?? pdfjsModule;
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
          }
          const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
          let combined = "";
          for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
            const page = await doc.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items
              .map((item: unknown) => {
                if (!item || typeof item !== "object") return "";
                if ("str" in item && typeof (item as { str?: string }).str === "string") {
                  return (item as { str: string }).str;
                }
                return "";
              })
              .join(" ");
            if (pageText.trim()) {
              combined += `${pageText}\n`;
            }
          }
          return combined.trim();
        };

        let extracted = "";
        if (mime === "text/plain" || mime === "text/csv" || ext === "txt" || ext === "csv") {
          extracted = (await readAsText()).trim();
        } else if (mime === "application/pdf" || ext === "pdf") {
          extracted = await parsePdf();
        } else if (mime.startsWith("image/")) {
          extracted = `[Image attachment: ${file.name}]`;
        } else {
          extracted = (await readAsText()).trim();
        }

        updateAttachment(id, {
          text: extracted,
          status: "ready",
          error: undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "Unknown error");
        console.error("[DialogueText] Failed to parse attachment", {
          name: file.name,
          error: message,
        });
        updateAttachment(id, {
          status: "error",
          error: message,
        });
      }
    },
    [updateAttachment]
  );

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);

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

  const appendUserMessage = useCallback(
    (text: string, attachmentsForMessage?: TranscriptMessage["attachments"]) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachmentsForMessage || attachmentsForMessage.length === 0)) return;
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: "user",
          text: trimmed,
          attachments: attachmentsForMessage,
        },
      ]);
    },
    []
  );

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
          console.error("[DialogueText] failed to load knowledge text", error);
        }
        setKnowledgeText(data?.knowledge_text ?? null);
      } catch (error) {
        console.error("[DialogueText] unexpected error fetching knowledge text", error);
        setKnowledgeText(null);
      }
    }

    void fetchKnowledgeText();
  }, [agentId]);

  const attachmentsKnowledgeText = useMemo(() => {
    const readyAttachments = attachments.filter(
      (attachment) => attachment.status === "ready" && attachment.text.trim()
    );
    if (readyAttachments.length === 0) return "";
    return readyAttachments
      .map((attachment) => `Attachment: ${attachment.name}\n${attachment.text.trim()}`)
      .join("\n\n---\n\n");
  }, [attachments]);

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

    const baseKnowledge = knowledgeText?.trim();
    if (baseKnowledge) {
      variables.knowledge_text = baseKnowledge;
    }

    const uploadedContent = attachmentsKnowledgeText.trim();
    if (uploadedContent) {
      variables.uploaded_content = uploadedContent;
    }

    return variables;
  }, [
    attachmentsKnowledgeText,
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
          firstMessage: firstMessage ?? "",
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
    attachmentsRef.current.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setAttachments([]);
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
    const initialMessage = autoStartUserMessage?.trim();
    if (!autoStart || autoStartRef.current || !initialMessage) return;
    autoStartRef.current = true;
    let messageQueued = false;

    const run = async () => {
      try {
        await connect();
            appendUserMessage(initialMessage);
            lastLocalUserMessageRef.current = initialMessage;
            setIsSending(true);
            messageQueued = true;
            setErr("");
            setEndedTranscript([]);
            await sendUserMessage?.(initialMessage);
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
    const rawText = draft;
    const trimmedText = rawText.trim();
    if (isSending) return;

    if (hasPendingAttachments) {
      setErr(ATTACHMENT_PROCESSING_MESSAGE);
      return;
    }

    const readyToSend = attachments.filter((attachment) => attachment.status === "ready");
    if (!trimmedText && readyToSend.length === 0) return;

    const attachmentLabels = readyToSend.map((attachment) => attachment.name);
    const generatedText = !trimmedText
      ? attachmentLabels.length === 1
        ? `Uploaded document: ${attachmentLabels[0]}`
        : `Uploaded documents: ${attachmentLabels.join(", ")}`
      : trimmedText;
    const outgoingText = generatedText;
    const attachmentsForMessage = readyToSend.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
    }));

    setDraft("");
    appendUserMessage(outgoingText, attachmentsForMessage);
    lastLocalUserMessageRef.current = outgoingText;
    setIsSending(true);
    setErr("");
    setEndedTranscript([]);

    let sentSuccessfully = false;

    try {
      await connect();
      console.log("[DialogueText] Sending message", { text: outgoingText });
      await sendUserMessage?.(outgoingText);
      sentSuccessfully = true;
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
      if (sentSuccessfully && readyToSend.length > 0) {
        const sentIds = new Set(readyToSend.map((attachment) => attachment.id));
        setAttachments((prev) =>
          prev.filter((attachment) => {
            const shouldRemove = sentIds.has(attachment.id);
            if (shouldRemove && attachment.previewUrl) {
              URL.revokeObjectURL(attachment.previewUrl);
            }
            return !shouldRemove;
          })
        );
      }
    }
  }, [
    appendUserMessage,
    attachments,
    connect,
    draft,
    hasPendingAttachments,
    isSending,
    sendUserMessage,
  ]);

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
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      setAttachments([]);
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
    ...bodyFontStyle,
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
            ...bodyFontStyle,
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
          ...bodyFontStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
          gap: 6,
        }}
      >
        {isAssistant ? (
          <div
            style={{
              ...bodyFontStyle,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(15, 23, 42, 0.6)",
            }}
          >
            {personaName?.trim() || "Persona"}
          </div>
        ) : null}
        <div
          style={{
            ...bodyFontStyle,
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
          {message.text ? <div>{message.text}</div> : null}
          {message.attachments && message.attachments.length > 0 ? (
            <div
              style={{
                ...bodyFontStyle,
                marginTop: message.text ? 8 : 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {message.attachments.map((attachment) => (
                <span
                  key={attachment.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: isUser
                      ? "1px solid rgba(255, 255, 255, 0.4)"
                      : "1px solid rgba(148, 163, 184, 0.45)",
                    background: isUser
                      ? "rgba(15, 23, 42, 0.18)"
                      : "rgba(255, 255, 255, 0.55)",
                    color: isUser ? buttonTextColor : "#0f172a",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <span>{attachment.name}</span>
                  <span style={{ opacity: 0.7 }}>
                    {formatAttachmentSize(attachment.size)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {isCopyFeedbackVisible ? (
          <span style={{ ...bodyFontStyle, color: "#94a3b8", fontSize: 11 }}>
            {isCopyFeedbackVisible}
          </span>
        ) : null}
      </div>
    );
  };

  const sendDisabled =
    isSending || phase === "connecting" || isEnding || hasPendingAttachments;
  const trimmedDraft = draft.trim();
  const showSendButton = trimmedDraft.length > 0 || hasReadyAttachments;
  const attachmentButtonVisible = phase === "idle" || phase === "ready";

  const handleDownloadTranscript = useCallback(async () => {
    const source = endedTranscript.length ? endedTranscript : messages;
    if (!source.length) return;

    const transcriptMessages: PdfTranscriptMessage[] = [];
    const fallbackSegments: string[] = [];

    source.forEach((message) => {
      const parts: string[] = [];
      const trimmedBody = message.text.replace(/\r?\n/g, " ").trim();
      if (trimmedBody) {
        parts.push(trimmedBody);
      }
      if (message.attachments && message.attachments.length > 0) {
        const attachmentSummary = message.attachments
          .map((attachment) => attachment.name)
          .join(", ");
        parts.push(`Attachments: ${attachmentSummary}`);
      }
      const normalized = parts.join(" \u2014 ").trim();
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
        ...bodyFontStyle,
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
          ...bodyFontStyle,
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
                ...bodyFontStyle,
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
                  ...bodyFontStyle,
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
                    ...headingFontStyle,
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
                    ...headingFontStyle,
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
                ...bodyFontStyle,
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
              ...bodyFontStyle,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              background: "rgba(14, 21, 36, 0.9)",
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.25)",
              padding: "8px 12px",
              marginTop: "auto",
              position: "relative",
            }}
          >
            {attachmentButtonVisible ? (
              <button
                type="button"
                aria-label="Add attachment"
                title="Add attachment"
                style={{
                  ...headingFontStyle,
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.25)",
                  background: "rgba(15, 23, 42, 0.45)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(226, 232, 240, 0.78)",
                  cursor: "pointer",
                  transition: "background 0.18s ease, color 0.18s ease, transform 0.18s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(30, 64, 175, 0.55)";
                  event.currentTarget.style.color = "rgba(248, 250, 252, 0.92)";
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "rgba(15, 23, 42, 0.45)";
                  event.currentTarget.style.color = "rgba(226, 232, 240, 0.78)";
                  event.currentTarget.style.transform = "translateY(0)";
                }}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.csv"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                border: 0,
              }}
              onChange={(event) => {
                const files = event.target.files ? Array.from(event.target.files) : [];
                if (files.length === 0) return;
                const newAttachments: StoredAttachment[] = files.map((file) => {
                  const previewUrl = file.type.startsWith("image/")
                    ? URL.createObjectURL(file)
                    : null;
                  return {
                    id: makeMessageId(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    file,
                    previewUrl,
                    text: "",
                    status: "pending",
                  } as StoredAttachment;
                });
                if (newAttachments.length > 0) {
                  setAttachments((prev) => [...prev, ...newAttachments]);
                  newAttachments.forEach((attachment) => {
                    console.info("[DialogueText] Stored attachment locally", {
                      name: attachment.name,
                      size: attachment.size,
                      type: attachment.type,
                    });
                  });
                  newAttachments.forEach((attachment) => {
                    void parseAttachment(attachment).catch(() => undefined);
                  });
                }
                event.target.value = "";
              }}
            />
            <div
              style={{
                ...bodyFontStyle,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 8,
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
                  minHeight: MIN_TEXTAREA_HEIGHT,
                  resize: "none",
                  border: "none",
                  outline: "none",
                  fontFamily: BODY_FONT_STACK,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "#e2e8f0",
                  background: "transparent",
                  overflow: "hidden",
                  padding: "12px 0",
                }}
              />
              {attachments.length > 0 ? (
                <div
                  style={{
                    ...bodyFontStyle,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {attachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      style={{
                        ...bodyFontStyle,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(148, 163, 184, 0.45)",
                        background: "rgba(15, 23, 42, 0.35)",
                        color: "rgba(226, 232, 240, 0.9)",
                        fontSize: 12,
                        lineHeight: 1,
                      }}
                    >
                      {attachment.previewUrl ? (
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            overflow: "hidden",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(148, 163, 184, 0.35)",
                            background: "rgba(15, 23, 42, 0.45)",
                          }}
                        >
                          <Image
                            src={attachment.previewUrl}
                            alt={attachment.name}
                            width={22}
                            height={22}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            unoptimized
                          />
                        </span>
                      ) : null}
                      <span>{attachment.name}</span>
                      <span style={{ opacity: 0.8 }}>
                        {(() => {
                          if (attachment.status === "pending") return "Parsing…";
                          if (attachment.status === "error") return "Failed";
                          const trimmed = attachment.text.trim();
                          if (!trimmed) {
                            return formatAttachmentSize(attachment.size);
                          }
                          return trimmed.length > 30
                            ? `${trimmed.slice(0, 30)}…`
                            : trimmed;
                        })()}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              style={{
                ...bodyFontStyle,
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
                    ...headingFontStyle,
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
                    cursor: hasPendingAttachments
                      ? "wait"
                      : sendDisabled
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    transition:
                      "background .18s ease, color .18s ease, opacity .18s ease",
                  }}
                  aria-label={
                    hasPendingAttachments
                      ? "Document processing"
                      : sendDisabled
                      ? "Sending"
                      : "Send message"
                  }
                  title={
                    hasPendingAttachments ? ATTACHMENT_PROCESSING_MESSAGE : undefined
                  }
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
                      fill={
                        sendDisabled
                          ? "rgba(226, 232, 240, 0.6)"
                          : buttonTextColor
                      }
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
                    ...headingFontStyle,
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
          <div style={{ ...bodyFontStyle, color: "#fca5a5", fontSize: 13 }}>{err}</div>
        ) : null}
      </div>
    </div>
  );
}
const CHAT_PROMPT_TEMPLATE =
  "You are assuming the role of customer persona who the user is having a conversation with. Your role is to produce hyper-realistic responses, emotions and views using what's in your knowledge base. Analyse the documents and links in your knowledge base to act as your brain, and to generate highly realistic, human reactions to the user's questions and proposals. As well as the documents in your knowledge base, here are the critical details about your persona: Name:{{agent_name}}; Key traits:{{key_traits}}; Intent Signals:{{intent_signals}}; Customer Status:{{customer_status}}; Key Pain Points:{{key_pain_points}}. Be direct and ask deep contextual questions based on what's in your knowledge base. Always try to provide justification for your responses using the data that's in your knowledge base. Don't be afraid to push back on responses and ask strings of follow up questions, just as a real customer would. The user might have a presentation document up in front of them on the screen during your interview, so it's very helpful if you can reference which page or part of the document you're referencing at the start of your responses. Be assertive in how you engage with the user. For example, instead of asking “Do you want to focus on X or Y next?”, you should say “Now let’s move on to X”. Regularly refer to specific text or references from the documents during the session. But do not mention their \"script\". Once the user has completed the interview, thank them for their time and end the call.   CRITICAL RULES: - Never, for any reason, generate responses or reactions that don't align with the script's text. You can provide factual explanations and definitions to help the user. But always guide them back to the session's focus based on the script's text. User ID:{{user_id}}. Research Type:{{research_type}}.";
