"use client";

import DialogueBar from "@/app/components/DialogueBar";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { agentMap } from "@/app/lib/agentMap";

export default function WidgetBySlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();

  // Resolution order: URL override → mapping → env default
  const mapped = agentMap[slug] || "";
  const agentId =
    sp.get("agentId") ??
    mapped ??
    process.env.NEXT_PUBLIC_EL_AGENT_ID ??
    "";

  const serverLocation =
    (sp.get("region") as
      | "us"
      | "eu-residency"
      | "in-residency"
      | "global"
      | null) ?? "us";

  // auth=signed (default) or auth=public
  const useSignedUrl = (sp.get("auth") ?? "signed") !== "public";

  // Auto-resize for iframe host
  useEffect(() => {
    if (typeof window === "undefined") return;
    const post = () =>
      window.parent?.postMessage(
        { type: "dialogue:resize", height: document.body.scrollHeight },
        "*"
      );
    post();
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    window.addEventListener("resize", post);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", post);
    };
  }, []);

  const missing = !agentId;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#f8f7f3",
      }}
    >
      <div style={{ width: "100%", maxWidth: 960 }}>
        {missing ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid rgba(0,0,0,.08)",
              color: "#b91c1c",
              fontWeight: 600,
            }}
          >
            No agent configured for slug <code>{slug}</code>. Provide{" "}
            <code>?agentId=</code> or add this slug to <code>agentMap</code>.
          </div>
        ) : (
          <DialogueBar
            agentId={agentId}
            useSignedUrl={useSignedUrl}
            serverLocation={serverLocation}
          />
        )}
      </div>
    </main>
  );
}