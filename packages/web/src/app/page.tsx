import Link from "next/link";
import { Button } from "@heroui/react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="flex flex-col items-center gap-3">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-blue-600">
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="14" r="1" fill="currentColor" />
          <circle cx="12" cy="14" r="1" fill="currentColor" />
          <circle cx="16" cy="14" r="1" fill="currentColor" />
          <circle cx="8" cy="18" r="1" fill="currentColor" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
        <h1 className="text-4xl font-bold text-gray-900">Calendar Sync</h1>
        <p className="text-lg text-gray-500">
          All your calendars in one place
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/auth/signup">
          <Button color="primary" size="lg" className="px-8 font-medium shadow-md">
            Get Started
          </Button>
        </Link>
        <Link href="/auth/signin">
          <Button variant="bordered" size="lg" className="px-8 font-medium">
            Sign In
          </Button>
        </Link>
      </div>
    </main>
  );
}
