"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import type { ClassLookupRow } from "@/lib/db";
import { ensureAnonymousSession, isAnonymousSignInDisabledError } from "@/lib/kid-auth";
import { writeKidJoinDraft } from "@/lib/kid-session";
import { getSupabase } from "@/lib/supabase/client";
import { supabaseAuthProvidersDashboardUrl } from "@/lib/supabase/project-dashboard";

export function StudentJoinForm() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);

  const [school, setSchool] = useState("");
  const [classLabel, setClassLabel] = useState("");
  const [firstName, setFirstName] = useState("");
  const [matches, setMatches] = useState<ClassLookupRow[] | null>(null);
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnonymousSetupLink, setShowAnonymousSetupLink] = useState(false);
  const providersUrl = useMemo(() => supabaseAuthProvidersDashboardUrl(), []);

  const resetDisambiguation = () => {
    setMatches(null);
    setPickedClassId(null);
    setShowAnonymousSetupLink(false);
    setError(null);
  };

  const onLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const s = school.trim();
    const c = classLabel.trim();
    const n = firstName.trim();
    if (!s || !c || !n) return;

    setBusy(true);
    setError(null);
    setShowAnonymousSetupLink(false);
    try {
      const { data, error: re } = await supabase.rpc("find_classes", {
        p_school: s,
        p_label: c,
      });
      if (re) throw re;
      const rows = (data || []) as ClassLookupRow[];
      if (rows.length === 0) {
        setError(t("noClassFound"));
        setBusy(false);
        return;
      }
      if (rows.length === 1) {
        await finalizeJoin(rows[0].class_id, rows[0].school_name, c, n);
        return;
      }
      setMatches(rows);
      setPickedClassId(rows[0].class_id);
    } catch (err: unknown) {
      console.error(err);
      setShowAnonymousSetupLink(isAnonymousSignInDisabledError(err));
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const mapJoinError = (err: unknown): string => {
    let msg = "Error";
    let code = "";
    if (err && typeof err === "object" && "message" in err) {
      msg = String((err as { message: string }).message);
    }
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code) {
      code = String((err as { code?: string }).code);
    }
    const m = msg.toLowerCase();
    if (m.includes("class_full")) return t("classFull");
    if (m.includes("name_already_linked")) return t("nameAlreadyLinked");
    if (m.includes("not_authenticated")) return t("studentAuthRequired");
    if (
      code === "anonymous_provider_disabled" ||
      /anonymous.*(disabled|not enabled)/i.test(msg) ||
      /enable.*anonymous/i.test(msg)
    ) {
      return t("anonymousSignInFailed");
    }
    return msg;
  };

  const finalizeJoin = async (classId: string, schoolName: string, label: string, name: string) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setShowAnonymousSetupLink(false);
    try {
      await ensureAnonymousSession(supabase);
      const { data: sid, error: se } = await supabase.rpc("student_join_bound", {
        p_class_id: classId,
        p_first_name: name,
      });
      if (se) throw se;
      if (!sid) throw new Error("student");

      writeKidJoinDraft({
        classId,
        classLabel: label,
        schoolName,
        firstName: name,
        studentId: sid as string,
      });
      router.push("/missies");
    } catch (err: unknown) {
      console.error(err);
      setShowAnonymousSetupLink(isAnonymousSignInDisabledError(err));
      setError(mapJoinError(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedClassId || !matches?.length) return;
    const row = matches.find((m) => m.class_id === pickedClassId);
    await finalizeJoin(
      pickedClassId,
      row?.school_name ?? school.trim(),
      classLabel.trim(),
      firstName.trim()
    );
  };

  if (!supabase) return <SetupRequired />;

  const canSubmit = school.trim() && classLabel.trim() && firstName.trim();

  if (matches && matches.length > 1) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-lg">
        <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          {t("joinPickTeacher")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-cyan-100/90">{t("ambiguousClass")}</p>
        {error && (
          <div
            className="mt-4 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-center text-sm text-red-100"
            role="alert"
          >
            <p>{error}</p>
            {showAnonymousSetupLink && providersUrl ? (
              <p className="mt-3 text-xs leading-snug text-red-50/95">
                <span className="block font-bold">{t("anonymousEnableSteps")}</span>
                <Link
                  href={providersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
                >
                  {t("openSupabaseAuthProviders")}
                </Link>
              </p>
            ) : null}
          </div>
        )}
        <form
          onSubmit={(ev) => void onConfirmPick(ev)}
          className="mt-5 space-y-4 rounded-3xl border border-cyan-500/35 bg-slate-950/75 p-4 backdrop-blur-md sm:p-6"
        >
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.class_id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-600 bg-slate-900/80 p-3 has-[:checked]:border-cyan-400">
                  <input
                    type="radio"
                    name="classPick"
                    className="mt-1"
                    checked={pickedClassId === m.class_id}
                    onChange={() => setPickedClassId(m.class_id)}
                  />
                  <span className="text-left text-sm text-cyan-50">
                    <span className="font-bold text-white">{m.teacher_name || "—"}</span>
                    <span className="block text-cyan-200/80">{m.school_name}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => resetDisambiguation()}
              className="w-full rounded-2xl border border-slate-500 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800 sm:w-auto"
            >
              {t("back")}
            </button>
            <button
              type="submit"
              disabled={busy || !pickedClassId}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-black text-slate-950 disabled:opacity-50 sm:flex-1 sm:min-w-[12rem]"
            >
              {busy ? t("loading") : t("joinContinue")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-lg">
      <h1 className="text-center text-2xl font-black tracking-tight text-white sm:text-4xl">{t("kidHeading")}</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-cyan-100/90 sm:text-base">{t("kidSub")}</p>

      {error && (
        <div
          className="mt-4 rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-center text-sm text-red-100"
          role="alert"
        >
          <p>{error}</p>
          {showAnonymousSetupLink && providersUrl ? (
            <p className="mt-3 text-xs leading-snug text-red-50/95">
              <span className="block font-bold">{t("anonymousEnableSteps")}</span>
              <Link
                href={providersUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
              >
                {t("openSupabaseAuthProviders")}
              </Link>
            </p>
          ) : null}
        </div>
      )}

      <form
        onSubmit={(e) => void onLookup(e)}
        className="mt-5 rounded-3xl border border-cyan-500/35 bg-slate-950/75 p-4 shadow-[0_0_48px_rgba(34,211,238,0.14)] backdrop-blur-md sm:mt-6 sm:p-6"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-cyan-300">
            {t("joinStepSchool")}
          </span>
        </div>
        <label className="mt-3 block text-base font-bold text-cyan-50">{t("joinSchool")}</label>
        <input
          className="mt-2 w-full rounded-2xl border-2 border-slate-600 bg-slate-900/90 px-4 py-4 text-lg text-white outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 sm:py-5"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          autoComplete="organization"
          required
          placeholder="…"
        />

        <div className="mt-5 flex items-center gap-2 sm:mt-6">
          <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-cyan-300">
            {t("joinStepClass")}
          </span>
        </div>
        <label className="mt-3 block text-base font-bold text-cyan-50">{t("joinClass")}</label>
        <input
          className="mt-2 w-full rounded-2xl border-2 border-slate-600 bg-slate-900/90 px-4 py-4 text-lg text-white outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 sm:py-5"
          value={classLabel}
          onChange={(e) => setClassLabel(e.target.value)}
          required
          placeholder="3OH"
        />

        <div className="mt-5 flex items-center gap-2 sm:mt-6">
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-200">
            {t("joinStepName")}
          </span>
        </div>
        <label className="mt-3 block text-base font-bold text-cyan-50">{t("yourName")}</label>
        <input
          className="mt-2 w-full rounded-2xl border-2 border-slate-600 bg-slate-900/90 px-4 py-4 text-xl text-white outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/30 sm:py-5"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
          maxLength={40}
          placeholder="…"
        />

        <p className="mt-5 text-center text-xs leading-snug text-cyan-200/80 sm:text-sm">{t("joinReadyHint")}</p>

        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 py-4 text-lg font-black text-slate-950 shadow-[0_8px_32px_rgba(251,191,36,0.35)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 sm:py-5 sm:text-xl"
        >
          {busy ? (
            t("loading")
          ) : (
            <>
              <span>{t("joinContinue")}</span>
              <span className="text-2xl leading-none sm:text-3xl" aria-hidden="true">
                →
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
