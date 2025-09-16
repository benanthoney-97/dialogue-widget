"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.js";

type Props = {
  /** PDF URL (direct or proxied) */
  file: string;
  /** Optional hook to bubble debug info up to the page */
  onDebug?: (event: string, meta?: Record<string, unknown>) => void;
  /** Max width of the rendered canvas (auto fits container width) */
  maxWidth?: number;
};

export default function ReactPDFPane({ file, onDebug, maxWidth = 1200 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Log helper
  function log(evt: string, meta?: Record<string, unknown>) {
    onDebug?.(evt, { file, ...meta });
  }

  // Measure available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const w = Math.min(el.clientWidth, maxWidth);
      setPageWidth(w);
      log("pdfjs:measure", { width: w });
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();

    return () => ro.disconnect();
  }, [maxWidth]);

  // Initial log
  useEffect(() => {
    log("pdfjs:mount", { file });
    return () => log("pdfjs:unmount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const onLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setErrorMsg(null);
    log("pdfjs:onLoadSuccess", { numPages: n });
  };

  const onLoadError = (e: any) => {
    const msg = e?.message || String(e);
    setErrorMsg(msg);
    log("pdfjs:onLoadError", { message: msg });
  };

  const onSourceSuccess = () => {
    log("pdfjs:onSourceSuccess");
  };

  const onSourceError = (e: any) => {
    const msg = e?.message || String(e);
    setErrorMsg(msg);
    log("pdfjs:onSourceError", { message: msg });
  };

  const renderPages = useMemo(() => {
    if (!numPages || pageWidth <= 0) return null;
    const pages = [];
    for (let i = 1; i <= numPages; i++) {
      pages.push(
        <div key={i} style={{ margin: "0 auto 12px", width: "100%", display: "grid", placeItems: "center" }}>
          <Page
            pageNumber={i}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onRenderSuccess={() => log("pdfjs:onPageRenderSuccess", { page: i })}
            onRenderError={(e) => log("pdfjs:onPageRenderError", { page: i, message: e?.message || String(e) })}
          />
        </div>
      );
    }
    return pages;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, pageWidth]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "8px 0 120px", // leave room above the bottom overlay
        display: "block",
      }}
    >
      <Document
        file={file}
        loading={
          <div style={{ padding: 16, color: "#444" }}>
            Loading PDF…
          </div>
        }
        onLoadSuccess={onLoadSuccess}
        onLoadError={onLoadError}
        onSourceSuccess={onSourceSuccess}
        onSourceError={onSourceError}
        options={{
          // Improves CORS handling & range requests in many cases:
          cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/standard_fonts/`,
          withCredentials: false,
        }}
      >
        {errorMsg ? (
          <div style={{ padding: 16, color: "#b91c1c", background: "#fff", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>PDF load error</div>
            <div style={{ fontSize: 12 }}>{errorMsg}</div>
          </div>
        ) : (
          renderPages
        )}
      </Document>
    </div>
  );
}