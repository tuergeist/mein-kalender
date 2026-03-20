"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Select, SelectItem, Switch, Divider, Input,
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

  // ICS feeds
  interface IcsFeedItem { id: string; name: string; token: string; mode: string; daysInAdvance: number; calendars: Array<{ id: string; name: string }> }
  const [icsFeeds, setIcsFeeds] = useState<IcsFeedItem[]>([]);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [feedName, setFeedName] = useState("");
  const [feedMode, setFeedMode] = useState("full");
  const [feedDays, setFeedDays] = useState("30");
  const [feedCalendarIds, setFeedCalendarIds] = useState<string[]>([]);
  const [feedCreating, setFeedCreating] = useState(false);

  useEffect(() => {
    if (accessToken) loadData();
  }, [accessToken]);

  async function loadData() {
    if (!accessToken) return;
    const [sourcesRes, targetRes, feedsRes] = await Promise.all([
      apiAuthFetch("/api/sources", accessToken),
      apiAuthFetch("/api/target-calendar", accessToken),
      apiAuthFetch("/api/ics-feeds", accessToken),
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
    if (feedsRes.ok) setIcsFeeds(await feedsRes.json());
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

  async function createFeed() {
    if (!accessToken || !feedName.trim()) return;
    setFeedCreating(true);
    await apiAuthFetch("/api/ics-feeds", accessToken, {
      method: "POST",
      body: JSON.stringify({
        name: feedName,
        mode: feedMode,
        daysInAdvance: parseInt(feedDays) || 30,
        calendarEntryIds: feedCalendarIds,
      }),
    });
    setShowFeedModal(false);
    setFeedName("");
    setFeedMode("full");
    setFeedDays("30");
    setFeedCalendarIds([]);
    setFeedCreating(false);
    loadData();
  }

  async function deleteFeed(id: string) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/ics-feeds/${id}`, accessToken, { method: "DELETE" });
    loadData();
  }

  const icsFeedBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/api/ics-feed` : "";

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
                    {sources.map((source) => {
                      const entries = source.calendarEntries.filter((e) => e.id !== targetCalendarId);
                      if (entries.length === 0) return null;
                      return (
                        <div key={source.id} className="mb-3">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-500">
                              {{ google: "G", outlook: "O", proton: "P", ics: "I" }[source.provider] || "?"}
                            </span>
                            <span className="text-xs font-medium text-gray-500">{source.label || source.provider}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 pl-1">
                            {entries.map((entry) => (
                              <Checkbox key={entry.id} value={entry.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color || "#3b82f6" }} />
                                  <span className="text-xs">{entry.name}</span>
                                </div>
                              </Checkbox>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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

        {/* ICS Feeds */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ICS Feeds</h2>
            <Button size="sm" color="primary" onPress={() => setShowFeedModal(true)}>
              New Feed
            </Button>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">
              Create subscribable ICS feeds from your calendars. Use the URL in Google Calendar, Apple Calendar, etc.
            </p>
            {icsFeeds.length === 0 ? (
              <p className="text-default-400">No feeds yet.</p>
            ) : (
              <div className="space-y-3">
                {icsFeeds.map((feed) => (
                  <div key={feed.id} className="rounded-lg border border-default-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{feed.name}</span>
                        <span className="ml-2 text-xs text-default-400">
                          {feed.mode === "freebusy" ? "Free/busy only" : "Full details"} &bull; {feed.daysInAdvance} days
                        </span>
                      </div>
                      <Button size="sm" color="danger" variant="light" onPress={() => deleteFeed(feed.id)}>
                        Delete
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <code className="flex-1 rounded bg-default-100 px-2 py-1 text-xs text-default-600 truncate">
                        {icsFeedBaseUrl}/{feed.token}.ics
                      </code>
                      <Button
                        size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0"
                        onPress={() => navigator.clipboard.writeText(`${icsFeedBaseUrl}/${feed.token}.ics`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      </Button>
                    </div>
                    {feed.calendars.length > 0 && (
                      <p className="mt-1 text-xs text-default-400">
                        {feed.calendars.map((c) => c.name).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Create Feed Modal */}
        <Modal isOpen={showFeedModal} onClose={() => setShowFeedModal(false)} size="lg">
          <ModalContent>
            <ModalHeader>New ICS Feed</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input label="Name" isRequired value={feedName} onValueChange={setFeedName} placeholder="e.g. Work calendars" />
                <Select
                  label="Mode"
                  selectedKeys={new Set([feedMode])}
                  onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFeedMode(s); }}
                  size="sm"
                >
                  <SelectItem key="full">Full details (title, description, location)</SelectItem>
                  <SelectItem key="freebusy">Free/busy only (shows &quot;Busy&quot; blocks)</SelectItem>
                </Select>
                <Select
                  label="Days in advance"
                  selectedKeys={new Set([feedDays])}
                  onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFeedDays(s); }}
                  size="sm"
                >
                  <SelectItem key="30">30 days</SelectItem>
                  <SelectItem key="60">60 days</SelectItem>
                  <SelectItem key="90">90 days</SelectItem>
                </Select>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Calendars to include</p>
                    <Button size="sm" variant="flat" onPress={() => {
                      try {
                        const stored = localStorage.getItem("visibleCalendarIds");
                        if (stored) { const ids = JSON.parse(stored) as string[]; if (ids.length > 0) setFeedCalendarIds(ids); }
                      } catch { /* ignore */ }
                    }}>Use visible</Button>
                  </div>
                  <CheckboxGroup size="sm" value={feedCalendarIds} onChange={(vals) => setFeedCalendarIds(vals as string[])}>
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
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowFeedModal(false)}>Cancel</Button>
              <Button color="primary" isLoading={feedCreating} onPress={createFeed}>Create</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

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
