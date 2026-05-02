"use client";

export function SpeechBubble({
  label,
  text,
  align = "left",
}: {
  label: string;
  text: string;
  align?: "left" | "right";
}) {
  const isRight = align === "right";
  return (
    <div
      className={`relative max-w-[min(100%,280px)] rounded-2xl border-2 px-3 py-2 shadow-lg backdrop-blur-sm sm:px-4 sm:py-3 ${
        isRight
          ? "border-amber-400/60 bg-slate-950/80 text-white"
          : "border-cyan-400/60 bg-slate-950/80 text-white"
      }`}
    >
      <p
        className={`mb-1 text-[10px] font-black uppercase tracking-[0.15em] sm:text-xs ${
          isRight ? "text-amber-300" : "text-cyan-300"
        }`}
      >
        {label}
      </p>
      <p className="text-sm leading-snug sm:text-base">{text}</p>
      <span
        className={`absolute -bottom-2 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent ${
          isRight ? "right-6 border-t-amber-400/70" : "left-6 border-t-cyan-400/70"
        }`}
      />
    </div>
  );
}
