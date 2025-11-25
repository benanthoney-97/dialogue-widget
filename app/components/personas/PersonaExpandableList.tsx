"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PersonaExpandableListProps = {
  items: string[];
  emptyText?: string;
};

export default function PersonaExpandableList({ items, emptyText = "No items available." }: PersonaExpandableListProps) {
  const [expanded, setExpanded] = useState(false);
  const [canOverflow, setCanOverflow] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const hasContent = useMemo(() => items.some((item) => item.trim().length > 0), [items]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    if (!hasContent) {
      setCanOverflow(false);
      return;
    }

    const ResizeObserverRef = typeof ResizeObserver !== "undefined" ? ResizeObserver : null;
    if (!ResizeObserverRef) {
      setCanOverflow(false);
      return;
    }

    const measure = () => {
      if (!listRef.current) return;
      if (expanded) {
        setCanOverflow((prev) => prev);
        return;
      }

      const overflow = listRef.current.scrollHeight > listRef.current.clientHeight + 1;
      setCanOverflow(overflow);
    };

    measure();

    const observer = new ResizeObserverRef(() => measure());
    observer.observe(node);

    return () => observer.disconnect();
  }, [expanded, hasContent]);

  const showToggle = hasContent && (canOverflow || expanded);
  const showFade = !expanded && canOverflow;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        ref={listRef}
        style={{
          position: "relative",
          maxHeight: expanded ? "none" : 96,
          overflow: "hidden",
        }}
      >
        {hasContent ? (
          items.map((item, index) => (
            <p
              key={`detail-list-${index}`}
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.5,
                color: "#475569",
                fontFamily: "inherit",
              }}
            >
              {item}
            </p>
          ))
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: "#475569",
              fontFamily: "inherit",
            }}
          >
            {emptyText}
          </p>
        )}
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
          onClick={() => setExpanded((value) => !value)}
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
