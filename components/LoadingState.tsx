import React from "react";

type LoadingStateProps = {
  /** Custom message to show (overrides `page`) */
  message?: string;
  /** Page key to choose a contextual default message (e.g. 'upload', 'campaigns') */
  page?: string;
  /** Visual size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const DEFAULT_MESSAGES: Record<string, string> = {
  upload: "Uploading documents...",
  "new-campaign": "Preparing upload...",
  campaigns: "Loading campaign results...",
  personas: "Loading personas...",
  default: "Loading...",
};

function resolveMessage(page?: string, message?: string) {
  if (typeof message === "string" && message.length > 0) return message;
  if (page && DEFAULT_MESSAGES[page]) return DEFAULT_MESSAGES[page];
  return DEFAULT_MESSAGES.default;
}

export default function LoadingState({ message, page, size = "md", className = "" }: LoadingStateProps) {
  const label = resolveMessage(page, message);
  const dims = size === "sm" ? 18 : size === "lg" ? 36 : 24;

  // The outer container covers available space and provides a positioning context.
  // The inner panel is absolutely centered so the spinner appears in the same spot
  // (middle of the main content panel) regardless of page layout.
  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={{ position: "relative", width: "100%", minHeight: 200 }}
    >
      <div
        aria-hidden={false}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={dims}
          height={dims}
          viewBox="0 0 50 50"
          aria-hidden="true"
          style={{ flex: "0 0 auto" }}
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth="6"
          />
          <path
            d="M45 25a20 20 0 0 1-20 20"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 25 25"
              to="360 25 25"
              dur="1s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
        <span style={{ fontSize: size === "sm" ? 13 : 15 }}>{label}</span>
      </div>
    </div>
  );
}
