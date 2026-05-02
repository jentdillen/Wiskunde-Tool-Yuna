"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import type { MissionRow } from "@/lib/db";
import { verifyKidMatchesSession } from "@/lib/kid-auth";
import { clearKidJoinDraft, readKidJoinDraft } from "@/lib/kid-session";
import { getSupabase } from "@/lib/supabase/client";

export default function MissiesPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const [missions, setMissions] = useState<MissionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setMissions((data || []) as MissionRow[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  if (!supabase) return <SetupRequired />;

  if (missions === null && !loadError) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-950 px-4 text-cyan-200">
        <p>{t("loading")}</p>
      </div>
    );
  }

  const kidDraft = readKidJoinDraft();

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-8 pt-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle variant="dark" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg pt-2">
        <h1 className="text-center text-2xl font-black text-white sm:text-3xl">{t("missionsTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-cyan-100/85">{t("missionsSub")}</p>

        {loadError && (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-center text-sm text-red-100">
            {loadError}
          </div>
        )}

        {missions && missions.length === 0 && !loadError && (
          <p className="mt-8 text-center text-cyan-200/80">{t("noMissions")}</p>
        )}

        <ul className="mt-6 space-y-3">
          {(missions || []).map((m) => {
            const done = kidDraft?.missionCompletions?.[m.id];
            return (
              <li key={m.id}>
                <Link
                  href={`/intro?mission=${encodeURIComponent(m.id)}`}
                  className={
                    done
                      ? "block rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/45 px-4 py-4 text-left shadow-[0_0_28px_rgba(52,211,153,0.2)] transition hover:border-emerald-300/90 hover:bg-emerald-950/60"
                      : "block rounded-2xl border border-cyan-500/35 bg-slate-950/80 px-4 py-4 text-left shadow-[0_0_24px_rgba(34,211,238,0.1)] transition hover:border-cyan-400/60 hover:bg-slate-900/90"
                  }
                >
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
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/"
          className="mt-8 block text-center text-sm font-semibold text-cyan-300/90 underline-offset-4 hover:underline"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
