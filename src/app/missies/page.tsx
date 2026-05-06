"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MissionPlanet } from "@/components/missions/MissionPlanet";
import { RekenRaketBrandLink } from "@/components/RekenRaketBrandLink";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import type { MissionRow } from "@/lib/db";
import { verifyKidMatchesSession } from "@/lib/kid-auth";
import { clearKidJoinDraft, readKidJoinDraft } from "@/lib/kid-session";
import {
  MISSION_DIFFICULTY_ORDER,
  isMissionUnlockedForKid,
  normalizeMissionDifficulty,
  sortMissionsByDifficultyThenCreated,
  tierSatisfied,
  unlockBlockedReason,
} from "@/lib/missions";
import { getSupabase } from "@/lib/supabase/client";

export default function MissiesPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const [missions, setMissions] = useState<MissionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllDoneCelebration, setShowAllDoneCelebration] = useState(false);
  const kidDraft = readKidJoinDraft();
  const sorted = missions ?? [];
  const allMissionsComplete =
    sorted.length > 0 &&
    tierSatisfied(sorted, "easy", kidDraft?.missionCompletions) &&
    tierSatisfied(sorted, "medium", kidDraft?.missionCompletions) &&
    tierSatisfied(sorted, "hard", kidDraft?.missionCompletions);

  useEffect(() => {
    if (!supabase) return;
    const draft = readKidJoinDraft();
    if (!draft) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    void (async () => {
      const sessionOk = await verifyKidMatchesSession(supabase, draft);
      if (cancelled) return;
      if (!sessionOk) {
        await supabase.auth.signOut();
        clearKidJoinDraft();
        router.replace("/");
        return;
      }
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("class_id", draft.classId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setMissions([]);
        return;
      }
      const sorted = sortMissionsByDifficultyThenCreated((data || []) as MissionRow[]);
      setMissions(sorted);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  useEffect(() => {
    if (!allMissionsComplete) return;
    setShowAllDoneCelebration(true);
  }, [allMissionsComplete]);

  if (!supabase) return <SetupRequired />;

  if (missions === null && !loadError) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 bg-slate-950 px-4">
        <p className="text-lg font-bold text-white" role="status" aria-live="polite">
          {t("loading")}
        </p>
        <p className="max-w-sm text-center text-sm text-cyan-200/90">{t("loadingStuckHint")}</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.1),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(167,139,250,0.08),transparent_45%)]" />
      {showAllDoneCelebration ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-missions-done-title"
          aria-describedby="all-missions-done-body"
        >
          <div className="relative flex h-full w-full max-w-5xl flex-col items-center justify-center overflow-hidden">
            <div className="pointer-events-none absolute left-[8%] top-[18%] animate-bounce [animation-duration:4.6s]">
              <MissionPlanet tier="easy" size="md" />
            </div>
            <div className="pointer-events-none absolute right-[10%] top-[24%] animate-bounce [animation-duration:5.2s] [animation-delay:300ms]">
              <MissionPlanet tier="medium" size="md" />
            </div>
            <div className="pointer-events-none absolute left-[16%] bottom-[24%] animate-bounce [animation-duration:5.8s] [animation-delay:700ms]">
              <MissionPlanet tier="hard" size="md" />
            </div>
            <div className="pointer-events-none absolute right-[18%] bottom-[30%] scale-90 animate-bounce [animation-duration:6.4s] [animation-delay:1200ms]">
              <MissionPlanet tier="easy" size="sm" />
            </div>

            <h2
              id="all-missions-done-title"
              className="pointer-events-none max-w-3xl animate-pulse text-center text-4xl font-black leading-tight text-amber-100 drop-shadow-[0_0_24px_rgba(251,191,36,0.4)] [animation-duration:3s] sm:text-6xl"
            >
              {t("missionAllDoneTitle")}
            </h2>
            <p
              id="all-missions-done-body"
              className="pointer-events-none mx-auto mt-5 max-w-2xl text-center text-lg font-bold text-cyan-100/95 drop-shadow-[0_0_16px_rgba(34,211,238,0.25)] sm:text-2xl"
            >
              {t("missionAllDoneBody")}
            </p>
            <button
              type="button"
              onClick={() => setShowAllDoneCelebration(false)}
              className="absolute bottom-8 left-1/2 w-full max-w-xs -translate-x-1/2 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 py-3.5 text-lg font-black text-slate-950 shadow-[0_8px_28px_rgba(251,191,36,0.35)] transition hover:brightness-110 sm:bottom-10"
            >
              Ga verder
            </button>
          </div>
        </div>
      ) : null}
      <div className="relative z-20 flex w-full items-center justify-between gap-3 pb-2">
        <RekenRaketBrandLink />
        <LanguageToggle variant="dark" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg pt-0">
        <h1 className="text-center text-2xl font-black text-white sm:text-3xl">{t("missionsTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm leading-snug text-cyan-100/90">{t("missionsSub")}</p>

        {loadError && (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-center text-sm text-red-100">
            {loadError}
          </div>
        )}

        {missions && missions.length === 0 && !loadError && (
          <p className="mt-8 text-center text-cyan-200/80">{t("noMissions")}</p>
        )}

        <div className="mt-6 space-y-10">
          {MISSION_DIFFICULTY_ORDER.map((tier) => {
            const items = sorted.filter((m) => normalizeMissionDifficulty(m.difficulty) === tier);
            if (items.length === 0) return null;

            const sectionHeading =
              tier === "easy"
                ? t("missionsSectionEasy")
                : tier === "medium"
                  ? t("missionsSectionMedium")
                  : t("missionsSectionHard");
            const sectionSub =
              tier === "easy"
                ? `${t("difficultyEasyTitle")} · ${t("difficultyEasySub")}`
                : tier === "medium"
                  ? `${t("difficultyMediumTitle")} · ${t("difficultyMediumSub")}`
                  : `${t("difficultyHardTitle")} · ${t("difficultyHardSub")}`;

            return (
              <section key={tier} className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 shadow-[0_0_32px_rgba(0,0,0,0.25)] backdrop-blur-sm">
                  <MissionPlanet tier={tier} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black text-white sm:text-xl">{sectionHeading}</h2>
                    <p className="text-xs font-semibold text-cyan-200/75">{sectionSub}</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {items.map((m) => {
                    const done = kidDraft?.missionCompletions?.[m.id];
                    const unlocked = isMissionUnlockedForKid(m, sorted, kidDraft?.missionCompletions);
                    const block = unlockBlockedReason(m, sorted, kidDraft?.missionCompletions);
                    const missionTier = normalizeMissionDifficulty(m.difficulty);

                    if (!unlocked) {
                      return (
                        <li key={m.id}>
                          <div className="flex gap-3 rounded-2xl border border-slate-600/60 bg-slate-950/70 px-4 py-4 text-left opacity-90">
                            <MissionPlanet tier={missionTier} size="sm" locked className="self-center" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-lg font-black text-slate-400">{m.title}</span>
                                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wide text-slate-400">
                                  {t("missionsLockedBadge")}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-snug text-slate-500">
                                {block === "easy" ? t("missionsLockedNeedEasy") : t("missionsLockedNeedMedium")}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={m.id}>
                        <Link
                          href={`/intro?mission=${encodeURIComponent(m.id)}`}
                          className={
                            done
                              ? "flex gap-3 rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/40 px-4 py-4 text-left shadow-[0_0_28px_rgba(52,211,153,0.2)] transition hover:border-emerald-300/90 hover:bg-emerald-950/55"
                              : "flex gap-3 rounded-2xl border border-cyan-500/35 bg-slate-950/80 px-4 py-4 text-left shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-400/60 hover:bg-slate-900/90"
                          }
                        >
                          <MissionPlanet tier={missionTier} size="sm" className="self-center" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-lg font-black text-white">{m.title}</span>
                              {done ? (
                                <span className="rounded-full bg-emerald-500/25 px-2.5 py-0.5 text-xs font-black tabular-nums text-emerald-200">
                                  {t("missionSuccessPct", { pct: done.successPct })}
                                </span>
                              ) : null}
                            </div>
                            <span className="mt-1 block text-xs text-cyan-200/70">
                              {t("rangeLabel")}: {m.max_number} · {t("modeLabel")}: {m.operation_mode}
                              {done ? (
                                <span className="text-emerald-200/90"> · {t("missionCompletedHint")}</span>
                              ) : null}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <Link
          href="/"
          className="mt-10 block text-center text-sm font-semibold text-cyan-300/90 underline-offset-4 hover:underline"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
