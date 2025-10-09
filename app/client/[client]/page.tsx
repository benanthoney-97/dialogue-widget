"use client";

import { useMemo, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";

import DialogueText from "@/app/components/DialogueText";
import {
  clientMap,
  getClientAgentId,
  getClientDataPath,
  getClientReports,
} from "@/app/lib/clientMap";
import { docMap } from "@/app/lib/docMap";

export default function ClientInsightsChat() {
  const { client } = useParams<{ client: string }>();
  const searchParams = useSearchParams();

  const entry = client ? clientMap[client] : undefined;
  const reports = useMemo(() => (client ? getClientReports(client) : []), [client]);
  const queryAgentId = searchParams?.get("agentId") ?? "";
  const clientAgentId = queryAgentId || (client ? getClientAgentId(client) ?? "" : "");

  if (!client || !entry) {
    return (
      <FallbackState
        title="Unknown client"
        description={
          <>
            <strong>Unknown client slug:</strong> <code>{client ?? "—"}</code>
          </>
        }
      />
    );
  }

  if (!clientAgentId) {
    return (
      <FallbackState
        title={`${entry.displayName} has no insights agent configured`}
        description={
          <>
            Add <code>clientAgentId</code> to <code>clientMap</code> or pass <code>?agentId=</code>.
          </>
        }
      />
    );
  }

  const dataFeedUrl = getClientDataPath(client);
  const associatedLabels = reports
    .map(({ slug, doc }) => doc?.talkLabel || doc?.pdfPath || slug)
    .filter(Boolean);

  const primaryDoc = entry.slugKeys[0];
  const serverLocation = (primaryDoc && docMap[primaryDoc]?.region) || "us";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0b1220",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.18)",
          background: "linear-gradient(135deg, rgba(11,18,32,0.92), rgba(30,58,138,0.55))",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
          {entry.displayName} Customer Insights
        </h1>
        {entry.description ? (
          <p
            style={{
              margin: "8px 0 0",
              color: "rgba(226, 232, 240, 0.78)",
              maxWidth: 660,
              lineHeight: 1.5,
            }}
          >
            {entry.description}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
            color: "rgba(226, 232, 240, 0.65)",
          }}
        >
          <span>
            <strong>Insights agent:</strong> <code>{clientAgentId}</code>
          </span>
          <span>
            <strong>Knowledge feed:</strong>{" "}
            <a
              href={dataFeedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#38bdf8", textDecoration: "none" }}
            >
              {dataFeedUrl}
            </a>
          </span>
          {associatedLabels.length ? (
            <span>
              <strong>Customer agents:</strong> {associatedLabels.join(", ")}
            </span>
          ) : null}
        </div>
      </header>

      <div
        style={{
          flex: "1 1 auto",
          padding: "30px clamp(16px, 4vw, 48px)",
          display: "grid",
          placeItems: "center",
          background: "radial-gradient(circle at top, rgba(37, 99, 235, 0.22), transparent 60%)",
        }}
      >
        <div
          style={{
            width: "min(960px, 96vw)",
            background: "rgba(15, 23, 42, 0.92)",
            borderRadius: 24,
            boxShadow: "0 24px 48px rgba(7, 11, 23, 0.65)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            overflow: "hidden",
          }}
        >
          <DialogueText
            agentId={clientAgentId}
            useSignedUrl
            serverLocation={serverLocation}
            title="Customer Engagement Assistant"
          />
        </div>
      </div>
    </main>
  );
}

function FallbackState({ title, description }: { title: string; description: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0f172a",
      }}
    >
      <div
        style={{
          padding: 24,
          borderRadius: 16,
          background: "#111827",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          maxWidth: 520,
          textAlign: "center",
          color: "#e2e8f0",
          lineHeight: 1.6,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div>{description}</div>
      </div>
    </main>
  );
}
