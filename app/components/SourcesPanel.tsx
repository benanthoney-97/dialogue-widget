"use client";
export type SourceMatch = {
  id: string; score?: number; title?: string; report?: string;
  section?: string; provenance?: string; snippet?: string; path?: string;
};

export default function SourcesPanel({ matches }: { matches: SourceMatch[] }) {
  if (!matches?.length) {
    return (
      <div style={{ border:"1px solid rgba(0,0,0,.1)", borderRadius:12, padding:12 }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>Sources</div>
        <div style={{ fontSize:13, opacity:.7 }}>Ask a question to see sources here.</div>
      </div>
    );
  }
  return (
    <div style={{ border:"1px solid rgba(0,0,0,.1)", borderRadius:12, padding:12 }}>
      <div style={{ fontWeight:700, marginBottom:6 }}>Sources</div>
      <ul style={{ margin:0, padding:0, listStyle:"none", display:"grid", gap:10 }}>
        {matches.map(m => (
          <li key={m.id} style={{ padding:10, border:"1px solid rgba(0,0,0,.08)", borderRadius:8 }}>
            <div style={{ fontWeight:700 }}>{m.section || m.title || m.id}</div>
            {m.report && <div style={{ fontSize:12, opacity:.8 }}>{m.report}</div>}
            {m.snippet && <div style={{ marginTop:6, fontSize:13 }}>{m.snippet}</div>}
            <div style={{ marginTop:6, fontSize:12, opacity:.7 }}>
              {m.provenance}
              {m.path && <> · <a href={`file://${m.path}`} target="_blank" rel="noreferrer">open chunk</a></>}
            </div>
            {typeof m.score === "number" && <div style={{ fontSize:12, opacity:.6 }}>score: {m.score.toFixed(3)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}