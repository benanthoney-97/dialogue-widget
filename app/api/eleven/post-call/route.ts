import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getClientsForAgentId } from "@/app/lib/clientMap";
import {
  appendConversationRecord,
  type ConversationKnowledgeRecord,
} from "@/app/lib/clientKnowledgeStore";
import { getKnowledgeBaseConfig } from "@/app/lib/clientKnowledgeBaseConfig";
import { refreshKnowledgeBaseDocument } from "@/app/lib/elevenLabsKnowledgeBase";

export const runtime = "nodejs";

type SummaryPayload = {
  email: string;
  subject?: string;
  html?: string;
  text?: string;
};

type ContactPayload = {
  email: string;
  name?: string;
  phone?: string;
  notes?: string;
};

type PostCallPayload = {
  callId?: string;
  conversationId?: string;
  agentId?: string;
  summary?: SummaryPayload | SummaryPayload[];
  summaries?: SummaryPayload[];
  contact?: ContactPayload | ContactPayload[];
  contacts?: ContactPayload[];
  metadata?: Record<string, unknown>;
  type?: string;
  event_timestamp?: number;
  data?: Record<string, unknown>;
};

type SummaryContentRecord = {
  subject: string;
  html?: string;
  text?: string;
};

type PendingSummaryRequest = {
  email: string;
  subject?: string;
};

type PendingContactRecord = ContactPayload;

const globalStore = globalThis as typeof globalThis & {
  __pendingSummaryRequests?: Map<string, PendingSummaryRequest[]>;
  __completedSummaryContent?: Map<string, SummaryContentRecord>;
  __pendingContactRequests?: Map<string, PendingContactRecord[]>;
};

type PersistConversationArgs = {
  agentId?: string;
  callId: string;
  payload: PostCallPayload;
  summary?: SummaryContentRecord;
  transcriptionSummary?: SummaryContentRecord;
};

const pendingSummaryRequests =
  globalStore.__pendingSummaryRequests ??
  new Map<string, PendingSummaryRequest[]>();
const completedSummaryContent =
  globalStore.__completedSummaryContent ??
  new Map<string, SummaryContentRecord>();

if (!globalStore.__pendingSummaryRequests) {
  globalStore.__pendingSummaryRequests = pendingSummaryRequests;
}
if (!globalStore.__completedSummaryContent) {
  globalStore.__completedSummaryContent = completedSummaryContent;
}
const pendingContactRequests =
  globalStore.__pendingContactRequests ?? new Map<string, PendingContactRecord[]>();
if (!globalStore.__pendingContactRequests) {
  globalStore.__pendingContactRequests = pendingContactRequests;
}

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL;
const contactForwardAddress = process.env.RESEND_CONTACT_FORWARD_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function collectEntries<T>(
  primary?: T | T[] | null,
  secondary?: T[] | null
): T[] {
  const result: T[] = [];

  if (Array.isArray(primary)) {
    result.push(...primary.filter(isDefined));
  } else if (isDefined(primary)) {
    result.push(primary);
  }

  if (Array.isArray(secondary)) {
    result.push(...secondary.filter(isDefined));
  }

  return result;
}

