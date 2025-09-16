"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: string; // direct PDF URL (or your /api/pdf-proxy?url=...)
};

export default function PDFJSViewer({ file }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");

// inside useEffect
const pdfjsLib: any = await import("pdfjs-dist/webpack");
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument({ url: file, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const host = hostRef.current!;
        host.innerHTML = ""; // clear

        // Render each page to a canvas that scales to viewport width
        const renderPage = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          // Pick a scale that roughly fits mobile/desktop widths
          const base = 900; // px baseline
          const scale = Math.max(0.8, Math.min(2.0, window.innerWidth / base));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          const ctx = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderTask = page.render({ canvasContext: ctx, viewport });
          await renderTask.promise;
          host.appendChild(canvas);
        };

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          await renderPage(i);
        }

        // Re-render on resize (simple debounce)
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

        setStatus("ready");

        return () => {
          window.removeEventListener("resize", onResize);
          try {
            pdf.cleanup?.();
            pdf.destroy?.();
          } catch {}
        };
      } catch (e: any) {
        setErrMsg(e?.message || String(e));
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [file]);

  return (
    <div
      ref={hostRef}
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