"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Logo linksboven; schaalt mee op kleine schermen (max-breedte).
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
        src="/reken-ster-logo.png"
        alt=""
        width={400}
        height={150}
        priority
        className="h-12 w-auto max-h-[3.25rem] max-w-[min(88vw,22rem)] object-contain object-left sm:h-14 sm:max-h-[3.75rem] sm:max-w-[26rem] md:h-16 md:max-h-[4.25rem] md:max-w-[30rem]"
      />
    </Link>
  );
}
