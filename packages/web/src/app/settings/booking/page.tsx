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

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function BookingSettingsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);

  const [bookingCalendarId, setBookingCalendarId] = useState("");
  const [allCalendarEntries, setAllCalendarEntries] = useState<Array<{ id: string; name: string; sourceName: string }>>([]);

  const [brandColor, setBrandColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.85);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUsernameWarning, setShowUsernameWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accessToken) { loadProfile(); loadEventTypes(); loadAvailability(); loadCalendars(); }
  }, [accessToken]);

  async function loadProfile() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) {
      const data = await res.json();
      setUsername(data.username || ""); setSavedUsername(data.username || ""); setBookingCalendarId(data.bookingCalendarEntryId || "");
      setBrandColor(data.brandColor || ""); setAccentColor(data.accentColor || ""); setAvatarUrl(data.avatarUrl || ""); setBackgroundUrl(data.backgroundUrl || ""); setBackgroundOpacity(data.backgroundOpacity ?? 0.85);
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
    else { const data = await res.json().catch(() => ({})); setUsernameError(data.error || "Speichern fehlgeschlagen"); }
    setUsernameSaving(false);
  }

  function updateRule(dayOfWeek: number, field: string, value: string | boolean) {
    setRules((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r)));
  }

  async function saveAll() {
    if (!accessToken) return;
    setSaving(true);
    await Promise.all([
      apiAuthFetch("/api/availability", accessToken, {
        method: "PUT",
        body: JSON.stringify(rules.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, enabled: r.enabled }))),
      }),
      apiAuthFetch("/api/profile/branding", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          brandColor: brandColor || null,
          accentColor: accentColor || null,
          avatarUrl: avatarUrl || null,
          backgroundUrl: backgroundUrl || null,
          backgroundOpacity: backgroundUrl ? backgroundOpacity : null,
        }),
      }),
    ]);
    setSaving(false);
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Buchungseinstellungen</h1>

        {/* Booking URL */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Buchungs-URL</h2></CardHeader>
          <CardBody>
            <div className="flex items-end gap-2">
              <Input label="Benutzername" value={username} onValueChange={setUsername} description={savedUsername ? `Deine Buchungs-URL: ${bookingBaseUrl}/...` : undefined} errorMessage={usernameError} isInvalid={!!usernameError} className="flex-1" />
              <Button size="sm" color="primary" isLoading={usernameSaving} isDisabled={username === savedUsername} onPress={saveUsername} className="shrink-0">Speichern</Button>
            </div>
          </CardBody>
        </Card>

        {/* Branding + Working Hours + Booking Calendar — single save */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Branding &amp; Standards</h2>
            <Button size="sm" color="primary" isLoading={saving} onPress={saveAll}>Speichern</Button>
          </CardHeader>
          <CardBody className="space-y-6">
            <p className="text-sm text-default-400">Das sind deine Standardwerte. Jede Terminart kann Branding und Arbeitszeiten in den eigenen Einstellungen überschreiben.</p>

            {/* Colors */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Markenfarbe</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor || "#3b82f6"} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                  <Input size="sm" placeholder="#3b82f6" value={brandColor} onValueChange={setBrandColor} className="flex-1" />
                </div>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium">Akzentfarbe</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor || "#6366f1"} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                  <Input size="sm" placeholder="#6366f1" value={accentColor} onValueChange={setAccentColor} className="flex-1" />
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex items-end gap-2">
                  <Input label="Profilfoto" size="sm" value={avatarUrl} onValueChange={setAvatarUrl} placeholder="https://... oder hochladen" className="flex-1" />
                  <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")} className="shrink-0">Hochladen</Button>
                </div>
                {avatarUrl && (
                  <div className="mt-2">
                    <img src={avatarUrl} alt="Preview" className="h-12 w-12 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-end gap-2">
                  <Input label="Hintergrundbild" size="sm" value={backgroundUrl} onValueChange={setBackgroundUrl} placeholder="https://... oder hochladen" className="flex-1" />
                  <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")} className="shrink-0">Hochladen</Button>
                </div>
                {backgroundUrl && (
                  <>
                    <div className="mt-2 h-12 w-full rounded bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,${backgroundOpacity}), rgba(255,255,255,${backgroundOpacity})), url(${backgroundUrl})` }} />
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-default-400 shrink-0">Overlay</span>
                      <input type="range" min="0" max="1" step="0.05" value={backgroundOpacity} onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))} className="flex-1" />
                      <span className="text-xs text-default-400 w-8">{Math.round(backgroundOpacity * 100)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Booking Calendar */}
            {allCalendarEntries.length > 0 && (
              <Select label="Standard-Buchungskalender" placeholder="Kalender auswählen" selectedKeys={bookingCalendarId ? new Set([bookingCalendarId]) : new Set()} onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; if (s) handleSetBookingCalendar(s); }} size="sm">
                {allCalendarEntries.map((entry) => (<SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>{entry.name} ({entry.sourceName})</SelectItem>))}
              </Select>
            )}

            {/* Working Hours */}
            <div>
              <p className="mb-2 text-sm font-medium">Standard-Arbeitszeiten</p>
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
            </div>
          </CardBody>
        </Card>
        {/* Username change warning modal */}
        <Modal isOpen={showUsernameWarning} onClose={() => setShowUsernameWarning(false)}>
          <ModalContent>
            <ModalHeader>Buchungs-URL ändern?</ModalHeader>
            <ModalBody>
              <p>Du hast {eventTypes.length} Terminart{eventTypes.length > 1 ? "en" : ""}. Eine Änderung deines Benutzernamens macht alle bestehenden Buchungslinks ungültig.</p>
              <p className="mt-2 text-sm text-default-500">Wer die alte URL nutzt, erhält eine &quot;Nicht gefunden&quot;-Seite. Kurzlinks (falls vorhanden) funktionieren weiterhin.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowUsernameWarning(false)}>Abbrechen</Button>
              <Button color="danger" onPress={doSaveUsername}>Benutzername ändern</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
