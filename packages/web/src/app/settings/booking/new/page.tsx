"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card, CardBody, CardHeader, Button, Input, Switch,
  Select, SelectItem, Checkbox, CheckboxGroup,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DEFAULT_RULES = [
  { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", enabled: false },
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", enabled: true },
  { dayOfWeek: 6, startTime: "09:00", endTime: "17:00", enabled: false },
];

export default function NewEventTypePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [allCalendarEntries, setAllCalendarEntries] = useState<Array<{ id: string; name: string; sourceName: string }>>([]);

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [slugError, setSlugError] = useState("");
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
  const [formBrandColor, setFormBrandColor] = useState("");
  const [formAccentColor, setFormAccentColor] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formBackgroundUrl, setFormBackgroundUrl] = useState("");
  const [formBackgroundOpacity, setFormBackgroundOpacity] = useState(0.85);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) loadCalendars();
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
    // Client-side slug validation
    const trimmedSlug = formSlug.trim();
    if (trimmedSlug) {
      const normalized = trimmedSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (normalized.length < 3) {
        setSlugError("URL-Pfad muss mindestens 3 Zeichen lang sein.");
        return;
      }
    }
    setSlugError("");
    setSaveError("");
    setSaving(true);
    const body = {
      name: formName,
      slug: trimmedSlug || undefined,
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
    const res = await apiAuthFetch("/api/event-types", accessToken, { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) {
      router.push("/settings/booking");
    } else {
      const data = await res.json().catch(() => ({}));
      const err = data.error || "Speichern fehlgeschlagen";
      if (err.includes("URL-Pfad")) setSlugError(err);
      else setSaveError(err);
    }
  }

  return (
    <AppShell section="event-types">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="light" size="sm" isIconOnly className="text-stone-500" onPress={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
            <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Neue Terminart</h1>
          </div>
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Erstellen</Button>
        </div>

        {/* Section 1: Allgemein */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Allgemein</h2></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Name" isRequired value={formName} onValueChange={setFormName} placeholder="z.B. 30-Min. Gespräch" />
            <Input label="Beschreibung (optional)" value={formDescription} onValueChange={setFormDescription} />
            <div className="flex gap-4">
              <Input label="Dauer (Minuten)" type="number" value={formDuration} onValueChange={setFormDuration} className="w-40" />
              <Input label="Ort (optional)" value={formLocation} onValueChange={setFormLocation} placeholder="z.B. Google Meet Link" className="flex-1" />
            </div>
            <Input label="URL-Pfad (optional)" value={formSlug} onValueChange={(v) => { setFormSlug(v); setSlugError(""); }} placeholder="Wird automatisch aus dem Namen erzeugt" description="Mindestens 3 Zeichen. Leer lassen für automatische Generierung." errorMessage={slugError} isInvalid={!!slugError} />
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={formShortLink} onValueChange={setFormShortLink} />
              <span className="text-sm font-medium">Kurzer Buchungslink</span>
            </div>
            {formShortLink && <p className="text-xs text-default-400">Kurzlink wird beim Speichern erstellt.</p>}
          </CardBody>
        </Card>

        {saveError && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger">{saveError}</div>
        )}

        {/* Section 2: Verfügbarkeit */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Verfügbarkeit</h2></CardHeader>
          <CardBody className="space-y-5">
            <div>
              <Select label="Buchungskalender" placeholder="Standard verwenden" selectedKeys={formBookingCalendarId ? new Set([formBookingCalendarId]) : new Set()} onSelectionChange={(keys) => { const s = Array.from(keys)[0] as string; setFormBookingCalendarId(s || ""); }} size="sm">
                {allCalendarEntries.map((entry) => (<SelectItem key={entry.id} textValue={`${entry.name} (${entry.sourceName})`}>{entry.name} ({entry.sourceName})</SelectItem>))}
              </Select>
              <p className="mt-1 text-xs text-default-400">In diesem Kalender werden bestätigte Buchungen erstellt.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Verfügbarkeitskalender</label>
              <p className="mb-2 text-xs text-default-400">{formCalendarIds.length === 0 ? "Alle Kalender werden geprüft (Standard)" : `${formCalendarIds.length} ausgewählt`}</p>
              <CheckboxGroup size="sm" value={formCalendarIds} onChange={(vals) => setFormCalendarIds(vals as string[])}>
                {allCalendarEntries.map((entry) => (<Checkbox key={entry.id} value={entry.id}><span className="text-sm">{entry.name} ({entry.sourceName})</span></Checkbox>))}
              </CheckboxGroup>
            </div>
            <div className="border-t border-default-100 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Switch size="sm" isSelected={formCustomHours} onValueChange={setFormCustomHours} />
                <span className="text-sm font-medium">Eigene Arbeitszeiten</span>
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
          </CardBody>
        </Card>

        {/* Section 3: Erweitert */}
        <details className="group">
          <summary className="cursor-pointer font-display text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
            Erweitert ▸
          </summary>
          <div className="mt-3 space-y-4">
            <Card>
              <CardHeader><h2 className="text-lg font-semibold">Nach der Buchung</h2></CardHeader>
              <CardBody className="space-y-4">
                <Input label="Weiterleitungs-URL" value={formRedirectUrl} onValueChange={setFormRedirectUrl} placeholder="https://..." />
                {formRedirectUrl && (
                  <div className="flex gap-4">
                    <Input label="Link-Titel" value={formRedirectTitle} onValueChange={setFormRedirectTitle} placeholder="z.B. Zum Meeting beitreten" className="flex-1" />
                    <Input label="Verzögerung (s)" type="number" value={formRedirectDelay} onValueChange={setFormRedirectDelay} className="w-24" />
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><h2 className="text-lg font-semibold">Branding</h2></CardHeader>
              <CardBody>
                <p className="mb-4 text-xs text-default-400">Passe das Erscheinungsbild deiner Buchungsseite an. Leer lassen, um die Standardwerte zu verwenden.</p>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium">Markenfarbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formBrandColor || "#9F1239"} onChange={(e) => setFormBrandColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                        <Input size="sm" placeholder="Standard verwenden" value={formBrandColor} onValueChange={setFormBrandColor} className="flex-1" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium">Akzentfarbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formAccentColor || "#D97706"} onChange={(e) => setFormAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                        <Input size="sm" placeholder="Standard verwenden" value={formAccentColor} onValueChange={setFormAccentColor} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-1 items-end gap-2">
                      <Input label="Profilfoto" size="sm" value={formAvatarUrl} onValueChange={setFormAvatarUrl} placeholder="Standard verwenden" className="flex-1" />
                      <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")} className="shrink-0">Hochladen</Button>
                    </div>
                    <div className="flex flex-1 items-end gap-2">
                      <Input label="Hintergrundbild" size="sm" value={formBackgroundUrl} onValueChange={setFormBackgroundUrl} placeholder="Standard verwenden" className="flex-1" />
                      <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")} className="shrink-0">Hochladen</Button>
                    </div>
                  </div>
                  {formBackgroundUrl && (
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-xs text-default-400">Overlay</span>
                      <input type="range" min="0" max="1" step="0.05" value={formBackgroundOpacity} onChange={(e) => setFormBackgroundOpacity(parseFloat(e.target.value))} className="flex-1" />
                      <span className="w-8 text-xs text-default-400">{Math.round(formBackgroundOpacity * 100)}%</span>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </details>

        {/* Bottom save button */}
        <div className="flex justify-end pb-6">
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Erstellen</Button>
        </div>
      </div>
    </AppShell>
  );
}
