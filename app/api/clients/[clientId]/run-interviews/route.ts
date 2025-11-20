import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RunInterviewsRequest = {
  ideaId?: number | null;
  agentIds: string[];
  interviewTypes: string[];
  ideaTitle?: string;
  ideaDescription?: string;
  personaFirstName?: string | null;
  stageMetadata?: Record<string, string>;
};

const SIMULATE_ENDPOINT = "https://api.elevenlabs.io/v1/convai/agents/{agentId}/simulate-conversation/stream";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!supabaseUrl || !supabaseServiceRole) {
  console.warn("[run-interviews] missing supabase env vars");
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

const buildFirstMessage = (options: {
  personaFirstName: string | null;
  stageLabel: string | null;
  stageSubtitle: string | null;
}) => {
  const normalizedName = options.personaFirstName?.trim() || "there";
  const normalizedStageLabel = options.stageLabel?.trim()?.toLowerCase() || "research";
  const normalizedSubtitle = options.stageSubtitle?.trim();
  const formattedSubtitle = normalizedSubtitle
    ? `${normalizedSubtitle.charAt(0).toLowerCase()}${normalizedSubtitle.slice(1)}`
    : "this research stage";
  return `Hi ${normalizedName}, today we're conducting a ${normalizedStageLabel}-focused interview to ${formattedSubtitle}. Ready to get started?`;
};

async function simulateAgent(
  agentId: string,
  apiKey: string,
  detail: string,
  firstMessage: string = "Hello there!"
) {
  console.log(`[run-interviews] simulate agent ${agentId}`, detail);
  const agentEndpoint = SIMULATE_ENDPOINT.replace("{agentId}", encodeURIComponent(agentId));
  const response = await fetch(agentEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      simulation_specification: {
        simulated_user_config: {
          instruction: detail,
          first_message: firstMessage,
        },
      },
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    console.warn(`[run-interviews] simulateAgent error ${agentId}`, response.status, errorText);
    throw new Error(errorText || "ElevenLabs simulation failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const turns: unknown[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        turns.push(JSON.parse(trimmed));
      } catch (err) {
        console.warn("[run-interviews] failed to parse chunk", trimmed, err);
      }
    }
  }
  if (buffer.trim()) {
    try {
      turns.push(JSON.parse(buffer.trim()));
    } catch (err) {
      console.warn("[run-interviews] failed to parse final chunk", buffer, err);
    }
  }

  return { agentId, turns };
}

