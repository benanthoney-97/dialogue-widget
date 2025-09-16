"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import DialogueBar from "@/app/components/DialogueBar";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { docMap } from "@/app/lib/docMap";

type LogLevel = "debug" | "info" | "warn" | "error";

// Lazy-load the PDF.js pane (client-only)
const ReactPDFPane = dynamic(() => import("@/app/components/ReactPDFPane"), {
  ssr: false,
});

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const sp = useSearchParams();

  const slug = params?.slug || "";
  const entry = useMemo(() => docMap[slug], [slug]);

  // Flags from URL
  const debug = sp?.get("debug") === "1";
  const forcePDFJS = sp?.get("force") === "pdfjs";
  const proxyParam = sp?.get("proxy"); // "on" | "off" | null

  // Debug buffer
  const [debugLines, setDebugLines] = useState<string[]>([]);
  function pushDebug(
    line: string,
    level: LogLevel = "info",
    meta: Record<string, unknown> = {}
  ) {
    const s = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase()} ${line}`;
    if (debug) setDebugLines((arr) => [...arr.slice(-80), s]);
    fetch("/api/moblog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ level, msg: line, meta: { slug, ...meta } }),
    }).catch(() => {});
  }

  // Device detection (prefer PDF.js on touch)
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouch(matchMedia("(pointer: coarse)").matches);
  }, []);

  if (!entry) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ padding: 16, border: "1px solid rgba(0,0,0,.1)", borderRadius: 12 }}>
          Unknown document slug: <code>{slug}</code>
        </div>
      </main>
    );
  }

  // Entry fields (declare before any usage)
  const { pdfPath, agentId, region = "us", auth = "signed" } = entry;
  const useSignedUrl = auth !== "public";
  const [expanded, setExpanded] = useState(false);

  // Prefer PDF.js on touch or when forced
  const preferPDFJS = isTouch || forcePDFJS;

  // Proxy strategy — start direct unless ?proxy=on
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    if (proxyParam === "on") return true;
    if (proxyParam === "off") return false;
    return false;
  });

  // Build current PDF URL based on proxy mode
  const directUrl = pdfPath;
  const proxiedUrl = `/api/pdf-proxy?url=${encodeURIComponent(pdfPath)}`;
  const pdfUrl = useProxy ? proxiedUrl : directUrl;

  // Auto-resize for iframe hosts
  useEffect(() => {
    if (typeof window === "undefined") return;
    const send = () => {
      try {
        const h = document.body.scrollHeight;
        window.parent?.postMessage({ type: "dialogue:resize", height: h }, "*");
      } catch {}
    };
    send();
    const ro = "ResizeObserver" in window ? new ResizeObserver(send) : null;
    ro?.observe(document.body);
    const onWinResize = () => send();
    window.addEventListener("resize", onWinResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onWinResize);
    };
  }, []);

  // Scroll/touch diagnostics (shell container)
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = shellRef.current;
    if (!el || !debug) return;
    const onTouchStart = (ev: TouchEvent) =>
      pushDebug("touchstart", "debug", { touches: ev.touches.length });
    const onTouchMove = (ev: TouchEvent) =>
      pushDebug("touchmove", "debug", { y: ev.touches[0]?.clientY });
    const onScroll = () => pushDebug(`shell scrollTop=${el.scrollTop}`, "debug");
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
      el.removeEventListener("scroll", onScroll as any);
    };
  }, [debug]);

  // ReactPDFPane diagnostic handler
  function handlePDFDebug(evt: string, meta?: Record<string, unknown>) {
    if (evt === "pdfjs:onLoadSuccess") {
      pushDebug("pdfjs onLoadSuccess", "info", meta);
    } else if (evt === "pdfjs:onLoadError" || evt === "pdfjs:onSourceError") {
      pushDebug(evt, "warn", meta);
      if (proxyParam !== "off" && !useProxy) {
        pushDebug("switching to proxy fallback", "info");
        setUseProxy(true);
      }
    } else {
      pushDebug(evt, "debug", meta);
    }
  }

  // ErrorBoundary -> logger
  function onBoundaryError(error: unknown, info: { componentStack?: string }) {
    pushDebug(
      `ErrorBoundary: ${error instanceof Error ? error.message : String(error)}`,
      "error",
      { stack: info?.componentStack || "" }
    );
  }

  return (
    <main
      style={{
        background: "#f8f7f3",
        minHeight: "100dvh",
        height: "100dvh",
        width: "100vw",
        position: "relative",
        overflow: preferPDFJS ? "visible" : "hidden",
      }}
    >
      {/* Full-bleed PDF container */}
      <div
        ref={shellRef}
        aria-label="PDF container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          overflow: preferPDFJS ? "auto" : "hidden",
          height: preferPDFJS ? ("100svh" as any) : "100dvh",
          WebkitOverflowScrolling: preferPDFJS ? ("touch" as any) : undefined,
          overscrollBehavior: preferPDFJS ? "contain" : undefined,
          touchAction: preferPDFJS ? "pan-y" : undefined,
          display: "grid",
          placeItems: "center",
        }}
      >
        <ErrorBoundary onError={onBoundaryError}>
          {preferPDFJS ? (
            <ReactPDFPane
              file={pdfUrl}            // start direct, fallback to proxy on error
              onDebug={handlePDFDebug} // reports success/error
            />
          ) : (
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
              onLoadCapture={() => pushDebug("object onLoadCapture fired", "info")}
            >
              <div style={{ padding: 16 }}>
                <p>Inline PDF viewer isn’t available here.</p>
                <p>
                  <a href={pdfPath} target="_blank" rel="noreferrer">Open the document</a>
                </p>
              </div>
            </object>
          )}
        </ErrorBoundary>
      </div>

      {/* Bottom-center overlayed Dialogue widget */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          zIndex: 50,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <ErrorBoundary onError={onBoundaryError}>
          <div
            style={{
              width: "min(820px, 100%)",
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "saturate(1.2) blur(6px)",
              WebkitBackdropFilter: "saturate(1.2) blur(6px)",
              border: "1px solid rgba(0,0,0,.10)",
              borderRadius: 14,
              boxShadow: "0 8px 30px rgba(0,0,0,.12)",
              padding: expanded ? 16 : 10,
              pointerEvents: "auto",
              transition: "transform 160ms ease, padding 160ms ease",
              marginBottom: 8,
            }}
          >
            <div
              role="button"
              aria-label={expanded ? "Collapse dialogue" : "Expand dialogue"}
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: "grid",
                placeItems: "center",
                margin: "-2px 0 8px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(0,0,0,.18)",
                }}
              />
            </div>

            <DialogueBar
              agentId={agentId}
              useSignedUrl={useSignedUrl}
              serverLocation={region}
            />

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#6b7280",
                display: expanded ? "block" : "none",
              }}
            >
              Tip: Ask while you read. Collapse this panel anytime.
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* Debug overlay */}
      {debug && (
        <div
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            maxWidth: 380,
            maxHeight: "40vh",
            overflow: "auto",
            background: "rgba(0,0,0,0.75)",
            color: "#eee",
            padding: 8,
            borderRadius: 8,
            fontSize: 12,
            zIndex: 60,
            whiteSpace: "pre-wrap",
            lineHeight: 1.2,
          }}
        >
          <div style={{ marginBottom: 4, opacity: 0.8 }}>
            <strong>Debug</strong>{" "}
            (touch={String(isTouch)} preferPDFJS={String(preferPDFJS)} useProxy={String(useProxy)})
            {" — add "}
            <code>?debug=1</code>, <code>?force=pdfjs</code>, <code>?proxy=on</code> or{" "}
            <code>?proxy=off</code>
          </div>
          {debugLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </main>
  );
}