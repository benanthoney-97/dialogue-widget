"use client";

import { useEffect, useRef, useState } from "react";

type L = "log" | "info" | "warn" | "error";

export default function MobileConsole({ enabled }: { enabled: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const queueRef = useRef<{ level: L; msg: string }[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const push = (level: L, ...args: unknown[]) => {
      const msg = args
        .map((a) => (a instanceof Error ? `${a.name}: ${a.message}\n${a.stack ?? ""}` : typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      const line = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase()} ${msg}`;
      setLines((arr) => [...arr.slice(-120), line]);
      queueRef.current.push({ level, msg: line });
      // ship async; ignore errors
      navigator.sendBeacon?.("/api/moblog", new Blob([JSON.stringify({ level, msg })], { type: "application/json" }));
    };

    // Patch console
    const orig = { ...console };
    (["log", "info", "warn", "error"] as L[]).forEach((k) => {
      (console as any)[k] = (...args: unknown[]) => {
        try { push(k, ...args); } catch {}
        try { (orig as any)[k](...args); } catch {}
      };
    });

    // Global error listeners
    const onErr = (ev: ErrorEvent) => push("error", "window.error:", ev.message, ev.filename, ev.lineno, ev.colno, ev.error);
    const onRej = (ev: PromiseRejectionEvent) => push("error", "unhandledrejection:", ev.reason);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);

    return () => {
      (["log", "info", "warn", "error"] as L[]).forEach((k) => ((console as any)[k] = (orig as any)[k]));
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        right: 8,
        maxHeight: "45vh",
        overflow: "auto",
        background: "rgba(0,0,0,.78)",
        color: "#eaeaea",
        fontSize: 12,
        lineHeight: 1.2,
        borderRadius: 8,
        padding: 8,
        zIndex: 9999,
        pointerEvents: "auto",
      }}
    >
      <div style={{ opacity: 0.8, marginBottom: 6 }}>
        <strong>Mobile Console</strong> — tap page to interact, logs will appear here.
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: "pre-wrap" }}>
          {l}
        </div>
      ))}
    </div>
  );
}