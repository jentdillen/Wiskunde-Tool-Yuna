"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);
  return (
    <html lang="nl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f1f5f9", color: "#0f172a" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            gap: 16,
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>reken ster — fout</h1>
          <p style={{ maxWidth: 420, fontSize: "0.9rem", lineHeight: 1.5, color: "#475569" }}>
            De app kon niet starten. Vernieuw de pagina. Werkt het nog niet, controleer je internetverbinding of probeer een
            privévenster (soms blokkeert een oude sessie).
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "12px 24px",
              borderRadius: 16,
              border: "none",
              fontWeight: 700,
              background: "#4f46e5",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
