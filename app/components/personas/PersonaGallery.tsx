"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { slugify } from "@/app/lib/jump";
import { createPortal } from "react-dom";

export type PersonaSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  keyTraits: string[];
  contentType: string | null;
  updatedAt: string | null;
  attributes: Array<{ label: string; value: string }>;
  profileImage: string | null;
  painPoints: string[];
};

type PersonaGalleryProps = {
  clientSlug: string;
  personas: PersonaSummary[];
  emptyMessage?: string;
  errorMessage?: string | null;
};

export default function PersonaGallery({
  clientSlug,
  personas,
  emptyMessage = "No personas are published yet.",
  errorMessage = null,
}: PersonaGalleryProps) {
  const [expandedPersona, setExpandedPersona] = useState<PersonaSummary | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleOpen = useCallback((persona: PersonaSummary) => {
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        lastFocusedRef.current = activeElement;
      }
    }
    setExpandedPersona(persona);
  }, []);

  const handleClose = useCallback(() => {
    setExpandedPersona(null);
  }, []);

  useEffect(() => {
    if (!expandedPersona) return undefined;
    if (typeof document === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key === "Tab") {
        const container = overlayRef.current;
        if (!container) return;
        const focusable = container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      const previousFocus = lastFocusedRef.current;
      if (previousFocus) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [expandedPersona, handleClose]);

  const formattedUpdatedAt = useMemo(() => formatUpdatedAt(expandedPersona?.updatedAt ?? null), [
    expandedPersona?.updatedAt,
  ]);
  const personaSegment = expandedPersona ? getPersonaSegment(expandedPersona) : null;

  if (errorMessage) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(239,68,68,0.35)",
          background: "rgba(239,68,68,0.08)",
          padding: 20,
          color: "#b91c1c",
          fontWeight: 600,
        }}
      >
        {errorMessage}
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div
        style={{
          borderRadius: 16,
          border: "1px dashed rgba(148,163,184,0.6)",
          background: "rgba(226,232,240,0.25)",
          padding: 32,
          color: "#475569",
          textAlign: "center",
          fontSize: 16,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 24,
          width: "100%",
          fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
          flex: 1,
          minHeight: "100%",
          alignContent: "start",
          paddingTop: 8,
        }}
        aria-label="Published personas"
      >
        {personas.map((persona) => {
          const hasProfileImage = Boolean(persona.profileImage);
          const primaryTextColor = hasProfileImage ? "#f8fafc" : "#0f172a";
          const badgeBackground = hasProfileImage ? "rgba(255,255,255,0.22)" : "rgba(37,99,235,0.08)";
          const badgeTextColor = hasProfileImage ? "#f1f5f9" : "#1d4ed8";
          const attributeChipBackground = hasProfileImage
            ? "rgba(15,23,42,0.38)"
            : "rgba(15,23,42,0.05)";
          const attributeChipText = hasProfileImage ? "#f1f5f9" : "#334155";
          const baseBoxShadow = hasProfileImage
            ? "0 16px 38px rgba(15,23,42,0.18)"
            : "0 14px 32px rgba(15,23,42,0.06)";
          const hoverBoxShadow = hasProfileImage
            ? "0 22px 52px rgba(15,23,42,0.32)"
            : "0 20px 44px rgba(15,23,42,0.12)";
          const hoverTransform = "translateY(-4px) scale(1.015)";

          return (
            <button
              key={persona.id}
              type="button"
              aria-label={`View details for ${persona.name}`}
              aria-haspopup="dialog"
              onClick={() => handleOpen(persona)}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                margin: 0,
                textAlign: "left",
                cursor: "pointer",
                width: "100%",
                display: "block",
              }}
            >
              <article
                style={{
                  background: hasProfileImage
                    ? `linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.6) 42%, rgba(15,23,42,0.38) 100%), url(${persona.profileImage})`
                    : "#ffffff",
                  backgroundSize: hasProfileImage ? "cover" : undefined,
                  backgroundPosition: hasProfileImage ? "center" : undefined,
                  backgroundRepeat: hasProfileImage ? "no-repeat" : undefined,
                  borderRadius: 18,
                  border: hasProfileImage
                    ? "1px solid rgba(15,23,42,0.22)"
                    : "1px solid rgba(15,23,42,0.06)",
                  boxShadow: baseBoxShadow,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: 20,
                  position: "relative",
                  aspectRatio: "3 / 4",
                  minHeight: 300,
                  overflow: "hidden",
                  color: primaryTextColor,
                  transform: "translateY(0)",
                  transition: "transform 150ms ease, box-shadow 150ms ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = hoverTransform;
                  event.currentTarget.style.boxShadow = hoverBoxShadow;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                  event.currentTarget.style.boxShadow = baseBoxShadow;
                }}
                onFocus={(event) => {
                  event.currentTarget.style.transform = hoverTransform;
                  event.currentTarget.style.boxShadow = hoverBoxShadow;
                }}
                onBlur={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                  event.currentTarget.style.boxShadow = baseBoxShadow;
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: primaryTextColor,
                    }}
                  >
                    {persona.name}
                  </h2>
                  {persona.contentType ? (
                    <span
                      style={{
                        alignSelf: "flex-start",
                        background: badgeBackground,
                        borderRadius: 999,
                        color: badgeTextColor,
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                        padding: "4px 10px",
                        textTransform: "uppercase",
                      }}
                    >
                      {persona.contentType}
                    </span>
                  ) : null}
                </div>
                {persona.attributes.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: "auto",
                    }}
                  >
                    {persona.attributes.map((attribute) => (
                      <span
                        key={`${persona.id}-${attribute.label}`}
                        style={{
                          background: attributeChipBackground,
                          borderRadius: 999,
                          padding: "6px 12px",
                          fontSize: 13,
                          fontWeight: 500,
                          color: attributeChipText,
                          border: hasProfileImage
                            ? "1px solid rgba(248,250,252,0.25)"
                            : "1px solid rgba(148,163,184,0.35)",
                        }}
                      >
                        {attribute.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            </button>
          );
        })}
      </section>

      {expandedPersona && isMounted
        ? createPortal(
            <div
              ref={overlayRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${expandedPersona.name} persona details`}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.68)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                zIndex: 200,
              }}
              onClick={handleClose}
            >
              <div
                style={{
                  width: "min(640px, 96vw)",
                  background: "#ffffff",
                  borderRadius: 20,
                  boxShadow: "0 28px 80px rgba(15,23,42,0.32)",
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  height: "min(720px, 90vh)",
                  maxHeight: "min(720px, 90vh)",
                  fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <div
                  style={{
                    position: "relative",
                    background: expandedPersona.profileImage
                      ? "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.75) 40%, rgba(15,23,42,0.6) 100%)"
                      : "linear-gradient(140deg, #f8fafc, #e2e8f0)",
                    color: expandedPersona.profileImage ? "#f8fafc" : "#0f172a",
                    padding: "36px 32px 48px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={handleClose}
                    aria-label="Close persona details"
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      border: "none",
                      background: expandedPersona.profileImage
                        ? "rgba(15,23,42,0.45)"
                        : "rgba(148,163,184,0.35)",
                      color: "inherit",
                      width: 36,
                      height: 36,
                      borderRadius: "999px",
                      cursor: "pointer",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                  
                  {expandedPersona.profileImage ? (
                    <span
                      style={{
                        width: 132,
                        height: 132,
                        borderRadius: "999px",
                        overflow: "hidden",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(15,23,42,0.35)",
                        border: "3px solid rgba(255,255,255,0.2)",
                        boxShadow: "0 12px 32px rgba(15,23,42,0.35)",
                      }}
                    >
                      {/* Circle-cropped portrait keeps persona front and centre */}
                      <img
                        src={expandedPersona.profileImage}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </span>
                  ) : null}
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 28,
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.2,
                    }}
                  >
                    {expandedPersona.name}
                  </h2>
                  {expandedPersona.keyTraits.length > 0 ? (
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: expandedPersona.profileImage ? "rgba(248,250,252,0.85)" : "#475569",
                        fontSize: 14,
                        fontWeight: 500,
                        maxWidth: 480,
                      }}
                    >
                      {expandedPersona.keyTraits.join(", ")}
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      marginTop: 16,
                      justifyContent: "center",
                    }}
                  >
                    {ACTION_CHIPS.map(({ label, icon, path }) => {
                      const sharedStyles = {
                        background: expandedPersona.profileImage
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(15,23,42,0.08)",
                        color: expandedPersona.profileImage ? "#f8fafc" : "#0f172a",
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      } as const;

                      if (!personaSegment) {
                        return (
                          <span
                            key={label}
                            style={{ ...sharedStyles, opacity: 0.6, cursor: "not-allowed" }}
                            aria-disabled="true"
                          >
                            <span aria-hidden="true" style={{ display: "inline-flex" }}>
                              {icon}
                            </span>
                            {label}
                          </span>
                        );
                      }

                      return (
                        <Link
                          key={label}
                          href={`/app/${clientSlug}/${personaSegment}/${path}`}
                          style={{
                            ...sharedStyles,
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                          aria-label={`${label} with ${expandedPersona.name}`}
                        >
                          <span aria-hidden="true" style={{ display: "inline-flex" }}>
                            {icon}
                          </span>
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <div
                  style={{
                    padding: "28px 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    flex: 1,
                    overflowY: "auto",
                  }}
                >
                  {expandedPersona.description ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Description
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "#334155",
                          fontSize: 15,
                          lineHeight: 1.6,
                        }}
                      >
                        {expandedPersona.description}
                      </p>
                    </div>
                  ) : null}
                  {expandedPersona.attributes.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Key Attributes
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        {expandedPersona.attributes.map((attribute) => (
                          <span
                            key={`${expandedPersona.id}-attr-${attribute.label}`}
                            style={{
                              background: "rgba(15,23,42,0.05)",
                              borderRadius: 999,
                              padding: "6px 12px",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#1e293b",
                            }}
                          >
                            {attribute.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {expandedPersona.painPoints.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Pain Points
                      </h3>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 20,
                          color: "#334155",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          fontSize: 15,
                        }}
                      >
                        {expandedPersona.painPoints.map((painPoint) => (
                          <li key={`${expandedPersona.id}-pain-${painPoint}`}>{painPoint}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    {formattedUpdatedAt ? <span>Updated {formattedUpdatedAt}</span> : null}
                    {expandedPersona.contentType ? (
                      <span style={{ color: "#475569" }}>{expandedPersona.contentType}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

const ACTION_CHIPS: Array<{ label: string; icon: ReactNode; path: string }> = [
  {
    label: "Interview",
    path: "interview",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
        <path
          d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14"
          stroke="#c084fc"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
        <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
      </svg>
    ),
  },
  {
    label: "Chat",
    path: "chat",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
        <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
        <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
      </svg>
    ),
  },
  {
    label: "Questionnaire",
    path: "questionnaire",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="6" width="4" height="20" rx="1.6" fill="#7ea0e6" opacity="0.8" />
        <rect x="12" y="2" width="4" height="24" rx="1.6" fill="#93c5fd" />
        <rect x="20" y="10" width="4" height="16" rx="1.6" fill="#60a5fa" opacity="0.9" />
        <rect x="28" y="14" width="4" height="12" rx="1.6" fill="#3b82f6" />
      </svg>
    ),
  },
];

function getPersonaSegment(persona: PersonaSummary): string | null {
  const nameSource = persona.name?.trim() ?? "";
  if (nameSource.length > 0) {
    const byName = slugify(nameSource);
    if (byName.length > 0) return byName;
  }
  if (persona.slug) return persona.slug;
  return null;
}

function formatUpdatedAt(dateString: string | null): string | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
