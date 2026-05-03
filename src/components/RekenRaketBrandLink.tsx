"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Compact logo linksboven; schaalt mee op kleine schermen (max-breedte).
 * Op docentenroutes linkt naar /teacher, anders naar /.
 */
export function RekenRaketBrandLink({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const isTeacher = pathname.startsWith("/teacher");
  const href = isTeacher ? "/teacher" : "/";

  return (
    <Link
      href={href}
      className={`group flex shrink-0 items-center rounded-md ring-cyan-400/0 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${className}`}
      aria-label={t("brandHomeAria")}
    >
      <Image
        src="/reken-raket-logo.png"
        alt=""
        width={220}
        height={56}
        priority
        className="h-7 w-auto max-h-[2rem] max-w-[min(52vw,12.5rem)] object-contain object-left sm:h-8 sm:max-h-[2.25rem] sm:max-w-[14rem]"
      />
    </Link>
  );
}
