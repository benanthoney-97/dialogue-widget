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
import { buttonThemeMap, defaultButtonTheme } from "@/app/lib/buttonThemeMap";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ScreenshotPage() {
  const { slug } = useParams<{ slug: string }>();
  // debug logs removed
  const sp = useSearchParams();
  // agent_map is the single source of truth for screenshot/agent metadata
  const [entry, setEntry] = useState<any | null>(null);
  const [clientAgentId, setClientAgentId] = useState<string | null>(null);
  const [clientScreenshot, setClientScreenshot] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // fetch client_map row by key, fallback to agent_id if slug looks like an agent id
  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    (async () => {
      setIsFetching(true);
      setFetchError(null);
  // starting agent_map fetch for slug
      try {
        // try lookup by key first
        const res = await supabase
          .from("agent_map")
          .select("agent_id, background_image, screenshot_path, region, auth, talk_label, pdf_path, agent_name, url, author, work_label")
          .eq("key", slug)
          .maybeSingle();
  // agent_map.byKey response available
        let data = res.data as any;
        // if not found and slug looks like an agent id, try agent_id lookup
        if (!data && slug.startsWith("agent_")) {
          // falling back to agent_id lookup for slug
          const alt = await supabase
            .from("agent_map")
            .select("agent_id, background_image, screenshot_path")
            .eq("agent_id", slug)
            .maybeSingle();
          // agent_map.byAgentId response available
          data = alt.data as any;
        }
        if (!mounted) return;
  // resolved agent_map data
        if (data) {
          // Use client_map row as the single source of truth
          setClientAgentId(data.agent_id ?? null);
          setClientScreenshot(data.background_image ?? data.screenshot_path ?? null);
          setEntry({
            agentId: data.agent_id ?? undefined,
            screenshotPath: data.screenshot_path ?? data.background_image ?? undefined,
            region: data.region ?? undefined,
            auth: data.auth ?? undefined,
            talkLabel: data.talk_label ?? undefined,
            pdfPath: data.pdf_path ?? undefined,
            agentName: data.agent_name ?? undefined,
            url: data.url ?? undefined,
            author: data.author ?? undefined,
            workLabel: data.work_label ?? undefined,
          });
          // set entry from agent_map
        } else {
          // no client_map row found
          setEntry(null);
          // no agent_map row found for slug
        }
      } catch (e) {
  console.error("Failed to fetch agent_map row:", e);
  // Provide a developer-friendly error message to help diagnose 404/CORS issues
  const err: any = e;
  setFetchError(err?.message ?? String(err));
      }
      if (mounted) setIsFetching(false);
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const theme = buttonThemeMap[slug] ?? defaultButtonTheme;

  const queryAgent = sp?.get("agentId") ?? "";
  // prefer explicit query param, then client_map agent id, then entry
  const agentId = queryAgent || clientAgentId || entry?.agentId || "";
  const region = (sp?.get("region") as
    | "us"
    | "eu-residency"
    | "in-residency"
    | "global"
    | null) ?? entry?.region ?? "us";
  const auth = (sp?.get("auth") ?? entry?.auth ?? "signed") as
    | "signed"
    | "public";
  const talkLabel = entry?.talkLabel;
  const screenshot = clientScreenshot ?? entry?.screenshotPath ?? sp?.get("img") ?? null;
  const useSignedUrl = auth !== "public";

  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerId = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

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

  if (!agentId) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#111827",
          color: "#f9fafb",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(17,24,39,0.8)",
            maxWidth: 420,
            fontWeight: 600,
          }}
        >
          No agent configured for slug <code>{slug}</code>. Supply an <code>agentId</code> or
          update <code>docMap</code>.
        </div>
      </main>
    );
  }

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
    const el = dragContainerRef.current;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
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
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100vw",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        padding: 16,
        backgroundColor: screenshot ? undefined : "#111827",
        backgroundImage: screenshot ? `url(${screenshot})` : undefined,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <div
        style={
          dragPos
            ? {
                position: "fixed",
                top: dragPos.y,
                left: dragPos.x,
                transform: "translate(0, 0)",
                zIndex: 80,
                pointerEvents: "none",
              }
            : {
                position: "fixed",
                bottom: "max(16px, env(safe-area-inset-bottom))",
                right: "max(16px, env(safe-area-inset-right))",
                zIndex: 80,
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
            padding: 16,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.24)",
          }}
        >
          <DialogueBar
            agentId={agentId}
            useSignedUrl={useSignedUrl}
            serverLocation={region}
            talkLabel={talkLabel}
            buttonColor={theme.background}
            buttonTextColor={theme.text}
            buttonBorderColor={theme.border}
          />
        </div>
      </div>
    </main>
  );
}
