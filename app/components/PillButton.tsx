"use client";

import React from "react";

type PillButtonVariant = "default" | "subtle";

type PillButtonProps = {
  variant?: PillButtonVariant;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid rgba(126,160,230,0.4)",
  background: "rgba(15, 23, 42, 0.8)",
  color: "#e6eaff",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.4,
  lineHeight: 1,
  cursor: "pointer",
  transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
  boxSizing: "border-box",
  textDecoration: "none",
};

const VARIANT_STYLE: Record<PillButtonVariant, React.CSSProperties> = {
  default: {
    background: "rgba(15, 23, 42, 0.8)",
  },
  subtle: {
    background: "rgba(15, 23, 42, 0.72)",
  },
};

const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(function PillButton(
  { variant = "default", leadingIcon, trailingIcon, style, children, type = "button", ...rest },
  ref
) {
  const mergedStyle: React.CSSProperties = {
    ...BASE_STYLE,
    ...VARIANT_STYLE[variant],
    ...style,
  };

  return (
    <button ref={ref} type={type} style={mergedStyle} {...rest}>
      {leadingIcon ? <span style={{ display: "inline-flex", alignItems: "center" }}>{leadingIcon}</span> : null}
      <span style={{ display: "inline-flex", alignItems: "center" }}>{children}</span>
      {trailingIcon ? <span style={{ display: "inline-flex", alignItems: "center" }}>{trailingIcon}</span> : null}
    </button>
  );
});

export default PillButton;
