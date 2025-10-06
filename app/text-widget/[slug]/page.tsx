"use client";

import DialogueBar from "@/app/components/DialogueText";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { agentMap } from "@/app/lib/agentMap";
import {
  buttonThemeMap,
  defaultButtonTheme,
} from "@/app/lib/buttonThemeMap";
import { titleMap, defaultTitle } from "@/app/lib/titleMap";

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
  const {
    background: buttonColor,
    text: buttonTextColor,
    border: buttonBorderColor,
  } = buttonThemeMap[slug] ?? defaultButtonTheme;
  const title = titleMap[slug] ?? defaultTitle;

  return (
    <main
      style={{
        minHeight: "100dvh",
        position: "relative",
        background: "#ffffffff",
        margin: 0,
      }}
    >
      {missing ? (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: 16,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid rgba(0,0,0,.08)",
            color: "#b91c1c",
            fontWeight: 600,
            maxWidth: 480,
          }}
        >
          No agent configured for slug <code>{slug}</code>. Provide{" "}
          <code>?agentId=</code> or add this slug to <code>agentMap</code>.
        </div>
      ) : null}

      {!missing ? (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 100,
          }}
        >
          <DialogueBar
            agentId={agentId}
            useSignedUrl={useSignedUrl}
            serverLocation={serverLocation}
            buttonColor={buttonColor}
            buttonTextColor={buttonTextColor}
            buttonBorderColor={buttonBorderColor}
            title={title}
          />
        </div>
      ) : null}
    </main>
  );
}
