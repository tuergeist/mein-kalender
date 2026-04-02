"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface Conflict {
  id: string;
  eventATitle: string;
  eventBTitle: string;
  eventAStart: string;
  eventBStart: string;
  eventASource: string;
  eventBSource: string;
  detectedAt: string;
}

function providerName(p: string) {
  if (p === "google") return "Google";
  if (p === "microsoft" || p === "outlook") return "Outlook";
  if (p === "proton") return "Proton";
  if (p === "ics") return "ICS";
  return p;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateParam(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function timeParam(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ConflictsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    apiAuthFetch("/api/dashboard/conflicts", accessToken)
      .then((r) => (r.ok ? r.json() : { conflicts: [] }))
      .then((data) => {
        setConflicts(data.conflicts || []);
        setLoading(false);
      });
  }, [accessToken]);

  async function resolveConflict(id: string) {
    if (!accessToken) return;
    const res = await apiAuthFetch(`/api/dashboard/conflicts/${id}/resolve`, accessToken, {
      method: "POST",
    });
    if (res.ok) {
      setConflicts((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">
            Terminüberschneidungen
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Konflikte zwischen verschiedenen Kalendern in den nächsten 30 Tagen.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-white p-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">
              Keine Überschneidungen erkannt. Alles im grünen Bereich.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">&#9888;</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-amber-800)]">
                      {c.eventATitle}
                      <span className="font-normal text-[var(--color-amber-600)]">
                        {" "}({providerName(c.eventASource)})
                      </span>
                    </p>
                    <p className="text-sm font-medium text-[var(--color-amber-800)]">
                      {c.eventBTitle}
                      <span className="font-normal text-[var(--color-amber-600)]">
                        {" "}({providerName(c.eventBSource)})
                      </span>
                    </p>
                    <p className="mt-1.5 font-mono text-xs text-[var(--color-amber-600)]">
                      {formatDateTime(c.eventAStart)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/calendar?date=${dateParam(c.eventAStart)}&time=${timeParam(c.eventAStart)}`}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-rose-700)] shadow-sm border border-[var(--border-default)] hover:shadow-md transition-shadow"
                  >
                    Im Kalender anzeigen
                  </Link>
                  <button
                    onClick={() => resolveConflict(c.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-amber-700)] hover:bg-[var(--color-amber-100)] transition-colors"
                  >
                    Erledigt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/dashboard"
          className="inline-block text-sm font-medium text-[var(--color-rose-700)] hover:underline"
        >
          &larr; Zurück zum Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
