import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const isConfigured = Boolean(supabaseUrl && serviceRoleKey);
const supabaseAdmin = isConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

type RouteContext = {
  params: Promise<{
    roomId?: string;
  }>;
};

type ChatRoomRow = {
  id: string;
  client_id: string;
  name: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  email?: string | null;
};

type ChatMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  sender_role: string | null;
  content: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  profiles: ProfileRow | null;
};

type ChatMessageResponse = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  user: {
    id: string;
    name: string;
    role: string | null;
  };
  createdAt: string;
  updatedAt: string | null;
};

type CreateMessageBody = {
  content?: unknown;
  senderId?: unknown;
  senderRole?: unknown;
  metadata?: unknown;
};

function inferDisplayName(profile: ProfileRow | null, fallbackMetadata: unknown): string {
  if (profile?.display_name) return profile.display_name;
  if (profile?.email) return profile.email;
  if (typeof fallbackMetadata === "object" && fallbackMetadata !== null) {
    const name = (fallbackMetadata as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  }
  return "Unknown";
}

function normaliseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return { raw };
    }
  }

  if (typeof raw === "object") {
    return raw as Record<string, unknown>;
  }

  return null;
}

function mapMessage(row: ChatMessageRow): ChatMessageResponse {
  const createdAt = row.created_at ?? new Date().toISOString();
  const metadata = normaliseMetadata(row.metadata);
  return {
    id: row.id,
    content: row.content ?? "",
    metadata,
    user: {
      id: row.sender_id,
      name: inferDisplayName(row.profiles ?? null, row.metadata),
      role: row.sender_role ?? null,
    },
    createdAt,
    updatedAt: row.updated_at ?? null,
  };
}

async function loadRoom(roomId: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("chat_rooms")
    .select("id, client_id, name")
    .eq("id", roomId)
    .maybeSingle<ChatRoomRow>();

  if (error) {
    console.error("[live-chat] Failed to load room", error);
    throw new Error("Unable to load chat room");
  }

  if (!data) {
    const notFound = new Error("Chat room not found") as Error & { status?: number };
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Server misconfiguration. Supabase credentials are missing." },
      { status: 500 }
    );
  }

  const { roomId: rawRoomId } = await context.params;
  const roomId = rawRoomId?.trim();
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  try {
    await loadRoom(roomId);

    const { data: rows, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select(
        "id, room_id, sender_id, sender_role, content, metadata, created_at, updated_at, profiles:chat_messages_sender_id_fkey(display_name, email)"
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("[live-chat] Failed to load messages", messagesError);
      return NextResponse.json({ error: "Unable to load messages" }, { status: 500 });
    }

    const messages = ((rows ?? []) as ChatMessageRow[]).map(mapMessage);
    return NextResponse.json({ room: { id: roomId }, messages });
  } catch (error) {
    if (error instanceof Error && (error as Error & { status?: number }).status === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[live-chat] Unexpected error loading messages", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!isConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Server misconfiguration. Supabase credentials are missing." },
      { status: 500 }
    );
  }

  const { roomId: rawRoomId } = await context.params;
  const roomId = rawRoomId?.trim();
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  let body: CreateMessageBody;
  try {
    body = (await request.json()) as CreateMessageBody;
  } catch (error) {
    console.error("[live-chat] Failed to parse message body", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 });
  }

  const senderId = typeof body.senderId === "string" ? body.senderId.trim() : "";
  if (!senderId) {
    return NextResponse.json({ error: "senderId is required" }, { status: 400 });
  }

  const senderRoleRaw = typeof body.senderRole === "string" ? body.senderRole.trim() : "";
  const allowedRoles = ["user", "support_team"] as const;
  const senderRole = allowedRoles.includes(senderRoleRaw as (typeof allowedRoles)[number])
    ? senderRoleRaw
    : "user";

  let metadataValue: unknown = {};
  if (body.metadata === null || body.metadata === undefined) {
    metadataValue = {};
  } else if (typeof body.metadata === "string") {
    try {
      metadataValue = JSON.parse(body.metadata);
    } catch {
      metadataValue = { raw: body.metadata };
    }
  } else if (typeof body.metadata === "object") {
    metadataValue = body.metadata;
  }

  try {
    await loadRoom(roomId);

    const insertPayload: Record<string, unknown> = {
      room_id: roomId,
      sender_id: senderId,
      sender_role: senderRole,
      content,
    };

    insertPayload.metadata = metadataValue;

    const { data: row, error: insertError } = await supabaseAdmin
      .from("chat_messages")
      .insert(insertPayload)
      .select(
        "id, room_id, sender_id, sender_role, content, metadata, created_at, updated_at, profiles:chat_messages_sender_id_fkey(display_name, email)"
      )
      .single<ChatMessageRow>();

    if (insertError || !row) {
      console.error("[live-chat] Failed to create message", insertError);
      return NextResponse.json({ error: "Unable to create message" }, { status: 500 });
    }

    return NextResponse.json({ message: mapMessage(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as Error & { status?: number }).status === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[live-chat] Unexpected error creating message", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
