"use client";

import React, { useEffect, useMemo, useState } from "react";
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
      {hasHeader ? (
        <header className="stage-panel__header">
          {leading ? <div className="stage-panel__leading">{leading}</div> : null}
          <div className="stage-panel__titles">
            {heading ? <h2>{heading}</h2> : null}
            {subheading ? <p>{subheading}</p> : null}
          </div>
          {trailing ? <div className="stage-panel__trailing">{trailing}</div> : null}
        </header>
      ) : null}
      <div className="stage-panel__body">{children}</div>
      {footer ? <footer className="stage-panel__footer">{footer}</footer> : null}
    </section>
  );
}

type ProfileRow = {
  id: string;
  email?: string | null;
  role?: string | null;
  display_name?: string | null;
  default_agent_id?: string | null;
  client_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  raw_user_meta_data?: unknown;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SettingsPage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<"personal" | "workspace" | "auth">(
    "personal"
  );
  const [editingDisplayName, setEditingDisplayName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalSaveError, setPersonalSaveError] = useState<string | null>(null);
  const [personalSaveSuccess, setPersonalSaveSuccess] = useState<string | null>(null);

  const parsedMetadata = useMemo(() => {
    if (!profile?.raw_user_meta_data) return null;
    if (typeof profile.raw_user_meta_data === "object" && profile.raw_user_meta_data !== null) {
      return profile.raw_user_meta_data as Record<string, unknown>;
    }
    if (typeof profile.raw_user_meta_data === "string" && profile.raw_user_meta_data.trim().length > 0) {
      try {
        return JSON.parse(profile.raw_user_meta_data) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }, [profile]);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      if (!clientSlug) {
        setError("Workspace not found");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setProfile(null);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (userError || !userData?.user) {
          setError(userError?.message ?? "You must be signed in to view settings.");
          setProfile(null);
          setLoading(false);
          return;
        }
        const user = userData.user;
        const fallbackEmail =
          typeof user.email === "string"
            ? user.email
            : typeof user.user_metadata?.email === "string"
              ? user.user_metadata.email
              : null;
        setAuthEmail(fallbackEmail);

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("id, email, role, display_name, default_agent_id, client_id, created_at, updated_at, raw_user_meta_data")
          .eq("id", user.id)
          .maybeSingle<ProfileRow>();

        if (!isMounted) return;

        if (profileError || !profileRow) {
          setError(profileError?.message ?? "Unable to load your profile.");
          setProfile(null);
          setLoading(false);
          return;
        }

        if (profileRow.client_id && profileRow.client_id !== clientSlug) {
          setError("This workspace is not available for your account.");
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile({
          ...profileRow,
          email: profileRow.email ?? fallbackEmail,
        });
        setLoading(false);
      } catch (thrown) {
        if (!isMounted) return;
        const message = thrown instanceof Error ? thrown.message : "Unexpected error loading settings.";
        setError(message);
        setProfile(null);
        setLoading(false);
      }
    }

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [clientSlug]);

  useEffect(() => {
    if (!profile) {
      setEditingDisplayName("");
      setEditingEmail(authEmail ?? "");
      setPersonalSaveError(null);
      return;
    }
    setEditingDisplayName(profile.display_name ?? "");
    setEditingEmail(profile.email ?? authEmail ?? "");
    setPersonalSaveError(null);
  }, [profile, authEmail]);

  const readonlyPersonalDetails = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Account ID", value: profile.id },
      { label: "Role", value: profile.role ?? "—" },
    ];
  }, [profile]);

  const workspaceDetails = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Workspace", value: clientSlug || "—" },
      { label: "Workspace link", value: profile.client_id ?? "—" },
      { label: "Default persona", value: profile.default_agent_id ?? "Not set" },
      { label: "Profile created", value: formatDateTime(profile.created_at) },
      { label: "Last updated", value: formatDateTime(profile.updated_at) },
    ];
  }, [profile, clientSlug]);

  const avatarInitial = useMemo(() => {
    const raw =
      (editingDisplayName || editingEmail || profile?.display_name || profile?.email || authEmail || "")
        .toString()
        .trim();
    if (!raw) return "?";
    return raw.charAt(0).toUpperCase();
  }, [editingDisplayName, editingEmail, profile, authEmail]);

  const baselineDisplayName = (profile?.display_name ?? "").trim();
  const baselineEmail = (profile?.email ?? authEmail ?? "").trim();
  const trimmedDisplayName = editingDisplayName.trim();
  const trimmedEmail = editingEmail.trim();
  const hasUnsavedPersonalChanges =
    Boolean(profile) &&
    (trimmedDisplayName !== baselineDisplayName || trimmedEmail !== baselineEmail);

  const sectionConfig = useMemo(
    () => [
      { key: "personal" as const, label: "Personal" },
      { key: "workspace" as const, label: "Workspace" },
      { key: "auth" as const, label: "Authentication" },
    ],
    []
  );

  const handleSavePersonal = async () => {
    if (!profile) return;
    if (!trimmedEmail) {
      setPersonalSaveError("Email cannot be empty.");
      return;
    }
    const nextDisplayName = trimmedDisplayName.length > 0 ? trimmedDisplayName : null;
    setIsSavingPersonal(true);
    setPersonalSaveError(null);
    setPersonalSaveSuccess(null);
    try {
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: nextDisplayName,
          email: trimmedEmail,
        })
        .eq("id", profile.id)
        .select(
          "id, email, role, display_name, default_agent_id, client_id, created_at, updated_at, raw_user_meta_data"
        )
        .maybeSingle<ProfileRow>();
      if (updateError) {
        setPersonalSaveError(updateError.message ?? "Unable to save changes.");
        return;
      }
      if (!data) {
        setPersonalSaveError("Profile update returned no data.");
        return;
      }
      setProfile({
        ...data,
        email: data.email ?? trimmedEmail,
      });
      setAuthEmail((prev) => data.email ?? trimmedEmail ?? prev ?? null);
      setEditingDisplayName(data.display_name ?? "");
      setEditingEmail(data.email ?? trimmedEmail);
      setPersonalSaveSuccess("Changes saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unexpected error saving profile.";
      setPersonalSaveError(message);
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const renderPersonalSection = () => (
    <section
      key="personal"
      id="settings-section-personal"
      className="settings-card"
      role="tabpanel"
      aria-labelledby="settings-tab-personal"
    >
      <header className="settings-card__header">
        <div className="settings-card__avatar" aria-hidden="true">
          {avatarInitial}
        </div>
        <div>
          <h3>{trimmedDisplayName || "Unnamed profile"}</h3>
          <p>{trimmedEmail || authEmail || "Email unavailable"}</p>
        </div>
      </header>
      <dl className="settings-list settings-list--form">
        <div className="settings-list__row">
          <dt>
            <label htmlFor="settings-display-name">Display name</label>
          </dt>
          <dd>
            <input
              id="settings-display-name"
              type="text"
              value={editingDisplayName}
              onChange={(event) => {
                setEditingDisplayName(event.target.value);
                setPersonalSaveError(null);
                setPersonalSaveSuccess(null);
              }}
              placeholder="Enter your display name"
              autoComplete="name"
            />
          </dd>
        </div>
        <div className="settings-list__row">
          <dt>
            <label htmlFor="settings-email">Email</label>
          </dt>
          <dd>
            <input
              id="settings-email"
              type="email"
              value={editingEmail}
              onChange={(event) => {
                setEditingEmail(event.target.value);
                setPersonalSaveError(null);
                setPersonalSaveSuccess(null);
              }}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </dd>
        </div>
      </dl>
      {readonlyPersonalDetails.length > 0 ? (
        <dl className="settings-list settings-list--readonly">
          {readonlyPersonalDetails.map((item) => (
            <div key={item.label} className="settings-list__row">
              <dt>{item.label}</dt>
              <dd>{item.value || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {personalSaveError ? (
        <div className="settings-inline-message settings-inline-message--error" role="alert">
          {personalSaveError}
        </div>
      ) : null}
      {personalSaveSuccess && !hasUnsavedPersonalChanges ? (
        <div className="settings-inline-message settings-inline-message--success" role="status">
          {personalSaveSuccess}
        </div>
      ) : null}
      {hasUnsavedPersonalChanges ? (
        <div className="settings-actions">
          <button
            type="button"
            className="settings-save-button"
            onClick={handleSavePersonal}
            disabled={isSavingPersonal}
          >
            {isSavingPersonal ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : null}
    </section>
  );

  const renderWorkspaceSection = () => (
    <section
      key="workspace"
      id="settings-section-workspace"
      className="settings-card"
      role="tabpanel"
      aria-labelledby="settings-tab-workspace"
    >
      <header className="settings-card__header">
        <div className="settings-card__icon" aria-hidden="true">
          <span role="img" aria-hidden="true">
            🏢
          </span>
        </div>
        <div>
          <h3>Workspace</h3>
          <p>Membership details for this client workspace.</p>
        </div>
      </header>
      <dl className="settings-list">
        {workspaceDetails.map((item) => (
          <div key={item.label} className="settings-list__row">
            <dt>{item.label}</dt>
            <dd>{item.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const renderAuthSection = () => (
    <section
      key="auth"
      id="settings-section-auth"
      className="settings-card settings-card--metadata"
      role="tabpanel"
      aria-labelledby="settings-tab-auth"
    >
      <header className="settings-card__header">
        <div className="settings-card__icon" aria-hidden="true">
          <span role="img" aria-hidden="true">
            🔐
          </span>
        </div>
        <div>
          <h3>Authentication metadata</h3>
          <p>Snapshot from your identity provider.</p>
        </div>
      </header>
      {parsedMetadata ? (
        <ul className="settings-meta">
          {Object.entries(parsedMetadata).map(([key, value]) => (
            <li key={key}>
              <span className="settings-meta__key">{key}</span>
              <span className="settings-meta__value">
                {typeof value === "boolean"
                  ? value
                    ? "true"
                    : "false"
                  : value === null
                    ? "null"
                    : typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="settings-meta--empty">No metadata available for this account.</div>
      )}
    </section>
  );

  let sectionView: React.ReactNode = null;
  if (profile) {
    if (selectedSection === "workspace") {
      sectionView = renderWorkspaceSection();
    } else if (selectedSection === "auth") {
      sectionView = renderAuthSection();
    } else {
      sectionView = renderPersonalSection();
    }
  }

  return (
    <main className="stage-layout settings-root">
      <aside className="stage-layout__sidebar">
        <Sidebar />
      </aside>
      <div className="stage-layout__content">
        <div className="stage-shell">
          <StagePanel
            heading="Settings"
            subheading="Your account details for this workspace."
            trailing={
              <div className="settings-chips" role="tablist" aria-label="Settings sections">
                {sectionConfig.map((section) => {
                  const isActive = selectedSection === section.key;
                  return (
                    <button
                      key={section.key}
                      id={`settings-tab-${section.key}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`settings-section-${section.key}`}
                      className={`settings-chip${isActive ? " settings-chip--active" : ""}`}
                      onClick={() => setSelectedSection(section.key)}
                    >
                      {section.label}
                    </button>
                  );
                })}
              </div>
            }
          >
            {loading ? (
              <div className="settings-feedback settings-feedback--info" role="status">
                Loading your profile…
              </div>
            ) : error ? (
              <div className="settings-feedback settings-feedback--error" role="alert">
                {error}
              </div>
            ) : !profile || !sectionView ? (
              <div className="settings-feedback settings-feedback--error" role="alert">
                We could not find your profile.
              </div>
            ) : (
              <div className="settings-section-wrapper">{sectionView}</div>
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
          width: min(960px, 95%);
          display: flex;
          flex-direction: column;
          gap: 32px;
          color: var(--text, #1e293b);
        }
        .stage-panel {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(30, 41, 59, 0.12);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .stage-panel__header {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .stage-panel__leading,
        .stage-panel__trailing {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
        }
        .stage-panel__titles {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .stage-panel__titles h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
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
        .settings-chips {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }
        .settings-chip {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid rgba(59, 130, 246, 0.3);
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: background 0.2s ease, border 0.2s ease, color 0.2s ease, transform 0.2s ease;
        }
        .settings-chip:hover {
          background: rgba(59, 130, 246, 0.18);
          transform: translateY(-1px);
        }
        .settings-chip:focus-visible {
          outline: 2px solid rgba(59, 130, 246, 0.6);
          outline-offset: 2px;
        }
        .settings-chip--active {
          background: #1d4ed8;
          color: #f8fafc;
          border-color: rgba(29, 78, 216, 0.8);
          box-shadow: 0 12px 28px rgba(29, 78, 216, 0.28);
          transform: translateY(-1px);
        }
        .settings-feedback {
          padding: 18px 20px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
        }
        .settings-feedback--info {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.26);
          color: #1d4ed8;
        }
        .settings-feedback--error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #b91c1c;
        }
        .settings-section-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .settings-card {
          background: rgba(248, 250, 252, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
        }
        .settings-card__header {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .settings-card__avatar,
        .settings-card__icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(59, 130, 246, 0.14);
          color: #1d4ed8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
        }
        .settings-card__header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .settings-card__header p {
          margin: 4px 0 0;
          font-size: 13px;
          color: rgba(15, 23, 42, 0.62);
        }
        .settings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .settings-list__row {
          display: grid;
          grid-template-columns: 140px 1fr;
          align-items: baseline;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.72);
        }
        .settings-list__row dt {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: rgba(15, 23, 42, 0.58);
        }
        .settings-list__row dd {
          margin: 0;
          font-size: 14px;
          color: #0f172a;
          font-weight: 600;
        }
        .settings-list--form .settings-list__row {
          background: rgba(255, 255, 255, 0.95);
        }
        .settings-list--form .settings-list__row dd input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(59, 130, 246, 0.28);
          background: rgba(247, 250, 255, 0.92);
          color: #0f172a;
          font-size: 14px;
          font-weight: 600;
          transition: border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .settings-list--form .settings-list__row dd input:focus {
          outline: none;
          border-color: rgba(37, 99, 235, 0.6);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        .settings-list--readonly {
          margin-top: 8px;
        }
        .settings-list--readonly .settings-list__row {
          background: rgba(241, 245, 249, 0.8);
        }
        .settings-inline-message {
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }
        .settings-inline-message--error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #b91c1c;
        }
        .settings-inline-message--success {
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(22, 163, 74, 0.3);
          color: #166534;
        }
        .settings-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }
        .settings-save-button {
          padding: 10px 20px;
          border-radius: 999px;
          border: none;
          background: #1d4ed8;
          color: #f8fafc;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          box-shadow: 0 16px 32px rgba(29, 78, 216, 0.35);
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .settings-save-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #1e40af;
          box-shadow: 0 18px 36px rgba(30, 64, 175, 0.35);
        }
        .settings-save-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
          box-shadow: none;
        }
        .settings-card--metadata .settings-meta {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .settings-meta li {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          padding: 10px 12px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.18);
          border-radius: 12px;
        }
        .settings-meta__key {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(15, 23, 42, 0.58);
        }
        .settings-meta__value {
          font-size: 13px;
          color: #0f172a;
          word-break: break-word;
        }
        .settings-meta--empty {
          padding: 16px 18px;
          border-radius: 12px;
          background: rgba(148, 163, 184, 0.12);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: rgba(15, 23, 42, 0.7);
          font-weight: 600;
        }
        @media (max-width: 960px) {
          .stage-layout__content {
            padding: 48px 16px 72px;
          }
          .stage-panel {
            padding: 28px 24px;
          }
          .settings-list__row {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .stage-layout {
            flex-direction: column;
          }
          .stage-layout__sidebar {
            width: 100%;
            position: sticky;
            top: 0;
            z-index: 10;
          }
          .stage-layout__content {
            padding-top: 24px;
          }
        }
      `}</style>
    </main>
  );
}
