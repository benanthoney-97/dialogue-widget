"use client";

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const FALLBACK_CLIENT_ID = "cfd59bb5-335e-4a20-a62d-091ac2b7cf15";

async function resolveClientId(session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"] extends { session: infer S } ? S : never) {
  if (!session) return FALLBACK_CLIENT_ID;
  const storedClientId = session.user.app_metadata?.client_id;
  if (storedClientId) return storedClientId;
  const { data: profile, error } = await supabase.from("profiles").select("client_id").eq("id", session.user.id).single();
  if (error) {
    console.error("[auth/callback] failed to resolve profile client_id", error);
  }
  return profile?.client_id ?? FALLBACK_CLIENT_ID;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const redirect = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"] extends { session: infer S } ? S : never) => {
      if (!session) {
        return;
      }
      const clientId = await resolveClientId(session);
      console.log("[auth/callback] resolved client id", clientId);
      router.replace(`/client/${clientId}/personas`);
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void redirect(session ?? null);
    });

    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        router.replace(`/auth?error=${encodeURIComponent(error.message)}`);
        return;
      }
      await redirect(session);
    };

    void checkSession();

    return () => {
      data.subscription?.unsubscribe();
    };
  }, [router]);

  return <div className="auth-callback" />;
}
