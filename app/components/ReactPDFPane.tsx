"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Use a CDN worker (works on Vercel)
pdfjs.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function ReactPDFPane({ file }: { file: string }) {
  const [numPages, setNumPages] = useState<number>(0);

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
      <Document file={file} onLoadSuccess={(info) => setNumPages(info.numPages)}>
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={Math.min(1200, typeof window !== "undefined" ? window.innerWidth : 1200)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        ))}
      </Document>
    </div>
  );
}