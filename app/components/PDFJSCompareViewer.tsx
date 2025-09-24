// app/components/PDFJSCompareViewer.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  leftFile: string;
  rightFile: string;
  leftTitle?: string;
  rightTitle?: string;
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
  let node = el.lastChild;
  while (node) {
    const prev = node?.previousSibling ?? null;
    try { if (node) el.removeChild(node); } catch {}
    node = prev as ChildNode | null;
  }
}

export default function PDFJSCompareViewer({
  leftFile,
  rightFile,
  leftTitle = "Left",
  rightTitle = "Right",
}: Props) {
  const leftHostRef = useRef<HTMLDivElement | null>(null);
  const rightHostRef = useRef<HTMLDivElement | null>(null);

  const leftPdfRef = useRef<any>(null);
  const rightPdfRef = useRef<any>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let active = true;
    const token = Symbol("compare-render");

    async function run() {
      try {
        setStatus("loading");
        await loadScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) throw new Error("pdfjsLib not found");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";

        const [leftTask, rightTask] = [
          pdfjsLib.getDocument({ url: leftFile }),
          pdfjsLib.getDocument({ url: rightFile }),
        ];

        const [leftPdf, rightPdf] = await Promise.all([leftTask.promise, rightTask.promise]);
        if (!active) return;

        leftPdfRef.current = leftPdf;
        rightPdfRef.current = rightPdf;

        const leftHost = leftHostRef.current!;
        const rightHost = rightHostRef.current!;
        safeRemoveAllChildren(leftHost);
        safeRemoveAllChildren(rightHost);

        const scaleFor = (el: HTMLElement) =>
          Math.max(0.8, Math.min(2.5, (el.clientWidth || 600) / 900));

        async function renderAll(pdf: any, host: HTMLElement) {
          const scale = scaleFor(host);
          for (let i = 1; i <= pdf.numPages; i++) {
            if (!active) return;
            const page = await pdf.getPage(i);
            if (!active) return;
            const vp = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.style.display = "block";
            canvas.style.margin = "0 auto 16px";
            canvas.style.maxWidth = "100%";
            canvas.width = vp.width;
            canvas.height = vp.height;
            const ctx = canvas.getContext("2d")!;
            await page.render({ canvasContext: ctx, viewport: vp }).promise.catch(() => {});
            if (!active) return;
            host.appendChild(canvas);
          }
        }

        await Promise.all([renderAll(leftPdf, leftHost), renderAll(rightPdf, rightHost)]);
        if (!active) return;
        setStatus("ready");

        let t: any;
        const onResize = () => {
          clearTimeout(t);
          t = setTimeout(async () => {
            if (!active) return;
            safeRemoveAllChildren(leftHost);
            safeRemoveAllChildren(rightHost);
            await Promise.all([
              renderAll(leftPdfRef.current, leftHost),
              renderAll(rightPdfRef.current, rightHost),
            ]);
          }, 150);
        };
        window.addEventListener("resize", onResize);

        return () => window.removeEventListener("resize", onResize);
      } catch (e: any) {
        if (!active) return;
        setErrMsg(e?.message || String(e));
        setStatus("error");
      }
    }

    const cleanup = run();

    return () => {
      active = false;
      try { leftPdfRef.current?.cleanup?.(); leftPdfRef.current?.destroy?.(); } catch {}
      try { rightPdfRef.current?.cleanup?.(); rightPdfRef.current?.destroy?.(); } catch {}
      try { if (leftHostRef.current) safeRemoveAllChildren(leftHostRef.current); } catch {}
      try { if (rightHostRef.current) safeRemoveAllChildren(rightHostRef.current); } catch {}
      void cleanup;
    };
  }, [leftFile, rightFile]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        width: "100%",
        height: "100%",
        padding: 8,
        boxSizing: "border-box",
        background: "#fff",
      }}
    >
      <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <header style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
          {leftTitle}
        </header>
        <div
          ref={leftHostRef}
          style={{ overflow: "auto", flex: 1, padding: 8, border: "1px solid #eee", borderRadius: 8 }}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <header style={{ padding: "6px 8px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
          {rightTitle}
        </header>
        <div
          ref={rightHostRef}
          style={{ overflow: "auto", flex: 1, padding: 8, border: "1px solid #eee", borderRadius: 8 }}
        />
      </section>

      {status === "loading" && (
        <div style={{ gridColumn: "1 / span 2", padding: 12 }}>Loading PDFs…</div>
      )}
      {status === "error" && (
        <div style={{ gridColumn: "1 / span 2", padding: 12, color: "#b91c1c" }}>
          Failed to load PDF(s). {errMsg ? `(${errMsg})` : ""}
        </div>
      )}
    </div>
  );
}