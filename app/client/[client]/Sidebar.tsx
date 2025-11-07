"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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
      setProfileError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userError || !userData?.user) {
        const message = userError?.message ?? "Profile unavailable";
        setProfileError(message);
        setProfileName(null);
        return;
      }

      const userId = userData.user.id;
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (!isMounted) return;

      const userMeta = (userData.user.user_metadata ?? {}) as { full_name?: string; name?: string };
      const fallbackName = userMeta.full_name ?? userMeta.name ?? userData.user.email ?? null;

      if (profileError) {
        setProfileError(profileError.message ?? "Profile unavailable");
        setProfileName(fallbackName);
        return;
      }

      const displayName = profileData?.display_name ?? null;
      setProfileName(displayName ?? fallbackName);
      setProfileError(displayName ? null : "Profile unavailable");
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
      // eslint-disable-next-line no-console
      console.error("Failed to sign out", err);
    }
    router.replace("/auth");
  };

  const navItems = [
    {
      label: "Personas",
      href: `/client/${clientId}/personas`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="3.1" fill="#7ea0e6" />
          <path d="M5.4 16.2C5.4 13.9 6.9 12 9 12C11.1 12 12.6 13.9 12.6 16.2" stroke="#7ea0e6" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="15.2" cy="9.4" r="2.4" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.1" />
          <path d="M13 16.3C13.2 14.7 14.4 13.4 15.9 13.4C17.6 13.4 18.8 14.8 18.8 16.6" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Playbacks",
      href: `/client/${clientId}/insights`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="2.5" width="14" height="17" rx="2.5" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.2"/>
          <rect x="7" y="6.5" width="8" height="1.5" rx="0.75" fill="#7ea0e6"/>
          <rect x="7" y="10" width="8" height="1.5" rx="0.75" fill="#7ea0e6"/>
          <rect x="7" y="13.5" width="5" height="1.5" rx="0.75" fill="#7ea0e6"/>
        </svg>
      ),
    },
    {
      label: "Groups",
      href: `/client/${clientId}/batch`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="16" height="14" rx="3" fill="#0f172a" stroke="#7ea0e6" strokeWidth="1.2" />
          <path d="M7 8H15" stroke="#7ea0e6" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5.5 12H16.5" stroke="#7ea0e6" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M7 16H15" stroke="#7ea0e6" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Web Research",
      href: `/client/${clientId}/research`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="9" r="4.2" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.1" />
          <path d="M13.8 12.8L16.7 15.7" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M8.5 9C8.5 7.6 9.6 6.5 11 6.5" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M5 17H12.5" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "New Persona",
      href: `/client/${clientId}/upload`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="15" width="12" height="2" rx="1" fill="#7ea0e6"/>
          <rect x="10" y="5" width="2" height="8" rx="1" fill="#7ea0e6"/>
          <path d="M11 4L7 8H15L11 4Z" fill="#7ea0e6"/>
        </svg>
      ),
    },
  ];

  const labelVisibilityStyle: React.CSSProperties = {
    opacity: collapsed ? 0 : 1,
    visibility: collapsed ? "hidden" : "visible",
    maxWidth: collapsed ? 0 : 160,
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: "opacity 0.18s ease, max-width 0.18s ease",
  };

  const teamItem = {
    label: "Team",
    href: `/client/${clientId}/teams`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="3" fill="#7ea0e6" />
        <circle cx="15" cy="9.5" r="2.4" fill="#22325a" stroke="#7ea0e6" strokeWidth="1" />
        <path d="M4.5 15.5C4.7 13.2 6.4 11.5 8.5 11.5C10.8 11.5 12.5 13.4 12.5 15.9" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M12.8 16.5C13 14.8 14.3 13.5 15.9 13.5C17.7 13.5 19.1 15 19.1 16.9" stroke="#7ea0e6" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  };

  const settingsItem = {
    label: "Settings",
    href: `/client/${clientId}/settings`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.9 3.8l.3 1.2c.1.4.4.8.7 1l1.1.6c.3.2.4.6.3 1l-.4 1.3c-.1.3 0 .7.2 1l.9.9c.3.3.3.7.1 1.1l-.8 1.1c-.2.3-.3.7-.2 1.1l.3 1.2c.1.4-.1.8-.5 1l-1.2.6c-.4.2-.7.5-.8.9l-.3 1.2c-.1.4-.5.7-.9.7h-1.4c-.4 0-.8-.3-.9-.7l-.3-1.2c-.1-.4-.4-.7-.8-.9l-1.2-.6c-.4-.2-.6-.6-.5-1l.3-1.2c.1-.4 0-.8-.2-1.1l-.8-1.1c-.2-.3-.2-.8.1-1.1l.9-.9c.2-.3.3-.7.2-1l-.4-1.3c-.1-.4.1-.8.3-1l1.1-.6c.4-.2.6-.6.7-1l.3-1.2c.1-.4.5-.7.9-.7h1.4c.4 0 .8.3.9.7z" stroke="#7ea0e6" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11" cy="11" r="2.6" fill="#7ea0e6" />
      </svg>
    ),
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
        padding: collapsed ? "24px 0 12px 0" : "32px 0 12px 0",
        gap: collapsed ? 4 : 8,
        transition: "width 0.24s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          width: "100%",
          padding: collapsed ? "0 12px 20px" : "0 20px 28px",
          gap: 12,
        }}
      >
        <div
          style={{
            display: collapsed ? "none" : "block",
            fontSize: collapsed ? 20 : 24,
            fontWeight: 800,
            color: "var(--accent, #2b6cb0)",
            letterSpacing: 1,
            fontFamily: "inherit",
            textShadow: "0 2px 8px rgba(10,22,40,0.06)",
            transition: "transform 0.18s ease, opacity 0.18s ease",
          }}
        >
          Dialogue
        </div>
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
      {navItems.map((item) => {
        let active = false;
        if (pathname) {
          active = pathname.startsWith(item.href);
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: collapsed ? "10px 12px" : "10px 20px",
              color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
              background: active ? `rgba(var(--accent-rgb, 43,108,176), 0.12)` : "none",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              transition: "background 0.18s, color 0.18s, padding 0.18s, margin 0.18s, gap 0.18s, justify-content 0.18s",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 10,
              marginRight: active && !collapsed ? 16 : 0,
            }}
            title={item.label}
            aria-label={item.label}
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
      <div style={{ flex: 1 }} />
      {[teamItem, { label: "Usage", href: `/client/${clientId}/usage`, icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 17H18" stroke="#7ea0e6" strokeWidth="1.2" strokeLinecap="round"/>
          <rect x="6" y="9" width="3" height="6" rx="1" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.1"/>
          <rect x="10.5" y="6" width="3" height="9" rx="1" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.1"/>
          <rect x="15" y="4" width="3" height="11" rx="1" fill="#22325a" stroke="#7ea0e6" strokeWidth="1.1"/>
        </svg>
      )}, settingsItem].map((item) => {
        const active = Boolean(pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              width: collapsed ? "100%" : "calc(100% - 24px)",
              padding: collapsed ? "0 8px" : "0 12px",
              color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
              background: "none",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              transition: "background 0.18s, color 0.18s, padding 0.18s, gap 0.18s, justify-content 0.18s",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 10,
              marginBottom: 8,
            }}
            title={item.label}
            aria-label={item.label}
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
        title={profileName ?? "Anonymous"}
      >
        <div
          style={{
            width: collapsed ? 32 : 34,
            height: collapsed ? 32 : 34,
            borderRadius: "50%",
            background: "var(--accent, #2b6cb0)",
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
          {(profileName ?? "Anonymous").charAt(0) || "A"}
        </div>
        <div style={{ display: collapsed ? "none" : "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontWeight: 700, color: "var(--text, #052033)", marginBottom: 2, fontSize: 13 }}>
            {profileName ?? "Anonymous"}
          </div>
          {profileError && (
            <div style={{ fontSize: 11, color: "#fda4af" }}>Profile unavailable</div>
          )}
        </div>
        <div
          style={{
            display: collapsed ? "none" : "flex",
            flexDirection: "column",
            gap: 2,
            color: "var(--accent-2, #7fb3ff)",
            marginLeft: 4,
            transition: "opacity 0.18s ease",
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1, transform: menuOpen ? "rotate(180deg)" : "none" }}>⌃</span>
          <span style={{ fontSize: 12, lineHeight: 1, transform: menuOpen ? "rotate(180deg)" : "none" }}>⌄</span>
        </div>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: collapsed ? "56px" : "64px",
              left: collapsed ? "8px" : "18px",
              width: collapsed ? "calc(100% - 16px)" : "calc(100% - 36px)",
              background: "var(--panel, #0f1628)",
              borderRadius: 12,
              border: `1px solid rgba(var(--accent-rgb, 43,108,176),0.18)`,
              boxShadow: "0 12px 28px rgba(10,22,40,0.18)",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 10,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/client/${clientId}/support`);
              }}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                border: `1px solid rgba(var(--accent-rgb, 43,108,176),0.35)`,
                background: `rgba(var(--accent-rgb, 43,108,176),0.08)`,
                color: "var(--accent-2, #7fb3ff)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Support
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "0 12px",
                borderRadius: 10,
                border: `1px solid rgba(var(--danger, 239,68,68),0.35)` ,
                background: `rgba(var(--danger, 239,68,68),0.08)`,
                color: "var(--danger, #ef4444)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
