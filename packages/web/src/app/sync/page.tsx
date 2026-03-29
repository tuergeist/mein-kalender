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

interface SyncTarget {
  id: string;
  name: string;
  syncMode: string;
  syncDaysInAdvance: number;
  skipWorkLocation: boolean;
  skipSingleDayAllDay: boolean;
  skipDeclined: boolean;
  skipFree: boolean;
  source: { id: string; provider: string; label: string | null };
  sourceCalendars: Array<{ id: string; name: string }>;
}

export default function SyncPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);

  // Fetch days in advance (source-level)
  const [fetchDays, setFetchDays] = useState(90);
  const [fetchDaysDirty, setFetchDaysDirty] = useState(false);
  const [fetchDaysSaving, setFetchDaysSaving] = useState(false);

  // Add/edit target form
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [formTargetCalendarId, setFormTargetCalendarId] = useState("");
  const [formSyncMode, setFormSyncMode] = useState("full");
  const [formSyncDays, setFormSyncDays] = useState(30);
  const [formSkipWorkLocation, setFormSkipWorkLocation] = useState(true);
  const [formSkipSingleDayAllDay, setFormSkipSingleDayAllDay] = useState(false);
  const [formSkipDeclined, setFormSkipDeclined] = useState(true);
  const [formSkipFree, setFormSkipFree] = useState(false);
  const [formSourceCalendarIds, setFormSourceCalendarIds] = useState<string[]>([]);
  const [formSaving, setFormSaving] = useState(false);

  // Delete target
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Cleanup
  const [cleanupCalendarId, setCleanupCalendarId] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");

  // ICS feeds
  interface IcsFeedItem { id: string; name: string; token: string; mode: string; daysInAdvance: number; calendars: Array<{ id: string; name: string }> }
  const [icsFeeds, setIcsFeeds] = useState<IcsFeedItem[]>([]);
  const [showFeedForm, setShowFeedForm] = useState(false);
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
    const [sourcesRes, targetsRes, feedsRes] = await Promise.all([
      apiAuthFetch("/api/sources", accessToken),
      apiAuthFetch("/api/sync-targets", accessToken),
      apiAuthFetch("/api/ics-feeds", accessToken),
    ]);
    if (sourcesRes.ok) {
      const data = await sourcesRes.json();
      setSources(data);
      if (data.length > 0) {
        const maxFetch = Math.max(...data.map((s: CalendarSource) => s.fetchDaysInAdvance || 90));
        setFetchDays(maxFetch);
      }
    }
    if (targetsRes.ok) {
      const data = await targetsRes.json();
      setSyncTargets(data.targets || []);
    }
    if (feedsRes.ok) setIcsFeeds(await feedsRes.json());
  }

  const allWritableEntries = sources.flatMap((s) =>
    s.calendarEntries.filter((e) => !e.readOnly).map((e) => ({ ...e, sourceName: s.label || s.provider }))
  );

  const targetCalendarIds = new Set(syncTargets.map((t) => t.id));

  function openAddTarget() {
    setEditingTargetId(null);
    setFormTargetCalendarId("");
    setFormSyncMode("full");
    setFormSyncDays(30);
    setFormSkipWorkLocation(true);
    setFormSkipSingleDayAllDay(false);
    setFormSkipDeclined(true);
    setFormSkipFree(false);
    setFormSourceCalendarIds([]);
    setShowTargetForm(true);
  }

  function openEditTarget(t: SyncTarget) {
    setEditingTargetId(t.id);
    setFormTargetCalendarId(t.id);
    setFormSyncMode(t.syncMode);
    setFormSyncDays(t.syncDaysInAdvance);
    setFormSkipWorkLocation(t.skipWorkLocation);
    setFormSkipSingleDayAllDay(t.skipSingleDayAllDay);
    setFormSkipDeclined(t.skipDeclined);
    setFormSkipFree(t.skipFree);
    setFormSourceCalendarIds(t.sourceCalendars.map((c) => c.id));
    setShowTargetForm(true);
  }

  async function saveTarget() {
    if (!accessToken) return;
    setFormSaving(true);
    if (editingTargetId) {
      await apiAuthFetch(`/api/sync-targets/${editingTargetId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          syncMode: formSyncMode,
          syncDaysInAdvance: formSyncDays,
          skipWorkLocation: formSkipWorkLocation,
          skipSingleDayAllDay: formSkipSingleDayAllDay,
          skipDeclined: formSkipDeclined,
          skipFree: formSkipFree,
          sourceCalendarEntryIds: formSourceCalendarIds,
        }),
      });
    } else {
      await apiAuthFetch("/api/sync-targets", accessToken, {
        method: "POST",
        body: JSON.stringify({
          calendarEntryId: formTargetCalendarId,
          syncMode: formSyncMode,
          syncDaysInAdvance: formSyncDays,
          skipWorkLocation: formSkipWorkLocation,
          skipSingleDayAllDay: formSkipSingleDayAllDay,
          skipDeclined: formSkipDeclined,
          skipFree: formSkipFree,
          sourceCalendarEntryIds: formSourceCalendarIds,
        }),
      });
    }
    setFormSaving(false);
    setShowTargetForm(false);
    loadData();
  }

  async function handleDeleteTarget(deleteSyncedEvents: boolean) {
    if (!accessToken || !deleteTargetId) return;
    setDeleteLoading(true);
    await apiAuthFetch(`/api/sync-targets/${deleteTargetId}?deleteSyncedEvents=${deleteSyncedEvents}`, accessToken, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleteTargetId(null);
    loadData();
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
    setShowFeedForm(false);
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Calendar Sync</h1>

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

        {/* Sync Targets */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sync Targets</h2>
            <Button size="sm" color="primary" onPress={openAddTarget}>New Sync Target</Button>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Clone events from source calendars into target calendars. Each target syncs independently.
            </p>

            {syncTargets.length === 0 && !showTargetForm ? (
              <p className="text-default-400">No sync targets configured yet.</p>
            ) : (
              <div className="space-y-3">
                {syncTargets.map((t) => (
                  <div key={t.id} className="rounded-lg border border-default-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <span className="rounded bg-default-100 px-1.5 py-0.5 text-xs font-medium text-default-600">
                          {t.syncMode === "blocked" ? "Blocked" : "Full"}
                        </span>
                        <span className="text-xs text-default-400">{t.source.label || t.source.provider}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="light" onPress={() => openEditTarget(t)}>Edit</Button>
                        <Button size="sm" color="danger" variant="light" onPress={() => setDeleteTargetId(t.id)}>Remove</Button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-default-400">
                      {t.sourceCalendars.length === 0 ? "All source calendars" : `Sources: ${t.sourceCalendars.map((c) => c.name).join(", ")}`}
                      {" "}&bull; {t.syncDaysInAdvance} days
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit target form */}
            {showTargetForm && (
              <div className="mt-4 space-y-4 rounded-lg border border-primary-200 bg-primary-50/30 p-4">
                <p className="text-sm font-semibold">{editingTargetId ? "Edit Sync Target" : "New Sync Target"}</p>
                {!editingTargetId && (
                  <Select
                    label="Target Calendar"
                    placeholder="Select a calendar"
                    selectedKeys={formTargetCalendarId ? new Set([formTargetCalendarId]) : new Set()}
                    onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFormTargetCalendarId(s); }}
                    size="sm"
                  >
                    {allWritableEntries.filter((e) => !targetCalendarIds.has(e.id)).map((entry) => (
                      <SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>
                        {entry.name} ({entry.sourceName})
                      </SelectItem>
                    ))}
                  </Select>
                )}
                <div className="flex gap-3">
                  <Select
                    label="Sync mode"
                    selectedKeys={new Set([formSyncMode])}
                    onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFormSyncMode(s); }}
                    size="sm"
                    className="flex-1"
                  >
                    <SelectItem key="full">Full details</SelectItem>
                    <SelectItem key="blocked">Blocked only (Busy)</SelectItem>
                  </Select>
                  <Select
                    label="Sync period"
                    selectedKeys={new Set([String(formSyncDays)])}
                    onSelectionChange={(keys) => { const d = Number(Array.from(keys)[0]); if (d) setFormSyncDays(d); }}
                    size="sm"
                    className="w-44"
                  >
                    <SelectItem key="30">30 days</SelectItem>
                    <SelectItem key="60">60 days</SelectItem>
                    <SelectItem key="90">90 days</SelectItem>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Switch size="sm" isSelected={formSkipWorkLocation} onValueChange={setFormSkipWorkLocation}>
                    <span className="text-sm">Skip work location events</span>
                  </Switch>
                  <Switch size="sm" isSelected={formSkipSingleDayAllDay} onValueChange={setFormSkipSingleDayAllDay}>
                    <span className="text-sm">Skip single-day all-day events</span>
                  </Switch>
                  <Switch size="sm" isSelected={formSkipDeclined} onValueChange={setFormSkipDeclined}>
                    <span className="text-sm">Skip declined events</span>
                  </Switch>
                  <Switch size="sm" isSelected={formSkipFree} onValueChange={setFormSkipFree}>
                    <span className="text-sm">Skip free/tentative events</span>
                  </Switch>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Source calendars</p>
                  <p className="mb-2 text-xs text-default-400">
                    {formSourceCalendarIds.length === 0 ? "All calendars (default)" : `${formSourceCalendarIds.length} selected`}
                  </p>
                  <CheckboxGroup size="sm" value={formSourceCalendarIds} onChange={(vals) => setFormSourceCalendarIds(vals as string[])}>
                    {sources.map((source) => {
                      const entries = source.calendarEntries.filter((e) => e.id !== formTargetCalendarId);
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
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="light" onPress={() => setShowTargetForm(false)}>Cancel</Button>
                  <Button size="sm" color="primary" isLoading={formSaving} isDisabled={!editingTargetId && !formTargetCalendarId} onPress={saveTarget}>
                    {editingTargetId ? "Save" : "Create"}
                  </Button>
                </div>
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
            {!showFeedForm && (
              <Button size="sm" color="primary" onPress={() => setShowFeedForm(true)}>
                New Feed
              </Button>
            )}
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">
              Create subscribable ICS feeds from your calendars. Use the URL in Google Calendar, Apple Calendar, etc.
            </p>

            {/* Inline new feed form */}
            {showFeedForm && (
              <div className="mb-4 space-y-4 rounded-lg border border-primary-200 bg-primary-50/30 p-4">
                <p className="text-sm font-semibold">New Feed</p>
                <Input label="Name" isRequired value={feedName} onValueChange={setFeedName} placeholder="e.g. Work calendars" size="sm" />
                <div className="flex gap-3">
                  <Select
                    label="Mode"
                    selectedKeys={new Set([feedMode])}
                    onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFeedMode(s); }}
                    size="sm"
                    className="flex-1"
                  >
                    <SelectItem key="full">Full details</SelectItem>
                    <SelectItem key="freebusy">Free/busy only</SelectItem>
                  </Select>
                  <Select
                    label="Days in advance"
                    selectedKeys={new Set([feedDays])}
                    onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) setFeedDays(s); }}
                    size="sm"
                    className="w-36"
                  >
                    <SelectItem key="30">30 days</SelectItem>
                    <SelectItem key="60">60 days</SelectItem>
                    <SelectItem key="90">90 days</SelectItem>
                  </Select>
                </div>
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
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="light" onPress={() => { setShowFeedForm(false); setFeedName(""); setFeedMode("full"); setFeedDays("30"); setFeedCalendarIds([]); }}>Cancel</Button>
                  <Button size="sm" color="primary" isLoading={feedCreating} isDisabled={!feedName.trim()} onPress={createFeed}>Create</Button>
                </div>
              </div>
            )}

            {icsFeeds.length === 0 && !showFeedForm ? (
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

        {/* Delete Target Modal */}
        <Modal isOpen={!!deleteTargetId} onClose={() => setDeleteTargetId(null)}>
          <ModalContent>
            <ModalHeader>Remove Sync Target</ModalHeader>
            <ModalBody>
              <p>Delete synced [Sync] events from the target calendar?</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setDeleteTargetId(null)} isDisabled={deleteLoading}>Cancel</Button>
              <Button variant="flat" isLoading={deleteLoading} onPress={() => handleDeleteTarget(false)}>Keep events</Button>
              <Button color="danger" isLoading={deleteLoading} onPress={() => handleDeleteTarget(true)}>Delete synced events</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
