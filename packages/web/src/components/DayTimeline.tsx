"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiAuthFetch } from "@/lib/api";

interface TimelineEvent {
  id: string;
  start: string;
  end: string;
  color: string;
}

interface Props {
  eventStart: string;
  eventEnd: string;
  eventColor: string;
}

export function DayTimeline({ eventStart, eventEnd, eventColor }: Props) {
  const { data: session } = useSession();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const accessToken = (session as { accessToken?: string })?.accessToken;

  const dayStart = new Date(eventStart);
  dayStart.setHours(7, 0, 0, 0);
  const dayEnd = new Date(eventStart);
  dayEnd.setHours(21, 0, 0, 0);
  const totalMs = dayEnd.getTime() - dayStart.getTime();

  useEffect(() => {
    if (!accessToken) return;
    const start = new Date(eventStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    apiAuthFetch(
      `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`,
      accessToken
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setEvents(
          data
            .filter((e: { allDay: boolean; title: string }) => !e.allDay && !e.title.startsWith("[Sync] "))
            .map((e: { id: string; startTime: string; endTime: string; calendarEntry: { color: string; userColor?: string | null } }) => ({
              id: e.id,
              start: e.startTime,
              end: e.endTime,
              color: e.calendarEntry.userColor || e.calendarEntry.color || "#3b82f6",
            }))
        );
      });
  }, [accessToken, eventStart]);

  function pct(iso: string) {
    const t = new Date(iso).getTime();
    return Math.max(0, Math.min(100, ((t - dayStart.getTime()) / totalMs) * 100));
  }

  // Now indicator
  const now = new Date();
  const sameDay = now.toDateString() === new Date(eventStart).toDateString();
  const nowPct = sameDay ? pct(now.toISOString()) : -1;

  return (
    <div className="relative h-5 w-full rounded-full bg-stone-100 overflow-hidden">
      {/* Hour markers */}
      {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => {
        const d = new Date(eventStart);
        d.setHours(h, 0, 0, 0);
        const p = pct(d.toISOString());
        return (
          <div
            key={h}
            className="absolute top-0 h-full w-px bg-stone-200"
            style={{ left: `${p}%` }}
          />
        );
      })}

      {/* Events */}
      {events.map((e) => {
        const left = pct(e.start);
        const right = pct(e.end);
        const isHighlighted =
          new Date(e.start).getTime() === new Date(eventStart).getTime() &&
          new Date(e.end).getTime() === new Date(eventEnd).getTime();
        return (
          <div
            key={e.id}
            className={`absolute top-0.5 bottom-0.5 rounded-full ${isHighlighted ? "ring-2 ring-stone-800 ring-offset-1" : ""}`}
            style={{
              left: `${left}%`,
              width: `${Math.max(right - left, 0.5)}%`,
              backgroundColor: isHighlighted ? eventColor : e.color,
              opacity: isHighlighted ? 1 : 0.4,
            }}
          />
        );
      })}

      {/* Now indicator */}
      {nowPct >= 0 && nowPct <= 100 && (
        <div
          className="absolute top-0 h-full w-0.5 bg-rose-500"
          style={{ left: `${nowPct}%` }}
        />
      )}

      {/* Time labels */}
      <span className="absolute left-1 top-0 text-[8px] leading-5 text-stone-400">7</span>
      <span className="absolute right-1 top-0 text-[8px] leading-5 text-stone-400">21</span>
    </div>
  );
}
