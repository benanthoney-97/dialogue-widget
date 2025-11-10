"use client";

import { useEffect, useRef } from "react";
import PrepAgentDebug from "@/app/components/PrepAgentDebug";

type InterviewPanelProps = {
  agentId: string;
  talkLabel?: string | null;
  subtitle?: string | null;
  personaName?: string | null;
  profileImage?: string | null;
  userId?: string;
};

export default function InterviewPanel({
  agentId,
  talkLabel,
  subtitle,
  personaName,
  profileImage,
  userId,
}: InterviewPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  console.log("[InterviewPanel] render start", {
    agentId,
    talkLabel,
    subtitle,
    personaName,
    profileImage,
    userId,
  });
  console.log("[InterviewPanel] props", {
    agentId,
    talkLabel,
    subtitle,
    personaName,
    profileImage,
    userId,
  });
  console.log("[InterviewPanel] panelRef during render", panelRef.current);
  console.log("[InterviewPanel] PrepAgent reference", PrepAgentDebug);
  console.log(
    "[InterviewPanel] PrepAgent includes render log",
    typeof PrepAgentDebug === "function" &&
      String(PrepAgentDebug).includes("[PrepAgentDebug] component render start")
  );
  if (typeof PrepAgentDebug === "function") {
    const preview = String(PrepAgentDebug).slice(0, 320);
    console.log("[InterviewPanel] PrepAgent source preview", preview);
  }

  useEffect(() => {
    console.log("[InterviewPanel] mounted", { agentId });
    return () => {
      console.log("[InterviewPanel] unmounted", { agentId });
    };
  }, [agentId]);

  useEffect(() => {
    console.log("[InterviewPanel] panelRef after paint", panelRef.current);
  });

  return (
    <div
      ref={panelRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 24,
        padding: 24,
        minHeight: 420,
      }}
    >
      <PrepAgentDebug
        agentId={agentId}
        talkLabel={talkLabel ?? undefined}
        subtitle={subtitle ?? undefined}
        personaName={personaName ?? undefined}
        profileImage={profileImage ?? undefined}
        panelExpanded
        panelRootRef={panelRef}
        userId={userId}
        showVoiceControls={false}
      />
    </div>
  );
}
