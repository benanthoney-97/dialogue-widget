"use client";

import { type CSSProperties, type ReactNode, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import Topbar from "@/app/components/Topbar";
import { TOPBAR_HEIGHT } from "@/app/components/topbarHeight";

type ClientPortalFrameProps = {
  clientDisplayName: string;
  children: ReactNode;
};

export default function ClientPortalFrame({ clientDisplayName, children }: ClientPortalFrameProps) {
  const params = useParams<{ clientSlug?: string | string[]; personaSlug?: string | string[] }>();
  const pathname = usePathname();
  const clientSlug = Array.isArray(params?.clientSlug)
    ? params?.clientSlug?.[0] ?? ""
    : params?.clientSlug ?? "";
  const personaSlug = Array.isArray(params?.personaSlug)
    ? params?.personaSlug?.[0] ?? ""
    : params?.personaSlug ?? "";
  const isInterviewRoute = useMemo(() => pathname?.includes("/interview") ?? false, [pathname]);
  const isChatRoute = useMemo(() => pathname?.includes("/chat") ?? false, [pathname]);
  const isExploreRoute = useMemo(() => pathname?.endsWith("/explore") ?? false, [pathname]);
  const isQuestionnaireRoute = useMemo(() => pathname?.includes("/questionnaire") ?? false, [pathname]);
  const clientBasePath = clientSlug ? `/app/${clientSlug}` : "/app";
  const personaBasePath = personaSlug ? `${clientBasePath}/${personaSlug}` : clientBasePath;
  const interviewHref = `${personaBasePath}/interview`;
  const chatHref = `${personaBasePath}/chat`;
  const questionnaireHref = `${personaBasePath}/questionnaire`;

  const topbarNavLinks = useMemo(() => {
    if (!isExploreRoute) {
      return undefined;
    }
    if (!clientSlug) {
      return [
        { label: "Explore", href: "/app/explore" },
        { label: "FAQs", href: "/app/explore#faqs" },
        { label: "Speak to the team", href: "/app/explore#contact" },
      ];
    }
    return [
      { label: "Explore", href: `/app/${clientSlug}/explore` },
      { label: "FAQs", href: `/app/${clientSlug}/faqs` },
      { label: "Speak to the team", href: `/app/${clientSlug}/contact` },
    ];
  }, [clientSlug, isExploreRoute]);

  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.08)",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
    textDecoration: "none",
  };

  const interviewChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={chatHref} prefetch={false} style={chipStyle}>
        Chat
      </Link>
      <Link href={questionnaireHref} prefetch={false} style={chipStyle}>
        Questionnaire
      </Link>
    </div>
  );

  const chatPageChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={interviewHref} prefetch={false} style={chipStyle}>
        Interview
      </Link>
      <Link href={questionnaireHref} prefetch={false} style={chipStyle}>
        Questionnaire
      </Link>
    </div>
  );

  const questionnaireChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={chatHref} prefetch={false} style={chipStyle}>
        Chat
      </Link>
      <Link href={interviewHref} prefetch={false} style={chipStyle}>
        Interview
      </Link>
    </div>
  );

  const topbarRightSlot = isInterviewRoute
    ? interviewChips
    : isChatRoute
    ? chatPageChips
    : isQuestionnaireRoute
    ? questionnaireChips
    : isExploreRoute
    ? <></>
    : undefined;
  const topbarTitleHref = clientSlug ? `/app/${clientSlug}/explore` : "/app/explore";
  const mainMaxWidth = isQuestionnaireRoute ? "100%" : "1160px";
  const mainPadding = isQuestionnaireRoute ? "32px 48px 48px" : "32px 24px 48px";
  const mainHorizontalMargins: CSSProperties = {
    marginLeft: isQuestionnaireRoute ? "0" : "auto",
    marginRight: isQuestionnaireRoute ? "0" : "auto",
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#f4f7fb",
        color: "#0f172a",
        overflowX: "hidden",
        overflowY: "hidden",
        ["--panel" as unknown as string]: "#f4f7fb",
      }}
    >
      <Topbar
        title={clientDisplayName}
        titleHref={topbarTitleHref}
        hideCadenceControls
        offsetLeft={0}
        rightSlot={topbarRightSlot}
        navLinks={topbarNavLinks}
      />
      <main
        style={{
          ...mainHorizontalMargins,
          maxWidth: mainMaxWidth,
          padding: mainPadding,
          marginTop: TOPBAR_HEIGHT,
          height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 32,
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>
    </div>
  );
}
