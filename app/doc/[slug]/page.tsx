"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBar";
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

      {/* Bottom-center overlayed Dialogue widget */}
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
          {/* drag/expand affordance */}
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
            Tip: Ask questions while you read. Collapse this panel anytime.
          </div>
        </div>
      </div>
    </main>
  );
}