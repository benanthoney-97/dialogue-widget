"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import Topbar from "@/app/components/Topbar";
import { TOPBAR_HEIGHT } from "@/app/components/topbarHeight";
import HistorySidebar from "@/app/app/[clientSlug]/HistorySidebar";

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
  const historyHref = clientSlug ? `/app/${clientSlug}/history` : "/app/history";

  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  const openHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(true);
  }, []);

  const closeHistoryPanel = useCallback(() => {
    setHistoryPanelOpen(false);
  }, []);

  useEffect(() => {
    setHistoryPanelOpen(false);
  }, [pathname]);

  const topbarNavLinks = useMemo(() => {
    if (isExploreRoute) {
      if (!clientSlug) {
        return [{ label: "Explore", href: "/app/explore" }];
      }
      return [{ label: "Explore", href: `/app/${clientSlug}/explore` }];
    }

    if (isChatRoute || isInterviewRoute) {
      return [];
    }

    return [{ label: "My history", href: historyHref, onClick: openHistoryPanel }];
  }, [clientSlug, historyHref, isChatRoute, isExploreRoute, isInterviewRoute, openHistoryPanel]);

  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    background: "transparent",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
    textDecoration: "none",
  };

  const interviewIcon = (
    <svg
      aria-hidden="true"
      width={16}
      height={16}
      viewBox="0 0 32 32"
      fill="none"
      style={{ display: "block" }}
    >
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
  );

  const interviewChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={chatHref} prefetch={false} style={chipStyle}>
        Chat
      </Link>
    </div>
  );

  const chatPageChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={interviewHref} prefetch={false} style={chipStyle}>
        {interviewIcon}
        Interview
      </Link>
    </div>
  );

  const questionnaireChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={chatHref} prefetch={false} style={chipStyle}>
        Chat
      </Link>
    </div>
  );

  const historyTrigger = (
    <button
      type="button"
      onClick={openHistoryPanel}
      aria-expanded={historyPanelOpen ? "true" : "false"}
      aria-controls="portal-history-panel"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(15,23,42,0.06)",
        color: "#0f172a",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.2px",
        fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
        border: "1px solid rgba(15,23,42,0.12)",
        cursor: "pointer",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        boxShadow: historyPanelOpen ? "0 10px 24px rgba(15,23,42,0.14)" : "none",
        transform: historyPanelOpen ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 1 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width={16}
          height={16}
          fill="currentColor"
          style={{ display: "block", color: "rgba(15, 23, 42, 0.85)" }}
        >
          <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022z" />
          <path d="M10.519 1.47a7 7 0 0 0-.985-.299l.219-.976a8.02 8.02 0 0 1 1.126.342z" />
          <path d="M11.889 2.18a7 7 0 0 0-.439-.27l.493-.87a8 8 0 0 1 .979.654l-.615.789a7 7 0 0 0-.418-.302z" />
          <path d="M13.723 3.97a7 7 0 0 0-.653-.796l.724-.69q.406.429.747.91z" />
          <path d="M14.467 5.322a7 7 0 0 0-.214-.468l.893-.45a8 8 0 0 1 .45 1.088l-.95.313a7 7 0 0 0-.179-.483z" />
          <path d="M14.997 7.829a7 7 0 0 0-.1-1.025l.985-.17q.1.58.116 1.17z" />
          <path d="M14.866 9.367q.05-.254.081-.51l.993.123a8 8 0 0 1-.23 1.155l-.964-.267q.069-.247.12-.501z" />
          <path d="M13.914 11.746q.276-.436.486-.908l.914.405q-.24.54-.555 1.038z" />
          <path d="M12.95 12.951q.183-.183.35-.378l.758.653a8 8 0 0 1-.401.432z" />
          <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0z" />
          <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5z" />
        </svg>
      </span>
      <span style={{ lineHeight: 1 }}>History</span>
    </button>
  );

  const topbarRightSlot = isInterviewRoute
    ? interviewChips
    : isChatRoute
    ? chatPageChips
    : isQuestionnaireRoute
    ? questionnaireChips
    : undefined;
  const topbarTitleHref = clientSlug ? `/app/${clientSlug}/explore` : "/app/explore";
  const clientTitleElement = clientDisplayName
    ? topbarTitleHref
      ? (
          <Link
            href={topbarTitleHref}
            prefetch={false}
            style={{ textDecoration: "none", color: "inherit", display: "inline-flex" }}
          >
            <span
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#052033",
                fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
              }}
            >
              {clientDisplayName}
            </span>
          </Link>
        )
      : (
          <span
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: "#052033",
              fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
            }}
          >
            {clientDisplayName}
          </span>
        )
    : null;

  const shouldShowLeadingControls = isExploreRoute || isChatRoute || isInterviewRoute;

  const topbarLeadingSlot = shouldShowLeadingControls
    ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {clientTitleElement}
          {historyTrigger}
        </div>
      )
    : undefined;
  const mainMaxWidth = isQuestionnaireRoute ? "100%" : "1160px";
  const mainPadding = isQuestionnaireRoute ? "32px 48px 48px" : "32px 24px 48px";
  const mainHorizontalMargins: CSSProperties = {
    marginLeft: isQuestionnaireRoute ? "0" : "auto",
    marginRight: isQuestionnaireRoute ? "0" : "auto",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f7fb",
        color: "#0f172a",
        overflowX: "hidden",
        ["--panel" as unknown as string]: "#f4f7fb",
      }}
    >
      <Topbar
        title={clientDisplayName}
        titleHref={topbarTitleHref}
        hideCadenceControls
        offsetLeft={0}
        leadingSlot={topbarLeadingSlot}
        rightSlot={topbarRightSlot}
        navLinks={topbarNavLinks}
      />
      <HistorySidebar isOpen={historyPanelOpen} onCloseAction={closeHistoryPanel} />
      <main
        style={{
          ...mainHorizontalMargins,
          maxWidth: mainMaxWidth,
          padding: mainPadding,
          marginTop: TOPBAR_HEIGHT,
          minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          overflow: "visible",
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
