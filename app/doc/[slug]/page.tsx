"use client";

import { useMemo, useEffect, useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkButton";
import { docMap } from "@/app/lib/docMap";
import { useSearchParams } from "next/navigation";
import MobileConsole from "@/app/components/MobileConsole";

// Client-only PDF.js viewer
const PDFJSViewer = dynamic(() => import("@/app/components/PDFJSViewer"), {
  ssr: false,
});

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const entry = useMemo(() => docMap[slug], [slug]);

  // Defer anything that depends on window to avoid hydration swaps
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Touch detection (decide viewer after mount)
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouch(matchMedia("(pointer: coarse)").matches);
  }, []);

  if (!entry) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            padding: 16,
            border: "1px solid rgba(0,0,0,.1)",
            borderRadius: 12,
          }}
        >
          Unknown document slug: <code>{slug}</code>
        </div>
      </main>
    );
  }
  // inside component:
const sp = useSearchParams();
const debug = sp?.get("debug") === "1";

// inside return JSX, near the end:
{debug && <MobileConsole enabled={true} />}

  const { pdfPath, agentId, region = "us", auth = "signed", talkLabel } = entry;
  const useSignedUrl = auth !== "public";
  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleDragPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea")) return;
    if (!dragContainerRef.current) return;
    dragPointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = dragContainerRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setDragPos({ x: rect.left, y: rect.top });
    setDragging(true);
    event.preventDefault();
  }

  function handleDragPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || dragPointerId.current !== event.pointerId || !dragContainerRef.current)
      return;
    if (typeof window === "undefined") return;
    const card = dragContainerRef.current;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const inset = 12;
    const maxX = Math.max(inset, window.innerWidth - width - inset);
    const maxY = Math.max(inset, window.innerHeight - height - inset);
    const newX = event.clientX - dragOffsetRef.current.x;
    const newY = event.clientY - dragOffsetRef.current.y;
    const clampedX = Math.min(Math.max(newX, inset), maxX);
    const clampedY = Math.min(Math.max(newY, inset), maxY);
    setDragPos({ x: clampedX, y: clampedY });
    event.preventDefault();
  }

  function handleDragPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragPointerId.current !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragPointerId.current = null;
    setDragging(false);
    event.preventDefault();
  }

  useEffect(() => {
    if (!dragPos || !dragContainerRef.current) return;
    const inset = 12;

    const clampPosition = () => {
      setDragPos((prev) => {
        if (!prev || !dragContainerRef.current) return prev;
        const el = dragContainerRef.current;
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const maxX = Math.max(inset, window.innerWidth - width - inset);
        const maxY = Math.max(inset, window.innerHeight - height - inset);
        const clampedX = Math.min(Math.max(prev.x, inset), maxX);
        const clampedY = Math.min(Math.max(prev.y, inset), maxY);
        if (clampedX === prev.x && clampedY === prev.y) return prev;
        return { x: clampedX, y: clampedY };
      });
    };

    clampPosition();

    const handleResize = () => clampPosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    const observer = new ResizeObserver(() => clampPosition());
    observer.observe(dragContainerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      observer.disconnect();
    };
  }, [dragPos]);

  return (
    <main
      style={{
        background: "#f8f7f3",
        minHeight: "100dvh",
        height: "100dvh",
        width: "100vw",
        position: "relative",
        overflow: mounted && isTouch ? "visible" : "hidden",
      }}
    >
      {/* Full-bleed PDF area */}
      <div
        aria-label="PDF container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          display: "grid",
          placeItems: "center",
          overflow: mounted && isTouch ? "auto" : "hidden",
          height: "100dvh",
          WebkitOverflowScrolling: mounted && isTouch ? ("touch" as any) : undefined,
          touchAction: mounted && isTouch ? "pan-y" : undefined,
        }}
      >
        {!mounted ? (
          // Keep SSR/CSR markup identical to avoid hydration issues
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#fff",
            }}
          />
        ) : isTouch ? (
          // Client-only PDF.js viewer on touch devices
          <PDFJSViewer key="pdfjs" file={pdfPath} />
        ) : (
          // Native <object> on desktop
          <object
            data={`${pdfPath}#view=FitH`}
            type="application/pdf"
            aria-label="Research PDF"
            style={{
              width: "100vw",
              height: "100dvh",
              border: "none",
              display: "block",
              background: "#fff",
            }}
          >
            <div style={{ padding: 16 }}>
              <p>Inline PDF viewer isn’t available here.</p>
              <p>
                <a href={pdfPath} target="_blank" rel="noreferrer">
                  Open the document
                </a>
              </p>
            </div>
          </object>
        )}
      </div>

      {/* Draggable Dialogue widget */}
      <div
        style={
          dragPos
            ? {
                position: "fixed",
                top: dragPos.y,
                left: dragPos.x,
                transform: "translate(0, 0)",
                zIndex: 50,
                pointerEvents: "none",
              }
            : {
                position: "fixed",
                bottom: "max(12px, env(safe-area-inset-bottom))",
                right: "max(12px, env(safe-area-inset-right))",
                zIndex: 50,
                pointerEvents: "none",
              }
        }
      >
        <div
          ref={dragContainerRef}
          onPointerDown={handleDragPointerDown}
          onPointerMove={handleDragPointerMove}
          onPointerUp={handleDragPointerUp}
          onPointerCancel={handleDragPointerUp}
          style={{
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <DialogueBar
            agentId={agentId}
            useSignedUrl={useSignedUrl}
            serverLocation={region}
            talkLabel={talkLabel}
          />
        </div>
      </div>
    </main>
  );
}
