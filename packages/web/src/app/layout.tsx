import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-dm-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "mein-kalender.link — Nie wieder doppelt gebucht",
  description: "Kalender-Sync für Profis: Google, Outlook und Proton in einem Blick. Ohne deine Daten zu zerstören. 14 Tage kostenlos testen.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`light ${satoshi.variable} ${dmSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script defer src="https://api.pirsch.io/pa.js" id="pianjs" data-code="tlkwjKBDo5OXWaLS7O7kFPuDT8XFnH55" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
