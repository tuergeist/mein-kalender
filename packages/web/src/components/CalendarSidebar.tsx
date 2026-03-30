"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Spinner, Button } from "@heroui/react";
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
  const [syncing, setSyncing] = useState(false);
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!accessToken) return;
    loadSources();
  }, [accessToken]);

  async function loadSources() {
    if (!accessToken) return;

    const res = await apiAuthFetch("/api/sources", accessToken);
    if (res.ok) {
      const data: CalendarSource[] = await res.json();
      setSources(data);

      const enabledIds = new Set<string>();
      data.forEach((s) =>
        s.calendarEntries.forEach((e) => {
          if (e.enabled) enabledIds.add(e.id);
        })
      );
      dispatchVisibility(enabledIds);
    }
  }

  function dispatchVisibility(ids: Set<string>) {
    const arr = Array.from(ids);
    localStorage.setItem("visibleCalendarIds", JSON.stringify(arr));
    window.dispatchEvent(
      new CustomEvent("calendar-visibility-change", {
        detail: { visibleCalendars: arr },
      })
    );
  }

  async function toggleCalendar(calendarId: string) {
    if (!accessToken) return;

    const entry = sources
      .flatMap((s) => s.calendarEntries)
      .find((e) => e.id === calendarId);
    if (!entry) return;

    const newEnabled = !entry.enabled;

    // Optimistic update
    setSources((prev) =>
      prev.map((s) => ({
        ...s,
        calendarEntries: s.calendarEntries.map((e) =>
          e.id === calendarId ? { ...e, enabled: newEnabled } : e
        ),
      }))
    );

    const enabledIds = new Set<string>();
    sources.forEach((s) =>
      s.calendarEntries.forEach((e) => {
        if (e.id === calendarId ? newEnabled : e.enabled) enabledIds.add(e.id);
      })
    );
    dispatchVisibility(enabledIds);

    // Persist to API
    await apiAuthFetch(`/api/calendar-entries/${calendarId}`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ enabled: newEnabled }),
    });
  }

  async function handleSyncNow() {
    if (!accessToken) return;

    setSyncing(true);
    await apiAuthFetch("/api/sync-all", accessToken, { method: "POST" });
    setTimeout(() => {
      loadSources();
      setSyncing(false);
    }, 3000);
  }

  const providerIcon: Record<string, string> = {
    google: "G",
    outlook: "O",
    proton: "P",
    ics: "I",
  };

  return (
    <div className="flex flex-col gap-1 overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Kalender
        </h2>
        <Button
          size="sm"
          variant="light"
          isLoading={syncing}
          onPress={handleSyncNow}
          className="h-7 min-w-0 px-2 text-xs text-stone-500"
        >
          {syncing ? "" : "Sync"}
        </Button>
      </div>

      {sources.length === 0 && (
        <p className="text-xs text-stone-400">Keine Kalender verbunden</p>
      )}

      {sources.map((source) => (
        <div key={source.id} className="mb-3">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-stone-100 text-[10px] font-bold text-stone-500">
              {providerIcon[source.provider] || "?"}
            </span>
            <span className="text-xs font-medium text-stone-500">
              {source.label || source.provider}
            </span>
            {source.syncStatus === "syncing" && <Spinner size="sm" />}
            {source.syncStatus === "error" && (
              <span className="text-xs text-red-500" title={source.syncError || ""}>!</span>
            )}
          </div>

          <div className="flex flex-col">
            {source.calendarEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggleCalendar(entry.id)}
                className="flex min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-stone-50"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
                  style={
                    entry.enabled
                      ? { backgroundColor: entry.color || "#3b82f6", borderColor: entry.color || "#3b82f6" }
                      : { backgroundColor: "white", borderColor: "#D6D3D1" }
                  }
                />
                <span className={`truncate text-xs ${entry.enabled ? "text-stone-700" : "text-stone-400"}`}>
                  {entry.name}
                </span>
                {entry.readOnly && (
                  <span className="shrink-0 text-[10px] text-stone-400">RO</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
