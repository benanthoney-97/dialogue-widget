import React, { useState } from "react";

type ChipStyle = { bg: string; color: string; border: string };

export const defaultChipStyleMap: Record<string, ChipStyle> = {
  Personal: {
    bg: "rgba(59,130,246,0.08)",
    color: "#3b82f6",
    border: "1px solid rgba(59,130,246,0.12)",
  },
  Team: {
    bg: "rgba(34,197,94,0.08)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.12)",
  },
  Client: {
    bg: "rgba(249,115,22,0.08)",
    color: "#f97316",
    border: "1px solid rgba(249,115,22,0.12)",
  },
  Placeholder: {
    bg: "rgba(139,92,246,0.06)",
    color: "#8b5cf6",
    border: "1px solid rgba(139,92,246,0.10)",
  },
  Purpose: {
    bg: "rgba(20,184,166,0.08)",
    color: "#14b8a6",
    border: "1px solid rgba(20,184,166,0.12)",
  },
};

const guidanceOptions = [
  {
    title: "Add my data",
    subtitle: "Upload unlimited persona documents and links",
    chip: "Internal",
  },
  {
    title: "Describe persona",
    subtitle: "Start from scratch with a vision of your target audience",
    chip: "Team",
  },
] as const;

type GuidanceKey = (typeof guidanceOptions)[number]["title"];

type PurposeCardProps = {
  guidanceTexts: Record<string, string>;
  selectedGuidance: string | null;
  purposeText: string;
  onSelectGuidance: (key: GuidanceKey, purpose: string | null, audienceType: string) => void;
  onCustomFocus: () => void;
  onPurposeChange: (value: string) => void;
  onPurposeBlur?: () => void | Promise<void>;
  onNext: () => void | Promise<void>;
  nextDisabled: boolean;
  saving: boolean;
  nextLabel?: string;
  chipStyleMap?: Record<string, ChipStyle>;
  headingText?: string;
  subheadingText?: string;
};

export default function PurposeCard({
  guidanceTexts,
  selectedGuidance,
  purposeText,
  onSelectGuidance,
  onCustomFocus,
  onPurposeChange,
  onPurposeBlur,
  onNext,
  nextDisabled,
  saving,
  nextLabel = "Next",
  chipStyleMap = defaultChipStyleMap,
  headingText = "How are you creating your persona?",
  subheadingText = "Choose or describe what type of pitch you're preparing for",
}: PurposeCardProps) {
  const [hoveredGuidance, setHoveredGuidance] = useState<GuidanceKey | null>(null);

  return (
    <>
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 0 }}>{headingText}</div>
  {/* subheading intentionally removed */}
  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingTop: 12, paddingBottom: 6 }}>
      {guidanceOptions.map((item, idx) => {
        const label = item.chip ?? "Placeholder";
        const style = chipStyleMap[label] ?? chipStyleMap.Placeholder;
        const active = selectedGuidance === item.title;
        const hovered = hoveredGuidance === item.title;

        return (
          <React.Fragment key={item.title}>
          <div
            onClick={() => {
              onSelectGuidance(item.title, guidanceTexts[item.title] ?? null, label);
            }}
            onMouseEnter={() => setHoveredGuidance(item.title)}
            onMouseLeave={() => setHoveredGuidance(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectGuidance(item.title, guidanceTexts[item.title] ?? null, label);
            }}
    style={{
      /* fixed small width so cards line up horizontally under the heading */
      flex: '0 0 160px',
      minWidth: 120,
      maxWidth: 220,
      aspectRatio: '1 / 1',
      background: '#f4f8ff',
      borderRadius: 10,
      padding: 12,
      border: active
        ? '1.5px solid rgba(30,41,59,0.5)'
        : '1.5px solid rgba(30,41,59,0.42)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      position: 'relative',
      cursor: 'pointer',
      boxShadow: 'none',
      transition: 'border 140ms ease',
        }}
          >
            {(label !== 'Internal' && label !== 'Team') ? (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: style.bg,
                  color: style.color,
                  border: style.border,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  height: 20,
                  lineHeight: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {label}
              </div>
            ) : null}
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", textAlign: 'center' }}>{item.title}</div>
          </div>
          {idx < guidanceOptions.length - 1 ? (
            <div style={{ alignSelf: 'center', margin: '0 6px', color: '#1e293b', fontWeight: 700, fontSize: 13 }} aria-hidden>
              or
            </div>
          ) : null}
          </React.Fragment>
        );
  })}
  </div>

      {/* custom freeform input removed per design: no textarea or 'Custom' chip */}

      {/* action button removed by design */}
    </>
  );
}
