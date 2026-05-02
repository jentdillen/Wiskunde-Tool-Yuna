"use client";

type Variant = "nova" | "milo";

const styles: Record<Variant, { suit: string; accent: string; visor: string }> = {
  nova: { suit: "#e2e8f0", accent: "#6366f1", visor: "#38bdf8" },
  milo: { suit: "#f1f5f9", accent: "#f97316", visor: "#7dd3fc" },
};

export function AstronautCharacter({
  variant,
  className = "",
  mood = "idle",
}: {
  variant: Variant;
  className?: string;
  mood?: "idle" | "happy" | "encourage";
}) {
  const c = styles[variant];
  const moodClass =
    mood === "happy" ? "astronaut-mood-happy" : mood === "encourage" ? "astronaut-mood-encourage" : "";

  return (
    <div className={`astronaut-float ${moodClass} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 100 130" className="h-40 w-32 drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] sm:h-48 sm:w-40">
        <ellipse cx="50" cy="28" rx="28" ry="26" fill={c.suit} stroke="#94a3b8" strokeWidth="3" />
        <ellipse cx="50" cy="28" rx="18" ry="16" fill={c.visor} opacity="0.85" />
        <ellipse cx="50" cy="28" rx="18" ry="16" fill="none" stroke="#0f172a" strokeWidth="2" opacity="0.25" />
        <rect x="28" y="50" width="44" height="44" rx="18" fill={c.suit} stroke="#94a3b8" strokeWidth="3" />
        <rect x="40" y="62" width="20" height="14" rx="5" fill={c.accent} opacity="0.9" />
        <rect x="14" y="64" width="14" height="22" rx="7" fill={c.accent} />
        <rect x="72" y="64" width="14" height="22" rx="7" fill={c.accent} />
        <circle cx="50" cy="72" r="3" fill="#0f172a" opacity="0.35" />
      </svg>
    </div>
  );
}
