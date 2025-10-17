import DialogueBar from "@/app/components/DialogueBarTalkButton";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function ImagePage({ params }: { params: { slug: string } }) {
  const slug = params?.slug ?? "";

  const { data } = await supabase
    .from("agent_map")
    .select("background_image, agent_id, region, auth, talk_label")
    .eq("key", slug)
    .single();

  if (!data) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            padding: 16,
            border: "1px solid rgba(0,0,0,.1)",
            borderRadius: 12,
          }}
        >
          Unknown image slug: <code>{slug}</code>
        </div>
      </main>
    );
  }

  const backgroundUrl = data.background_image ?? "";
  const agentId = data.agent_id ?? "";
  const region = (data.region as
    | "us"
    | "eu-residency"
    | "in-residency"
    | "global") || "us";
  const auth = data.auth ?? "signed";
  const talkLabel = data.talk_label ?? undefined;
  const useSignedUrl = auth !== "public";

  return (
    <main style={{ minHeight: "100dvh", position: "relative", background: "#000" }}>
      {backgroundUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backgroundUrl}
          alt={slug}
          style={{ width: "100%", height: "100dvh", objectFit: "cover", display: "block" }}
        />
      ) : null}

      <div style={{ position: "fixed", bottom: "12px", right: "12px", zIndex: 60 }}>
        <DialogueBar
          agentId={agentId}
          useSignedUrl={useSignedUrl}
          serverLocation={region}
          talkLabel={talkLabel}
        />
      </div>
    </main>
  );
}
