import Link from "next/link";
import { type CSSProperties } from "react";

const containerStyle: CSSProperties = {
  display: "grid",
  placeContent: "center",
  minHeight: "100vh",
  gap: "0.5rem",
  textAlign: "center",
};

const headingStyle: CSSProperties = {
  fontSize: "2.25rem",
  margin: 0,
};

const paragraphStyle: CSSProperties = {
  margin: 0,
};

export default function UnauthorizedPage() {
  return (
    <main style={containerStyle}>
      <h1 style={headingStyle}>Access denied</h1>
      <p style={paragraphStyle}>You do not have permission to view this page.</p>
      <p style={paragraphStyle}>
        Please contact your workspace owner or return to the <Link href="/">homepage</Link>.
      </p>
    </main>
  );
}