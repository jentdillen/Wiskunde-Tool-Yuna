"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AstronautCharacter } from "@/components/astronauts/AstronautCharacter";
import { SpeechBubble } from "@/components/astronauts/SpeechBubble";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import type { MissionRow } from "@/lib/db";
import { verifyKidMatchesSession } from "@/lib/kid-auth";
import { clearKidJoinDraft, readKidJoinDraft, recordMissionCompletion, writeKidJoinDraft } from "@/lib/kid-session";
import {
  type OperationMode,
  formatQuestion,
  generateQuestion,
  type Question,
} from "@/lib/math";
import { SpacePracticeBackdrop } from "@/components/SpaceBackdrop";
import { playSuccessBeep } from "@/lib/sound";
import { getSupabase } from "@/lib/supabase/client";

function missionProgress(correct: number, target: number): number {
  return Math.min(100, Math.floor((correct / target) * 100));
}

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const targetCorrect = mission?.target_correct ?? 20;
  const progress = missionProgress(correct, targetCorrect);

  const coachMood = feedback === "correct" ? "happy" : feedback === "wrong" ? "encourage" : "idle";
  let coachText = t("coachReady");
  if (feedback === "correct") coachText = t("coachGood");
  if (feedback === "wrong") coachText = t("coachEncourage");
  if (missionComplete) coachText = t("missionCompleteBody");

  const startQuestion = useCallback((m: MissionRow) => {
    const mode = (m.operation_mode || "both") as OperationMode;
    const q = generateQuestion(m.max_number, mode);
    setQuestion(q);
    setAnswerInput("");
    setFeedback("idle");
    setSubmitError(null);
  }, []);

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
      setMission(m);
      setAttemptId(att.attemptId);
      setStudentId(draft.studentId);
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
        setMissionComplete(true);
        const draft = readKidJoinDraft();
        if (draft) {
          const pct =
            nextTotal > 0 ? Math.min(100, Math.round((nextCorrect / nextTotal) * 100)) : 100;
          writeKidJoinDraft(recordMissionCompletion(draft, mission.id, pct));
        }
      } else {
        window.setTimeout(() => {
          startQuestion(mission);
        }, 650);
      }
    } else {
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

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-slate-950">
      <SpacePracticeBackdrop />

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
            <button
              type="button"
              onClick={() => {
                router.push("/missies");
              }}
              className="mt-5 w-full rounded-2xl bg-cyan-500 py-3.5 font-black text-slate-950 hover:bg-cyan-400 sm:mt-6 sm:py-4"
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
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-slate-700 py-4 text-lg font-bold text-white hover:bg-slate-600"
                  >
                    OK
                  </button>
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
