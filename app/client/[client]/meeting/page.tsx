"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import ExecutiveAgent from "@/app/components/BriefingAgent";
import { supabase } from "@/app/lib/supabaseClient";

type AgentMeta = {
  agent_id: string;
  agent_name?: string | null;
  talk_label?: string | null;
  region?: "us" | "eu-residency" | "in-residency" | "global" | null;
  auth?: string | null;
};

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function MeetingPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [agentMeta, setAgentMeta] = useState<AgentMeta | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgent() {
      if (!clientSlug) return;
      setLoadingAgent(true);
      setAgentError(null);
      try {
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id")
          .eq("name", clientSlug)
          .single();
        if (clientError || !client) {
          setAgentError("Client not found");
          setLoadingAgent(false);
          return;
        }
        const { data: agentRows, error: agentError } = await supabase
          .from("agent_map")
          .select("agent_id, agent_name, talk_label, region, auth, status")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false });
        if (agentError) {
          setAgentError("Unable to load audio agent");
        } else {
          const firstReady =
            agentRows?.find((row: any) => row.status === "Ready") ??
            agentRows?.[0];
          setAgentMeta(
            firstReady
              ? {
                  agent_id: firstReady.agent_id,
                  agent_name: firstReady.agent_name,
                  talk_label: firstReady.talk_label,
                  region: firstReady.region,
                  auth: firstReady.auth,
                }
              : null
          );
        }
      } finally {
        setLoadingAgent(false);
      }
    }
    fetchAgent();
  }, [clientSlug]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0a1628",
        fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div className="meeting-shell">
        <header className="meeting-header">
          <div>
            <p className="eyebrow">Call Dialogue</p>
          </div>
          <div className="header-pill">
            <span className="dot" />
            Connected
          </div>
        </header>

        <section className="call-stage">
          <div className="call-agent">
            <div className="call-copy">
              <h1>Speak to Dialogue</h1>
              <p>Call to update your priorities or discuss meetings.</p>
            </div>
            {agentError && (
              <div className="agent-error">
                <strong>Heads up:</strong> {agentError}
              </div>
            )}
            {!agentError && !agentMeta?.agent_id && (
              <div className="agent-loading">
                {loadingAgent ? "Loading agent…" : "No dialogue agent available yet."}
              </div>
            )}
            {agentMeta?.agent_id && (
              <ExecutiveAgent
                agentId={agentMeta.agent_id}
                serverLocation={agentMeta.region ?? "us"}
                talkLabel={agentMeta.talk_label ?? "Start call"}
              />
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        .meeting-shell {
          flex: 1;
          background: radial-gradient(circle at top, rgba(102, 153, 255, 0.2), transparent 55%),
            #16213a;
          border-radius: 16px;
          margin: 24px;
          padding: 40px;
          color: #e6eaff;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 32px;
          min-height: calc(100dvh - 48px);
        }
        .meeting-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(44, 182, 255, 0.12), transparent 55%);
          pointer-events: none;
        }
        .meeting-header {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 11px;
          color: #7ea0e6;
          margin: 0 0 8px 0;
        }
        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          color: #F6F7F9fff;
        }
        .subtext {
          margin-top: 8px;
          color: #a8b8e2;
          max-width: 640px;
          line-height: 1.5;
        }
        .header-pill {
          background: rgba(14, 30, 52, 0.75);
          border: 1px solid rgba(126, 160, 230, 0.3);
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #9fd0ff;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #64ffa1;
          box-shadow: 0 0 10px rgba(100, 255, 161, 0.8);
          display: inline-flex;
        }
        .call-stage {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          padding: 12px 0 36px;
        }
        .call-agent {
          width: min(920px, 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }
        .call-copy {
          text-align: center;
          margin-bottom: 8px;
        }
        .call-copy h1 {
          margin: 0;
          font-size: clamp(26px, 3.4vw, 42px);
          font-weight: 800;
          color: #F6F7F9fff;
        }
        .call-copy p {
          margin-top: 10px;
          color: #b6c5ff;
          font-size: 16px;
        }
        .agent-error,
        .agent-loading {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 16px;
          color: #ffb4b4;
          font-size: 14px;
          border: 1px solid rgba(255, 180, 180, 0.2);
        }
        .agent-loading {
          color: #a3c0ff;
          border-color: rgba(126, 160, 230, 0.2);
        }
        @media (max-width: 900px) {
          .meeting-shell {
            padding: 32px 20px 120px;
            margin: 16px;
          }
          .meeting-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .call-stage {
            padding: 8px 0 24px;
          }
        }
      `}</style>
    </main>
  );
}
