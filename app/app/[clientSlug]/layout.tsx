import type { ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ClientPortalFrame from "./ClientPortalFrame";

type ClientRecord = {
  id: string;
  name: string | null;
  display_name: string | null;
};

type Supabase = SupabaseClient<any, "public", any>;

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isUuid(candidate: string): boolean {
  return UUID_PATTERN.test(candidate.trim());
}

async function resolveClientDisplayName(clientId: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !isUuid(clientId)) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey) as Supabase;
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("id", clientId.trim())
    .maybeSingle<ClientRecord>();

  if (error && error.code && error.code !== "PGRST116") {
    console.warn("[portal] Unable to load client display name", { clientId, error });
  }

  if (!data) {
    return null;
  }

  const name = typeof data.display_name === "string" && data.display_name.trim().length > 0
    ? data.display_name.trim()
    : typeof data.name === "string" && data.name.trim().length > 0
      ? data.name.trim()
      : null;

  return name;
}

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const resolvedDisplayName = await resolveClientDisplayName(clientSlug);
  const clientDisplayName = resolvedDisplayName ?? `Workspace ${clientSlug.slice(0, 8)}`;
  return (
    <ClientPortalFrame clientDisplayName={clientDisplayName}>
      {children}
    </ClientPortalFrame>
  );
}
