export { default } from "@/app/campaign/_components/CampaignExperienceClient";
export type { CampaignExperienceData } from "@/app/campaign/_components/CampaignExperienceClient";

/* Legacy location retained temporarily for IDE stability. Remove once callers update imports.
"use client";

import Image from "next/image";
import DialogueBarTalkOnly from "@/app/components/DialogueBarTalkOnly";

export type CampaignExperienceData = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  imageUrl: string | null;
  agentId: string;
  clientName: string | null;
  questions: string[];
  outputs: Array<{ type: "string" | "boolean" | "number"; description: string }>;
  outcomes: string[];
};

const FALLBACK_CAMPAIGN_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIGZpbGw9IiNFNUVBRkYiIHJ4PSIyMCIvPjxjaXJjbGUgY3g9IjQ4IiBjeT0iNDgiIHI9IjIwIiBmaWxsPSIjQ0RERUYyIi8+PHBhdGggZD0iTTQ4IDM2YTIgMiAwIDEgMSAwLTQgMiAyIDAgMCAxIDAgNCIgZmlsbD0iIzhCRURGRiIvPjxwYXRoIGQ9Ik00OCA0M2MtNi4xNzYgMC0xMSAyLjk4Ni0xMSA2LjY2NXY1LjMzQzM3IDU5LjY2NyA0MS44MjQgNjIuNjUzIDQ4IDYyLjY1M2M2LjE3NiAwIDExLTMuMDA2IDExLTYuNjUzdi01LjMzQzU5IDQ1Ljk4NiA1NC4xNzYgNDMgNDggNDN6IiBmaWxsPSIjOThCQ0ZGIi8+PC9zdmc+";

const OUTPUT_TYPE_LABELS: Record<"string" | "boolean" | "number", string> = {
  string: "Text",
  boolean: "Yes / No",
  number: "Numeric",
};

function formatOutputType(type: "string" | "boolean" | "number"): string {
  return OUTPUT_TYPE_LABELS[type] ?? "Text";
}

export default function CampaignExperienceClient({
  campaign,
}: {
  campaign: CampaignExperienceData;
}) {
  const {
    name,
    description,
    objective,
    imageUrl,
    agentId,
    clientName,
    questions,
    outputs,
    outcomes,
  } = campaign;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg,#f8fbff 0%,#ffffff 32%,#eef2ff 100%)",
        padding: "60px 24px 120px",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <header
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "24px 28px",
            borderRadius: 28,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
              flexShrink: 0,
            }}
          >
            <Image
              src={imageUrl ?? FALLBACK_CAMPAIGN_IMAGE}
              alt={name}
              width={96}
              height={96}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              unoptimized
              priority
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(15,23,42,0.55)",
                fontWeight: 600,
              }}
            >
              {clientName ? `${clientName} campaign` : "Campaign"}
            </p>
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {name}
            </h1>
            {description ? (
              <p style={{ margin: 0, fontSize: 16, color: "rgba(15,23,42,0.75)", lineHeight: 1.6 }}>
                {description}
              </p>
            ) : null}
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              padding: "32px 28px",
              borderRadius: 28,
              background: "#050d25",
              color: "#e6edff",
              minHeight: 420,
              display: "flex",
              flexDirection: "column",
              gap: 24,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at top left, rgba(255,255,255,0.12), transparent 60%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <p
                style={{
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.65)",
                  fontWeight: 600,
                }}
              >
                Live research agent
              </p>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Talk to this campaign</h2>
              <p style={{ margin: 0, color: "rgba(230,237,255,0.8)", lineHeight: 1.6, fontSize: 16 }}>
                Start a real-time conversation powered by ElevenLabs. Grant mic access and ask anything about this
                campaign's objective, briefings, or expected outcomes.
              </p>
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>
              <DialogueBarTalkOnly agentId={agentId} buttonColor="#93c5fd" buttonTextColor="#082343" />
            </div>
          </div>

          <div
            style={{
              padding: "28px",
              borderRadius: 28,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#0f172a" }}>Objective</h3>
              <p style={{ margin: 0, fontSize: 15, color: "rgba(15,23,42,0.75)", lineHeight: 1.6 }}>
                {objective ?? "Add an objective in Dialogue to describe what this campaign explores."}
              </p>
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#0f172a" }}>Key questions</h3>
              {questions.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  {questions.map((question) => (
                    <li key={question} style={{ color: "rgba(15,23,42,0.78)", fontSize: 15, lineHeight: 1.5 }}>
                      {question}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "rgba(15,23,42,0.55)", fontSize: 15 }}>
                  No structured questions yet. Recordings can still capture free-form insight.
                </p>
              )}
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: 18, color: "#0f172a" }}>Expected outputs</h3>
              {outputs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {outputs.map((output, index) => (
                    <div
                      key={`${output.description}-${index}`}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: "1px solid rgba(15,23,42,0.08)",
                        background: "rgba(248,249,255,0.9)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: "rgba(15,23,42,0.7)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "2px 10px",
                            borderRadius: "999px",
                            background: "rgba(15,118,255,0.12)",
                            color: "#0f76ff",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {formatOutputType(output.type)}
                        </span>
                        {output.description}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "rgba(15,23,42,0.55)", fontSize: 15 }}>
                  No structured outputs selected yet. Enable them in Dialogue to capture comparable data.
                </p>
              )}
            </div>
          </div>
        </section>

        {outcomes.length > 0 ? (
          <section
            style={{
              padding: "28px",
              borderRadius: 28,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(15,23,42,0.06)",
              boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 20, color: "#0f172a" }}>Success signals</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {outcomes.map((outcome, index) => (
                <div
                  key={`${outcome}-${index}`}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 999,
                    background: "#050d25",
                    color: "#e6edff",
                    fontSize: 14,
                  }}
                >
                  {outcome}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

*/
