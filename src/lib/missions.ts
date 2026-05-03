export type MissionDifficulty = "easy" | "medium" | "hard";

export const MISSION_DIFFICULTY_ORDER: MissionDifficulty[] = ["easy", "medium", "hard"];

export function normalizeMissionDifficulty(raw: string | null | undefined): MissionDifficulty {
  if (raw === "medium" || raw === "hard") return raw;
  return "easy";
}

export function difficultyOrderIndex(d: MissionDifficulty): number {
  return MISSION_DIFFICULTY_ORDER.indexOf(d);
}

export function sortMissionsByDifficultyThenCreated<T extends { difficulty?: string; created_at: string }>(
  missions: T[]
): T[] {
  return [...missions].sort((a, b) => {
    const da = difficultyOrderIndex(normalizeMissionDifficulty(a.difficulty));
    const db = difficultyOrderIndex(normalizeMissionDifficulty(b.difficulty));
    if (da !== db) return da - db;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Alle missies van één tier hebben een afronding met > minPct (standaard 50). */
export function tierSatisfied(
  missions: { id: string; difficulty?: string }[],
  tier: MissionDifficulty,
  completions: Record<string, { successPct: number }> | undefined,
  minPct = 50
): boolean {
  const tierIds = missions
    .filter((m) => normalizeMissionDifficulty(m.difficulty) === tier)
    .map((m) => m.id);
  if (tierIds.length === 0) return true;
  return tierIds.every((id) => {
    const c = completions?.[id];
    return c != null && c.successPct > minPct;
  });
}

export function isMissionUnlockedForKid(
  mission: { difficulty?: string },
  allMissions: { id: string; difficulty?: string }[],
  completions: Record<string, { successPct: number }> | undefined,
  minPct = 50
): boolean {
  const d = normalizeMissionDifficulty(mission.difficulty);
  if (d === "easy") return true;
  if (d === "medium") return tierSatisfied(allMissions, "easy", completions, minPct);
  return (
    tierSatisfied(allMissions, "easy", completions, minPct) &&
    tierSatisfied(allMissions, "medium", completions, minPct)
  );
}

export function unlockBlockedReason(
  mission: { difficulty?: string },
  allMissions: { id: string; difficulty?: string }[],
  completions: Record<string, { successPct: number }> | undefined,
  minPct = 50
): "easy" | "medium" | null {
  const d = normalizeMissionDifficulty(mission.difficulty);
  if (d === "easy") return null;
  if (!tierSatisfied(allMissions, "easy", completions, minPct)) return "easy";
  if (d === "hard" && !tierSatisfied(allMissions, "medium", completions, minPct)) return "medium";
  return null;
}
