declare module "pdfjs-dist/webpack" {
  import type * as pdfjsDist from "pdfjs-dist";
  const pdfjs: typeof pdfjsDist;
  export = pdfjs;
}

declare module "pdfjs-dist/build/pdf" {
  import type * as pdfjsDist from "pdfjs-dist";
  const pdfjs: typeof pdfjsDist;
  export = pdfjs;
}