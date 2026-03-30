"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface BriefingEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendar: string;
  color: string;
  provider: string;
  source: string;
}

interface Briefing {
  totalEvents: number;
  organizationCount: number;
  unresolvedConflicts: number;
  nextMeeting: { title: string; startTime: string; minutesUntil: number; source: string } | null;
  events: BriefingEvent[];
}

interface WeeklySummary {
  meetings: number;
  overlapsDetected: number;
  calendarsConnected: number;
  syncSuccessRate: number;
  syncCycles: number;
  latency: { p50: number; p95: number };
}

interface SyncSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncError: string | null;
  lastSyncAt: string | null;
}

interface Conflict {
  id: string;
  eventATitle: string;
  eventBTitle: string;
  eventAStart: string;
  eventASource: string;
  eventBSource: string;
  detectedAt: string;
}

interface Booking {
  id: string;
  guestName: string;
  startTime: string;
  status: string;
  eventType: { name: string };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypeCount, setEventTypeCount] = useState(0);
  const [syncTargetCount, setSyncTargetCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    Promise.all([
      apiAuthFetch("/api/dashboard/briefing", accessToken).then((r) => r.ok ? r.json() : null),
      apiAuthFetch("/api/dashboard/weekly-summary", accessToken).then((r) => r.ok ? r.json() : null),
      apiAuthFetch("/api/dashboard/sync-status", accessToken).then((r) => r.ok ? r.json() : { sources: [] }),
      apiAuthFetch("/api/dashboard/conflicts", accessToken).then((r) => r.ok ? r.json() : { conflicts: [] }),
      apiAuthFetch("/api/bookings", accessToken).then((r) => r.ok ? r.json() : []),
      apiAuthFetch("/api/event-types", accessToken).then((r) => r.ok ? r.json() : []),
      apiAuthFetch("/api/sync-targets", accessToken).then((r) => r.ok ? r.json() : []),
    ]).then(([b, w, s, c, bks, et, st]) => {
      setBriefing(b);
      setWeekly(w);
      setSources(s.sources || []);
      setConflicts(c.conflicts || []);
      setBookings(bks);
      setEventTypeCount(Array.isArray(et) ? et.length : 0);
      setSyncTargetCount(Array.isArray(st) ? st.length : 0);
      setLoading(false);
    });
  }, [accessToken]);

  const now = new Date();
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

  const upcomingBookings = bookings
    .filter((b) => b.status === "confirmed" && new Date(b.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function providerName(p: string) {
    if (p === "google") return "Google";
    if (p === "microsoft" || p === "outlook") return "Outlook";
    if (p === "proton") return "Proton";
    if (p === "ics") return "ICS";
    return p;
  }

  // Getting started steps
  const steps = [
    { done: sources.length >= 1, label: "Kalender verbinden", href: "/settings", linkText: "Kalender hinzufügen" },
    { done: eventTypeCount > 0, label: "Event-Typ erstellen", href: "/settings/booking/new", linkText: "Event-Typ anlegen" },
    { done: sources.length >= 2, label: "Zweiten Kalender verbinden", href: "/settings", linkText: "Weiteren Kalender hinzufügen" },
    { done: syncTargetCount > 0, label: "Sync einrichten", href: "/sync", linkText: "Sync konfigurieren" },
  ];
  const allStepsDone = !loading && steps.every((s) => s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <AppShell section="dashboard">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {greeting}{userName ? `, ${userName}` : ""}.
          </h1>
          {briefing && !loading && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {briefing.totalEvents === 0
                ? "Keine Termine heute. Genieß den freien Tag."
                : `${briefing.totalEvents} Termine heute${briefing.organizationCount > 1 ? ` in ${briefing.organizationCount} Kalendern` : ""}.`}
              {briefing.nextMeeting && briefing.nextMeeting.minutesUntil > 0 && (
                <> Nächster: <span className="font-medium text-[var(--text-primary)]">{briefing.nextMeeting.title}</span> in {briefing.nextMeeting.minutesUntil} min.</>
              )}
            </p>
          )}
        </div>

        {/* Conflict Banner */}
        {conflicts.length > 0 && (
          <div className="space-y-2">
            {conflicts.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-4">
                <span className="mt-0.5 text-lg">&#9888;</span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-amber-800)]">Terminüberschneidung erkannt</p>
                  <p className="mt-0.5 text-xs text-[var(--color-amber-700)]">
                    {c.eventATitle} ({providerName(c.eventASource)}) und {c.eventBTitle} ({providerName(c.eventBSource)})
                    <br />
                    {formatDateTime(c.eventAStart)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Summary */}
        {weekly && !loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)]">
              <p className="font-display text-2xl font-bold">{weekly.meetings}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Termine diese Woche</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)]">
              <p className="font-display text-2xl font-bold">{weekly.overlapsDetected}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Überschneidungen</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)]">
              <p className="font-display text-2xl font-bold">{weekly.calendarsConnected}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Kalender verbunden</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)]">
              <p className={`font-display text-2xl font-bold ${weekly.syncSuccessRate >= 99 ? "text-[#059669]" : weekly.syncSuccessRate >= 95 ? "text-[var(--color-amber-600)]" : "text-red-600"}`}>
                {weekly.syncSuccessRate}%
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">Sync-Erfolg</p>
              {weekly.syncCycles > 0 && (
                <p className="font-mono text-[10px] text-[var(--text-tertiary)] mt-1">
                  {weekly.syncCycles} Zyklen · p50: {weekly.latency.p50 < 1000 ? `${weekly.latency.p50}ms` : `${(weekly.latency.p50 / 1000).toFixed(1)}s`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Getting Started (only if not all done) */}
        {!loading && !allStepsDone && (
          <div className="rounded-xl border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[var(--color-amber-800)]">Einrichtung</h2>
              <span className="font-mono text-xs text-[var(--color-amber-600)]">{doneCount}/{steps.length}</span>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-100 text-emerald-700" : "border-2 border-[var(--color-amber-300)] text-[var(--color-amber-400)]"}`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <p className={`text-sm ${step.done ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]"}`}>
                    {step.label}
                    {!step.done && (
                      <> — <Link href={step.href} className="font-medium text-[var(--color-rose-700)] hover:underline">{step.linkText} →</Link></>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's Events */}
        <div>
          <h2 className="font-display mb-3 text-lg font-semibold">Heute</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-stone-100" />
              ))}
            </div>
          ) : !briefing || briefing.events.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-white p-8 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">Keine Termine heute. Das ist das Ziel.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {briefing.events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-4 py-3 shadow-sm">
                  <div className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: e.color || "#9F1239" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{e.title}</p>
                    <p className="font-mono text-xs text-[var(--text-tertiary)]">
                      {e.allDay ? "Ganztägig" : `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                    {providerName(e.provider)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div>
            <h2 className="font-display mb-3 text-lg font-semibold">Nächste Buchungen</h2>
            <div className="space-y-2">
              {upcomingBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-4 py-3 shadow-sm">
                  <div className="h-9 w-1 shrink-0 rounded-full bg-[var(--color-amber-500)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{b.guestName}</p>
                    <p className="font-mono text-xs text-[var(--text-tertiary)]">{formatDateTime(b.startTime)}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-[var(--color-rose-700)]">
                    {b.eventType.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Health Detail (collapsible) */}
        {sources.length > 0 && !loading && (
          <details className="group">
            <summary className="cursor-pointer font-display text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
              Sync-Status Details ▸
            </summary>
            <div className="mt-3 space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-4 py-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                    s.syncStatus === "ok" ? "bg-[#059669]" :
                    s.syncStatus === "syncing" ? "bg-[var(--color-amber-500)] animate-pulse" :
                    "bg-red-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{s.label || providerName(s.provider)}</p>
                    {s.syncError && <p className="text-xs text-red-600">{s.syncError}</p>}
                  </div>
                  {s.lastSyncAt && (
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">
                      {formatTime(s.lastSyncAt)}
                    </span>
                  )}
                </div>
              ))}
              {weekly && weekly.syncCycles > 0 && (
                <p className="px-1 font-mono text-xs text-[var(--text-tertiary)]">
                  {weekly.syncCycles} Sync-Zyklen diese Woche · p50: {weekly.latency.p50}ms · p95: {weekly.latency.p95}ms
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </AppShell>
  );
}
