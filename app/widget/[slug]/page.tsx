"use client";

import {
  useMemo,
  useEffect,
  useState,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkButton";
import MobileConsole from "@/app/components/MobileConsole";
import { docMap } from "@/app/lib/docMap";
import { buttonThemeMap, defaultButtonTheme } from "@/app/lib/buttonThemeMap";

const DEFAULT_EXTERNAL_URL = "https://www.dialogue-ai.co/";

export default function WidgetDocPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = useMemo(() => (slug ? docMap[slug] : undefined), [slug]);
  const sp = useSearchParams();
  const debug = sp?.get("debug") === "1";
  const theme = buttonThemeMap[slug] ?? defaultButtonTheme;

  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

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

  const { agentId, region = "us", auth = "signed", url } = entry;
  const useSignedUrl = auth !== "public";
  const targetUrl = url ?? DEFAULT_EXTERNAL_URL;

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
        width: "100vw",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-label="Embedded content container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
        }}
      >
        <iframe
          src={targetUrl}
          title="Source content"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          allow="microphone; clipboard-write;"
        />
      </div>

      <div
        style={
          dragPos
            ? {
                position: "fixed",
                top: dragPos.y,
                left: dragPos.x,
                transform: "translate(0, 0)",
                zIndex: 60,
                pointerEvents: "none",
              }
            : {
                position: "fixed",
                bottom: "max(16px, env(safe-area-inset-bottom))",
                right: "max(16px, env(safe-area-inset-right))",
                zIndex: 60,
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
            buttonColor={theme.background}
            buttonTextColor={theme.text}
            buttonBorderColor={theme.border}
          />
        </div>
      </div>

      {debug ? <MobileConsole enabled /> : null}
    </main>
  );
}
