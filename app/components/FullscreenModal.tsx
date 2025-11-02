"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ModalPortalContext from "./ModalPortalContext";

type FullscreenModalProps = {
  open: boolean;
  // function props passed into client components should follow the
  // Next.js server-action naming convention when appropriate. Use
  // `onCloseAction` to signal this is a callback passed from parent.
  onCloseAction: () => void;
  children?: React.ReactNode;
  anchorRef?: React.RefObject<HTMLElement | null>;
};

export default function FullscreenModal({
  open,
  onCloseAction,
  children,
  anchorRef,
}: FullscreenModalProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseAction();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onCloseAction]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchorRect(null);
      return;
    }
    const anchorEl = anchorRef?.current;
    if (!anchorEl || typeof window === "undefined") {
      setAnchorRect(null);
      return;
    }

    const updateRect = () => {
      const nextRect = anchorRef?.current?.getBoundingClientRect() ?? null;
      setAnchorRect(nextRect);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateRect());
      resizeObserver.observe(anchorEl);
    }

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      resizeObserver?.disconnect();
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCloseAction}
      style={{
        position: "fixed",
        ...(anchorRect
          ? {
              top: anchorRect.top,
              left: anchorRect.left,
              width: anchorRect.width,
              height: anchorRect.height,
            }
          : { inset: 0 }),
        zIndex: 1000,
        // Use theme accent for a subtle translucent backdrop; fallback keeps previous behaviour.
        background: "rgba(var(--accent-rgb, 43,108,176), 0.08)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 0,
        backdropFilter: "blur(6px)",
      }}
    >
      <ModalPortalContext.Provider value={innerRef.current}>
        <div
          ref={innerRef}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
          style={{
            // Panel background and text color follow theme variables with sensible fallbacks.
            background: "var(--panel, #0f172a)",
            color: "var(--text, #F6F7F9fff)",
            borderRadius: 0,
            border: "none",
            boxShadow: "none",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            // allow child overlays (eg. PrepAgent's absolute uploaded-file card)
            // to be visible in the top-right of the expanded content
            overflow: "visible",
            position: "relative",
          }}
        >
          {children}
        </div>
      </ModalPortalContext.Provider>
    </div>
  );
}
