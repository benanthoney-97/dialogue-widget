"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBar";
import { docMap } from "@/app/lib/docMap";

type LogLevel = "debug" | "info" | "warn" | "error";

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const slug = params?.slug || "";
  const entry = useMemo(() => docMap[slug], [slug]);

  // Debug flag via ?debug=1
  const debug = sp?.get("debug") === "1";
  const [debugLines, setDebugLines] = useState<string[]>([]);

  // Touch / device detection
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouch(matchMedia("(pointer: coarse)").matches);
  }, []);

  // Auto-resize for iframe host (optional)
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

  function pushDebug(line: string, level: LogLevel = "info", meta: Record<string, unknown> = {}) {
    const s = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase()} ${line}`;
    if (debug) setDebugLines((arr) => [...arr.slice(-50), s]); // keep last 50
    // also ship to server logs
    fetch("/api/moblog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ level, msg: line, meta: { slug, ...meta } }),
    }).catch(() => {});
  }

  if (!entry) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ padding: 16, border: "1px solid rgba(0,0,0,.1)", borderRadius: 12 }}>
          Unknown document slug: <code>{slug}</code>
        </div>
      </main>
    );
  }

  const { pdfPath, agentId, region = "us", auth = "signed" } = entry;
  const useSignedUrl = auth !== "public";
  const [expanded, setExpanded] = useState(false);

  // HEAD check to validate status and content-type
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(pdfPath, { method: "HEAD" });
        const ctype = res.headers.get("content-type") || "(none)";
        pushDebug(`HEAD ${res.status} content-type=${ctype}`, res.ok ? "info" : "warn");
        if (!ctype.includes("application/pdf")) {
          pushDebug("Content-Type is not application/pdf — inline render may fail", "warn");
        }
      } catch (e: any) {
        pushDebug(`HEAD failed: ${e?.message || String(e)}`, "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath]);

  // Scroll/touch diagnostics (are we receiving touch/scroll?)
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = shellRef.current;
    if (!el || !debug) return;
    const onTouchStart = (ev: TouchEvent) => {
      pushDebug("touchstart", "debug", { touches: ev.touches.length });
    };
    const onTouchMove = (ev: TouchEvent) => {
      pushDebug("touchmove", "debug", { y: ev.touches[0]?.clientY });
    };
    const onScroll = () => {
      pushDebug(`shell scrollTop=${el.scrollTop}`, "debug");
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart as any);
      el.removeEventListener("touchmove", onTouchMove as any);
      el.removeEventListener("scroll", onScroll as any);
    };
  }, [debug]);

  return (
    <main
      style={{
        background: "#f8f7f3",
        minHeight: "100dvh",
        height: "100dvh",
        width: "100vw",
        position: "relative",
        overflow: isTouch ? "visible" : "hidden", // allow inner shell to scroll on touch devices
      }}
    >
      {/* Full-bleed PDF container (scrollable shell on touch) */}
      <div
        ref={shellRef}
        aria-label="PDF container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          overflow: isTouch ? "auto" : "hidden",
          height: isTouch ? ("100svh" as any) : "100dvh",
          WebkitOverflowScrolling: isTouch ? ("touch" as any) : undefined,
          overscrollBehavior: isTouch ? "contain" : undefined,
          touchAction: isTouch ? "pan-y" : undefined,
          display: "grid",
          placeItems: "center",
        }}
      >
        {isTouch ? (
          <iframe
            src={`${pdfPath}#view=FitH`}
            title="Research PDF"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
              background: "#fff",
            }}
            onLoad={() => pushDebug("iframe onLoad fired", "info")}
            // onError is not consistently fired on iframes, but keep it just in case
            onError={() => pushDebug("iframe onError fired", "warn")}
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
            // <object> doesn't have a reliable onError; the fallback content renders instead
          >
            <div style={{ padding: 16 }}>
              <p>Inline PDF viewer isn’t available here.</p>
              <p>
                <a href={pdfPath} target="_blank" rel="noreferrer">Open the document</a>
              </p>
            </div>
          </object>
        )}
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
      </div>

      {/* Debug overlay (only when ?debug=1) */}
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
            <strong>Debug</strong> (touch={String(isTouch)}) — add <code>?debug=1</code> to URL
          </div>
          {debugLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </main>
  );
}