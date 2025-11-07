"use client";

import React from "react";

type TopbarProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  cadence?: string;
  onCadenceChange?: (value: string) => void;
  offsetLeft?: string | number;
  hideCadenceControls?: boolean;
  centerSlot?: React.ReactNode;
};

export const TOPBAR_HEIGHT = 56;
const CADENCE_OPTIONS = ["Daily", "Weekly", "Monthly", "Quarterly"] as const;

export default function Topbar({
  title = "Workspace research",
  subtitle,
  rightSlot,
  cadence = "Weekly",
  onCadenceChange,
  offsetLeft,
  hideCadenceControls = false,
  centerSlot,
}: TopbarProps) {
  const resolvedOffset = offsetLeft ?? 0;
  const hasCenterSlot = Boolean(centerSlot);
  const layoutTemplate = hasCenterSlot ? "auto 1fr auto" : "auto auto";

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
      }}
    >
      <div
        style={{
          margin: 0,
          padding: "12px 24px",
          width: "min(1120px, 96%)",
          display: "grid",
          gridTemplateColumns: layoutTemplate,
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            justifyContent: "center",
            height: "100%",
          justifySelf: "start",
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
        </div>
        {hasCenterSlot ? (
          <div
            style={{
              justifySelf: "center",
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            {centerSlot}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifySelf: "end",
            height: "100%",
          }}
        >
          {hideCadenceControls ? null : (
            <div
              role="tablist"
              aria-label="Refresh cadence"
              style={{
                display: "inline-flex",
                borderRadius: 12,
                background: "rgba(148, 163, 184, 0.18)",
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
          )}
          {rightSlot ? <div>{rightSlot}</div> : null}
        </div>
      </div>
      <style>{`
        .topbar-cadence-chip {
          border: none;
          background: transparent;
          color: rgba(226, 232, 240, 0.7);
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .topbar-cadence-chip:hover,
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
