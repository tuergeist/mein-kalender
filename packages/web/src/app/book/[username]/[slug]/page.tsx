"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Button, Input, Textarea, Card, CardBody, Divider } from "@heroui/react";
import { apiFetch } from "@/lib/api";

interface EventTypeInfo {
  id: string;
  name: string;
  slug: string;
  durationMinutes: number;
  description: string | null;
  location: string | null;
  color: string;
  redirectUrl: string | null;
  redirectTitle: string | null;
  redirectDelaySecs: number;
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

type Step = "date" | "time" | "form" | "confirmed";

export default function BookingPage() {
  const params = useParams();
  const username = params.username as string;
  const slug = params.slug as string;

  const [eventType, setEventType] = useState<EventTypeInfo | null>(null);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [availableDaysLoading, setAvailableDaysLoading] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirmation
  const [confirmation, setConfirmation] = useState<{ startTime: string; endTime: string } | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  const step: Step = confirmation
    ? "confirmed"
    : selectedSlot
      ? "form"
      : selectedDate
        ? "time"
        : "date";

  // Load event type info
  useEffect(() => {
    apiFetch(`/api/public/book/${username}/${slug}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("This booking page is not available.");
          return;
        }
        const data = await res.json();
        setEventType(data.eventType);
        setHost(data.host);
        setBranding(data.branding || null);
      })
      .finally(() => setLoading(false));
  }, [username, slug]);

  // Load slots when date selected
  const loadSlots = useCallback(
    async (date: string) => {
      setSlotsLoading(true);
      setSlots([]);
      const res = await apiFetch(`/api/public/book/${username}/${slug}/slots?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      }
      setSlotsLoading(false);
    },
    [username, slug]
  );

  useEffect(() => {
    if (selectedDate) loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  // Load available days for the visible month
  useEffect(() => {
    if (!eventType) return;
    const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
    setAvailableDaysLoading(true);
    apiFetch(`/api/public/book/${username}/${slug}/available-days?month=${monthStr}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setAvailableDays(new Set(data.availableDays));
        }
      })
      .finally(() => setAvailableDaysLoading(false));
  }, [currentMonth, eventType, username, slug]);

  // Submit booking
  async function handleSubmit() {
    if (!guestName.trim() || !guestEmail.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    const res = await apiFetch(`/api/public/book/${username}/${slug}`, {
      method: "POST",
      body: JSON.stringify({ startTime: selectedSlot, guestName, guestEmail, notes }),
    });

    if (res.ok) {
      const data = await res.json();
      setConfirmation(data.booking);
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error || "Booking failed. The slot may no longer be available.");
    }
    setSubmitting(false);
  }

  // Auto-redirect after booking confirmation
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (confirmation && eventType?.redirectUrl) {
      const delay = eventType.redirectDelaySecs ?? 5;
      setRedirectCountdown(delay);
      redirectTimerRef.current = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
            window.location.href = eventType.redirectUrl!;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
      };
    }
  }, [confirmation, eventType?.redirectUrl, eventType?.redirectDelaySecs]);

  // Calendar helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function getDaysInMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfWeek(date: Date) {
    const d = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfWeek(currentMonth);
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !eventType || !host) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardBody className="text-center">
            <p className="text-lg font-medium text-gray-600">{error || "Not found"}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const brandColor = branding?.brandColor || undefined;
  const accentColor = branding?.accentColor || undefined;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 p-4"
      style={{
        ...(branding?.backgroundUrl
          ? { backgroundImage: `linear-gradient(rgba(255,255,255,${branding.backgroundOpacity ?? 0.85}), rgba(255,255,255,${branding.backgroundOpacity ?? 0.85})), url(${branding.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}),
      }}
    >
      <Card className="w-full max-w-3xl">
        <CardBody className="flex flex-col gap-0 p-0 md:flex-row">
          {/* Left panel — event info */}
          <div className="border-b border-gray-200 p-6 md:w-64 md:border-b-0 md:border-r">
            <div className="flex items-center gap-2">
              {branding?.avatarUrl && (
                <img
                  src={branding.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <p className="text-sm text-gray-500">{host.displayName}</p>
            </div>
            <h1 className="mt-1 text-xl font-bold" style={{ color: eventType.color }}>
              {eventType.name}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{eventType.durationMinutes} min</p>
            {eventType.location && (
              <p className="mt-1 text-sm text-gray-500">{eventType.location}</p>
            )}
            {eventType.description && (
              <p className="mt-4 text-sm text-gray-600">{eventType.description}</p>
            )}

            {selectedDate && step !== "confirmed" && (
              <>
                <Divider className="my-4" />
                <p className="text-sm font-medium">{formatDate(selectedDate + "T00:00:00")}</p>
                {selectedSlot && (
                  <p className="text-sm text-gray-500">
                    {formatTime(selectedSlot)} – {formatTime(new Date(new Date(selectedSlot).getTime() + eventType.durationMinutes * 60000).toISOString())}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 p-6 md:min-h-[420px]">
            {step === "confirmed" && confirmation && (
              <div className="text-center">
                <div className="mb-4 text-4xl">&#10003;</div>
                <h2 className="text-xl font-bold">Booking confirmed</h2>
                <p className="mt-2 text-gray-600">
                  {formatDate(confirmation.startTime)}, {formatTime(confirmation.startTime)} – {formatTime(confirmation.endTime)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  You will receive a calendar invitation by email.
                </p>
                {eventType.redirectUrl && (
                  <div className="mt-6">
                    <a
                      href={eventType.redirectUrl}
                      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brandColor || "var(--heroui-primary)" }}
                    >
                      {eventType.redirectTitle || "Continue"}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                    {redirectCountdown !== null && redirectCountdown > 0 && (
                      <p className="mt-2 text-xs text-gray-400">
                        Redirecting in {redirectCountdown}s...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === "form" && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Button size="sm" variant="light" onPress={() => setSelectedSlot(null)}>
                    &larr; Back
                  </Button>
                  <h2 className="text-lg font-semibold">Your details</h2>
                </div>
                <div className="space-y-4">
                  <Input
                    label="Name"
                    isRequired
                    value={guestName}
                    onValueChange={setGuestName}
                  />
                  <Input
                    label="Email"
                    type="email"
                    isRequired
                    value={guestEmail}
                    onValueChange={setGuestEmail}
                  />
                  <Textarea
                    label="Notes (optional)"
                    value={notes}
                    onValueChange={setNotes}
                    minRows={2}
                  />
                  {formError && <p className="text-sm text-red-500">{formError}</p>}
                  <Button
                    color={brandColor ? undefined : "primary"}
                    className="w-full text-white"
                    style={brandColor ? { backgroundColor: brandColor } : undefined}
                    isLoading={submitting}
                    onPress={handleSubmit}
                  >
                    Book appointment
                  </Button>
                </div>
              </div>
            )}

            {(step === "date" || step === "time") && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Date &amp; time</h2>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      onPress={() =>
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
                      }
                    >
                      &lsaquo;
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      onPress={() =>
                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
                      }
                    >
                      &rsaquo;
                    </Button>
                  </div>
                </div>

                <div className="flex gap-6">
                  {/* Calendar grid */}
                  <div className="flex-1">
                    <p className="mb-2 text-center text-sm font-medium">
                      {currentMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                    </p>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {dayLabels.map((d) => (
                        <div key={d} className="py-1 font-medium text-gray-400">
                          {d}
                        </div>
                      ))}
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isPast = dateObj < today;
                        const isSelected = dateStr === selectedDate;
                        const hasSlots = availableDays.has(dateStr);
                        const isDisabled = isPast || (!availableDaysLoading && !hasSlots);

                        return (
                          <button
                            key={day}
                            disabled={isDisabled}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSelectedSlot(null);
                            }}
                            className={`rounded-full py-1.5 text-sm transition-colors ${
                              isDisabled
                                ? "cursor-not-allowed text-gray-300"
                                : isSelected
                                  ? `${!brandColor ? "bg-primary" : ""} text-white font-bold`
                                  : "hover:bg-gray-100 text-gray-700 font-medium"
                            }`}
                            style={isSelected && brandColor ? { backgroundColor: brandColor } : undefined}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time slots */}
                  {step === "time" && (
                    <div className="w-36 shrink-0">
                      <p className="mb-2 text-center text-sm font-medium text-gray-500">
                        {new Date(selectedDate + "T00:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                      </p>
                      <div className="max-h-72 space-y-1.5 overflow-y-auto">
                        {slotsLoading ? (
                          <p className="text-center text-xs text-gray-400">Loading...</p>
                        ) : slots.length === 0 ? (
                          <p className="text-center text-xs text-gray-400">No available slots</p>
                        ) : (
                          slots.map((slot) => (
                            <Button
                              key={slot}
                              size="sm"
                              variant="bordered"
                              className="w-full"
                              style={accentColor ? { borderColor: accentColor, color: accentColor } : undefined}
                              onPress={() => setSelectedSlot(slot)}
                            >
                              {formatTime(slot)}
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
