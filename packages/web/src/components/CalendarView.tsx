"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    calendarEntryId: string;
    calendarName: string;
    calendarColor: string;
    readOnly: boolean;
    sourceEventId: string;
    providerMetadata: Record<string, unknown> | null;
  };
}

export function CalendarView() {
  const { data: session } = useSession();
  const calendarRef = useRef<FullCalendar>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string> | null>(null);
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
    function handleVisibilityChange(e: Event) {
      const ids = (e as CustomEvent).detail.visibleCalendars as string[];
      setVisibleCalendarIds(new Set(ids));
    }
    window.addEventListener("calendar-visibility-change", handleVisibilityChange);
    return () => window.removeEventListener("calendar-visibility-change", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (isMobile && currentView === "dayGridMonth") {
      setCurrentView("listWeek");
      calendarRef.current?.getApi().changeView("listWeek");
    }
  }, [isMobile]);

  const accessToken = (session as { accessToken?: string })?.accessToken;

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!accessToken) return;

      const res = await apiAuthFetch(
        `/api/events?start=${start.toISOString()}&end=${end.toISOString()}`,
        accessToken
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
            providerMetadata: Record<string, unknown> | null;
            calendarEntry: {
              id: string;
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
              calendarEntryId: e.calendarEntry.id,
              calendarName: e.calendarEntry.name,
              calendarColor: e.calendarEntry.color,
              readOnly: e.calendarEntry.readOnly,
              sourceEventId: e.sourceEventId,
              providerMetadata: e.providerMetadata,
            },
          })
        );
        setAllEvents(mapped);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (accessToken && dateRange) {
      fetchEvents(dateRange.start, dateRange.end);
    }
  }, [accessToken, dateRange, fetchEvents]);

  const events = useMemo(
    () =>
      visibleCalendarIds
        ? allEvents.filter((e) => visibleCalendarIds.has(e.extendedProps.calendarEntryId))
        : allEvents,
    [allEvents, visibleCalendarIds]
  );

  function handleViewChange(view: string) {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }

  async function handleEventDrop(info: any) {
    if (info.event.extendedProps?.readOnly) {
      info.revert();
      return;
    }

    if (!accessToken) return;

    const res = await apiAuthFetch(`/api/events/${info.event.id}`, accessToken, {
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

  const eventContent = useCallback((arg: { event: { extendedProps: Record<string, unknown>; title: string }; timeText: string }) => {
    const meta = arg.event.extendedProps?.providerMetadata as Record<string, unknown> | undefined;
    const eventType = meta?.eventType as string | undefined;
    const transparency = meta?.transparency as string | undefined;
    const wl = meta?.workingLocation as { type?: string } | undefined;
    const rawTitle = arg.event.title;

    const isWorkingLocation = eventType === "workingLocation"
      || /^(Arbeitsort:|Working location:)/i.test(rawTitle)
      || /^Home\s*office$/i.test(rawTitle)
      || /^Büro$/i.test(rawTitle);
    const isFree = transparency === "transparent";
    const isOutOfOffice = eventType === "outOfOffice";
    const isFocusTime = eventType === "focusTime";

    let icon = "";
    if (isWorkingLocation) {
      const isHome = wl?.type === "homeOffice"
        || /Zuhause|Home|Homeoffice/i.test(rawTitle);
      const isOffice = wl?.type === "officeLocation"
        || /Büro|Office/i.test(rawTitle);
      icon = isHome ? "\u{1F3E0}" : isOffice ? "\u{1F3E2}" : "\u{1F4CD}";
    } else if (isOutOfOffice) {
      icon = "\u{1F334}";
    } else if (isFocusTime) {
      icon = "\u{1F3AF}";
    }

    const title = isWorkingLocation
      ? rawTitle.replace(/^Arbeitsort:\s*|^Working location:\s*/i, "")
      : rawTitle;

    return {
      html: `<div class="fc-event-main-frame" style="${isFree ? "opacity:0.6;" : ""}">
        ${arg.timeText ? `<div class="fc-event-time">${arg.timeText}</div>` : ""}
        <div class="fc-event-title-container">
          <div class="fc-event-title fc-sticky">${(icon ? icon + " " : "") + title}</div>
        </div>
      </div>`,
    };
  }, []);

  const calendarTitle = calendarRef.current?.getApi()?.view?.title || "";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-col gap-2 md:mb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 md:gap-2">
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
              className="h-8 min-w-0 px-2 text-xs font-medium text-gray-600 md:px-3"
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
            <h2 className="ml-1 text-sm font-semibold text-gray-800 md:ml-2 md:text-lg">{calendarTitle}</h2>
          </div>

          <ButtonGroup size="sm" variant="flat" className="md:hidden">
            <Button
              className={`min-w-0 px-2 ${currentView === "dayGridMonth" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}`}
              onPress={() => handleViewChange("dayGridMonth")}
            >
              M
            </Button>
            <Button
              className={`min-w-0 px-2 ${currentView === "timeGridWeek" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}`}
              onPress={() => handleViewChange("timeGridWeek")}
            >
              W
            </Button>
            <Button
              className={`min-w-0 px-2 ${currentView === "timeGridDay" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}`}
              onPress={() => handleViewChange("timeGridDay")}
            >
              D
            </Button>
            <Button
              className={`min-w-0 px-2 ${currentView === "listWeek" ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600"}`}
              onPress={() => handleViewChange("listWeek")}
            >
              L
            </Button>
          </ButtonGroup>
        </div>

        <ButtonGroup size="sm" variant="flat" className="hidden md:flex">
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
      </div>

      <div className="flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "timeGridWeek"}
          nowIndicator={true}
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
          eventContent={eventContent}
          datesSet={(dateInfo) => {
            setDateRange((prev) => {
              if (prev && prev.start.getTime() === dateInfo.start.getTime() && prev.end.getTime() === dateInfo.end.getTime()) {
                return prev;
              }
              return { start: dateInfo.start, end: dateInfo.end };
            });
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
