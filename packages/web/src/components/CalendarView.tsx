"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import deLocale from "@fullcalendar/core/locales/de";
import { Button, ButtonGroup } from "@heroui/react";
import { apiAuthFetch } from "@/lib/api";
import { EventDetailModal } from "./EventDetailModal";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  extendedProps: {
    description: string | null;
    location: string | null;
    calendarName: string;
    calendarColor: string;
    readOnly: boolean;
    sourceEventId: string;
  };
}

export function CalendarView() {
  const { data: session } = useSession();
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentView, setCurrentView] = useState("dayGridMonth");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && currentView === "dayGridMonth") {
      setCurrentView("listWeek");
      calendarRef.current?.getApi().changeView("listWeek");
    }
  }, [isMobile]);

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      const token = (session as { accessToken?: string })?.accessToken;
      if (!token) return;

      const res = await apiAuthFetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`,
        token
      );

      if (res.ok) {
        const data = await res.json();
        const mapped: CalendarEvent[] = data.map(
          (e: {
            id: string;
            title: string;
            startTime: string;
            endTime: string;
            allDay: boolean;
            description: string | null;
            location: string | null;
            sourceEventId: string;
            calendarEntry: {
              name: string;
              color: string;
              readOnly: boolean;
            };
          }) => ({
            id: e.id,
            title: e.title,
            start: e.startTime,
            end: e.endTime,
            allDay: e.allDay,
            backgroundColor: e.calendarEntry.color,
            borderColor: e.calendarEntry.color,
            extendedProps: {
              description: e.description,
              location: e.location,
              calendarName: e.calendarEntry.name,
              calendarColor: e.calendarEntry.color,
              readOnly: e.calendarEntry.readOnly,
              sourceEventId: e.sourceEventId,
            },
          })
        );
        setEvents(mapped);
      }
    },
    [session]
  );

  useEffect(() => {
    if (session && dateRange) {
      fetchEvents(dateRange.start, dateRange.end);
    }
  }, [session, dateRange, fetchEvents]);

  function handleViewChange(view: string) {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }

  async function handleEventDrop(info: any) {
    if (info.event.extendedProps?.readOnly) {
      info.revert();
      return;
    }

    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    const res = await apiAuthFetch(`/api/events/${info.event.id}`, token, {
      method: "PUT",
      body: JSON.stringify({
        startTime: info.event.start?.toISOString(),
        endTime: info.event.end?.toISOString(),
      }),
    });

    if (!res.ok) {
      info.revert();
    }
  }

  const title = calendarRef.current?.getApi()?.view?.title || "";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ButtonGroup size="sm" variant="flat">
            <Button
              className={currentView === "dayGridMonth" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}
              onPress={() => handleViewChange("dayGridMonth")}
            >
              Month
            </Button>
            <Button
              className={currentView === "timeGridWeek" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}
              onPress={() => handleViewChange("timeGridWeek")}
            >
              Week
            </Button>
            <Button
              className={currentView === "timeGridDay" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}
              onPress={() => handleViewChange("timeGridDay")}
            >
              Day
            </Button>
            <Button
              className={currentView === "listWeek" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}
              onPress={() => handleViewChange("listWeek")}
            >
              List
            </Button>
          </ButtonGroup>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="light"
            isIconOnly
            className="text-gray-500"
            onPress={() => calendarRef.current?.getApi().prev()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="h-8 min-w-0 px-3 text-xs font-medium text-gray-600"
            onPress={() => calendarRef.current?.getApi().today()}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="light"
            isIconOnly
            className="text-gray-500"
            onPress={() => calendarRef.current?.getApi().next()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "dayGridMonth"}
          locale={deLocale}
          firstDay={1}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayMaxEvents={true}
          events={events}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={(info) => {
            setSelectedEvent(info.event.toPlainObject() as unknown as CalendarEvent);
          }}
          datesSet={(dateInfo) => {
            setDateRange({ start: dateInfo.start, end: dateInfo.end });
          }}
          headerToolbar={false}
          height="100%"
        />
      </div>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onUpdate={() => {
          const api = calendarRef.current?.getApi();
          if (api) {
            fetchEvents(api.view.activeStart, api.view.activeEnd);
          }
        }}
      />
    </div>
  );
}
