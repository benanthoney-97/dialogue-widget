import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type ClientResearchPriorityRow = {
  id: string;
  client_id: string;
  primary_goal?: string | null;
  priorities?: string[] | null;
  target_sources?: string[] | null;
  [key: string]: unknown;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId?: string }> }
) {
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing workspace identifier" },
      { status: 400 }
    );
  }

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("client_research_priorities")
      .select("*")
      .eq("client_id", clientRow.id)
      .maybeSingle<ClientResearchPriorityRow>();

    if (error) {
      console.error("[Research] Failed to load client research priorities", error);
      return NextResponse.json({ error: "Unable to load research priorities" }, { status: 500 });
    }

    return NextResponse.json({ priority: data ?? null });
  } catch (error) {
    console.error("[Research] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId?: string }> }
) {
  const { clientId } = await params;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing workspace identifier" },
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("[Research] Failed to parse request body", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = (payload ?? {}) as { primary_goal?: unknown; priorities?: unknown; target_sources?: unknown };
  const hasPrimaryGoal = Object.prototype.hasOwnProperty.call(body, "primary_goal");
  const hasPriorities = Object.prototype.hasOwnProperty.call(body, "priorities");
  const hasTargetSources = Object.prototype.hasOwnProperty.call(body, "target_sources");

  if (!hasPrimaryGoal && !hasPriorities && !hasTargetSources) {
    return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
  }

  let primaryGoalValue: string | null | undefined;
  if (hasPrimaryGoal) {
    const { primary_goal } = body;
    if (primary_goal !== null && primary_goal !== undefined && typeof primary_goal !== "string") {
      return NextResponse.json({ error: "primary_goal must be a string or null" }, { status: 400 });
    }
    primaryGoalValue = primary_goal == null ? null : primary_goal;
  }

  let prioritiesValue: string[] | null | undefined;
  if (hasPriorities) {
    const { priorities } = body;
    if (priorities === null) {
      prioritiesValue = [];
    } else if (Array.isArray(priorities)) {
      const sanitized = priorities
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      prioritiesValue = Array.from(new Set(sanitized));
    } else {
      return NextResponse.json({ error: "priorities must be an array of strings or null" }, { status: 400 });
    }
  }

  let targetSourcesValue: string[] | null | undefined;
  if (hasTargetSources) {
    const { target_sources } = body;
    if (target_sources === null) {
      targetSourcesValue = [];
    } else if (Array.isArray(target_sources)) {
      const sanitized = target_sources
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      targetSourcesValue = Array.from(new Set(sanitized));
    } else {
      return NextResponse.json({ error: "target_sources must be an array of strings or null" }, { status: 400 });
    }
  }

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { data: existingRow, error: fetchError } = await supabaseAdmin
      .from("client_research_priorities")
      .select("id")
      .eq("client_id", clientRow.id)
      .maybeSingle<{ id: string }>();

    if (fetchError) {
      console.error("[Research] Failed to load existing research priorities", fetchError);
      return NextResponse.json({ error: "Unable to update research priorities" }, { status: 500 });
    }

    let mutationError: unknown = null;
    let payloadRow: ClientResearchPriorityRow | null = null;

    const updateFields: Record<string, unknown> = {};
    if (hasPrimaryGoal) {
      updateFields.primary_goal = primaryGoalValue ?? null;
    }
    if (hasPriorities) {
      updateFields.priorities = prioritiesValue ?? [];
    }
    if (hasTargetSources) {
      updateFields.target_sources = targetSourcesValue ?? [];
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: "No valid update fields provided" }, { status: 400 });
    }

    if (existingRow) {
      const { data, error } = await supabaseAdmin
        .from("client_research_priorities")
        .update(updateFields)
        .eq("id", existingRow.id)
        .select()
        .maybeSingle<ClientResearchPriorityRow>();

      mutationError = error;
      payloadRow = data ?? null;
    } else {
      const insertFields: Record<string, unknown> = { client_id: clientRow.id };
      if (hasPrimaryGoal) {
        insertFields.primary_goal = primaryGoalValue ?? null;
      }
      if (hasPriorities) {
        insertFields.priorities = prioritiesValue ?? [];
      }
      if (hasTargetSources) {
        insertFields.target_sources = targetSourcesValue ?? [];
      }

      const { data, error } = await supabaseAdmin
        .from("client_research_priorities")
        .insert(insertFields)
        .select()
        .maybeSingle<ClientResearchPriorityRow>();

      mutationError = error;
      payloadRow = data ?? null;
    }

    if (mutationError) {
      console.error("[Research] Failed to persist client research priorities", mutationError);
      return NextResponse.json({ error: "Unable to update research priorities" }, { status: 500 });
    }

    return NextResponse.json({ priority: payloadRow });
  } catch (error) {
    console.error("[Research] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
