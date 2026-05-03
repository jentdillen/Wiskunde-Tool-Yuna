"use client";

import type { MissionDifficulty } from "@/lib/missions";

const tierStyle: Record<
  MissionDifficulty,
  { gradient: string; ring: string; glow: string; extra?: string }
> = {
  easy: {
    gradient: "from-sky-300 via-cyan-400 to-blue-600",
    ring: "ring-cyan-200/60",
    glow: "shadow-[0_0_28px_rgba(34,211,238,0.45)]",
  },
  medium: {
    gradient: "from-fuchsia-400 via-violet-500 to-indigo-700",
    ring: "ring-violet-200/50",
    glow: "shadow-[0_0_32px_rgba(167,139,250,0.4)]",
    extra: "after:absolute after:inset-[-6px] after:rounded-full after:border-2 after:border-dashed after:border-white/25 after:content-['']",
  },
  hard: {
    gradient: "from-amber-300 via-orange-500 to-rose-600",
    ring: "ring-amber-200/55",
    glow: "shadow-[0_0_36px_rgba(251,146,60,0.45)]",
    extra:
      "before:absolute before:inset-[-10px] before:rounded-full before:border-2 before:border-dotted before:border-amber-200/35 before:content-[''] after:absolute after:inset-[-18px] after:rounded-full after:border after:border-white/15 after:content-['']",
  },
};

const sizeClass = {
  sm: "h-11 w-11",
  md: "h-16 w-16",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
} as const;

type Props = {
  tier: MissionDifficulty;
  size?: keyof typeof sizeClass;
  locked?: boolean;
  className?: string;
};

export function MissionPlanet({ tier, size = "md", locked, className = "" }: Props) {
  const st = tierStyle[tier];
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${st.gradient} ${sizeClass[size]} ${st.glow} ring-2 ${st.ring} ${st.extra ?? ""} ${locked ? "opacity-45 grayscale-[0.35]" : ""} ${className}`}
      aria-hidden
    >
      <span className="pointer-events-none h-[32%] w-[42%] rounded-[50%] bg-white/30 blur-[1px]" />
    </div>
  );
}
