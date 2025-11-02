"use client";

import React, { FormEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "@/app/lib/supabaseClient";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

type StagePanelProps = {
  heading: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function StagePanel({ heading, subheading, leading, trailing, footer, children }: StagePanelProps) {
  const hasHeader = Boolean(heading || subheading || leading || trailing);
  return (
    <section className="stage-panel">
      {hasHeader && (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
          <div className="stage-panel__titles">
            <h2>{heading}</h2>
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : <div className="stage-panel__spacer" aria-hidden="true" />}
        </header>
      )}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

export default function TeamsPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<
    { type: "success" | "error"; message: string }
  >();

  const members = useMemo(
    () => [
      {
        id: "m-1",
        name: "Alex Morgan",
        email: "alex.morgan@example.com",
        role: "admin",
        status: "Active",
        joinedAt: "10 Oct 2025",
      },
      {
        id: "m-2",
        name: "Priya Kapoor",
        email: "priya.kapoor@example.com",
        role: "owner",
        status: "Active",
        joinedAt: "14 Oct 2025",
      },
      {
        id: "m-3",
        name: "Javier Ruiz",
        email: "javier.ruiz@example.com",
        role: "viewer",
        status: "Active",
        joinedAt: "22 Oct 2025",
      },
    ],
    []
  );

  const pendingInvites = useMemo(
    () => [
      {
        id: "i-1",
        email: "casey.todd@example.com",
        role: "viewer",
        invitedAt: "28 Oct 2025",
        expiresAt: "Expires 11 Nov",
      },
    ],
    []
  );

  const totalActive = members.length;
  const totalPending = pendingInvites.length;
  const showRoleSelect = inviteEmail.trim().length > 0;

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsSubmittingInvite(true);
    setInviteFeedback(undefined);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setInviteFeedback({ type: "error", message: "You need to be signed in to send invites." });
        return;
      }

      console.log("Invite teammate", {
        email: inviteEmail.trim(),
        role: inviteRole,
        clientSlug,
        userId: session.user?.id,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-teammate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
          }),
        }
      );

      console.log("Invite teammate response", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        let errorMessage = "Unable to send invite. Please try again.";
        const responseText = await response.text();
        console.error("Invite teammate error response", {
          status: response.status,
          body: responseText,
        });
        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            if (typeof parsed?.error === "string") {
              errorMessage = parsed.error;
            } else {
              errorMessage = responseText;
            }
          } catch {
            errorMessage = responseText;
          }
        }
        setInviteFeedback({
          type: "error",
          message: errorMessage,
        });
        return;
      }

      setInviteFeedback({ type: "success", message: "Invite sent." });
      setInviteEmail("");
      setInviteRole("viewer");
      console.log("Invite teammate success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send invite. Please try again.";
      setInviteFeedback({ type: "error", message });
      console.error("Invite teammate exception", error);
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  return (
    <main className="stage-layout teams-root">
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div className="stage-layout__content">
        <div className="stage-shell">
          <StagePanel
            heading="Team workspace"
            subheading="Manage members, invitations, and roles for your Dialogue team."
          >
            <form className="teams-invite" onSubmit={handleInviteSubmit}>
              <div className="teams-invite__input">
                <input
                  type="email"
                  placeholder="Enter teammate email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                  autoComplete="off"
                />
                {showRoleSelect ? (
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                    className="teams-invite__role"
                    aria-label="Permission level"
                  >
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : null}
              </div>
              <button type="submit" className="teams-invite__submit" disabled={isSubmittingInvite}>
                {isSubmittingInvite ? "Sending…" : "Invite"}
              </button>
            </form>

            <div className="teams-table">
              <header className="teams-table__header">
                <div>
                  <h3>Team members</h3>
                  <p>{totalActive} active · {totalPending} pending</p>
                </div>
              </header>
              {inviteFeedback ? (
                <div
                  className={`teams-feedback teams-feedback--${inviteFeedback.type}`}
                  role="status"
                >
                  {inviteFeedback.message}
                </div>
              ) : null}
              <div className="teams-table__grid" role="table" aria-label="Team members">
                <div className="teams-table__row teams-table__row--head" role="row">
                  <div role="columnheader">Member</div>
                  <div role="columnheader">Role</div>
                  <div role="columnheader">Status</div>
                  <div role="columnheader">Joined</div>
                  <div role="columnheader" aria-label="Actions" />
                </div>
                {members.map((member) => (
                  <div key={member.id} className="teams-table__row" role="row">
                    <div role="cell" data-label="Member">
                      <div className="teams-member">
                        <div className="teams-member__avatar" aria-hidden="true">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="teams-member__details">
                          <span className="teams-member__name">{member.name}</span>
                          <span className="teams-member__email">{member.email}</span>
                        </div>
                      </div>
                    </div>
                    <div role="cell" data-label="Role">
                      <span className={`teams-badge teams-badge--${member.role}`}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </span>
                    </div>
                    <div role="cell" data-label="Status">
                      <span className="teams-status teams-status--active">{member.status}</span>
                    </div>
                    <div role="cell" data-label="Joined">{member.joinedAt}</div>
                    <div role="cell" data-label="Actions">
                      <button type="button" className="teams-action" aria-label={`Manage ${member.name}`}>
                        •••
                      </button>
                    </div>
                  </div>
                ))}

                {totalPending > 0 ? (
                  <div className="teams-table__section" role="rowgroup">
                    <div className="teams-table__section-title" role="row">
                      <div role="cell" className="teams-table__section-label">Pending invites</div>
                    </div>
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="teams-table__row teams-table__row--pending" role="row">
                        <div role="cell" data-label="Invite">
                          <div className="teams-member">
                            <div className="teams-member__avatar teams-member__avatar--pending" aria-hidden="true">@</div>
                            <div className="teams-member__details">
                              <span className="teams-member__name">{invite.email}</span>
                              <span className="teams-member__email">Sent {invite.invitedAt}</span>
                            </div>
                          </div>
                        </div>
                        <div role="cell" data-label="Role">
                          <span className={`teams-badge teams-badge--${invite.role}`}>
                            {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                          </span>
                        </div>
                        <div role="cell" data-label="Status">
                          <span className="teams-status teams-status--pending">Pending</span>
                        </div>
                        <div role="cell" data-label="Expiry">{invite.expiresAt}</div>
                        <div role="cell" data-label="Actions" className="teams-invite-actions">
                          <button type="button" className="teams-action teams-action--secondary">Resend</button>
                          <button type="button" className="teams-action teams-action--danger">Revoke</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </StagePanel>
        </div>
      </div>
      <style>{`
        .stage-layout {
          min-height: 100dvh;
          background: var(--bg, #f4f8ff);
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
          display: flex;
          flex-direction: row;
        }
        .stage-layout__sidebar {
          width: 180px;
          flex-shrink: 0;
        }
        .stage-layout__content {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 64px 24px 96px;
          min-height: 100dvh;
          overflow-y: auto;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: var(--text, #1e293b);
        }
        .stage-panel {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(30, 41, 59, 0.12);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .stage-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .stage-panel__leading,
        .stage-panel__trailing,
        .stage-panel__spacer {
          flex: 0 0 auto;
          min-width: 48px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .stage-panel__spacer {
          visibility: hidden;
        }
        .stage-panel__titles {
          flex: 1;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stage-panel__titles h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #1e293b;
        }
        .stage-panel__titles p {
          margin: 0;
          font-size: 14px;
          color: rgba(15, 23, 42, 0.7);
        }
        .stage-panel__body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .stage-panel__footer {
          margin-top: 12px;
        }
        .teams-invite {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 16px 18px;
          border-radius: 16px;
          border: 1px solid rgba(37, 99, 235, 0.16);
          background: rgba(59, 130, 246, 0.08);
        }
        .teams-invite__input {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .teams-invite__input input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(30, 64, 175, 0.22);
          background: rgba(255, 255, 255, 0.95);
          color: #0f172a;
          font-size: 14px;
          transition: border 0.18s ease, box-shadow 0.18s ease;
        }
        .teams-invite__input input:focus {
          border-color: rgba(30, 64, 175, 0.55);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
          outline: none;
        }
        .teams-invite__role {
          min-width: 140px;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid rgba(30, 64, 175, 0.22);
          background: rgba(15, 23, 42, 0.88);
          color: #f8fafc;
          font-weight: 600;
          font-size: 13px;
          transition: opacity 0.18s ease;
        }
        .teams-invite__submit {
          padding: 12px 20px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          color: #f8fafc;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 12px 28px rgba(29, 78, 216, 0.22);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }
        .teams-invite__submit:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .teams-invite__submit:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 36px rgba(29, 78, 216, 0.28);
        }
        .teams-table {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .teams-feedback {
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .teams-feedback--success {
          background: rgba(34, 197, 94, 0.16);
          color: #047857;
          border: 1px solid rgba(34, 197, 94, 0.32);
        }
        .teams-feedback--error {
          background: rgba(239, 68, 68, 0.16);
          color: #b91c1c;
          border: 1px solid rgba(239, 68, 68, 0.32);
        }
        .teams-table__header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .teams-table__header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.6);
        }
        .teams-table__grid {
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(248, 250, 252, 0.92);
        }
        .teams-table__row {
          display: grid;
          grid-template-columns: minmax(240px, 2fr) 120px 120px 120px 80px;
          gap: 12px;
          align-items: center;
          padding: 18px 20px;
          font-size: 14px;
          color: #0f172a;
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        }
        .teams-table__row:last-child {
          border-bottom: none;
        }
        .teams-table__row--head {
          background: rgba(15, 23, 42, 0.06);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.65);
        }
        .teams-table__row--pending {
          background: rgba(255, 255, 255, 0.96);
        }
        .teams-table__section {
          background: rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
        }
        .teams-table__section-title {
          display: flex;
          align-items: center;
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(15, 23, 42, 0.6);
          padding: 14px 20px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }
        .teams-table__section-label {
          width: 100%;
        }
        .teams-member {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }
        .teams-member__avatar {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.85);
          color: #f8fafc;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
        }
        .teams-member__avatar--pending {
          background: rgba(59, 130, 246, 0.2);
          color: #1d4ed8;
        }
        .teams-member__details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .teams-member__name {
          font-weight: 700;
          color: #0f172a;
        }
        .teams-member__email {
          font-size: 12px;
          color: rgba(15, 23, 42, 0.58);
        }
        .teams-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          text-transform: capitalize;
        }
        .teams-badge--admin {
          background: rgba(29, 78, 216, 0.1);
          color: #1d4ed8;
        }
        .teams-badge--owner {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }
        .teams-badge--viewer {
          background: rgba(99, 102, 241, 0.12);
          color: #4338ca;
        }
        .teams-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .teams-status--active {
          background: rgba(16, 185, 129, 0.14);
          color: #047857;
        }
        .teams-status--pending {
          background: rgba(250, 204, 21, 0.18);
          color: #92400e;
        }
        .teams-action {
          border: none;
          background: transparent;
          color: rgba(15, 23, 42, 0.6);
          font-weight: 700;
          cursor: pointer;
          padding: 6px 8px;
        }
        .teams-action:hover {
          color: rgba(15, 23, 42, 0.85);
        }
        .teams-action--secondary {
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 10px;
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.08);
          font-size: 12px;
          padding: 6px 10px;
        }
        .teams-action--danger {
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          color: #dc2626;
          background: rgba(254, 202, 202, 0.2);
          font-size: 12px;
          padding: 6px 10px;
        }
        .teams-action--secondary:hover {
          background: rgba(59, 130, 246, 0.16);
        }
        .teams-action--danger:hover {
          background: rgba(254, 202, 202, 0.32);
        }
        .teams-invite-actions {
          display: inline-flex;
          gap: 8px;
          justify-content: flex-end;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 48px 18px 72px;
          }
          .stage-panel {
            padding: 28px;
          }
          .teams-table__row {
            grid-template-columns: minmax(200px, 2fr) 100px 100px 120px 80px;
          }
        }
        @media (max-width: 680px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .stage-layout__content {
            padding: 32px 16px 56px;
          }
          .stage-panel__titles h2 {
            font-size: 20px;
          }
          .teams-invite {
            grid-template-columns: 1fr;
          }
          .teams-table__row,
          .teams-table__row--head {
            grid-template-columns: 1fr;
            gap: 16px;
            text-align: left;
          }
          .teams-table__row--head {
            display: none;
          }
          .teams-table__row {
            border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          }
          .teams-table__row > div[role="cell"] {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
          .teams-table__row > div[role="cell"]:before {
            content: attr(data-label);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(15, 23, 42, 0.55);
            margin-right: 12px;
          }
          .teams-table__row > div[role="cell"]:empty:before {
            content: none;
          }
          .teams-invite-actions {
            width: 100%;
            flex-direction: row;
          }
          .teams-invite__submit {
            width: 100%;
          }
          .teams-invite-actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
