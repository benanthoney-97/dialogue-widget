"use client";

import React, { FormEvent, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "../Sidebar";
import { supabase } from "@/app/lib/supabaseClient";

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

type StagePanelProps = {
  heading?: string;
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
            {heading ? <h2>{heading}</h2> : null}
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
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      joinedAt: string;
    }>
  >([]);
  const [pendingInvites, setPendingInvites] = useState<
    Array<{
      id: string;
      email: string;
      role: string;
      invitedAt: string;
      expiresAt: string;
      status: string;
    }>
  >([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [roleEditTarget, setRoleEditTarget] = useState<{ id: string; role: string } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const roleSelectRef = useRef<HTMLSelectElement | null>(null);
  const totalActive = members.length;
  const totalPending = pendingInvites.filter((invite) => invite.status === "pending").length;
  const totalAdmins = members.filter((member) => member.role === "admin").length;
  const showRoleSelect = inviteEmail.trim().length > 0;
  const roleOptions = ["admin", "owner", "viewer"] as const;

  const formatDate = useCallback((value: string | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  const formatExpiry = useCallback((value: string | null | undefined) => {
    if (!value) return "No expiry";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No expiry";
    return `Expires ${date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    })}`;
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfileRole() {
      if (!clientSlug) {
        if (!isMounted) return;
        setProfileRole(null);
        setProfileLoadError("Workspace not found");
        setProfileReady(true);
        return;
      }
      if (isMounted) {
        setProfileReady(false);
        setProfileLoadError(null);
      }
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (userError) {
          setProfileRole(null);
          setProfileLoadError(userError.message ?? "Unable to load session");
          setCurrentUserId(null);
          return;
        }
        const user = userData?.user;
        if (!user) {
          setProfileRole(null);
          setProfileLoadError("You must be signed in");
          setCurrentUserId(null);
          return;
        }
        setCurrentUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!isMounted) return;
        if (profileError || !profile) {
          setProfileRole(null);
          setProfileLoadError(profileError?.message ?? "Profile not found");
          setCurrentUserId(user.id ?? null);
          return;
        }
        if (profile.client_id !== clientSlug) {
          setProfileRole(null);
          setProfileLoadError("This workspace is unavailable");
          setCurrentUserId(user.id ?? null);
          return;
        }
        setProfileLoadError(null);
        setProfileRole(typeof profile.role === "string" ? profile.role : null);
      } catch (error) {
        if (!isMounted) return;
        setProfileRole(null);
        setProfileLoadError(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        if (isMounted) {
          setProfileReady(true);
        }
      }
    }

    void fetchProfileRole();

    return () => {
      isMounted = false;
    };
  }, [clientSlug]);

  useEffect(() => {
    let isMounted = true;
    async function fetchTeam() {
      if (!profileReady) {
        return;
      }
      if (profileLoadError) {
        if (!isMounted) return;
        setLoadingTeam(false);
        setTeamError(null);
        setMembers([]);
        setPendingInvites([]);
        setWorkspaceName(null);
        return;
      }
      if (!clientSlug) {
        if (isMounted) {
          setTeamError("Workspace not found");
          setMembers([]);
          setPendingInvites([]);
          setWorkspaceName(null);
        }
        return;
      }
      if (isMounted) {
        setLoadingTeam(true);
        setTeamError(null);
      }
      try {
        const { data: clientRows, error: clientError } = await supabase
          .from("clients")
          .select("id, display_name, name")
          .eq("id", clientSlug)
          .limit(1);
        if (!isMounted) return;
        let clientRecord = (clientRows?.[0] as { id: string; display_name: string | null; name: string | null } | undefined) ?? null;
        if (clientError) {
          console.error("[Teams] Unable to load workspace record", clientError);
        }
        if (!clientRecord) {
          const { data: clientByNameRows, error: clientByNameError } = await supabase
              .from("clients")
              .select("id, display_name, name")
              .eq("name", clientSlug)
              .limit(1);
          if (!isMounted) return;
          if (clientByNameError) {
            console.error("[Teams] Unable to load workspace by name", clientByNameError);
          }
          clientRecord =
            (clientByNameRows?.[0] as { id: string; display_name: string | null; name: string | null } | undefined) ??
            null;
          if (!clientRecord) {
            setTeamError((prev) => prev ?? "Workspace not found");
          }
        }

        const resolvedClientId = clientRecord?.id ?? clientSlug;
        setWorkspaceName(clientRecord?.display_name ?? clientRecord?.name ?? null);

        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, created_at")
          .eq("client_id", resolvedClientId)
          .order("created_at", { ascending: true });

        if (!isMounted) return;
        if (profileError) {
          setTeamError("Unable to load team members");
          setMembers([]);
        } else {
          const formattedMembers = (profileRows ?? []).map((row) => {
            const name = row.display_name?.trim() || row.email?.trim() || "Member";
            return {
              id: row.id,
              name,
              email: row.email ?? "",
              role: row.role ?? "viewer",
              status: "Active",
              joinedAt: formatDate(row.created_at) || "",
            };
          });
          setMembers(formattedMembers);
          if (!clientRecord && formattedMembers.length > 0) {
            setWorkspaceName(formattedMembers[0].name ? `${formattedMembers[0].name}'s workspace` : null);
          }
        }

        const { data: inviteRows, error: inviteError } = await supabase
          .from("team_invites")
          .select("id, email, role, status, created_at, expires_at")
          .eq("client_id", resolvedClientId)
          .order("created_at", { ascending: false });

        if (!isMounted) return;
        if (inviteError) {
          setPendingInvites([]);
          if (!teamError) {
            setTeamError("Unable to load invitations");
          }
        } else {
          const formattedInvites = (inviteRows ?? [])
            .filter((invite) => (invite.status ?? "pending") !== "accepted")
            .map((invite) => ({
              id: invite.id,
              email: invite.email,
              role: invite.role,
              status: invite.status ?? "pending",
              invitedAt: formatDate(invite.created_at) || "",
              expiresAt: formatExpiry(invite.expires_at ?? null),
            }));
          setPendingInvites(formattedInvites);
        }
      } catch (error) {
        if (!isMounted) return;
        setTeamError("Failed to load workspace data");
        console.error("[Teams] Failed to load team data", error);
        setMembers([]);
        setPendingInvites([]);
      } finally {
        if (isMounted) {
          setLoadingTeam(false);
        }
      }
    }

    void fetchTeam();

    return () => {
      isMounted = false;
    };
  }, [clientSlug, refreshToken, formatDate, formatExpiry, profileReady, profileRole, profileLoadError]);
  const canManageTeam = profileReady && !profileLoadError && profileRole !== "viewer";
  const canInviteMembers = canManageTeam && profileRole === "admin";
  const handleRequestRemoveMember = useCallback(
    (member: { id: string; name: string; email: string }) => {
      if (!canManageTeam) return;
      const isOnlyMember = members.length <= 1 && currentUserId && member.id === currentUserId;
      if (isOnlyMember) {
        setMemberActionError(
          "You are the only member of this workspace. Delete your account to close the workspace instead."
        );
        setMemberPendingRemoval(null);
        return;
      }
      setMemberActionError(null);
      setMemberPendingRemoval(member);
    },
    [canManageTeam, members.length, currentUserId],
  );

  const handleCancelRemoveMember = useCallback(() => {
    if (isRemovingMember) return;
    setMemberPendingRemoval(null);
    setMemberActionError(null);
    setRoleEditTarget(null);
    roleSelectRef.current = null;
  }, [isRemovingMember]);

  const handleConfirmRemoveMember = useCallback(async () => {
    if (!memberPendingRemoval) return;
    setIsRemovingMember(true);
    setMemberActionError(null);
    try {
      if (members.length <= 1 && (!currentUserId || memberPendingRemoval.id === currentUserId)) {
        setMemberActionError(
          "You are the only member of this workspace. Delete your account to close the workspace instead."
        );
        setIsRemovingMember(false);
        return;
      }
      const adminMembers = members.filter((member) => member.role === "admin");
      const isRemovingOnlyAdmin =
        adminMembers.length === 1 && adminMembers[0]?.id === memberPendingRemoval.id;
      if (isRemovingOnlyAdmin) {
        setMemberActionError("Each workspace must always have at least one admin.");
        setIsRemovingMember(false);
        return;
      }
      const { error } = await supabase.from("profiles").delete().eq("id", memberPendingRemoval.id);
      if (error) throw error;
      setMembers((existing) => existing.filter((member) => member.id !== memberPendingRemoval.id));
      setMemberPendingRemoval(null);
      setRefreshToken((token) => token + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to remove team member. Please try again.";
      setMemberActionError(message);
    } finally {
      setIsRemovingMember(false);
    }
  }, [memberPendingRemoval, members]);

  const handleStartEditRole = useCallback(
    (member: { id: string; role: string }) => {
      if (!canManageTeam || isUpdatingRole) return;
      setMemberActionError(null);
      setRoleEditTarget({ id: member.id, role: member.role });
      roleSelectRef.current = null;
    },
    [canManageTeam, isUpdatingRole],
  );

  const handleRoleSelectChange = useCallback(
    async (memberId: string, nextRole: string) => {
      if (!canManageTeam) return;
      const currentRole =
        members.find((member) => member.id === memberId)?.role ??
        (roleEditTarget?.id === memberId ? roleEditTarget.role : "viewer");
      if (profileRole !== "admin" && nextRole === "admin" && currentRole !== "admin") {
        setMemberActionError("Only admins can assign the admin role.");
        setRoleEditTarget({ id: memberId, role: currentRole });
        return;
      }
      const adminMembers = members.filter((member) => member.role === "admin");
      const currentIsAdmin = currentRole === "admin";
      const isDemotingSoleAdmin =
        currentIsAdmin &&
        adminMembers.length === 1 &&
        adminMembers[0]?.id === memberId &&
        nextRole !== "admin";
      if (isDemotingSoleAdmin) {
        setMemberActionError("You need at least one admin in this workspace.");
        setRoleEditTarget({ id: memberId, role: currentRole });
        return;
      }
      setRoleEditTarget({ id: memberId, role: nextRole });
      setIsUpdatingRole(true);
      setMemberActionError(null);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ role: nextRole })
          .eq("id", memberId);
        if (error) throw error;
        setMembers((existing) =>
          existing.map((member) =>
            member.id === memberId ? { ...member, role: nextRole } : member,
          ),
        );
        setRoleEditTarget(null);
        roleSelectRef.current = null;
        setRefreshToken((token) => token + 1);
      } catch (error) {
        const fallbackRole =
          members.find((member) => member.id === memberId)?.role ??
          (roleEditTarget?.id === memberId ? roleEditTarget.role : "viewer");
        setRoleEditTarget({ id: memberId, role: fallbackRole });
        const message =
          error instanceof Error ? error.message : "Unable to update role. Please try again.";
        setMemberActionError(message);
      } finally {
        setIsUpdatingRole(false);
      }
    },
    [canManageTeam, members, roleEditTarget, profileRole],
  );

  useEffect(() => {
    if (!roleEditTarget || !canManageTeam) return;
    const select = roleSelectRef.current;
    if (!select) return;
    const openPicker = () => {
      select.focus({ preventScroll: true });
      if (typeof select.showPicker === "function") {
        try {
          select.showPicker();
          return;
        } catch {
          // ignore failures, fall back below
        }
      }
      // Fallback: trigger a mousedown to hint the dropdown should open.
      const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      select.dispatchEvent(event);
    };
    const frame = requestAnimationFrame(openPicker);
    return () => cancelAnimationFrame(frame);
  }, [roleEditTarget, canManageTeam]);

  useEffect(() => {
    if (!memberPendingRemoval) return;
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelRemoveMember();
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [memberPendingRemoval, handleCancelRemoveMember]);

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!canInviteMembers) {
      setInviteFeedback({ type: "error", message: "Only admins can invite new team members." });
      return;
    }
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
      setRefreshToken((token) => token + 1);
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
          <StagePanel>
            {!profileReady ? (
              <div className="teams-feedback teams-feedback--info" role="status">
                Checking your permissions…
              </div>
            ) : profileLoadError ? (
              <div className="teams-feedback teams-feedback--error" role="alert">
                {profileLoadError}
              </div>
            ) : (
              <>
                {!canManageTeam ? (
                  <div className="teams-feedback teams-feedback--info" role="status">
                    Ask an admin if you need access to manage team members.
                  </div>
                ) : null}
                {canManageTeam && !canInviteMembers ? (
                  <div className="teams-feedback teams-feedback--info" role="status">
                    Only admins can invite new team members.
                  </div>
                ) : null}
                <header className="teams-table__header teams-table__header--summary">
                  <div>
                    <h3>Team members{workspaceName ? ` · ${workspaceName}` : ""}</h3>
                    <p>
                      {loadingTeam ? "Loading team…" : `${totalActive} active · ${totalPending} pending`}
                    </p>
                  </div>
                </header>
                {canInviteMembers ? (
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
                ) : null}

                <div className="teams-table">
                  {canManageTeam && inviteFeedback ? (
                    <div
                      className={`teams-feedback teams-feedback--${inviteFeedback.type}`}
                      role="status"
                    >
                      {inviteFeedback.message}
                    </div>
                  ) : null}
                  {teamError ? (
                    <div className="teams-feedback teams-feedback--error" role="alert">
                      {teamError}
                    </div>
                  ) : null}
                  {memberActionError && !memberPendingRemoval ? (
                    <div className="teams-feedback teams-feedback--error" role="alert">
                      {memberActionError}
                    </div>
                  ) : null}
                  <div
                    className={`teams-table__grid${canManageTeam ? "" : " teams-table__grid--readonly"}`}
                    role="table"
                    aria-label="Team members"
                  >
                    <div className="teams-table__row teams-table__row--head" role="row">
                      <div role="columnheader">Member</div>
                      <div role="columnheader">Role</div>
                      <div role="columnheader">Status</div>
                      <div role="columnheader">Joined</div>
                      {canManageTeam ? (
                        <div role="columnheader" aria-label="Actions" />
                      ) : (
                        <div role="columnheader" aria-hidden="true" />
                      )}
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
                        <div role="cell" data-label="Role" className="teams-role-cell">
                          {(() => {
                            const isSoleAdminRow = totalAdmins === 1 && member.role === "admin";
                            const isEditingRole = canManageTeam && roleEditTarget?.id === member.id;
                            if (isEditingRole) {
                              return (
                                <select
                                  className="teams-role-select"
                                  value={roleEditTarget.role}
                                  onChange={(event) => handleRoleSelectChange(member.id, event.target.value)}
                                  onBlur={() => {
                                    if (!isUpdatingRole) {
                                      setRoleEditTarget(null);
                                      roleSelectRef.current = null;
                                    }
                                  }}
                                  disabled={isUpdatingRole}
                                  ref={roleSelectRef}
                                >
                                  {roleOptions.map((option) => {
                                    const disableNonAdminPromotion =
                                      profileRole !== "admin" &&
                                      option === "admin" &&
                                      roleEditTarget?.role !== "admin";
                                    const disableSoleAdminDemotion =
                                      isSoleAdminRow && option !== "admin";
                                    const disableOption = disableNonAdminPromotion || disableSoleAdminDemotion;
                                    return (
                                      <option key={option} value={option} disabled={disableOption}>
                                        {option.charAt(0).toUpperCase() + option.slice(1)}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            }
                            return (
                              <button
                                type="button"
                                className={`teams-role-chip teams-badge teams-badge--${member.role}${canManageTeam ? " teams-role-chip--editable" : ""}`}
                                onClick={canManageTeam ? () => handleStartEditRole(member) : undefined}
                                disabled={!canManageTeam || isUpdatingRole}
                                aria-disabled={!canManageTeam || isUpdatingRole}
                              >
                                <span className="teams-role-chip__label">
                                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                </span>
                                {canManageTeam ? (
                                  <span className="teams-role-chip__icon" aria-hidden="true">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                ) : null}
                              </button>
                            );
                          })()}
                        </div>
                        <div role="cell" data-label="Status">
                          <span className="teams-status teams-status--active">{member.status}</span>
                        </div>
                        <div role="cell" data-label="Joined">{member.joinedAt}</div>
                        {canManageTeam ? (
                          <div role="cell" data-label="Actions">
                            <button
                              type="button"
                              className="teams-action"
                              aria-label={`Remove ${member.name}`}
                              onClick={() => handleRequestRemoveMember(member)}
                              disabled={isRemovingMember && memberPendingRemoval?.id === member.id}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M2.5 4.5h11"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M6 2.5h4"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M12.5 4.5 11.9 13a1.2 1.2 0 0 1-1.2 1.1H5.3A1.2 1.2 0 0 1 4.1 13L3.5 4.5"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M6.75 7v4.2"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M9.25 7v4.2"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div role="cell" data-label="Actions" aria-hidden="true" />
                        )}
                      </div>
                    ))}

                    {canManageTeam && pendingInvites.length > 0 ? (
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
                              <span className={`teams-status teams-status--${invite.status === "pending" ? "pending" : "active"}`}>
                                {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                              </span>
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

                {canManageTeam && memberPendingRemoval ? (
                  <div
                    className="teams-dialog-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="teams-remove-dialog-title"
                    onClick={handleCancelRemoveMember}
                  >
                    <div
                      className="teams-dialog"
                      role="document"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <h4 id="teams-remove-dialog-title">Remove team member?</h4>
                      <p>
                        Are you sure you want to remove{" "}
                        <strong>{memberPendingRemoval.name || "this member"}</strong> (
                        {memberPendingRemoval.email}) from the team?<br />
                        This action cannot be undone.
                      </p>
                      {memberActionError ? (
                        <div className="teams-dialog__feedback">{memberActionError}</div>
                      ) : null}
                      <div className="teams-dialog__actions">
                        <button
                          type="button"
                          className="teams-dialog__button teams-dialog__button--secondary"
                          onClick={handleCancelRemoveMember}
                          disabled={isRemovingMember}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="teams-dialog__button teams-dialog__button--danger"
                          onClick={handleConfirmRemoveMember}
                          disabled={isRemovingMember}
                        >
                          {isRemovingMember ? "Removing…" : "Remove member"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
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
          width: var(--sidebar-width);
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
        .teams-feedback--info {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
          border: 1px solid rgba(59, 130, 246, 0.28);
        }
        .teams-table__header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          text-align: center;
        }
        .teams-table__header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.6);
          text-align: center;
        }
        .teams-table__header--summary {
          padding: 0 4px;
          margin-bottom: 4px;
          display: flex;
          justify-content: center;
        }
        .teams-table__grid {
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(15, 23, 42, 0.1);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(248, 250, 252, 0.92);
        }
        .teams-table__grid--readonly .teams-table__row,
        .teams-table__grid--readonly .teams-table__row--head {
          grid-template-columns: minmax(240px, 2fr) 120px 120px 120px;
        }
        .teams-table__grid--readonly .teams-table__row > [data-label="Actions"],
        .teams-table__grid--readonly .teams-table__row--head > div:last-child {
          display: none;
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
        .teams-dialog-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px;
          z-index: 200;
        }
        .teams-dialog {
          background: #0f172a;
          color: #f8fafc;
          border-radius: 18px;
          padding: 28px;
          width: min(420px, 90%);
          box-shadow: 0 28px 64px rgba(15, 23, 42, 0.45);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .teams-dialog h4 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        .teams-dialog p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(226, 232, 240, 0.9);
        }
        .teams-dialog__feedback {
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fecaca;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .teams-dialog__actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .teams-dialog__button {
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
        }
        .teams-dialog__button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .teams-dialog__button--secondary {
          background: rgba(148, 163, 184, 0.16);
          color: #e2e8f0;
          border: 1px solid rgba(148, 163, 184, 0.32);
        }
        .teams-dialog__button--secondary:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 26px rgba(148, 163, 184, 0.26);
        }
        .teams-dialog__button--danger {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: #fef2f2;
          box-shadow: 0 18px 36px rgba(220, 38, 38, 0.28);
        }
        .teams-dialog__button--danger:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 24px 48px rgba(220, 38, 38, 0.36);
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
        .teams-role-cell {
          display: flex;
          align-items: center;
          min-height: 32px;
        }
        .teams-role-chip {
          border: none;
          padding: 6px 12px;
          cursor: pointer;
          font: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .teams-role-chip:focus-visible {
          outline: 2px solid rgba(59, 130, 246, 0.45);
          outline-offset: 2px;
        }
        .teams-role-chip:disabled {
          cursor: default;
          opacity: 0.6;
        }
        .teams-role-chip--editable {
          gap: 6px;
          padding: 6px 14px;
        }
        .teams-role-chip__label {
          display: inline-flex;
          align-items: center;
        }
        .teams-role-chip__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: currentColor;
          opacity: 0.8;
          transition: transform 0.2s ease;
        }
        .teams-role-chip--editable:not(:disabled):hover .teams-role-chip__icon {
          transform: translateY(1px);
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
        .teams-role-select {
          padding: 8px 36px 8px 14px;
          border-radius: 14px;
          border: 2px solid rgba(59, 130, 246, 0.32);
          background: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          min-width: 170px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
            linear-gradient(135deg, currentColor 50%, transparent 50%);
          background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
        }
        .teams-role-select:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 14px 32px rgba(59, 130, 246, 0.24);
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
