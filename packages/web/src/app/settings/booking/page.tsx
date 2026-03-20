"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Input, Switch, Divider, Select, SelectItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Checkbox, CheckboxGroup,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface EventType {
  id: string;
  slug: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  location: string | null;
  color: string;
  enabled: boolean;
  redirectUrl: string | null;
  redirectTitle: string | null;
  redirectDelaySecs: number;
  calendars?: Array<{ id: string; name: string }>;
  bookingCalendarEntryId: string | null;
  shortHash: string | null;
  availabilityRules?: Array<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }>;
}

interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_RULES = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", enabled: false },
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 6, startTime: "09:00", endTime: "17:00", enabled: false },
];

export default function BookingSettingsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  // Unified modal state (create when editingId is null, edit when set)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingShortHash, setEditingShortHash] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDuration, setFormDuration] = useState("30");
  const [formDescription, setFormDescription] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formRedirectUrl, setFormRedirectUrl] = useState("");
  const [formRedirectTitle, setFormRedirectTitle] = useState("");
  const [formRedirectDelay, setFormRedirectDelay] = useState("5");
  const [formCalendarIds, setFormCalendarIds] = useState<string[]>([]);
  const [formBookingCalendarId, setFormBookingCalendarId] = useState("");
  const [formCustomHours, setFormCustomHours] = useState(false);
  const [formRules, setFormRules] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }>>([]);
  const [formShortLink, setFormShortLink] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  const [bookingCalendarId, setBookingCalendarId] = useState("");
  const [allCalendarEntries, setAllCalendarEntries] = useState<Array<{ id: string; name: string; sourceName: string }>>([]);

  const isEditing = editingId !== null;

  useEffect(() => {
    if (accessToken) { loadProfile(); loadEventTypes(); loadAvailability(); loadCalendars(); }
  }, [accessToken]);

  async function loadProfile() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) { const data = await res.json(); setUsername(data.username || ""); setSavedUsername(data.username || ""); setBookingCalendarId(data.bookingCalendarEntryId || ""); }
  }

  async function loadCalendars() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/sources", accessToken);
    if (res.ok) {
      const sources = await res.json();
      setAllCalendarEntries(sources.flatMap((s: { calendarEntries: Array<{ id: string; name: string; readOnly: boolean }>; label: string | null; provider: string }) =>
        s.calendarEntries.filter((e: { readOnly: boolean }) => !e.readOnly).map((e: { id: string; name: string }) => ({ ...e, sourceName: s.label || s.provider }))
      ));
    }
  }

  async function handleSetBookingCalendar(calendarEntryId: string) {
    if (!accessToken) return;
    await apiAuthFetch("/api/profile/booking-calendar", accessToken, { method: "PUT", body: JSON.stringify({ bookingCalendarEntryId: calendarEntryId || null }) });
    setBookingCalendarId(calendarEntryId);
  }

  async function loadEventTypes() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/event-types", accessToken);
    if (res.ok) setEventTypes(await res.json());
  }

  async function loadAvailability() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/availability", accessToken);
    if (res.ok) setRules(await res.json());
  }

  async function saveUsername() {
    if (!accessToken) return;
    setUsernameSaving(true); setUsernameError("");
    const res = await apiAuthFetch("/api/profile/username", accessToken, { method: "PUT", body: JSON.stringify({ username }) });
    if (res.ok) { const data = await res.json(); setSavedUsername(data.username); }
    else { const data = await res.json().catch(() => ({})); setUsernameError(data.error || "Failed to save"); }
    setUsernameSaving(false);
  }

  function openCreateModal() {
    setEditingId(null);
    setEditingShortHash(null);
    setFormName(""); setFormDuration("30"); setFormDescription(""); setFormLocation("");
    setFormRedirectUrl(""); setFormRedirectTitle(""); setFormRedirectDelay("5");
    setFormCalendarIds([]); setFormBookingCalendarId(""); setFormCustomHours(false);
    setFormRules(DEFAULT_RULES.map((r) => ({ ...r }))); setFormShortLink(false);
    setShowModal(true);
  }

  function openEditModal(et: EventType) {
    setEditingId(et.id);
    setEditingShortHash(et.shortHash);
    setFormName(et.name); setFormDuration(String(et.durationMinutes));
    setFormDescription(et.description || ""); setFormLocation(et.location || "");
    setFormRedirectUrl(et.redirectUrl || ""); setFormRedirectTitle(et.redirectTitle || "");
    setFormRedirectDelay(String(et.redirectDelaySecs));
    setFormCalendarIds((et.calendars ?? []).map((c) => c.id));
    setFormBookingCalendarId(et.bookingCalendarEntryId || "");
    setFormShortLink(!!et.shortHash);
    const hasCustomRules = (et.availabilityRules ?? []).length > 0;
    setFormCustomHours(hasCustomRules);
    setFormRules(hasCustomRules ? (et.availabilityRules ?? []) : DEFAULT_RULES.map((r) => ({ ...r })));
    setShowModal(true);
  }

  async function handleSaveModal() {
    if (!accessToken || !formName.trim()) return;
    setModalSaving(true);

    const body: Record<string, unknown> = {
      name: formName,
      durationMinutes: parseInt(formDuration) || 30,
      description: formDescription || null,
      location: formLocation || null,
      redirectUrl: formRedirectUrl || null,
      redirectTitle: formRedirectTitle || null,
      redirectDelaySecs: formRedirectUrl ? (parseInt(formRedirectDelay) || 5) : 5,
      calendarEntryIds: formCalendarIds,
      bookingCalendarEntryId: formBookingCalendarId || null,
      availabilityRules: formCustomHours ? formRules : undefined,
      enableShortLink: formShortLink,
    };

    if (isEditing) {
      await apiAuthFetch(`/api/event-types/${editingId}`, accessToken, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await apiAuthFetch("/api/event-types", accessToken, { method: "POST", body: JSON.stringify(body) });
    }

    setShowModal(false);
    setModalSaving(false);
    loadEventTypes();
  }

  async function toggleEventType(id: string, enabled: boolean) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/event-types/${id}`, accessToken, { method: "PUT", body: JSON.stringify({ enabled }) });
    loadEventTypes();
  }

  async function deleteEventType(id: string) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/event-types/${id}`, accessToken, { method: "DELETE" });
    loadEventTypes();
  }

  function updateRule(dayOfWeek: number, field: string, value: string | boolean) {
    setRules((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)));
  }

  async function saveRules() {
    if (!accessToken) return;
    setSavingRules(true);
    await apiAuthFetch("/api/availability", accessToken, {
      method: "PUT",
      body: JSON.stringify(rules.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, enabled: r.enabled }))),
    });
    setSavingRules(false);
  }

  const bookingBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${savedUsername}` : "";

  return (
    <AppShell section="bookings">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="light" size="sm" isIconOnly className="text-gray-500">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Booking Settings</h1>
        </div>

        {/* Username */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Booking URL</h2></CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">Set your username for public booking links.</p>
            <div className="flex items-end gap-2">
              <Input label="Username" value={username} onValueChange={setUsername} description={savedUsername ? `Your booking URL: ${bookingBaseUrl}/...` : undefined} errorMessage={usernameError} isInvalid={!!usernameError} className="flex-1" />
              <Button size="sm" color="primary" isLoading={usernameSaving} isDisabled={username === savedUsername} onPress={saveUsername} className="shrink-0">Save</Button>
            </div>
          </CardBody>
        </Card>

        {/* Event Types */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event Types</h2>
            <Button size="sm" color="primary" onPress={openCreateModal}>New Event Type</Button>
          </CardHeader>
          <CardBody>
            {eventTypes.length === 0 ? (
              <p className="text-default-400">No event types yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {eventTypes.map((et) => (
                  <div key={et.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: et.color }} />
                        <div>
                          <span className="font-medium">{et.name}</span>
                          <span className="ml-2 text-sm text-default-400">{et.durationMinutes} min</span>
                        </div>
                      </div>
                      {savedUsername && et.enabled && (
                        <div className="ml-6 mt-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <code className="rounded bg-default-100 px-2 py-1 text-xs text-default-600">{bookingBaseUrl}/{et.slug}</code>
                            <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`${bookingBaseUrl}/${et.slug}`)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                            </Button>
                          </div>
                          {et.shortHash && (
                            <div className="flex items-center gap-1.5">
                              <code className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{typeof window !== "undefined" ? window.location.origin : ""}/B/{et.shortHash}</code>
                              <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`${window.location.origin}/B/${et.shortHash}`)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch size="sm" isSelected={et.enabled} onValueChange={(v) => toggleEventType(et.id, v)} />
                      <Link href={`/settings/booking/${et.id}/preview`}><Button size="sm" variant="light">Preview</Button></Link>
                      <Button size="sm" variant="light" onPress={() => openEditModal(et)}>Edit</Button>
                      <Button size="sm" color="danger" variant="light" onPress={() => deleteEventType(et.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Defaults */}
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Defaults (used when event type has no override)</p>

        {/* Default Booking Calendar */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Default Booking Calendar</h2></CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">Used when an event type has no booking calendar set.</p>
            {allCalendarEntries.length === 0 ? (
              <p className="text-default-400">Connect a calendar with write access first.</p>
            ) : (
              <Select label="Booking Calendar" placeholder="Select a calendar" selectedKeys={bookingCalendarId ? new Set([bookingCalendarId]) : new Set()} onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) handleSetBookingCalendar(s); }}>
                {allCalendarEntries.map((entry) => (<SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>{entry.name} ({entry.sourceName})</SelectItem>))}
              </Select>
            )}
          </CardBody>
        </Card>

        {/* Default Working Hours */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Default Working Hours</h2>
            <Button size="sm" color="primary" isLoading={savingRules} onPress={saveRules}>Save</Button>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.dayOfWeek} className="flex items-center gap-3">
                  <Switch size="sm" isSelected={rule.enabled} onValueChange={(v) => updateRule(rule.dayOfWeek, "enabled", v)} />
                  <span className="w-10 text-sm font-medium">{DAY_NAMES[rule.dayOfWeek]}</span>
                  <Input type="time" size="sm" value={rule.startTime} onValueChange={(v) => updateRule(rule.dayOfWeek, "startTime", v)} isDisabled={!rule.enabled} className="w-28" />
                  <span className="text-sm text-default-400">–</span>
                  <Input type="time" size="sm" value={rule.endTime} onValueChange={(v) => updateRule(rule.dayOfWeek, "endTime", v)} isDisabled={!rule.enabled} className="w-28" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Unified Event Type Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="2xl" scrollBehavior="inside" placement="center">
          <ModalContent>
            <ModalHeader>{isEditing ? "Edit Event Type" : "New Event Type"}</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input label="Name" isRequired value={formName} onValueChange={setFormName} placeholder="e.g. 30-min Call" />
                <div className="flex gap-4">
                  <Input label="Duration (minutes)" type="number" value={formDuration} onValueChange={setFormDuration} className="w-40" />
                  <Input label="Location (optional)" value={formLocation} onValueChange={setFormLocation} placeholder="e.g. Google Meet link" className="flex-1" />
                </div>
                <Input label="Description (optional)" value={formDescription} onValueChange={setFormDescription} />

                <Divider />
                <p className="text-sm font-medium">After booking (optional)</p>
                <Input label="Redirect URL" value={formRedirectUrl} onValueChange={setFormRedirectUrl} placeholder="https://..." />
                {formRedirectUrl && (
                  <div className="flex gap-4">
                    <Input label="Link title" value={formRedirectTitle} onValueChange={setFormRedirectTitle} placeholder="e.g. Join the meeting" className="flex-1" />
                    <Input label="Delay (s)" type="number" value={formRedirectDelay} onValueChange={setFormRedirectDelay} className="w-24" />
                  </div>
                )}

                <Divider />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Switch size="sm" isSelected={formShortLink} onValueChange={setFormShortLink} />
                    <span className="text-sm font-medium">Short booking link</span>
                  </div>
                  {formShortLink && editingShortHash && (
                    <div className="flex items-center gap-1.5">
                      <code className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{typeof window !== "undefined" ? window.location.origin : ""}/B/{editingShortHash}</code>
                      <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`${window.location.origin}/B/${editingShortHash}`)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      </Button>
                    </div>
                  )}
                  {formShortLink && !editingShortHash && <p className="text-xs text-default-400">Short link will be generated on save.</p>}
                </div>

                <Divider />
                <Select label="Booking calendar" placeholder="Use default" selectedKeys={formBookingCalendarId ? new Set([formBookingCalendarId]) : new Set()} onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; setFormBookingCalendarId(s || ""); }} size="sm">
                  {allCalendarEntries.map((entry) => (<SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>{entry.name} ({entry.sourceName})</SelectItem>))}
                </Select>

                <Divider />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Switch size="sm" isSelected={formCustomHours} onValueChange={setFormCustomHours} />
                    <span className="text-sm font-medium">Custom working hours</span>
                  </div>
                  {formCustomHours && (
                    <div className="space-y-2">
                      {formRules.map((rule, idx) => (
                        <div key={rule.dayOfWeek} className="flex items-center gap-3">
                          <Switch size="sm" isSelected={rule.enabled} onValueChange={(v) => { const u = [...formRules]; u[idx] = { ...rule, enabled: v }; setFormRules(u); }} />
                          <span className="w-10 text-sm font-medium">{DAY_NAMES[rule.dayOfWeek]}</span>
                          <Input type="time" size="sm" value={rule.startTime} onValueChange={(v) => { const u = [...formRules]; u[idx] = { ...rule, startTime: v }; setFormRules(u); }} isDisabled={!rule.enabled} className="w-28" />
                          <span className="text-sm text-default-400">–</span>
                          <Input type="time" size="sm" value={rule.endTime} onValueChange={(v) => { const u = [...formRules]; u[idx] = { ...rule, endTime: v }; setFormRules(u); }} isDisabled={!rule.enabled} className="w-28" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Divider />
                <div>
                  <p className="text-sm font-medium">Calendars for availability check</p>
                  <p className="mb-2 text-xs text-default-400">{formCalendarIds.length === 0 ? "All calendars (default)" : `${formCalendarIds.length} selected`}</p>
                  <CheckboxGroup size="sm" value={formCalendarIds} onChange={(vals) => setFormCalendarIds(vals as string[])}>
                    {allCalendarEntries.map((entry) => (<Checkbox key={entry.id} value={entry.id}><span className="text-sm">{entry.name} ({entry.sourceName})</span></Checkbox>))}
                  </CheckboxGroup>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowModal(false)}>Cancel</Button>
              <Button color="primary" isLoading={modalSaving} onPress={handleSaveModal}>{isEditing ? "Save" : "Create"}</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
