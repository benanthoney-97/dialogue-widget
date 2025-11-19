"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type NavItem = { label: string; href: string; icon: React.ReactNode };

function getClientIdFromPath(pathname: string | null): string {
  if (!pathname) return "";
  // Match /client/CLIENTID/...
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function Sidebar() {
  const pathname = usePathname();
  const clientId = getClientIdFromPath(pathname);
  const router = useRouter();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileInitial, setProfileInitial] = useState("A");
  const [profileTooltipName, setProfileTooltipName] = useState("Anonymous");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredNavHref, setHoveredNavHref] = useState<string | null>(null);
  const profileDisplayName = profileName;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebarCollapsed");
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("sidebarCollapsed", collapsed ? "true" : "false");
    document.documentElement.style.setProperty(
      "--sidebar-width",
      collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)"
    );
    document.body.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  }, [collapsed]);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfileName() {
      setProfileName(null);
      setProfileRole(null);
      setProfileError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userError || !userData?.user) {
        const message = userError?.message ?? "Profile unavailable";
        setProfileError(message);
        setProfileName(null);
        setProfileRole(null);
        return;
      }

      const userId = userData.user.id;
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;

      const userMeta = (userData.user.user_metadata ?? {}) as { full_name?: string; name?: string };
      const fallbackName = userMeta.full_name ?? userMeta.name ?? userData.user.email ?? null;
      const displayName = profileData?.display_name ?? null;
      const roleValue = typeof profileData?.role === "string" ? profileData.role : null;
      const tooltipName = displayName ?? fallbackName ?? "Anonymous";
      const initialSource = displayName ?? userData.user.email ?? "A";

      if (profileError) {
        setProfileError(profileError.message ?? "Profile unavailable");
        setProfileRole(null);
        setProfileTooltipName(tooltipName);
        setProfileInitial((fallbackName ?? "A").charAt(0).toUpperCase());
        return;
      }
      setProfileName(displayName ?? null);
      setProfileRole(roleValue);
      setProfileError(null);
      setProfileTooltipName(tooltipName);
      setProfileInitial(initialSource.charAt(0).toUpperCase());
    }

    fetchProfileName();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleToggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Failed to sign out", err);
    }
    router.replace("/auth");
  };

  const interviewsItem = {
    label: "Interviews",
    href: `/client/${clientId}/interviews`,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="#22325A">
        <path
          fillRule="evenodd"
          d="M1 11.5a.5.5 0 0 0 .5.5h11.793l-3.147 3.146a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 11H1.5a.5.5 0 0 0-.5.5m14-7a.5.5 0 0 1-.5.5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H14.5a.5.5 0 0 1 .5.5"
        />
      </svg>
    ),
  };

  const insightsNavItem: NavItem = {
    label: "Insights",
    href: `/client/${clientId}/insights`,
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8 M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"
          fill="#22325A"
        />
        <path
          d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5 M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"
          fill="#22325A"
        />
      </svg>
    ),
  };

  const navItems = [
    {
      label: "Personas",
      href: `/client/${clientId}/personas`,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          fill="#22325a"
          stroke="#22325a"
          strokeWidth="0.6"
        >
          <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
          <path
            fillRule="evenodd"
            d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"
          />
        </svg>
      ),
    },
    {
      label: "Interviews",
      href: `/client/${clientId}/conversations`,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          fill="#22325a"
          stroke="#22325a"
          strokeWidth="0.6"
        >
          <path
            fillRule="evenodd"
            d="M8.5 2a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0v-11a.5.5 0 0 1 .5-.5m-2 2a.0.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m4 0a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5m-6 1.5A.5.5 0 0 1 5 6v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m8 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m-10 1A.5.5 0 0 1 3 7v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5m12 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V7a.5.5 0 0 1 .5-.5"
          />
        </svg>
      ),
    },
    insightsNavItem,
    {
      label: "New Persona",
      href: `/client/${clientId}/upload`,
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
          fill="#22325a"
          stroke="#22325a"
          strokeWidth="0.6"
        >
          <path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" />
          <path
            fillRule="evenodd"
            d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5"
          />
        </svg>
      ),
    },
  ];

  const visibleNavItems = profileRole === "viewer"
    ? navItems.filter((item) => item.label !== "New Persona")
    : navItems;

  const labelVisibilityStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    visibility: collapsed ? "hidden" : "visible",
    maxWidth: collapsed ? 0 : 160,
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: "opacity 0.18s ease, max-width 0.18s ease",
  };

  const navLeftPadding = collapsed ? 16 : 20;

  const teamItem = {
    label: "Team",
    href: `/client/${clientId}/teams`,
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        fill="#22325a"
        stroke="#22325a"
        strokeWidth="0.6"
      >
        <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
      </svg>
    ),
  };

  const liveHelpItem = {
    label: "Live Help",
    href: `/client/${clientId}/live-chat`,
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        fill="#22325a"
        stroke="#22325a"
        strokeWidth="0.4"
      >
        <path d="M2 3.5A2.5 2.5 0 0 1 4.5 1h7A2.5 2.5 0 0 1 14 3.5v4A2.5 2.5 0 0 1 11.5 10H9l-2.8 2.1A.8.8 0 0 1 5 11.5V10H4.5A2.5 2.5 0 0 1 2 7.5z" />
        <path d="M5.5 12.5v1.7a.8.8 0 0 0 1.27.63L10 13h2.5A2.5 2.5 0 0 0 15 10.5v-4a.5.5 0 0 0-1 0v4A1.5 1.5 0 0 1 12.5 12H10a.5.5 0 0 0-.3.1z" />
      </svg>
    ),
  };

  const buildNavItems: NavItem[] = [];
  const testNavItems: NavItem[] = [];
  const launchNavItems: NavItem[] = [teamItem, liveHelpItem];
  const allNavItems: NavItem[] = [
    ...visibleNavItems,
    ...buildNavItems,
    ...testNavItems,
    ...launchNavItems,
  ];
  const pathMatches = (href: string) => Boolean(pathname && pathname.startsWith(href));
  const activeNavHref = allNavItems.find((item) => pathMatches(item.href))?.href ?? null;

  const headingStyle: React.CSSProperties = {
    width: "100%",
    padding: collapsed ? "4px 12px" : "2px 20px",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    marginBottom: 2,
    display: "flex",
    justifyContent: collapsed ? "center" : "flex-start",
  };

  const sectionHeadingMarginTop = collapsed ? 6 : 10;

  const renderHeading = (text: string, marginTop = 0) => (
    <div style={{ ...headingStyle, marginTop }}>
      <span>{text}</span>
    </div>
  );

  const sharedNavStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 0.18s, color 0.18s, padding 0.18s, gap 0.18s, justify-content 0.18s",
  };

  const renderSecondaryNavItem = (item: NavItem) => {
    const active = activeNavHref === item.href;
    const secondaryBorderRadius = collapsed ? 12 : "0 12px 12px 0";
    const hovered = hoveredNavHref === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          ...sharedNavStyle,
          padding: "10px 8px",
          paddingLeft: navLeftPadding,
          color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
          background: active
            ? `rgba(var(--accent-rgb, 43,108,176), 0.12)`
            : hovered
            ? `rgba(var(--accent-rgb, 43,108,176), 0.08)`
            : "none",
          borderRadius: secondaryBorderRadius,
          fontWeight: 600,
          fontSize: 13,
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 8,
        }}
        title={item.label}
        aria-label={item.label}
        onMouseEnter={() => setHoveredNavHref(item.href)}
        onMouseLeave={() => setHoveredNavHref(null)}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
            transition: "color 0.18s ease",
          }}
        >
          {item.icon}
        </span>
        <span style={labelVisibilityStyle}>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100dvh",
        background: "var(--panel, #0f172a)",
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        boxShadow: "0 4px 24px rgba(10,22,40,0.06)",
        zIndex: 100,
        minWidth: "var(--sidebar-width)",
        width: "var(--sidebar-width)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: collapsed ? "12px 0 12px 0" : "12px 0 12px 0",
        gap: collapsed ? 2 : 4,
        transition: "width 0.24s ease",
      }}
    >
  {/* Keep the collapsed primary/secondary stack tight by using a minimal gap. */}
  <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          width: "100%",
          padding: collapsed ? "0 12px 20px" : "0 20px 24px",
          gap: 12,
        }}
      >
        <Link
          href={`/client/${clientId}/personas`}
          className="sidebar-brand-link"
          style={{
            display: collapsed ? "none" : "block",
            fontSize: collapsed ? 20 : 24,
            fontWeight: 800,
            color: "#073a70",
            letterSpacing: 1,
            fontFamily: "inherit",
            textShadow: "0 2px 8px rgba(10,22,40,0.06)",
            transition: "transform 0.18s ease, opacity 0.18s ease",
            textDecoration: "none",
          }}
        >
          Dialogue
        </Link>
        <button
          type="button"
          onClick={handleToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            border: "none",
            background: "transparent",
            color: "var(--accent-2, #7fb3ff)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.18s ease, transform 0.18s ease",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            color="currentColor"
          >
            <rect x="7" y="6.5" width="7" height="1.5" rx="0.75" transform="rotate(90 7 6.5)" fill="currentColor" />
            <rect x="3" y="4" width="14" height="12" rx="2.8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      {renderHeading("Explore", 0)}
      {visibleNavItems.map((item) => {
        const active = activeNavHref === item.href;
        const hovered = hoveredNavHref === item.href;
        const primaryBorderRadius = collapsed ? 10 : "0 10px 10px 0";

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              ...sharedNavStyle,
              padding: "10px 12px",
              paddingLeft: navLeftPadding,
              color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
              background: active
                ? `rgba(var(--accent-rgb, 43,108,176), 0.12)`
                : hovered
                ? `rgba(var(--accent-rgb, 43,108,176), 0.08)`
                : "none",
              borderRadius: primaryBorderRadius,
              fontWeight: 600,
              fontSize: 13,
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 8,
              marginRight: active && !collapsed ? 16 : 0,
            }}
            title={item.label}
            aria-label={item.label}
            onMouseEnter={() => setHoveredNavHref(item.href)}
            onMouseLeave={() => setHoveredNavHref(null)}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: 20,
                display: "flex",
                alignItems: "center",
                color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
                transition: "color 0.18s ease",
              }}
            >
              {item.icon}
            </span>
            <span style={labelVisibilityStyle}>{item.label}</span>
          </Link>
        );
      })}
      {buildNavItems.length > 0 && (
        <div style={{ marginTop: sectionHeadingMarginTop }}>
          {buildNavItems.map(renderSecondaryNavItem)}
        </div>
      )}
      {testNavItems.length > 0 && (
        <div style={{ marginTop: sectionHeadingMarginTop }}>
          {testNavItems.map(renderSecondaryNavItem)}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div
        style={{
          marginTop: sectionHeadingMarginTop,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: collapsed ? 2 : 0,
        }}
      >
        {launchNavItems.map(renderSecondaryNavItem)}
      </div>
      <div
        style={{
          width: "100%",
          padding: collapsed ? "12px 8px" : "14px 18px",
          borderTop: `1px solid rgba(var(--accent-rgb, 43,108,176), 0.12)`,
          background: "var(--panel-2, rgba(16,25,43,0.92))",
          color: "var(--accent-2, #7fb3ff)",
          position: "relative",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: collapsed ? 0 : 12,
          marginTop: "auto",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
        ref={menuRef}
        onClick={handleToggleMenu}
        aria-label="Profile menu"
        title={profileTooltipName}
      >
        <div
          style={{
            width: collapsed ? 32 : 34,
            height: collapsed ? 32 : 34,
            borderRadius: "50%",
            background: "#073a70",
            color: "var(--panel, #F6F7F9fff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
            textTransform: "uppercase",
            boxShadow: "0 4px 14px rgba(var(--accent-rgb, 43,108,176),0.18)",
          }}
        >
          {profileInitial || "A"}
        </div>
        <div style={{ display: collapsed ? "none" : "flex", flexDirection: "column", flex: 1 }}>
          {profileDisplayName ? (
            <div
              title={profileDisplayName}
              style={{
                fontWeight: 700,
                color: "var(--text, #052033)",
                marginBottom: 2,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {profileDisplayName}
            </div>
          ) : null}
          {profileError && (
            <div style={{ fontSize: 11, color: "#fda4af" }}>Profile unavailable</div>
          )}
        </div>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "12px",
              left: "calc(100% + 8px)",
              width: 180,
              background: "var(--panel, #0f1628)",
              borderRadius: 12,
              border: `1px solid rgba(var(--accent-rgb, 43,108,176),0.18)`,
              boxShadow: "0 12px 28px rgba(10,22,40,0.18)",
              padding: "8px 12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              href={`/client/${clientId}/usage`}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                color: "var(--accent-2, #7fb3ff)",
                fontWeight: 600,
                fontSize: 13,
                lineHeight: "36px",
                textDecoration: "none",
                textAlign: "left",
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              Usage
            </Link>
            <Link
              href={`/client/${clientId}/settings`}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                color: "var(--accent-2, #7fb3ff)",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
                height: 36,
              }}
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                background: `rgba(var(--danger, 239,68,68),0.08)`,
                color: "var(--accent-2, #7fb3ff)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 8,
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
