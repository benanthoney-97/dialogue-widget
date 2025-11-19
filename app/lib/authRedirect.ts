import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./jump";

type ClientRecord = {
  id: string | number;
  name: string | null;
  display_name: string | null;
};

type ProfileRecord = {
  client_id: string | number | null;
  role: string | null;
};

function deriveClientSlug(client: ClientRecord): string | null {
  const primaryName = typeof client.name === "string" ? client.name.trim() : "";
  if (primaryName) {
    return slugify(primaryName);
  }
  const displayName = typeof client.display_name === "string" ? client.display_name.trim() : "";
  if (displayName) {
    return slugify(displayName);
  }
  return null;
}

type AuthDatabase = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: number;
          name: string | null;
          display_name: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          display_name?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          display_name?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          client_id: number | null;
          role: string | null;
        };
        Insert: {
          id?: string;
          client_id?: number | null;
          role?: string | null;
        };
        Update: {
          id?: string;
          client_id?: number | null;
          role?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type AuthSupabase = SupabaseClient<AuthDatabase>;

async function resolveViewerDestination(
  supabase: AuthSupabase,
  clientId: number
): Promise<string | null> {
  const { data: clientRow, error } = await supabase
    .from("clients")
    .select("id, name, display_name")
    .eq("id", clientId)
    .maybeSingle<ClientRecord>();

  if (error || !clientRow) {
    return null;
  }

  const slug = deriveClientSlug(clientRow);
  return slug ? `/app/${slug}/explore` : null;
}

export async function resolveDestinationForUser(
  supabase: AuthSupabase,
  userId: string
): Promise<string> {
  const fallback = "/";

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
  .select("client_id, role")
  .eq("id", userId)
      .maybeSingle<ProfileRecord>();

    if (profileError || !profile) {
      return fallback;
    }

    const clientIdRaw = profile.client_id;
    const clientIdString =
      clientIdRaw === null || clientIdRaw === undefined ? null : String(clientIdRaw);
    const roleValue = typeof profile.role === "string" ? profile.role : null;

    if (roleValue === "viewer" && clientIdRaw !== null && clientIdRaw !== undefined) {
      const numericClientId =
        typeof clientIdRaw === "number" ? clientIdRaw : Number(clientIdRaw);
      if (Number.isFinite(numericClientId)) {
        const viewerDestination = await resolveViewerDestination(supabase, numericClientId);
        if (viewerDestination) {
          return viewerDestination;
        }
      }
    }

    if (clientIdString) {
      return `/client/${clientIdString}/personas`;
    }

    return fallback;
  } catch (error: unknown) {
    console.error("[auth] destination resolution failed", error);
    return fallback;
  }
}
