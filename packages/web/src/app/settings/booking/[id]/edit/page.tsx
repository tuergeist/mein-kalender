"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import {
  Card, CardBody, CardHeader, Button, Input, Switch,
  Select, SelectItem, Checkbox, CheckboxGroup,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

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

interface EventType {
  id: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  location: string | null;
  redirectUrl: string | null;
  redirectTitle: string | null;
  redirectDelaySecs: number;
  calendars?: Array<{ id: string; name: string }>;
  bookingCalendarEntryId: string | null;
  shortHash: string | null;
  availabilityRules?: Array<{ dayOfWeek: number; startTime: string; endTime: string; enabled: boolean }>;
  brandColor: string | null;
  accentColor: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  backgroundOpacity: number | null;
}

export default function EditEventTypePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [loading, setLoading] = useState(true);
  const [allCalendarEntries, setAllCalendarEntries] = useState<Array<{ id: string; name: string; sourceName: string }>>([]);

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
  const [formRules, setFormRules] = useState(DEFAULT_RULES.map((r) => ({ ...r })));
  const [formShortLink, setFormShortLink] = useState(false);
  const [shortHash, setShortHash] = useState<string | null>(null);
  const [formBrandColor, setFormBrandColor] = useState("");
  const [formAccentColor, setFormAccentColor] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formBackgroundUrl, setFormBackgroundUrl] = useState("");
  const [formBackgroundOpacity, setFormBackgroundOpacity] = useState(0.85);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      Promise.all([loadCalendars(), loadEventType()]).then(() => setLoading(false));
    }
  }, [accessToken]);

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

  async function loadEventType() {
    if (!accessToken) return;
    const res = await apiAuthFetch(`/api/event-types/${id}`, accessToken);
    if (res.ok) {
      const et: EventType = await res.json();
      setFormName(et.name);
      setFormDuration(String(et.durationMinutes));
      setFormDescription(et.description || "");
      setFormLocation(et.location || "");
      setFormRedirectUrl(et.redirectUrl || "");
      setFormRedirectTitle(et.redirectTitle || "");
      setFormRedirectDelay(String(et.redirectDelaySecs));
      setFormCalendarIds((et.calendars ?? []).map((c) => c.id));
      setFormBookingCalendarId(et.bookingCalendarEntryId || "");
      setFormShortLink(!!et.shortHash);
      setShortHash(et.shortHash);
      const hasCustomRules = (et.availabilityRules ?? []).length > 0;
      setFormCustomHours(hasCustomRules);
      setFormRules(hasCustomRules ? (et.availabilityRules ?? []) : DEFAULT_RULES.map((r) => ({ ...r })));
      setFormBrandColor(et.brandColor || "");
      setFormAccentColor(et.accentColor || "");
      setFormAvatarUrl(et.avatarUrl || "");
      setFormBackgroundUrl(et.backgroundUrl || "");
      setFormBackgroundOpacity(et.backgroundOpacity ?? 0.85);
    }
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
      const res = await fetch(`/api/profile/image/${type}?skipUserUpdate=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "avatar") setFormAvatarUrl(data.url);
        else setFormBackgroundUrl(data.url);
      }
      setUploading(null);
    };
    input.click();
  }

  async function handleSave() {
    if (!accessToken || !formName.trim()) return;
    setSaving(true);
    const body = {
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
      brandColor: formBrandColor || null,
      accentColor: formAccentColor || null,
      avatarUrl: formAvatarUrl || null,
      backgroundUrl: formBackgroundUrl || null,
      backgroundOpacity: formBackgroundUrl ? formBackgroundOpacity : null,
    };
    const res = await apiAuthFetch(`/api/event-types/${id}`, accessToken, { method: "PUT", body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) router.push("/settings/booking");
  }

  if (loading) {
    return (
      <AppShell section="settings" settingsSection="booking">
        <div className="mx-auto max-w-3xl py-12 text-center text-default-400">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell section="settings" settingsSection="booking">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="light" size="sm" isIconOnly className="text-stone-500" onPress={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
            <h1 className="font-display text-2xl font-bold tracking-tight">Edit Event Type</h1>
          </div>
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Save</Button>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Basic Info</h2></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Name" isRequired value={formName} onValueChange={setFormName} placeholder="e.g. 30-min Call" />
            <div className="flex gap-4">
              <Input label="Duration (minutes)" type="number" value={formDuration} onValueChange={setFormDuration} className="w-40" />
              <Input label="Location (optional)" value={formLocation} onValueChange={setFormLocation} placeholder="e.g. Google Meet link" className="flex-1" />
            </div>
            <Input label="Description (optional)" value={formDescription} onValueChange={setFormDescription} />
          </CardBody>
        </Card>

        {/* After Booking */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">After Booking</h2></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Redirect URL" value={formRedirectUrl} onValueChange={setFormRedirectUrl} placeholder="https://..." />
            {formRedirectUrl && (
              <div className="flex gap-4">
                <Input label="Link title" value={formRedirectTitle} onValueChange={setFormRedirectTitle} placeholder="e.g. Join the meeting" className="flex-1" />
                <Input label="Delay (s)" type="number" value={formRedirectDelay} onValueChange={setFormRedirectDelay} className="w-24" />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Links</h2></CardHeader>
          <CardBody>
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={formShortLink} onValueChange={setFormShortLink} />
              <span className="text-sm font-medium">Short booking link</span>
            </div>
            {formShortLink && shortHash && (
              <div className="mt-2 flex items-center gap-1.5">
                <code className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{typeof window !== "undefined" ? window.location.origin : ""}/B/{shortHash}</code>
                <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`${window.location.origin}/B/${shortHash}`)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </Button>
              </div>
            )}
            {formShortLink && !shortHash && <p className="mt-2 text-xs text-default-400">Short link will be generated on save.</p>}
          </CardBody>
        </Card>

        {/* Booking Calendar */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Booking Calendar</h2></CardHeader>
          <CardBody>
            <Select label="Booking calendar" placeholder="Use default" selectedKeys={formBookingCalendarId ? new Set([formBookingCalendarId]) : new Set()} onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; setFormBookingCalendarId(s || ""); }} size="sm">
              {allCalendarEntries.map((entry) => (<SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>{entry.name} ({entry.sourceName})</SelectItem>))}
            </Select>
          </CardBody>
        </Card>

        {/* Working Hours */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Working Hours</h2></CardHeader>
          <CardBody>
            <div className="mb-3 flex items-center gap-2">
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
          </CardBody>
        </Card>

        {/* Branding Override */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Branding Override</h2></CardHeader>
          <CardBody>
            <p className="mb-4 text-xs text-default-400">Override your default branding for this event type. Leave empty to use defaults.</p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formBrandColor || "#3b82f6"} onChange={(e) => setFormBrandColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                    <Input size="sm" placeholder="Use default" value={formBrandColor} onValueChange={setFormBrandColor} className="flex-1" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={formAccentColor || "#6366f1"} onChange={(e) => setFormAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                    <Input size="sm" placeholder="Use default" value={formAccentColor} onValueChange={setFormAccentColor} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-1 items-end gap-2">
                  <Input label="Profile Photo" size="sm" value={formAvatarUrl} onValueChange={setFormAvatarUrl} placeholder="Use default" className="flex-1" />
                  <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")} className="shrink-0">Upload</Button>
                </div>
                <div className="flex flex-1 items-end gap-2">
                  <Input label="Background Image" size="sm" value={formBackgroundUrl} onValueChange={setFormBackgroundUrl} placeholder="Use default" className="flex-1" />
                  <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")} className="shrink-0">Upload</Button>
                </div>
              </div>
              {formBackgroundUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-400 shrink-0">Overlay</span>
                  <input type="range" min="0" max="1" step="0.05" value={formBackgroundOpacity} onChange={(e) => setFormBackgroundOpacity(parseFloat(e.target.value))} className="flex-1" />
                  <span className="text-xs text-default-400 w-8">{Math.round(formBackgroundOpacity * 100)}%</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Availability Calendars */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Availability Calendars</h2></CardHeader>
          <CardBody>
            <p className="mb-2 text-xs text-default-400">{formCalendarIds.length === 0 ? "All calendars (default)" : `${formCalendarIds.length} selected`}</p>
            <CheckboxGroup size="sm" value={formCalendarIds} onChange={(vals) => setFormCalendarIds(vals as string[])}>
              {allCalendarEntries.map((entry) => (<Checkbox key={entry.id} value={entry.id}><span className="text-sm">{entry.name} ({entry.sourceName})</span></Checkbox>))}
            </CheckboxGroup>
          </CardBody>
        </Card>

        {/* Bottom save button */}
        <div className="flex justify-end pb-6">
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Save</Button>
        </div>
      </div>
    </AppShell>
  );
}
