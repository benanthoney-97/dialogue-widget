"use client";

import { useEffect, useRef, useState } from "react";
// legacy build avoids Node 'canvas' dependency
// @ts-ignore – legacy build has no types
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

type Props = {
  file: string; // direct URL or /api/pdf-proxy?url=...
  onDebug?: (evt: string, meta?: Record<string, unknown>) => void;
};

function workerSrc() {
  // we ship this file at public/pdfjs/pdf.worker.min.js
  return "/pdfjs/pdf.worker.min.js";
}

export default function PDFJSViewer({ file, onDebug }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: any = null;
    let renderAbort = new AbortController();
    let pdfDoc: any = null;

    async function log(evt: string, meta?: Record<string, unknown>) {
      try {
        onDebug?.(evt, meta);
      } catch {}
    }

    function calcScale(viewportWidth: number) {
      // aim to fit width sensibly (A4 ~ 800–900 CSS px at 1x)
      return Math.max(0.8, Math.min(2.0, viewportWidth / 900));
    }

    async function renderAllPages(signal: AbortSignal) {
      const host = containerRef.current;
      if (!host) return;

      // Clear safely with a single operation (prevents removeChild races)
      try {
        host.replaceChildren();
      } catch {
        host.innerHTML = "";
      }

      const numPages: number = pdfDoc.numPages;
      const viewWidth = host.clientWidth || window.innerWidth;
      const scale = calcScale(viewWidth);

      for (let i = 1; i <= numPages; i++) {
        if (signal.aborted) return;

        const page = await pdfDoc.getPage(i);
        if (signal.aborted) return;

        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 16px";
        canvas.style.maxWidth = "100%";
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);

        // Append early so layout doesn’t shift all at once
        host.appendChild(canvas);

        const ctx = canvas.getContext("2d")!;
        const renderTask = page.render({ canvasContext: ctx, viewport: vp });

        // pdf.js renderTask has .promise; no abort, so we poll the signal
        await renderTask.promise;
        if (signal.aborted) return;
      }
    }

    async function loadAndRender() {
      try {
        setStatus("loading");

        // Configure worker
        // @ts-ignore
        (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc();

        const loadingTask = (pdfjsLib as any).getDocument({
          url: file,
          withCredentials: false,
        });

        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        await log("pdfjs:onLoadSuccess", { numPages: pdfDoc.numPages });
        setStatus("ready");

        // Initial render
        renderAbort.abort(); // cancel any prior
        renderAbort = new AbortController();
        await renderAllPages(renderAbort.signal);

        // Debounced resize re-render
        const onResize = () => {
          if (cancelled) return;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(async () => {
            try {
              renderAbort.abort();
              renderAbort = new AbortController();
              await renderAllPages(renderAbort.signal);
            } catch {}
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
        await log("pdfjs:onLoadError", { message: msg });
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      try {
        renderAbort.abort();
      } catch {}
      try {
        // @ts-ignore
        pdfDoc?.cleanup?.();
        // @ts-ignore
        pdfDoc?.destroy?.();
      } catch {}
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
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
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