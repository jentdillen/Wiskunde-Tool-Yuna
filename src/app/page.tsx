"use client";

import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RekenRaketBrandLink } from "@/components/RekenRaketBrandLink";
import { StudentJoinForm } from "@/components/StudentJoinForm";
import { useLocale } from "@/contexts/LocaleContext";

export default function Home() {
  const { t } = useLocale();
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-stretch justify-start bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pb-8 sm:pt-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />
      <div className="relative z-20 flex w-full shrink-0 items-center justify-between gap-3 pb-3 sm:pb-2">
        <RekenRaketBrandLink />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/teacher/login"
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100 ring-1 ring-cyan-500/30 hover:bg-white/15 sm:text-sm"
          >
            {t("teacherLink")}
          </Link>
          <LanguageToggle variant="dark" />
        </div>
      </div>
      <StudentJoinForm />
    </div>
  );
}
