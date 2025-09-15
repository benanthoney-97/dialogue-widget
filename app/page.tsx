"use client";
import { useState, useEffect, type FormEvent } from "react";
import SourcesPanel, { type SourceMatch } from "./components/SourcesPanel";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function jumpToHeading(headingTextOrId: string) {
  const id = document.getElementById(headingTextOrId)
    ? headingTextOrId
    : slugify(headingTextOrId);

  const el =
    document.getElementById(id) ||
    Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).find(
      (h) =>
        (h as HTMLElement).innerText.trim().toLowerCase() ===
        headingTextOrId.trim().toLowerCase()
    );
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Page() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SourceMatch[]>([]);
  const [reportHtml, setReportHtml] = useState<string>("");

  useEffect(() => {
    // Load the pre-generated combined report (static HTML)
    fetch("/reports/uk_spending_full.html")
      .then((res) => res.text())
      .then((html) => setReportHtml(html));
  }, []);

  async function retrieve(query: string, namespace = "uk_spending") {
    if (!query?.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 5, namespace })
      });
      const data = await res.json();
      setMatches(data?.matches || []);

      // auto-scroll
      const top = data?.matches?.[0];
      if (top?.section) jumpToHeading(top.section);
    } catch (e) {
      console.error(e);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await retrieve(q);
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, padding: 16 }}>
      {/* Report viewer */}
      <div
        style={{
          border: "1px solid rgba(0,0,0,.1)",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          maxHeight: "100dvh",
          overflowY: "scroll"
        }}
        dangerouslySetInnerHTML={{ __html: reportHtml }}
      />

      {/* Q&A panel */}
      <div>
        <h2>Ask a question</h2>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about healthcare, housing, etc."
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,.12)" }}
          />
          <button
            type="submit"
            disabled={!q || loading}
            style={{ padding: "10px 14px", borderRadius: 8, background: "#0b3b3c", color: "#fff", border: "none" }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        <SourcesPanel matches={matches} />
      </div>
    </main>
  );
}