"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DialogueBar from "@/app/components/DialogueBarTalkOnly";
import { docMap } from "@/app/lib/docMap";
import { buttonThemeMap, defaultButtonTheme } from "@/app/lib/buttonThemeMap";

export default function DialogueSitePage() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const entry = useMemo(() => (slug ? docMap[slug] : undefined), [slug]);
  const theme = buttonThemeMap[slug] ?? defaultButtonTheme;

  const queryAgent = sp?.get("agentId") ?? "";
  const agentId = queryAgent || entry?.agentId || "";
  const region = (sp?.get("region") as
    | "us"
    | "eu-residency"
    | "in-residency"
    | "global"
    | null) ?? entry?.region ?? "us";
  const auth = (sp?.get("auth") ?? entry?.auth ?? "signed") as
    | "signed"
    | "public";
  const talkLabel = entry?.talkLabel;
  const useSignedUrl = auth !== "public";

  if (!agentId) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#F6F7F9fff",
          padding: 16,
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,.1)",
            background: "#F6F7F9",
            color: "#b91c1c",
            fontWeight: 600,
          }}
        >
          Unknown dialogue slug: <code>{slug}</code>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#F6F7F9fff",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <DialogueBar
        agentId={agentId}
        useSignedUrl={useSignedUrl}
        serverLocation={region}
        buttonColor={theme.background}
        buttonTextColor={theme.text}
      />
    </main>
  );
}
