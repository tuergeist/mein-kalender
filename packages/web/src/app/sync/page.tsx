"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Select, SelectItem, Switch, Divider,
  Checkbox, CheckboxGroup,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface CalendarEntry {
  id: string;
  name: string;
  color: string;
  readOnly: boolean;
}

interface CalendarSource {
  id: string;
  provider: string;
  label: string | null;
  syncInterval: number;
  fetchDaysInAdvance: number;
  calendarEntries: CalendarEntry[];
}

export default function SyncPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [targetCalendarId, setTargetCalendarId] = useState("");
  const [syncDaysInAdvance, setSyncDaysInAdvance] = useState(30);
  const [skipWorkLocation, setSkipWorkLocation] = useState(true);
  const [skipSingleDayAllDay, setSkipSingleDayAllDay] = useState(false);
  const [skipDeclined, setSkipDeclined] = useState(true);
  const [skipFree, setSkipFree] = useState(false);
  const [sourceCalendarIds, setSourceCalendarIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Fetch days in advance (source-level)
  const [fetchDays, setFetchDays] = useState(90);
  const [fetchDaysDirty, setFetchDaysDirty] = useState(false);
  const [fetchDaysSaving, setFetchDaysSaving] = useState(false);

  // Unset target
  const [showUnsetModal, setShowUnsetModal] = useState(false);
  const [unsetLoading, setUnsetLoading] = useState(false);

  // Cleanup
  const [cleanupCalendarId, setCleanupCalendarId] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");

  useEffect(() => {
    if (accessToken) loadData();
  }, [accessToken]);

  async function loadData() {
    if (!accessToken) return;
    const [sourcesRes, targetRes] = await Promise.all([
      apiAuthFetch("/api/sources", accessToken),
      apiAuthFetch("/api/target-calendar", accessToken),
    ]);
    if (sourcesRes.ok) {
      const data = await sourcesRes.json();
      setSources(data);
      // Use the max fetchDaysInAdvance across sources as the display value
      if (data.length > 0) {
        const maxFetch = Math.max(...data.map((s: CalendarSource) => s.fetchDaysInAdvance || 90));
        setFetchDays(maxFetch);
      }
    }
    if (targetRes.ok) {
      const data = await targetRes.json();
      setTargetCalendarId(data.targetCalendar?.id || "");
      setSyncDaysInAdvance(data.targetCalendar?.syncDaysInAdvance ?? 30);
      setSkipWorkLocation(data.targetCalendar?.skipWorkLocation ?? true);
      setSkipSingleDayAllDay(data.targetCalendar?.skipSingleDayAllDay ?? false);
      setSkipDeclined(data.targetCalendar?.skipDeclined ?? true);
      setSkipFree(data.targetCalendar?.skipFree ?? false);
      setSourceCalendarIds((data.targetCalendar?.sourceCalendars ?? []).map((c: { id: string }) => c.id));
    }
  }

  const allWritableEntries = sources.flatMap((s) =>
    s.calendarEntries.filter((e) => !e.readOnly).map((e) => ({ ...e, sourceName: s.label || s.provider }))
  );
  const allEntries = sources.flatMap((s) =>
    s.calendarEntries.map((e) => ({ ...e, sourceName: s.label || s.provider }))
  );

  async function saveTargetSettings() {
    if (!accessToken || !targetCalendarId) return;
    setSaving(true);
    await apiAuthFetch("/api/target-calendar", accessToken, {
      method: "PUT",
      body: JSON.stringify({
        calendarEntryId: targetCalendarId,
        syncDaysInAdvance,
        skipWorkLocation,
        skipSingleDayAllDay,
        skipDeclined,
        skipFree,
        sourceCalendarEntryIds: sourceCalendarIds,
      }),
    });
    setSaving(false);
    setDirty(false);

    // Warn if fetch window is smaller than sync window
    if (fetchDays < syncDaysInAdvance) {
      const raise = confirm(
        `Your source calendars only fetch ${fetchDays} days ahead, but sync is set to ${syncDaysInAdvance} days. Raise the fetch window to ${syncDaysInAdvance} days?`
      );
      if (raise) {
        await saveFetchDays(syncDaysInAdvance);
      }
    }
  }

  async function saveFetchDays(days?: number) {
    if (!accessToken) return;
    const value = days ?? fetchDays;
    setFetchDaysSaving(true);
    await Promise.all(
      sources
        .filter((s) => s.provider !== "ics")
        .map((s) =>
          apiAuthFetch(`/api/sources/${s.id}`, accessToken, {
            method: "PUT",
            body: JSON.stringify({ fetchDaysInAdvance: value }),
          })
        )
    );
    setFetchDays(value);
    setFetchDaysSaving(false);
    setFetchDaysDirty(false);
    loadData();
  }

  async function handleUnset(deleteSyncedEvents: boolean) {
    if (!accessToken) return;
    setUnsetLoading(true);
    await apiAuthFetch(`/api/target-calendar?deleteSyncedEvents=${deleteSyncedEvents}`, accessToken, { method: "DELETE" });
    setTargetCalendarId("");
    setUnsetLoading(false);
    setShowUnsetModal(false);
    loadData();
  }

  async function handleCleanup() {
    if (!accessToken || !cleanupCalendarId) return;
    setCleanupLoading(true);
    setCleanupStatus("Scanning...");
    const res = await apiAuthFetch("/api/target-calendar/cleanup", accessToken, {
      method: "POST",
      body: JSON.stringify({ calendarEntryId: cleanupCalendarId }),
    });
    if (res.ok) {
      const data = await res.json();
      setCleanupStatus(`Deleted ${data.deleted} of ${data.found} [Sync] events.`);
    } else {
      setCleanupStatus("Cleanup failed.");
    }
    setCleanupLoading(false);
  }

  return (
    <AppShell section="sync">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Calendar Sync</h1>

        {/* Fetch Window */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Source Fetch Window</h2></CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">
              How far in advance to fetch events from Google/Outlook calendars.
            </p>
            <div className="flex items-end gap-3">
              <Select
                label="Fetch period"
                selectedKeys={new Set([String(fetchDays)])}
                onSelectionChange={(keys) => {
                  const d = Number(Array.from(keys)[0]);
                  if (d) { setFetchDays(d); setFetchDaysDirty(true); }
                }}
                size="sm"
                className="max-w-xs"
              >
                <SelectItem key="30">30 days</SelectItem>
                <SelectItem key="60">60 days</SelectItem>
                <SelectItem key="90">90 days</SelectItem>
              </Select>
              <Button size="sm" color="primary" isLoading={fetchDaysSaving} isDisabled={!fetchDaysDirty} onPress={() => saveFetchDays()}>
                Save
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Target Calendar */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Target Calendar</h2></CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Clone events from source calendars into a target calendar.
            </p>

            {allWritableEntries.length === 0 ? (
              <p className="text-default-400">Connect a calendar with write access first.</p>
            ) : (
              <div className="flex items-end gap-2">
                <Select
                  label="Target Calendar"
                  placeholder="Select a calendar"
                  selectedKeys={targetCalendarId ? new Set([targetCalendarId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) { setTargetCalendarId(selected); setDirty(true); }
                  }}
                  className="flex-1"
                >
                  {allWritableEntries.map((entry) => (
                    <SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>
                      {entry.name} ({entry.sourceName})
                    </SelectItem>
                  ))}
                </Select>
                {targetCalendarId && (
                  <Button size="sm" color="danger" variant="light" onPress={() => setShowUnsetModal(true)}>
                    Unset
                  </Button>
                )}
              </div>
            )}

            {targetCalendarId && (
              <div className="mt-4 space-y-4">
                <Select
                  label="Sync period"
                  selectedKeys={new Set([String(syncDaysInAdvance)])}
                  onSelectionChange={(keys) => {
                    const d = Number(Array.from(keys)[0]);
                    if (d) { setSyncDaysInAdvance(d); setDirty(true); }
                  }}
                  size="sm"
                  className="max-w-xs"
                >
                  <SelectItem key="30">30 days in advance</SelectItem>
                  <SelectItem key="60">60 days in advance</SelectItem>
                  <SelectItem key="90">90 days in advance</SelectItem>
                </Select>
                <div className="space-y-2">
                  <Switch size="sm" isSelected={skipWorkLocation} onValueChange={(v) => { setSkipWorkLocation(v); setDirty(true); }}>
                    <span className="text-sm">Skip work location events</span>
                  </Switch>
                  <Switch size="sm" isSelected={skipSingleDayAllDay} onValueChange={(v) => { setSkipSingleDayAllDay(v); setDirty(true); }}>
                    <span className="text-sm">Skip single-day all-day events (birthdays, holidays)</span>
                  </Switch>
                  <Switch size="sm" isSelected={skipDeclined} onValueChange={(v) => { setSkipDeclined(v); setDirty(true); }}>
                    <span className="text-sm">Skip declined events</span>
                  </Switch>
                  <Switch size="sm" isSelected={skipFree} onValueChange={(v) => { setSkipFree(v); setDirty(true); }}>
                    <span className="text-sm">Skip free/tentative events</span>
                  </Switch>
                </div>

                <Divider />
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Source calendars to sync</p>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        try {
                          const stored = localStorage.getItem("visibleCalendarIds");
                          if (stored) {
                            const ids = JSON.parse(stored) as string[];
                            if (ids.length > 0) {
                              setSourceCalendarIds(ids);
                              setDirty(true);
                            }
                          }
                        } catch { /* ignore */ }
                      }}
                    >
                      Use visible calendars
                    </Button>
                  </div>
                  <p className="mb-2 text-xs text-default-400">
                    {sourceCalendarIds.length === 0 ? "All calendars (default)" : `${sourceCalendarIds.length} selected`}
                  </p>
                  <CheckboxGroup size="sm" value={sourceCalendarIds} onChange={(vals) => { setSourceCalendarIds(vals as string[]); setDirty(true); }}>
                    {sources.map((source) => (
                      <div key={source.id} className="mb-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500">
                            {{ google: "G", outlook: "O", proton: "P", ics: "I" }[source.provider] || "?"}
                          </span>
                          <span className="text-xs font-medium text-gray-500">{source.label || source.provider}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 pl-1">
                          {source.calendarEntries.map((entry) => (
                            <Checkbox key={entry.id} value={entry.id}>
                              <div className="flex items-center gap-1.5">
                                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color || "#3b82f6" }} />
                                <span className="text-xs">{entry.name}</span>
                              </div>
                            </Checkbox>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CheckboxGroup>
                </div>

                <Button size="sm" color="primary" isLoading={saving} isDisabled={!dirty} onPress={saveTargetSettings}>
                  Save
                </Button>
              </div>
            )}

            <Divider className="my-4" />
            <p className="mb-2 text-sm font-medium">Clean up [Sync] events</p>
            <div className="flex items-end gap-2">
              <Select
                label="Calendar to clean"
                placeholder="Select a calendar"
                selectedKeys={cleanupCalendarId ? new Set([cleanupCalendarId]) : new Set()}
                onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setCleanupCalendarId(s); }}
                className="flex-1"
                size="sm"
              >
                {allWritableEntries.map((entry) => (
                  <SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>
                    {entry.name} ({entry.sourceName})
                  </SelectItem>
                ))}
              </Select>
              <Button size="sm" variant="flat" color="warning" isLoading={cleanupLoading} isDisabled={!cleanupCalendarId} onPress={handleCleanup}>
                Clean up
              </Button>
            </div>
            {cleanupStatus && <p className="mt-2 text-sm text-primary">{cleanupStatus}</p>}
          </CardBody>
        </Card>

        {/* Unset Modal */}
        <Modal isOpen={showUnsetModal} onClose={() => setShowUnsetModal(false)}>
          <ModalContent>
            <ModalHeader>Unset Target Calendar</ModalHeader>
            <ModalBody>
              <p>Delete synced [Sync] events from the target calendar?</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowUnsetModal(false)} isDisabled={unsetLoading}>Cancel</Button>
              <Button variant="flat" isLoading={unsetLoading} onPress={() => handleUnset(false)}>Keep events</Button>
              <Button color="danger" isLoading={unsetLoading} onPress={() => handleUnset(true)}>Delete synced events</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
