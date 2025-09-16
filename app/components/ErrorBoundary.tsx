"use client";

import React from "react";

type BoundaryProps = {
  onError?: (error: unknown, info: { componentStack?: string }) => void;
  children: React.ReactNode;
};

type BoundaryState = {
  hasError: boolean;
  message?: string;
};

export default class ErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown) {
    const msg =
      typeof err === "object" && err && "message" in err
        ? String((err as any).message)
        : String(err);
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Coerce to string defensively
    const stack = typeof info?.componentStack === "string" ? info.componentStack : "";
    this.props.onError?.(error, { componentStack: stack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, background: "#fff", borderRadius: 12, color: "#b91c1c" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>A client error occurred.</div>
          <div style={{ fontSize: 12 }}>{this.state.message}</div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}