"use client";

import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const router = useRouter();

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
        const { error } = await supabase.auth.signUp({ email, password });
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
        let destination = `/client/${userId}/personas`;
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("default_agent_id")
            .eq("id", userId)
            .maybeSingle();
          const defaultAgentId = profile?.default_agent_id as string | null | undefined;
          if (defaultAgentId) {
            const { data: agentRow } = await supabase
              .from("agent_map")
              .select("key")
              .eq("agent_id", defaultAgentId)
              .maybeSingle();
            if (agentRow?.key) {
              destination = `/client/${userId}/documents/${agentRow.key}`;
            }
          }
        } catch {
          // ignore errors during destination resolution
        }
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
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #243b6b 0%, #0a1628 65%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'CooperBT', Cooper, 'Cooper Light BT', serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "rgba(12, 22, 42, 0.92)",
          borderRadius: 18,
          padding: "32px 36px",
          color: "#e6eaff",
          boxShadow: "0 22px 55px rgba(7, 12, 24, 0.6)",
          border: "1px solid rgba(82, 95, 225, 0.22)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-50% -20% auto auto",
            width: 240,
            height: 240,
            background:
              "radial-gradient(circle, rgba(82,95,225,0.35) 0%, rgba(82,95,225,0) 70%)",
            transform: "rotate(25deg)",
          }}
        />
        <div style={{ position: "relative" }}>
          <header style={{ marginBottom: 26 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{heading}</h1>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 15,
                color: "#9fb3ff",
                lineHeight: 1.5,
              }}
            >
              {subheading}
            </p>
          </header>

          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#c7d5ff" }}>
                Email address
              </span>
              <input
                type="email"
                required
                value={email}
                placeholder="you@example.com"
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#c7d5ff" }}>
                Password
              </span>
              <input
                type="password"
                required
                value={password}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
            </label>
            {mode === "signup" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#c7d5ff" }}>
                  Confirm password
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  style={inputStyle}
                />
              </label>
            )}

            <button
              type="submit"
              style={{
                marginTop: 8,
                padding: "12px 18px",
                borderRadius: 12,
                border: "none",
                fontWeight: 800,
                fontSize: 15,
                background: "linear-gradient(135deg, #525fe1 0%, #4350d1 100%)",
                color: "#F6F7F9fff",
                cursor: submitting ? "wait" : "pointer",
                boxShadow: "0 12px 40px rgba(82, 95, 225, 0.35)",
                transition: "transform 0.18s ease, box-shadow 0.18s ease",
                opacity: submitting ? 0.7 : 1,
              }}
              disabled={submitting}
              onMouseDown={(event) => event.currentTarget.blur()}
            >
              {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          {feedback && (
            <div
              role="status"
              style={{
                marginTop: 18,
                padding: "12px 14px",
                borderRadius: 12,
                fontSize: 13,
                background:
                  feedback.type === "success" ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)",
                color: feedback.type === "success" ? "#bbf7d0" : "#fca5a5",
                border:
                  feedback.type === "success"
                    ? "1px solid rgba(34, 197, 94, 0.4)"
                    : "1px solid rgba(239, 68, 68, 0.4)",
              }}
            >
              {feedback.message}
            </div>
          )}

          <div
            style={{
              marginTop: 28,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "#9fb3ff" }}>{helperText}</div>
            <button
              type="button"
              onClick={toggleMode}
              style={{
                border: "none",
                background: "transparent",
                color: "#7ea0e6",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {helperActionText}
            </button>
          </div>
        </div>
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
