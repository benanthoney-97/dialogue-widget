"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import { resolveDestinationForUser } from "@/app/lib/authRedirect";

type WorkspaceMatch = {
  slug: string;
  name?: string;
  id?: number;
};

export default function DomainMatchPromptClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const domain = useMemo(() => searchParams.get("domain"), [searchParams]);
  const workspaceMatches = useMemo(() => {
    const serialized = searchParams.get("workspaces");
    if (serialized) {
      try {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed)) {
          return parsed.reduce<WorkspaceMatch[]>((acc, workspace) => {
            const slug = typeof workspace?.slug === "string" ? workspace.slug.trim() : "";
            if (!slug) {
              return acc;
            }
            const rawId =
              typeof workspace?.id === "number"
                ? workspace.id
                : typeof workspace?.id === "string"
                ? Number(workspace.id)
                : undefined;
            const id = typeof rawId === "number" && Number.isFinite(rawId) ? rawId : undefined;
            acc.push({
              slug,
              id,
              name: typeof workspace?.name === "string" ? workspace.name.trim() : undefined,
            });
            return acc;
          }, []);
        }
      } catch (error) {
        console.error("[domain-match] Unable to parse workspace list", error);
      }
    }

    const legacySlug = searchParams.get("workspaceSlug");
    if (legacySlug) {
      return [
        {
          slug: legacySlug,
          name: searchParams.get("workspaceName") ?? undefined,
        },
      ];
    }

    return [];
  }, [searchParams]);
  const domainLabel = domain ? `@${domain}` : "your domain";
  const headerTitle =
    workspaceMatches.length === 1
      ? `Looks like ${domainLabel} already belongs to ${workspaceMatches[0].name ?? "this workspace"}`
      : `Looks like ${domainLabel} already belongs to ${workspaceMatches.length} workspace${
          workspaceMatches.length === 1 ? "" : "s"
        }`;
  const [joinStates, setJoinStates] = useState<Record<string, "pending" | "sent">>({});
  const [joinError, setJoinError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  const handleJoin = useCallback(async (workspace: WorkspaceMatch) => {
    if (!workspace.id) {
      setJoinError("We couldn’t determine which workspace this is yet. Please try again in a moment.");
      return;
    }

    let shouldSend = false;
    setJoinStates((prev) => {
      const currentState = prev[workspace.slug];
      if (currentState === "pending" || currentState === "sent") {
        return prev;
      }
      shouldSend = true;
      return { ...prev, [workspace.slug]: "pending" };
    });

    if (!shouldSend) {
      return;
    }

    setJoinError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || sessionError) {
        throw new Error("Unable to confirm your session. Please refresh and try again.");
      }
      const response = await fetch("/api/join-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId: workspace.id }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        throw new Error(
          errorPayload?.error ?? errorPayload?.message ?? "Unable to request access right now. Please try again later."
        );
      }

      setJoinStates((prev) => ({ ...prev, [workspace.slug]: "sent" }));
    } catch (error) {
      setJoinStates((prev) => {
        const next = { ...prev };
        delete next[workspace.slug];
        return next;
      });
      const message = error instanceof Error
        ? error.message
        : "Unable to request access right now. Please try again later.";
      setJoinError(message);
    }
  }, []);

  const requestSent = useMemo(
    () => Object.values(joinStates).some((value) => value === "sent"),
    [joinStates]
  );

  const handleContinue = useCallback(async () => {
    if (continuing) return;
    setContinuing(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (!session?.user?.id || error) {
      router.push("/personas");
      return;
    }
    const destination = await resolveDestinationForUser(supabase, session.user.id);
    router.push(destination);
  }, [continuing, router]);

  return (
    <main className="auth-page domain-match-page">
      <div className="auth-card domain-match-card">
        <div aria-hidden="true" className="auth-card__glow" />
        <div className="auth-card__content domain-match-content">
          <header className="welcome-header">
            <p className="welcome-kicker">Workspace detected</p>
            <h1>{headerTitle}</h1>
          </header>

          <div className="domain-match-actions">
            {workspaceMatches.length > 0 && (
              <>
                <div className="domain-match-list">
                  {workspaceMatches.map((workspace) => {
                    const currentState = joinStates[workspace.slug];
                    const isPending = currentState === "pending";
                    const isSent = currentState === "sent";
                    const hasClientId = typeof workspace.id === "number";
                    const label = isPending
                      ? "Requesting access…"
                      : isSent
                      ? "Request sent"
                      : `Join ${workspace.name ?? "this workspace"}`;

                    return (
                      <button
                        type="button"
                        key={workspace.slug}
                        className="auth-button auth-button--primary domain-match-list__button"
                        onClick={() => handleJoin(workspace)}
                        disabled={!hasClientId || isPending || isSent}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {joinError && <p className="domain-match-error">{joinError}</p>}
                {requestSent && (
                  <p className="domain-match-request-feedback">
                    Thanks! We’ll let that workspace know you’d like to join and will notify you when they respond.
                  </p>
                )}
              </>
            )}
            <button
              type="button"
              className="auth-button domain-match-ghost"
              onClick={handleContinue}
              disabled={continuing}
            >
              {continuing ? "Continuing…" : "Keep building my workspace"}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .domain-match-page {
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
        }

  .domain-match-card {
          width: min(520px, 100%);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.88) 100%);
          border-radius: 28px;
          padding: clamp(30px, 4vw, 42px);
          color: #052033;
          box-shadow: 0 28px 68px rgba(42, 82, 160, 0.18);
          border: 1px solid rgba(209, 223, 255, 0.78);
          position: relative;
          overflow: hidden;
        }

        .domain-match-content {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .welcome-header h1 {
          margin: 0;
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 800;
          font-family: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
        }

        .domain-match-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .domain-match-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .domain-match-error {
          margin: 0;
          font-size: 13px;
          color: #dc2626;
        }

        .domain-match-request-feedback {
          margin: 0;
          padding: 10px 14px;
          font-size: 13px;
          border-radius: 16px;
          background: rgba(37, 99, 235, 0.12);
          color: #0f172a;
        }

        .domain-match-list__button {
          width: 100%;
        }

        .domain-match-ghost {
          background: rgba(37, 99, 235, 0.08);
          color: #2563eb;
          border: 1px solid rgba(37, 99, 235, 0.3);
        }

        .auth-button {
          border-radius: 24px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          padding: 12px 18px;
          font-size: 15px;
        }

        .auth-button--primary {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
        }

        .auth-button:disabled {
          cursor: default;
          opacity: 0.65;
          box-shadow: none;
        }

        .auth-button:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .domain-match-ghost:not(:disabled):hover {
          transform: translateY(-1px);
        }
      `}</style>
    </main>
  );
}
