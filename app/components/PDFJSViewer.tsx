"use client";

import { useEffect, useRef, useState } from "react";
// ✅ Use legacy build to avoid the Node "canvas" dependency
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

type Props = {
  file: string; // URL to the PDF (direct or through your /api/pdf-proxy)
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

// Always load the classic worker
function pickWorkerSrc(): string {
  return "/pdfjs/pdf.worker.min.js";
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
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pickWorkerSrc();
        onDebug?.("pdfjs:configureWorker", { workerSrc: (pdfjsLib as any).GlobalWorkerOptions.workerSrc });

        const loadingTask = (pdfjsLib as any).getDocument({
          url: file,
          withCredentials: false,
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        onDebug?.("pdfjs:onLoadSuccess", { numPages: pdf.numPages });

        setStatus("ready");

        const host = containerRef.current!;
        host.innerHTML = ""; // clear previous

        // Responsive scale per page
        const calcScale = (vw: number) => {
          return Math.max(0.8, Math.min(2.0, vw / 900));
        };

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const scale = calcScale(window.innerWidth);
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          const context = canvas.getContext("2d")!;

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
            } catch {
              // ignore
            }
          }, 150);
        };
        window.addEventListener("resize", onResize);
        return () => {
          window.removeEventListener("resize", onResize);
          try {
            pdf.cleanup?.();
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
      {status === "loading" && <div style={{ padding: 16 }}>Loading PDF…</div>}
      {status === "error" && (
        <div style={{ padding: 16, color: "#b91c1c" }}>
          Failed to load PDF. {errMsg ? `(${errMsg})` : ""}
        </div>
      )}
    </div>
  );
}