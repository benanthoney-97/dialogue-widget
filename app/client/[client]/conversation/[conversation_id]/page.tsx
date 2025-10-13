"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRef } from "react";
import { docMap } from "@/app/lib/docMap";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import Sidebar from "../../Sidebar";
import { generateConversationPdf } from "@/app/lib/generateConversationPdf";

// This page will be at /client/[client]/conversation/[conversation_id]
export default function ConversationWithBriefingPage({ params }: { params: { conversation_id: string } }) {
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { conversation_id } = params;
  const contentRef = useRef<HTMLPreElement | null>(null);

  async function handlePdfClick() {
    if (!row) return;
    await generateConversationPdf(row);
  }

  useEffect(() => {
    async function fetchRow() {
      setLoading(true);
      setError(null);
      // Fetch from the Supabase view conversation_with_briefing
      const { data, error } = await supabase
        .from('conversation_with_briefing')
        .select('*')
        .eq('conversation_id', conversation_id)
        .single();
      if (error || !data) {
        setError("Conversation not found");
        setLoading(false);
        return;
      }
      setRow(data);
      setLoading(false);
    }
    if (conversation_id) fetchRow();
  }, [conversation_id]);

  return (
    <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div
        style={{
          flex: 1,
          background: "#16213a",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
          padding: 40,
          fontFamily: "inherit",
          position: 'relative',
          minHeight: '100dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          maxWidth: '100%',
        }}
      >
        {/* PDF icon in top right corner */}
        <div style={{ position: 'absolute', top: 24, right: 32, zIndex: 10 }}>
          <Image
            src="/icons/pdf-icon.png"
            alt="PDF"
            width={32}
            height={32}
            style={{ display: 'block', cursor: 'pointer' }}
            onClick={handlePdfClick}
          />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e6eaff", fontFamily: "inherit" }}>Conversation Details</h2>
        {loading ? (
          <div style={{ color: '#a3c0ff', textAlign: 'center', padding: 24 }}>Loading…</div>
        ) : error ? (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: 24 }}>{error}</div>
        ) : row ? (
          <div style={{ color: '#a3c0ff', fontSize: 16 }}>
            {/* Filter out unwanted fields */}
            <pre
              ref={contentRef}
              style={{
                color: '#e6eaff',
                background: '#22325a',
                padding: 16,
                borderRadius: 8,
                fontSize: 15,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {JSON.stringify(
                Object.fromEntries(
                  Object.entries(row).filter(
                    ([key]) => ![
                      'id',
                      'client_id',
                      'type',
                      'event_timestamp',
                      'agent_id',
                      'conversation_id',
                      'status',
                      'user_id',
                      'call_duration_secs',
                      'body',
                    ].includes(key)
                  )
                ),
                null,
                2
              )}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}
