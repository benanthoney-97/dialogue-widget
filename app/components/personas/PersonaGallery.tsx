"use client";

import type { CSSProperties } from "react";

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
  roleTitle: string | null;
  painPoints: string[];
  customerStatus: string | null;
};

type PersonaGalleryProps = {
  clientSlug: string;
  personas: PersonaSummary[];
  emptyMessage?: string;
  errorMessage?: string | null;
};

export default function PersonaGallery({ clientSlug, personas, emptyMessage = "No personas are published yet.", errorMessage = null }: PersonaGalleryProps) {
  if (errorMessage) {
    return (
      <div style={errorContainerStyle}>
        {errorMessage}
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div style={emptyStateStyle}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <section style={gridStyle} aria-label="Published personas">
      {personas.map((persona) => renderPersonaCard(persona, clientSlug))}
    </section>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 240px))",
  gap: 16,
  width: "100%",
  justifyContent: "center",
  justifyItems: "center",
  flex: 1,
  minHeight: "100%",
  alignContent: "start",
  padding: "8px 12px 0",
  boxSizing: "border-box",
};

const errorContainerStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.08)",
  padding: 20,
  color: "#b91c1c",
  fontWeight: 600,
};

const emptyStateStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  flex: 1,
  width: "100%",
  minHeight: "100%",
  padding: 32,
  color: "#475569",
  textAlign: "center",
  fontSize: 16,
};

const CHIPS_PER_ROW = 3;
const MAX_CHIP_ROWS = 3;
const MAX_KEY_TRAITS_VISIBLE = CHIPS_PER_ROW * MAX_CHIP_ROWS;
const CHIP_ROW_GAP = 6;

const overlayGradientStyle: CSSProperties = {
  position: "absolute",
  inset: "auto 0 0 0",
  height: 140,
  background: "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 100%)",
  borderRadius: "0 0 16px 16px",
  pointerEvents: "none",
  zIndex: 0,
};

function renderPersonaCard(persona: PersonaSummary, clientSlug: string) {
  const hasProfileImage = Boolean(persona.profileImage);
  const primaryTextColor = hasProfileImage ? "#f8fafc" : "#0f172a";
  const badgeBackground = hasProfileImage ? "rgba(255,255,255,0.22)" : "rgba(37,99,235,0.08)";
  const badgeTextColor = hasProfileImage ? "#f1f5f9" : "#1d4ed8";
  const attributeChipBackground = hasProfileImage ? "rgba(15,23,42,0.38)" : "rgba(15,23,42,0.05)";
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
      onClick={() => {
        const personaPath = `/app/${encodeURIComponent(clientSlug)}/${encodeURIComponent(persona.slug)}`;
        window.location.href = personaPath;
      }}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        maxWidth: 240,
        display: "block",
        margin: "0 auto",
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
        borderRadius: 16,
        border: hasProfileImage
          ? "1px solid rgba(15,23,42,0.22)"
          : "1px solid rgba(15,23,42,0.06)",
        boxShadow: baseBoxShadow,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        position: "relative",
        aspectRatio: "2.6 / 3.4",
        minHeight: 210,
        overflow: "hidden",
        color: primaryTextColor,
        transform: "translateY(0)",
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
        onMouseEnter={(event) => {
          (event.currentTarget as HTMLElement).style.transform = hoverTransform;
          (event.currentTarget as HTMLElement).style.boxShadow = hoverBoxShadow;
        }}
        onMouseLeave={(event) => {
          (event.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (event.currentTarget as HTMLElement).style.boxShadow = baseBoxShadow;
        }}
        onFocus={(event) => {
          (event.currentTarget as HTMLElement).style.transform = hoverTransform;
          (event.currentTarget as HTMLElement).style.boxShadow = hoverBoxShadow;
        }}
        onBlur={(event) => {
          (event.currentTarget as HTMLElement).style.transform = "translateY(0)";
          (event.currentTarget as HTMLElement).style.boxShadow = baseBoxShadow;
        }}
      >
        <div style={overlayGradientStyle} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
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
            {persona.roleTitle ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 500,
                  color: hasProfileImage ? "rgba(248,250,252,0.72)" : "#475569",
                  letterSpacing: "0.02em",
                }}
              >
                {persona.roleTitle}
              </p>
            ) : null}
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
          {(persona.attributes.length > 0 || persona.keyTraits.length > 0) ? (
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {persona.attributes.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
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
              {persona.keyTraits.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginBottom: 2,
                  }}
                >
                  {(() => {
                    const traitCount = persona.keyTraits.length;
                    const extraTraitCount = Math.max(traitCount - MAX_KEY_TRAITS_VISIBLE, 0);
                    const visibleLimit = extraTraitCount > 0
                      ? MAX_KEY_TRAITS_VISIBLE - 1
                      : Math.min(traitCount, MAX_KEY_TRAITS_VISIBLE);
                    const traitEntries = persona.keyTraits.slice(0, visibleLimit);
                    const rows: string[][] = [];
                    for (let i = 0; i < traitEntries.length; i += CHIPS_PER_ROW) {
                      rows.push(traitEntries.slice(i, i + CHIPS_PER_ROW));
                    }

                    if (extraTraitCount > 0) {
                      const overflowChip = `+${extraTraitCount}`;
                      if (rows.length === 0) {
                        rows.push([overflowChip]);
                      } else {
                        const lastRow = rows[rows.length - 1];
                        if (lastRow.length < CHIPS_PER_ROW) {
                          lastRow.push(overflowChip);
                        } else if (rows.length < MAX_CHIP_ROWS) {
                          rows.push([overflowChip]);
                        } else {
                          lastRow[lastRow.length - 1] = overflowChip;
                        }
                      }
                    }

                    return rows.map((row, rowIndex) => (
                      <div
                        key={`traits-row-${persona.id}-${rowIndex}`}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: CHIP_ROW_GAP,
                        }}
                      >
                        {row.map((chip, chipIndex) => (
                          <span
                            key={`${persona.id}-trait-${rowIndex}-${chipIndex}-${chip}`}
                            style={{
                              borderRadius: 999,
                              padding: "3px 10px",
                              fontSize: 10,
                              lineHeight: 1.2,
                              fontWeight: 500,
                              background: hasProfileImage ? "rgba(248,250,252,0.18)" : "rgba(15,23,42,0.05)",
                              color: hasProfileImage ? "#f8fafc" : "#0f172a",
                              border: hasProfileImage ? "1px solid rgba(248,250,252,0.25)" : "1px solid rgba(148,163,184,0.35)",
                              textTransform: "none",
                            }}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </button>
  );
}
