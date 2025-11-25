"use client";

import { FormEvent, CSSProperties, useState } from "react";

type CampaignMeta = {
  name: string | null;
  description: string | null;
  objective: string | null;
  questions: string[];
};

type CallFormProps = {
  campaignLinkId: string;
  campaignId: string | null;
  campaignMeta: CampaignMeta;
  documentMarkdowns: string[];
  initialPhone?: string | null;
};

type Status = "idle" | "loading" | "success" | "error";

export default function CallForm({
  campaignLinkId,
  campaignId,
  campaignMeta,
  documentMarkdowns,
  initialPhone,
}: CallFormProps) {
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone.trim()) {
      setStatus("error");
      setMessage("Please enter your phone number.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
    const response = await fetch("/api/eleven/twilio-outbound-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim(),
        campaignLinkId,
        campaignId,
        campaignMeta,
        documentMarkdowns,
      }),
    });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error?.message ?? result?.error ?? "Failed to initiate call");
      }
      setStatus("success");
      setMessage(
        result?.message ?? "We just placed the call to the shared agent. Please wait for the pickup."
      );
    } catch (error: unknown) {
      setStatus("error");
      const message =
        error instanceof Error ? error.message : "Unable to start the call right now.";
      setMessage(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <label
        htmlFor="call-phone"
        style={{
          ...labelStyle,
          width: "100%",
          textAlign: "center",
          display: "block",
        }}
      >
        Enter your number and we&apos;ll call you
      </label>
      <input
        id="call-phone"
        name="call-phone"
        type="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="+44 7123 456789"
        required
        style={inputStyle}
      />
      <button type="submit" style={buttonStyle} disabled={status === "loading"}>
        {status === "loading" ? "Calling…" : "Call me now"}
      </button>
      {message ? (
        <p style={{ ...messageStyle, color: status === "error" ? "#b91c1c" : "#047857" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "100%",
};

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  padding: "14px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5f5",
  fontSize: 15,
};

const buttonStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  backgroundColor: "#0f172a",
  color: "#fff",
  fontSize: 15,
  cursor: "pointer",
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
};
