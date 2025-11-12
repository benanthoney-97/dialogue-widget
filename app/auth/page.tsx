"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { resolveDestinationForUser } from "../lib/authRedirect";

type AuthMode = "login" | "signup";

function sanitizeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  const trimmed = decoded.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (trimmed.startsWith("/auth")) {
    return null;
  }

  try {
    const url = new URL(trimmed, "https://placeholder.local");
    const sanitized = `${url.pathname}${url.search}${url.hash}`;
    return sanitized || null;
  } catch {
    return null;
  }
}

function AuthPageContent() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    let mutated = false;
    ["access_token", "expires_in", "refresh_token", "token_type", "type"].forEach((key) => {
      if (params.has(key)) {
        params.delete(key);
        mutated = true;
      }
    });
    if (mutated && typeof window !== "undefined") {
      const next = params.toString();
      router.replace(next ? `/auth?${next}` : "/auth");
    }
  }, [router, searchParams]);

  useEffect(() => {
    let isActive = true;

    const redirectIfAuthenticated = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isActive || error) {
          return;
        }

        const user = data?.session?.user ?? null;
        if (!user) {
          return;
        }

        const redirectHint = sanitizeRedirectPath(searchParams?.get("redirectTo"));
        const destination = redirectHint ?? (await resolveDestinationForUser(supabase, user.id));
        if (!isActive) {
          return;
        }

        router.replace(destination);
      } catch (sessionError) {
        console.error("[auth] session redirect failed", sessionError);
      }
    };

    redirectIfAuthenticated();

    return () => {
      isActive = false;
    };
  }, [router, searchParams]);

  const verificationContext = useMemo(() => {
    const flag = searchParams?.get("verification"),
      emailType = searchParams?.get("email") ?? undefined;
    if (flag === "success") {
      return {
        type: "success" as const,
        headline: "Email verified",
        message:
          emailType === "change"
            ? "Thanks for confirming your new address. You can sign in with it now."
            : "Thanks for confirming your address. You can sign in below.",
      };
    }
    const supabaseError = searchParams?.get("error");
    if (flag === "error" || supabaseError) {
      const reason = searchParams?.get("reason") ?? supabaseError ?? "unknown";
      return {
        type: "error" as const,
        headline: "Verification failed",
        message:
          reason === "expired"
            ? "That verification link has expired. Please request a fresh one from the app."
            : "We couldn’t verify that link. Request a new email and try again.",
      };
    }
    return null;
  }, [searchParams]);

  const heading = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode]
  );

  const subheading = useMemo(
    () =>
      mode === "login"
        ? "Sign in with the email you use for Dialogue."
        : "Enter your details to start collaborating with Dialogue.",
    [mode]
  );

  const helperText =
    mode === "login"
      ? "Don't have an account yet?"
      : "Already have an account?";

  const helperActionText = mode === "login" ? "Create one" : "Log in";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFeedback(null);

    if (mode === "signup" && password !== confirmPassword) {
      setFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: origin
            ? {
                emailRedirectTo: `${origin}/auth`,
              }
            : undefined,
        });
        if (error) throw error;
        setFeedback({
          type: "success",
          message: "Check your inbox to confirm your email before signing in.",
        });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const userId = signInData?.user?.id;
        if (!userId) {
          router.replace("/");
          return;
        }
        const redirectHint = sanitizeRedirectPath(searchParams?.get("redirectTo"));
        const destination = redirectHint ?? (await resolveDestinationForUser(supabase, userId));
        router.replace(destination);
        setFeedback({ type: "success", message: "Signed in successfully." });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setConfirmPassword("");
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div aria-hidden="true" className="auth-card__glow" />
        <div className="auth-card__content">
          <header className="auth-card__header">
            <h1 className="auth-card__title">{heading}</h1>
            <p className="auth-card__subtitle">{subheading}</p>
          </header>

          {verificationContext ? (
            <div className={`auth-verification auth-verification--${verificationContext.type}`} role="status">
              <h2>{verificationContext.headline}</h2>
              <p>{verificationContext.message}</p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="auth-form">
            <label className="auth-form__field">
              <span className="auth-form__label">Email address</span>
              <input
                type="email"
                required
                value={email}
                placeholder="you@example.com"
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                className="auth-form__input"
              />
            </label>
            <label className="auth-form__field">
              <span className="auth-form__label">Password</span>
              <input
                type="password"
                required
                value={password}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                className="auth-form__input"
              />
            </label>
            {mode === "signup" && (
              <label className="auth-form__field">
                <span className="auth-form__label">Confirm password</span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="auth-form__input"
                />
              </label>
            )}

            <button
              type="submit"
              className="auth-button auth-button--primary"
              disabled={submitting}
              onMouseDown={(event) => event.currentTarget.blur()}
            >
              {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          {feedback && (
            <div role="status" className={`auth-feedback auth-feedback--${feedback.type}`}>
              {feedback.message}
            </div>
          )}

          <div className="auth-card__helper-row">
            <div className="auth-card__helper-text">{helperText}</div>
            <button type="button" onClick={toggleMode} className="auth-button auth-button--link">
              {helperActionText}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 36px clamp(18px, 4vw, 48px);
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 18% -10%, rgba(169, 198, 255, 0.42) 0%, rgba(244, 248, 255, 0) 40%),
            radial-gradient(circle at 82% 0%, rgba(132, 180, 255, 0.36) 0%, rgba(244, 248, 255, 0) 38%),
            linear-gradient(150deg, #f8fbff 0%, #edf4ff 48%, #e1edff 100%);
          color: #052033;
          font-family: "Cooper Light BT", "CooperBT", "Cooper", serif;
        }

        .auth-page::before,
        .auth-page::after {
          content: "";
          position: absolute;
          width: clamp(320px, 45vw, 520px);
          height: clamp(320px, 45vw, 520px);
          filter: blur(110px);
          opacity: 0.32;
          pointer-events: none;
          z-index: 0;
        }

        .auth-page::before {
          top: -220px;
          left: -140px;
          background: radial-gradient(circle, rgba(168, 207, 255, 0.5) 0%, rgba(244, 248, 255, 0) 65%);
        }

        .auth-page::after {
          bottom: -240px;
          right: -180px;
          background: radial-gradient(circle, rgba(123, 170, 255, 0.48) 0%, rgba(244, 248, 255, 0) 70%);
        }

        .auth-card {
          width: min(440px, 100%);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.88) 100%);
          border-radius: 28px;
          padding: clamp(30px, 4vw, 42px);
          color: inherit;
          box-shadow: 0 28px 68px rgba(42, 82, 160, 0.18);
          border: 1px solid rgba(209, 223, 255, 0.78);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .auth-card__glow {
          position: absolute;
          inset: -60% -20% auto auto;
          width: clamp(200px, 28vw, 280px);
          height: clamp(200px, 28vw, 280px);
          background: radial-gradient(circle at center, rgba(132, 180, 255, 0.26) 0%, rgba(132, 180, 255, 0) 70%);
          transform: rotate(18deg);
          opacity: 0.9;
        }

        .auth-card__content {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 32px;
          z-index: 1;
        }

        .auth-card__header {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .auth-card__title {
          margin: 0;
          font-size: clamp(26px, 4vw, 30px);
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .auth-card__subtitle {
          margin: 0;
          font-size: clamp(14px, 3vw, 16px);
          line-height: 1.6;
          color: rgba(55, 82, 124, 0.82);
          max-width: 360px;
        }

        .auth-verification {
          margin-bottom: 18px;
          border-radius: 14px;
          padding: 16px 18px;
          background: rgba(79, 70, 229, 0.08);
          border: 1px solid rgba(79, 70, 229, 0.18);
          display: grid;
          gap: 6px;
        }

        .auth-verification h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #312e81;
        }

        .auth-verification p {
          margin: 0;
          font-size: 14px;
          color: #1e1b4b;
        }

        .auth-verification--error {
          background: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.25);
        }

        .auth-verification--error h2 {
          color: #991b1b;
        }

        .auth-verification--error p {
          color: #7f1d1d;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
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
          margin-top: -12px;
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

        .auth-card__helper-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .auth-card__helper-text {
          font-size: 13px;
          color: rgba(55, 82, 124, 0.72);
        }

        @media (max-width: 540px) {
          .auth-card {
            border-radius: 24px;
            padding: 28px;
          }

          .auth-card__content {
            gap: 28px;
          }

          .auth-card__helper-row {
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

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-page__loading">Loading…</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
