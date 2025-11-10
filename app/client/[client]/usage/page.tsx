"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Topbar from "../../../components/Topbar";
import Sidebar from "../Sidebar";

type StagePanelProps = {
  heading?: string;
  subheading?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
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

function formatBytesValue(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const precision = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
}

type UsageMetrics = {
  userCount: number;
  personaCount: number;
  totalBytes: number;
  totalCallSeconds: number;
  interviewCount: number;
  questionnaireCount: number;
};

type SubscriptionTier = {
  tier_code: string;
  name?: string | null;
  max_personas?: number | null;
  max_users?: number | null;
  max_minutes_per_month?: number | null;
  max_kb_bytes_per_org?: number | null;
  max_questionnaires_per_month?: number | null;
};

type SubscriptionInfo = {
  tierCode: string | null;
  tiers: SubscriptionTier[];
};

function getClientSlug(pathname: string | null): string {
  if (!pathname) return "";
  const match = pathname.match(/^\/client\/([^\/]+)/);
  return match ? match[1] : "";
}

export default function UsagePage() {
  const pathname = usePathname();
  const clientSlug = useMemo(() => getClientSlug(pathname), [pathname]);
  const [metrics, setMetrics] = useState<UsageMetrics>({
    userCount: 0,
    personaCount: 0,
    totalBytes: 0,
    totalCallSeconds: 0,
    interviewCount: 0,
    questionnaireCount: 0,
  });
  const [subscription, setSubscription] = useState<SubscriptionInfo>({ tierCode: null, tiers: [] });

  useEffect(() => {
    if (!clientSlug) return;
    let isMounted = true;
    const controller = new AbortController();

    async function fetchUsage() {
      try {
        const response = await fetch(`/api/clients/${clientSlug}/usage`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error("[Usage] Failed to load metrics", response.status, await response.text());
          return;
        }
        const payload = (await response.json()) as {
          metrics?: Partial<UsageMetrics>;
          subscription?: SubscriptionInfo;
        };
        if (!isMounted || !payload.metrics) return;
        const nextMetrics = payload.metrics;
        setMetrics((prev) => ({
          userCount: nextMetrics.userCount ?? prev.userCount,
          personaCount: nextMetrics.personaCount ?? prev.personaCount,
          totalBytes: nextMetrics.totalBytes ?? prev.totalBytes,
          totalCallSeconds: nextMetrics.totalCallSeconds ?? prev.totalCallSeconds,
          interviewCount: nextMetrics.interviewCount ?? prev.interviewCount,
          questionnaireCount: nextMetrics.questionnaireCount ?? prev.questionnaireCount,
        }));
        if (payload.subscription) {
          setSubscription({
            tierCode: payload.subscription.tierCode,
            tiers: payload.subscription.tiers ?? [],
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Usage] Unexpected error fetching metrics", error);
      }
    }

    void fetchUsage();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [clientSlug]);

  const formattedUserCount = useMemo(() => {
    return metrics.userCount.toLocaleString();
  }, [metrics.userCount]);

  const formattedTotalBytes = useMemo(() => {
    const bytes = metrics.totalBytes ?? 0;
    return formatBytesValue(bytes);
  }, [metrics.totalBytes]);

  const formattedCallDuration = useMemo(() => {
    const seconds = metrics.totalCallSeconds ?? 0;
    if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
    const durationParts: string[] = [];
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) durationParts.push(`${hours}h`);
    if (minutes > 0) durationParts.push(`${minutes}m`);
    if (remainingSeconds > 0 && hours === 0) {
      durationParts.push(`${remainingSeconds}s`);
    }

    return durationParts.join(" ") || "0s";
  }, [metrics.totalCallSeconds]);

  const activeTier = useMemo(() => {
    if (!subscription.tierCode) return null;
    return subscription.tiers.find((tier) => tier.tier_code === subscription.tierCode) ?? null;
  }, [subscription]);

  const usageProgress = useMemo(() => {
    const formatter = new Intl.NumberFormat();
    const formatCountLimit = (limit: number | null | undefined, singular: string, plural?: string) => {
      const resolvedPlural = plural ?? `${singular}s`;
      if (limit == null || limit <= 0) {
        return `Unlimited ${resolvedPlural}`;
      }
      const noun = limit === 1 ? singular : resolvedPlural;
      return `${formatter.format(limit)} ${noun}`;
    };

    const items: Array<{
      key: string;
      label: string;
      display: string;
      percent: number;
      planLimitDescription: string;
      currentValue: number;
      limitValue: number | null;
    }> = [];

    const maxUsers = activeTier?.max_users ?? null;
    if (metrics.userCount >= 0) {
      const hasLimit = maxUsers != null && maxUsers > 0;
      const display = hasLimit
        ? `${formatter.format(metrics.userCount)} / ${formatter.format(maxUsers)}`
        : formatter.format(metrics.userCount);
      const percent = hasLimit
        ? Math.min(100, (metrics.userCount / maxUsers) * 100)
        : metrics.userCount > 0 ? 100 : 0;
      const planLimitDescription = `Plan limit: ${formatCountLimit(maxUsers, "teammate")}`;
      items.push({
        key: "users",
        label: "Teammates",
        display,
        percent,
        planLimitDescription,
        currentValue: metrics.userCount,
        limitValue: hasLimit ? maxUsers : null,
      });
    }

    const maxPersonas = activeTier?.max_personas ?? null;
    if (metrics.personaCount >= 0) {
      const hasLimit = maxPersonas != null && maxPersonas > 0;
      const display = hasLimit
        ? `${formatter.format(metrics.personaCount)} / ${formatter.format(maxPersonas)}`
        : formatter.format(metrics.personaCount);
      const percent = hasLimit
        ? Math.min(100, (metrics.personaCount / maxPersonas) * 100)
        : metrics.personaCount > 0 ? 100 : 0;
      const planLimitDescription = `Plan limit: ${formatCountLimit(maxPersonas, "persona")}`;
      items.push({
        key: "personas",
        label: "Personas",
        display,
        percent,
        planLimitDescription,
        currentValue: metrics.personaCount,
        limitValue: hasLimit ? maxPersonas : null,
      });
    }

    const maxBytesKb = activeTier?.max_kb_bytes_per_org ?? null;
    const limitBytes = maxBytesKb != null ? maxBytesKb * 1024 : null;
    const hasDataLimit = limitBytes != null && limitBytes > 0;
    const bytesDisplay = hasDataLimit
      ? `${formatBytesValue(metrics.totalBytes)} / ${formatBytesValue(limitBytes)}`
      : formatBytesValue(metrics.totalBytes);
    const bytesPercent = hasDataLimit
      ? Math.min(100, (metrics.totalBytes / limitBytes) * 100)
      : metrics.totalBytes > 0 ? 100 : 0;
    const bytesPlanLimitDescription = hasDataLimit
      ? `Plan limit: ${formatBytesValue(limitBytes)}`
      : "Plan limit: Unlimited data";
    items.push({
      key: "data",
      label: "Data Limit",
      display: bytesDisplay,
      percent: bytesPercent,
      planLimitDescription: bytesPlanLimitDescription,
      currentValue: metrics.totalBytes,
      limitValue: hasDataLimit ? limitBytes : null,
    });

    const maxMinutes = activeTier?.max_minutes_per_month ?? null;
    const usedMinutes = metrics.totalCallSeconds > 0 ? Math.round(metrics.totalCallSeconds / 60) : 0;
    const hasMinuteLimit = maxMinutes != null && maxMinutes > 0;
    const minutesDisplay = hasMinuteLimit
      ? `${formatter.format(usedMinutes)} min / ${formatter.format(maxMinutes)} min`
      : `${formatter.format(usedMinutes)} min`;
    const minutesPercent = hasMinuteLimit
      ? Math.min(100, (usedMinutes / maxMinutes) * 100)
      : usedMinutes > 0 ? 100 : 0;
    const minutesPlanLimitDescription = `Plan limit: ${formatCountLimit(maxMinutes, "minute")}`;
    items.push({
      key: "minutes",
      label: "Minute Limit",
      display: minutesDisplay,
      percent: minutesPercent,
      planLimitDescription: minutesPlanLimitDescription,
      currentValue: usedMinutes,
      limitValue: hasMinuteLimit ? maxMinutes : null,
    });

    const maxQuestionnaires = activeTier?.max_questionnaires_per_month ?? null;
    const hasQuestionnaireLimit = maxQuestionnaires != null && maxQuestionnaires > 0;
    const questionnairesDisplay = hasQuestionnaireLimit
      ? `${formatter.format(metrics.questionnaireCount)} / ${formatter.format(maxQuestionnaires)}`
      : formatter.format(metrics.questionnaireCount);
    const questionnairesPercent = hasQuestionnaireLimit
      ? Math.min(100, (metrics.questionnaireCount / maxQuestionnaires) * 100)
      : metrics.questionnaireCount > 0 ? 100 : 0;
    const questionnairesPlanLimitDescription = `Plan limit: ${formatCountLimit(maxQuestionnaires, "questionnaire")}`;
    items.push({
      key: "questionnaires",
      label: "Questionnaire Limit",
      display: questionnairesDisplay,
      percent: questionnairesPercent,
      planLimitDescription: questionnairesPlanLimitDescription,
      currentValue: metrics.questionnaireCount,
      limitValue: hasQuestionnaireLimit ? maxQuestionnaires : null,
    });

    return items;
  }, [activeTier, metrics.personaCount, metrics.questionnaireCount, metrics.totalBytes, metrics.totalCallSeconds, metrics.userCount]);

  const planLabel = useMemo(() => {
    if (subscription.tierCode) {
      return subscription.tierCode.toUpperCase();
    }
    return "CURRENT";
  }, [subscription.tierCode]);

  return (
    <div
      className="usage-stage"
      style={{ "--stage-topbar-offset": "var(--sidebar-width)" } as React.CSSProperties}
    >
      <Topbar
        title="Usage"
        offsetLeft="var(--stage-topbar-offset, 0px)"
        hideCadenceControls
      />
      <main className="stage-layout usage-root">
        <aside className="stage-layout__sidebar">
          <Sidebar />
        </aside>
        <div className="stage-layout__content">
          <div className="stage-shell">
            <StagePanel>
              <div className="usage-metrics-row">
                <div className="usage-metrics-card">
                  <span className="usage-metrics-card__value">{formattedUserCount}</span>
                  <span className="usage-metrics-card__label">Team Member(s)</span>
                </div>
                <div className="usage-metrics-card">
                  <span className="usage-metrics-card__value">{formattedTotalBytes}</span>
                  <span className="usage-metrics-card__label">Persona Knowledge Size</span>
                </div>
                <div className="usage-metrics-card">
                  <span className="usage-metrics-card__value">{metrics.interviewCount.toLocaleString()}</span>
                  <span className="usage-metrics-card__label">Interviews This Month</span>
                </div>
                <div className="usage-metrics-card">
                  <span className="usage-metrics-card__value">{formattedCallDuration}</span>
                  <span className="usage-metrics-card__label">Speaking with Personas</span>
                </div>
              </div>
              <p className="usage-plan-label">You are on the {planLabel} plan.</p>
              <div className="usage-progress-grid">
                {usageProgress.map((item) => (
                  <div className="usage-progress" key={item.key}>
                    <div className="usage-progress__header">
                      <span className="usage-progress__label">{item.label}</span>
                      <span className="usage-progress__value">{item.display}</span>
                    </div>
                    <div
                      className="usage-progress__bar"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={item.limitValue ?? undefined}
                      aria-valuenow={item.limitValue != null ? Math.min(item.currentValue, item.limitValue) : item.currentValue}
                      aria-valuetext={item.display}
                    >
                      <div className="usage-progress__bar-fill" style={{ width: `${item.percent}%` }} />
                    </div>
                    <div className="usage-progress__plan-limit">{item.planLimitDescription}</div>
                  </div>
                ))}
              </div>
              {/* Usage content will go here */}
            </StagePanel>
          </div>
        </div>
      </main>
      <style>{`
        .stage-layout {
          background: var(--bg, #f4f8ff);
          display: flex;
          height: 100vh;
          font-family: 'CooperBT', Cooper, 'Cooper Light BT', serif;
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
          padding: 64px 24px 86px;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .stage-shell {
          width: min(1120px, 96%);
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-height: 0;
        }
        .stage-panel {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(30, 41, 59, 0.12);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 24px 60px rgba(10, 22, 40, 0.12);
          display: flex;
          flex-direction: column;
          gap: 24px;
          color: #1e293b;
        }
        .stage-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
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
          font-size: 22px;
          font-weight: 800;
          color: #1e293b;
        }
        .stage-panel__titles p {
          margin: 0;
          font-size: 14px;
          color: rgba(30, 41, 59, 0.68);
        }
        .stage-panel__body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .usage-metrics-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .usage-metrics-card {
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .usage-metrics-card__value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #1e293b;
          text-align: center;
        }
        .usage-metrics-card__label {
          display: block;
          font-size: 13px;
          color: rgba(30, 41, 59, 0.72);
          text-align: center;
        }
        .usage-plan-label {
          margin: 8px 0 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(30, 41, 59, 0.78);
        }
        .usage-progress-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .usage-progress {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .usage-progress__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }
        .usage-progress__value {
          font-size: 13px;
          font-weight: 500;
          color: rgba(30, 41, 59, 0.7);
        }
        .usage-progress__bar {
          position: relative;
          height: 12px;
          border-radius: 999px;
          background: rgba(226, 232, 240, 0.8);
          overflow: hidden;
        }
        .usage-progress__bar-fill {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          background: linear-gradient(90deg, rgba(43,108,176,0.85), rgba(59,130,246,0.95));
          border-radius: inherit;
          transition: width 0.3s ease;
        }
        .usage-progress__plan-limit {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(30, 41, 59, 0.56);
        }
      `}</style>
    </div>
  );
}
