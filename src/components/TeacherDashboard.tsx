"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import { MissionPlanet } from "@/components/missions/MissionPlanet";
import type { AnswerRow, ClassRow, MissionRow, MissionDifficulty, StudentRow, TeacherProfileRow } from "@/lib/db";
import { teacherCallName } from "@/lib/kid-session";
import {
  difficultyOrderIndex,
  normalizeMissionDifficulty,
  sortMissionsByDifficultyThenCreated,
} from "@/lib/missions";
import { getSupabase } from "@/lib/supabase/client";
import { formatQuestion, formatQuestionKeyLabel, type OperationMode, type Question } from "@/lib/math";

type AttemptStat = {
  key: string;
  missionId: string;
  studentName: string;
  missionTitle: string;
  started: string;
  ended: string;
  correct: number;
  total: number;
};

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

type AnswerDetailRow = {
  id: string;
  created_at: string;
  studentName: string;
  missionTitle: string;
  a: number;
  b: number;
  op: string;
  user_answer: number;
  is_correct: boolean;
};

function questionLabel(a: number, b: number, op: string): string {
  const q = { a, b, op: op as Question["op"], answer: 0 };
  return formatQuestion(q);
}

function aggregateAttempts(
  answers: AnswerRow[],
  studentNames: Map<string, string>,
  missionTitles: Map<string, string>
): AttemptStat[] {
  const groups = new Map<string, AnswerRow[]>();
  for (const a of answers) {
    const k = `${a.student_id}:${a.mission_id}:${a.attempt_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  const out: AttemptStat[] = [];
  for (const [key, rows] of groups) {
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const correct = rows.filter((r) => r.is_correct).length;
    out.push({
      key,
      missionId: rows[0].mission_id,
      studentName: studentNames.get(rows[0].student_id) ?? "—",
      missionTitle: missionTitles.get(rows[0].mission_id) ?? "—",
      started: rows[0].created_at,
      ended: rows[rows.length - 1].created_at,
      correct,
      total: rows.length,
    });
  }
  return out.sort((a, b) => b.started.localeCompare(a.started));
}

type StudentMissionCell = {
  pct: number;
  correct: number;
  total: number;
};

type StudentMissionSummaryRow = {
  studentId: string;
  studentName: string;
  byMission: Record<string, StudentMissionCell | null>;
};

type ModalMissionCol = { id: string; title: string };

type PendingHelpItem = {
  id: string;
  created_at: string;
  classLabel: string;
  studentName: string;
  missionTitle: string;
  questionKey: string;
};

/** Latest attempt per (student, mission) by last answer time. */
function buildLatestAttemptMatrix(
  classStudents: { id: string; first_name: string }[],
  missionList: ModalMissionCol[],
  answers: AnswerRow[]
): StudentMissionSummaryRow[] {
  const groups = new Map<string, AnswerRow[]>();
  for (const a of answers) {
    const k = `${a.student_id}|${a.mission_id}|${a.attempt_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  type Agg = {
    studentId: string;
    missionId: string;
    correct: number;
    total: number;
    ended: string;
  };
  const aggs: Agg[] = [];
  for (const rows of groups.values()) {
    rows.sort((x, y) => x.created_at.localeCompare(y.created_at));
    const first = rows[0];
    const correct = rows.filter((r) => r.is_correct).length;
    aggs.push({
      studentId: first.student_id,
      missionId: first.mission_id,
      correct,
      total: rows.length,
      ended: rows[rows.length - 1].created_at,
    });
  }
  const latest = new Map<string, Agg>();
  for (const a of aggs) {
    const smKey = `${a.studentId}|${a.missionId}`;
    const prev = latest.get(smKey);
    if (!prev || a.ended.localeCompare(prev.ended) > 0) latest.set(smKey, a);
  }
  return classStudents.map((st) => {
    const byMission: Record<string, StudentMissionCell | null> = {};
    for (const m of missionList) {
      const agg = latest.get(`${st.id}|${m.id}`);
      if (!agg) byMission[m.id] = null;
      else
        byMission[m.id] = {
          pct: agg.total ? Math.round((100 * agg.correct) / agg.total) : 0,
          correct: agg.correct,
          total: agg.total,
        };
    }
    return { studentId: st.id, studentName: st.first_name, byMission };
  });
}

export function TeacherDashboard() {
  const { t } = useLocale();
  const supabase = useMemo(() => getSupabase(), []);

  const [profile, setProfile] = useState<TeacherProfileRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [attemptStats, setAttemptStats] = useState<AttemptStat[]>([]);
  const [classRoster, setClassRoster] = useState<StudentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newClassLabel, setNewClassLabel] = useState("");
  const [newClassMaxStudents, setNewClassMaxStudents] = useState(30);
  const [classStudentCounts, setClassStudentCounts] = useState<Record<string, number>>({});
  const [newMissionTitle, setNewMissionTitle] = useState("");
  const [maxNumber, setMaxNumber] = useState<10 | 20 | 100>(20);
  const [operationMode, setOperationMode] = useState<OperationMode>("both");
  const [targetCorrect, setTargetCorrect] = useState(20);
  const [newMissionDifficulty, setNewMissionDifficulty] = useState<MissionDifficulty>("easy");
  const [busy, setBusy] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountEditMode, setAccountEditMode] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editAddressAs, setEditAddressAs] = useState<"meester" | "juf">("juf");
  const [editSchool, setEditSchool] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [accountFormMessage, setAccountFormMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [accountSaveBusy, setAccountSaveBusy] = useState(false);

  const [answersModalOpen, setAnswersModalOpen] = useState(false);
  const [answersModalStep, setAnswersModalStep] = useState<"pick-class" | "matrix" | "detail">("pick-class");
  const [answersModalClassId, setAnswersModalClassId] = useState<string | null>(null);
  const [answersModalMissions, setAnswersModalMissions] = useState<ModalMissionCol[]>([]);
  const [answersSummaryRows, setAnswersSummaryRows] = useState<StudentMissionSummaryRow[]>([]);
  const [answersModalAnswersCache, setAnswersModalAnswersCache] = useState<AnswerRow[]>([]);
  const [answersModalDetailStudentId, setAnswersModalDetailStudentId] = useState<string | null>(null);
  const [answersModalDetailStudentName, setAnswersModalDetailStudentName] = useState("");
  const [answersDetailLoading, setAnswersDetailLoading] = useState(false);
  const [answersDetailError, setAnswersDetailError] = useState<string | null>(null);

  const [allMissionsOverview, setAllMissionsOverview] = useState<
    (MissionRow & { classLabel: string })[]
  >([]);
  const [allMissionsOverviewLoading, setAllMissionsOverviewLoading] = useState(false);
  const [missionResultsFilterId, setMissionResultsFilterId] = useState<string | null>(null);
  const [pendingHelpRequests, setPendingHelpRequests] = useState<PendingHelpItem[]>([]);
  const [helpAckBusyId, setHelpAckBusyId] = useState<string | null>(null);

  /** Zelfde zin als op het leerlingenscherm bij «komt helpen» (voornaam + meester/juf). */
  const studentHelpPreviewLine = useMemo(() => {
    if (!profile) return "";
    const first = teacherCallName(profile.full_name ?? "");
    const addr = profile.address_as === "meester" ? "meester" : "juf";
    if (!first) return t("practiceTeacherOnWayCardGeneric");
    if (addr === "meester") return t("practiceTeacherOnWayCardMeester", { name: first });
    return t("practiceTeacherOnWayCardJuf", { name: first });
  }, [profile, t]);

  const studentHelpPreviewLineFromForm = useMemo(() => {
    const first = teacherCallName(editFullName);
    const addr = editAddressAs === "meester" ? "meester" : "juf";
    if (!first) return t("practiceTeacherOnWayCardGeneric");
    if (addr === "meester") return t("practiceTeacherOnWayCardMeester", { name: first });
    return t("practiceTeacherOnWayCardJuf", { name: first });
  }, [editFullName, editAddressAs, t]);

  const loadPendingHelpRequests = useCallback(async () => {
    if (!supabase || classes.length === 0) {
      setPendingHelpRequests([]);
      return;
    }
    const classIds = classes.map((c) => c.id);
    const { data, error } = await supabase
      .from("student_help_requests")
      .select(
        "id, created_at, question_key, class_id, students ( first_name ), missions ( title ), classes ( label )"
      )
      .eq("status", "pending")
      .in("class_id", classIds)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    const pickStr = (v: unknown, field: string): string => {
      if (v == null) return "—";
      const one = Array.isArray(v) ? v[0] : v;
      if (!one || typeof one !== "object") return "—";
      const val = (one as Record<string, unknown>)[field];
      return typeof val === "string" && val ? val : "—";
    };
    setPendingHelpRequests(
      (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ""),
        created_at: String(row.created_at ?? ""),
        classLabel: pickStr(row.classes, "label"),
        studentName: pickStr(row.students, "first_name"),
        missionTitle: pickStr(row.missions, "title"),
        questionKey: String(row.question_key ?? ""),
      }))
    );
  }, [supabase, classes]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadPendingHelpRequests();
    });
  }, [loadPendingHelpRequests]);

  useEffect(() => {
    if (!supabase || classes.length === 0) return;
    const classSet = new Set(classes.map((c) => c.id));
    const channel = supabase
      .channel("teacher-student-help")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "student_help_requests" },
        (payload) => {
          const cid = (payload.new as { class_id?: string }).class_id;
          if (cid && classSet.has(cid)) void loadPendingHelpRequests();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "student_help_requests" },
        (payload) => {
          const cid = (payload.new as { class_id?: string }).class_id;
          if (cid && classSet.has(cid)) void loadPendingHelpRequests();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, classes, loadPendingHelpRequests]);

  const acknowledgeHelpRequest = async (id: string) => {
    if (!supabase) return;
    setHelpAckBusyId(id);
    try {
      const { error } = await supabase
        .from("student_help_requests")
        .update({
          status: "on_way",
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      await loadPendingHelpRequests();
    } catch (e) {
      console.error(e);
    } finally {
      setHelpAckBusyId(null);
    }
  };

  const loadProfileAndClasses = useCallback(async () => {
    if (!supabase) return;
    setLoadError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    setTeacherEmail(userData.user.email ?? null);

    const { data: profInit, error: pe } = await supabase.from("teacher_profiles").select("*").maybeSingle();
    if (pe) {
      setLoadError(pe.message);
      return;
    }
    let prof = profInit;
    if (!prof && userData.user) {
      const { error: insE } = await supabase.from("teacher_profiles").insert({
        user_id: userData.user.id,
        full_name: "",
        school_name: "",
      });
      if (insE) {
        setLoadError(insE.message);
        return;
      }
      const r2 = await supabase.from("teacher_profiles").select("*").maybeSingle();
      prof = r2.data;
    }
    if (prof) setProfile(prof as TeacherProfileRow);

    const teacherId = (prof as TeacherProfileRow | null)?.id;
    if (!teacherId) return;

    const { data: cls, error: ce } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("label");
    if (ce) {
      setLoadError(ce.message);
      return;
    }
    const classList = (cls || []) as ClassRow[];
    setClasses(classList);
    const ids = classList.map((c) => c.id);
    if (ids.length === 0) {
      setClassStudentCounts({});
      return;
    }
    const { data: studs, error: se } = await supabase.from("students").select("class_id").in("class_id", ids);
    if (se) {
      setClassStudentCounts({});
      return;
    }
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = 0;
    for (const s of studs || []) {
      const cid = (s as { class_id: string }).class_id;
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
    setClassStudentCounts(counts);
  }, [supabase]);

  const loadAllMissionsOverview = useCallback(async () => {
    if (!supabase || classes.length === 0) {
      setAllMissionsOverview([]);
      return;
    }
    setAllMissionsOverviewLoading(true);
    try {
      const ids = classes.map((c) => c.id);
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .in("class_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const labelById = new Map(classes.map((c) => [c.id, c.label]));
      const mapped = (data || []).map((row) => {
        const m = row as MissionRow;
        return { ...m, classLabel: labelById.get(m.class_id) ?? "—" };
      });
      mapped.sort((a, b) => {
        const cl = (a.classLabel ?? "").localeCompare(b.classLabel ?? "");
        if (cl !== 0) return cl;
        const da = difficultyOrderIndex(normalizeMissionDifficulty(a.difficulty));
        const db = difficultyOrderIndex(normalizeMissionDifficulty(b.difficulty));
        if (da !== db) return da - db;
        return a.created_at.localeCompare(b.created_at);
      });
      setAllMissionsOverview(mapped);
    } catch {
      setAllMissionsOverview([]);
    } finally {
      setAllMissionsOverviewLoading(false);
    }
  }, [supabase, classes]);

  const loadMissionsAndStats = useCallback(
    async (classId: string) => {
      if (!supabase) return;
      setLoadError(null);
      const { data: rosterData, error: rosterErr } = await supabase
        .from("students")
        .select("id, first_name, auth_user_id, created_at, class_id")
        .eq("class_id", classId)
        .order("first_name");
      if (rosterErr) {
        setLoadError(rosterErr.message);
        setClassRoster([]);
        return;
      }
      setClassRoster((rosterData || []) as StudentRow[]);

      const { data: miss, error: me } = await supabase
        .from("missions")
        .select("*")
        .eq("class_id", classId)
        .order("created_at");
      if (me) {
        setLoadError(me.message);
        return;
      }
      const mrows = sortMissionsByDifficultyThenCreated((miss || []) as MissionRow[]);
      setMissions(mrows);
      const missionIds = mrows.map((m) => m.id);
      if (missionIds.length === 0) {
        setAttemptStats([]);
        return;
      }

      const { data: ans, error: ae } = await supabase
        .from("answers")
        .select("*")
        .in("mission_id", missionIds);
      if (ae) {
        setLoadError(ae.message);
        return;
      }
      const answers = (ans || []) as AnswerRow[];
      const studentIds = [...new Set(answers.map((a) => a.student_id))];
      const { data: studs } = await supabase.from("students").select("id, first_name").in("id", studentIds);
      const snames = new Map((studs || []).map((s) => [s.id as string, s.first_name as string]));
      const mtitles = new Map(mrows.map((m) => [m.id, m.title]));
      setAttemptStats(aggregateAttempts(answers, snames, mtitles));
    },
    [supabase]
  );

  const loadAnswersClassSummary = useCallback(
    async (classId: string): Promise<boolean> => {
      if (!supabase) return false;
      setAnswersDetailLoading(true);
      setAnswersDetailError(null);
      try {
        const { data: studs, error: se } = await supabase
          .from("students")
          .select("id,first_name")
          .eq("class_id", classId)
          .order("first_name");
        if (se) throw se;
        const classStudents = (studs || []) as { id: string; first_name: string }[];

        const { data: miss, error: me } = await supabase
          .from("missions")
          .select("id,title")
          .eq("class_id", classId)
          .order("created_at");
        if (me) throw me;
        const missionList: ModalMissionCol[] = (miss || []).map((m) => ({
          id: m.id as string,
          title: m.title as string,
        }));
        const missionIds = missionList.map((m) => m.id);

        if (missionIds.length === 0) {
          setAnswersModalMissions([]);
          setAnswersSummaryRows(buildLatestAttemptMatrix(classStudents, [], []));
          setAnswersModalAnswersCache([]);
          return true;
        }

        const { data: ans, error: ae } = await supabase.from("answers").select("*").in("mission_id", missionIds);
        if (ae) throw ae;
        const answers = (ans || []) as AnswerRow[];

        setAnswersModalMissions(missionList);
        setAnswersSummaryRows(buildLatestAttemptMatrix(classStudents, missionList, answers));
        setAnswersModalAnswersCache(answers);
        return true;
      } catch (err: unknown) {
        setAnswersDetailError(err instanceof Error ? err.message : "Error");
        setAnswersModalMissions([]);
        setAnswersSummaryRows([]);
        setAnswersModalAnswersCache([]);
        return false;
      } finally {
        setAnswersDetailLoading(false);
      }
    },
    [supabase]
  );

  const answersModalDetailRows: AnswerDetailRow[] = useMemo(() => {
    if (!answersModalDetailStudentId) return [];
    const mt = new Map(answersModalMissions.map((m) => [m.id, m.title]));
    return answersModalAnswersCache
      .filter((a) => a.student_id === answersModalDetailStudentId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        id: a.id,
        created_at: a.created_at,
        studentName: answersModalDetailStudentName,
        missionTitle: mt.get(a.mission_id) ?? "—",
        a: a.a,
        b: a.b,
        op: a.op,
        user_answer: a.user_answer,
        is_correct: a.is_correct,
      }));
  }, [
    answersModalDetailStudentId,
    answersModalDetailStudentName,
    answersModalAnswersCache,
    answersModalMissions,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadProfileAndClasses();
    });
  }, [loadProfileAndClasses]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAllMissionsOverview();
    });
  }, [loadAllMissionsOverview]);

  useEffect(() => {
    if (selectedClassId) {
      queueMicrotask(() => void loadMissionsAndStats(selectedClassId));
    } else {
      queueMicrotask(() => {
        setMissions([]);
        setAttemptStats([]);
        setClassRoster([]);
      });
    }
  }, [selectedClassId, loadMissionsAndStats]);

  useEffect(() => {
    if (!supabase || !selectedClassId || missions.length === 0) return;
    const missionIds = missions.map((m) => m.id);
    const channel = supabase
      .channel(`teacher-answers-${selectedClassId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers" },
        (payload) => {
          const mid = (payload.new as { mission_id?: string }).mission_id;
          if (mid && missionIds.includes(mid)) void loadMissionsAndStats(selectedClassId);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, selectedClassId, missions, loadMissionsAndStats]);

  useEffect(() => {
    if (!accountModalOpen && !answersModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (answersModalOpen) {
        if (answersModalStep === "detail") {
          setAnswersModalStep("matrix");
          setAnswersModalDetailStudentId(null);
          setAnswersModalDetailStudentName("");
          return;
        }
        if (answersModalStep === "matrix") {
          setAnswersModalStep("pick-class");
          return;
        }
        setAnswersModalOpen(false);
        setAnswersDetailError(null);
        setAnswersModalStep("pick-class");
        setAnswersModalDetailStudentId(null);
        setAnswersModalDetailStudentName("");
        return;
      }
      setAccountModalOpen(false);
      setAccountEditMode(false);
      setAccountFormMessage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountModalOpen, answersModalOpen, answersModalStep]);

  const openAccountEdit = () => {
    setEditEmail(teacherEmail ?? "");
    setEditFullName(profile?.full_name ?? "");
    setEditAddressAs(profile?.address_as === "meester" ? "meester" : "juf");
    setEditSchool(profile?.school_name ?? "");
    setEditPassword("");
    setEditPasswordConfirm("");
    setAccountFormMessage(null);
    setAccountEditMode(true);
  };

  const closeAccountModal = () => {
    setAccountModalOpen(false);
    setAccountEditMode(false);
    setAccountFormMessage(null);
  };

  const saveAccountDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    setAccountFormMessage(null);

    const emailTrim = editEmail.trim();
    const nameTrim = editFullName.trim();
    const schoolTrim = editSchool.trim();

    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setAccountFormMessage({ kind: "err", text: t("emailInvalid") });
      return;
    }

    if (editPassword || editPasswordConfirm) {
      if (editPassword !== editPasswordConfirm) {
        setAccountFormMessage({ kind: "err", text: t("passwordMismatch") });
        return;
      }
      if (editPassword.length < 6) {
        setAccountFormMessage({ kind: "err", text: t("passwordTooShort") });
        return;
      }
    }

    const addr: "meester" | "juf" = editAddressAs === "meester" ? "meester" : "juf";

    setAccountSaveBusy(true);
    try {
      const { error: pu } = await supabase
        .from("teacher_profiles")
        .update({ full_name: nameTrim, school_name: schoolTrim, address_as: addr })
        .eq("id", profile.id);
      if (pu) throw pu;

      const emailChanged = emailTrim !== (teacherEmail ?? "");
      if (emailChanged) {
        const { error: eu } = await supabase.auth.updateUser({ email: emailTrim });
        if (eu) throw eu;
        setTeacherEmail(emailTrim);
      }

      if (editPassword) {
        const { error: pw } = await supabase.auth.updateUser({ password: editPassword });
        if (pw) throw pw;
      }

      setProfile({
        ...profile,
        full_name: nameTrim,
        school_name: schoolTrim,
        address_as: addr,
      });
      setEditPassword("");
      setEditPasswordConfirm("");
      setAccountEditMode(false);
      setAccountFormMessage({ kind: "ok", text: t("profileSaved") });
      if (emailChanged) {
        setAccountFormMessage({
          kind: "ok",
          text: `${t("profileSaved")} ${t("emailChangeNote")}`,
        });
      }
      await loadProfileAndClasses();
    } catch (err: unknown) {
      setAccountFormMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setAccountSaveBusy(false);
    }
  };

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    const label = newClassLabel.trim();
    if (!label) return;
    setBusy(true);
    setLoadError(null);
    try {
      const cap = Math.min(500, Math.max(1, newClassMaxStudents));
      const { error } = await supabase.from("classes").insert({
        teacher_id: profile.id,
        label,
        max_students: cap,
      });
      if (error) throw error;
      setNewClassLabel("");
      setNewClassMaxStudents(30);
      await loadProfileAndClasses();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const deleteClass = async (c: ClassRow) => {
    if (!supabase || !profile) return;
    if (!window.confirm(t("teacherDeleteClassConfirm", { label: c.label }))) return;
    setBusy(true);
    setLoadError(null);
    try {
      const { error } = await supabase.from("classes").delete().eq("id", c.id);
      if (error) throw error;
      if (selectedClassId === c.id) setSelectedClassId(null);
      await loadProfileAndClasses();
      await loadAllMissionsOverview();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const deleteStudentFromClass = async (student: StudentRow) => {
    if (!supabase || !selectedClassId) return;
    if (!window.confirm(t("teacherDeleteStudentConfirm", { name: student.first_name }))) return;
    setBusy(true);
    setLoadError(null);
    try {
      const { error } = await supabase.from("students").delete().eq("id", student.id);
      if (error) throw error;
      await loadMissionsAndStats(selectedClassId);
      await loadProfileAndClasses();
      await loadAllMissionsOverview();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const addMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedClassId) return;
    const title = newMissionTitle.trim();
    if (!title) return;
    setBusy(true);
    setLoadError(null);
    try {
      const { error } = await supabase.from("missions").insert({
        class_id: selectedClassId,
        title,
        max_number: maxNumber,
        operation_mode: operationMode,
        target_correct: Math.min(200, Math.max(1, targetCorrect)),
        difficulty: newMissionDifficulty,
      });
      if (error) throw error;
      setNewMissionTitle("");
      await loadMissionsAndStats(selectedClassId);
      await loadAllMissionsOverview();
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/teacher/login";
  };

  const missionFilterActive = useMemo(() => {
    if (!missionResultsFilterId || missions.length === 0) return null;
    return missions.some((m) => m.id === missionResultsFilterId) ? missionResultsFilterId : null;
  }, [missions, missionResultsFilterId]);

  const filteredAttemptStats = useMemo(() => {
    if (!missionFilterActive) return attemptStats;
    return attemptStats.filter((s) => s.missionId === missionFilterActive);
  }, [attemptStats, missionFilterActive]);

  const exportCsv = () => {
    const header = [
      escapeCsvCell(t("nameCol")),
      escapeCsvCell(t("colMission")),
      escapeCsvCell(t("colStarted")),
      escapeCsvCell(t("colEnded")),
      escapeCsvCell(t("correctCol")),
      escapeCsvCell(t("totalCol")),
      escapeCsvCell(t("percentCol")),
    ].join(",");
    const rows = filteredAttemptStats.map((s) => {
      const pct = s.total ? Math.round((100 * s.correct) / s.total) : 0;
      return [
        escapeCsvCell(s.studentName),
        escapeCsvCell(s.missionTitle),
        escapeCsvCell(s.started),
        escapeCsvCell(s.ended),
        s.correct,
        s.total,
        pct,
      ].join(",");
    });
    const csv = [header, ...rows].join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wiskunde-resultaten.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeAnswersModal = () => {
    setAnswersModalOpen(false);
    setAnswersDetailError(null);
    setAnswersModalStep("pick-class");
    setAnswersModalDetailStudentId(null);
    setAnswersModalDetailStudentName("");
  };

  const openStudentDetail = (studentId: string, studentName: string) => {
    setAnswersModalDetailStudentId(studentId);
    setAnswersModalDetailStudentName(studentName);
    setAnswersModalStep("detail");
  };

  const missionPctCellClass = (pct: number | null) => {
    if (pct === null) return "text-slate-400";
    if (pct >= 70) return "font-bold text-emerald-700";
    if (pct >= 40) return "font-bold text-amber-700";
    return "font-bold text-red-700";
  };

  const goToMissionResults = (classId: string, missionId: string) => {
    setSelectedClassId(classId);
    setMissionResultsFilterId(missionId);
    window.setTimeout(() => {
      document.getElementById("teacher-results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  };

  if (!supabase) return <SetupRequired />;

  return (
    <div className="w-full max-w-4xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-indigo-950 sm:text-3xl">{t("teacherHeading")}</h1>
          <p className="text-slate-600">
            {profile?.full_name ? `${profile.full_name} · ` : ""}
            {profile?.school_name || "—"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={classes.length === 0}
            onClick={() => {
              setAnswersModalStep("pick-class");
              setAnswersModalClassId(selectedClassId ?? null);
              setAnswersModalMissions([]);
              setAnswersSummaryRows([]);
              setAnswersModalAnswersCache([]);
              setAnswersModalDetailStudentId(null);
              setAnswersModalDetailStudentName("");
              setAnswersDetailError(null);
              setAnswersModalOpen(true);
            }}
            className="w-full justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {t("teacherStudentAnswersButton")}
          </button>
          <Link
            href="/"
            className="flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 shadow ring-1 ring-slate-200 hover:bg-indigo-50 sm:w-auto"
          >
            {t("kidHome")}
          </Link>
          <button
            type="button"
            onClick={() => setAccountModalOpen(true)}
            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow ring-1 ring-slate-200 hover:bg-slate-50 sm:w-auto"
          >
            {t("accountInfoButton")}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 sm:w-auto"
          >
            {t("teacherLogout")}
          </button>
        </div>
      </header>

      {pendingHelpRequests.length > 0 ? (
        <div
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-4 shadow-lg sm:px-5"
          role="region"
          aria-label={t("teacherHelpAlertsTitle")}
        >
          <h2 className="text-lg font-black text-amber-950">{t("teacherHelpAlertsTitle")}</h2>
          <p className="mt-1 text-sm text-amber-900/90">{t("teacherHelpAlertsSub")}</p>
          <ul className="mt-3 space-y-3">
            {pendingHelpRequests.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white/90 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {t("teacherHelpStudentLine", {
                    student: h.studentName,
                    classLabel: h.classLabel,
                    mission: h.missionTitle,
                    question: formatQuestionKeyLabel(h.questionKey),
                  })}
                </p>
                <button
                  type="button"
                  disabled={helpAckBusyId === h.id}
                  onClick={() => void acknowledgeHelpRequest(h.id)}
                  className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-amber-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {helpAckBusyId === h.id ? t("loading") : t("teacherHelpAck")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answersModalOpen ? (
        <div
          className="fixed inset-0 z-[280] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => closeAnswersModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-answers-title"
            className="flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border-2 border-violet-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 id="student-answers-title" className="text-xl font-black text-indigo-950">
                {answersModalStep === "detail"
                  ? t("teacherAnswersDetailFor", { name: answersModalDetailStudentName })
                  : t("teacherStudentAnswersTitle")}
              </h2>
              {answersModalStep === "pick-class" ? (
                <p className="mt-1 text-sm text-slate-600">{t("teacherStudentAnswersHint")}</p>
              ) : null}
              {answersModalStep === "matrix" ? (
                <p className="mt-1 text-sm text-slate-600">{t("teacherAnswersMatrixHint")}</p>
              ) : null}

              {answersModalStep === "pick-class" ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
                  <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                    <label
                      htmlFor="answers-class-filter"
                      className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      {t("teacherAnswersFilterClass")}
                    </label>
                    <select
                      id="answers-class-filter"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold text-slate-900 outline-none ring-violet-400 focus:ring-4"
                      value={answersModalClassId ?? ""}
                      onChange={(e) => setAnswersModalClassId(e.target.value || null)}
                    >
                      <option value="">{t("teacherAnswersSelectClass")}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!answersModalClassId || answersDetailLoading}
                    onClick={() => {
                      if (!answersModalClassId) return;
                      void (async () => {
                        const ok = await loadAnswersClassSummary(answersModalClassId);
                        if (ok) setAnswersModalStep("matrix");
                      })();
                    }}
                    className="w-full rounded-xl bg-violet-600 px-6 py-3 font-bold text-white hover:bg-violet-700 disabled:opacity-50 sm:w-auto"
                  >
                    {answersDetailLoading ? t("loading") : t("teacherAnswersShowOverview")}
                  </button>
                </div>
              ) : null}

              {answersModalStep === "matrix" ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                  <p className="text-sm font-bold text-slate-800">
                    {classes.find((c) => c.id === answersModalClassId)?.label ?? ""}
                  </p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAnswersModalStep("pick-class")}
                      className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 sm:w-auto"
                    >
                      {t("teacherAnswersChangeClass")}
                    </button>
                    <button
                      type="button"
                      disabled={!answersModalClassId || answersDetailLoading}
                      onClick={() => answersModalClassId && void loadAnswersClassSummary(answersModalClassId)}
                      className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
                    >
                      {answersDetailLoading ? t("loading") : t("teacherAnswersRefresh")}
                    </button>
                  </div>
                </div>
              ) : null}

              {answersModalStep === "detail" ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAnswersModalStep("matrix");
                      setAnswersModalDetailStudentId(null);
                      setAnswersModalDetailStudentName("");
                    }}
                    className="rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2 text-sm font-bold text-violet-900 hover:bg-violet-100"
                  >
                    {t("teacherAnswersBackToOverview")}
                  </button>
                </div>
              ) : null}

              {answersDetailError ? (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
                  {answersDetailError}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2 sm:px-5">
              {answersModalStep === "pick-class" ? null : answersModalStep === "matrix" ? (
                answersDetailLoading && answersSummaryRows.length === 0 && answersModalMissions.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">{t("loading")}</p>
                ) : answersModalMissions.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">{t("noMissionsTeacher")}</p>
                ) : answersSummaryRows.length === 0 ? (
                  <p className="py-8 text-center text-slate-500">{t("noParticipants")}</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="sticky top-0 z-[1] bg-slate-50 shadow-sm">
                        <tr>
                          <th className="min-w-[8rem] px-3 py-3 font-bold text-slate-700">{t("nameCol")}</th>
                          {answersModalMissions.map((m) => (
                            <th
                              key={m.id}
                              className="max-w-[10rem] min-w-[6rem] px-2 py-3 text-center text-xs font-bold leading-tight text-slate-700 sm:text-sm"
                            >
                              {m.title}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {answersSummaryRows.map((row) => (
                          <tr key={row.studentId} className="border-t border-slate-100">
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => openStudentDetail(row.studentId, row.studentName)}
                                className="text-left font-bold text-violet-700 underline decoration-violet-400 underline-offset-2 hover:text-violet-900"
                              >
                                {row.studentName}
                              </button>
                            </td>
                            {answersModalMissions.map((m) => {
                              const cell = row.byMission[m.id];
                              const pct = cell ? cell.pct : null;
                              return (
                                <td key={m.id} className="px-2 py-2.5 text-center tabular-nums">
                                  {cell ? (
                                    <span
                                      className={missionPctCellClass(pct)}
                                      title={`${cell.correct} / ${cell.total}`}
                                    >
                                      {cell.pct}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 shadow-sm">
                      <tr>
                        <th className="px-3 py-3 font-bold text-slate-700">{t("colAnswerTime")}</th>
                        <th className="px-3 py-3 font-bold text-slate-700">{t("colMission")}</th>
                        <th className="px-3 py-3 font-bold text-slate-700">{t("colQuestion")}</th>
                        <th className="px-3 py-3 font-bold text-slate-700">{t("colUserAnswer")}</th>
                        <th className="px-3 py-3 font-bold text-slate-700">{t("colCorrectFlag")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {answersModalDetailRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            {t("noResultsYet")}
                          </td>
                        </tr>
                      ) : (
                        answersModalDetailRows.map((r) => (
                          <tr key={r.id} className="border-t border-slate-100">
                            <td className="px-3 py-2.5 tabular-nums text-slate-600">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-slate-800">{r.missionTitle}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-800">
                              {questionLabel(r.a, r.b, r.op)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-900">
                              {r.user_answer}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={
                                  r.is_correct ? "font-bold text-emerald-700" : "font-bold text-red-600"
                                }
                              >
                                {r.is_correct ? t("answerMarkCorrect") : t("answerMarkWrong")}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => closeAnswersModal()}
                className="w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 sm:w-auto sm:px-8"
              >
                {t("closeDialog")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {accountModalOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => closeAccountModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-info-title"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-indigo-100 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="account-info-title" className="text-xl font-black text-indigo-950">
              {t("accountInfoTitle")}
            </h2>

            {accountFormMessage ? (
              <p
                className={`mt-3 rounded-xl px-3 py-2 text-sm ${
                  accountFormMessage.kind === "ok"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-red-50 text-red-900"
                }`}
                role="status"
              >
                {accountFormMessage.text}
              </p>
            ) : null}

            {!accountEditMode ? (
              <>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="font-bold text-slate-500">{t("email")}</dt>
                    <dd className="mt-1 break-all font-semibold text-slate-900">{teacherEmail ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">{t("fullNameLabel")}</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.full_name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">{t("teacherAddressAsLabel")}</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {profile?.address_as === "meester" ? t("teacherAddressMeester") : t("teacherAddressJuf")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">{t("joinSchool")}</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{profile?.school_name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">{t("accountMemberSince")}</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {profile?.created_at
                        ? new Date(profile.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">{t("accountUserId")}</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-slate-700">{profile?.user_id ?? "—"}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={!profile}
                  onClick={openAccountEdit}
                  className="mt-5 w-full rounded-2xl border-2 border-indigo-200 bg-indigo-50 py-3 font-bold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {t("accountEditButton")}
                </button>
                <button
                  type="button"
                  onClick={() => closeAccountModal()}
                  className="mt-3 w-full rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700"
                >
                  {t("closeDialog")}
                </button>
              </>
            ) : (
              <form onSubmit={(e) => void saveAccountDetails(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-600">{t("email")}</label>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-500">{t("emailChangeNote")}</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600">{t("fullNameLabel")}</label>
                  <input
                    type="text"
                    autoComplete="name"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                  />
                </div>
                <fieldset>
                  <legend className="block text-sm font-bold text-slate-600">{t("teacherAddressAsLabel")}</legend>
                  <p className="mt-1 text-xs text-slate-500">{t("teacherAddressAsHint")}</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="radio"
                        name="editAddressAs"
                        className="h-4 w-4"
                        checked={editAddressAs === "meester"}
                        onChange={() => setEditAddressAs("meester")}
                      />
                      {t("teacherAddressMeester")}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="radio"
                        name="editAddressAs"
                        className="h-4 w-4"
                        checked={editAddressAs === "juf"}
                        onChange={() => setEditAddressAs("juf")}
                      />
                      {t("teacherAddressJuf")}
                    </label>
                  </div>
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2.5">
                    <p className="text-[0.65rem] font-black uppercase tracking-wider text-indigo-600">
                      {t("teacherAccountHelpPreviewCaption")}
                    </p>
                    <p className="mt-1 text-base font-black text-indigo-950">{studentHelpPreviewLineFromForm}</p>
                  </div>
                </fieldset>
                <div>
                  <label className="block text-sm font-bold text-slate-600">{t("joinSchool")}</label>
                  <input
                    type="text"
                    autoComplete="organization"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
                    value={editSchool}
                    onChange={(e) => setEditSchool(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600">{t("newPasswordOptional")}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600">{t("confirmPassword")}</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
                    value={editPasswordConfirm}
                    onChange={(e) => setEditPasswordConfirm(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountEditMode(false);
                      setAccountFormMessage(null);
                    }}
                    className="flex-1 rounded-2xl border-2 border-slate-200 py-3 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    {t("accountCancelEdit")}
                  </button>
                  <button
                    type="submit"
                    disabled={accountSaveBusy}
                    className="flex-1 rounded-2xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {accountSaveBusy ? t("loading") : t("accountSave")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
        {t("teacherStudentLoginHint")}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</div>
      )}

      <section className="rounded-3xl border-2 border-indigo-100 bg-white p-4 shadow-xl sm:p-5">
        <h2 className="text-lg font-black text-slate-900">{t("teacherClasses")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("teacherClassesOverviewHint")}</p>
        <form onSubmit={(e) => void addClass(e)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[10rem] flex-1">
            <label className="block text-xs font-bold text-slate-500">{t("joinClass")}</label>
            <input
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
              value={newClassLabel}
              onChange={(e) => setNewClassLabel(e.target.value)}
              placeholder={t("classLabelPlaceholder")}
            />
          </div>
          <div className="w-full sm:w-36">
            <label className="block text-xs font-bold text-slate-500">{t("classMaxStudentsLabel")}</label>
            <input
              type="number"
              min={1}
              max={500}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 font-semibold outline-none ring-indigo-400 focus:ring-4"
              value={newClassMaxStudents}
              onChange={(e) => setNewClassMaxStudents(Number(e.target.value) || 30)}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !profile}
            className="rounded-2xl bg-indigo-600 px-5 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {t("addClass")}
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">{t("classMaxStudentsHint")}</p>
        <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {classes.map((c) => (
            <li key={c.id} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-stretch">
              <button
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`w-full rounded-2xl px-4 py-2.5 text-left text-sm font-bold shadow sm:w-auto ${
                  selectedClassId === c.id
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {c.label}{" "}
                <span className="font-mono text-xs font-bold opacity-80">
                  ({classStudentCounts[c.id] ?? 0}/{c.max_students ?? 30})
                </span>
              </button>
              <button
                type="button"
                disabled={busy || !profile}
                onClick={() => void deleteClass(c)}
                className="w-full shrink-0 rounded-2xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-50 sm:w-auto"
              >
                {t("teacherDeleteClass")}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedClassId && (
        <>
          <section className="rounded-3xl border-2 border-amber-100 bg-amber-50/40 p-4 shadow-xl sm:p-5">
            <h2 className="text-lg font-black text-slate-900">{t("teacherClassRoster")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("teacherClassRosterHint")}</p>
            {classRoster.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-slate-500">{t("teacherClassRosterEmpty")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-200/80 bg-white">
                <table className="w-full min-w-[20rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                      <th className="px-4 py-3">{t("nameCol")}</th>
                      <th className="px-4 py-3">{t("teacherClassRosterColStatus")}</th>
                      <th className="px-4 py-3 text-right">{t("teacherDeleteStudent")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classRoster.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-900">{s.first_name}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {s.auth_user_id ? t("teacherStudentStatusLoggedIn") : t("teacherStudentStatusNoSession")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteStudentFromClass(s)}
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {t("teacherDeleteStudent")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="rounded-3xl border-2 border-indigo-100 bg-white p-4 shadow-xl sm:p-5">
            <h2 className="text-lg font-black text-slate-900">{t("teacherMissions")}</h2>
            <form onSubmit={(e) => void addMission(e)} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-slate-700">{t("missionTitleLabel")}</label>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none ring-indigo-400 focus:ring-4"
                  value={newMissionTitle}
                  onChange={(e) => setNewMissionTitle(e.target.value)}
                  placeholder={t("missionTitlePlaceholder")}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-slate-700">{t("teacherDifficultyLabel")}</label>
                <p className="mt-1 text-xs text-slate-500">{t("teacherDifficultyHint")}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(["easy", "medium", "hard"] as const).map((d) => {
                    const active = newMissionDifficulty === d;
                    const sub =
                      d === "easy"
                        ? `${t("difficultyEasyTitle")} · ${t("difficultyEasySub")}`
                        : d === "medium"
                          ? `${t("difficultyMediumTitle")} · ${t("difficultyMediumSub")}`
                          : `${t("difficultyHardTitle")} · ${t("difficultyHardSub")}`;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNewMissionDifficulty(d)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition ${
                          active
                            ? "border-indigo-500 bg-indigo-50 shadow-md ring-2 ring-indigo-200"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <MissionPlanet tier={d} size="sm" />
                        <span className="text-[0.7rem] font-bold leading-tight text-slate-800">{sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700">{t("rangeLabel")}</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none ring-indigo-400 focus:ring-4"
                  value={maxNumber}
                  onChange={(e) => setMaxNumber(Number(e.target.value) as 10 | 20 | 100)}
                >
                  <option value={10}>{t("range10")}</option>
                  <option value={20}>{t("range20")}</option>
                  <option value={100}>{t("range100")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700">{t("modeLabel")}</label>
                <select
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none ring-indigo-400 focus:ring-4"
                  value={operationMode}
                  onChange={(e) => setOperationMode(e.target.value as OperationMode)}
                >
                  <option value="add">{t("modeAdd")}</option>
                  <option value="sub">{t("modeSub")}</option>
                  <option value="both">{t("modeBoth")}</option>
                  <option value="mul">{t("modeMul")}</option>
                  <option value="div">{t("modeDiv")}</option>
                  <option value="all">{t("modeAll")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700">{t("targetCorrectLabel")}</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none ring-indigo-400 focus:ring-4"
                  value={targetCorrect}
                  onChange={(e) => setTargetCorrect(Number(e.target.value) || 20)}
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-black text-white shadow-lg hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-8"
                >
                  {t("addMission")}
                </button>
              </div>
            </form>
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {missions.map((m) => {
                const d = normalizeMissionDifficulty(m.difficulty);
                const dLabel =
                  d === "easy"
                    ? t("difficultyEasyTitle")
                    : d === "medium"
                      ? t("difficultyMediumTitle")
                      : t("difficultyHardTitle");
                return (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800"
                  >
                    <MissionPlanet tier={d} size="sm" />
                    <div className="min-w-0 flex-1">
                      <span className="font-black">{m.title}</span>{" "}
                      <span className="font-normal text-slate-500">
                        ({dLabel} · ≤{m.max_number}, {m.operation_mode}, {m.target_correct} ✓)
                      </span>
                    </div>
                  </li>
                );
              })}
              {missions.length === 0 && (
                <li className="text-slate-500">{t("noMissionsTeacher")}</li>
              )}
            </ul>
          </section>

          <section
            id="teacher-results-section"
            className="scroll-mt-4 rounded-3xl border-2 border-violet-100 bg-white p-4 shadow-xl sm:p-5"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-xl font-black text-slate-900">{t("teacherResults")}</h2>
              <button
                type="button"
                onClick={exportCsv}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white shadow hover:bg-emerald-700 sm:w-auto"
              >
                {t("exportCsv")}
              </button>
            </div>
            {missionFilterActive ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span className="min-w-0">
                  {t("teacherResultsFilteredBanner", {
                    mission: missions.find((x) => x.id === missionFilterActive)?.title ?? "",
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setMissionResultsFilterId(null)}
                  className="shrink-0 self-start font-bold text-violet-700 underline underline-offset-2 hover:text-violet-900 sm:self-center"
                >
                  {t("teacherResultsShowAll")}
                </button>
              </div>
            ) : null}
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("nameCol")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("colMission")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("colStarted")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("colEnded")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("correctCol")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("totalCol")}</th>
                    <th className="px-3 py-3 font-bold text-slate-700">{t("percentCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttemptStats.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        {t("noResultsYet")}
                      </td>
                    </tr>
                  ) : (
                    filteredAttemptStats.map((s) => {
                      const pct = s.total ? Math.round((100 * s.correct) / s.total) : 0;
                      const wrong = s.total - s.correct;
                      return (
                        <tr key={s.key} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-semibold text-slate-900">{s.studentName}</td>
                          <td className="px-3 py-3">{s.missionTitle}</td>
                          <td className="px-3 py-3 tabular-nums text-slate-600">
                            {new Date(s.started).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-slate-600">
                            {new Date(s.ended).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-emerald-700">{s.correct}</td>
                          <td className="px-3 py-3 tabular-nums">
                            {s.total}{" "}
                            <span className="text-red-600">
                              ({t("colWrong")}: {wrong})
                            </span>
                          </td>
                          <td className="px-3 py-3 tabular-nums">{pct}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="rounded-3xl border-2 border-indigo-100 bg-white p-4 shadow-xl sm:p-5">
        <h2 className="text-lg font-black text-slate-900">{t("teacherAllMissionsTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("teacherAllMissionsSub")}</p>
        {classes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("noMissionsTeacher")}</p>
        ) : allMissionsOverviewLoading && allMissionsOverview.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-500">{t("loading")}</p>
        ) : allMissionsOverview.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t("noMissionsTeacher")}</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {allMissionsOverview.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => goToMissionResults(m.class_id, m.id)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-3 py-3 text-left transition hover:border-violet-400 hover:bg-violet-50"
                >
                  <MissionPlanet tier={normalizeMissionDifficulty(m.difficulty)} size="sm" className="shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="font-bold text-slate-900">{m.title}</span>
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                      {m.classLabel}
                    </span>
                    <span className="mt-2 text-xs font-bold text-violet-600 underline-offset-2 hover:underline">
                      {t("teacherMissionGoToResults")} →
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
