"use client";

import { useLocale } from "@/contexts/LocaleContext";

export function SetupRequired() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-lg rounded-2xl border-2 border-amber-300 bg-amber-50 p-8 text-center shadow-lg">
      <h1 className="text-2xl font-bold text-amber-900">{t("setupTitle")}</h1>
      <p className="mt-4 text-left text-amber-950/90">{t("setupBody")}</p>
    </div>
  );
}
