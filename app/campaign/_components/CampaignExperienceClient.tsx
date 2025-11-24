"use client";
import CampaignPrepAgent from "@/app/campaign/_components/CampaignPrepAgent";

export type CampaignExperienceData = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  imageUrl: string | null;
  agentId: string;
  personaId: string | null;
  clientName: string | null;
  questions: string[];
  outputs: Array<{ type: "string" | "boolean" | "number"; description: string }>;
  outcomes: string[];
};

export default function CampaignExperienceClient({
  campaign,
}: {
  campaign: CampaignExperienceData;
}) {
  const {
    id,
    agentId,
    imageUrl,
    personaId,
    outcomes,
  } = campaign;
  const hasOutcomes = outcomes.length > 0;
  const heroMinHeight = "max(420px, calc(100dvh - 180px))";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg,#f8fbff 0%,#ffffff 32%,#eef2ff 100%)",
        padding: "60px 24px 120px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
          flex: "1 1 auto",
          width: "100%",
        }}
      >
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: heroMinHeight,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
            }}
          >
            <CampaignPrepAgent
              agentId={agentId}
              campaignId={id}
              personaId={personaId ?? undefined}
              profileImage={imageUrl ?? null}
              talkLabel="Start live interview"
              allowVoiceSelection={false}
              showVoiceControls={false}
              useSignedUrl
            />
          </div>
        </section>

        {hasOutcomes ? (
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
