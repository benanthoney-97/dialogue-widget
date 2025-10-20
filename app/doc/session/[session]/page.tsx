"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import DialogueBarTalkButton from "@/app/components/DialogueBarTalkButton";
import { useParams } from "next/navigation";
import Sidebar from "@/app/client/[client]/Sidebar";
import { createClient } from "@supabase/supabase-js";

const PDFJSViewer = dynamic(() => import("@/app/components/PDFJSViewer"), { ssr: false });

type DocItem = {
  id: string;
  key: string;
  title?: string;
  document_url?: string | null;
  storage_path?: string | null;
  agent_id?: string | null;
};

export default function SessionDocsPage() {
  const { session } = useParams() as { session?: string };
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load subagents for this session param (session may be agent_id or subagent_key)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        // If session looks like an agent id, fetch all subagents for that agent
        let rows: any[] | null = null;
        if (session.startsWith("agent_")) {
          const { data } = await supabase
            .from("subagents")
            .select("id, subagent_key, assigned_document_url, assigned_storage_path, agent_map_agent_id")
            .eq("agent_map_agent_id", session)
            .order("created_at", { ascending: true });
          rows = data as any[] | null;
        } else {
          const { data: single } = await supabase
            .from("subagents")
            .select("id, subagent_key, assigned_document_url, assigned_storage_path, agent_map_agent_id")
            .eq("subagent_key", session)
            .maybeSingle();
          if (single) {
            const { data: siblings } = await supabase
              .from("subagents")
              .select("id, subagent_key, assigned_document_url, assigned_storage_path, agent_map_agent_id")
              .eq("agent_map_agent_id", single.agent_map_agent_id)
              .order("created_at", { ascending: true });
            rows = siblings as any[] | null;
            if (!cancelled && siblings) {
              const mapped = (siblings || []).map((r: any) => ({
                id: String(r.id),
                key: r.subagent_key,
                title: r.subagent_key,
                document_url: r.assigned_document_url ?? null,
                storage_path: r.assigned_storage_path ?? null,
                agent_id: r.agent_map_agent_id ?? null,
              }));
              setDocs(mapped);
              const startIdx = mapped.findIndex((m) => m.key === session);
              setCurrentIdx(startIdx >= 0 ? startIdx : 0);
            }
            return;
          }
        }

        if (cancelled) return;
        if (!rows || rows.length === 0) {
          setDocs([]);
          setCurrentIdx(0);
          return;
        }
        const mapped = rows.map((r: any) => ({
          id: String(r.id),
          key: r.subagent_key,
          title: r.subagent_key,
          document_url: r.assigned_document_url ?? null,
          storage_path: r.assigned_storage_path ?? null,
          agent_id: r.agent_map_agent_id ?? null,
        }));
        if (!cancelled) {
          setDocs(mapped);
          setCurrentIdx(0);
        }
      } catch (err) {
        console.error("session docs load error", err);
        if (!cancelled) {
          setDocs([]);
          setCurrentIdx(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = docs[currentIdx];
      if (!d) {
        setResolvedUrl("");
        return;
      }
      if (d.document_url) {
        setResolvedUrl(d.document_url);
        return;
      }
      if (d.storage_path) {
        try {
          const res = await fetch('/api/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: d.storage_path, expires: 120 }),
          });
          const j = await res.json();
          if (!cancelled && j?.signedUrl) {
            setResolvedUrl(j.signedUrl);
            return;
          }
        } catch (e) {
          console.warn('failed to fetch signed url', e);
        }
        const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
        setResolvedUrl(`${base}/storage/v1/object/public/docs/${encodeURIComponent(d.storage_path)}`);
        return;
      }
      setResolvedUrl("");
    })();
    return () => { cancelled = true; };
  }, [docs, currentIdx]);

  // Listen for openDocument messages from external tools
  useEffect(() => {
    async function handleMessage(e: MessageEvent | { data: any }) {
      const msg = (e as any).data;
      if (!msg || msg.type !== "elevenlabs.openDocument") return;
      const payload = msg.payload || {};
      const {
        subagent_key,
        key,
        id,
        storage_path,
        agent_map_agent_id,
        document_url,
        title,
      } = payload;

      const lookupKey = (subagent_key ?? key)?.toString?.()?.trim?.();

      // try to find an existing doc by id, key, storage_path, or agent_map_agent_id
      const idx = docs.findIndex((d) =>
        (id && d.id === id) ||
        (lookupKey && d.key === lookupKey) ||
        (storage_path && d.storage_path === storage_path) ||
        (agent_map_agent_id && d.agent_id === agent_map_agent_id)
      );
      if (idx >= 0) {
        setCurrentIdx(idx);
        return;
      }

      // If we were given a subagent_key, try fetching that subagent and its siblings
      if (lookupKey) {
        try {
          const { data: single } = await supabase
            .from("subagents")
            .select("id, subagent_key, assigned_document_url, assigned_storage_path, agent_map_agent_id")
            .eq("subagent_key", lookupKey)
            .maybeSingle();
          if (single) {
            const { data: siblings } = await supabase
              .from("subagents")
              .select("id, subagent_key, assigned_document_url, assigned_storage_path, agent_map_agent_id")
              .eq("agent_map_agent_id", single.agent_map_agent_id)
              .order("created_at", { ascending: true });
            const mapped = (siblings || []).map((r: any) => ({
              id: String(r.id),
              key: r.subagent_key,
              title: r.subagent_key,
              document_url: r.assigned_document_url ?? null,
              storage_path: r.assigned_storage_path ?? null,
              agent_id: r.agent_map_agent_id ?? null,
            }));
            if (mapped.length > 0) {
              setDocs(mapped);
              const startIdx = mapped.findIndex((m) => m.key === lookupKey);
              setCurrentIdx(startIdx >= 0 ? startIdx : 0);
              return;
            }
          }
        } catch (e) {
          console.warn("failed to fetch subagent by key", lookupKey, e);
        }
      }

      // Fallback: append a new external doc entry
      const newDoc: DocItem = {
        id: id ?? String(Date.now()),
        key: lookupKey ?? (document_url ? document_url : storage_path ? storage_path : `external-${Date.now()}`),
        title: title ?? lookupKey ?? "External document",
        document_url: document_url ?? null,
        storage_path: storage_path ?? undefined,
        agent_id: agent_map_agent_id ?? undefined,
      };
      setDocs((prev) => {
        const next = [...prev, newDoc];
        setCurrentIdx(next.length - 1);
        return next;
      });
    }

    window.addEventListener("message", handleMessage as any);
    const bc = new BroadcastChannel("elevenlabs");
    bc.onmessage = (ev) => handleMessage({ data: ev.data } as any);
    return () => {
      window.removeEventListener("message", handleMessage as any);
      bc.close();
    };
  }, [docs, supabase]);

  return (
    <main style={{ minHeight: "100dvh", display: "flex", gap: 0 }}>
      <aside style={{ width: 260, borderRight: "1px solid #e6eefc22", padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Session documents</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {docs.map((d, i) => (
            <li key={d.id} style={{ marginBottom: 8 }}>
              <button
                onClick={() => setCurrentIdx(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: i === currentIdx ? "#16213a" : "transparent",
                  color: i === currentIdx ? "#e6eaff" : "#a3c0ff",
                  border: "1px solid #22325a",
                  padding: "8px 10px",
                  borderRadius: 6,
                }}
              >
                <div style={{ fontWeight: 700 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "#7ea0e6" }}>{d.key}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section style={{ flex: 1, position: "relative", background: "#f0f0f0" }}>
        <div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}>Prev</button>
            <button onClick={() => setCurrentIdx((i) => Math.min(docs.length - 1, i + 1))}>Next</button>
            <div style={{ marginLeft: 12, fontWeight: 700 }}>{docs[currentIdx]?.title ?? "No document"}</div>
          </div>
          <div style={{ marginLeft: 12 }}>
            {/* (button moved to fixed overlay) */}
          </div>
        </div>

        <div style={{ position: "absolute", inset: 0 }}>
          {resolvedUrl ? (
            <PDFJSViewer file={resolvedUrl} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
              <div style={{ color: "#6b7280" }}>{docs.length ? "No preview available" : "No documents"}</div>
            </div>
          )}
        </div>
      </section>
      {/* Fixed talk button overlay (bottom-right) */}
      <div
        style={{
          position: "fixed",
          bottom: "max(12px, env(safe-area-inset-bottom))",
          right: "max(12px, env(safe-area-inset-right))",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <DialogueBarTalkButton
            agentId={docs[currentIdx]?.agent_id || docs[currentIdx]?.key || ""}
            useSignedUrl={true}
            title={docs[currentIdx]?.title}
          />
        </div>
      </div>
    </main>
  );
}
