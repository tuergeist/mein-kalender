"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button, Card, CardBody } from "@heroui/react";
import { apiFetch } from "@/lib/api";

interface BookingInfo {
  id: string;
  startTime: string;
  endTime: string;
  guestName: string;
  guestEmail: string;
  notes: string | null;
  status: string;
}

interface EventTypeInfo {
  name: string;
  slug: string;
  durationMinutes: number;
  location: string | null;
}

interface HostInfo {
  displayName: string;
  username: string;
}

interface BrandingInfo {
  brandColor: string | null;
  accentColor: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  backgroundOpacity: number | null;
}

type View = "details" | "reschedule" | "cancelled";

export default function ManageBookingPage() {
  const params = useParams();
  const token = params.token as string;

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [eventType, setEventType] = useState<EventTypeInfo | null>(null);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("details");
  const [cancelling, setCancelling] = useState(false);

  // Reschedule state
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    apiFetch(`/api/public/booking/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Booking not found");
        return r.json();
      })
      .then((data) => {
        setBooking(data.booking);
        setEventType(data.eventType);
        setHost(data.host);
        setBranding(data.branding);
        if (data.booking.status === "cancelled") setView("cancelled");
        setLoading(false);
      })
      .catch(() => {
        setError("Buchung nicht gefunden.");
        setLoading(false);
      });
  }, [token]);

  const fetchAvailableDays = useCallback(async (month: Date) => {
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const r = await apiFetch(`/api/public/booking/${token}/available-days?month=${monthStr}`);
    if (r.ok) {
      const data = await r.json();
      setAvailableDays(data.availableDays || []);
    }
  }, [token]);

  useEffect(() => {
    if (view === "reschedule") {
      fetchAvailableDays(currentMonth);
    }
  }, [view, currentMonth, fetchAvailableDays]);

  async function fetchSlots(date: string) {
    setSlotsLoading(true);
    setSelectedDate(date);
    const r = await apiFetch(`/api/public/booking/${token}/slots?date=${date}`);
    if (r.ok) {
      const data = await r.json();
      setSlots(data.slots || []);
    }
    setSlotsLoading(false);
  }

  async function handleCancel() {
    setCancelling(true);
    const r = await apiFetch(`/api/public/booking/${token}/cancel`, { method: "POST" });
    if (r.ok) {
      setView("cancelled");
      setBooking((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    }
    setCancelling(false);
  }

  async function handleReschedule(slotTime: string) {
    setRescheduling(true);
    const r = await apiFetch(`/api/public/booking/${token}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: slotTime }),
    });
    if (r.ok) {
      const data = await r.json();
      setBooking((prev) => prev ? { ...prev, startTime: data.booking.startTime, endTime: data.booking.endTime } : prev);
      setView("details");
    }
    setRescheduling(false);
  }

  const brandColor = branding?.brandColor || "#9F1239";

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  // Mini calendar for reschedule
  function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay + 6) % 7; // Monday start

    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const monthLabel = new Date(year, month).toLocaleString("de-DE", { month: "long", year: "numeric" });

    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100">&larr;</button>
          <span className="text-sm font-semibold">{monthLabel}</span>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="rounded-lg px-2 py-1 text-sm hover:bg-stone-100">&rarr;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div key={d} className="py-1 font-medium text-stone-400">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const available = availableDays.includes(dateStr);
            const selected = selectedDate === dateStr;
            return (
              <button
                key={i}
                disabled={!available}
                onClick={() => fetchSlots(dateStr)}
                className={`rounded-lg py-1.5 text-sm transition-colors ${
                  selected ? "text-white font-semibold" : available ? "hover:bg-stone-100 font-medium" : "text-stone-300 cursor-default"
                }`}
                style={selected ? { backgroundColor: brandColor } : undefined}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (error || !booking || !eventType || !host) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
        <Card className="max-w-md">
          <CardBody className="p-8 text-center">
            <p className="text-sm text-stone-500">{error || "Buchung nicht gefunden."}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9] px-4 py-12">
      <Card className="w-full max-w-lg shadow-md">
        <CardBody className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{host.displayName}</p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-stone-900">{eventType.name}</h1>
            <p className="mt-0.5 font-mono text-xs text-stone-500">{eventType.durationMinutes} min{eventType.location ? ` · ${/^https?:\/\/.*(meet\.google|teams\.microsoft|zoom\.(us|com))/i.test(eventType.location) ? "Online-Meeting" : eventType.location}` : ""}</p>
          </div>

          {view === "cancelled" && (
            <div className="rounded-xl bg-red-50 p-5 text-center">
              <p className="text-sm font-medium text-red-800">Buchung abgesagt</p>
              <p className="mt-1 text-xs text-red-600">Diese Buchung wurde storniert.</p>
            </div>
          )}

          {view === "details" && (
            <>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-stone-400">Wann</p>
                    <p className="text-sm font-medium text-stone-800">{formatDateTime(booking.startTime)}</p>
                    <p className="font-mono text-xs text-stone-500">{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-400">Gast</p>
                    <p className="text-sm text-stone-800">{booking.guestName} ({booking.guestEmail})</p>
                  </div>
                  {booking.notes && (
                    <div>
                      <p className="text-xs font-medium text-stone-400">Notizen</p>
                      <p className="text-sm text-stone-600">{booking.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <Button
                  className="flex-1"
                  variant="flat"
                  onPress={() => setView("reschedule")}
                  style={{ color: brandColor }}
                >
                  Verschieben
                </Button>
                <Button
                  className="flex-1"
                  variant="flat"
                  color="danger"
                  isLoading={cancelling}
                  onPress={handleCancel}
                >
                  Absagen
                </Button>
              </div>
            </>
          )}

          {view === "reschedule" && (
            <>
              <button
                onClick={() => { setView("details"); setSelectedDate(null); setSlots([]); }}
                className="mb-4 text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                &larr; Zurück
              </button>

              <p className="mb-3 text-sm font-medium text-stone-700">Neuen Termin wählen</p>

              {renderCalendar()}

              {selectedDate && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-stone-500">
                    Verfügbare Zeiten am {new Date(selectedDate + "T00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  {slotsLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-xs text-stone-400">Keine verfügbaren Zeiten.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((slot) => (
                        <Button
                          key={slot}
                          size="sm"
                          variant="bordered"
                          isLoading={rescheduling}
                          onPress={() => handleReschedule(slot)}
                          className="text-xs"
                        >
                          {formatTime(slot)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
