// app/components/PDFJSViewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
// ✅ Use the legacy browser build to avoid Node "canvas" dependency
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

type Props = {
  /** URL to the PDF (can be direct or via your /api/pdf-proxy) */
  file: string;
  /** Optional logger */
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

export default function PDFJSViewer({ file, onDebug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfRef = useRef<any>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  // Configure worker once
  useEffect(() => {
    try {
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
      onDebug?.("pdfjs:workerConfigured", { workerSrc: "/pdfjs/pdf.worker.min.js" });
    } catch {
      // ignore
    }
  }, [onDebug]);

  useEffect(() => {
    let cancelled = false;

    async function loadAndRender() {
      setStatus("loading");
      setErrMsg("");

      try {
        // Load PDF
        const loadingTask = (pdfjsLib as any).getDocument({
          url: file,
          // You can add more options here if needed (cMapUrl, standardFontDataUrl, etc.)
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        onDebug?.("pdfjs:onLoadSuccess", { numPages: pdf.numPages });

        const host = containerRef.current!;
        host.innerHTML = ""; // clear any previous render
        setStatus("ready");

        // simple, responsive page scaling
        const calcScale = (vw: number) => {
          // ~fit for typical A4 at various device widths
          return Math.max(0.9, Math.min(2.0, vw / 900));
        };

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const scale = calcScale(window.innerWidth);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderTask = page.render({ canvasContext: ctx, viewport });
          await renderTask.promise;
          host.appendChild(canvas);
        };

        // Initial render of all pages
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          await renderPage(i);
        }

        // Re-render on resize (debounced)
        let t: ReturnType<typeof setTimeout> | null = null;
        const onResize = () => {
          if (t) clearTimeout(t);
          t = setTimeout(async () => {
            if (cancelled || !pdfRef.current) return;
            try {
              host.innerHTML = "";
              for (let i = 1; i <= pdfRef.current.numPages; i++) {
                if (cancelled) return;
                await renderPage(i);
              }
            } catch (e) {
              // ignore render errors on resize
            }
          }, 150);
        };
        window.addEventListener("resize", onResize);

        return () => {
          window.removeEventListener("resize", onResize);
        };
      } catch (e: any) {
        const msg = e?.message || String(e);
        setErrMsg(msg);
        setStatus("error");
        onDebug?.("pdfjs:onLoadError", { message: msg });
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      try {
        // Cleanup pdf instance if present
        pdfRef.current?.cleanup?.();
        pdfRef.current?.destroy?.();
      } catch {
        // ignore
      }
      pdfRef.current = null;
    };
  }, [file, onDebug]);

  return (
    <div
      ref={containerRef}
      aria-label="PDF"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        background: "#fff",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {status === "loading" && (
        <div style={{ padding: 16 }}>Loading PDF…</div>
      )}
      {status === "error" && (
        <div style={{ padding: 16, color: "#b91c1c" }}>
          Failed to load PDF. {errMsg ? `(${errMsg})` : ""}
        </div>
      )}
    </div>
  );
}