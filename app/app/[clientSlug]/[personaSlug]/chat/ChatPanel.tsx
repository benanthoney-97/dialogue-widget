"use client";

import { useRef } from "react";
import DialogueText from "@/app/components/DialogueText";

type ChatPanelProps = {
  agentId: string;
  personaName?: string | null;
  personaKeyTraits?: string[];
  personaIntentSignals?: string[];
  personaCustomerStatus?: string | null;
  personaKeyPainPoints?: string[];
  userId?: string;
};

export default function ChatPanel({
  agentId,
  personaName,
  personaKeyTraits,
  personaIntentSignals,
  personaCustomerStatus,
  personaKeyPainPoints,
  userId,
}: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={panelRef}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 24,
  padding: "0 24px 64px",
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
        userId={userId}
      />
    </div>
  );
}
