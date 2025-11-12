"use client";

import { useEffect, useRef, useState } from "react";
import DialogueText from "@/app/components/DialogueText";
import { supabase } from "@/app/lib/supabaseClient";

type ChatPanelProps = {
  agentId: string;
  personaName?: string | null;
  personaKeyTraits?: string[];
  personaIntentSignals?: string[];
  personaCustomerStatus?: string | null;
  personaKeyPainPoints?: string[];
  userId?: string;
  initialMessage?: string;
};

export default function ChatPanel({
  agentId,
  personaName,
  personaKeyTraits,
  personaIntentSignals,
  personaCustomerStatus,
  personaKeyPainPoints,
  userId,
  initialMessage,
}: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId ?? null);

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
        console.error("[ChatPanel] Failed to resolve user id", error);
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
  padding: "0 24px",
        flex: "1 1 auto",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <DialogueText
        agentId={agentId}
        personaName={personaName ?? undefined}
        personaKeyTraits={personaKeyTraits}
        personaIntentSignals={personaIntentSignals}
        personaCustomerStatus={personaCustomerStatus}
        personaKeyPainPoints={personaKeyPainPoints}
        userId={resolvedUserId ?? undefined}
        autoStart
        autoStartUserMessage={initialMessage}
      />
    </div>
  );
}
