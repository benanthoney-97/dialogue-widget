import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";
import type { Database } from "@/app/lib/database.types";
import CallForm from "./CallForm";

type CampaignLinksTable = {
  Row: {
    id: string;
    campaign_id: string;
    persona_id: string | null;
    phone_number: string | null;
  };
};

export const dynamic = "force-dynamic";

type PageParams = {
  clientSlug: string;
  campaignSlug: string;
};

async function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey);
}

export default async function CampaignCallPage({ params }: { params: PageParams }) {
  const supabase = await createSupabaseClient();
  const { data: linkRow, error: linkError } = await supabase
    .from("campaign_links" as const)
    .select("id, campaign_id, persona_id, campaign:campaigns(id, name, description, objective, questions)")
    .eq("id", params.campaignSlug)
    .maybeSingle<CampaignLinksTable["Row"] & { campaign?: { id: string; name: string; description: string; objective: string; questions: unknown } }>();

  if (linkError || !linkRow) {
    return (
      <div style={containerStyle}>
        <p style={errorStyle}>This call link is invalid or no longer available.</p>
      </div>
    );
  }

  const campaignId = linkRow.campaign_id ?? null;
  let documents: string[] = [];
  if (campaignId) {
    const { data: docRows } = await supabase
      .from("campaign_documents" as const)
      .select("markdown")
      .eq("campaign_id", campaignId);
    if (Array.isArray(docRows)) {
      documents = docRows
        .map((doc) => (typeof doc.markdown === "string" ? doc.markdown.trim() : null))
        .filter((markdown): markdown is string => Boolean(markdown));
    }
  }
  const campaignMeta = {
    name: linkRow.campaign?.name ?? null,
    description: linkRow.campaign?.description ?? null,
    objective: linkRow.campaign?.objective ?? null,
    questions: Array.isArray(linkRow.campaign?.questions)
      ? linkRow.campaign?.questions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      : [],
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Call me on this number</h1>
        <p style={subtitleStyle}>
          We’ll call you from our shared agent number and route the conversation to the right persona.
        </p>
      </header>
      <CallForm
        campaignLinkId={linkRow.id}
        campaignId={linkRow.campaign_id}
        campaignMeta={campaignMeta}
        documentMarkdowns={documents}
      />
      <footer style={footerStyle}>
        <Link href={`/campaign/${params.clientSlug}/${params.campaignSlug}`} style={backLinkStyle}>
          Back to campaign
        </Link>
      </footer>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "40px 20px",
  maxWidth: 480,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  justifyContent: "center",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
};

const footerStyle: React.CSSProperties = {
  marginTop: 16,
};

const backLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  textAlign: "center",
};
