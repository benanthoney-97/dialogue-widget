declare module "pdfjs-dist/webpack" {
  const pdfjs: any; // minimal stub; we only need runtime
  export = pdfjs;
}

declare module "pdfjs-dist/build/pdf" {
  import type * as pdfjs from "pdfjs-dist";
  export = pdfjs;
}