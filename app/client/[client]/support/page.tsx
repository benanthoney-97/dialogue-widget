"use client";

import Sidebar from "../Sidebar";

export default function SupportPage() {
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "min(420px, 90%)",
            background: "#192447",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(10,22,40,0.45)",
            padding: 32,
            textAlign: "center",
            color: "#e6eaff",
          }}
        >
          <h2 style={{ marginBottom: 16, fontSize: 24, fontWeight: 700 }}>Support</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#a3c0ff", margin: 0 }}>
            Contact <a href="mailto:support@dialogue-ai.co" style={{ color: "#ffffff", textDecoration: "underline" }}>support@dialogue-ai.co</a> or call us on{" "}
            <a href="tel:+447956215839" style={{ color: "#ffffff", textDecoration: "underline" }}>+44&nbsp;7956&nbsp;215&nbsp;839</a>. We'll get back to you in no time!
          </p>
        </div>
      </div>
    </main>
  );
}
