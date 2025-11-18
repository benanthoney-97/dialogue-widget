'use client';

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";

type PersonaActionsMenuProps = {
  personaName: string;
  personaId?: string;
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

export default function PersonaActionsMenu({ personaName, personaId }: PersonaActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<MenuStatus | null>(null);
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [submittingFeedback, setSubmittingFeedback] = useState(false);
const [clientId, setClientId] = useState<number | null>(null);
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
      // eslint-disable-next-line no-console
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

  const handleGiveFeedback = () => {
    setOpen(false);
    setStatus(null);
    setShowFeedbackModal(true);
  };
  
  useEffect(() => {
    if (!personaId) {
      setClientId(null);
      return;
    }

    let isMounted = true;

    (async () => {
      const { data, error } = await supabase
        .from("agent_map")
        .select("client_id")
        .eq("agent_id", personaId)
        .maybeSingle<{ client_id: number | null }>();

      if (!isMounted) return;

      if (error) {
        // eslint-disable-next-line no-console
        console.error("[PersonaActionsMenu] Failed to resolve client_id", error);
        setClientId(null);
        return;
      }

      setClientId(data?.client_id ?? null);
    })();

    return () => {
      isMounted = false;
    };
  }, [personaId]);

  const handleFeedbackSubmit = async (details: { subject: string; content: string }) => {
    if (submittingFeedback) {
      return true;
    }

    const feedbackTitle = details.subject.trim();
    const feedbackBody = details.content.trim();

    if (!feedbackTitle) {
      setStatus({ message: "Add a short subject before submitting.", tone: "warning" });
      return false;
    }

    setSubmittingFeedback(true);
    try {
      const { data: authResult } = await supabase.auth.getUser();
      const userId = authResult?.user?.id ?? null;
      const { error } = await supabase.from("user_feedback").insert({
        user_id: userId,
        persona_id: personaId ?? null,
        from_url: typeof window !== "undefined" ? window.location.href : null,
        client_id: clientId ?? null,
        feedback_title: feedbackTitle,
        feedback_body: feedbackBody.length > 0 ? feedbackBody : null,
      });

      if (error) {
        throw error;
      }

      setStatus({ message: "Thanks for sharing your thoughts!", tone: "positive" });
      setShowFeedbackModal(false);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[PersonaActionsMenu] Failed to submit feedback", error);
      setStatus({ message: "Couldn't save feedback. Please try again.", tone: "warning" });
      return false;
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const badgeColor = status?.tone === "positive" ? "#15803d" : status?.tone === "warning" ? "#b91c1c" : "#475569";

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
      {showFeedbackModal ? (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
          isSubmitting={submittingFeedback}
        />
      ) : null}
    </div>
  );
}

type FeedbackModalProps = {
  onClose: () => void;
  onSubmit: (details: { subject: string; content: string }) => Promise<boolean> | boolean;
  isSubmitting: boolean;
};

function FeedbackModal({ onClose, onSubmit, isSubmitting }: FeedbackModalProps) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="User feedback"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.58)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 24,
          background: "#ffffff",
          boxShadow: "0 28px 60px rgba(15, 23, 42, 0.28)",
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.01em",
              color: "#0f172a",
              fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
            }}
          >
            User feedback
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feedback dialog"
            style={{
              border: "none",
              background: "transparent",
              color: "#334155",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.6,
            color: "#475569",
            fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
          }}
        >
          If you're experiencing any problems or have suggestions for improvement, please share your thoughts with us. The more specific information you provide, the better we can help.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const trimmedSubject = subject.trim();
            const trimmedContent = content.trim();

            if (!trimmedSubject) {
              setFormError("Add a subject so we can route your feedback.");
              return;
            }

            setFormError(null);
            const succeeded = await onSubmit({ subject: trimmedSubject, content: trimmedContent });
            if (succeeded) {
              setSubject("");
              setContent("");
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#334155" }}>
            Subject
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Give your feedback a quick title"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.6)",
                fontSize: 14,
                color: "#0f172a",
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#334155" }}>
            Content
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Share what's working well or what needs attention"
              rows={5}
              style={{
                padding: "12px",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.6)",
                fontSize: 14,
                color: "#0f172a",
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
                resize: "vertical",
              }}
            />
          </label>
          {formError ? (
            <span
              role="alert"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#b91c1c",
                fontFamily: "'Cooper Light BT', 'CooperBT', Cooper, serif",
              }}
            >
              {formError}
            </span>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.5)",
                background: "transparent",
                color: "#334155",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                cursor: "pointer",
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(15, 23, 42, 0.16)",
                background: "#0f172a",
                color: "#f8fafc",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.05em",
                cursor: "pointer",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.transform = "translateY(-1px)";
                event.currentTarget.style.boxShadow = "0 10px 20px rgba(15, 23, 42, 0.18)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.transform = "translateY(0)";
                event.currentTarget.style.boxShadow = "none";
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
