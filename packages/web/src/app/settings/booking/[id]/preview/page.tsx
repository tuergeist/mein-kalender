"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Button, Card, CardBody } from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface BusyBlock {
  start: string;
  end: string;
  title: string;
  calendar: string;
  color: string;
}

interface BookingBlock {
  start: string;
  end: string;
  guestName: string;
}

interface DayPreview {
  date: string;
  workingHours: { start: string; end: string; enabled: boolean };
  busyBlocks: BusyBlock[];
  bookings: BookingBlock[];
  availableSlots: string[];
}

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const HOUR_START = 7;
const HOUR_END = 21;
const TOTAL_MINUTES = (HOUR_END - HOUR_START) * 60;

function timeToMinutes(time: string): number {
  const d = new Date(time);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPct(minutes: number): number {
  return ((minutes - HOUR_START * 60) / TOTAL_MINUTES) * 100;
}

export default function AvailabilityPreviewPage() {
  const { data: session } = useSession();
  const params = useParams();
  const eventTypeId = params.id as string;
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [days, setDays] = useState<DayPreview[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (accessToken) loadPreview();
  }, [accessToken, weekStart]);

  async function loadPreview() {
    if (!accessToken) return;
    const res = await apiAuthFetch(`/api/event-types/${eventTypeId}/availability-preview?week=${weekStart}`, accessToken);
    if (res.ok) {
      const data = await res.json();
      setDays(data.days);
    }
  }

  function navigateWeek(offset: number) {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  return (
    <AppShell section="event-types">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/settings/booking">
            <Button variant="light" size="sm" isIconOnly className="text-gray-500">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </Link>
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Verfügbarkeitsvorschau</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="light" onPress={() => navigateWeek(-1)}>&lsaquo; Zurück</Button>
          <span className="text-sm font-medium">
            Woche ab {new Date(weekStart + "T00:00:00Z").toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button size="sm" variant="light" onPress={() => navigateWeek(1)}>Weiter &rsaquo;</Button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-200" /> Verfügbar</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-orange-300" /> Buchung</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-blue-300" /> Belegt</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-200" /> Außerhalb der Arbeitszeiten</span>
        </div>

        <Card>
          <CardBody className="overflow-x-auto p-0">
            <div className="flex min-w-[700px]">
              {/* Time labels */}
              <div className="w-12 shrink-0 border-r border-gray-200 pt-8">
                {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                  <div key={i} className="relative h-12 text-right">
                    <span className="absolute -top-2 right-1 text-[10px] text-gray-400">{String(HOUR_START + i).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => {
                const dateObj = new Date(day.date + "T00:00:00Z");
                const dayName = DAY_NAMES[dateObj.getUTCDay()];
                const dayNum = dateObj.getUTCDate();

                return (
                  <div key={day.date} className="relative flex-1 border-r border-gray-100 last:border-r-0">
                    {/* Header */}
                    <div className="h-8 border-b border-gray-200 px-1 text-center">
                      <span className="text-xs font-medium text-gray-500">{dayName}</span>
                      <span className="ml-1 text-xs text-gray-400">{dayNum}</span>
                    </div>

                    {/* Time grid */}
                    <div className="relative" style={{ height: `${(HOUR_END - HOUR_START) * 48}px` }}>
                      {/* Hour lines */}
                      {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-gray-100" style={{ top: `${(i / (HOUR_END - HOUR_START)) * 100}%` }} />
                      ))}

                      {/* Outside working hours overlay */}
                      {day.workingHours.enabled ? (
                        <>
                          <div className="absolute w-full bg-gray-100/60" style={{ top: 0, height: `${minutesToPct(hhmmToMinutes(day.workingHours.start))}%` }} />
                          <div className="absolute w-full bg-gray-100/60" style={{ top: `${minutesToPct(hhmmToMinutes(day.workingHours.end))}%`, bottom: 0 }} />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gray-100/60" />
                      )}

                      {/* Available slots */}
                      {day.availableSlots.map((slot) => {
                        const startMin = timeToMinutes(slot);
                        return (
                          <div
                            key={slot}
                            className="absolute left-0.5 right-0.5 rounded-sm bg-green-200/60"
                            style={{
                              top: `${minutesToPct(startMin)}%`,
                              height: `${(30 / TOTAL_MINUTES) * 100}%`,
                            }}
                          />
                        );
                      })}

                      {/* Busy events */}
                      {day.busyBlocks.map((block, i) => {
                        const startMin = timeToMinutes(block.start);
                        const endMin = timeToMinutes(block.end);
                        return (
                          <div
                            key={`busy-${i}`}
                            className="absolute left-0.5 right-0.5 overflow-hidden rounded-sm px-0.5 text-[9px] text-white"
                            style={{
                              top: `${minutesToPct(startMin)}%`,
                              height: `${((endMin - startMin) / TOTAL_MINUTES) * 100}%`,
                              backgroundColor: block.color || "#3b82f6",
                              minHeight: "8px",
                            }}
                            title={`${block.title} (${block.calendar})`}
                          >
                            {block.title}
                          </div>
                        );
                      })}

                      {/* Bookings */}
                      {day.bookings.map((booking, i) => {
                        const startMin = timeToMinutes(booking.start);
                        const endMin = timeToMinutes(booking.end);
                        return (
                          <div
                            key={`booking-${i}`}
                            className="absolute left-0.5 right-0.5 overflow-hidden rounded-sm bg-orange-300 px-0.5 text-[9px] text-white"
                            style={{
                              top: `${minutesToPct(startMin)}%`,
                              height: `${((endMin - startMin) / TOTAL_MINUTES) * 100}%`,
                              minHeight: "8px",
                            }}
                            title={`Booking: ${booking.guestName}`}
                          >
                            {booking.guestName}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
