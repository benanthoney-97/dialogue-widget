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

type CreateRoomBody = {
  roomName?: unknown;
  clientId?: unknown;
  userId?: unknown;
};

type ChatRoomRow = {
  id: string;
  client_id: string;
  user_id: string | null;
  name: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ChatRoomResponse = {
  id: string;
  clientId: string;
  userId: string | null;
  name: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function mapRoom(row: ChatRoomRow): ChatRoomResponse {
  return {
    id: row.id,
    clientId: row.client_id,
    userId: row.user_id ?? null,
    name: row.name ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function POST(request: Request) {
  if (!isConfigured || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Server misconfiguration. Supabase credentials are missing." },
      { status: 500 }
    );
  }

  let body: CreateRoomBody;
  try {
    body = (await request.json()) as CreateRoomBody;
  } catch (error) {
    console.error("[live-chat] Failed to parse request body", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const roomName = typeof body.roomName === "string" ? body.roomName.trim() : "";
  if (!roomName) {
    return NextResponse.json({ error: "roomName is required" }, { status: 400 });
  }

  const rawClientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  if (!rawClientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const clientId = rawClientId;
  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : null;

  try {
    const existingRoomResult = userId
      ? await supabaseAdmin
          .from("chat_rooms")
          .select("id, client_id, user_id, name, created_at, updated_at")
          .eq("client_id", clientId)
          .eq("name", roomName)
          .eq("user_id", userId)
          .maybeSingle<ChatRoomRow>()
      : await supabaseAdmin
          .from("chat_rooms")
          .select("id, client_id, user_id, name, created_at, updated_at")
          .eq("client_id", clientId)
          .eq("name", roomName)
          .is("user_id", null)
          .maybeSingle<ChatRoomRow>();

    const { data: existingRoom, error: fetchError } = existingRoomResult;

    if (fetchError) {
      console.error("[live-chat] Failed to query room", fetchError);
      return NextResponse.json({ error: "Unable to load chat room" }, { status: 500 });
    }

    if (existingRoom) {
      return NextResponse.json({ room: mapRoom(existingRoom) });
    }

    const insertPayload: Record<string, unknown> = {
      client_id: clientId,
      name: roomName,
    };

    if (userId) {
      insertPayload.user_id = userId;
    }

    const { data: newRoom, error: insertError } = await supabaseAdmin
      .from("chat_rooms")
      .insert(insertPayload)
      .select("id, client_id, user_id, name, created_at, updated_at")
      .single<ChatRoomRow>();

    if (insertError || !newRoom) {
      console.error("[live-chat] Failed to create room", insertError);
      return NextResponse.json({ error: "Unable to create chat room" }, { status: 500 });
    }

    return NextResponse.json({ room: mapRoom(newRoom) }, { status: 201 });
  } catch (error) {
    console.error("[live-chat] Unexpected error while creating room", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
