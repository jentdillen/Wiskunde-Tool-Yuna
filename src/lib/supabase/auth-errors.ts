import type { TranslationKey } from "@/lib/i18n";

/** Map Supabase Auth API messages to friendlier, actionable copy (i18n keys filled by caller). */

export function isEmailNotConfirmedMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("email not confirmed") ||
    m.includes("email address is not confirmed") ||
    (m.includes("not confirmed") && m.includes("email"))
  );
}

export function isInvalidCredentialsMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("invalid login credentials") || m.includes("invalid credentials");
}

/** Prefer translated strings on teacher login/signup; fall back to raw API message. */
export function formatTeacherAuthError(
  message: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (isEmailNotConfirmedMessage(message)) return t("authErrEmailNotConfirmed");
  if (isInvalidCredentialsMessage(message)) return t("authErrInvalidCredentials");
  return message;
}
