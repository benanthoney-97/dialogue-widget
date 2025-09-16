"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type Props = {
  file: string; // can be a proxied URL
  onDebug?: (msg: string, meta?: Record<string, unknown>) => void;
};

export default function ReactPDFPane({ file, onDebug }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [vw, setVw] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100svh",
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        background: "#fff",
      }}
    >
      <Document
        file={{ url: file }} // use proxied URL
        loading={<div style={{ padding: 16 }}>Loading PDF…</div>}
        onLoadSuccess={(info) => {
          setNumPages(info.numPages);
          onDebug?.("pdfjs onLoadSuccess", { numPages: info.numPages });
        }}
        onLoadError={(err) => {
          onDebug?.("pdfjs onLoadError", { message: String(err) });
        }}
        onSourceError={(err) => {
          onDebug?.("pdfjs onSourceError", { message: String(err) });
        }}
        options={{
          cMapUrl: `//unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        }}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={Math.min(1200, vw)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading=""
          />
        ))}
      </Document>
    </div>
  );
}