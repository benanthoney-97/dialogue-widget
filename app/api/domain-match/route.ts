import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/app/lib/jump";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[domain-match] Missing Supabase credentials");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const CONSUMER_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "gmx.com",
  "mail.com",
];

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function extractDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) {
    return null;
  }
  const domain = parts[1].trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

function isConsumerDomain(domain: string) {
  return CONSUMER_DOMAINS.some((consumer) => domain === consumer || domain.endsWith(`.${consumer}`));
}

type DomainLookupPayload = {
  email?: unknown;
};

type ClientMetadata = {
  id: number;
  name: string | null;
  display_name: string | null;
};

type DomainMatchWorkspace = {
  id: number;
  name: string;
  slug: string;
};

export async function POST(request: Request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let body: DomainLookupPayload;
  try {
    body = (await request.json()) as DomainLookupPayload;
  } catch (error) {
    console.error("[domain-match] Invalid payload", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = normaliseEmail(rawEmail);
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const domain = extractDomain(email);
  if (!domain) {
    return NextResponse.json({ error: "Unable to parse email domain" }, { status: 400 });
  }

  if (isConsumerDomain(domain)) {
    return NextResponse.json({ found: false, domain, consumer: true });
  }

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("client_id")
    .ilike("email", `%@${domain}`)
    .not("client_id", "is", null);

  if (profileError) {
    console.error("[domain-match] Unable to query profiles", profileError);
    return NextResponse.json({ error: "Unable to check workspace" }, { status: 500 });
  }

  const profileMatches = (profileRows ?? []) as Array<{ client_id: number | null }>;
  const profileClientIds = Array.from(
    new Set(
      profileMatches
        .map((profile) => profile.client_id)
        .filter((value): value is number => typeof value === "number")
    )
  );

  const clientQueryPromise = profileClientIds.length
    ? supabaseAdmin
        .from("clients")
        .select("id, name, display_name")
        .in("id", profileClientIds)
    : Promise.resolve({ data: [] as ClientMetadata[], error: null as null });

  const domainQueryPromise = supabaseAdmin
    .from("clients")
    .select("id, name, display_name")
    .ilike("domain", domain);

  const [
    { data: profileClientRecords, error: profileClientError },
    { data: domainClientRecords, error: domainClientError },
  ] = await Promise.all([clientQueryPromise, domainQueryPromise]);

  if (profileClientError) {
    console.error("[domain-match] Unable to load profile workspaces", profileClientError);
    return NextResponse.json({ error: "Unable to check workspace" }, { status: 500 });
  }

  if (domainClientError) {
    console.error("[domain-match] Unable to load domain workspaces", domainClientError);
    return NextResponse.json({ error: "Unable to check workspace" }, { status: 500 });
  }

  const uniqueClients = new Map<number, ClientMetadata>();
  (profileClientRecords ?? []).forEach((record) => uniqueClients.set(record.id, record));
  (domainClientRecords ?? []).forEach((record) => uniqueClients.set(record.id, record));

  if (!uniqueClients.size) {
    return NextResponse.json({ found: false, domain });
  }

  const records = Array.from(uniqueClients.values());
  const workspaces: DomainMatchWorkspace[] = records.map((clientRecord) => {
    const displayName =
      clientRecord.display_name?.trim() || clientRecord.name?.trim() || "your Dialogue workspace";
    const slugSource = clientRecord.display_name?.trim() || clientRecord.name?.trim();
    const slugValue = slugify(slugSource || `client-${clientRecord.id}`);

    return {
      id: clientRecord.id,
      name: displayName,
      slug: slugValue,
    };
  });

  return NextResponse.json({
    found: true,
    domain,
    workspaces,
  });
}
