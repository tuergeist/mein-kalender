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
import { extractColorsFromImage } from "@/lib/extract-colors";

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

interface EventType {
  id: string;
  slug: string;
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
  const [shortHash, setShortHash] = useState<string | null>(null);
  const [formBrandColor, setFormBrandColor] = useState("");
  const [formAccentColor, setFormAccentColor] = useState("");
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formBackgroundUrl, setFormBackgroundUrl] = useState("");
  const [formBackgroundOpacity, setFormBackgroundOpacity] = useState(0.85);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [suggestedColors, setSuggestedColors] = useState<{ brand: string; accent: string } | null>(null);

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
      setFormSlug(et.slug || "");
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
      const res = await fetch(`/api/profile/image/${type}?skipUserUpdate=true&scope=et-${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "avatar") {
          setFormAvatarUrl(data.url);
        } else {
          setFormBackgroundUrl(data.url);
          // Extract colors from background image and suggest them
          const localUrl = URL.createObjectURL(file);
          const colors = await extractColorsFromImage(localUrl);
          URL.revokeObjectURL(localUrl);
          if (colors) setSuggestedColors(colors);
        }
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
      slug: trimmedSlug,
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
    if (res.ok) {
      router.push("/settings/booking");
    } else {
      const data = await res.json().catch(() => ({}));
      const err = data.error || "Speichern fehlgeschlagen";
      if (err.includes("URL-Pfad")) setSlugError(err);
      else setSaveError(err);
    }
  }

  if (loading) {
    return (
      <AppShell section="event-types">
        <div className="mx-auto max-w-3xl py-12 text-center text-default-400">Laden...</div>
      </AppShell>
    );
  }

  return (
    <AppShell section="event-types">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="light" size="sm" isIconOnly className="text-stone-500" onPress={() => router.back()}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
            <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Terminart bearbeiten</h1>
          </div>
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Speichern</Button>
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
            <Input label="URL-Pfad" value={formSlug} onValueChange={(v) => { setFormSlug(v); setSlugError(""); }} placeholder="z.B. beratung" description="Mindestens 3 Zeichen." errorMessage={slugError} isInvalid={!!slugError} />
            <div className="flex items-center gap-2">
              <Switch size="sm" isSelected={formShortLink} onValueChange={setFormShortLink} />
              <span className="text-sm font-medium">Kurzer Buchungslink</span>
            </div>
            {formShortLink && shortHash && (
              <div className="flex items-center gap-1.5">
                <code className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">mcal.ink/{shortHash}</code>
                <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`https://mcal.ink/${shortHash}`)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </Button>
              </div>
            )}
            {formShortLink && !shortHash && <p className="text-xs text-default-400">Kurzlink wird beim Speichern erstellt.</p>}
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
              {formBookingCalendarId && !formBrandColor && !formBackgroundUrl && (
                <div className="mt-2 rounded-lg border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] px-3 py-2">
                  <p className="text-xs text-[var(--color-amber-700)]">
                    Tipp: Dieser Kalender unterscheidet sich vom Standard. Passe unter <button type="button" onClick={() => document.querySelector("details")?.setAttribute("open", "")} className="font-medium underline underline-offset-2">Erweitert &rarr; Branding</button> das Erscheinungsbild der Buchungsseite an.
                  </p>
                </div>
              )}
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
              <CardHeader><h2 className="text-lg font-semibold">Branding-Überschreibung</h2></CardHeader>
              <CardBody>
                <p className="mb-4 text-xs text-default-400">Überschreibe dein Standard-Branding für diese Terminart. Leer lassen, um die Standardwerte zu verwenden.</p>
                <div className="space-y-4">
                  {suggestedColors && !formBrandColor && !formAccentColor && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormBrandColor(suggestedColors.brand);
                        setFormAccentColor(suggestedColors.accent);
                        setSuggestedColors(null);
                      }}
                      className="flex items-center gap-3 rounded-lg border border-[var(--color-amber-200)] bg-[var(--color-amber-50)] px-4 py-3 text-left transition-shadow hover:shadow-md"
                    >
                      <div className="flex gap-1.5">
                        <span className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: suggestedColors.brand }} />
                        <span className="inline-block h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: suggestedColors.accent }} />
                      </div>
                      <span className="text-xs font-medium text-[var(--color-amber-800)]">Farben aus Hintergrundbild übernehmen</span>
                    </button>
                  )}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium">Markenfarbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formBrandColor || "#3b82f6"} onChange={(e) => setFormBrandColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                        <Input size="sm" placeholder="Standard verwenden" value={formBrandColor} onValueChange={setFormBrandColor} className="flex-1" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium">Akzentfarbe</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={formAccentColor || "#6366f1"} onChange={(e) => setFormAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border border-default-200 p-0.5" />
                        <Input size="sm" placeholder="Standard verwenden" value={formAccentColor} onValueChange={setFormAccentColor} className="flex-1" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="flex-1">
                      <label className="mb-1.5 block text-sm font-medium">Profilfoto</label>
                      {formAvatarUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={formAvatarUrl} alt="Profilfoto" className="h-12 w-12 rounded-full object-cover border border-default-200" />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-default-500">Bild hochgeladen</span>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")}>Ersetzen</Button>
                              <Button size="sm" variant="flat" color="danger" onPress={() => setFormAvatarUrl("")}>Entfernen</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-default-300 bg-default-50 shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-default-400"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
                          </div>
                          <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")}>Hochladen</Button>
                        </div>
                      )}
                    </div>
                    {/* Background */}
                    <div className="flex-1">
                      <label className="mb-1.5 block text-sm font-medium">Hintergrundbild</label>
                      {formBackgroundUrl ? (
                        <div className="space-y-1.5">
                          <img src={formBackgroundUrl} alt="Hintergrundbild" className="h-24 w-full rounded-lg object-cover border border-default-200" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-default-500">Bild hochgeladen</span>
                            <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")}>Ersetzen</Button>
                            <Button size="sm" variant="flat" color="danger" onPress={() => setFormBackgroundUrl("")}>Entfernen</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-default-300 bg-default-50 shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-default-400"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 4-4 5 5"/></svg>
                          </div>
                          <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")}>Hochladen</Button>
                        </div>
                      )}
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
          </div>
        </details>

        {/* Bottom save button */}
        <div className="flex justify-end pb-6">
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Speichern</Button>
        </div>
      </div>
    </AppShell>
  );
}
