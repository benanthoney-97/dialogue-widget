"use client";
import React, { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveDestinationForUser } from "../lib/authRedirect";
import { supabase } from "../lib/supabaseClient";

const companySizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

export default function WelcomeOnboardingPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [companySize, setCompanySize] = useState(companySizeOptions[0]);
  const [team, setTeam] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const router = useRouter();

  const isFormValid = name.trim() && company.trim() && team.trim();

  const handleFieldChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setter(event.target.value);
    if (submitted) {
      setSubmitted(false);
    }
    if (submissionError) {
      setSubmissionError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmitted(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        throw new Error("Unable to confirm your session. Please sign out and back in.");
      }

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: name.trim(),
          companyName: company.trim(),
          companySize,
          teamName: team.trim(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Unable to save your details right now.");
      }

      setSubmitted(true);

      const email = session.user.email ?? "";
      if (email) {
        try {
          const matchResponse = await fetch("/api/domain-match", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          });
          if (matchResponse.ok) {
            const payload = (await matchResponse.json()) as {
              found?: boolean;
              domain?: string;
              workspaces?: { id?: number; slug?: string; name?: string }[];
            };
            const normalizedMatches = (payload.workspaces ?? []).map((workspace) => ({
              id: typeof workspace?.id === "number" ? workspace.id : undefined,
              slug: workspace.slug?.trim(),
              name: workspace.name?.trim(),
            }));

            const matches = normalizedMatches
              .filter((workspace) => Boolean(workspace.slug))
              .map((workspace): { id?: number; slug: string; name?: string } => ({
                id: workspace.id,
                slug: workspace.slug!,
                name: workspace.name,
              }));

            if (payload.found && matches.length) {
              const params = new URLSearchParams();
              if (payload.domain) {
                params.set("domain", payload.domain);
              }
              params.set("workspaces", JSON.stringify(matches));
              const primaryWorkspace = matches[0];
              params.set("workspaceSlug", primaryWorkspace.slug);
              if (primaryWorkspace.name) {
                params.set("workspaceName", primaryWorkspace.name);
              }
              router.push(`/welcome/domain-match?${params.toString()}`);
              return;
            }
          }
        } catch (matchError) {
          console.error("[welcome] Domain lookup failed", matchError);
        }
      }

      const destination = await resolveDestinationForUser(supabase, session.user.id);
      router.push(destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save your details right now.";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page welcome-page">
      <div className="auth-card welcome-card">
        <div aria-hidden="true" className="auth-card__glow" />
        <div className="auth-card__content welcome-content">
          <header className="welcome-header">
            <p className="welcome-kicker">First things first</p>
            <h1>Tell us a little about you</h1>
            <p className="welcome-subtitle">
              This helps us tailor Dialogue to how your team works. We’ll keep it short—just the essentials we need to
              get you going.
            </p>
          </header>

          <form className="auth-form welcome-form" onSubmit={handleSubmit}>
            {[{
              label: "Name",
              value: name,
              setValue: setName,
              placeholder: "E.g. Jordan Lee",
            }, {
              label: "Company",
              value: company,
              setValue: setCompany,
              placeholder: "E.g. Northwind Labs",
            }].map((field) => (
              <label className="auth-form__field" key={field.label}>
                <span className="auth-form__label">{field.label}</span>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={field.value}
                  onChange={handleFieldChange(field.setValue)}
                  required
                  className="auth-form__input"
                />
              </label>
            ))}

            <label className="auth-form__field">
              <span className="auth-form__label">Company size</span>
              <select
                value={companySize}
                onChange={handleFieldChange(setCompanySize)}
                className="auth-form__input"
              >
                {companySizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="auth-form__field">
              <span className="auth-form__label">Team</span>
              <input
                type="text"
                placeholder="E.g. Product research"
                value={team}
                onChange={handleFieldChange(setTeam)}
                required
                className="auth-form__input"
              />
            </label>

            <button
              type="submit"
              className="auth-button auth-button--primary welcome-submit"
                disabled={!isFormValid || isSubmitting}
            >
                {isSubmitting ? "Saving…" : submitted ? "All set" : "Save and continue"}
            </button>

              <p className={`welcome-message ${submitted ? "welcome-confirmation" : "welcome-help"}`}>
          {submitted
            ? "Thanks, we’ve saved your details. You can adjust them later in your profile."
            : "We’ll use these details to personalize your workspace and make invitations easier."}
              </p>
              {submissionError && <p className="welcome-error">{submissionError}</p>}
          </form>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          max-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 36px clamp(18px, 4vw, 48px);
          background:
            radial-gradient(circle at 18% -10%, rgba(169, 198, 255, 0.42) 0%, rgba(244, 248, 255, 0) 40%),
            radial-gradient(circle at 82% 0%, rgba(132, 180, 255, 0.36) 0%, rgba(244, 248, 255, 0) 38%),
            linear-gradient(150deg, #f8fbff 0%, #edf4ff 48%, #e1edff 100%);
          color: #052033;
          font-family: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
        }

        .welcome-card {
          width: min(520px, 100%);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.88) 100%);
          border-radius: 28px;
          padding: clamp(30px, 4vw, 42px);
          color: inherit;
          box-shadow: 0 28px 68px rgba(42, 82, 160, 0.18);
          border: 1px solid rgba(209, 223, 255, 0.78);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
          max-height: min(760px, calc(100svh - 56px));
        }

        .welcome-content {
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-height: calc(100% - 28px);
          overflow-y: auto;
          padding-right: 4px;
        }

        .welcome-header h1 {
          margin: 0;
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 800;
          font-family: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
          color: #052033;
        }

        .welcome-kicker {
          margin-bottom: 8px;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(63, 96, 150, 0.72);
        }

        .welcome-subtitle {
          margin: 0;
          color: rgba(55, 82, 124, 0.8);
          line-height: 1.5;
        }

        .welcome-form {
          gap: 18px;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .welcome-message {
          margin: 0;
          font-size: 13px;
        }

        .welcome-error {
          margin: 6px 0 0;
          font-size: 13px;
          color: #dc2626;
        }

        .welcome-help {
          color: rgba(55, 82, 124, 0.72);
        }

        .welcome-confirmation {
          color: #16a34a;
          text-align: center;
        }

        .auth-card__glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0));
          opacity: 0.4;
          pointer-events: none;
        }

        .auth-card__content {
          position: relative;
          z-index: 2;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
        }

        .auth-form__field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-form__label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(43, 70, 105, 0.85);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .auth-form__input {
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          padding: 12px 14px;
          font-size: 15px;
          background: #f8fbff;
          color: #0c1b33;
          font-family: inherit;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .auth-form__input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.25);
        }

        .auth-button {
          border-radius: 999px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .auth-button--primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
        }

        .auth-button--primary:disabled {
          background: rgba(37, 99, 235, 0.5);
          box-shadow: none;
        }

        .welcome-submit:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .welcome-submit {
          font-size: 15px;
          padding: 12px 18px;
        }

        @media (max-width: 540px) {
          .welcome-card {
            border-radius: 24px;
            padding: 28px;
          }

          .welcome-content {
            gap: 24px;
          }
        }
      `}</style>
    </main>
  );
}