"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function PersonaTopbarSlot({
  personaName,
  profileImage,
}: {
  personaName?: string | null;
  profileImage?: string | null;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = document.getElementById("topbar-center-slot");
    setContainer(node);
  }, []);

  if (!container || (!personaName && !profileImage)) {
    return null;
  }

  return createPortal(
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "6px 12px",
        borderRadius: 999,
        color: "#0f172a",
        fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
        fontWeight: 600,
      }}
    >
      {profileImage ? (
        <img
          src={profileImage}
          alt={personaName ? `${personaName} profile portrait` : "Persona profile"}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid rgba(15, 23, 42, 0.12)",
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
          }}
        />
      ) : null}
      {personaName ? (
        <span style={{ fontSize: 18, lineHeight: 1 }}>{personaName}</span>
      ) : null}
    </div>,
    container
  );
}
