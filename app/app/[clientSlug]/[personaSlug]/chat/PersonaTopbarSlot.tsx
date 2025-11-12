"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type PersonaPreview = {
  id: string;
  slug: string;
  name: string;
  profileImage: string | null;
  href?: string;
};

export default function PersonaTopbarSlot({
  personaName,
  profileImage,
  personaHref,
  otherPersonas,
}: {
  personaName?: string | null;
  profileImage?: string | null;
  personaHref?: string;
  otherPersonas?: PersonaPreview[];
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const node = document.getElementById("topbar-center-slot");
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  if (!container || (!personaName && !profileImage)) {
    return null;
  }

  function handleNavigate() {
    if (!personaHref) return;
    setMenuOpen(false);
    router.push(personaHref);
  }

  function handlePersonaSelect(targetHref?: string) {
    if (!targetHref) return;
    setMenuOpen(false);
    router.push(targetHref);
  }

  return createPortal(
    <div
      ref={rootRef}
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
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={handleNavigate}
        disabled={!personaHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: personaHref ? "pointer" : "default",
          color: "inherit",
          fontFamily: "inherit",
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
        ) : personaName ? (
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#0f172a",
              color: "#f8fafc",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {extractInitials(personaName)}
          </span>
        ) : null}
        {personaName ? (
          <span style={{ fontSize: 18, lineHeight: 1 }}>{personaName}</span>
        ) : null}
      </button>
      {otherPersonas && otherPersonas.length > 0 ? (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{
            border: "none",
            background: "transparent",
            color: "#0f172a",
            borderRadius: 999,
            padding: "4px 10px",
            marginLeft: 8,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            boxShadow: menuOpen ? "0 8px 20px rgba(15, 23, 42, 0.14)" : "none",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              height: 18,
              width: 34,
            }}
          >
            {otherPersonas
              .slice(0, 3)
              .map((persona, index) => {
                const left = index * 10;
                const background = persona.profileImage
                  ? undefined
                  : "rgba(15, 23, 42, 0.28)";
                return (
                  <span
                    key={persona.id}
                    style={{
                      position: "absolute",
                      left,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1px solid rgba(15, 23, 42, 0.45)",
                      overflow: "hidden",
                      background,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#f8fafc",
                    }}
                  >
                    {persona.profileImage ? (
                      <img
                        src={persona.profileImage}
                        alt={persona.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      extractInitials(persona.name)
                    )}
                  </span>
                );
              })}
          </span>
          <span aria-hidden="true" style={{ fontSize: 10 }}>{menuOpen ? "▲" : "▼"}</span>
        </button>
      ) : null}
      {menuOpen && otherPersonas && otherPersonas.length > 0 ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            minWidth: 220,
            borderRadius: 20,
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: "#ffffff",
            boxShadow: "0 20px 45px rgba(15, 23, 42, 0.18)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            zIndex: 20,
          }}
        >
          {otherPersonas.map((persona) => (
            <button
              key={persona.id}
              role="option"
              aria-selected="false"
              type="button"
              onClick={() => handlePersonaSelect(persona.href)}
              style={{
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 14,
                padding: "8px 10px",
                background: "rgba(248, 250, 252, 0.8)",
                color: "#0f172a",
                fontSize: 14,
                fontWeight: 600,
                cursor: persona.href ? "pointer" : "default",
                textAlign: "left",
                width: "100%",
              }}
            >
              {persona.profileImage ? (
                <img
                  src={persona.profileImage}
                  alt={`${persona.name} portrait`}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                  }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#0f172a",
                    color: "#f8fafc",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {extractInitials(persona.name)}
                </span>
              )}
              <span>{persona.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    container
  );
}

function extractInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => segment.trim().charAt(0).toUpperCase())
    .join("")
    .slice(0, 2) || "P";
}
