"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface SyncSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncError: string | null;
  lastSyncAt: string | null;
}

interface WeeklySummary {
  syncSuccessRate: number;
  syncCycles: number;
  latency: { p50: number; p95: number };
}

function providerName(p: string) {
  if (p === "google") return "Google";
  if (p === "microsoft" || p === "outlook") return "Outlook";
  if (p === "proton") return "Proton";
  if (p === "ics") return "ICS";
  return p;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
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

export default function SyncStatusPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      apiAuthFetch("/api/dashboard/sync-status", accessToken).then((r) => r.ok ? r.json() : { sources: [] }),
      apiAuthFetch("/api/dashboard/weekly-summary", accessToken).then((r) => r.ok ? r.json() : null),
    ]).then(([s, w]) => {
      setSources(s.sources || []);
      setWeekly(w);
      setLoading(false);
    });
  }, [accessToken]);

  const statusColor = (s: string) =>
    s === "ok" ? "bg-[#059669]" :
    s === "syncing" ? "bg-[var(--color-amber-500)] animate-pulse" :
    "bg-red-500";

  const statusLabel = (s: string) =>
    s === "ok" ? "OK" :
    s === "syncing" ? "Synchronisiert..." :
    s === "error" ? "Fehler" : s;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Sync-Status</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Übersicht aller verbundenen Kalenderquellen und deren Synchronisation.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-default)] bg-white p-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">Noch keine Kalender verbunden.</p>
            <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-[var(--color-rose-700)] hover:underline">
              Kalender hinzufügen →
            </Link>
          </div>
        ) : (
          <>
            {/* Per-source status */}
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.id} className="rounded-xl border border-[var(--border-default)] bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusColor(s.syncStatus)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {s.label || providerName(s.provider)}
                      </p>
                      <p className="font-mono text-xs text-[var(--text-tertiary)]">
                        {statusLabel(s.syncStatus)}
                        {s.lastSyncAt && <> · Letzter Sync: {formatDateTime(s.lastSyncAt)}</>}
                      </p>
                    </div>
                  </div>
                  {s.syncError && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{s.syncError}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Weekly metrics */}
            {weekly && weekly.syncCycles > 0 && (
              <div className="rounded-xl border border-[var(--border-default)] bg-white px-5 py-4 shadow-sm">
                <h2 className="font-display text-sm font-semibold text-[var(--text-secondary)]">Diese Woche</h2>
                <div className="mt-3 grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-display text-xl font-bold">{weekly.syncCycles}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Sync-Zyklen</p>
                  </div>
                  <div>
                    <p className={`font-display text-xl font-bold ${weekly.syncSuccessRate >= 97 ? "text-[#059669]" : weekly.syncSuccessRate >= 90 ? "text-[var(--color-amber-600)]" : "text-red-600"}`}>
                      {weekly.syncSuccessRate}%
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Erfolgsrate</p>
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold">{weekly.latency.p50}<span className="text-sm font-normal text-[var(--text-tertiary)]">ms</span></p>
                    <p className="text-xs text-[var(--text-tertiary)]">Latenz (p50)</p>
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs text-[var(--text-tertiary)]">
                  p95: {weekly.latency.p95}ms
                </p>
              </div>
            )}
          </>
        )}

        <Link
          href="/dashboard"
          className="inline-block text-sm font-medium text-[var(--color-rose-700)] hover:underline"
        >
          ← Zurück zum Dashboard
        </Link>
      </div>
    </AppShell>
  );
}
