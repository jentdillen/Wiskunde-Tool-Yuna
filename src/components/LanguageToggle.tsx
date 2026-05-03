"use client";

import { useLocale } from "@/contexts/LocaleContext";

export function LanguageToggle({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale, t } = useLocale();
  const isDark = variant === "dark";
  return (
    <div
      className={`flex gap-1 rounded-full p-1 shadow-sm ${
        isDark
          ? "border border-cyan-500/35 bg-slate-950/80 shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-sm"
          : "border border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => setLocale("nl")}
        className={`min-h-10 min-w-[2.75rem] rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-0 sm:min-w-0 sm:py-1 ${
          locale === "nl"
            ? "bg-cyan-500 text-slate-950"
            : isDark
              ? "text-cyan-100/90 hover:bg-slate-800/80"
              : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={locale === "nl"}
      >
        {t("localeNl")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`min-h-10 min-w-[2.75rem] rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:min-h-0 sm:min-w-0 sm:py-1 ${
          locale === "en"
            ? "bg-cyan-500 text-slate-950"
            : isDark
              ? "text-cyan-100/90 hover:bg-slate-800/80"
              : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-pressed={locale === "en"}
      >
        {t("localeEn")}
      </button>
    </div>
  );
}
