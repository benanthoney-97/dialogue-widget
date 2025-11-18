import { Suspense } from "react";
import DomainMatchPromptClient from "./DomainMatchPromptClient";

const SUSPENSE_FALLBACK = <div className="auth-page domain-match-page">Loading domain match…</div>;

export default function DomainMatchPromptPage() {
  return (
    <Suspense fallback={SUSPENSE_FALLBACK}>
      <DomainMatchPromptClient />
    </Suspense>
  );
}
