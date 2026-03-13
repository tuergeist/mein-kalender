import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "mein-kalender.link",
  description: "Alle deine Kalender an einem Ort",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`light ${inter.className}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
