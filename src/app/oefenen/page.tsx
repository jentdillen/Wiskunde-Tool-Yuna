"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AstronautCharacter } from "@/components/astronauts/AstronautCharacter";
import { SpeechBubble } from "@/components/astronauts/SpeechBubble";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import type { MissionRow } from "@/lib/db";
import { verifyKidMatchesSession } from "@/lib/kid-auth";
import {
  clearKidJoinDraft,
  readKidJoinDraft,
  recordMissionCompletion,
  teacherCallName,
  writeKidJoinDraft,
} from "@/lib/kid-session";
import {
  type OperationMode,
  formatQuestion,
  generateQuestionUnique,
  questionDedupeKey,
  type Question,
} from "@/lib/math";
import { SpacePracticeBackdrop } from "@/components/SpaceBackdrop";
import { isMissionUnlockedForKid, sortMissionsByDifficultyThenCreated } from "@/lib/missions";
import { playSuccessBeep } from "@/lib/sound";
import { getSupabase } from "@/lib/supabase/client";

function missionProgress(correct: number, target: number): number {
  return Math.min(100, Math.floor((correct / target) * 100));
}

const WRONG_BEFORE_HELP = 4;

function OefenenInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get("mission");
  const supabase = useMemo(() => getSupabase(), []);

  const [ready, setReady] = useState(false);
  const [mission, setMission] = useState<MissionRow | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  const [question, setQuestion] = useState<Question | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [correct, setCorrect] = useState(0);
  /** Total answered (incl. wrong) in this run — for success % on /missies */
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [missionComplete, setMissionComplete] = useState(false);
  /** Score van de net afgeronde poging (voor <50% → opnieuw proberen). */
  const [completionRunPct, setCompletionRunPct] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [helpRequestId, setHelpRequestId] = useState<string | null>(null);
  const [helpSentForQuestionKey, setHelpSentForQuestionKey] = useState<string | null>(null);
  const [teacherOnWay, setTeacherOnWay] = useState(false);
  /** Overlay sluiten zodat kind verder kan; status blijft on_way op de server. */
  const [teacherOnWayBannerDismissed, setTeacherOnWayBannerDismissed] = useState(false);
  const [helpSending, setHelpSending] = useState(false);

  /** Binnen één missie geen identieke (a,b,op) herhalen tot het reservoir op is. */
  const usedQuestionKeysRef = useRef<Set<string>>(new Set());

  const targetCorrect = mission?.target_correct ?? 20;
  const progress = missionProgress(correct, targetCorrect);

  const coachMood = feedback === "correct" ? "happy" : feedback === "wrong" ? "encourage" : "idle";
  let coachText = t("coachReady");
  if (feedback === "correct") coachText = t("coachGood");
  if (feedback === "wrong") coachText = t("coachEncourage");
  if (missionComplete) coachText = t("missionCompleteBody");

  const startQuestion = useCallback((m: MissionRow, completedQuestionKey?: string | null) => {
    if (completedQuestionKey) usedQuestionKeysRef.current.add(completedQuestionKey);
    const mode = (m.operation_mode || "both") as OperationMode;
    const q = generateQuestionUnique(m.max_number, mode, usedQuestionKeysRef.current);
    setQuestion(q);
    setAnswerInput("");
    setFeedback("idle");
    setSubmitError(null);
    setWrongStreak(0);
    setHelpRequestId(null);
    setHelpSentForQuestionKey(null);
    setTeacherOnWay(false);
    setTeacherOnWayBannerDismissed(false);
    setHelpSending(false);
  }, []);

  const questionKey = useMemo(
    () => (question ? questionDedupeKey(question) : ""),
    [question]
  );

  useEffect(() => {
    if (!supabase || !helpRequestId) return;
    const channel = supabase
      .channel(`student-help-${helpRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "student_help_requests",
          filter: `id=eq.${helpRequestId}`,
        },
        (payload) => {
          const row = payload.new as { status?: string };
          if (row.status === "on_way") setTeacherOnWay(true);
        }
      )
      .subscribe();
    void supabase
      .from("student_help_requests")
      .select("status")
      .eq("id", helpRequestId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === "on_way") setTeacherOnWay(true);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, helpRequestId]);

  /** Realtime (postgres_changes) faalt soms als replication niet volledig staat; polling vangt «Ik kom helpen». */
  useEffect(() => {
    if (!supabase || !helpRequestId || teacherOnWay || missionComplete) return;

    const poll = async () => {
      const { data } = await supabase
        .from("student_help_requests")
        .select("status")
        .eq("id", helpRequestId)
        .maybeSingle();
      if (data?.status === "on_way") setTeacherOnWay(true);
    };

    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(id);
  }, [supabase, helpRequestId, teacherOnWay, missionComplete]);

  const retryMission = useCallback(() => {
    if (!mission) return;
    const draft = readKidJoinDraft();
    if (!draft) return;
    const newAttemptId = crypto.randomUUID();
    writeKidJoinDraft({
      ...draft,
      activeMissionAttempt: { missionId: mission.id, attemptId: newAttemptId },
    });
    setAttemptId(newAttemptId);
    setCorrect(0);
    setTotalAnswered(0);
    setMissionComplete(false);
    setCompletionRunPct(null);
    setFeedback("idle");
    setSubmitError(null);
    usedQuestionKeysRef.current.clear();
    startQuestion(mission);
  }, [mission, startQuestion]);

  const sendHelpRequest = useCallback(async () => {
    if (!supabase || !mission || !studentId || !attemptId || !question) return;
    const draft = readKidJoinDraft();
    if (!draft) return;
    const qk = `${question.a}|${question.b}|${question.op}`;
    if (helpSentForQuestionKey === qk && helpRequestId) return;
    setHelpSending(true);
    setSubmitError(null);
    const { data, error } = await supabase
      .from("student_help_requests")
      .insert({
        student_id: studentId,
        class_id: draft.classId,
        mission_id: mission.id,
        attempt_id: attemptId,
        question_key: qk,
        status: "pending",
      })
      .select("id")
      .single();
    setHelpSending(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (data?.id) {
      setHelpRequestId(data.id as string);
      setHelpSentForQuestionKey(qk);
    }
  }, [
    supabase,
    mission,
    studentId,
    attemptId,
    question,
    helpSentForQuestionKey,
    helpRequestId,
  ]);

  useEffect(() => {
    if (!supabase || !missionId) return;

    const draft = readKidJoinDraft();
    if (!draft) {
      router.replace("/");
      return;
    }
    const att = draft.activeMissionAttempt;
    if (!att || att.missionId !== missionId) {
      router.replace("/missies");
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
      const { data: row, error } = await supabase.from("missions").select("*").eq("id", missionId).maybeSingle();
      if (cancelled) return;
      if (error || !row) {
        router.replace("/missies");
        return;
      }
      const m = row as MissionRow;
      if (m.class_id !== draft.classId) {
        router.replace("/missies");
        return;
      }
      const { data: allMiss } = await supabase
        .from("missions")
        .select("id, difficulty, created_at")
        .eq("class_id", draft.classId);
      if (cancelled) return;
      const sorted = sortMissionsByDifficultyThenCreated(
        (allMiss || []) as { id: string; difficulty?: string; created_at: string }[]
      );
      if (!isMissionUnlockedForKid(m, sorted, draft.missionCompletions)) {
        router.replace("/missies");
        return;
      }
      setMission(m);
      setAttemptId(att.attemptId);
      setStudentId(draft.studentId);
      setCompletionRunPct(null);
      usedQuestionKeysRef.current = new Set();
      startQuestion(m);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, router, missionId, startQuestion]);

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !mission || !studentId || !attemptId || !question || missionComplete) return;
    const parsed = parseInt(answerInput.trim(), 10);
    if (Number.isNaN(parsed)) return;

    const isCorrect = parsed === question.answer;

    const row = {
      mission_id: mission.id,
      student_id: studentId,
      attempt_id: attemptId,
      a: question.a,
      b: question.b,
      op: question.op,
      user_answer: parsed,
      is_correct: isCorrect,
    };

    const rpcMissing = (msg: string, code: string | undefined) =>
      msg.includes("Could not find the function") ||
      msg.includes("schema cache") ||
      code === "PGRST202" ||
      code === "42883";

    let ae = (
      await supabase.rpc("submit_mission_answer", {
        p_mission_id: row.mission_id,
        p_student_id: row.student_id,
        p_attempt_id: row.attempt_id,
        p_a: row.a,
        p_b: row.b,
        p_op: row.op,
        p_user_answer: row.user_answer,
        p_is_correct: row.is_correct,
      })
    ).error;

    if (ae && rpcMissing(ae.message ?? "", ae.code)) {
      const ins = await supabase.from("answers").insert(row);
      ae = ins.error;
    }

    if (ae) {
      console.error("save answer failed", ae.message, ae.code, ae.details, ae.hint);
      setSubmitError(ae.message || t("answerSaveError"));
      return;
    }
    setSubmitError(null);

    const nextTotal = totalAnswered + 1;
    setTotalAnswered(nextTotal);

    if (isCorrect) {
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      setFeedback("correct");
      playSuccessBeep();
      if (nextCorrect >= targetCorrect) {
        const pct =
          nextTotal > 0 ? Math.min(100, Math.round((nextCorrect / nextTotal) * 100)) : 100;
        setCompletionRunPct(pct);
        setMissionComplete(true);
        const draft = readKidJoinDraft();
        if (draft) {
          writeKidJoinDraft(recordMissionCompletion(draft, mission.id, pct));
        }
      } else {
        window.setTimeout(() => {
          startQuestion(mission, questionDedupeKey(question));
        }, 650);
      }
    } else {
      setWrongStreak((w) => w + 1);
      setFeedback("wrong");
    }
  };

  if (!supabase) return <SetupRequired />;

  if (!missionId || !ready || !mission || !question) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-950 px-4 text-cyan-200">
        <p>{t("loading")}</p>
      </div>
    );
  }

  const teacherOnWayCardTitle = (() => {
    const draft = readKidJoinDraft();
    const name = teacherCallName(draft?.teacherDisplayName);
    const addr = draft?.teacherAddressAs;
    if (!name) return t("practiceTeacherOnWayCardGeneric");
    if (addr === "meester") return t("practiceTeacherOnWayCardMeester", { name });
    if (addr === "juf") return t("practiceTeacherOnWayCardJuf", { name });
    return t("practiceTeacherOnWayCard", { name });
  })();

  const teacherHelpButtonLabel = (() => {
    const draft = readKidJoinDraft();
    const name = teacherCallName(draft?.teacherDisplayName);
    if (!name) return t("practiceAskHelpGeneric");
    const addr = draft?.teacherAddressAs;
    if (addr === "meester") {
      const salutation = `${t("teacherAddressMeester")} ${name}`;
      return t("practiceAskHelp", { name: salutation });
    }
    if (addr === "juf") {
      const salutation = `${t("teacherAddressJuf")} ${name}`;
      return t("practiceAskHelp", { name: salutation });
    }
    return t("practiceAskHelp", { name });
  })();

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-slate-950">
      <SpacePracticeBackdrop />

      {teacherOnWay && !teacherOnWayBannerDismissed && !missionComplete ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-live="assertive"
          aria-labelledby="teacher-on-way-title"
          aria-describedby="teacher-on-way-sub"
        >
          <div className="w-full max-w-lg rounded-[2rem] border-[6px] border-emerald-400 bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 p-8 shadow-[0_0_0_4px_rgba(16,185,129,0.25),0_24px_80px_rgba(0,0,0,0.45)] sm:p-12">
            <p
              id="teacher-on-way-title"
              className="text-center text-3xl font-black leading-[1.15] tracking-tight text-white sm:text-4xl md:text-5xl"
            >
              {teacherOnWayCardTitle}
            </p>
            <p
              id="teacher-on-way-sub"
              className="mt-6 text-center text-xl font-bold text-emerald-50 sm:text-2xl md:text-3xl"
            >
              {t("practiceTeacherOnWayCardSub")}
            </p>
            <button
              type="button"
              onClick={() => setTeacherOnWayBannerDismissed(true)}
              className="mt-8 w-full rounded-2xl border-4 border-white/90 bg-white py-4 text-xl font-black tracking-wide text-emerald-900 shadow-[0_8px_0_rgb(6,78,59),0_12px_32px_rgba(0,0,0,0.35)] transition hover:brightness-105 active:translate-y-1 active:shadow-[0_4px_0_rgb(6,78,59)] sm:mt-10 sm:py-5 sm:text-2xl"
            >
              {t("practiceTeacherOnWayOk")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 h-2 w-full shrink-0 bg-slate-800/90 shadow-[0_1px_0_rgba(34,211,238,0.15)]">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-500"
          style={{ width: `${missionComplete ? 100 : progress}%` }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
        {missionComplete ? (
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/35 bg-slate-950/85 p-5 text-center shadow-[0_0_40px_rgba(34,211,238,0.12)] backdrop-blur-md sm:p-6">
            <p className="text-3xl font-black text-white">{t("missionCompleteTitle")}</p>
            <p className="mt-2 text-cyan-100/90">{t("missionCompleteBody")}</p>
            {completionRunPct != null ? (
              <p
                className={`mt-3 text-2xl font-black tabular-nums ${completionRunPct > 50 ? "text-emerald-300" : "text-amber-300"}`}
              >
                {t("missionSuccessPct", { pct: completionRunPct })}
              </p>
            ) : null}
            {completionRunPct != null && completionRunPct <= 50 ? (
              <>
                <div className="mt-4 rounded-2xl border-2 border-amber-400/55 bg-gradient-to-br from-amber-950/70 to-slate-900/80 px-4 py-4 text-left shadow-[0_0_24px_rgba(251,191,36,0.15)]">
                  <p className="text-sm font-semibold leading-snug text-amber-50">
                    {t("missionLowScoreHint", { pct: completionRunPct })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => retryMission()}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 py-4 text-lg font-black text-slate-950 shadow-[0_8px_28px_rgba(251,191,36,0.35)] transition hover:brightness-110 sm:py-4"
                >
                  {t("missionRetryButton")}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => {
                router.push("/missies");
              }}
              className={`mt-5 w-full rounded-2xl py-3.5 font-black text-slate-950 sm:mt-6 sm:py-4 ${
                completionRunPct != null && completionRunPct <= 50
                  ? "border-2 border-cyan-400/50 bg-slate-800 text-cyan-100 hover:bg-slate-700"
                  : "bg-cyan-500 hover:bg-cyan-400"
              }`}
            >
              {t("missionBackToList")}
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row md:items-center md:gap-10 lg:gap-14">
            <div className="flex flex-col items-center md:w-[40%] md:max-w-sm md:shrink-0">
              <SpeechBubble label={t("astroNovaName")} text={coachText} />
              <AstronautCharacter
                variant="nova"
                mood={coachMood === "idle" ? "idle" : coachMood}
                className="mt-3 scale-95 sm:mt-4 sm:scale-100"
              />
            </div>

            <div className="flex w-full max-w-md flex-1 flex-col items-center text-center">
              {submitError ? (
                <p
                  className="mb-3 w-full rounded-xl border border-red-400/50 bg-red-950/60 px-3 py-2 text-sm text-red-100"
                  role="alert"
                >
                  {submitError}
                </p>
              ) : null}
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-200/80">
                {t("progressLabelShort")}: {progress}%
              </p>
              <p className="text-4xl font-black tabular-nums text-white sm:text-5xl" aria-live="polite">
                {formatQuestion(question)}
              </p>

              <form
                onSubmit={
                  feedback === "wrong"
                    ? (ev) => {
                        ev.preventDefault();
                        setFeedback("idle");
                        setAnswerInput("");
                      }
                    : (e) => void submitAnswer(e)
                }
                className="mt-6 w-full space-y-3 sm:mt-8 sm:space-y-4"
              >
                {feedback !== "wrong" ? (
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="w-full rounded-2xl border-2 border-slate-600/80 bg-slate-900/85 px-4 py-5 text-center text-3xl font-bold text-white shadow-inner outline-none ring-cyan-400/30 backdrop-blur-sm focus:border-cyan-400 focus:ring-4"
                      value={answerInput}
                      onChange={(e) => setAnswerInput(e.target.value)}
                      placeholder={t("answerPlaceholder")}
                      autoFocus
                      aria-label={t("answerPlaceholder")}
                    />
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 py-4 text-xl font-black text-slate-950 shadow-[0_4px_24px_rgba(34,211,238,0.25)] transition hover:brightness-110"
                    >
                      {t("check")}
                    </button>
                  </>
                ) : (
                  <div className="w-full space-y-3">
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-slate-700 py-4 text-lg font-bold text-white hover:bg-slate-600"
                    >
                      OK
                    </button>
                    {wrongStreak >= WRONG_BEFORE_HELP ? (
                      <div className="rounded-2xl border border-amber-400/40 bg-amber-950/35 px-4 py-3 text-left text-sm text-amber-50">
                        <p className="font-semibold text-amber-100">{t("practiceHelpAfterWrong")}</p>
                        {helpSentForQuestionKey === questionKey ? (
                          <p className="mt-2 text-amber-100/95">
                            {teacherOnWay ? null : (
                              <>
                                {t("practiceHelpSent")} {t("practiceHelpWait")}
                              </>
                            )}
                          </p>
                        ) : (
                          <button
                            type="button"
                            disabled={helpSending}
                            onClick={() => void sendHelpRequest()}
                            className="mt-3 w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950 hover:bg-amber-300 disabled:opacity-50"
                          >
                            {helpSending ? t("practiceHelpSending") : teacherHelpButtonLabel}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OefenenPage() {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-1 items-center justify-center bg-slate-950 px-4 text-cyan-200">
          <p>{t("loading")}</p>
        </div>
      }
    >
      <OefenenInner />
    </Suspense>
  );
}
