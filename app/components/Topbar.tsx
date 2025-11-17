"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { BODY_FONT_STACK, HEADING_FONT_STACK } from "@/app/lib/fontStacks";
import { TOPBAR_HEIGHT } from "./topbarHeight";

type NavLink = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type TopbarProps = {
  title?: string;
  titleHref?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  cadence?: string;
  onCadenceChange?: (value: string) => void;
  offsetLeft?: string | number;
  hideCadenceControls?: boolean;
  centerSlot?: React.ReactNode;
  cadenceLabel?: string;
  navLinks?: NavLink[];
  profileInitial?: string;
  onProfileClick?: () => void;
  leadingSlot?: React.ReactNode;
  hideProfileAvatar?: boolean;
};

const CADENCE_OPTIONS = ["Quarterly", "Monthly", "Weekly", "Daily"] as const;

type ProfileDetails = {
  displayName: string | null;
  email: string | null;
  role: string | null;
  clientId: string | null;
};

const DEFAULT_PROFILE_STATE: ProfileDetails = {
  displayName: null,
  email: null,
  role: null,
  clientId: null,
};

function getInitial(source?: string | null): string | null {
  const trimmed = typeof source === "string" ? source.trim() : "";
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase();
}

export default function Topbar({
  title = "Workspace research",
  subtitle,
  titleHref,
  rightSlot,
  cadence = "Weekly",
  onCadenceChange,
  offsetLeft,
  hideCadenceControls = false,
  centerSlot,
  cadenceLabel,
  navLinks,
  profileInitial,
  onProfileClick,
  leadingSlot,
  hideProfileAvatar = false,
}: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedOffset = offsetLeft ?? 0;
  const portalNavLinks = navLinks ?? [];
  const [profileDetails, setProfileDetails] = useState<ProfileDetails>({ ...DEFAULT_PROFILE_STATE });
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (hideProfileAvatar) {
      setMenuOpen(false);
      return;
    }

    let isMounted = true;

    async function fetchProfileDetails() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (userError || !userData?.user) {
          setProfileDetails({ ...DEFAULT_PROFILE_STATE });
          return;
        }

        const user = userData.user;
        const metadata = (user.user_metadata ?? {}) as {
          full_name?: string;
          name?: string;
          email?: string;
        };
        const fallbackName = metadata.full_name?.trim() || metadata.name?.trim() || null;
        const fallbackEmail = typeof user.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : metadata.email?.trim() || null;

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, role, client_id, email")
          .eq("id", user.id)
          .maybeSingle<{
            display_name: string | null;
            role: string | null;
            client_id: string | null;
            email: string | null;
          }>();

        if (!isMounted) return;

        if (profileError || !profileRow) {
          setProfileDetails({
            displayName: fallbackName,
            email: fallbackEmail,
            role: null,
            clientId: null,
          });
          return;
        }

        const resolvedDisplayName = profileRow.display_name?.trim()
          ? profileRow.display_name.trim()
          : fallbackName;
        const resolvedEmail = profileRow.email?.trim()
          ? profileRow.email.trim()
          : fallbackEmail;

        setProfileDetails({
          displayName: resolvedDisplayName ?? resolvedEmail ?? fallbackName,
          email: resolvedEmail,
          role: typeof profileRow.role === "string" ? profileRow.role : null,
          clientId:
            typeof profileRow.client_id === "string" && profileRow.client_id.trim().length > 0
              ? profileRow.client_id.trim()
              : null,
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("[Topbar] Failed to load profile details", error);
        setProfileDetails({ ...DEFAULT_PROFILE_STATE });
      }
    }

    void fetchProfileDetails();

    return () => {
      isMounted = false;
    };
  }, [hideProfileAvatar]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const resolvedInitial = useMemo(() => {
    return (
      getInitial(profileInitial) ||
      getInitial(profileDetails.displayName) ||
      getInitial(profileDetails.email) ||
      "A"
    );
  }, [profileInitial, profileDetails.displayName, profileDetails.email]);

  const fallbackClientFromPath = useMemo(() => {
    if (!pathname) return null;
    const clientMatch = pathname.match(/^\/client\/([^/]+)/);
    if (clientMatch?.[1]) {
      return clientMatch[1];
    }
    const portalMatch = pathname.match(/^\/app\/([^/]+)/);
    if (portalMatch?.[1]) {
      return portalMatch[1];
    }
    return null;
  }, [pathname]);

  const resolvedClientSlug = profileDetails.clientId ?? fallbackClientFromPath;
  const canShowAdminView = Boolean(profileDetails.role && profileDetails.role !== "viewer" && resolvedClientSlug);
  const profileHref = resolvedClientSlug ? `/client/${resolvedClientSlug}/settings` : null;
  const adminHref = resolvedClientSlug ? `/client/${resolvedClientSlug}/personas` : null;

  const closeMenu = () => setMenuOpen(false);

  const handleProfileButtonClick = () => {
    setMenuOpen((prev) => !prev);
    onProfileClick?.();
  };

  const handleNavigate = (href: string | null) => {
    if (!href) return;
    closeMenu();
    router.push(href);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[Topbar] Failed to sign out", error);
    } finally {
      closeMenu();
      router.replace("/auth");
      setIsSigningOut(false);
    }
  };

  const menuButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#0f172a",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: BODY_FONT_STACK,
    transition: "background 0.18s ease, color 0.18s ease",
  };

  const defaultRightSlot = null;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: resolvedOffset,
        right: 0,
        zIndex: 120,
        height: TOPBAR_HEIGHT,
        background: "var(--panel, #0f172a)",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        transition: "left 0.3s ease",
      }}
    >
      <div
        style={{
          margin: 0,
          padding: "12px 24px",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 18,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              justifyContent: "center",
              height: "100%",
              flexShrink: 0,
            }}
          >
            {leadingSlot ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                {leadingSlot}
              </div>
            ) : (
              <>
                {titleHref ? (
                  <Link
                    href={titleHref}
                    prefetch={false}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "inline-flex",
                    }}
                  >
                    <h1
                      style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#052033",
                        fontFamily: HEADING_FONT_STACK,
                      }}
                    >
                      {title}
                    </h1>
                  </Link>
                ) : (
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 800,
                      color: "#052033",
                      fontFamily: HEADING_FONT_STACK,
                    }}
                  >
                    {title}
                  </h1>
                )}
                {subtitle ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "rgba(15, 23, 42, 0.72)",
                      maxWidth: 560,
                      fontFamily: BODY_FONT_STACK,
                    }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </>
            )}
          </div>
          {/* Admin view button moved to right-hand controls */}
        </div>
        <div style={{ flex: 1 }} />
        <nav
          aria-label="Portal navigation"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 13,
            fontWeight: 600,
            color: "#0f172a",
            fontFamily: BODY_FONT_STACK,
            flexShrink: 0,
          }}
        >
          {portalNavLinks.map((link, index) => {
            const key = link.href ?? `${link.label}-${index}`;
            const baseStyle: React.CSSProperties = {
              color: "inherit",
              textDecoration: "none",
              padding: "6px 10px",
              borderRadius: 999,
              transition: "background 0.18s ease, color 0.18s ease",
              background: "transparent",
              font: "inherit",
              cursor: "pointer",
              border: "none",
            };

            const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
              event.currentTarget.style.background = "rgba(15, 23, 42, 0.08)";
            };

            const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
              event.currentTarget.style.background = "transparent";
            };

            const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
              event.currentTarget.style.background = "rgba(15, 23, 42, 0.12)";
            };

            const handleBlur = (event: React.FocusEvent<HTMLElement>) => {
              event.currentTarget.style.background = "transparent";
            };

            if (link.href) {
              return (
                <a
                  key={key}
                  href={link.href}
                  style={baseStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onClick={(event) => {
                    if (link.onClick) {
                      event.preventDefault();
                      link.onClick();
                    }
                  }}
                >
                  {link.label}
                </a>
              );
            }

            return (
              <button
                key={key}
                type="button"
                style={baseStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onClick={link.onClick}
              >
                {link.label}
              </button>
            );
          })}
        </nav>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: "100%",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          {hideCadenceControls ? null : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              {cadenceLabel ? (
                <span className="topbar-cadence-label">{cadenceLabel}</span>
              ) : null}
              <div
                role="tablist"
                aria-label="Refresh cadence"
                style={{
                  display: "inline-flex",
                  borderRadius: 12,
                  background: "#f6f7f9",
                  border: "1px solid #1e293b",
                  padding: 4,
                  gap: 4,
                }}
              >
                {CADENCE_OPTIONS.map((option) => {
                  const active = cadence === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "topbar-cadence-chip topbar-cadence-chip--active" : "topbar-cadence-chip"}
                      aria-pressed={active}
                      onClick={() => onCadenceChange?.(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            {rightSlot ?? defaultRightSlot}
            {canShowAdminView ? (
              <button
                type="button"
                onClick={() => handleNavigate(adminHref)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#0f172a",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: BODY_FONT_STACK,
                  cursor: "pointer",
                  transition: "background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(15, 23, 42, 0.08)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.background = "rgba(15, 23, 42, 0.12)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                Admin view
              </button>
            ) : null}
          </div>
          {hideProfileAvatar ? null : (
            <div
              ref={profileMenuRef}
              style={{ position: "relative", display: "inline-flex" }}
            >
              <button
                type="button"
                ref={profileButtonRef}
                onClick={handleProfileButtonClick}
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: menuOpen ? "#052f5f" : "#073a70",
                  color: "#f8fafc",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 15,
                  textTransform: "uppercase",
                  boxShadow: menuOpen ? "0 10px 24px rgba(10,22,40,0.24)" : "0 6px 18px rgba(10,22,40,0.18)",
                  cursor: "pointer",
                  fontFamily: HEADING_FONT_STACK,
                  transition: "background 0.18s ease, box-shadow 0.18s ease",
                }}
              >
                {resolvedInitial}
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  aria-label="Profile options"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 12px)",
                    right: 0,
                    minWidth: 188,
                    padding: 8,
                    borderRadius: 14,
                    background: "#ffffff",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    boxShadow: "0 20px 48px rgba(15, 23, 42, 0.22)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    zIndex: 180,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleNavigate(profileHref)}
                    style={
                      profileHref
                        ? menuButtonStyle
                        : {
                            ...menuButtonStyle,
                            color: "rgba(15, 23, 42, 0.45)",
                            cursor: "not-allowed",
                            opacity: 0.65,
                          }
                    }
                    disabled={!profileHref}
                  >
                    Profile
                  </button>
                  <div
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      height: 1,
                      background: "rgba(15, 23, 42, 0.08)",
                      margin: "4px 0",
                    }}
                  />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    style={{
                      ...menuButtonStyle,
                      color: "#b91c1c",
                    }}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerSlot ?? (
            <div
              id="topbar-center-slot"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            />
          )}
        </div>
      </div>
      <style>{`
        .topbar-cadence-label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          font-family: ${BODY_FONT_STACK};
        }
        .topbar-cadence-chip {
          border: none;
          background: #f6f7f9;
          color: #1e293b;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: ${BODY_FONT_STACK};
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .topbar-cadence-chip:focus-visible {
          outline: none;
          background: rgba(59, 130, 246, 0.18);
          color: #f6f7f9;
        }
        .topbar-cadence-chip--active {
          background: #1e293b;
          color: #f6f7f9;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.28);
        }
      `}</style>
    </header>
  );
}
