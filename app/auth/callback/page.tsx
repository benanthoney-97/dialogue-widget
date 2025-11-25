"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const clientId = session.user.app_metadata?.client_id ?? "cfd59bb5-335e-4a20-a62d-091ac2b7cf15";
        console.log("[auth/callback] redirecting to client personas", clientId);
        router.replace(`/client/${clientId}/personas`);
      }
    });

    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        router.replace(`/auth?error=${encodeURIComponent(error.message)}`);
        return;
      }
      if (session) {
        const clientId = session.user.app_metadata?.client_id ?? "cfd59bb5-335e-4a20-a62d-091ac2b7cf15";
        console.log("[auth/callback] session redirect", clientId);
        router.replace(`/client/${clientId}/personas`);
      }
    };

    checkSession();

    return () => {
      data.subscription?.unsubscribe();
    };
  }, [router]);

  return (
    <div className="auth-callback">
    </div>
  );
}
