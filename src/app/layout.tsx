import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { LocaleProvider } from "@/contexts/LocaleContext";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Wiskunde Tool",
  description: "Interactieve rekenoefeningen voor in de klas.",
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
        <LocaleProvider>
          <div className="flex min-h-dvh flex-col">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
