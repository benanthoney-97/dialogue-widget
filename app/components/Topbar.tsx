"use client";

import React from "react";
import Link from "next/link";
import { TOPBAR_HEIGHT } from "./topbarHeight";

type TopbarProps = {
  title?: string;
  titleHref?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  cadence?: string;
  onCadenceChange?: (value: string) => void;
  offsetLeft?: string | number;
  hideCadenceControls?: boolean;
  centerSlot?: React.ReactNode;
  cadenceLabel?: string;
  navLinks?: Array<{ label: string; href: string }>;
  profileInitial?: string;
  onProfileClick?: () => void;
  leadingSlot?: React.ReactNode;
  hideProfileAvatar?: boolean;
};

const CADENCE_OPTIONS = ["Quarterly", "Monthly", "Weekly", "Daily"] as const;

export default function Topbar({
  title = "Workspace research",
  subtitle,
  titleHref,
  rightSlot,
  cadence = "Weekly",
  onCadenceChange,
  offsetLeft,
  hideCadenceControls = false,
  centerSlot,
  cadenceLabel,
  navLinks,
  profileInitial,
  onProfileClick,
  leadingSlot,
  hideProfileAvatar = false,
}: TopbarProps) {
  const resolvedOffset = offsetLeft ?? 0;
  const portalNavLinks = navLinks ?? [];
  const showPortalNav = portalNavLinks.length > 0;
  const normalizedInitial = (profileInitial ?? "A").trim().charAt(0).toUpperCase() || "A";

  const defaultRightSlot = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.08)",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
        }}
      >
        Interview
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(15, 23, 42, 0.08)",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
        }}
      >
        Questionnaire
      </span>
    </div>
  );

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: resolvedOffset,
        right: 0,
        zIndex: 120,
        height: TOPBAR_HEIGHT,
        background: "var(--panel, #0f172a)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        transition: "left 0.3s ease",
      }}
    >
      <div
        style={{
          margin: 0,
          padding: "12px 24px",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 18,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            justifyContent: "center",
            height: "100%",
            flexShrink: 0,
          }}
        >
          {leadingSlot ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              {leadingSlot}
            </div>
          ) : (
            <>
              {titleHref ? (
                <Link
                  href={titleHref}
                  prefetch={false}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "inline-flex",
                  }}
                >
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#052033",
                      fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
                    }}
                  >
                    {title}
                  </h1>
                </Link>
              ) : (
                <h1
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#052033",
                    fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
                  }}
                >
                  {title}
                </h1>
              )}
              {subtitle ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "rgba(15, 23, 42, 0.72)",
                    maxWidth: 560,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {showPortalNav ? (
          <nav
            aria-label="Portal navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 13,
              fontWeight: 600,
              color: "#0f172a",
              fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              flexShrink: 0,
            }}
          >
            {portalNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  color: "inherit",
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 999,
                  transition: "background 0.18s ease, color 0.18s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(15, 23, 42, 0.08)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.background = "rgba(15, 23, 42, 0.12)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: "100%",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          {hideCadenceControls ? null : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              {cadenceLabel ? (
                <span className="topbar-cadence-label">{cadenceLabel}</span>
              ) : null}
              <div
                role="tablist"
                aria-label="Refresh cadence"
                style={{
                  display: "inline-flex",
                  borderRadius: 12,
                  background: "#f6f7f9",
                  border: "1px solid #1e293b",
                  padding: 4,
                  gap: 4,
                }}
              >
                {CADENCE_OPTIONS.map((option) => {
                  const active = cadence === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "topbar-cadence-chip topbar-cadence-chip--active" : "topbar-cadence-chip"}
                      aria-pressed={active}
                      onClick={() => onCadenceChange?.(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>{rightSlot ?? defaultRightSlot}</div>
          {hideProfileAvatar ? null : (
            <button
              type="button"
              onClick={onProfileClick}
              aria-label="Open profile menu"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "#073a70",
                color: "#f8fafc",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 15,
                textTransform: "uppercase",
                boxShadow: "0 6px 18px rgba(10,22,40,0.18)",
                cursor: onProfileClick ? "pointer" : "default",
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              }}
            >
              {normalizedInitial}
            </button>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerSlot ?? (
            <div
              id="topbar-center-slot"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            />
          )}
        </div>
      </div>
      <style>{`
        .topbar-cadence-label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
        }
        .topbar-cadence-chip {
          border: none;
          background: #f6f7f9;
          color: #1e293b;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .topbar-cadence-chip:focus-visible {
          outline: none;
          background: rgba(59, 130, 246, 0.18);
          color: #f6f7f9;
        }
        .topbar-cadence-chip--active {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.28);
        }
      `}</style>
    </header>
  );
}
