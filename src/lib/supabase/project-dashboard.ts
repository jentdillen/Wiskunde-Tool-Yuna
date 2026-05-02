/** Link to enable Auth providers (e.g. Anonymous) for the configured Supabase project. */
export function supabaseAuthProvidersDashboardUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    if (!ref || ref === "127.0.0.1" || ref === "localhost") return null;
    return `https://supabase.com/dashboard/project/${ref}/auth/providers`;
  } catch {
    return null;
  }
}
