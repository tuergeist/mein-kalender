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

interface Booking {
  id: string;
  guestName: string;
  startTime: string;
  status: string;
  eventType: { name: string };
}

interface BillingInfo {
  plan: "monthly" | "yearly" | null;
  status: "active" | "pending" | "cancelled" | null;
  trialEndsAt: string | null;
  isActive: boolean;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypeCount, setEventTypeCount] = useState(0);
  const [syncTargetCount, setSyncTargetCount] = useState(0);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    Promise.all([
      apiAuthFetch("/api/dashboard/briefing", accessToken).then((r) => r.ok ? r.json() : null),
      apiAuthFetch("/api/dashboard/weekly-summary", accessToken).then((r) => r.ok ? r.json() : null),
      apiAuthFetch("/api/dashboard/sync-status", accessToken).then((r) => r.ok ? r.json() : { sources: [] }),
      apiAuthFetch("/api/bookings", accessToken).then((r) => r.ok ? r.json() : []),
      apiAuthFetch("/api/event-types", accessToken).then((r) => r.ok ? r.json() : []),
      apiAuthFetch("/api/sync-targets", accessToken).then((r) => r.ok ? r.json() : []),
      apiAuthFetch("/api/billing", accessToken).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([b, w, s, bks, et, st, bl]) => {
      setBriefing(b);
      setWeekly(w);
      setSources(s.sources || []);
      setBookings(bks);
      setEventTypeCount(Array.isArray(et) ? et.length : 0);
      setSyncTargetCount(Array.isArray(st?.targets) ? st.targets.length : Array.isArray(st) ? st.length : 0);
      if (bl) setBilling(bl);
      setLoading(false);
    });
  }, [accessToken]);

  const now = new Date();
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

  const trialDaysLeft = billing?.trialEndsAt && !billing.plan
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

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

  // Getting started steps
  const steps = [
    { done: sources.length >= 1, label: "Kalender verbinden", href: "/settings", linkText: "Kalender hinzufügen" },
    { done: eventTypeCount > 0, label: "Terminart erstellen", href: "/settings/booking/new", linkText: "Terminart anlegen" },
    { done: sources.length >= 2, label: "Zweiten Kalender verbinden", href: "/settings", linkText: "Weiteren Kalender hinzufügen" },
    { done: syncTargetCount > 0, label: "Sync einrichten", href: "/sync", linkText: "Sync konfigurieren" },
  ];
  const allStepsDone = !loading && steps.every((s) => s.done);
  const doneCount = steps.filter((s) => s.done).length;

  useEffect(() => {
    if (loading) return;
    if (allStepsDone) {
      if (sessionStorage.getItem("mk-setup-incomplete")) {
        sessionStorage.removeItem("mk-setup-incomplete");
        setJustCompleted(true);
      }
    } else {
      sessionStorage.setItem("mk-setup-incomplete", "1");
    }
  }, [loading, allStepsDone]);

  return (
    <AppShell section="dashboard">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">
            {greeting}{userName ? `, ${userName}` : ""}.
          </h1>
          {briefing && !loading && (() => {
            const dayOfYear = Math.floor((+now - +new Date(now.getFullYear(), 0, 0)) / 86400000);
            const dayOfWeek = now.getDay();
            let subtitle = "";
            if (briefing.totalEvents === 0) {
              const opts = ["Keine Termine heute. Ein seltenes Gut.", "Terminfreier Tag. Selten, aber verdient.", "Heute: nur du und deine Ruhe."];
              subtitle = opts[dayOfYear % opts.length];
            } else if (briefing.totalEvents === 1) {
              subtitle = "Nur ein Termin. Fast schon Urlaub.";
            } else if (briefing.totalEvents >= 5) {
              const opts = ["Voller Tag. Kaffee steht bereit?", `${briefing.totalEvents} Termine. Du schaffst das.`];
              subtitle = opts[dayOfYear % opts.length];
            } else {
              subtitle = `${briefing.totalEvents} Termine heute${briefing.organizationCount > 1 ? ` in ${briefing.organizationCount} Kalendern` : ""}.`;
            }
            if (dayOfWeek === 1 && briefing.totalEvents > 0) subtitle = "Montag. Aber immerhin -- alles synchron.";
            if (dayOfWeek === 5 && hour >= 14) subtitle = "Freitag Nachmittag. Die Kalender können warten.";
            return (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {subtitle}
                {briefing.nextMeeting && briefing.nextMeeting.minutesUntil > 0 && (
                  <> Nächster: <span className="font-medium text-[var(--text-primary)]">{briefing.nextMeeting.title}</span> in {briefing.nextMeeting.minutesUntil} min.</>
                )}
              </p>
            );
          })()}
        </div>

        {/* Trial banner */}
        {!loading && trialDaysLeft !== null && trialDaysLeft > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <span>Testphase: noch {trialDaysLeft} {trialDaysLeft === 1 ? "Tag" : "Tage"}</span>
            <span className="text-amber-300">·</span>
            <Link href="/settings/billing" className="font-medium text-rose-700 hover:underline">
              Jetzt upgraden →
            </Link>
          </div>
        )}

        {/* Weekly Summary */}
        {weekly && !loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link href="/calendar" className="group rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)] transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
              <p className="font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left">{weekly.meetings}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Termine diese Woche</p>
            </Link>
            <Link href="/conflicts" className="group rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)] transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
              <p className={`font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left ${briefing && briefing.unresolvedConflicts > 0 ? "text-[var(--color-amber-600)]" : ""}`}>{briefing?.unresolvedConflicts ?? 0}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Überschneidungen</p>
            </Link>
            <Link href="/settings" className="group rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)] transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
              <p className="font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left">{weekly.calendarsConnected}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Kalender verbunden</p>
            </Link>
            <Link href="/sync-status" className="group rounded-xl bg-white p-4 shadow-sm border border-[var(--border-default)] transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
              {weekly.syncSuccessRate >= 97 ? (
                <>
                  <p className="font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left text-[#059669]">Alles OK</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Alle Kalender synchron</p>
                </>
              ) : weekly.syncSuccessRate >= 90 ? (
                <>
                  <p className="font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left text-[var(--color-amber-600)]">Teilweise</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Einzelne Syncs verzögert</p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl font-bold transition-transform duration-200 ease-out group-hover:scale-[1.03] origin-left text-red-600">Gestört</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Sync-Probleme erkannt</p>
                </>
              )}
            </Link>
          </div>
        )}

        {/* Onboarding completion */}
        {justCompleted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5" style={{ animation: "fadeInUp 0.4s ease-out both" }}>
            <p className="font-display text-base font-semibold text-emerald-800">Einrichtung abgeschlossen.</p>
            <p className="mt-1 text-sm text-emerald-600">Ab jetzt läuft alles automatisch.</p>
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
              {briefing.events.map((e) => {
                const isPast = !e.allDay && new Date(e.endTime) < now;
                return (
                  <div key={e.id} className={`group flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-4 py-3 shadow-sm ${isPast ? "opacity-40" : ""}`}>
                    <div className="h-9 w-1 shrink-0 rounded-full transition-all duration-150 ease-out group-hover:w-1.5" style={{ background: `linear-gradient(to bottom, ${e.color || "#9F1239"}, ${e.color || "#9F1239"}88)` }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{e.title || "(Kein Titel)"}</p>
                      <p className="font-mono text-xs text-[var(--text-tertiary)]">
                        {e.allDay ? "Ganztägig" : `${formatTime(e.startTime)} – ${formatTime(e.endTime)}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                      {e.source}
                    </span>
                  </div>
                );
              })}
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

      </div>
    </AppShell>
  );
}
