// app/lib/highlight.ts
import "mark.js/dist/mark.min.js";
export function highlight(query: string) {
  const Mark = (window as any).Mark;
  const instance = new Mark(document.querySelector("main")!);
  instance.unmark(() => instance.mark(query, { separateWordSearch: true, acrossElements: true }));
}