"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: string; // direct URL or your /api/pdf-proxy?url=...
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

export default function PDFJSViewer({ file, onDebug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");

        // 🔑 Dynamic import so the server build never analyzes pdfjs (avoids 'canvas' resolution)
        const pdfjsLib: any = await import("pdfjs-dist/build/pdf");

        // Point worker to the file we copied to public/
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
        onDebug?.("pdfjs:configuredWorker", { workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc });

        const loadingTask = pdfjsLib.getDocument({ url: file, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        onDebug?.("pdfjs:onLoadSuccess", { numPages: pdf.numPages });
        setStatus("ready");

        const host = containerRef.current!;
        host.innerHTML = "";

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);

          // Simple responsive scale
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.max(0.8, Math.min(2.0, window.innerWidth / 900));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          const ctx = canvas.getContext("2d")!;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: ctx, viewport }).promise;
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
            } catch {}
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