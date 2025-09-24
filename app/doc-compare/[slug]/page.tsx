"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBar";
import MobileConsole from "@/app/components/MobileConsole";
import { docMap } from "@/app/lib/docMap";

// Client-only PDF.js viewer (your existing one)
const PDFJSViewer = dynamic(() => import("@/app/components/PDFJSViewer"), {
  ssr: false,
});

export default function DocComparePage() {
  const params = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const slug = params?.slug || "";

  // pick docs from query or default to same as slug
  const leftKey = (sp?.get("left") ?? slug) as keyof typeof docMap;
  const rightKey = (sp?.get("right") ?? slug) as keyof typeof docMap;

  const leftEntry = useMemo(() => docMap[leftKey], [leftKey]);
  const rightEntry = useMemo(() => docMap[rightKey], [rightKey]);

  const debug = sp?.get("debug") === "1";

  // mount + touch detection to mirror your single page behavior
  const [mounted, setMounted] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsTouch(matchMedia("(pointer: coarse)").matches);
    }
  }, []);

  if (!leftEntry || !rightEntry) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ padding: 16, border: "1px solid rgba(0,0,0,.1)", borderRadius: 12 }}>
          Unknown compare keys: <code>{String(leftKey)}</code> vs <code>{String(rightKey)}</code>
        </div>
      </main>
    );
  }

  const { agentId, region = "us" } = leftEntry;
  const useSignedUrl = (leftEntry.auth !== "public") || (rightEntry.auth !== "public");

  const [expanded, setExpanded] = useState(false);

  // IMPORTANT: these must point to real files in /public/papers/ for native <object>
  const leftPdf = leftEntry.pdfPath;   // e.g. "/papers/gcse_revision.pdf"
  const rightPdf = rightEntry.pdfPath; // e.g. "/papers/gcse_revision.pdf"

  return (
    <main
      style={{
        background: "#f8f7f3",
        minHeight: "100dvh",
        height: "100dvh",
        width: "100vw",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Two-column area */}
      <div
        aria-label="PDF compare container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: 8,
          height: "100dvh",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT pane */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <header style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
            Left
          </header>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {!mounted ? (
              <div style={{ width: "100%", height: "100%", background: "#fff" }} />
            ) : isTouch ? (
              // Touch: use PDF.js canvases (scrollable)
              <div style={{ height: "100%", overflow: "auto" }}>
                <PDFJSViewer key={`left-${leftPdf}`} file={leftPdf} />
              </div>
            ) : (
              // Desktop: native PDF viewer (true PDF, scrollable)
              <object
                data={`${leftPdf}#view=FitH`}
                type="application/pdf"
                aria-label="Left PDF"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                  background: "#fff",
                }}
              >
                <div style={{ padding: 16 }}>
                  <p>Inline PDF viewer isn’t available here.</p>
                  <p>
                    <a href={leftPdf} target="_blank" rel="noreferrer">
                      Open the document
                    </a>
                  </p>
                </div>
              </object>
            )}
          </div>
        </div>

        {/* RIGHT pane */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <header style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
            Right
          </header>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {!mounted ? (
              <div style={{ width: "100%", height: "100%", background: "#fff" }} />
            ) : isTouch ? (
              <div style={{ height: "100%", overflow: "auto" }}>
                <PDFJSViewer key={`right-${rightPdf}`} file={rightPdf} />
              </div>
            ) : (
              <object
                data={`${rightPdf}#view=FitH`}
                type="application/pdf"
                aria-label="Right PDF"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  display: "block",
                  background: "#fff",
                }}
              >
                <div style={{ padding: 16 }}>
                  <p>Inline PDF viewer isn’t available here.</p>
                  <p>
                    <a href={rightPdf} target="_blank" rel="noreferrer">
                      Open the document
                    </a>
                  </p>
                </div>
              </object>
            )}
          </div>
        </div>
      </div>

      {/* Bottom-center Dialogue widget (same as single page) */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          paddingLeft: "max(8px, env(safe-area-inset-left))",
          paddingRight: "max(8px, env(safe-area-inset-right))",
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
            background: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "saturate(1.2) blur(6px)",
            WebkitBackdropFilter: "saturate(1.2) blur(6px)",
            border: "1px solid #b01c2e",
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
            style={{ display: "grid", placeItems: "center", margin: "-2px 0 8px", cursor: "pointer" }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(0,0,0,.18)" }} />
          </div>

          {agentId && (
            <DialogueBar agentId={agentId} useSignedUrl={useSignedUrl} serverLocation={region} />
          )}

          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#6b7280",
              display: expanded ? "block" : "none",
            }}
          >
            Tip: Ask questions while you read. Collapse this panel anytime.
          </div>
        </div>
      </div>

      {debug && <MobileConsole enabled={true} />}
    </main>
  );
}