function hasSummaryContent(summary?: SummaryPayload | null): summary is SummaryPayload {
  if (!summary) return false;
  const html = summary.html?.trim();
  const text = summary.text?.trim();
  return Boolean((html && html.length > 0) || (text && text.length > 0));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlFromText(text: string): string {
  return `<p>${escapeHtml(text).replace(/\r?\n/g, "<br/>")}</p>`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSummaryContent(summary: SummaryPayload, callId: string): SummaryContentRecord {
  const subject =
    summary.subject?.trim() || `Your conversation summary (${callId})`;
  const rawHtml = summary.html?.trim();
  const rawText = summary.text?.trim();

  let html = rawHtml;
  let text = rawText;

  if (!html && text) {
    html = htmlFromText(text);
  }

  if (html && !text) {
    text = stripHtml(html);
  }

  return {
    subject,
    html,
    text,
  };
}

function getAgentId(payload: PostCallPayload): string | undefined {
  if (payload.agentId) return payload.agentId;
  const data = payload.data;
  if (data && typeof data === "object") {
    const candidate = (data as { agent_id?: unknown }).agent_id;
    if (typeof candidate === "string") return candidate;
  }
  return undefined;
}

function extractCallId(payload: PostCallPayload, fallback?: string): string {
  const data = payload.data;
  const dataConversation =
    data && typeof data === "object"
      ? (data as { conversation_id?: unknown }).conversation_id
      : undefined;
  const metadataCallId =
    typeof payload.metadata === "object" &&
    payload.metadata !== null &&
    "callId" in payload.metadata &&
    typeof (payload.metadata as { callId?: unknown }).callId === "string"
      ? (payload.metadata as { callId: string }).callId
      : undefined;

  return (
    payload.callId ||
    payload.conversationId ||
    (typeof dataConversation === "string" ? dataConversation : undefined) ||
    metadataCallId ||
    fallback ||
    "unknown-call"
  );
}

function extractSummaryFromTranscription(
  payload: PostCallPayload,
  callId: string
): SummaryContentRecord | undefined {
  if (payload.type !== "post_call_transcription") return undefined;
  const data = payload.data;
  if (!data || typeof data !== "object") return undefined;
  const analysis = (data as { analysis?: unknown }).analysis;
  const transcriptSummary =
    analysis && typeof analysis === "object"
      ? (analysis as { transcript_summary?: unknown }).transcript_summary
      : undefined;
  if (typeof transcriptSummary !== "string" || !transcriptSummary.trim()) {
    return undefined;
  }
  const callSummaryTitle =
    analysis && typeof analysis === "object"
      ? (analysis as { call_summary_title?: unknown }).call_summary_title
      : undefined;
  const subject =
    (typeof callSummaryTitle === "string" && callSummaryTitle.trim()) ||
    `Conversation summary (${callId})`;
  const normalizedText = transcriptSummary.trim();
  return {
    subject,
    text: normalizedText,
    html: htmlFromText(normalizedText),
  };
}

export async function POST(request: NextRequest) {
  let payload: PostCallPayload;
  try {
    payload = (await request.json()) as PostCallPayload;
  } catch (error) {
    console.error("Invalid ElevenLabs webhook payload", error);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const agentId = getAgentId(payload);
  const callId = extractCallId(payload);

  const summaryEntries = collectEntries(payload.summary, payload.summaries);
  const contactRequests = collectEntries(payload.contact, payload.contacts);

  const summaryEmailMap = new Map<string, SummaryContentRecord>();
  const warnings: string[] = [];
  const contactsToSendNow: ContactPayload[] = [];

  const baseContentFromCache =
    callId !== "unknown-call"
      ? completedSummaryContent.get(callId)
      : undefined;
  let baseContent = baseContentFromCache;

  const finalEntries = summaryEntries.filter(hasSummaryContent);
  const subscriptionEntries = summaryEntries.filter(
    (entry) => entry.email && !hasSummaryContent(entry)
  );

  const transcriptionSummary = extractSummaryFromTranscription(payload, callId);
  if (transcriptionSummary) {
    baseContent = transcriptionSummary;
    if (callId !== "unknown-call") {
      completedSummaryContent.set(callId, transcriptionSummary);
    }
    console.log(
      "[post-call] Parsed transcription summary",
      JSON.stringify({
        callId,
        agentId,
        subject: transcriptionSummary.subject,
      })
    );
  }

  if (finalEntries.length > 0) {
    console.log(
      "[post-call] Received final summary content",
      JSON.stringify({
        callId,
        agentId,
        entries: finalEntries.length,
      })
    );

    const prepared = finalEntries.map((entry) => ({
      original: entry,
      content: buildSummaryContent(entry, callId),
    }));

    if (prepared[0]?.content) {
      baseContent = prepared[0].content;
    }

    if (baseContent && callId !== "unknown-call") {
      completedSummaryContent.set(callId, baseContent);
    }

    for (const { original, content } of prepared) {
      if (original.email) {
        summaryEmailMap.set(original.email, content);
      }
    }

    if (baseContent && callId !== "unknown-call") {
      const queued = pendingSummaryRequests.get(callId);
      if (queued?.length) {
        for (const request of queued) {
          if (!request.email) continue;
          if (!summaryEmailMap.has(request.email)) {
            summaryEmailMap.set(request.email, {
              subject: request.subject?.trim() || baseContent.subject,
              html: baseContent.html,
              text: baseContent.text,
            });
          }
        }
        pendingSummaryRequests.delete(callId);
      }
    } else {
      console.log(
        "[post-call] Queued summary requests",
        JSON.stringify({
          callId,
          queued: subscriptionEntries.length,
        })
      );
    }
  }

  if (baseContent && callId !== "unknown-call") {
    const queued = pendingSummaryRequests.get(callId);
    if (queued?.length) {
      for (const request of queued) {
        if (!request.email) continue;
        if (!summaryEmailMap.has(request.email)) {
          summaryEmailMap.set(request.email, {
            subject: request.subject?.trim() || baseContent.subject,
            html: baseContent.html,
            text: baseContent.text,
          });
        }
      }
      pendingSummaryRequests.delete(callId);
      console.log(
        "[post-call] Flushed queued summary requests",
        JSON.stringify({
          callId,
          agentId,
          recipients: queued.length,
        })
      );
    }
  }

  if (baseContent && callId !== "unknown-call") {
    const queuedContacts = pendingContactRequests.get(callId);
    if (queuedContacts?.length) {
      contactsToSendNow.push(...queuedContacts);
      pendingContactRequests.delete(callId);
      console.log(
        "[post-call] Flushed queued contact requests",
        JSON.stringify({
          callId,
          agentId,
          contacts: queuedContacts.length,
        })
      );
    }
  }

  if (subscriptionEntries.length) {
    if (callId === "unknown-call") {
      warnings.push(
        "Summary request missing call identifier; unable to queue until ElevenLabs supplies a conversation id."
      );
    } else if (baseContent) {
      for (const entry of subscriptionEntries) {
        if (!entry.email) continue;
        if (!summaryEmailMap.has(entry.email)) {
          summaryEmailMap.set(entry.email, {
            subject: entry.subject?.trim() || baseContent.subject,
            html: baseContent.html,
            text: baseContent.text,
          });
        }
      }
    } else {
      const existing = pendingSummaryRequests.get(callId) ?? [];
      const dedup = new Map<string, PendingSummaryRequest>();
      for (const queued of existing) {
        dedup.set(queued.email, queued);
      }
      let newlyQueued = 0;
      for (const entry of subscriptionEntries) {
        if (!entry.email) continue;
        if (!dedup.has(entry.email)) {
          newlyQueued += 1;
        }
        dedup.set(entry.email, {
          email: entry.email,
          subject: entry.subject?.trim() || undefined,
        });
      }
      pendingSummaryRequests.set(callId, Array.from(dedup.values()));
      if (newlyQueued > 0) {
        console.log(
          "[post-call] Queued summary requests",
          JSON.stringify({
            callId,
            agentId,
            added: newlyQueued,
            totalQueued: dedup.size,
          })
        );
        warnings.push(
          `Summary content not available yet; ${newlyQueued} request${newlyQueued === 1 ? "" : "s"} queued until the call completes.`
        );
      }
    }
  }

  if (contactRequests.length) {
    if (callId === "unknown-call") {
      warnings.push(
        "Contact request missing call identifier; unable to forward until ElevenLabs supplies a conversation id."
      );
    } else if (baseContent) {
      contactsToSendNow.push(...contactRequests);
    } else {
      const existing = pendingContactRequests.get(callId) ?? [];
      existing.push(...contactRequests);
      pendingContactRequests.set(callId, existing);
      console.log(
        "[post-call] Queued contact requests",
        JSON.stringify({
          callId,
          agentId,
          added: contactRequests.length,
          totalQueued: existing.length,
        })
      );
      warnings.push(
        "Summary not ready; contact request queued until call summary is available."
      );
    }
  }

  const pending: Promise<unknown>[] = [];
  let summaryEmailsSent = 0;
  let contactNotificationsSent = 0;

  if (!resend || !resendFrom) {
    if (summaryEmailMap.size > 0) {
      warnings.push(
        "Missing RESEND_API_KEY or RESEND_FROM_EMAIL; summary emails were not sent."
      );
    }
    if (contactsToSendNow.length > 0) {
      warnings.push(
        "Missing RESEND_API_KEY or RESEND_FROM_EMAIL; contact notifications were not sent."
      );
    }
  } else {
    for (const [email, content] of summaryEmailMap) {
      const html = content.html ?? (content.text ? htmlFromText(content.text) : undefined);
      const text = content.text ?? (content.html ? stripHtml(content.html) : undefined);

      if (!html && !text) {
        warnings.push(
          `Summary email for ${email} skipped because no content was available.`
        );
        continue;
      }

      pending.push(
        resend.emails.send({
          from: resendFrom,
          to: email,
          subject: content.subject,
          html: html ?? undefined,
          text: text ?? "",
        })
      );
      summaryEmailsSent += 1;
      console.log(
        "[post-call] Dispatching summary email",
        JSON.stringify({
          callId,
          agentId,
          email,
        })
      );
    }

    if (contactsToSendNow.length > 0) {
      if (contactForwardAddress) {
        const contextHtmlParts = [
          `<strong>Call ID:</strong> ${escapeHtml(callId)}`,
          agentId ? `<strong>Agent ID:</strong> ${escapeHtml(agentId)}` : "",
        ].filter(Boolean);
        const contextTextParts = [
          `Call ID: ${callId}`,
          agentId ? `Agent ID: ${agentId}` : undefined,
        ].filter(Boolean);

        const contactHtmlSections = contactsToSendNow.map((contact, index) => {
          const sections = [
            `<strong>Name:</strong> ${escapeHtml(contact.name ?? "Unknown")}`,
            `<strong>Email:</strong> ${escapeHtml(contact.email)}`,
            contact.phone ? `<strong>Phone:</strong> ${escapeHtml(contact.phone)}` : "",
            contact.notes
              ? `<strong>Notes:</strong> ${escapeHtml(contact.notes).replace(/\r?\n/g, "<br/>")}`
              : "",
          ]
            .filter(Boolean)
            .join("<br/>");
          return `<p><strong>Contact ${index + 1}</strong><br/>${sections}</p>`;
        });

        const contactTextSections = contactsToSendNow.map((contact, index) => {
          const lines = [
            `Contact ${index + 1}`,
            `Name: ${contact.name ?? "Unknown"}`,
            `Email: ${contact.email}`,
            contact.phone ? `Phone: ${contact.phone}` : undefined,
            contact.notes ? `Notes: ${contact.notes}` : undefined,
          ]
            .filter(Boolean)
            .join("\n");
          return lines;
        });

        const summaryHtmlRaw =
          baseContent?.html ??
          (baseContent?.text ? htmlFromText(baseContent.text) : undefined);
        const summaryTextRaw =
          baseContent?.text ??
          (baseContent?.html ? stripHtml(baseContent.html) : undefined);

        const htmlSegments = [];
        if (contextHtmlParts.length) {
          htmlSegments.push(`<p>${contextHtmlParts.join("<br/>")}</p>`);
        }
        if (contactHtmlSections.length) {
          htmlSegments.push(contactHtmlSections.join("<hr/>"));
        }
        if (summaryHtmlRaw) {
          htmlSegments.push(
            `<p><strong>Call Summary</strong></p>${summaryHtmlRaw}`
          );
        }
        const htmlContent = htmlSegments.join("<hr/>");

        const textSegments = [];
        if (contextTextParts.length) {
          textSegments.push(contextTextParts.join("\n"));
        }
        if (contactTextSections.length) {
          textSegments.push(contactTextSections.join("\n\n"));
        }
        if (summaryTextRaw) {
          textSegments.push(`Call Summary:\n${summaryTextRaw}`);
        }
        const textContent = textSegments.join("\n\n");

        pending.push(
          resend.emails.send({
            from: resendFrom,
            to: contactForwardAddress,
            subject: baseContent
              ? `New contact request + summary (${callId})`
              : `New contact request (${callId})`,
            html: htmlContent || undefined,
            text: textContent || "",
          })
        );
        contactNotificationsSent = contactsToSendNow.length;
        console.log(
          "[post-call] Forwarded contact requests",
          JSON.stringify({
            callId,
            agentId,
            contacts: contactsToSendNow.length,
          })
        );
      } else {
        warnings.push(
          "Missing RESEND_CONTACT_FORWARD_EMAIL; contact requests were not forwarded."
        );
      }
    }
  }

  try {
    if (pending.length) {
      await Promise.all(pending);
    }
  } catch (error) {
    console.error("Failed to dispatch Resend messages", error);
    return NextResponse.json(
      { error: "Failed to dispatch notification emails" },
      { status: 500 }
    );
  }

  try {
    await persistClientConversations({
      agentId,
      callId,
      payload,
      summary: baseContent,
      transcriptionSummary,
    });
  } catch (error) {
    console.error("Failed to persist client knowledge record", error);
  }

  const summarySubscribersPending =
    callId === "unknown-call"
      ? 0
      : pendingSummaryRequests.get(callId)?.length ?? 0;
  const summaryContentCached =
    callId !== "unknown-call" && completedSummaryContent.has(callId);

  return NextResponse.json({
    ok: true,
    callId,
    summaryEmailsSent,
    summarySubscribersPending,
    summaryContentCached,
    contactNotificationsSent,
    warnings,
  });
}

async function persistClientConversations({
  agentId,
  callId,
  payload,
  summary,
  transcriptionSummary,
}: PersistConversationArgs) {
  if (!agentId) return;
  const clientSlugs = getClientsForAgentId(agentId);
  if (!clientSlugs.length) return;

  console.log(
    "[post-call] Persisting client conversations",
    JSON.stringify({ callId, agentId, clientSlugs })
  );

  const eventTimestamp =
    typeof payload.event_timestamp === "number" ? payload.event_timestamp : null;
  const data =
    payload.type === "post_call_transcription" && payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : null;

  const metadata =
    payload && typeof payload.metadata === "object" && payload.metadata !== null
      ? (payload.metadata as Record<string, unknown>)
      : null;
  const rawDuration = metadata
    ? (metadata as { call_duration_secs?: unknown }).call_duration_secs
    : undefined;
  const callDurationSecs = typeof rawDuration === "number" ? rawDuration : null;

  const analysis =
    data && typeof data === "object" && "analysis" in data && typeof (data as any).analysis === "object"
      ? ((data as { analysis: Record<string, unknown> }).analysis)
      : null;
  const dataCollectionResultsRaw =
    analysis &&
    typeof analysis === "object" &&
    "data_collection_results" in analysis &&
    typeof (analysis as any).data_collection_results === "object"
      ? ((analysis as { data_collection_results: Record<string, unknown> }).data_collection_results)
      : null;
  const dataCollectionResults = dataCollectionResultsRaw
    ? JSON.parse(JSON.stringify(dataCollectionResultsRaw))
    : null;

  let transcriptText: string | null = null;
  if (data && typeof data === "object" && Array.isArray((data as { transcript?: unknown }).transcript)) {
    const transcript = (data as { transcript: any[] }).transcript;
    transcriptText = transcript
      .map((turn) => {
        const role = turn?.role ?? "agent";
        const message =
          typeof turn?.message === "string"
            ? turn.message
            : typeof turn?.original_message === "string"
            ? turn.original_message
            : "";
        return `${role}: ${message}`.trim();
      })
      .join("\n");
  }

  const summaryText = summary?.text ?? transcriptionSummary?.text ?? null;
  const summarySubject = summary?.subject ?? transcriptionSummary?.subject ?? null;

  const recordBase = {
    callId,
    agentId,
    capturedAt: new Date().toISOString(),
    callDurationSecs,
    summarySubject,
    summary: summaryText,
    transcriptSummary: transcriptionSummary?.text ?? summary?.text ?? null,
    transcriptText,
    dataCollectionResults,
  };

  await Promise.all(
    clientSlugs.map(async (clientSlug) => {
      const record: ConversationKnowledgeRecord = {
        ...recordBase,
        clientSlug,
      };
      await appendClientConversationRecord(clientSlug, record, eventTimestamp);
    })
  );
}

async function appendClientConversationRecord(
  clientSlug: string,
  record: ConversationKnowledgeRecord,
  eventTimestamp: number | null
) {
  await appendConversationRecord(clientSlug, record);
  try {
    console.log(
      "[post-call] Scheduling knowledge base refresh",
      JSON.stringify({ clientSlug })
    );
    await scheduleKnowledgeBaseRefresh(clientSlug);
  } catch (error) {
    console.error(
      "[post-call] Failed to refresh knowledge base",
      JSON.stringify({
        clientSlug,
        message: (error as Error)?.message,
      })
    );
  }
  console.log(
    "[post-call] Appended client conversation",
    JSON.stringify({
      clientSlug,
      callId: record.callId,
      eventTimestamp,
    })
  );
}

async function scheduleKnowledgeBaseRefresh(clientSlug: string) {
  const config = await getKnowledgeBaseConfig(clientSlug);
  if (!config) {
    console.log(
      "[post-call] No knowledge base config; skipping refresh",
      JSON.stringify({ clientSlug })
    );
    return;
  }
  console.log(
    "[post-call] Refreshing knowledge base",
    JSON.stringify({
      clientSlug,
      url: config.url,
      documentId: config.documentId ?? null,
    })
  );
  await refreshKnowledgeBaseDocument({
    clientSlug,
    url: config.url,
    documentId: config.documentId,
    documentName: config.documentName,
    ragModel: config.ragModel,
    agentId: config.agentId,
  });
}
