"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
    <main className="auth-page">
      <div className="auth-card">
        <header className="auth-card__header">
          <h1 className="auth-card__title">Accept your Dialogue invite</h1>
          <p className="auth-card__subtitle">
            {invite?.clientName ? `Join ${invite.clientName}` : "Join your Dialogue workspace"}
          </p>
        </header>

        {inviteLoading ? (
          <p className="auth-copy">Loading invitation…</p>
        ) : inviteError ? (
          <p className="auth-copy auth-copy--error">{inviteError}</p>
        ) : !invite ? (
          <p className="auth-copy auth-copy--error">Invitation not found.</p>
        ) : (
          <section className="auth-stack">
            <div className="auth-info">
              <div className="auth-info__label">Invitation for</div>
              <div className="auth-info__value">{invite.email}</div>
              <div className="auth-info__meta">
                Role: {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
              </div>
              {inviteExpiryText ? (
                <div className="auth-info__meta auth-info__meta--muted">Expires {inviteExpiryText}</div>
              ) : null}
            </div>

            {inviteStatusText ? <div className="auth-warning">{inviteStatusText}</div> : null}

            {sessionEmailMismatch ? (
              <div className="auth-warning auth-warning--actionable">
                You are signed in as <strong>{session?.user?.email}</strong>, but this invite is for{" "}
                <strong>{invite.email}</strong>. Please sign out and sign in with the invited email.
                <div className="auth-warning__actions">
                  <button type="button" onClick={handleSignOut} className="auth-button auth-button--secondary">
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}

            {!session ? (
              <section className="auth-section auth-section--elevated">
                <h2 className="auth-section__title">
                  {mode === "login" ? "Sign in to continue" : "Create your account"}
                </h2>
                <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="auth-form">
                  <label className="auth-form__field">
                    <span className="auth-form__label">Email address</span>
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
                      className={`auth-form__input${invite?.email ? " auth-form__input--readonly" : ""}`}
                    />
                  </label>
                  <label className="auth-form__field">
                    <span className="auth-form__label">Password</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="auth-form__input"
                    />
                  </label>
                  {mode === "signup" ? (
                    <label className="auth-form__field">
                      <span className="auth-form__label">Confirm password</span>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        className="auth-form__input"
                      />
                    </label>
                  ) : null}
                  <button type="submit" className="auth-button auth-button--primary" disabled={authSubmitting}>
                    {authSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                  </button>
                </form>
                {authFeedback ? (
                  <div role="status" className={`auth-feedback auth-feedback--${authFeedback.type}`}>
                    {authFeedback.message}
                  </div>
                ) : null}
                <div className="auth-toggle">
                  <span className="auth-toggle__text">
                    {mode === "login" ? "Need an account?" : "Already registered?"}
                  </span>
                  <button type="button" onClick={handleToggleMode} className="auth-button auth-button--link">
                    {mode === "login" ? "Create one" : "Sign in"}
                  </button>
                </div>
              </section>
            ) : null}

            {session && !sessionEmailMismatch ? (
              <div className="auth-stack auth-stack--accept">
                <div className="auth-copy auth-copy--muted">
                  Signed in as <strong>{session.user.email}</strong>
                </div>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={!canAccept || acceptSubmitting}
                  className="auth-button auth-button--primary"
                >
                  {acceptSubmitting ? "Accepting…" : "Accept invitation"}
                </button>
                {acceptFeedback ? (
                  <div role="status" className={`auth-feedback auth-feedback--${acceptFeedback.type}`}>
                    {acceptFeedback.message}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>
      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px clamp(18px, 4vw, 52px);
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 18% -10%, rgba(169, 198, 255, 0.4) 0%, rgba(244, 248, 255, 0) 42%),
            radial-gradient(circle at 82% 0%, rgba(132, 180, 255, 0.32) 0%, rgba(244, 248, 255, 0) 36%),
            linear-gradient(150deg, #f8fbff 0%, #edf4ff 48%, #e1edff 100%);
          color: #052033;
          font-family: "Cooper Light BT", "CooperBT", "Cooper", serif;
        }

        .auth-page::before,
        .auth-page::after {
          content: "";
          position: absolute;
          width: clamp(320px, 45vw, 540px);
          height: clamp(320px, 45vw, 540px);
          filter: blur(110px);
          opacity: 0.32;
          pointer-events: none;
          z-index: 0;
        }

        .auth-page::before {
          top: -220px;
          left: -160px;
          background: radial-gradient(circle, rgba(168, 207, 255, 0.5) 0%, rgba(244, 248, 255, 0) 70%);
        }

        .auth-page::after {
          bottom: -240px;
          right: -200px;
          background: radial-gradient(circle, rgba(123, 170, 255, 0.45) 0%, rgba(244, 248, 255, 0) 68%);
        }

        .auth-card {
          width: min(560px, 100%);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.9) 100%);
          border-radius: 30px;
          padding: clamp(32px, 5vw, 46px);
          color: inherit;
          box-shadow: 0 32px 82px rgba(59, 118, 216, 0.18);
          border: 1px solid rgba(205, 220, 255, 0.85);
          position: relative;
          overflow: hidden;
          isolation: isolate;
          backdrop-filter: blur(18px);
        }

        .auth-card::before {
          content: "";
          position: absolute;
          inset: -58% -22% auto auto;
          width: clamp(220px, 30vw, 300px);
          height: clamp(220px, 30vw, 300px);
          background: radial-gradient(circle at center, rgba(132, 180, 255, 0.28) 0%, rgba(132, 180, 255, 0) 72%);
          transform: rotate(16deg);
          opacity: 0.9;
          z-index: -1;
        }

        .auth-card__header {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .auth-card__title {
          margin: 0;
          font-size: clamp(26px, 4vw, 32px);
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .auth-card__subtitle {
          margin: 0;
          font-size: clamp(14px, 3vw, 16px);
          line-height: 1.6;
          color: rgba(55, 82, 124, 0.8);
          max-width: 420px;
        }

        .auth-stack {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .auth-stack--accept {
          gap: 14px;
        }

        .auth-copy {
          font-size: 15px;
          color: rgba(39, 65, 110, 0.88);
          margin: 0;
        }

        .auth-copy--error {
          color: rgba(191, 38, 38, 0.82);
          font-weight: 600;
        }

        .auth-copy--muted {
          font-size: 13px;
          color: rgba(55, 82, 124, 0.7);
        }

        .auth-info {
          padding: 18px 20px;
          border-radius: 20px;
          background: linear-gradient(135deg, rgba(244, 249, 255, 0.95) 0%, rgba(228, 239, 255, 0.88) 100%);
          border: 1px solid rgba(193, 210, 255, 0.78);
          box-shadow: 0 18px 48px rgba(73, 126, 210, 0.12);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-info__label {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(63, 96, 150, 0.7);
        }

        .auth-info__value {
          font-size: 20px;
          font-weight: 700;
          color: #052033;
        }

        .auth-info__meta {
          font-size: 13px;
          color: rgba(43, 108, 176, 0.9);
        }

        .auth-info__meta--muted {
          color: rgba(63, 96, 150, 0.72);
        }

        .auth-warning {
          padding: 14px 16px;
          border-radius: 18px;
          font-size: 13px;
          background: linear-gradient(135deg, rgba(254, 242, 242, 0.95) 0%, rgba(254, 226, 226, 0.9) 100%);
          color: rgba(153, 27, 27, 0.9);
          border: 1px solid rgba(248, 113, 113, 0.34);
          font-weight: 600;
          line-height: 1.45;
        }

        .auth-warning--actionable {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .auth-warning__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .auth-section {
          padding: 20px 22px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(205, 220, 255, 0.7);
          box-shadow: 0 22px 52px rgba(73, 126, 210, 0.12);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-section--elevated {
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 247, 255, 0.9) 100%);
        }

        .auth-section__title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: rgba(33, 66, 120, 0.92);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-form__field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-form__label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(63, 96, 150, 0.72);
        }

        .auth-form__input {
          appearance: none;
          border-radius: 16px;
          border: 1px solid rgba(178, 199, 240, 0.8);
          background: #ffffff;
          padding: 13px 16px;
          color: #052033;
          font-size: 15px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          box-shadow: 0 16px 40px rgba(59, 118, 216, 0.08);
        }

        .auth-form__input::placeholder {
          color: rgba(107, 132, 176, 0.6);
        }

        .auth-form__input:focus-visible {
          outline: none;
          border-color: rgba(82, 146, 255, 0.85);
          box-shadow: 0 18px 46px rgba(68, 116, 210, 0.16);
          background: #fafdff;
        }

        .auth-form__input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-form__input--readonly {
          background: rgba(238, 244, 255, 0.8);
          cursor: not-allowed;
          color: rgba(55, 82, 124, 0.9);
        }

        .auth-button {
          border: none;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, color 0.18s ease;
        }

        .auth-button:disabled {
          cursor: wait;
          opacity: 0.72;
          transform: none;
          box-shadow: none;
        }

        .auth-button--primary {
          margin-top: 12px;
          padding: 13px 18px;
          border-radius: 16px;
          background: linear-gradient(135deg, #5c9cff 0%, #2b6cb0 100%);
          color: #f6fbff;
          box-shadow: 0 18px 48px rgba(82, 146, 255, 0.32);
        }

        .auth-button--primary:not(:disabled):hover,
        .auth-button--primary:not(:disabled):focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 22px 54px rgba(82, 146, 255, 0.4);
        }

        .auth-button--secondary {
          padding: 11px 16px;
          border-radius: 14px;
          border: 1px solid rgba(82, 146, 255, 0.4);
          background: #ffffff;
          color: rgba(43, 108, 176, 0.95);
          box-shadow: 0 14px 36px rgba(73, 126, 210, 0.14);
        }

        .auth-button--secondary:hover,
        .auth-button--secondary:focus-visible {
          color: rgba(24, 82, 155, 0.98);
          border-color: rgba(43, 108, 176, 0.6);
        }

        .auth-button--link {
          padding: 0;
          background: none;
          color: rgba(43, 108, 176, 0.92);
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 4px;
        }

        .auth-button--link:hover,
        .auth-button--link:focus-visible {
          color: rgba(24, 82, 155, 0.98);
        }

        .auth-feedback {
          margin-top: -4px;
          padding: 12px 14px;
          border-radius: 16px;
          font-size: 13px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 18px 42px rgba(76, 124, 210, 0.14);
        }

        .auth-feedback--success {
          border-color: rgba(34, 197, 94, 0.28);
          color: rgba(22, 101, 52, 0.92);
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.96) 0%, rgba(217, 249, 233, 0.92) 100%);
        }

        .auth-feedback--error {
          border-color: rgba(248, 113, 113, 0.34);
          color: rgba(153, 27, 27, 0.92);
          background: linear-gradient(135deg, rgba(254, 242, 242, 0.96) 0%, rgba(254, 226, 226, 0.9) 100%);
        }

        .auth-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .auth-toggle__text {
          font-size: 13px;
          color: rgba(55, 82, 124, 0.72);
        }

        @media (max-width: 620px) {
          .auth-card {
            border-radius: 26px;
            padding: 28px;
          }

          .auth-section {
            border-radius: 20px;
            padding: 20px;
          }

          .auth-toggle {
            flex-direction: column;
            align-items: flex-start;
          }

          .auth-button--link {
            align-self: flex-end;
          }
        }
      `}</style>
      <style jsx global>{`
        @font-face {
          font-family: "CooperBT";
          src: url("/fonts/CooperBT/Cooper Light BT.ttf") format("truetype");
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
            background:
              "linear-gradient(150deg, #f8fbff 0%, #edf4ff 48%, #e1edff 100%)",
            fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
            color: "#052033",
            padding: "32px",
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
