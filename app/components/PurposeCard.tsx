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
    title: "Prepare",
    subtitle: "Prepare for presentations, seminars and meetings using all the documents you’ll need.",
    chip: "Personal",
  },
  {
    title: "Learn",
    subtitle: "Master complex topics across multiple documents.",
    chip: "Personal",
  },
  {
    title: "Review",
    subtitle: "Send documents to teammates for in-depth audio-led review.",
    chip: "Team",
  },
  {
    title: "Go-to-market",
    subtitle: "Send documents to clients and gather valuable insights.",
    chip: "Client",
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
  headingText = "What do you want to do?",
  subheadingText = "Choose or describe a goal for your Dialogue.",
}: PurposeCardProps) {
  const [hoveredGuidance, setHoveredGuidance] = useState<GuidanceKey | null>(null);

  return (
    <>
      <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#e6eaff", marginBottom: 0 }}>{headingText}</div>
      <div style={{ textAlign: "center", fontSize: 13, color: "#9fb3ff", marginBottom: 4, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
        {subheadingText}
      </div>
      {guidanceOptions.map((item) => {
        const label = item.chip ?? "Placeholder";
        const style = chipStyleMap[label] ?? chipStyleMap.Placeholder;
        const active = selectedGuidance === item.title;
        const hovered = hoveredGuidance === item.title;

        return (
          <div
            key={item.title}
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
              width: "100%",
              background: active ? "#122a48" : hovered ? "#0f1f36" : "#101931",
              borderRadius: 10,
              padding: 12,
              border: active ? "1px solid rgba(126,160,230,0.26)" : "1px solid rgba(34,50,90,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "relative",
              cursor: "pointer",
              boxShadow: active ? "0 10px 30px rgba(30,60,110,0.26)" : undefined,
              transition: "background 140ms ease, border 140ms ease, box-shadow 160ms ease",
            }}
          >
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
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e6eaff" }}>{item.title}</div>
            <div style={{ fontSize: 13, color: "#9bb5ff", lineHeight: 1.5 }}>{item.subtitle}</div>
          </div>
        );
      })}

      <div style={{ position: "relative", width: "100%" }}>
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 5,
            background: chipStyleMap.Purpose.bg,
            color: chipStyleMap.Purpose.color,
            border: chipStyleMap.Purpose.border,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Custom
        </div>
        <textarea
          placeholder="Describe your own goal..."
          value={purposeText}
          onChange={(e) => {
            onPurposeChange(e.target.value);
          }}
          onFocus={() => {
            onCustomFocus();
          }}
          onBlur={() => {
            if (onPurposeBlur) {
              void onPurposeBlur();
            }
          }}
          style={{
            width: "100%",
            minHeight: 96,
            borderRadius: 8,
            padding: "12px",
            background: "#0f1a33",
            color: "#e6eaff",
            border: "1px solid #22325a",
          }}
        />
      </div>

      <div style={{ width: "100%", marginTop: 0 }}>
        <button
          type="button"
          onClick={async () => {
            await onNext();
          }}
          disabled={nextDisabled}
          style={{
            width: "100%",
            padding: "10px 18px",
            borderRadius: 8,
            background: nextDisabled ? "#2d406b" : "#525fe1",
            color: "#fff",
            border: "none",
            fontWeight: 700,
            opacity: nextDisabled ? 0.75 : 1,
            cursor: nextDisabled ? "not-allowed" : "pointer",
            transition: "background 120ms, opacity 120ms",
          }}
        >
          {saving ? "Saving..." : nextLabel}
        </button>
      </div>
    </>
  );
}
