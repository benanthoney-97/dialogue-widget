"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import SlidingPanelOverlay from "@/app/components/SlidingPanelOverlay";
import SimulateOverlayContent from "@/app/components/SimulateOverlayContent";

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
      icon: (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="12" r="7" fill="#7dd3fc" />
          <rect x="9" y="18" width="14" height="7" rx="3.5" fill="#38bdf8" />
          <path d="M16 25L12 29H20L16 25Z" fill="#0ea5e9" />
        </svg>
      ),
    },
    {
      label: "Interview",
      href: `/app/${clientSlug}/${personaSlug}/interview`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="4" width="8" height="18" rx="4" fill="#e9d5ff" />
          <path
            d="M10 14C10 18.4183 13.5817 22 18 22C22.4183 22 26 18.4183 26 14"
            stroke="#c084fc"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="14" y="23" width="4" height="5" rx="1.6" fill="#a855f7" />
          <rect x="10" y="28" width="12" height="2" rx="1" fill="#7c3aed" />
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
