"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Switch, Tooltip,
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
  bookingCalendarEntry: { id: string; name: string } | null;
}

export default function EventTypesPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [savedUsername, setSavedUsername] = useState("");

  useEffect(() => {
    if (accessToken) { loadProfile(); loadEventTypes(); }
  }, [accessToken]);

  async function loadProfile() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) { const data = await res.json(); setSavedUsername(data.username || ""); }
  }

  async function loadEventTypes() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/event-types", accessToken);
    if (res.ok) setEventTypes(await res.json());
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

  const bookingBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${savedUsername}` : "";

  return (
    <AppShell section="settings" settingsSection="events">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Terminarten</h1>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Deine Terminarten</h2>
            <Link href="/settings/booking/new"><Button size="sm" color="primary">Neue Terminart</Button></Link>
          </CardHeader>
          <CardBody>
            {eventTypes.length === 0 ? (
              <p className="text-default-400">Noch keine Terminarten. Erstelle eine, um loszulegen.</p>
            ) : (
              <div className="space-y-3">
                {eventTypes.map((et) => (
                  <div key={et.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: et.color }} />
                        <div>
                          <span className="font-medium">{et.name}</span>
                          <span className="ml-2 font-mono text-sm text-default-400">{et.durationMinutes} min</span>
                          {et.bookingCalendarEntry && (
                            <span className="ml-2 rounded bg-default-100 px-1.5 py-0.5 text-xs text-default-500">{et.bookingCalendarEntry.name}</span>
                          )}
                        </div>
                      </div>
                      {savedUsername && et.enabled && (
                        <div className="ml-6 mt-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <a href={`${bookingBaseUrl}/${et.slug}`} target="_blank" rel="noopener noreferrer" className="rounded bg-default-100 px-2 py-1 text-xs text-default-600 hover:underline">{bookingBaseUrl}/{et.slug}</a>
                            <Button size="sm" variant="light" isIconOnly className="h-7 w-7 min-w-0" onPress={() => navigator.clipboard.writeText(`${bookingBaseUrl}/${et.slug}`)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                            </Button>
                          </div>
                          {et.shortHash && (
                            <div className="flex items-center gap-1.5">
                              <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/B/${et.shortHash}`} target="_blank" rel="noopener noreferrer" className="rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:underline">{typeof window !== "undefined" ? window.location.origin : ""}/B/{et.shortHash}</a>
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
                          <Tooltip content="Buchungsvorschau">
                            <Button size="sm" variant="light" isIconOnly as="a" href={`${bookingBaseUrl}/${et.slug}`} target="_blank" rel="noopener noreferrer">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </Button>
                          </Tooltip>
                          <Tooltip content="Verfügbarkeitsvorschau">
                            <Button size="sm" variant="light" isIconOnly as="a" href={`/settings/booking/${et.id}/preview`} target="_blank" rel="noopener noreferrer">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </Button>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip content="Bearbeiten">
                        <Link href={`/settings/booking/${et.id}/edit`}>
                          <Button size="sm" variant="light" isIconOnly>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </Button>
                        </Link>
                      </Tooltip>
                      <Tooltip content="Löschen">
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
      </div>
    </AppShell>
  );
}
