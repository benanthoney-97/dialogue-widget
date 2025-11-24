"use client";

type InternalPersonaChipProps = {
  isToggled: boolean;
  onToggleAction: () => void;
};

export default function InternalPersonaChip({ isToggled, onToggleAction }: InternalPersonaChipProps) {
  const label = isToggled ? "Customer Personas" : "Internal Personas";

  return (
    <button
      type="button"
      onClick={onToggleAction}
      style={{
        borderRadius: 999,
        border: "1px solid rgba(15, 23, 42, 0.18)",
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 600,
        background: "rgba(248, 250, 252, 0.9)",
        color: "#0f172a",
        marginRight: 40,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
