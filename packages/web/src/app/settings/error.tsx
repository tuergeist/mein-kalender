"use client";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h2 className="font-satoshi text-xl font-semibold text-stone-900 tracking-tight">
          Einstellungen nicht verfügbar
        </h2>
        <p className="mt-2 font-dm-sans text-sm text-stone-500">
          Beim Laden der Einstellungen ist ein Fehler aufgetreten. Bitte versuche es erneut.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center rounded-lg bg-rose-700 px-5 py-2.5 font-dm-sans text-sm font-medium text-white transition-colors hover:bg-rose-800"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
