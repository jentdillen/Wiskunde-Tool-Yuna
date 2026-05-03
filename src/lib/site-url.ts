/**
 * Publieke basis-URL voor e-mailredirects (o.a. Supabase bevestigingsmail).
 * Zet NEXT_PUBLIC_SITE_URL in productie (bv. https://jouw-app.vercel.app).
 */
export function getPublicSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin.replace(/\/$/, "");
  return "";
}

/** Absolute URL naar docentenlogin (vereist in emailRedirectTo). */
export function getTeacherLoginAbsoluteUrl(): string {
  const o = getPublicSiteOrigin();
  return o ? `${o}/teacher/login` : "";
}

/**
 * Gebruik in event handlers (client): altijd een absolute URL als env of `window` beschikbaar is.
 * Niet in useMemo([]) op SSR — daar is `window` nog niet beschikbaar.
 */
export function getTeacherLoginRedirectForEmail(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return `${fromEnv.replace(/\/$/, "")}/teacher/login`;
  if (typeof window !== "undefined") return `${window.location.origin.replace(/\/$/, "")}/teacher/login`;
  return "";
}
