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

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileName() {
      if (!clientId) {
        setProfileName(null);
        setProfileError(null);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', clientId)
        .single();
      if (!isMounted) return;
      if (error) {
        setProfileError(error.message ?? 'Failed to load profile');
        setProfileName(null);
        return;
      }
      setProfileError(null);
      setProfileName(data?.display_name ?? null);
    }
    fetchProfileName();
    return () => {
      isMounted = false;
    };
  }, [clientId]);

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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100dvh",
        // Use theme panel color (light background in persona-root) with dark fallback
        background: "var(--panel, #0f172a)",
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        boxShadow: "0 4px 24px rgba(10,22,40,0.06)",
        zIndex: 100,
        minWidth: 180,
        width: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 0 12px 0",
        gap: 8,
      }}
    >
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: 'var(--accent, #2b6cb0)',
        letterSpacing: 1,
        marginBottom: 28,
        fontFamily: 'inherit',
        textShadow: '0 2px 8px rgba(10,22,40,0.06)',
      }}>
        Dialogue
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
              padding: "10px 20px",
              color: active ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
              background: active ? `rgba(var(--accent-rgb, 43,108,176), 0.12)` : "none",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              transition: "background 0.18s, color 0.18s, padding 0.18s, margin 0.18s",
              justifyContent: "flex-start",
              gap: 10,
              marginRight: active ? 16 : 0,
            }}
            title={item.label}
          >
            <span style={{ fontSize: 20, display: 'flex', alignItems: 'center', color: active ? 'var(--text, #052033)' : 'var(--accent-2, #7fb3ff)' }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
      <div style={{ flex: 1 }} />
      <Link
        href={teamItem.href}
        style={{
          display: "flex",
          alignItems: "center",
          width: "calc(100% - 36px)",
          padding: "10px 18px",
          color: pathname?.startsWith(teamItem.href) ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
          background: pathname?.startsWith(teamItem.href)
            ? `rgba(var(--accent-rgb, 43,108,176), 0.16)`
            : "rgba(59, 130, 246, 0.08)",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: "none",
          transition: "background 0.18s, color 0.18s",
          justifyContent: "flex-start",
          gap: 10,
          marginBottom: 12,
        }}
        title={teamItem.label}
      >
        <span
          style={{
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            color: pathname?.startsWith(teamItem.href) ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
          }}
        >
          {teamItem.icon}
        </span>
        {teamItem.label}
      </Link>
      <Link
        href={settingsItem.href}
        style={{
          display: "flex",
          alignItems: "center",
          width: "calc(100% - 36px)",
          padding: "10px 18px",
          color: pathname?.startsWith(settingsItem.href) ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
          background: pathname?.startsWith(settingsItem.href)
            ? `rgba(var(--accent-rgb, 43,108,176), 0.16)`
            : "rgba(59, 130, 246, 0.08)",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 14,
          textDecoration: "none",
          transition: "background 0.18s, color 0.18s",
          justifyContent: "flex-start",
          gap: 10,
          marginBottom: 12,
          marginTop: -4,
        }}
        title={settingsItem.label}
      >
        <span
          style={{
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            color: pathname?.startsWith(settingsItem.href) ? "var(--text, #052033)" : "var(--accent-2, #7fb3ff)",
          }}
        >
          {settingsItem.icon}
        </span>
        {settingsItem.label}
      </Link>
      <div
        style={{
          width: "100%",
          padding: "14px 18px",
          borderTop: `1px solid rgba(var(--accent-rgb, 43,108,176), 0.12)`,
          background: "var(--panel-2, rgba(16,25,43,0.92))",
          color: "var(--accent-2, #7fb3ff)",
          position: "relative",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: "auto",
        }}
        ref={menuRef}
        onClick={handleToggleMenu}
      >
        <div
          style={{
            width: 34,
            height: 34,
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
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontWeight: 700, color: "var(--text, #052033)", marginBottom: 2, fontSize: 13 }}>
            {profileName ?? "Anonymous"}
          </div>
          {profileError && (
            <div style={{ fontSize: 11, color: "#fda4af" }}>Profile unavailable</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--accent-2, #7fb3ff)", marginLeft: 4 }}>
          <span style={{ fontSize: 12, lineHeight: 1, transform: menuOpen ? "rotate(180deg)" : "none" }}>⌃</span>
          <span style={{ fontSize: 12, lineHeight: 1, transform: menuOpen ? "rotate(180deg)" : "none" }}>⌄</span>
        </div>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "64px",
              left: "18px",
              width: "calc(100% - 36px)",
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
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid rgba(var(--accent-rgb, 43,108,176),0.35)`,
                background: `rgba(var(--accent-rgb, 43,108,176),0.08)`,
                color: "var(--accent-2, #7fb3ff)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Support
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid rgba(var(--danger, 239,68,68),0.35)` ,
                background: `rgba(var(--danger, 239,68,68),0.08)`,
                color: "var(--danger, #ef4444)",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
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
