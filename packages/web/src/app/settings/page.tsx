"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Switch,
  Checkbox,
  CheckboxGroup,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface CalendarEntry {
  id: string;
  name: string;
  color: string;
  readOnly: boolean;
  isTarget: boolean;
}

interface CalendarSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncInterval: number;
  calendarEntries: CalendarEntry[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<string | null>(null);
  const [showUnsetTargetModal, setShowUnsetTargetModal] = useState(false);
  const [unsetLoading, setUnsetLoading] = useState(false);
  const [unsetStatus, setUnsetStatus] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");
  const [cleanupCalendarId, setCleanupCalendarId] = useState("");
  const [targetCalendarId, setTargetCalendarId] = useState<string>("");
  const [syncDaysInAdvance, setSyncDaysInAdvance] = useState<number>(30);
  const [skipWorkLocation, setSkipWorkLocation] = useState(true);
  const [skipSingleDayAllDay, setSkipSingleDayAllDay] = useState(false);
  const [skipDeclined, setSkipDeclined] = useState(true);
  const [skipFree, setSkipFree] = useState(false);
  const [sourceCalendarIds, setSourceCalendarIds] = useState<string[]>([]);
  const [mapProvider, setMapProvider] = useState<string>("google");
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    setMapProvider(localStorage.getItem("mapProvider") || "google");
  }, []);

  useEffect(() => {
    if (accessToken) loadData();
  }, [accessToken]);

  async function loadData() {
    if (!accessToken) return;

    const [sourcesRes, targetRes] = await Promise.all([
      apiAuthFetch("/api/sources", accessToken),
      apiAuthFetch("/api/target-calendar", accessToken),
    ]);

    if (sourcesRes.ok) setSources(await sourcesRes.json());
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

  async function handleDisconnect(sourceId: string) {
    if (!accessToken) return;

    await apiAuthFetch(`/api/sources/${sourceId}`, accessToken, { method: "DELETE" });
    setShowDisconnectModal(null);
    loadData();
  }

  const [targetSaving, setTargetSaving] = useState(false);
  const [targetDirty, setTargetDirty] = useState(false);

  async function saveTargetSettings() {
    if (!accessToken || !targetCalendarId) return;
    setTargetSaving(true);
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
    setTargetSaving(false);
    setTargetDirty(false);
  }

  async function handleUnsetTarget(deleteSyncedEvents: boolean) {
    if (!accessToken) return;

    setUnsetLoading(true);
    setUnsetStatus(
      deleteSyncedEvents
        ? "Deleting synced events from target calendar — this may take a few minutes..."
        : "Unsetting target calendar..."
    );

    const res = await apiAuthFetch(
      `/api/target-calendar?deleteSyncedEvents=${deleteSyncedEvents}`,
      accessToken,
      { method: "DELETE" }
    );

    if (res.ok) {
      const data = await res.json();
      if (deleteSyncedEvents && data.deletedEvents > 0) {
        setUnsetStatus(`Done — deleted ${data.deletedEvents} synced event(s).`);
      } else if (deleteSyncedEvents) {
        setUnsetStatus("Done — target unset. Some events may not have been deleted due to rate limits.");
      } else {
        setUnsetStatus("Done — target calendar unset.");
      }
    } else {
      setUnsetStatus("Done — target unset. Some provider deletions may have failed.");
    }

    setTargetCalendarId("");
    setTimeout(() => {
      setShowUnsetTargetModal(false);
      setUnsetStatus("");
      setUnsetLoading(false);
      loadData();
    }, 2000);
  }

  async function handleCleanupSyncEvents() {
    if (!accessToken) return;

    const calendarEntryId = cleanupCalendarId;
    if (!calendarEntryId) {
      setCleanupStatus("Please select a calendar to clean up.");
      return;
    }

    setCleanupLoading(true);
    setCleanupStatus("Scanning calendar for [Sync] events — this may take a few minutes...");

    const res = await apiAuthFetch("/api/target-calendar/cleanup", accessToken, {
      method: "POST",
      body: JSON.stringify({ calendarEntryId }),
    });

    if (res.ok) {
      const data = await res.json();
      setCleanupStatus(
        `Done — deleted ${data.deleted} of ${data.found} [Sync] event(s).` +
          (data.failed > 0 ? ` ${data.failed} failed (rate limited).` : "")
      );
    } else {
      setCleanupStatus("Cleanup failed — check if target calendar is set.");
    }

    setCleanupLoading(false);
  }

  function handleAddProvider(provider: string) {
    const origin = window.location.origin;
    const redirectUri = `${origin}/api/oauth/${provider}/callback`;

    window.location.href = `${origin}/api/oauth/${provider}/start?redirect=${encodeURIComponent(redirectUri)}`;
    setShowAddModal(false);
  }

  const allSourceCalendars = sources.flatMap((s) =>
    s.calendarEntries.map((e) => ({
      ...e,
      sourceName: s.label || s.provider,
    }))
  );

  const allCalendarEntries = sources.flatMap((s) =>
    s.calendarEntries
      .filter((e) => !e.readOnly)
      .map((e) => ({
        ...e,
        sourceName: s.label || s.provider,
      }))
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/calendar">
            <Button variant="light" size="sm" isIconOnly className="text-gray-500">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Connected Sources */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Calendar Sources</h2>
            <Button size="sm" color="primary" onPress={() => setShowAddModal(true)}>
              Add Calendar
            </Button>
          </CardHeader>
          <CardBody>
            {sources.length === 0 ? (
              <p className="text-default-500">No calendars connected yet.</p>
            ) : (
              <div className="space-y-4">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {source.label || source.provider}
                        </span>
                        <Chip size="sm" variant="flat">
                          {source.provider}
                        </Chip>
                        {source.syncStatus === "error" && (
                          <Chip size="sm" color="danger" variant="flat">
                            Error
                          </Chip>
                        )}
                      </div>
                      <p className="text-sm text-default-400">
                        {source.calendarEntries.length} calendar(s) &bull; Sync every{" "}
                        {source.syncInterval / 60} min
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => setShowDisconnectModal(source.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Target Calendar */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Target Calendar</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Select a writable calendar to clone all events into. This is optional — the
              unified UI view works without a target.
            </p>

            {allCalendarEntries.length === 0 ? (
              <p className="text-default-400">
                Connect a calendar with write access to set a target.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <Select
                  label="Target Calendar"
                  placeholder="Select a calendar"
                  selectedKeys={targetCalendarId ? new Set([targetCalendarId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) {
                      setTargetCalendarId(selected);
                      setTargetDirty(true);
                    }
                  }}
                  className="flex-1"
                >
                  {allCalendarEntries.map((entry) => (
                    <SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>
                      {entry.name} ({entry.sourceName})
                    </SelectItem>
                  ))}
                </Select>
                {targetCalendarId && (
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={() => setShowUnsetTargetModal(true)}
                    className="shrink-0"
                  >
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
                    const days = Number(Array.from(keys)[0]);
                    if (days) { setSyncDaysInAdvance(days); setTargetDirty(true); }
                  }}
                  size="sm"
                  className="max-w-xs"
                >
                  <SelectItem key="30">30 days in advance</SelectItem>
                  <SelectItem key="60">60 days in advance</SelectItem>
                  <SelectItem key="90">90 days in advance</SelectItem>
                </Select>
                <div className="space-y-2">
                  <Switch
                    size="sm"
                    isSelected={skipWorkLocation}
                    onValueChange={(v) => { setSkipWorkLocation(v); setTargetDirty(true); }}
                  >
                    <span className="text-sm">Skip work location events</span>
                  </Switch>
                  <Switch
                    size="sm"
                    isSelected={skipSingleDayAllDay}
                    onValueChange={(v) => { setSkipSingleDayAllDay(v); setTargetDirty(true); }}
                  >
                    <span className="text-sm">Skip single-day all-day events (birthdays, holidays)</span>
                  </Switch>
                  <Switch
                    size="sm"
                    isSelected={skipDeclined}
                    onValueChange={(v) => { setSkipDeclined(v); setTargetDirty(true); }}
                  >
                    <span className="text-sm">Skip declined events</span>
                  </Switch>
                  <Switch
                    size="sm"
                    isSelected={skipFree}
                    onValueChange={(v) => { setSkipFree(v); setTargetDirty(true); }}
                  >
                    <span className="text-sm">Skip free/tentative events</span>
                  </Switch>
                </div>
                <Divider />
                <div>
                  <p className="mb-2 text-sm font-medium">Source calendars to sync</p>
                  <p className="mb-2 text-xs text-default-400">
                    {sourceCalendarIds.length === 0 ? "All calendars (default)" : `${sourceCalendarIds.length} selected`}
                  </p>
                  <CheckboxGroup
                    size="sm"
                    value={sourceCalendarIds}
                    onChange={(vals) => { setSourceCalendarIds(vals as string[]); setTargetDirty(true); }}
                  >
                    {allSourceCalendars.map((entry) => (
                      <Checkbox key={entry.id} value={entry.id}>
                        <span className="text-sm">{entry.name} ({entry.sourceName})</span>
                      </Checkbox>
                    ))}
                  </CheckboxGroup>
                </div>
                <Button
                  size="sm"
                  color="primary"
                  isLoading={targetSaving}
                  isDisabled={!targetDirty}
                  onPress={saveTargetSettings}
                >
                  Save
                </Button>
              </div>
            )}

            <Divider className="my-4" />
            <p className="mb-2 text-sm font-medium">Clean up [Sync] events</p>
            <p className="mb-3 text-xs text-default-400">
              Select a calendar and delete all events prefixed with &quot;[Sync]&quot;.
            </p>
            <div className="flex items-end gap-2">
              <Select
                label="Calendar to clean"
                placeholder="Select a calendar"
                selectedKeys={cleanupCalendarId ? new Set([cleanupCalendarId]) : new Set()}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setCleanupCalendarId(selected);
                }}
                className="flex-1"
                size="sm"
              >
                {allCalendarEntries.map((entry) => (
                  <SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>
                    {entry.name} ({entry.sourceName})
                  </SelectItem>
                ))}
              </Select>
              <Button
                size="sm"
                variant="flat"
                color="warning"
                isLoading={cleanupLoading}
                isDisabled={!cleanupCalendarId}
                onPress={handleCleanupSyncEvents}
                className="shrink-0"
              >
                Clean up
              </Button>
            </div>
            {cleanupStatus && (
              <p className="mt-2 text-sm text-primary">{cleanupStatus}</p>
            )}
          </CardBody>
        </Card>

        {/* Booking Settings */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Booking Page</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">
              Set up event types, working hours, and your public booking URL.
            </p>
            <Link href="/settings/booking">
              <Button size="sm" color="primary">Configure Booking</Button>
            </Link>
          </CardBody>
        </Card>

        {/* Map Provider */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Map Provider</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Choose which map service to use for event locations.
            </p>
            <Select
              label="Map Provider"
              selectedKeys={[mapProvider]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) {
                  setMapProvider(selected);
                  localStorage.setItem("mapProvider", selected);
                }
              }}
            >
              <SelectItem key="google">Google Maps</SelectItem>
              <SelectItem key="osm">OpenStreetMap</SelectItem>
              <SelectItem key="apple">Apple Maps</SelectItem>
              <SelectItem key="none">No map</SelectItem>
            </Select>
          </CardBody>
        </Card>

        {/* Add Calendar Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <ModalContent>
            <ModalHeader>Add Calendar</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => handleAddProvider("google")}
                >
                  Google Calendar
                </Button>
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => handleAddProvider("outlook")}
                >
                  Microsoft Outlook
                </Button>
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => {
                    setShowAddModal(false);
                    // Navigate to Proton setup page
                    window.location.href = "/settings/proton";
                  }}
                >
                  Proton Calendar (via Bridge)
                </Button>
                <Divider />
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => {
                    setShowAddModal(false);
                    window.location.href = "/settings/ics";
                  }}
                >
                  Import ICS File / URL
                </Button>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Disconnect Confirmation Modal */}
        <Modal
          isOpen={!!showDisconnectModal}
          onClose={() => setShowDisconnectModal(null)}
        >
          <ModalContent>
            <ModalHeader>Disconnect Calendar</ModalHeader>
            <ModalBody>
              <p>
                Are you sure you want to disconnect this calendar? All synced events from
                this source will be removed.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowDisconnectModal(null)}>
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={() => handleDisconnect(showDisconnectModal!)}
              >
                Disconnect
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Unset Target Calendar Modal */}
        <Modal
          isOpen={showUnsetTargetModal}
          onClose={() => setShowUnsetTargetModal(false)}
        >
          <ModalContent>
            <ModalHeader>Unset Target Calendar</ModalHeader>
            <ModalBody>
              <p>
                Do you want to delete all synced events (prefixed with &quot;[Sync]&quot;) from the
                target calendar?
              </p>
              <p className="text-sm text-default-400">
                If you choose &quot;Keep events&quot;, the cloned events will remain on the target
                calendar but will no longer be managed by this app.
              </p>
            </ModalBody>
            {unsetStatus && (
              <ModalBody>
                <p className="text-sm font-medium text-primary">{unsetStatus}</p>
              </ModalBody>
            )}
            <ModalFooter>
              <Button variant="light" onPress={() => setShowUnsetTargetModal(false)} isDisabled={unsetLoading}>
                Cancel
              </Button>
              <Button
                variant="flat"
                isLoading={unsetLoading}
                onPress={() => handleUnsetTarget(false)}
              >
                Keep events
              </Button>
              <Button
                color="danger"
                isLoading={unsetLoading}
                onPress={() => handleUnsetTarget(true)}
              >
                Delete synced events
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
