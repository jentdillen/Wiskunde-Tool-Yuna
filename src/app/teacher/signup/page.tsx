"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SetupRequired } from "@/components/SetupRequired";
import { useLocale } from "@/contexts/LocaleContext";
import { getSupabase } from "@/lib/supabase/client";

export default function TeacherSignupPage() {
  const { t } = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => getSupabase(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          school_name: schoolName.trim(),
        },
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) {
      router.replace("/teacher");
      return;
    }
    setInfo(t("signupConfirmEmail"));
  };

  if (!supabase) return <SetupRequired />;

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-center justify-center bg-gradient-to-b from-violet-50 to-indigo-50 px-4 py-8">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-md rounded-3xl border-2 border-indigo-100 bg-white p-6 shadow-xl">
        <h1 className="text-2xl font-black text-indigo-950">{t("teacherSignup")}</h1>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {info && <p className="mt-3 text-sm text-emerald-700">{info}</p>}
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
            disabled={busy}
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
  );
}
