"use client";

import { useEffect, useRef, useState } from "react";
import PrepAgentDebug from "@/app/components/PrepAgentDebug";
import { supabase } from "@/app/lib/supabaseClient";

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
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId ?? null);

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

  useEffect(() => {
    if (userId) {
      setResolvedUserId(userId);
      return;
    }

    let isMounted = true;

    async function fetchUserId() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (error || !data?.user?.id) {
          setResolvedUserId(null);
          return;
        }
        setResolvedUserId(data.user.id);
      } catch (error) {
        if (!isMounted) return;
        // eslint-disable-next-line no-console
        console.error("[InterviewPanel] Failed to resolve user id", error);
        setResolvedUserId(null);
      }
    }

    void fetchUserId();

    return () => {
      isMounted = false;
    };
  }, [userId]);

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
        userId={resolvedUserId ?? undefined}
        showVoiceControls={false}
      />
    </div>
  );
}
