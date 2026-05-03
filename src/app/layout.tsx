import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { RekenRaketBrandLink } from "@/components/RekenRaketBrandLink";
import { LocaleProvider } from "@/contexts/LocaleContext";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "reken raket",
  description: "Interactieve rekenoefeningen voor in de klas — reken raket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full">
      <body
        className={`${nunito.variable} min-h-dvh bg-slate-950 font-sans text-slate-900 antialiased`}
      >
        <noscript>
          <div
            style={{
              padding: 24,
              background: "#fffbeb",
              color: "#78350f",
              borderBottom: "2px solid #f59e0b",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <strong>JavaScript staat uit.</strong> Zet JavaScript aan om reken raket te gebruiken.
          </div>
        </noscript>
        <LocaleProvider>
          <div className="flex min-h-dvh flex-col">
            <header className="sticky top-0 z-[200] flex min-h-12 items-center border-b border-white/10 bg-slate-950/92 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/85 sm:min-h-14 sm:px-4">
              <RekenRaketBrandLink />
            </header>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
