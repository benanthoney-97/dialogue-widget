"use client";

import type { CSSProperties } from "react";

export type PersonaDetailShellProps = {
  clientSlug: string;
  personaSlug: string;
};

export default function PersonaDetailShell({ clientSlug, personaSlug }: PersonaDetailShellProps) {
  const placeholderStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    borderRadius: 16,
    border: "1px dashed rgba(148,163,184,0.6)",
    background: "rgba(226,232,240,0.25)",
    color: "#475569",
    fontSize: 16,
    fontWeight: 600,
  };

  return (
    <div style={placeholderStyle}>
      Persona details placeholder for {clientSlug}/{personaSlug}
    </div>
  );
}
