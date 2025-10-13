"use client";
import React, { useState, createContext, useContext } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

function getClientIdFromPath(pathname: string | null): string {
  if (!pathname) return "";
  // Match /client/CLIENTID/...
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function Sidebar() {
  const pathname = usePathname();
  const clientId = getClientIdFromPath(pathname);
  const navItems = [
    {
      label: "Insights",
      href: `/client/${clientId}/insights`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="6" width="3" height="8" rx="1" fill="#7ea0e6" />
          <rect x="8.5" y="3" width="3" height="14" rx="1" fill="#7ea0e6" />
          <rect x="15" y="8" width="3" height="6" rx="1" fill="#7ea0e6" />
        </svg>
      ),
    },
    {
      label: "Documents",
      href: `/client/${clientId}/documents`,
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
      label: "Upload",
      href: `/client/${clientId}/upload`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="15" width="12" height="2" rx="1" fill="#7ea0e6"/>
          <rect x="10" y="5" width="2" height="8" rx="1" fill="#7ea0e6"/>
          <path d="M11 4L7 8H15L11 4Z" fill="#7ea0e6"/>
        </svg>
      ),
    },
    {
      label: "Support",
      href: `/client/${clientId}/support`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="9" stroke="#7ea0e6" strokeWidth="1.5" fill="#22325a"/>
          <rect x="10" y="7" width="2" height="5" rx="1" fill="#7ea0e6"/>
          <rect x="10" y="14" width="2" height="2" rx="1" fill="#7ea0e6"/>
        </svg>
      ),
    },
  ];

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100dvh",
        background: "#10192b",
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        boxShadow: "0 4px 24px rgba(10,22,40,0.13)",
        zIndex: 100,
        minWidth: 180,
        width: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 0 32px 0",
        gap: 8,
      }}
    >
      <div style={{
        fontSize: 24,
        fontWeight: 800,
        color: '#fff',
        letterSpacing: 1,
        marginBottom: 28,
        fontFamily: 'inherit',
        textShadow: '0 2px 8px #0a1628',
      }}>
        Dialogue
      </div>
      {navItems.map((item) => {
        const active = pathname?.startsWith(item.href.replace("[client]", ""));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "12px 28px",
              color: active ? "#fff" : "#a3c0ff",
              background: active ? "#22325a" : "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
              transition: "background 0.18s, color 0.18s, padding 0.18s, margin 0.18s",
              justifyContent: "flex-start",
              gap: 12,
              marginRight: active ? 16 : 0,
            }}
            title={item.label}
          >
            <span style={{ fontSize: 22, marginRight: 10, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
