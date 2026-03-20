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

export default function NewEventTypePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

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
  const [saving, setSaving] = useState(false);

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
    };
    const res = await apiAuthFetch("/api/event-types", accessToken, { method: "POST", body: JSON.stringify(body) });
    setSaving(false);
    if (res.ok) router.push("/settings/booking");
  }

  return (
    <AppShell section="bookings">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings/booking">
              <Button variant="light" size="sm" isIconOnly className="text-gray-500">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">New Event Type</h1>
          </div>
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Create</Button>
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
            {formShortLink && <p className="mt-2 text-xs text-default-400">Short link will be generated on save.</p>}
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
          <Button color="primary" isLoading={saving} isDisabled={!formName.trim()} onPress={handleSave}>Create</Button>
        </div>
      </div>
    </AppShell>
  );
}
