"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Supabase stuurt bevestigde gebruikers hier naartoe (emailRedirectTo).
 * Sessie uit URL laten verwerken, daarna uitloggen zodat docent met wachtwoord kan inloggen.
 */
export default function TeacherEmailConfirmedPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      await new Promise((r) => setTimeout(r, 80));
      await supabase.auth.getSession();
      if (cancelled) return;
      await supabase.auth.signOut({ scope: "local" });
      if (cancelled) return;
      router.replace("/teacher/login?confirmed=1");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  if (!supabase) return <SetupRequired />;

  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-gradient-to-b from-violet-50 to-indigo-50 px-6 text-center">
      <p className="max-w-md text-lg font-bold text-indigo-950 sm:text-xl">{t("teacherEmailConfirmBusy")}</p>
    </div>
  );
}
