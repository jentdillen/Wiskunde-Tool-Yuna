"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { StudentJoinForm } from "@/components/StudentJoinForm";
import { useLocale } from "@/contexts/LocaleContext";

export default function Home() {
  const { t } = useLocale();
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-stretch justify-start bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-6 pt-3 sm:pb-8 sm:pt-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <Link
          href="/teacher/login"
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/30 hover:bg-white/15 sm:text-sm"
        >
          {t("teacherLink")}
        </Link>
        <LanguageToggle variant="dark" />
      </div>
      <StudentJoinForm />
    </div>
  );
}
