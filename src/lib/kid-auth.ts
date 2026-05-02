import type { SupabaseClient } from "@supabase/supabase-js";
import type { KidJoinDraft } from "@/lib/kid-session";

/** Supabase returns this when Anonymous sign-ins are off in the project dashboard. */
export function isAnonymousSignInDisabledError(err: unknown): boolean {
  let msg = "";
  let code = "";
  if (err && typeof err === "object") {
    if ("message" in err) msg = String((err as { message: string }).message);
    if ("code" in err) code = String((err as { code?: string }).code ?? "");
  }
  const m = msg.toLowerCase();
  return (
    code === "anonymous_provider_disabled" ||
    (m.includes("anonymous") && m.includes("disabled")) ||
    m.includes("anonymous sign-ins are disabled")
  );
}

/** True if this JWT is a learner (anonymous) session, not a teacher email session. */
function isLearnerSessionUser(user: { is_anonymous?: boolean; email?: string | null }): boolean {
  if (user.is_anonymous === true) return true;
  const em = user.email;
  return em == null || String(em).trim() === "";
}

/**
 * Ensures an anonymous Supabase session (kid account).
 * If a teacher (or any non-anonymous) session is active, signs out first so sign-in does not reuse the wrong account.
 */
export async function ensureAnonymousSession(supabase: SupabaseClient): Promise<void> {
  const { data: s0 } = await supabase.auth.getSession();
  const u0 = s0.session?.user;
  if (u0 && isLearnerSessionUser(u0)) return;

  if (u0 && !isLearnerSessionUser(u0)) {
    const { error: so } = await supabase.auth.signOut({ scope: "local" });
    if (so) throw so;
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

/** True if the saved draft matches the signed-in learner. */
export async function verifyKidMatchesSession(
  supabase: SupabaseClient,
  draft: KidJoinDraft
): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("id", draft.studentId)
    .eq("auth_user_id", uid)
    .maybeSingle();
  if (error || !data) return false;
  return data.id === draft.studentId;
}
