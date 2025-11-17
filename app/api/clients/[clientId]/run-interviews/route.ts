import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RunInterviewsRequest = {
  ideaId: number;
  agentIds: string[];
  interviewTypes: string[];
  ideaTitle?: string;
  ideaDescription?: string;
};

const SIMULATE_ENDPOINT = "https://api.elevenlabs.io/v1/convai/agents/{agentId}/simulate-conversation/stream";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!supabaseUrl || !supabaseServiceRole) {
  console.warn("[run-interviews] missing supabase env vars");
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

async function simulateAgent(
  agentId: string,
  apiKey: string,
  detail: string
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

  let payload: RunInterviewsRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { agentIds, ideaId, interviewTypes, ideaTitle, ideaDescription } = payload;
  if (!ideaId || !Array.isArray(agentIds) || agentIds.length === 0 || !Array.isArray(interviewTypes)) {
    return NextResponse.json({ error: "Missing required payload fields" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });
  }

  const typeFocusStatements: Record<string, string> = {
    Problem:
      "Understand what they’re trying to achieve, their motivations, and the existing pain points they face.",
    Solution:
      "Stress-test your idea, surface which parts of the concept land, and uncover what feels valuable to them.",
    Positioning:
      "Explore how they’d compare you to alternatives and what language actually resonates when talking about your idea.",
  };

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

  const rowsToInsert = agentIds.flatMap((agentId) =>
    interviewTypes.map((interviewType) => ({
      client_id: clientId,
      idea_id: ideaId,
      agent_id: agentId,
      status: "pending",
      interview_type: interviewType,
      transcript: {
        instruction: buildDetailForType(interviewType),
      },
    }))
  );

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("simulated_interviews")
    .insert(rowsToInsert)
    .select("id,agent_id,interview_type");

  if (insertError || !inserted) {
    console.error("[run-interviews] insert error", insertError);
    return NextResponse.json(
      { error: "Failed to create interview records", details: insertError?.message ?? null },
      { status: 500 }
    );
  }

  const interviewIds = inserted.map((row) => row.id);
  type SimulationOutcome = { rowId: number | string; detail: string; turns: unknown[] };
  let results: SimulationOutcome[];
  const simulationTasks = inserted.map((row) => {
    const detailText = buildDetailForType(row.interview_type ?? "");
    return simulateAgent(row.agent_id!, apiKey, detailText).then((result) => ({
      rowId: row.id,
      detail: detailText,
      turns: result.turns,
    }));
  });

  try {
    console.log("[run-interviews] clientId", clientId, "ideaId", ideaId, "agents", agentIds);
    results = await Promise.all(simulationTasks);
  } catch (error: any) {
    console.error("[run-interviews] simulation error", error);
    await supabaseAdmin
      .from("simulated_interviews")
      .update({ status: "failed" })
      .in("id", interviewIds);
    return NextResponse.json(
      { error: "Failed to simulate conversations", details: error?.message ?? error },
      { status: 502 }
    );
  }

  const filteredTurns = (turns: unknown[]) => {
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

  await Promise.all(
    results.map((result) =>
      supabaseAdmin
        .from("simulated_interviews")
        .update({
          status: "completed",
          transcript: {
            instruction: result.detail,
            turns: filteredTurns(result.turns ?? []),
          },
          raw_transcript: result.turns ?? [],
        })
        .eq("id", result.rowId)
    )
  );

  return NextResponse.json({ success: true });
}
