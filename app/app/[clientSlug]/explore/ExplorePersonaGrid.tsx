"use client";

import { useMemo, useState } from "react";
import PersonaGallery, { type PersonaSummary } from "@/app/components/personas/PersonaGallery";
import InternalPersonaChip from "@/app/components/InternalPersonaChip";

type ExplorePersonaGridProps = {
  clientSlug: string;
  personas: PersonaSummary[];
  errorMessage: string | null;
};

export default function ExplorePersonaGrid({ clientSlug, personas, errorMessage }: ExplorePersonaGridProps) {
  const [showInternal, setShowInternal] = useState(false);

  const visiblePersonas = useMemo(() => {
    return personas.filter((persona) => {
      const status = (persona.customerStatus ?? "").trim().toLowerCase();
      const isInternal = status === "internal stakeholder";
      return showInternal ? isInternal : !isInternal;
    });
  }, [personas, showInternal]);

  console.log("[explore-grid] personas passed", personas.length, personas);
  console.log("[explore-grid] visiblePersonas", visiblePersonas.length, visiblePersonas);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        <InternalPersonaChip isToggled={showInternal} onToggleAction={() => setShowInternal((prev) => !prev)} />
      </div>
      <PersonaGallery
        clientSlug={clientSlug}
        personas={visiblePersonas}
        errorMessage={errorMessage}
      />
    </>
  );
}
