// app/report/uk-spending/report-client.tsx
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

// ---- helpers ----
function cssEscape(s: string) {
  // @ts-ignore
  const esc = (globalThis as any).CSS?.escape;
  if (typeof esc === "function") return esc(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

const STOPWORDS = new Set([
  "the","a","an","of","and","to","in","for","on","by","as","with","at","from","over","across",
  "this","that","these","those","is","are","was","were","be","been","it","its","into"
]);

function tokenizeQuery(q: string): string[] {
  const raw = q.toLowerCase().replace(/[.,()%/]/g, " ");
  const toks = raw.split(/\s+/).filter(Boolean);
  const kept = toks.filter(t => t.length >= 3 && !STOPWORDS.has(t)).slice(0, 12);
  console.log("[hl] tokens:", kept);
  return kept;
}

function clearHighlights(root: HTMLElement) {
  const marks = Array.from(root.querySelectorAll("mark[data-hl]"));
  console.log("[hl] clearing marks:", marks.length);
  for (const m of marks) {
    const parent = m.parentNode as HTMLElement | null;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(m.textContent || ""), m);
    parent.normalize();
  }
}

function highlightTerms(scopeEl: HTMLElement, query: string) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    console.log("[hl] no tokens; skip");
    return;
  }
  const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  console.log("[hl] regex:", String(pattern));

  const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  const toWrap: Text[] = [];
  let visited = 0;

  while ((node = walker.nextNode())) {
    visited++;
    const t = node as Text;
    if (!t.nodeValue) continue;
    if (pattern.test(t.nodeValue)) {
      toWrap.push(t);
    }
    pattern.lastIndex = 0;
  }

  console.log("[hl] visited:", visited, " wrap:", toWrap.length);

  let wrappedPieces = 0;
  for (const textNode of toWrap) {
    const frag = document.createDocumentFragment();
    const parts = (textNode.nodeValue || "").split(pattern);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i % 2 === 1) {
        const mark = document.createElement("mark");
        mark.setAttribute("data-hl", "1");
        mark.textContent = part;
        frag.appendChild(mark);
        wrappedPieces++;
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  console.log("[hl] wrapped pieces:", wrappedPieces);
}

export default function ReportClient({ combinedHtml }: { combinedHtml: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // 👇 Inject the full report HTML ONCE, and never let React touch it again.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = combinedHtml;
    }
    // do not add combinedHtml to deps; we want a single inject
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpToTarget(opts: { sectionId?: string; headingText?: string; query?: string }) {
    const root = containerRef.current;
    if (!root) { console.log("[jump] no root"); return false; }

    let el: HTMLElement | null = null;

    // 1) section id (from chunk filename)
    if (opts.sectionId) {
      const sel = `section#${cssEscape(opts.sectionId)}`;
      el = root.querySelector<HTMLElement>(sel);
      if (el) console.log("[jump] by section id:", sel);
    }

    // 2) heading id
    if (!el && opts.headingText) {
      const slug = slugify(opts.headingText);
      const selExact = `#${cssEscape(opts.headingText)}`;
      const selSlug = `#${cssEscape(slug)}`;
      el = root.querySelector<HTMLElement>(selExact) || root.querySelector<HTMLElement>(selSlug);
      if (el) console.log("[jump] by heading id:", (el as HTMLElement).id || "(no id)");
    }

    // 3) heading text
    if (!el && opts.headingText) {
      const needle = opts.headingText.trim().toLowerCase();
      const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"));
      const match = headings.find((h) => {
        const ht = h as HTMLElement;
        return ht.innerText.trim().toLowerCase() === needle;
      });
      el = (match as HTMLElement) || null;
      if (el) console.log("[jump] by heading text:", (el as HTMLElement).innerText.slice(0, 60));
    }

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });

      // Determine scope to highlight (closest section is best)
      const scope = (el.closest("section") as HTMLElement) || el;

      // 🔄 Clear previous highlight + marks (if any)
      if (lastTargetRef.current && lastTargetRef.current !== scope) {
        lastTargetRef.current.classList.remove("jump-highlight");
        clearHighlights(lastTargetRef.current);
      } else if (lastTargetRef.current === scope) {
        // same target as last time: just clear old marks within scope
        clearHighlights(scope);
      }

      // ✅ Persist new highlight until next query
      scope.classList.add("jump-highlight");
      if (opts.query) highlightTerms(scope, opts.query);

      lastTargetRef.current = scope;
      return true;
    }

    console.log("[jump] no target found for", opts);
    return false;
  }

  async function retrieve(query: string, namespace = "uk_spending") {
    if (!query?.trim()) return;
    setLoading(true);
    console.log("[retrieve] query:", query);
    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 5, namespace })
      });
      const data = await res.json();
      console.log("[retrieve] matches:", (data?.matches?.length ?? 0));

      const top = data?.matches?.[0];
      const sectionId = top?.id as string | undefined;
      const headingText = top?.section as string | undefined;
      console.log("[retrieve] top.id:", sectionId || "(none)", " top.section:", headingText || "(none)");

      const ok = jumpToTarget({ sectionId, headingText, query });
      if (!ok) console.log("[retrieve] jump failed");
    } catch (e: any) {
      console.log("[retrieve] error:", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q;
    setQ(""); // clear input
    await retrieve(query);
  }

  function handleVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("SpeechRecognition not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-GB";
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQ("");
      retrieve(transcript);
    };
    rec.start();
  }

  return (
    <main
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: 16,
        padding: 16,
        background: "#f8f7f3",
        minHeight: "100dvh"
      }}
    >
      {/* Full report (React never re-writes this DOM after mount) */}
      <div
        ref={containerRef}
        style={{
          border: "1px solid rgba(0,0,0,.1)",
          borderRadius: 12,
          background: "#fff",
          padding: 16,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          scrollBehavior: "smooth"
        }}
      />

      {/* Minimal query box */}
      <div>
        <h2 style={{ marginTop: 0 }}>Ask about this report</h2>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g., Jump to housing vs healthcare capital spending"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,.12)" }}
          />
          <button
            type="submit"
            disabled={!q || loading}
            style={{ padding: "10px 14px", borderRadius: 8, background: "#0b3b3c", color: "#fff", border: "none" }}
          >
            {loading ? "Finding…" : "Go"}
          </button>
        </form>
        <button
          onClick={handleVoice}
          style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#e0e0e0", border: "none" }}
        >
          🎤 Ask by Voice
        </button>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          The page will scroll and highlight the most relevant section.
        </p>
      </div>

      <style>{`
        /* persistent section highlight until next query */
        .jump-highlight {
          outline: 2px solid rgba(59, 157, 255, 0.85);
          outline-offset: 4px;
          background-image: linear-gradient(to bottom, rgba(255, 235, 59, 0.1), transparent 60%);
        }
        /* persistent keyword highlights */
        mark[data-hl] {
          background: #3b6fffff;
          padding: 0 .15em;
          border-radius: 2px;
        }
        /* helpful if you have a sticky header */
        h1, h2, h3, h4, h5, h6, section {
          scroll-margin-top: 72px;
        }
      `}</style>
    </main>
  );
}