export async function POST(request: Request, context: { params: { clientId: string } }) {
  const { clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceRole) {
    return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
  }

  const parsedClientId = Number(clientId);
  const normalizedClientId = Number.isFinite(parsedClientId) ? parsedClientId : clientId;

  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("client_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[run-interviews] profile lookup failed", profileError);
    return NextResponse.json({ error: "Unable to resolve profile" }, { status: 500 });
  }

  const profileClientId = profile?.client_id;
  if (!profileClientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const normalize = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Number(value);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) return numeric;
      return trimmed;
    }
    return null;
  };

  const normalizedProfileClientId = normalize(profileClientId);
  const compareClientIds = (a: unknown, b: unknown) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b;
    }
    return String(a) === String(b);
  };

  if (!compareClientIds(normalizedProfileClientId, normalizedClientId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let payload: RunInterviewsRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { agentIds, ideaId, interviewTypes, ideaTitle, ideaDescription, personaFirstName, stageMetadata: stageMetadataPayload } = payload;
  if (!Array.isArray(agentIds) || agentIds.length === 0 || !Array.isArray(interviewTypes) || interviewTypes.length === 0) {
    return NextResponse.json({ error: "Missing required payload fields" }, { status: 400 });
  }

  const ideaIdValue = typeof ideaId === "number" && Number.isFinite(ideaId) ? ideaId : null;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });
  }

  const typeFocusStatements: Record<string, string> = {
    Problem:
      "Help us understand specific challenges and pain points.",
    Ideation:
      "Help us create new ideas and solutions.",
    Solution:
      "Stress-test your idea, surface which parts of the concept land, and uncover what feels valuable to them.",
    Positioning:
      "Explore how they’d compare you to alternatives and what language actually resonates when talking about your idea.",
  };

  const ideaTitleText = typeof ideaTitle === "string" ? (ideaTitle.trim() || null) : null;
  const ideaDescriptionText = typeof ideaDescription === "string" ? (ideaDescription.trim() || null) : null;

  const normalizedPersonaFirstName =
    typeof personaFirstName === "string" && personaFirstName.trim().length > 0
      ? personaFirstName.trim().split(/\s+/).filter(Boolean)[0] ?? personaFirstName.trim()
      : null;
  const stageMetadataMap: Record<string, string | null> =
    typeof stageMetadataPayload === "object" && stageMetadataPayload !== null
      ? Object.fromEntries(
          Object.entries(stageMetadataPayload).map(([key, value]) => [
            key,
            typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
          ])
        )
      : {};

  const buildDetailForType = (interviewType: string) => {
    const detailLines: string[] = [];
    if (ideaTitle) {
      detailLines.push(`Interview the persona about this product idea: "${ideaTitle}".`);
    } else {
      detailLines.push("Interview the persona about this product idea.");
    }
    if (ideaDescription) {
      detailLines.push(ideaDescription);
    }
    detailLines.push(
      typeFocusStatements[interviewType] ??
        "Focus on collecting perspectives that help validate the idea in different stages of the discovery journey."
    );
    return detailLines.join(" ");
  };

  type InterviewSpec = {
    agent_id: string;
    interview_type: string | null;
    detail: string;
  };

  type InterviewSeed = {
    spec: InterviewSpec;
    interviewType: string | null;
    callSummaryTitle: string;
    transcriptSummary: string;
    bodyPayload: Record<string, unknown>;
    firstMessage: string;
  };

  const interviewSeeds: InterviewSeed[] = agentIds.flatMap((agentId) =>
    interviewTypes.map((interviewType) => {
      const detail = buildDetailForType(interviewType);
      const normalizedType = typeof interviewType === "string" && interviewType.trim().length > 0 ? interviewType : null;
      const trimmedType = normalizedType ?? null;
      const callSummaryTitle =
        ideaTitleText ??
        (trimmedType ? `Simulated ${trimmedType} interview` : "Simulated interview");
      const transcriptSummary = ideaDescriptionText ?? detail;
      const bodyPayload: Record<string, unknown> = {
        idea_id: ideaIdValue,
        interview_type: normalizedType,
        instruction: detail,
      };
      const stageSubtitle = normalizedType ? stageMetadataMap[normalizedType] ?? null : null;
      const firstMessage = buildFirstMessage({
        personaFirstName: normalizedPersonaFirstName,
        stageLabel: normalizedType,
        stageSubtitle,
      });
      return {
        spec: {
          agent_id: agentId,
          interview_type: normalizedType,
          detail,
        },
        interviewType: normalizedType,
        callSummaryTitle,
        transcriptSummary,
        bodyPayload,
        firstMessage,
      };
    })
  );

  const initialReceivedAt = new Date().toISOString();
  const initialPayloads = interviewSeeds.map((seed) => ({
    client_id: normalizedClientId,
    agent_id: seed.spec.agent_id ?? null,
    research_type: "simulation",
    call_summary_title: seed.callSummaryTitle,
    transcript: { messages: [] },
    transcript_summary: null,
    received_at: initialReceivedAt,
    event_timestamp: null,
    body: seed.bodyPayload,
    type: "simulated",
    status: "pending",
    research_stage: seed.interviewType,
    user_id: userId,
  }));

  const { data: initialRows, error: initialInsertError } = await supabaseAdmin
    .from("dialogues")
    .insert(initialPayloads)
    .select("id");

  if (initialInsertError) {
    console.error("[run-interviews] failed to persist placeholder dialogues", initialInsertError);
    return NextResponse.json(
      { error: "Failed to persist dialogues", details: initialInsertError.message },
      { status: 500 }
    );
  }

  const insertedRowIds = (initialRows ?? []).map((row) => row.id).filter(Boolean);
  type SimulationOutcome = { spec: InterviewSpec; detail: string; turns: unknown[] };
  type EnrichedSimulationOutcome = SimulationOutcome & {
    normalizedTurns: { role: "persona" | "user"; text: string }[];
  };
  let results: SimulationOutcome[];
  const simulationTasks = interviewSeeds.map((seed) =>
    simulateAgent(seed.spec.agent_id, apiKey, seed.spec.detail, seed.firstMessage).then((result) => ({
      spec: seed.spec,
      detail: seed.spec.detail,
      turns: result.turns,
    }))
  );

  try {
    console.log("[run-interviews] clientId", clientId, "ideaId", ideaId, "agents", agentIds);
    results = await Promise.all(simulationTasks);
  } catch (error: unknown) {
    console.error("[run-interviews] simulation error", error);
    const details = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    return NextResponse.json(
      { error: "Failed to simulate conversations", details },
      { status: 502 }
    );
  }

  const filteredTurns = (turns: unknown[]): { role: "persona" | "user"; text: string }[] => {
    const resolveRole = (value: unknown): "agent" | "user" | null => {
      const normalized =
        typeof value === "string" ? value.toLowerCase() : typeof value === "number" ? String(value) : "";
      if (normalized.includes("agent")) return "agent";
      if (normalized.includes("user")) return "user";
      if (normalized.includes("persona")) return "agent";
      if (normalized.includes("assistant")) return "agent";
      return null;
    };

    const parseTurn = (turn: unknown): Record<string, unknown> | null => {
      if (!turn) return null;
      if (typeof turn === "string") {
        try {
          return JSON.parse(turn) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
      if (typeof turn === "object") {
        return turn as Record<string, unknown>;
      }
      return null;
    };

    const entries: { role?: unknown; text?: string }[] = [];
    for (const turn of turns) {
      const record = parseTurn(turn);
      if (!record) continue;
      const conversation = record.simulated_conversation;
      if (Array.isArray(conversation)) {
        for (const item of conversation) {
          if (!item || typeof item !== "object") continue;
          const itemRecord = item as Record<string, unknown>;
          if (typeof itemRecord.message === "string") {
            entries.push({ role: itemRecord.role, text: itemRecord.message });
          }
        }
      } else if (typeof record.message === "string") {
        entries.push({ role: record.role, text: record.message });
      }
    }

    return entries
      .map((entry) => ({
        role: resolveRole(entry.role ?? ""),
        text: (entry.text ?? "").trim(),
      }))
      .filter((entry): entry is { role: "agent" | "user"; text: string } => Boolean(entry.role) && Boolean(entry.text))
      .map((entry) => ({
        role: entry.role === "agent" ? "persona" : "user",
        text: entry.text,
      }));
  };

  const normalizedResults: EnrichedSimulationOutcome[] = results.map((result) => ({
    ...result,
    normalizedTurns: filteredTurns(result.turns ?? []),
  }));

  const nowIso = new Date().toISOString();
  const timestamp = Date.now();

  const updatePromises = normalizedResults.map((result, index) => {
    const rowId = insertedRowIds[index];
    if (!rowId) {
      return Promise.resolve(null);
    }
    const transcriptSummary = ideaDescriptionText ?? result.detail;
    return supabaseAdmin
      .from("dialogues")
      .update({
        transcript: { messages: result.normalizedTurns },
        transcript_summary: transcriptSummary,
        received_at: nowIso,
        event_timestamp: timestamp,
        status: "completed",
      })
      .eq("id", rowId);
  });

  const updateResults = await Promise.all(updatePromises);
  const failedUpdate = updateResults.find((entry) => Boolean(entry?.error));
  if (failedUpdate?.error) {
    console.error("[run-interviews] failed to update dialogue", failedUpdate.error);
    return NextResponse.json(
      { error: "Failed to persist dialogues", details: failedUpdate.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
