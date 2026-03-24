"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Input, Switch, Select, SelectItem, Tooltip,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface EventType {
  id: string;
  slug: string;
  name: string;
  durationMinutes: number;
  color: string;
  enabled: boolean;
  shortHash: string | null;
}

interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingSettingsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  const [bookingCalendarId, setBookingCalendarId] = useState("");
  const [allCalendarEntries, setAllCalendarEntries] = useState<Array<{ id: string; name: string; sourceName: string }>>([]);

  const [brandColor, setBrandColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUsernameWarning, setShowUsernameWarning] = useState(false);

  useEffect(() => {
    if (accessToken) { loadProfile(); loadEventTypes(); loadAvailability(); loadCalendars(); }
  }, [accessToken]);

  async function loadProfile() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) {
      const data = await res.json();
      setUsername(data.username || ""); setSavedUsername(data.username || ""); setBookingCalendarId(data.bookingCalendarEntryId || "");
      setBrandColor(data.brandColor || ""); setAccentColor(data.accentColor || ""); setAvatarUrl(data.avatarUrl || ""); setBackgroundUrl(data.backgroundUrl || "");
    }
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

  function saveUsername() {
    if (!accessToken) return;
    if (savedUsername && eventTypes.length > 0 && username !== savedUsername) {
      setShowUsernameWarning(true);
      return;
    }
    doSaveUsername();
  }

  async function doSaveUsername() {
    if (!accessToken) return;
    setShowUsernameWarning(false);
    setUsernameSaving(true); setUsernameError("");
    const res = await apiAuthFetch("/api/profile/username", accessToken, { method: "PUT", body: JSON.stringify({ username }) });
    if (res.ok) { const data = await res.json(); setSavedUsername(data.username); }
    else { const data = await res.json().catch(() => ({})); setUsernameError(data.error || "Failed to save"); }
    setUsernameSaving(false);
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

  async function saveBranding() {
    if (!accessToken) return;
    setBrandingSaving(true);
    await apiAuthFetch("/api/profile/branding", accessToken, {
      method: "PUT",
      body: JSON.stringify({
        brandColor: brandColor || null,
        accentColor: accentColor || null,
        avatarUrl: avatarUrl || null,
        backgroundUrl: backgroundUrl || null,
      }),
    });
    setBrandingSaving(false);
  }

  async function uploadImage(type: "avatar" | "background") {
    if (!accessToken) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(type);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/profile/image/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "avatar") setAvatarUrl(data.url);
        else setBackgroundUrl(data.url);
      }
      setUploading(null);
    };
    input.click();
  }

  const bookingBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${savedUsername}` : "";

  return (
    <AppShell section="settings" settingsSection="booking">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Booking Settings</h1>

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

        {/* Branding */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Branding</h2></CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">Customize how your booking pages look to guests.</p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={brandColor || "#3b82f6"} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                    <Input size="sm" placeholder="#3b82f6" value={brandColor} onValueChange={setBrandColor} className="flex-1" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={accentColor || "#6366f1"} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                    <Input size="sm" placeholder="#6366f1" value={accentColor} onValueChange={setAccentColor} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex items-end gap-2">
                    <Input label="Profile Photo" size="sm" value={avatarUrl} onValueChange={setAvatarUrl} placeholder="https://... or upload" className="flex-1" />
                    <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")} className="shrink-0">Upload</Button>
                  </div>
                  {avatarUrl && (
                    <div className="mt-2">
                      <img src={avatarUrl} alt="Preview" className="h-12 w-12 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-end gap-2">
                    <Input label="Background Image" size="sm" value={backgroundUrl} onValueChange={setBackgroundUrl} placeholder="https://... or upload" className="flex-1" />
                    <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")} className="shrink-0">Upload</Button>
                  </div>
                  {backgroundUrl && (
                    <div className="mt-2 h-12 w-full rounded bg-cover bg-center" style={{ backgroundImage: `url(${backgroundUrl})` }} />
                  )}
                </div>
              </div>
              <Button size="sm" color="primary" isLoading={brandingSaving} onPress={saveBranding}>Save Branding</Button>
            </div>
          </CardBody>
        </Card>

        {/* Event Types */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event Types</h2>
            <Link href="/settings/booking/new"><Button size="sm" color="primary">New Event Type</Button></Link>
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
                    <div className="flex items-center gap-1">
                      <Switch size="sm" isSelected={et.enabled} onValueChange={(v) => toggleEventType(et.id, v)} />
                      {savedUsername && et.enabled && (
                        <>
                          <Tooltip content="Booking preview">
                            <Button size="sm" variant="light" isIconOnly as="a" href={`${bookingBaseUrl}/${et.slug}`} target="_blank" rel="noopener noreferrer">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </Button>
                          </Tooltip>
                          <Tooltip content="Availability preview">
                            <Button size="sm" variant="light" isIconOnly as="a" href={`/settings/booking/${et.id}/preview`} target="_blank" rel="noopener noreferrer">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </Button>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip content="Edit">
                        <Link href={`/settings/booking/${et.id}/edit`}>
                          <Button size="sm" variant="light" isIconOnly>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </Button>
                        </Link>
                      </Tooltip>
                      <Tooltip content="Delete">
                        <Button size="sm" color="danger" variant="light" isIconOnly onPress={() => deleteEventType(et.id)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </Button>
                      </Tooltip>
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
        {/* Username change warning modal */}
        <Modal isOpen={showUsernameWarning} onClose={() => setShowUsernameWarning(false)}>
          <ModalContent>
            <ModalHeader>Change Booking URL?</ModalHeader>
            <ModalBody>
              <p>You have {eventTypes.length} event type{eventTypes.length > 1 ? "s" : ""}. Changing your username will break all existing booking links.</p>
              <p className="mt-2 text-sm text-default-500">Anyone with the old URL will get a &quot;not found&quot; page. Short links (if any) will still work.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowUsernameWarning(false)}>Cancel</Button>
              <Button color="danger" onPress={doSaveUsername}>Change Username</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
