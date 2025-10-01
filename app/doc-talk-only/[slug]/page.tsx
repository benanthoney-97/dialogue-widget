"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkButton";
import MobileConsole from "@/app/components/MobileConsole";
import { docMap } from "@/app/lib/docMap";
import { buttonThemeMap, defaultButtonTheme } from "@/app/lib/buttonThemeMap";

// Client-only PDF.js viewer
const PDFJSViewer = dynamic(() => import("@/app/components/PDFJSViewer"), {
  ssr: false,
});

export default function DocPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || "";
  const entry = useMemo(() => docMap[slug], [slug]);
  const sp = useSearchParams();
  const debug = sp?.get("debug") === "1";
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
  const { pdfPath, agentId, region = "us", auth = "signed" } = entry;
  const useSignedUrl = auth !== "public";

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

      {/* Bottom-right floating talk button */}
      <div
        style={{
          position: "fixed",
          bottom: "max(16px, env(safe-area-inset-bottom))",
          right: "max(16px, env(safe-area-inset-right))",
          zIndex: 60,
        }}
      >
        <DialogueBar
          agentId={agentId}
          useSignedUrl={useSignedUrl}
          serverLocation={region}
          buttonColor={theme.background}
          buttonTextColor={theme.text}
        />
      </div>

      {debug ? <MobileConsole enabled /> : null}
    </main>
  );
}
