import type { ReactNode } from "react";
import ClientPortalFrame from "./ClientPortalFrame";

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const clientDisplayName = clientSlug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  return (
    <ClientPortalFrame clientDisplayName={clientDisplayName}>
      {children}
    </ClientPortalFrame>
  );
}
