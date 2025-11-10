import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

type ExternalProvider = {
  id: string;
  name: string;
};

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("external_providers")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("[ExternalSources] Failed to load external sources", error);
      return NextResponse.json({ error: "Unable to load external sources" }, { status: 500 });
    }

    const sources = (data ?? []).map((source) => ({
      id: source.id,
      name: typeof source.name === "string" ? source.name : "",
    })) as ExternalProvider[];

    return NextResponse.json({ sources });
  } catch (error) {
    console.error("[ExternalSources] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
