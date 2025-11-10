import { NextResponse } from "next/server";
import { createClient, PostgrestError } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type PersonaCounts = {
  user_count: number | null;
};

type DataFootprint = {
  total_bytes: number | null;
};

type EngagementActivity = {
  total_call_secs: number | null;
  interview_count: number | null;
  questionnaire_count: number | null;
};

type ClientSubscription = {
  tier_code: string | null;
};

type SubscriptionTierRow = {
  code: string;
  tier_code?: string | null;
  name?: string | null;
  max_users?: number | null;
  max_personas?: number | null;
  max_minutes_per_month?: number | null;
  max_kb_bytes_per_org?: number | null;
  max_questionnaires_per_month?: number | null;
  quota_users?: number | null;
  quota_personas?: number | null;
  quota_call_secs?: number | null;
  quota_storage_bytes?: number | null;
  quota_questionnaires_per_month?: number | null;
  [key: string]: unknown;
};

type SubscriptionTier = {
  tier_code: string;
  name?: string | null;
  max_users?: number | null;
  max_personas?: number | null;
  max_minutes_per_month?: number | null;
  max_kb_bytes_per_org?: number | null;
  max_questionnaires_per_month?: number | null;
};

export async function GET(
  _request: Request,
  { params }: { params: { clientId?: string } }
) {
  const clientId = params.clientId;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing workspace identifier" },
      { status: 400 }
    );
  }

  try {
    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const [
      personaCountsResult,
      dataFootprintResult,
      engagementResult,
      clientSubscriptionResult,
      subscriptionTiersResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("v_org_persona_counts")
        .select("user_count")
        .eq("client_id", clientRow.id)
        .maybeSingle<PersonaCounts>(),
      supabaseAdmin
        .from("v_org_data_footprint")
        .select("total_bytes")
        .eq("client_id", clientRow.id)
        .maybeSingle<DataFootprint>(),
      supabaseAdmin
        .from("v_org_engagement_activity_month")
        .select("total_call_secs, interview_count, questionnaire_count")
        .eq("client_id", clientRow.id)
        .maybeSingle<EngagementActivity>(),
      supabaseAdmin
        .from("client_subscriptions")
        .select("tier_code")
        .eq("client_id", clientRow.id)
        .maybeSingle<ClientSubscription>(),
      supabaseAdmin
        .from("subscription_tiers")
        .select("*")
        .order("code", { ascending: true }) as unknown as Promise<{
          data: SubscriptionTierRow[] | null;
          error: PostgrestError | null;
        }>,
    ]);

    if (personaCountsResult.error) {
      console.error("[Usage] Failed to load persona counts", personaCountsResult.error);
      return NextResponse.json({ error: "Unable to load usage metrics" }, { status: 500 });
    }

    if (dataFootprintResult.error) {
      console.error("[Usage] Failed to load data footprint", dataFootprintResult.error);
      return NextResponse.json({ error: "Unable to load usage metrics" }, { status: 500 });
    }

    if (engagementResult.error) {
      console.error("[Usage] Failed to load engagement activity", engagementResult.error);
      return NextResponse.json({ error: "Unable to load usage metrics" }, { status: 500 });
    }

    if (clientSubscriptionResult.error) {
      console.error("[Usage] Failed to load client subscription", clientSubscriptionResult.error);
      return NextResponse.json({ error: "Unable to load usage metrics" }, { status: 500 });
    }

    if (subscriptionTiersResult.error) {
      console.error("[Usage] Failed to load subscription tiers", subscriptionTiersResult.error);
      return NextResponse.json({ error: "Unable to load usage metrics" }, { status: 500 });
    }

    const metrics = {
      userCount: personaCountsResult.data?.user_count ?? 0,
      personaCount: personaCountsResult.data?.user_count ?? 0,
      totalBytes: dataFootprintResult.data?.total_bytes ?? 0,
      totalCallSeconds: engagementResult.data?.total_call_secs ?? 0,
      interviewCount: engagementResult.data?.interview_count ?? 0,
      questionnaireCount: engagementResult.data?.questionnaire_count ?? 0,
    };

    const normalizedTiers: SubscriptionTier[] = (subscriptionTiersResult.data ?? []).map((tier) => {
      const tierCode = tier.tier_code ?? tier.code ?? "";
      const maxUsers = tier.max_users ?? tier.quota_users ?? null;
      const maxPersonas = tier.max_personas ?? tier.quota_personas ?? null;
      const maxMinutesPerMonth = tier.max_minutes_per_month ?? (tier.quota_call_secs != null
        ? Math.round(Number(tier.quota_call_secs) / 60)
        : null);
      const maxKbBytesPerOrg = tier.max_kb_bytes_per_org ?? (tier.quota_storage_bytes != null
        ? Math.round(Number(tier.quota_storage_bytes) / 1024)
        : null);
      const maxQuestionnairesPerMonth = tier.max_questionnaires_per_month ?? tier.quota_questionnaires_per_month ?? null;

      return {
        tier_code: tierCode,
        name: tier.name ?? null,
        max_users: maxUsers,
        max_personas: maxPersonas,
        max_minutes_per_month: maxMinutesPerMonth,
        max_kb_bytes_per_org: maxKbBytesPerOrg,
        max_questionnaires_per_month: maxQuestionnairesPerMonth,
      };
    });

    const subscription = {
      tierCode: clientSubscriptionResult.data?.tier_code ?? null,
      tiers: normalizedTiers,
    };

    return NextResponse.json({ metrics, subscription });
  } catch (error) {
    console.error("[Usage] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
