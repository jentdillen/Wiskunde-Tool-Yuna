import type { TranslationKey } from "@/lib/i18n";

/** Zet op true in .env als Google in Supabase is ingeschakeld (Authentication → Providers → Google). */
export function isTeacherGoogleAuthEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_TEACHER_GOOGLE_AUTH?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function messageImpliesGoogleDisabled(msg: string): boolean {
  const l = msg.toLowerCase();
  return (
    l.includes("not enabled") ||
    l.includes("unsupported provider") ||
    l.includes("validation_failed") ||
    l.includes("provider is not enabled")
  );
}

/** Leesbare fout als Google in het project nog niet staat of Supabase JSON teruggeeft. */
export function formatGoogleOAuthClientError(
  raw: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const trimmed = raw.trim();
  if (messageImpliesGoogleDisabled(trimmed)) return t("teacherGoogleNotEnabled");
  try {
    const j = JSON.parse(trimmed) as { msg?: string; error_code?: string };
    const combined = `${j.error_code ?? ""} ${j.msg ?? ""}`;
    if (messageImpliesGoogleDisabled(combined)) return t("teacherGoogleNotEnabled");
  } catch {
    /* geen JSON */
  }
  return trimmed;
}
