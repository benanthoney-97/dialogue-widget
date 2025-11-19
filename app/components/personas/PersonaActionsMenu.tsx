'use client';

import { useEffect, useRef, useState } from "react";

type PersonaActionsMenuProps = {
  personaName: string;
};

type MenuStatus = {
  message: string;
  tone: "neutral" | "positive" | "warning";
};

function buildEmailLink(personaName: string, currentUrl: string): string {
  const subject = encodeURIComponent(`Sharing persona: ${personaName}`);
  const body = encodeURIComponent(`Take a look at this persona:\n${currentUrl}`);
  return `mailto:?subject=${subject}&body=${body}`;
}

export default function PersonaActionsMenu({ personaName }: PersonaActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<MenuStatus | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current || !buttonRef.current) return;
      if (!menuRef.current.contains(target) && !buttonRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [status]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus({ message: "Persona link copied", tone: "positive" });
    } catch (error) {
      console.error("[PersonaActionsMenu] Failed to copy link", error);
      setStatus({ message: "Unable to copy link. Try again.", tone: "warning" });
    }
    setOpen(false);
  };

  const handleShareEmail = () => {
    const mailtoHref = buildEmailLink(personaName, window.location.href);
    window.location.href = mailtoHref;
    setStatus({ message: "Opening your email client", tone: "neutral" });
    setOpen(false);
  };

  const badgeColor =
    status?.tone === "positive"
      ? "#15803d"
      : status?.tone === "warning"
      ? "#b91c1c"
      : "#475569";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="persona-actions-menu"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          border: "none",
          background: "transparent",
          borderRadius: 999,
          padding: "6px 10px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0f172a",
          fontSize: 18,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        ...
      </button>
      {open ? (
        <div
          id="persona-actions-menu"
          ref={menuRef}
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 200,
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.35)",
            background: "#ffffff",
            boxShadow: "0 20px 40px rgba(15,23,42,0.18)",
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 10,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCopyLink}
            style={{
              border: "none",
              background: "transparent",
              borderRadius: 12,
              padding: "10px 12px",
              textAlign: "left",
              fontSize: 14,
              fontWeight: 600,
              color: "#0f172a",
              cursor: "pointer",
              transition: "background 0.18s ease, transform 0.18s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "rgba(148,163,184,0.14)";
              event.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleShareEmail}
            style={{
              border: "none",
              background: "transparent",
              borderRadius: 12,
              padding: "10px 12px",
              textAlign: "left",
              fontSize: 14,
              fontWeight: 600,
              color: "#0f172a",
              cursor: "pointer",
              transition: "background 0.18s ease, transform 0.18s ease",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = "rgba(148,163,184,0.14)";
              event.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = "transparent";
              event.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Share via email
          </button>
        </div>
      ) : null}
      {status ? (
        <span
          role="status"
          aria-live="polite"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: badgeColor,
            fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
          }}
        >
          {status.message}
        </span>
      ) : null}
    </div>
  );
}
