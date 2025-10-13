"use client";
import Sidebar from "../Sidebar";

export default function SupportPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0a1628", padding: 0, fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif", display: 'flex', flexDirection: 'row' }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <Sidebar />
      </div>
      <div style={{ flex: 1, background: "#16213a", borderRadius: 16, boxShadow: "0 8px 32px rgba(10,22,40,0.45)", padding: 40, fontFamily: "inherit", position: 'relative', minHeight: '100dvh', overflow: 'auto' }}>
        {/* Support content will go here */}
      </div>
    </main>
  );
}
