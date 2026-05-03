const STORAGE_KEY = "wiskunde_kid_join_v2";

export type TeacherAddressAs = "meester" | "juf";

/** Eerste woord van de weergavenaam (voornaam voor leerlingen). */
export function teacherCallName(display?: string): string {
  const s = (display ?? "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] ?? s;
}

export type MissionCompletionEntry = {
  successPct: number;
  completedAt: string;
};

export type KidJoinDraft = {
  classId: string;
  classLabel: string;
  schoolName: string;
  firstName: string;
  studentId: string;
  /** Van find_classes (teacher_name); gebruikt voor hulpteksten tijdens oefenen. */
  teacherDisplayName?: string;
  /** Van find_classes (teacher_address_as). */
  teacherAddressAs?: TeacherAddressAs;
  /** Set on intro when starting a mission practice run */
  activeMissionAttempt?: { missionId: string; attemptId: string };
  /** Last finished run per mission (used on /missies) */
  missionCompletions?: Record<string, MissionCompletionEntry>;
};

function migrateSessionToLocalIfNeeded(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const legacy = sessionStorage.getItem(STORAGE_KEY);
    if (!legacy) return;
    localStorage.setItem(STORAGE_KEY, legacy);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Clears active attempt and stores success % for the missions list. */
export function recordMissionCompletion(
  draft: KidJoinDraft,
  missionId: string,
  successPct: number
): KidJoinDraft {
  return {
    classId: draft.classId,
    classLabel: draft.classLabel,
    schoolName: draft.schoolName,
    firstName: draft.firstName,
    studentId: draft.studentId,
    teacherDisplayName: draft.teacherDisplayName,
    teacherAddressAs: draft.teacherAddressAs,
    missionCompletions: {
      ...(draft.missionCompletions ?? {}),
      [missionId]: { successPct, completedAt: new Date().toISOString() },
    },
  };
}

export function readKidJoinDraft(): KidJoinDraft | null {
  if (typeof window === "undefined") return null;
  try {
    migrateSessionToLocalIfNeeded();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as KidJoinDraft;
    if (!data.classId || !data.firstName || !data.studentId) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeKidJoinDraft(draft: KidJoinDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearKidJoinDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
