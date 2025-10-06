"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkButton";
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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const pointerCoarse = matchMedia("(pointer: coarse)").matches;
      setIsTouch(pointerCoarse);
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener("resize", checkMobile);
      window.addEventListener("orientationchange", checkMobile);
      return () => {
        window.removeEventListener("resize", checkMobile);
        window.removeEventListener("orientationchange", checkMobile);
      };
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

  const { agentId, region = "us", talkLabel } = leftEntry;
  const useSignedUrl = (leftEntry.auth !== "public") || (rightEntry.auth !== "public");

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
      {/* Two-column area / mobile notice */}
      <div
        aria-label="PDF compare container"
        style={{
          position: "absolute",
          inset: 0,
          background: "#f0f0f0",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 8,
          padding: 8,
          height: "100dvh",
          boxSizing: "border-box",
          alignItems: isMobile ? "center" : undefined,
          justifyItems: isMobile ? "center" : undefined,
        }}
      >
        {isMobile ? (
          <div
            style={{
              maxWidth: 320,
              textAlign: "center",
              background: "rgba(255,255,255,0.9)",
              border: "1px solid #d1d5db",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            }}
          >
            <p style={{ fontSize: 16, color: "#111827", margin: 0 }}>
              You should have both documents in front of you.
            </p>
          </div>
        ) : (
          <>
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
                  <div style={{ height: "100%", overflow: "auto" }}>
                    <PDFJSViewer key={`left-${leftPdf}`} file={leftPdf} />
                  </div>
                ) : (
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
          </>
        )}
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
            width: "100%",
            maxWidth: 820,
            pointerEvents: "auto",
            marginBottom: 8,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {agentId && (
            <DialogueBar
              agentId={agentId}
              useSignedUrl={useSignedUrl}
              serverLocation={region}
              talkLabel={talkLabel}
            />
          )}
        </div>
      </div>

      {debug && <MobileConsole enabled={true} />}
    </main>
  );
}
