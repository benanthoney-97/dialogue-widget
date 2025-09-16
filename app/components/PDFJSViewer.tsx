"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: string; // URL to the PDF (direct or via your /api/pdf-proxy)
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export default function PDFJSViewer({ file, onDebug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function ensurePdfJs(): Promise<any> {
      if (window.pdfjsLib) return window.pdfjsLib;

      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        // Lock to the same version you tested:
        script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
        script.async = true;
        script.onload = () => {
          if (window.pdfjsLib) {
            onDebug?.("pdfjs:loadedCdn");
            resolve(window.pdfjsLib);
          } else {
            reject(new Error("pdfjsLib not found after script load"));
          }
        };
        script.onerror = () => reject(new Error("Failed to load pdf.min.js from CDN"));
        document.head.appendChild(script);
      });
    }

    async function render() {
      try {
        setStatus("loading");
        const pdfjsLib = await ensurePdfJs();
        if (cancelled) return;

        // Point the worker to your hosted file:
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";
        onDebug?.("pdfjs:configureWorker", { workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc });

        const task = pdfjsLib.getDocument({ url: file, withCredentials: false });
        const pdf = await task.promise;
        if (cancelled) return;
        onDebug?.("pdfjs:onLoadSuccess", { numPages: pdf.numPages });

        setStatus("ready");
        const host = containerRef.current!;
        host.innerHTML = "";

        const calcScale = (vw: number) => Math.max(0.8, Math.min(2.0, vw / 900));

        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const vp = page.getViewport({ scale: calcScale(window.innerWidth) });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";

          const ctx = canvas.getContext("2d")!;
          canvas.width = vp.width;
          canvas.height = vp.height;

          const renderTask = page.render({ canvasContext: ctx, viewport: vp });
          await renderTask.promise;
          host.appendChild(canvas);
        };

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          await renderPage(i);
        }

        const onResize = () => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(async () => {
            try {
              if (cancelled) return;
              host.innerHTML = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                if (cancelled) return;
                await renderPage(i);
              }
            } catch {
              /* no-op */
            }
          }, 150);
        };

        window.addEventListener("resize", onResize);
        return () => {
          window.removeEventListener("resize", onResize);
          try {
            pdf.cleanup?.();
            pdf.destroy?.();
          } catch {
            /* no-op */
          }
        };
      } catch (e: any) {
        const msg = e?.message || String(e);
        setErrMsg(msg);
        setStatus("error");
        onDebug?.("pdfjs:onLoadError", { message: msg });
      }
    }

    const cleanupPromise = render();

    return () => {
      cancelled = true;
      // wait for possible cleanup from render()
      Promise.resolve(cleanupPromise).catch(() => {});
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