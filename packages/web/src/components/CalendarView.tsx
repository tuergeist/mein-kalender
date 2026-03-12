"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
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

  function handleViewChange(view: string) {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }

  async function handleEventDrop(info: { event: { id: string; start: Date | null; end: Date | null; extendedProps: { readOnly: boolean } }; revert: () => void }) {
    if (info.event.extendedProps.readOnly) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <ButtonGroup size="sm">
          <Button
            variant={currentView === "dayGridMonth" ? "solid" : "bordered"}
            onPress={() => handleViewChange("dayGridMonth")}
          >
            Month
          </Button>
          <Button
            variant={currentView === "timeGridWeek" ? "solid" : "bordered"}
            onPress={() => handleViewChange("timeGridWeek")}
          >
            Week
          </Button>
          <Button
            variant={currentView === "timeGridDay" ? "solid" : "bordered"}
            onPress={() => handleViewChange("timeGridDay")}
          >
            Day
          </Button>
          <Button
            variant={currentView === "listWeek" ? "solid" : "bordered"}
            onPress={() => handleViewChange("listWeek")}
          >
            List
          </Button>
        </ButtonGroup>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="light"
            onPress={() => calendarRef.current?.getApi().prev()}
          >
            &larr; Prev
          </Button>
          <Button
            size="sm"
            variant="light"
            onPress={() => calendarRef.current?.getApi().today()}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="light"
            onPress={() => calendarRef.current?.getApi().next()}
          >
            Next &rarr;
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "dayGridMonth"}
          events={events}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={(info) => {
            setSelectedEvent(info.event.toPlainObject() as unknown as CalendarEvent);
          }}
          datesSet={(dateInfo) => {
            fetchEvents(dateInfo.start, dateInfo.end);
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
