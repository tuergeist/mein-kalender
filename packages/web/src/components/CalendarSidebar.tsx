"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Spinner } from "@heroui/react";
import { apiAuthFetch } from "@/lib/api";

const COLOR_PALETTE = [
  { value: "#9F1239", label: "Rose" },
  { value: "#DC2626", label: "Red" },
  { value: "#EA580C", label: "Orange" },
  { value: "#D97706", label: "Amber" },
  { value: "#65A30D", label: "Lime" },
  { value: "#059669", label: "Emerald" },
  { value: "#0891B2", label: "Cyan" },
  { value: "#2563EB", label: "Blue" },
  { value: "#7C3AED", label: "Violet" },
  { value: "#C026D3", label: "Fuchsia" },
  { value: "#78716C", label: "Stone" },
];

interface CalendarEntry {
  id: string;
  name: string;
  color: string;
  userColor: string | null;
  enabled: boolean;
  readOnly: boolean;
}

interface CalendarSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncError: string | null;
  emailForInvitations: string | null;
  calendarEntries: CalendarEntry[];
}

export function CalendarSidebar() {
  const { data: session } = useSession();
  const [sources, setSources] = useState<CalendarSource[]>([]);
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

  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(null);
      }
    }
    if (colorPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [colorPickerOpen]);

  async function updateColor(calendarId: string, newColor: string | null) {
    if (!accessToken) return;

    const entry = sources
      .flatMap((s) => s.calendarEntries)
      .find((e) => e.id === calendarId);
    if (!entry) return;

    // If selecting the same color as the current userColor, reset to provider default
    const effectiveColor = entry.userColor === newColor ? null : newColor;

    // Optimistic update
    setSources((prev) =>
      prev.map((s) => ({
        ...s,
        calendarEntries: s.calendarEntries.map((e) =>
          e.id === calendarId ? { ...e, userColor: effectiveColor } : e
        ),
      }))
    );
    setColorPickerOpen(null);

    // Dispatch color change so CalendarView re-renders with new colors
    window.dispatchEvent(new CustomEvent("calendar-color-change"));

    // Persist to API
    await apiAuthFetch(`/api/calendar-entries/${calendarId}/color`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ userColor: effectiveColor }),
    });
  }

  function getEffectiveColor(entry: CalendarEntry) {
    return entry.userColor ?? entry.color ?? "#3b82f6";
  }

  const providerIcon: Record<string, string> = {
    google: "G",
    outlook: "O",
    apple: "A",
    proton: "P",
    ics: "I",
  };

  const [showDisabled, setShowDisabled] = useState(false);
  const hasDisabled = sources.some((s) => s.calendarEntries.some((e) => !e.enabled));

  return (
    <div className="flex flex-col gap-1 overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-mono text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Kalender
        </h2>
        {hasDisabled && (
          <button
            type="button"
            onClick={() => setShowDisabled(!showDisabled)}
            className="text-[10px] font-medium text-stone-400 hover:text-stone-600"
          >
            {showDisabled ? "Nur aktive" : "Alle anzeigen"}
          </button>
        )}
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
            {source.calendarEntries.filter((e) => showDisabled || e.enabled).map((entry) => {
              const effectiveColor = getEffectiveColor(entry);
              return (
                <div key={entry.id} className="relative flex min-w-0 items-center gap-1.5 rounded px-1 py-1 hover:bg-stone-50">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerOpen(colorPickerOpen === entry.id ? null : entry.id);
                    }}
                    className="group relative shrink-0"
                    title="Farbe aendern"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full border-2 transition-transform group-hover:scale-125"
                      style={
                        entry.enabled
                          ? { backgroundColor: effectiveColor, borderColor: effectiveColor }
                          : { backgroundColor: "white", borderColor: "#D6D3D1" }
                      }
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCalendar(entry.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <span className={`truncate text-xs ${entry.enabled ? "text-stone-700" : "text-stone-400"}`}>
                      {entry.name}
                    </span>
                    {entry.readOnly && (
                      <span className="shrink-0 text-[10px] text-stone-400">RO</span>
                    )}
                  </button>

                  {colorPickerOpen === entry.id && (
                    <div
                      ref={colorPickerRef}
                      className="absolute left-0 bottom-full z-50 mb-1 rounded-lg border border-stone-200 bg-white p-2 shadow-md"
                    >
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => updateColor(entry.id, c.value)}
                            title={c.label}
                            className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-125"
                            style={{ backgroundColor: c.value }}
                          >
                            {entry.userColor === c.value && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      {entry.userColor && (
                        <button
                          type="button"
                          onClick={() => updateColor(entry.id, null)}
                          className="mt-1.5 w-full rounded px-1 py-0.5 text-center text-[10px] text-stone-500 hover:bg-stone-100"
                        >
                          Zurücksetzen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
