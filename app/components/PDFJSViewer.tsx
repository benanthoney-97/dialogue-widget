"use client";

import { useEffect, useRef, useState, memo } from "react";

type Props = {
  file: string; // direct URL or /api/pdf-proxy?url=...
};

function loadScriptOnce(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any).__loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    (s as any).__loaded = false;
    s.addEventListener("load", () => {
      (s as any).__loaded = true;
      resolve();
    });
    s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(s);
  });
}

function safeRemoveAllChildren(el: HTMLElement) {
  // Avoid touching nodes React might own: only operate in our host subtree.
  // Remove one-by-one to avoid transient detach races with workers.
  let node = el.lastChild;
  while (node) {
    const prev = node.previousSibling;
    try {
      el.removeChild(node);
    } catch { /* ignore NotFoundError races */ }
    node = prev;
  }
}

function PDFJSViewerInner({ file }: Props) {
  const shellRef = useRef<HTMLDivElement | null>(null); // outer wrapper (React owns)
  const hostRef = useRef<HTMLDivElement | null>(null);  // inner host (we own)
  const renderTokenRef = useRef<symbol | null>(null);
  const pdfRef = useRef<any>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let active = true;
    const token = Symbol("renderToken");
    renderTokenRef.current = token;

    async function run() {
      try {
        setStatus("loading");

        // 1) Load PDF.js UMD
        await loadScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");

        // 2) Configure worker
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) throw new Error("pdfjsLib not found");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";

        // 3) Start loading
        const task = pdfjsLib.getDocument({ url: file });
        const pdf = await task.promise;
        if (!active || renderTokenRef.current !== token) return;
        pdfRef.current = pdf;

        // 4) Prepare host that React never touches
        const host = hostRef.current!;
        safeRemoveAllChildren(host);

        const scaleForWidth = (vw: number) => Math.max(0.9, Math.min(2, vw / 900));

        async function renderPage(num: number) {
          if (!active || renderTokenRef.current !== token) return;
          const page = await pdf.getPage(num);
          if (!active || renderTokenRef.current !== token) return;

          const scale = scaleForWidth(window.innerWidth);
          const vp = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 16px";
          canvas.style.maxWidth = "100%";
          canvas.width = vp.width;
          canvas.height = vp.height;

          const ctx = canvas.getContext("2d")!;
          const renderTask = page.render({ canvasContext: ctx, viewport: vp });

          await renderTask.promise.catch(() => {});
          if (!active || renderTokenRef.current !== token) return;
          // Append only if still current
          host.appendChild(canvas);
        }

        // 5) Render sequentially
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!active || renderTokenRef.current !== token) return;
          await renderPage(i);
        }

        if (!active || renderTokenRef.current !== token) return;
        setStatus("ready");

        // 6) Handle resize with token bump (cancel previous render set)
        let t: any;
        const onResize = () => {
          clearTimeout(t);
          t = setTimeout(async () => {
            if (!active) return;
            // Invalidate current renders by bumping token
            const newToken = Symbol("renderToken");
            renderTokenRef.current = newToken;

            // Clear canvases safely
            safeRemoveAllChildren(host);

            // Re-render pages under new token
            for (let i = 1; i <= pdf.numPages; i++) {
              if (!active || renderTokenRef.current !== newToken) return;
              await renderPage(i);
            }
          }, 150);
        };
        window.addEventListener("resize", onResize);

        // Cleanup
        return () => {
          window.removeEventListener("resize", onResize);
        };
      } catch (e: any) {
        if (!active) return;
        setErrMsg(e?.message || String(e));
        setStatus("error");
      }
    }

    const cleanupPromise = run();

    return () => {
      active = false;
      // Invalidate all pending renders
      renderTokenRef.current = null;
      // Stop and destroy pdf instance if any
      try {
        const pdf = pdfRef.current;
        pdfRef.current = null;
        pdf?.cleanup?.();
        pdf?.destroy?.();
      } catch {}
      // Clear host safely
      try {
        if (hostRef.current) safeRemoveAllChildren(hostRef.current);
      } catch {}
      // Await any pending effect cleanup
      void cleanupPromise;
    };
  }, [file]);

  return (
    <div
      ref={shellRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        background: "#fff",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {/* React owns shellRef but NOT this hostRef subtree */}
      <div ref={hostRef} />
      {status === "loading" && <div style={{ padding: 16 }}>Loading PDF…</div>}
      {status === "error" && (
        <div style={{ padding: 16, color: "#b91c1c" }}>
          Failed to load PDF. {errMsg ? `(${errMsg})` : ""}
        </div>
      )}
    </div>
  );
}

// Help avoid re-renders: only re-mount if `file` changes
const PDFJSViewer = memo(PDFJSViewerInner, (prev, next) => prev.file === next.file);
export default PDFJSViewer;

// Optional: tame Fast Refresh in dev to avoid mid-render races
if (typeof window !== "undefined" && (import.meta as any).hot) {
  (import.meta as any).hot.dispose?.(() => {
    // noop – effect cleanup in component will run
  });
}