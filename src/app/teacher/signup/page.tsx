"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RekenRaketBrandLink } from "@/components/RekenRaketBrandLink";
import { SetupRequired } from "@/components/SetupRequired";
import { TeacherGoogleAuthButton } from "@/components/TeacherGoogleAuthButton";
import { useLocale } from "@/contexts/LocaleContext";
import { formatTeacherAuthError, isEmailNotConfirmedMessage } from "@/lib/supabase/auth-errors";
import { getSupabase } from "@/lib/supabase/client";

export default function TeacherSignupPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [addressAs, setAddressAs] = useState<"meester" | "juf">("juf");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const emailTrim = email.trim();
      const { data, error: err } = await supabase.auth.signUp({
        email: emailTrim,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            school_name: schoolName.trim(),
            address_as: addressAs,
          },
        },
      });
      if (err) {
        setError(formatTeacherAuthError(err.message, t));
        return;
      }
      if (data.session) {
        router.replace("/teacher");
        return;
      }
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      });
      if (!signInErr && signInData.session) {
        router.replace("/teacher");
        return;
      }
      if (signInErr && isEmailNotConfirmedMessage(signInErr.message)) {
        setError(t("authErrSupabaseConfirmStillOn"));
        return;
      }
      if (signInErr) {
        setError(formatTeacherAuthError(signInErr.message, t));
        return;
      }
      setError(t("authErrSupabaseConfirmStillOn"));
    } finally {
      setBusy(false);
    }
  };

  if (!supabase) return <SetupRequired />;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-gradient-to-b from-violet-50 to-indigo-50 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 pb-2">
        <RekenRaketBrandLink />
        <LanguageToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="w-full rounded-3xl border-2 border-indigo-100 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-black text-indigo-950">{t("teacherSignup")}</h1>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 space-y-3">
            <TeacherGoogleAuthButton
              label={t("teacherGoogleContinue")}
              disabled={busy}
              onBusy={setGoogleBusy}
              onError={setError}
            />
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">{t("teacherAuthDivider")}</p>
          </div>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700">{t("email")}</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-indigo-400 focus:ring-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700">{t("password")}</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-indigo-400 focus:ring-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700">{t("fullNameLabel")}</label>
              <input
                type="text"
                autoComplete="name"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-indigo-400 focus:ring-4"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <fieldset>
              <legend className="block text-sm font-bold text-slate-700">{t("teacherAddressAsLabel")}</legend>
              <p className="mt-1 text-xs text-slate-500">{t("teacherAddressAsHint")}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="radio"
                    name="addressAs"
                    className="h-4 w-4"
                    checked={addressAs === "meester"}
                    onChange={() => setAddressAs("meester")}
                  />
                  {t("teacherAddressMeester")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                  <input
                    type="radio"
                    name="addressAs"
                    className="h-4 w-4"
                    checked={addressAs === "juf"}
                    onChange={() => setAddressAs("juf")}
                  />
                  {t("teacherAddressJuf")}
                </label>
              </div>
            </fieldset>
            <div>
              <label className="block text-sm font-bold text-slate-700">{t("joinSchool")}</label>
              <input
                type="text"
                autoComplete="organization"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-indigo-400 focus:ring-4"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy || googleBusy}
              className="w-full rounded-2xl bg-violet-600 py-3.5 font-black text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? t("loading") : t("createAccount")}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-600">
            <Link href="/teacher/login" className="font-bold text-indigo-700 underline-offset-2 hover:underline">
              {t("haveAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
