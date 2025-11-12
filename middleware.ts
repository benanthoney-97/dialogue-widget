import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

const CLIENT_ROUTE_REGEX = /^\/client\/([^/]+)(?:\/.*)?$/;
const ALLOWED_CLIENT_ROLES = new Set(["admin", "owner"]);

type ClientRecord = {
  id: string | number;
  name: string | null;
  display_name: string | null;
};

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCandidateValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  let stringValue: string | null = null;
  if (typeof value === "string") {
    stringValue = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    stringValue = String(value);
  }

  if (!stringValue) {
    return null;
  }

  const trimmed = stringValue.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function addCandidateVariants(target: Set<string>, candidate: unknown) {
  const normalized = normalizeCandidateValue(candidate);
  if (!normalized) {
    return;
  }

  target.add(normalized);
  target.add(slugify(normalized));
}

async function getSupabaseForRequest(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}

async function fetchClientRecord(
  supabase: SupabaseClient,
  profileClientId: unknown,
): Promise<ClientRecord | null> {
  if (profileClientId === null || profileClientId === undefined) {
    return null;
  }

  if (typeof profileClientId === "number" && Number.isFinite(profileClientId)) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, display_name")
      .eq("id", profileClientId)
      .maybeSingle<ClientRecord>();
    return data ?? null;
  }

  if (typeof profileClientId === "string") {
    const trimmed = profileClientId.trim();
    if (!trimmed) {
      return null;
    }

    const numericFromString = Number(trimmed);
    if (!Number.isNaN(numericFromString)) {
      const { data } = await supabase
        .from("clients")
        .select("id, name, display_name")
        .eq("id", numericFromString)
        .maybeSingle<ClientRecord>();
      if (data) {
        return data;
      }
    }

    const { data: byName } = await supabase
      .from("clients")
      .select("id, name, display_name")
      .eq("name", trimmed)
      .maybeSingle<ClientRecord>();

    if (byName) {
      return byName;
    }

    const { data: byDisplayName } = await supabase
      .from("clients")
      .select("id, name, display_name")
      .eq("display_name", trimmed)
      .maybeSingle<ClientRecord>();

    if (byDisplayName) {
      return byDisplayName;
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  if (response.headers.get("location")) {
    return response;
  }

  const { pathname } = request.nextUrl;
  const match = CLIENT_ROUTE_REGEX.exec(pathname);
  if (!match) {
    return response;
  }

  const supabase = await getSupabaseForRequest(request, response);
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const rawClientSlug = match[1];
  const decodedClientSlug = safeDecodeURIComponent(rawClientSlug);
  const slugComparisons = new Set<string>();
  const normalizedClientSlug = normalizeCandidateValue(decodedClientSlug);

  if (normalizedClientSlug) {
    slugComparisons.add(normalizedClientSlug);
    const slugifiedSegment = slugify(decodedClientSlug);
    if (slugifiedSegment) {
      slugComparisons.add(slugifiedSegment);
    }
  }

  if (slugComparisons.size === 0) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const normalizedRole = (profile.role ?? "").toLowerCase();
  if (!ALLOWED_CLIENT_ROLES.has(normalizedRole)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const allowedSlugs = new Set<string>();
  addCandidateVariants(allowedSlugs, profile.client_id);

  let matchesWorkspace = Array.from(slugComparisons).some((candidate) =>
    allowedSlugs.has(candidate),
  );

  if (!matchesWorkspace) {
    const clientRecord = await fetchClientRecord(supabase, profile.client_id);
    if (clientRecord) {
      addCandidateVariants(allowedSlugs, clientRecord.id);
      addCandidateVariants(allowedSlugs, clientRecord.name);
      addCandidateVariants(allowedSlugs, clientRecord.display_name);

      matchesWorkspace = Array.from(slugComparisons).some((candidate) =>
        allowedSlugs.has(candidate),
      );
    }
  }

  if (!matchesWorkspace) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
