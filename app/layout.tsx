import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Demand Solution Board",
  description: "Community demand to implementation board",
};

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>
        <div className="ambient-bg" />
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 backdrop-blur-xl">
          <div className="container-page flex items-center justify-between py-5">
            <Link href="/" className="brand-mark text-lg font-semibold tracking-tight">
              Demand Solution Board
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/" className="btn">
                Browse
              </Link>
              <Link href="/submit" className="btn btn-primary">
                Submit Idea
              </Link>
            </div>
          </div>
        </header>
        <main className="container-page pb-12">{children}</main>
      </body>
    </html>
  );
}
