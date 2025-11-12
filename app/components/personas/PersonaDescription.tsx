'use client';

import { useEffect, useMemo, useRef, useState } from "react";

type PersonaDescriptionProps = {
  text: string;
};

export default function PersonaDescription({ text }: PersonaDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [canOverflow, setCanOverflow] = useState(false);
  const trimmed = useMemo(() => text.replace(/\r\n/g, "\n").trim(), [text]);
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const node = paragraphRef.current;
    if (!node) return;
    if (!trimmed.length) {
      setCanOverflow(false);
      return;
    }

    const ResizeObserverRef = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    if (!ResizeObserverRef) {
      setCanOverflow(false);
      return;
    }

    const measure = () => {
      if (!paragraphRef.current) return;
      if (expanded) {
        setCanOverflow((prev) => prev);
        return;
      }

      const overflow = paragraphRef.current.scrollHeight > paragraphRef.current.clientHeight + 1;
      setCanOverflow(overflow);
    };

    measure();

    const observer = new ResizeObserverRef(() => measure());
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [trimmed, expanded]);

  const showToggle = trimmed.length > 0 && (canOverflow || expanded);
  const showFade = !expanded && canOverflow;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <p
          ref={paragraphRef}
          style={{
            margin: 0,
            fontSize: 17,
            lineHeight: 1.65,
            color: "#334155",
            maxWidth: "80ch",
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical",
            overflow: expanded ? "visible" : "hidden",
            textOverflow: expanded ? "clip" : "ellipsis",
            whiteSpace: "pre-line",
          }}
        >
          {trimmed}
        </p>
        {showFade ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 48,
              background: "linear-gradient(to top, rgba(248,250,252,1) 0%, rgba(248,250,252,0) 100%)",
              pointerEvents: "none",
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
            }}
          />
        ) : null}
      </div>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((status) => !status)}
          aria-expanded={expanded}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 14px 6px 0",
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: "#0f172a",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          <span>{expanded ? "View less" : "View more"}</span>
          <span
            aria-hidden="true"
            style={{
              marginLeft: 6,
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: expanded ? "none" : "6px solid #94a3b8",
              borderBottom: expanded ? "6px solid #94a3b8" : "none",
            }}
          />
        </button>
      ) : null}
    </div>
  );
}
