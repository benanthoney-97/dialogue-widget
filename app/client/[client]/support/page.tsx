"use client";
import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../Sidebar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


import { usePathname } from "next/navigation";

export default function SupportPage() {

  const pathname = usePathname();
  const [clientId, setClientId] = useState<number | null>(null);
  const [messages, setMessages] = useState<{ id: number; content: string; sender_id: string | null }[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Derive clientSlug from URL
  function getClientSlug(pathname: string | null): string {
    if (!pathname) return "";
    const match = pathname.match(/^\/client\/([^\/]+)/);
    return match ? match[1] : "";
  }
  const clientSlug = getClientSlug(pathname);

  // Fetch client_id from clients table using slug (name)
  useEffect(() => {
    async function fetchClientId() {
      if (!clientSlug) return;
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("name", clientSlug)
        .single();
      if (data && data.id) setClientId(data.id);
    }
    fetchClientId();
  }, [clientSlug]);

  // Subscribe to real-time updates using clientId as chat group
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`topic:${clientId}`, { config: { private: true } })
      .on("broadcast", { event: "INSERT" }, (payload) => {
        setMessages((msgs) => [...msgs, payload.record]);
      })
      .on("broadcast", { event: "UPDATE" }, (payload) => {
        setMessages((msgs) =>
          msgs.map((msg) => (msg.id === payload.record.id ? payload.record : msg))
        );
      })
      .on("broadcast", { event: "DELETE" }, (payload) => {
        setMessages((msgs) => msgs.filter((msg) => msg.id !== payload.record.id));
      })
      .subscribe();

    // Fetch initial messages for this clientId
    supabase
      .from("messages")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !clientId) return;
    const { error } = await supabase.from("messages").insert({
      client_id: clientId,
      sender_id: null,
      content: input.trim(),
    });
    if (error) console.error(error);
    setInput("");
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div style={{ flex: 1, background: "#16213a", borderRadius: 16, boxShadow: "0 8px 32px rgba(10,22,40,0.45)", padding: 40, fontFamily: "inherit", position: 'relative', minHeight: '100dvh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 400, background: "#16213a", borderRadius: 16, boxShadow: "0 8px 32px rgba(10,22,40,0.45)", padding: 32, display: "flex", flexDirection: "column", minHeight: 500 }}>
          <h2 style={{ color: "#e6eaff", marginBottom: 18 }}>Support Chat</h2>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 18, background: "#22325a", borderRadius: 8, padding: 16, minHeight: 300 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: 10, color: "#a3c0ff" }}>
                <span style={{ fontWeight: 600, marginRight: 8 }}>{msg.sender_id || "User"}:</span>
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #2d406b",
                fontSize: 15,
                color: "#a3c0ff",
                background: "#192447",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#525fe1",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 18px",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
