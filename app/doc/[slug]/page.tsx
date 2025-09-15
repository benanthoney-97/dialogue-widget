"use client";

import { useMemo, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBar";
import { docMap } from "@/app/lib/docMap";

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const entry = useMemo(() => docMap[slug], [slug]);

  // Detect touch devices (mobile/tablet)
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

  return (
    <main
      style={{
        background: "#f8f7f3",
        minHeight: "100dvh",
        height: "100dvh",
        width: "100vw",
        position: "relative",
        // Let the inner shell scroll on mobile, keep hidden on desktop
        overflow: isTouch ? "visible" : "hidden",
      }}
    >
      {/* Full-bleed PDF container */}
      <div
        aria-label="PDF container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          // On touch devices, the shell is scrollable to enable smooth PDF scrolling
          overflow: isTouch ? "auto" : "hidden",
          height: isTouch ? "100svh" as any : "100dvh",
          WebkitOverflowScrolling: isTouch ? ("touch" as any) : undefined,
          overscrollBehavior: isTouch ? "contain" : undefined,
          touchAction: isTouch ? "pan-y" : undefined,
          display: "grid",
          placeItems: "center",
        }}
      >
        {isTouch ? (
          // iOS scrolls iframes far more reliably than <object>
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
          >
            <p style={{ padding: 16 }}>
              This browser can’t display the PDF.{" "}
              <a href={pdfPath} target="_blank" rel="noreferrer">Open the document</a>.
            </p>
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
          pointerEvents: "none", // allow PDF interactions outside the widget
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
            pointerEvents: "auto", // widget is interactive
            transition: "transform 160ms ease, padding 160ms ease",
            marginBottom: 8,
          }}
        >
          {/* drag/expand affordance (optional) */}
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
    </main>
  );
}