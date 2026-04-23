"use client";

import { useLocale } from "@/lib/i18n";

export default function BookingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h2 className="font-satoshi text-xl font-semibold text-stone-900 tracking-tight">
          {t("error.title")}
        </h2>
        <p className="mt-2 font-dm-sans text-sm text-stone-500">
          {t("error.message")}
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-lg bg-rose-700 px-5 py-2.5 font-dm-sans text-sm font-medium text-white transition-colors hover:bg-rose-800"
        >
          {t("error.retry")}
        </button>
      </div>
    </div>
  );
}
