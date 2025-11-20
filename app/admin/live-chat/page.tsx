import { redirect } from "next/navigation";
import Sidebar from "../../client/[client]/Sidebar";
import { RealtimeChat } from "@/components/realtime-chat";
import { createClient } from "@/lib/supabase/server";

type ChatRoom = {
  id: string;
  client_id: string;
  name: string | null;
  created_at: string | null;
  updated_at: string | null;
  client: {
    display_name: string | null;
  }[] | null;
};

function getDisplayName(room: ChatRoom) {
  const clientName = room.client?.[0]?.display_name;
  return clientName ?? room.name ?? "Unknown room";
}

type LiveChatAdminPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function LiveChatAdminPage({ searchParams }: LiveChatAdminPageProps) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/unauthorized");
  }

  const profileId = session.user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, client_id, role, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/unauthorized");
  }

  const { data: rooms, error: roomsError } = await supabase
    .from("chat_rooms")
    .select("id, name, client_id, created_at, updated_at, client:chat_rooms_client_id_fkey(display_name)")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (roomsError) {
    console.error("[admin/live-chat] Failed to load rooms", roomsError);
  }

  const sanitizedRooms = rooms ?? [];
  const searchRoomId = typeof searchParams?.room === "string" ? searchParams.room : null;
  const activeRoom = sanitizedRooms.find((room) => room.id === searchRoomId) ?? sanitizedRooms[0] ?? null;

  if (!activeRoom) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg, #f4f8ff)",
        }}
      >
        <main
          style={{
            marginLeft: "var(--sidebar-width)",
            padding: "64px 32px",
            color: "#0f172a",
            width: "100%",
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Chat with us</h1>
          <p style={{ fontSize: 16, color: "#475569" }}>No chat rooms available yet.</p>
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg, #f4f8ff)",
        color: "var(--text, #0f172a)",
      }}
    >
      <Sidebar />
      <main
        style={{
          marginLeft: "var(--sidebar-width)",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <aside
            style={{
              width: 320,
              borderRight: "1px solid rgba(15, 23, 42, 0.08)",
              background: "#fff",
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "16px 20px" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Chats</h2>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {sanitizedRooms.map((room) => {
                  const isActive = room.id === activeRoom.id;
                  return (
                    <li key={room.id}>
                      <a
                        href={`?room=${room.id}`}
                        style={{
                          display: "block",
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                          border: isActive ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(15,23,42,0.08)",
                          color: "inherit",
                          textDecoration: "none",
                          transition: "background 0.18s ease, border 0.18s ease",
                        }}
                      >
                        <strong style={{ display: "block", fontSize: 15 }}>{getDisplayName(room)}</strong>
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          Updated {new Date(room.updated_at ?? room.created_at ?? '').toLocaleString()}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
          <section
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              <RealtimeChat
                roomId={activeRoom.id}
                roomName={activeRoom.name ?? activeRoom.id}
                clientId={activeRoom.client_id}
                username={profile.display_name ?? "Support"}
                senderRoleOverride="support_team"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
