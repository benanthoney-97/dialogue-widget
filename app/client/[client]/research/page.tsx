"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function ResearchPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);

  let workspaceLabel: string | null = null;
  if (clientSlug) {
    try {
      workspaceLabel = decodeURIComponent(clientSlug);
    } catch (error) {
      workspaceLabel = clientSlug;
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0a1628",
        padding: 0,
        fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div
        style={{
          flex: 1,
          background: "#16213a",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
          padding: 40,
          fontFamily: "inherit",
          position: "relative",
          minHeight: "100dvh",
          overflow: "auto",
          color: "#e6eaff",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Research</h1>
        <p style={{ fontSize: 16, color: "rgba(226,232,255,0.75)", marginBottom: 32 }}>
          {workspaceLabel
            ? `Research tools for workspace “${workspaceLabel}” are coming soon.`
            : "Research tools for this workspace are coming soon."}
        </p>
        <section
          style={{
            background: "rgba(15,23,42,0.85)",
            borderRadius: 20,
            border: "1px solid rgba(126,160,230,0.18)",
            padding: "32px 36px",
            maxWidth: 640,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>What’s next?</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(226,232,255,0.82)", fontSize: 15, lineHeight: 1.6 }}>
            <li>Publish upcoming research briefs and insights.</li>
            <li>Track active studies, interviews, and survey work.</li>
            <li>Stream documents into agents for rapid synthesis.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
