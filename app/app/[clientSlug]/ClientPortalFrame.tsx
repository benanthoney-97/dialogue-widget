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
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
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

  const isPersonaDetailRoute = Boolean(personaSlug) && !isExploreRoute && !isChatRoute && !isInterviewRoute && !isQuestionnaireRoute;

  const topbarNavLinks = useMemo(() => {
    if (isExploreRoute) {
      if (!clientSlug) {
        return [{ label: "Explore", href: "/app/explore" }];
      }
      return [{ label: "Explore", href: `/app/${clientSlug}/explore` }];
    }

    if (isChatRoute || isInterviewRoute || isPersonaDetailRoute) {
      return [];
    }

    return [];
  }, [clientSlug, isChatRoute, isExploreRoute, isInterviewRoute, isPersonaDetailRoute]);

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
    fontFamily: BODY_FONT_STACK,
    textDecoration: "none",
  };

  const interviewIcon = (
    <svg
      aria-hidden="true"
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="#1A2A44"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path d="M8.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-2 2a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m-6 1.5A.5.5 0 0 1 5 6v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m8 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m-10 1A.5.5 0 0 1 3 7v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5m12 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5" />
    </svg>
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
        background: "transparent",
        color: "#0f172a",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.2px",
        fontFamily: BODY_FONT_STACK,
        border: "none",
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

  const leadingLinkStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 12px",
    borderRadius: 999,
    background: "transparent",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.2px",
    fontFamily: BODY_FONT_STACK,
    textDecoration: "none",
    transition: "transform 120ms ease, box-shadow 120ms ease",
  };

  const questionnaireChips = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Link href={chatHref} prefetch={false} style={chipStyle}>
        Chat
      </Link>
    </div>
  );

  const interviewLeadingLink = isChatRoute
    ? (
        <Link
          href={interviewHref}
          prefetch={false}
          style={leadingLinkStyle}
        >
          <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 1 }}>
            {interviewIcon}
          </span>
          <span style={{ lineHeight: 1 }}>Interview</span>
        </Link>
      )
    : null;

  const chatLeadingLink = isInterviewRoute
    ? (
        <Link href={chatHref} prefetch={false} style={leadingLinkStyle}>
          <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 1 }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="#1A2A44"
              style={{ display: "block" }}
            >
              <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />
              <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2" />
            </svg>
          </span>
          <span style={{ lineHeight: 1 }}>Chat</span>
        </Link>
      )
    : null;

  const topbarRightSlot = isInterviewRoute
    ? undefined
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
                fontFamily: HEADING_FONT_STACK,
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
              fontFamily: HEADING_FONT_STACK,
            }}
          >
            {clientDisplayName}
          </span>
        )
    : null;

  const shouldShowLeadingControls =
    isExploreRoute || isChatRoute || isInterviewRoute || isPersonaDetailRoute;

  const topbarLeadingSlot = shouldShowLeadingControls
    ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {clientTitleElement}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {historyTrigger}
            {interviewLeadingLink}
            {chatLeadingLink}
          </div>
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
