import Link from "next/link";
import { Button } from "@heroui/react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo-full.svg" alt="mein-kalender.link" width="480" className="w-[480px]" />
        <p className="text-lg text-[var(--text-secondary)]">
          Alle deine Kalender an einem Ort
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/auth/signup">
          <Button size="lg" className="bg-purple-400 px-8 font-medium text-white shadow-md hover:bg-purple-600">
            Los geht&apos;s
          </Button>
        </Link>
        <Link href="/auth/signin">
          <Button variant="bordered" size="lg" className="border-purple-400 px-8 font-medium text-purple-400 hover:bg-purple-50">
            Anmelden
          </Button>
        </Link>
      </div>
    </main>
  );
}
