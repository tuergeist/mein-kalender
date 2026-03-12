"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Checkbox, Spinner, Badge, Button } from "@heroui/react";
import { apiAuthFetch } from "@/lib/api";

interface CalendarEntry {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  readOnly: boolean;
}

interface CalendarSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncError: string | null;
  calendarEntries: CalendarEntry[];
}

export function CalendarSidebar() {
  const { data: session } = useSession();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadSources();
  }, [session]);

  async function loadSources() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    const res = await apiAuthFetch("/api/sources", token);
    if (res.ok) {
      const data = await res.json();
      setSources(data);

      // Initialize all calendars as visible
      const allIds = new Set<string>();
      data.forEach((s: CalendarSource) =>
        s.calendarEntries.forEach((e: CalendarEntry) => allIds.add(e.id))
      );
      setVisibleCalendars(allIds);
    }
  }

  function toggleCalendar(calendarId: string) {
    setVisibleCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      return next;
    });
    // Dispatch custom event for the calendar view to listen to
    window.dispatchEvent(
      new CustomEvent("calendar-visibility-change", {
        detail: { visibleCalendars: Array.from(visibleCalendars) },
      })
    );
  }

  async function handleSyncNow() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    setSyncing(true);
    await apiAuthFetch("/api/sync-all", token, { method: "POST" });
    // Poll for completion
    setTimeout(() => {
      loadSources();
      setSyncing(false);
    }, 3000);
  }

  const providerLabel: Record<string, string> = {
    google: "Google",
    outlook: "Outlook",
    proton: "Proton",
    ics: "ICS Import",
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-default-500">Calendars</h2>
        <Button size="sm" variant="light" isLoading={syncing} onPress={handleSyncNow}>
          Sync Now
        </Button>
      </div>

      {sources.map((source) => (
        <div key={source.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-default-400">
              {source.label || providerLabel[source.provider] || source.provider}
            </span>
            {source.syncStatus === "syncing" && <Spinner size="sm" />}
            {source.syncStatus === "error" && (
              <Badge color="danger" size="sm" content="!" />
            )}
          </div>

          {source.calendarEntries.map((entry) => (
            <Checkbox
              key={entry.id}
              isSelected={visibleCalendars.has(entry.id)}
              onValueChange={() => toggleCalendar(entry.id)}
              size="sm"
              classNames={{
                label: "text-sm",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
                {entry.readOnly && (
                  <span className="text-xs text-default-400">(read-only)</span>
                )}
              </span>
            </Checkbox>
          ))}
        </div>
      ))}
    </div>
  );
}
