"use client";

import { useMemo, useEffect, useState, useRef, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkButton";
import { docMap } from "@/app/lib/docMap";
import { buttonThemeMap, defaultButtonTheme } from "@/app/lib/buttonThemeMap";
import { useSearchParams } from "next/navigation";
import MobileConsole from "@/app/components/MobileConsole";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client-only PDF.js viewer
const PDFJSViewer = dynamic(() => import("@/app/components/PDFJSViewer"), {
  ssr: false,
});

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  // entry: prefer docMap but allow runtime lookup from Supabase.agent_map by key
  const [entry, setEntry] = useState<any>(() => docMap[slug] ?? null);
  const theme = buttonThemeMap[slug] ?? defaultButtonTheme;

  // Defer anything that depends on window to avoid hydration swaps
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Touch detection (decide viewer after mount)
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouch(matchMedia("(pointer: coarse)").matches);
  }, []);

  // If docMap didn't contain the slug, or the entry is partial, attempt to fetch metadata from Supabase.agent_map (by key)
  useEffect(() => {
    // Only skip fetching when we have a complete entry (both pdfPath and agentId).
    // This ensures we still fetch agent_map when docMap provided a partial entry (e.g. agentId but no pdfPath).
    if (entry && entry.pdfPath && entry.agentId) return;
    if (!slug) return;
    let mounted = true;
    (async () => {
      try {
        // use maybeSingle to avoid throwing when no row exists; include background_image
        const { data, error, status } = await supabase
          .from("agent_map")
          .select(
            "key, pdf_path, document_url, agent_id, agent_name, region, auth, talk_label, screenshot_path, url, author, work_label, background_image, testing_mode"
          )
          .eq("key", slug)
          .maybeSingle();
        if (!mounted) return;
        if (data) {
          // merge with any existing partial entry
          setEntry((prev: any) => ({
            ...(prev ?? {}),
            pdfPath: data.pdf_path ?? prev?.pdfPath ?? "",
            documentUrl: data.document_url ?? prev?.documentUrl ?? "",
            agentId: data.agent_id ?? prev?.agentId ?? "",
            region: data.region ?? prev?.region ?? "us",
            auth: data.auth ?? prev?.auth ?? "signed",
            talkLabel: data.talk_label ?? prev?.talkLabel,
            screenshotPath: data.screenshot_path ?? prev?.screenshotPath,
            url: data.url ?? prev?.url,
            author: data.author ?? prev?.author,
            workLabel: data.work_label ?? prev?.workLabel,
            backgroundImage: data.background_image ?? prev?.backgroundImage,
          }));
          // expose testing_mode to client components via a small global flag (non-enumerable fallback)
          try {
            // attach to window for the talk button to pick up dynamically
            if (typeof window !== "undefined") {
              // use a namespaced property to avoid collisions
              (window as any).__DOC_TESTING_MODE__ = Boolean(data.testing_mode);
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // log error for debugging
        // ignore and allow fallback to 'Unknown' below
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug, entry]);
  // inside component:
  const sp = useSearchParams();
  const debug = sp?.get("debug") === "1";

  // runtime debug logs (enabled with ?debug=1)
  if (debug) {
    console.log('[DocPage] debug', {
      slug,
      entry,
      pdfPath: entry?.pdfPath ?? undefined,
      agentId: entry?.agentId ?? undefined,
      region: entry?.region ?? undefined,
      auth: entry?.auth ?? undefined,
      isFetching: !!(entry == null),
      fetchError: null,
    });
  }

  // inside return JSX, near the end:
  {debug && <MobileConsole enabled={true} />}

  const { pdfPath = "", agentId = "", region = "us", auth = "signed", talkLabel } = entry || {};
  const useSignedUrl = auth !== "public";
  // resolve pdfUrl for viewer (prefer documentUrl stored in DB; fall back to pdfPath)
  const documentUrl = entry?.documentUrl ?? "";
  const pdfPathResolved = pdfPath ? (pdfPath.startsWith("http") ? pdfPath : encodeURI(pdfPath)) : "";
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string>(documentUrl || pdfPathResolved);

  // If we don't have a public URL and auth indicates signed URLs are required, request one
  useEffect(() => {
    let mounted = true;
    async function ensureSigned() {
      if (!useSignedUrl) {
        setResolvedPdfUrl(documentUrl || pdfPathResolved);
        return;
      }
      // prefer documentUrl if it's already set (it may be a signed URL)
      if (documentUrl && documentUrl.startsWith('http')) {
        setResolvedPdfUrl(documentUrl);
        return;
      }
      // If pdfPathResolved looks like a storage path (no host) and we need a signed URL, call the API
      if (pdfPath && !pdfPath.startsWith('http')) {
        try {
          // strip leading slash if present
          const storagePath = pdfPath.replace(/^\//, "");
          const res = await fetch('/api/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: storagePath, expires: 120 }),
          });
          const j = await res.json();
          if (mounted && j?.signedUrl) setResolvedPdfUrl(j.signedUrl);
        } catch (e) {
          console.warn('Failed to fetch signed URL', e);
          if (mounted) setResolvedPdfUrl(documentUrl || pdfPathResolved);
        }
      } else {
        setResolvedPdfUrl(documentUrl || pdfPathResolved);
      }
    }
    ensureSigned();
    return () => { mounted = false; };
  }, [documentUrl, pdfPath, pdfPathResolved, useSignedUrl]);
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
          <PDFJSViewer key="pdfjs" file={resolvedPdfUrl} />
        ) : (
          // Native <object> on desktop
          <object
            data={`${resolvedPdfUrl}#view=FitH`}
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
                <a href={resolvedPdfUrl} target="_blank" rel="noreferrer">
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
            buttonColor={theme.background}
            buttonTextColor={theme.text}
            buttonBorderColor={theme.border}
          />
        </div>
      </div>
    </main>
  );
}
