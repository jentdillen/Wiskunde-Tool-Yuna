"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SetupRequired } from "@/components/SetupRequired";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { useLocale } from "@/contexts/LocaleContext";
import { getSupabase } from "@/lib/supabase/client";

export default function TeacherPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = getSupabase();
  const [gate, setGate] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setGate("out"));
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setGate("in");
      else {
        setGate("out");
        router.replace("/teacher/login");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setGate("in");
      else {
        setGate("out");
        router.replace("/teacher/login");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  if (!supabase) {
    return (
      <div className="relative flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-violet-50 via-white to-indigo-50 px-4 py-4 sm:py-6">
        <SetupRequired />
      </div>
    );
  }

  if (gate === "loading" || gate === "out") {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-gradient-to-b from-violet-50 to-indigo-50 px-4 text-indigo-900">
        <p>{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-violet-50 via-white to-indigo-50 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:py-6">
      <div className="mx-auto mb-3 flex w-full max-w-4xl justify-end">
        <LanguageToggle />
      </div>
      <div className="mx-auto w-full max-w-4xl">
        <TeacherDashboard />
      </div>
    </div>
  );
}
