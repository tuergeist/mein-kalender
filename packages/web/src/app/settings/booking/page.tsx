"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Input, Switch, Select, SelectItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
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
