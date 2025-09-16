"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

type Props = {
  file: string; // url to the PDF (direct or through your /api/pdf-proxy)
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

function pickWorkerSrc(): string {
  // Prefer classic, fallback to ESM (depends on what you copied to /public/pdfjs)
  const classic = "/pdfjs/pdf.worker.min.js";
  const esm = "/pdfjs/pdf.worker.min.mjs";
  // @ts-ignore
  if (typeof window !== "undefined" && window.location) {
    // we can’t statically check; try classic first
    return classic;
  }
  return classic;
}

export default function PDFJSViewer({ file, onDebug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");

        // Configure worker
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  new URL("/pdfjs/pdf.worker.min.js", window.location.origin).toString();

const loadingTask = (pdfjsLib as any).getDocument({
  url: file,
  withCredentials: false, // keep it false unless you truly need cookies
});

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        onDebug?.("pdfjs:onLoadSuccess", { numPages: pdf.numPages });

        setStatus("ready");

  const host = containerRef.current;
if (!host) return;
host.innerHTML = "";

        // Responsive scale per page
        const calcScale = (vw: number) => {
          // fit-ish width for typical A4
          return Math.max(0.8, Math.min(2.0, vw / 900));
        };

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });
          const scale = calcScale(window.innerWidth);

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          const context = canvas.getContext("2d")!;
          const vp = page.getViewport({ scale });

          canvas.width = vp.width;
          canvas.height = vp.height;

          const renderTask = page.render({ canvasContext: context, viewport: vp });
          await renderTask.promise;
          host.appendChild(canvas);
        };

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          await renderPage(i);
        }

        // Re-render on resize (debounced)
        let t: any;
        const onResize = () => {
          clearTimeout(t);
          t = setTimeout(async () => {
            if (cancelled) return;
            try {
              host.innerHTML = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                if (cancelled) return;
                await renderPage(i);
              }
            } catch (e) {
              // ignore
            }
          }, 150);
        };
        window.addEventListener("resize", onResize);
        return () => {
          window.removeEventListener("resize", onResize);
          try {
            // @ts-ignore
            pdf.cleanup?.();
            // @ts-ignore
            pdf.destroy?.();
          } catch {}
        };
      } catch (e: any) {
        const msg = e?.message || String(e);
        setErrMsg(msg);
        setStatus("error");
        onDebug?.("pdfjs:onLoadError", { message: msg });
      }
    }

    run();

    return () => {
      cancelled = true;
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