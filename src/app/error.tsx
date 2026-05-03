"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-100 px-6 py-12 text-center text-slate-900">
      <h1 className="text-2xl font-black text-slate-900">Er ging iets mis</h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">
        Vernieuw de pagina of probeer een andere browser. Op school: controleer of JavaScript aan staat en of het netwerk scripts mag
        laden.
      </p>
      {process.env.NODE_ENV === "development" ? (
        <pre className="max-h-40 max-w-full overflow-auto rounded-lg bg-white p-3 text-left text-xs text-red-800 ring-1 ring-red-200">
          {error.message}
        </pre>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-2xl bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-700"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
