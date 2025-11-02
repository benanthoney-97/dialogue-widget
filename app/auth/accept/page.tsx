"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabaseClient";

type AuthMode = "login" | "signup";

type InviteDetails = {
  id: string;
  email: string;
  role: string;
  status: string;
  clientId: number;
  clientName: string | null;
  expiresAt: string | null;
  hasAccount: boolean;
};

type Feedback = { type: "success" | "error"; message: string } | null;

function formatDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";

  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const userSelectedModeRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<Feedback>(null);
  const [acceptFeedback, setAcceptFeedback] = useState<Feedback>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user?.email) {
        setEmail(data.session.user.email);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user?.email) {
        setEmail(newSession.user.email);
      }
    });
    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setInviteLoading(false);
      setInviteError("Missing invitation token.");
      setInvite(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setInviteLoading(true);
    setInviteError(null);

    fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load invitation");
        }
        return payload as InviteDetails;
      })
      .then((data) => {
        if (cancelled) return;
        setInvite(data);
      })
      .catch((error) => {
        if (cancelled) return;
        setInviteError(error instanceof Error ? error.message : "Unable to load invitation");
        setInvite(null);
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token]);

  const inviteStatusText = useMemo(() => {
    if (!invite) return null;
    if (invite.status === "expired") return "This invitation has expired.";
    if (invite.status === "accepted") return "This invitation has already been accepted.";
    if (invite.status === "pending") return null;
    return `This invitation is ${invite.status}.`;
  }, [invite]);

  const inviteExpiryText = useMemo(() => formatDate(invite?.expiresAt ?? null), [invite?.expiresAt]);

  const sessionEmailMismatch = useMemo(() => {
    if (!invite?.email || !session?.user?.email) return false;
    return invite.email.toLowerCase() !== session.user.email.toLowerCase();
  }, [invite?.email, session?.user?.email]);

  const canAccept = useMemo(() => {
    if (!invite || invite.status !== "pending") return false;
    if (!session || sessionEmailMismatch) return false;
    return true;
  }, [invite, session, sessionEmailMismatch]);

  useEffect(() => {
    if (!invite?.email) return;
    setEmail(invite.email);
  }, [invite?.email]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authSubmitting) return;
    if (!invite?.email || email.toLowerCase() !== invite.email.toLowerCase()) {
      setAuthFeedback({ type: "error", message: "Please use the invited email to sign in." });
      return;
    }
    setAuthFeedback(null);
    setAuthSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthFeedback({ type: "success", message: "Signed in." });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in. Please try again.";
      setAuthFeedback({ type: "error", message });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authSubmitting) return;
    if (!invite?.email || email.toLowerCase() !== invite.email.toLowerCase()) {
      setAuthFeedback({ type: "error", message: "Please sign up using the invited email." });
      return;
    }
    if (password !== confirmPassword) {
      setAuthFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }
    setAuthFeedback(null);
    setAuthSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setAuthFeedback({
        type: "success",
        message: "Check your inbox to confirm your email, then return here to accept the invite.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create account. Please try again.";
      setAuthFeedback({ type: "error", message });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!canAccept || acceptSubmitting || !session?.access_token) return;
    setAcceptFeedback(null);
    setAcceptSubmitting(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to accept invitation");
      }
      setAcceptFeedback({ type: "success", message: "Invitation accepted. Redirecting…" });
      setInvite((previous) => (previous ? { ...previous, status: "accepted" } : previous));
      setTimeout(() => {
        router.replace(`/client/${session.user.id}/personas`);
      }, 1500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to accept invitation. Please try again.";
      setAcceptFeedback({ type: "error", message });
    } finally {
      setAcceptSubmitting(false);
    }
  };

  const handleToggleMode = () => {
  userSelectedModeRef.current = true;
  setMode((prev) => (prev === "login" ? "signup" : "login"));
    setAuthFeedback(null);
    setConfirmPassword("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setAuthFeedback(null);
    userSelectedModeRef.current = false;
  };

  useEffect(() => {
    if (session || !invite) return;
    if (userSelectedModeRef.current) return;
    setMode(invite.hasAccount ? "login" : "signup");
  }, [invite, session]);

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={titleStyle}>Accept your Dialogue invite</h1>
          <p style={subtitleStyle}>
            {invite?.clientName ? `Join ${invite.clientName}` : "Join your Dialogue workspace"}
          </p>
        </header>

        {inviteLoading ? (
          <p style={bodyTextStyle}>Loading invitation…</p>
        ) : inviteError ? (
          <p style={{ ...bodyTextStyle, color: "#fca5a5" }}>{inviteError}</p>
        ) : !invite ? (
          <p style={{ ...bodyTextStyle, color: "#fca5a5" }}>Invitation not found.</p>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={infoBoxStyle}>
              <div style={{ fontSize: 13, color: "#9fb3ff", marginBottom: 6 }}>Invitation for</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{invite.email}</div>
              <div style={{ fontSize: 13, color: "#9fb3ff", marginTop: 6 }}>
                Role: {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
              </div>
              {inviteExpiryText ? (
                <div style={{ fontSize: 12, color: "#7ea0e6", marginTop: 8 }}>
                  Expires {inviteExpiryText}
                </div>
              ) : null}
            </div>

            {inviteStatusText ? <div style={warningBoxStyle}>{inviteStatusText}</div> : null}

            {sessionEmailMismatch ? (
              <div style={warningBoxStyle}>
                You are signed in as <strong>{session?.user?.email}</strong>, but this invite is for{" "}
                <strong>{invite.email}</strong>. Please sign out and sign in with the invited email.
                <div style={{ marginTop: 12 }}>
                  <button type="button" onClick={handleSignOut} style={secondaryButtonStyle}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}

            {!session ? (
              <section style={authSectionStyle}>
                <h2 style={sectionHeadingStyle}>
                  {mode === "login" ? "Sign in to continue" : "Create your account"}
                </h2>
                <form onSubmit={mode === "login" ? handleLogin : handleSignup} style={formStyle}>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Email address</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => {
                        if (!invite?.email) {
                          setEmail(event.target.value);
                        }
                      }}
                      autoComplete="off"
                      readOnly={Boolean(invite?.email)}
                      style={{
                        ...inputStyle,
                        background: invite?.email ? "rgba(16, 28, 54, 0.5)" : inputStyle.background,
                        cursor: invite?.email ? "not-allowed" : "text",
                      }}
                    />
                  </label>
                  <label style={labelStyle}>
                    <span style={labelTextStyle}>Password</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      style={inputStyle}
                    />
                  </label>
                  {mode === "signup" ? (
                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Confirm password</span>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        style={inputStyle}
                      />
                    </label>
                  ) : null}
                  <button type="submit" style={primaryButtonStyle} disabled={authSubmitting}>
                    {authSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                  </button>
                </form>
                {authFeedback ? (
                  <div
                    role="status"
                    style={{
                      marginTop: 14,
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 13,
                      backgroundColor:
                        authFeedback.type === "success"
                          ? "rgba(34, 197, 94, 0.18)"
                          : "rgba(239, 68, 68, 0.18)",
                      color: authFeedback.type === "success" ? "#bbf7d0" : "#fca5a5",
                      border:
                        authFeedback.type === "success"
                          ? "1px solid rgba(34, 197, 94, 0.4)"
                          : "1px solid rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    {authFeedback.message}
                  </div>
                ) : null}
                <div style={authToggleRowStyle}>
                  <span>{mode === "login" ? "Need an account?" : "Already registered?"}</span>
                  <button type="button" onClick={handleToggleMode} style={toggleButtonStyle}>
                    {mode === "login" ? "Create one" : "Sign in"}
                  </button>
                </div>
              </section>
            ) : null}

            {session && !sessionEmailMismatch ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#9fb3ff" }}>
                  Signed in as <strong>{session.user.email}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!canAccept || acceptSubmitting}
                  style={primaryButtonStyle}
                >
                  {acceptSubmitting ? "Accepting…" : "Accept invitation"}
                </button>
                {acceptFeedback ? (
                  <div
                    role="status"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontSize: 13,
                      backgroundColor:
                        acceptFeedback.type === "success"
                          ? "rgba(34, 197, 94, 0.18)"
                          : "rgba(239, 68, 68, 0.18)",
                      color: acceptFeedback.type === "success" ? "#bbf7d0" : "#fca5a5",
                      border:
                        acceptFeedback.type === "success"
                          ? "1px solid rgba(34, 197, 94, 0.4)"
                          : "1px solid rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    {acceptFeedback.message}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>
      <style>{`
        @font-face {
          font-family: 'CooperBT';
          src: url('/fonts/CooperBT/Cooper Light BT.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `}</style>
    </main>
  );
}

export default function AcceptInvitePageWithSuspense() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at top, #243b6b 0%, #0a1628 65%)",
            fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
            color: "#e6eaff",
            padding: "24px",
          }}
        >
          <p style={{ fontSize: 16 }}>Loading…</p>
        </main>
      }
    >
      <AcceptInvitePage />
    </Suspense>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #243b6b 0%, #0a1628 65%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "min(580px, 100%)",
  background: "rgba(12, 22, 42, 0.92)",
  borderRadius: 20,
  padding: "36px 40px",
  color: "#e6eaff",
  boxShadow: "0 24px 60px rgba(7, 12, 24, 0.6)",
  border: "1px solid rgba(82, 95, 225, 0.22)",
};

const titleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: 15,
  color: "#9fb3ff",
};

const bodyTextStyle: CSSProperties = {
  fontSize: 15,
  color: "#d6ddff",
};

const infoBoxStyle: CSSProperties = {
  padding: "16px 18px",
  borderRadius: 14,
  background: "rgba(30, 41, 99, 0.4)",
  border: "1px solid rgba(126, 160, 230, 0.28)",
};

const warningBoxStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  fontSize: 13,
  background: "rgba(239, 68, 68, 0.16)",
  color: "#fca5a5",
  border: "1px solid rgba(239, 68, 68, 0.38)",
  fontWeight: 600,
  lineHeight: 1.4,
};

const authSectionStyle: CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  background: "rgba(16, 28, 54, 0.7)",
  border: "1px solid rgba(82, 95, 225, 0.22)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: 0,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelTextStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#c7d5ff",
};

const inputStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(126, 160, 230, 0.35)",
  background: "rgba(16, 28, 54, 0.85)",
  padding: "11px 14px",
  color: "#e6eaff",
  fontSize: 14,
  outline: "none",
  boxShadow: "0 6px 24px rgba(7, 13, 26, 0.25)",
  transition: "border 0.18s ease, box-shadow 0.18s ease",
};

const primaryButtonStyle: CSSProperties = {
  marginTop: 6,
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  fontWeight: 800,
  fontSize: 15,
  background: "linear-gradient(135deg, #525fe1 0%, #4350d1 100%)",
  color: "#F6F7F9",
  cursor: "pointer",
  boxShadow: "0 12px 40px rgba(82, 95, 225, 0.35)",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(126, 160, 230, 0.4)",
  background: "transparent",
  color: "#9fb3ff",
  fontWeight: 700,
  cursor: "pointer",
};

const authToggleRowStyle: CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  color: "#9fb3ff",
};

const toggleButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#7ea0e6",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "underline",
};
