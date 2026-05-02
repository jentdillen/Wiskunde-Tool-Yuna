"use client";

/** Decorative space layer for the practice screen — no pointer events. */
export function SpacePracticeBackdrop() {
  const stars = [
    { l: "8%", t: "12%", d: 0 },
    { l: "18%", t: "28%", d: 0.4 },
    { l: "88%", t: "8%", d: 0.2 },
    { l: "72%", t: "22%", d: 0.9 },
    { l: "42%", t: "6%", d: 1.1 },
    { l: "55%", t: "35%", d: 0.6 },
    { l: "12%", t: "55%", d: 1.4 },
    { l: "92%", t: "48%", d: 0.3 },
    { l: "28%", t: "72%", d: 1.2 },
    { l: "78%", t: "68%", d: 0.7 },
    { l: "5%", t: "38%", d: 1.6 },
    { l: "65%", t: "12%", d: 0.5 },
    { l: "48%", t: "58%", d: 1.0 },
    { l: "35%", t: "88%", d: 0.8 },
    { l: "85%", t: "82%", d: 1.3 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_45%,rgba(34,211,238,0.14),transparent_65%)]" />
      <div className="aurora-shift absolute -inset-[40%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(99,102,241,0.08),transparent_40%,rgba(34,211,238,0.06),transparent_70%)] opacity-60" />

      {stars.map((s, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          style={{
            left: s.l,
            top: s.t,
            width: i % 4 === 0 ? 3 : 2,
            height: i % 4 === 0 ? 3 : 2,
            animationDelay: `${s.d}s`,
          }}
        />
      ))}

      <div className="space-drift-1 absolute -left-16 top-[20%] h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="space-drift-2 absolute -right-12 bottom-[25%] h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="space-drift-3 absolute left-1/3 top-[60%] h-28 w-28 rounded-full bg-amber-400/10 blur-2xl" />

      <div className="meteor absolute -right-4 top-1/4 h-0.5 w-20 rotate-[215deg] rounded-full bg-gradient-to-l from-transparent via-cyan-200/50 to-white/90 opacity-70" />
      <div className="meteor meteor-delay absolute right-1/4 top-[15%] h-0.5 w-14 rotate-[210deg] rounded-full bg-gradient-to-l from-transparent via-amber-200/40 to-white/80 opacity-50" />

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />
    </div>
  );
}
