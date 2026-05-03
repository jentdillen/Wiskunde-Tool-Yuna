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
      className={`group flex shrink-0 items-center bg-transparent transition-opacity hover:opacity-90 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
      aria-label={t("brandHomeAria")}
    >
      <Image
        src="/reken-raket-logo.png"
        alt=""
        width={320}
        height={82}
        priority
        className="h-10 w-auto max-h-[2.6rem] max-w-[min(72vw,18rem)] object-contain object-left sm:h-12 sm:max-h-[3.1rem] sm:max-w-[22rem]"
      />
    </Link>
  );
}
