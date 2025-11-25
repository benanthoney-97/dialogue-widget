"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import SimulateOverlayContent from "@/app/components/SimulateOverlayContent";
import ChatIcon from "@/app/components/personas/ChatIcon";

type PersonaActionsProps = {
  clientSlug: string;
  personaSlug: string;
  personaName: string;
  personaId: string;
  clientId: number;
};

type PersonaAction = {
  label: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
};

export default function PersonaActions({ clientSlug, personaSlug, personaName, personaId, clientId }: PersonaActionsProps) {
  const [isSimulatePanelOpen, setIsSimulatePanelOpen] = useState(false);

  const actions: PersonaAction[] = [
    {
      label: "Chat",
      href: `/app/${clientSlug}/${personaSlug}/chat`,
      icon: <ChatIcon />,
    },
    {
      label: "Interview",
      href: `/app/${clientSlug}/${personaSlug}/interview`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#FFFFFF" viewBox="0 0 16 16">
          <path
            fillRule="evenodd"
            d="M8.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-2 2a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m-6 1.5A.5.5 0 0 1 5 6v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m8 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m-10 1A.5.5 0 0 1 3 7v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5m12 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5"
          />
        </svg>
      ),
    },
    {
      label: "Simulate",
      onClick: () => setIsSimulatePanelOpen(true),
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
        </svg>
      ),
    },
  ];

  useEffect(() => {
    console.log("[persona actions] mounted", { clientSlug, personaSlug, personaName, personaId, clientId });
  }, [clientId, clientSlug, personaId, personaName, personaSlug]);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: "auto",
        }}
      >
        {actions.map((action) => {
          const content = (
            <>
              {action.icon ? (
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
                  {action.icon}
                </span>
              ) : null}
              <span>{action.label}</span>
            </>
          );

          if (action.href) {
            return (
              <Link
                key={`persona-action-${action.label.toLowerCase()}`}
                href={action.href}
                data-persona-action-chip
                prefetch={false}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={`persona-action-${action.label.toLowerCase()}`}
              type="button"
              data-persona-action-chip
              onClick={action.onClick}
            >
              {content}
            </button>
          );
        })}
      </div>

      <SlidingPanelOverlay
        open={isSimulatePanelOpen}
        title={`Simulate research with ${personaName}`}
        description={`Prepare and run a simulated interview with ${personaName}.`}
        onRequestClose={() => setIsSimulatePanelOpen(false)}
        onAfterClose={() => setIsSimulatePanelOpen(false)}
      >
  <SimulateOverlayContent clientId={clientId} personaName={personaName} personaId={personaId} />
      </SlidingPanelOverlay>
    </>
  );
}
