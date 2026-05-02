"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AstronautCharacter } from "@/components/astronauts/AstronautCharacter";
import { SpeechBubble } from "@/components/astronauts/SpeechBubble";
import { useLocale } from "@/contexts/LocaleContext";
import { verifyKidMatchesSession } from "@/lib/kid-auth";
import { clearKidJoinDraft, readKidJoinDraft, writeKidJoinDraft } from "@/lib/kid-session";
import { getSupabase } from "@/lib/supabase/client";

function IntroInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get("mission");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const draft = readKidJoinDraft();
    if (!draft || !missionId) {
      router.replace(draft && !missionId ? "/missies" : "/");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      queueMicrotask(() => setOk(true));
      return;
    }
    void (async () => {
      const sessionOk = await verifyKidMatchesSession(supabase, draft);
      if (!sessionOk) {
        await supabase.auth.signOut();
        clearKidJoinDraft();
        router.replace("/");
        return;
      }
      setOk(true);
    })();
  }, [router, missionId]);

  if (!ok || !missionId) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-950 px-4 text-cyan-200">
        <p className="text-sm">{t("loading")}</p>
      </div>
    );
  }

  const onStart = () => {
    const draft = readKidJoinDraft();
    if (!draft) {
      router.replace("/");
      return;
    }
    const attemptId = crypto.randomUUID();
    writeKidJoinDraft({
      ...draft,
      activeMissionAttempt: { missionId, attemptId },
    });
    router.push(`/oefenen?mission=${encodeURIComponent(missionId)}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-center justify-start bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-6 pt-6 sm:justify-center sm:py-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_60%)]" />
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-5 sm:gap-7">
        <div className="flex w-full items-end justify-center gap-3 sm:gap-8">
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <SpeechBubble label={t("astroNovaName")} text={t("introNovaAsk")} />
            <AstronautCharacter variant="nova" className="scale-[0.82] sm:scale-100" />
          </div>
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <SpeechBubble label={t("astroMiloName")} text={t("introMiloAsk")} align="right" />
            <AstronautCharacter variant="milo" className="scale-[0.82] sm:scale-100" />
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="w-full max-w-md rounded-3xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-lg font-black text-slate-950 shadow-[0_0_40px_rgba(251,191,36,0.35)] transition hover:brightness-110 active:scale-[0.99] sm:py-5 sm:text-xl"
        >
          {t("helpAstronauts")}
        </button>
      </div>
    </div>
  );
}

export default function IntroPage() {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-950 px-4 text-cyan-200">
          <p className="text-sm">{t("loading")}</p>
        </div>
      }
    >
      <IntroInner />
    </Suspense>
  );
}
