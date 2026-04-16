"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Chip,
} from "@heroui/react";
import { apiAuthFetch } from "@/lib/api";
import { LocationMap } from "./LocationMap";
import { DayTimeline } from "./DayTimeline";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    // Preserve link URLs: <a href="url">text</a> -> text (url)
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, (_, url, text) => {
      const cleanText = text.trim();
      // If the link text is the URL itself, don't duplicate
      if (cleanText === url || cleanText.replace(/^https?:\/\//, "") === url.replace(/^https?:\/\//, "")) return url;
      return `${cleanText} (${url})`;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  extendedProps: {
    description: string | null;
    location: string | null;
    calendarName: string;
    calendarColor: string;
    readOnly: boolean;
    ignored?: boolean;
  };
}

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function EventDetailModal({ event, onClose, onUpdate }: Props) {
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSeriesDialog, setShowSeriesDialog] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  // null = loading/no targets, true = some targets skip ignored, false = targets exist but none skip
  const [syncSkipsIgnored, setSyncSkipsIgnored] = useState<boolean | null>(null);

  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (!event || !accessToken) return;
    apiAuthFetch("/api/sync-targets", accessToken)
      .then((res) => res.json())
      .then((data) => {
        const targets = data.targets || [];
        if (targets.length === 0) {
          setSyncSkipsIgnored(null);
        } else {
          setSyncSkipsIgnored(targets.some((t: { skipIgnored: boolean }) => t.skipIgnored));
        }
      })
      .catch(() => setSyncSkipsIgnored(null));
  }, [event?.id, accessToken]);

  if (!event) return null;

  function startEditing() {
    setTitle(event!.title);
    setDescription(stripHtml(event!.extendedProps.description || ""));
    setLocation(event!.extendedProps.location || "");
    setStartTime(event!.start?.slice(0, 16) || "");
    setEndTime(event!.end?.slice(0, 16) || "");
    setEditing(true);
    setError("");
  }

  async function handleSave() {
    if (!accessToken) return;

    setSaving(true);
    setError("");

    const res = await apiAuthFetch(`/api/events/${event!.id}`, accessToken, {
      method: "PUT",
      body: JSON.stringify({
        title,
        description,
        location,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      }),
    });

    if (res.ok) {
      setEditing(false);
      onUpdate();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error || "Speichern fehlgeschlagen");
    }
    setSaving(false);
  }

  async function handleIgnoreSingle() {
    if (!accessToken) return;
    setIgnoring(true);
    const newIgnored = !event!.extendedProps.ignored;
    const res = await apiAuthFetch(`/api/events/${event!.id}/ignore`, accessToken, {
      method: "PUT",
      body: JSON.stringify({ ignored: newIgnored }),
    });
    if (res.ok) {
      onUpdate();
      onClose();
    }
    setIgnoring(false);
    setShowSeriesDialog(false);
  }

  async function handleIgnoreSeries() {
    if (!accessToken) return;
    setIgnoring(true);
    const newIgnored = !event!.extendedProps.ignored;
    const res = await apiAuthFetch(`/api/events/ignore-series`, accessToken, {
      method: "PUT",
      body: JSON.stringify({ eventId: event!.id, ignored: newIgnored }),
    });
    if (res.ok) {
      onUpdate();
      onClose();
    }
    setIgnoring(false);
    setShowSeriesDialog(false);
  }

  const readOnly = event.extendedProps.readOnly;
  const isIgnored = event.extendedProps.ignored;

  return (
    <Modal isOpen={!!event} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: event.extendedProps.calendarColor }}
          />
          {editing ? "Termin bearbeiten" : event.title}
        </ModalHeader>

        <ModalBody>
          {editing ? (
            <div className="flex flex-col gap-3">
              <Input label="Titel" value={title} onValueChange={setTitle} />
              <Input
                label="Start"
                type="datetime-local"
                value={startTime}
                onValueChange={setStartTime}
              />
              <Input
                label="Ende"
                type="datetime-local"
                value={endTime}
                onValueChange={setEndTime}
              />
              <Input label="Ort" value={location} onValueChange={setLocation} />
              <Textarea
                label="Beschreibung"
                value={description}
                onValueChange={setDescription}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="flat">
                  {event.extendedProps.calendarName}
                </Chip>
                {readOnly && (
                  <Chip size="sm" color="warning" variant="flat">
                    Nur lesen
                  </Chip>
                )}
                {isIgnored && (
                  <Chip size="sm" color="default" variant="flat">
                    Ignoriert
                  </Chip>
                )}
              </div>

              <div className="text-sm">
                <p className="font-mono text-default-500">
                  {new Date(event.start).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" })}{" "}
                  {new Date(event.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {new Date(event.end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <DayTimeline
                eventStart={event.start}
                eventEnd={event.end}
                eventColor={event.extendedProps.calendarColor}
              />

              {event.extendedProps.location && (
                <LocationMap location={event.extendedProps.location} />
              )}

              {event.extendedProps.description && (
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {stripHtml(event.extendedProps.description)}
                </p>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {showSeriesDialog ? (
            <div className="flex w-full flex-col gap-2">
              <p className="text-sm text-default-500">
                {isIgnored
                  ? "Soll nur dieser Termin oder die ganze Serie wieder beachtet werden?"
                  : "Nur diesen Termin ignorieren oder die ganze Serie?"}
              </p>
              {!isIgnored && (
                <p className="text-xs text-default-400">
                  {syncSkipsIgnored === true
                    ? "Wird aus Sync-Zielen entfernt und nicht mehr als Kollision gewertet."
                    : syncSkipsIgnored === false
                      ? "Wird weiterhin synchronisiert, aber nicht mehr als Kollision gewertet."
                      : "Wird nicht mehr als Kollision gewertet."}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="light" onPress={() => setShowSeriesDialog(false)}>
                  Abbrechen
                </Button>
                <Button size="sm" variant="flat" isLoading={ignoring} onPress={handleIgnoreSingle}>
                  Nur diesen
                </Button>
                <Button size="sm" variant="flat" color="warning" isLoading={ignoring} onPress={handleIgnoreSeries}>
                  Ganze Serie
                </Button>
              </div>
            </div>
          ) : editing ? (
            <>
              <Button variant="light" onPress={() => setEditing(false)}>
                Abbrechen
              </Button>
              <Button color="primary" isLoading={saving} onPress={handleSave}>
                Speichern
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="flat"
                color={isIgnored ? "success" : "default"}
                isLoading={ignoring}
                onPress={() => setShowSeriesDialog(true)}
              >
                {isIgnored ? "Nicht mehr ignorieren" : "Ignorieren"}
              </Button>
              <div className="flex-1" />
              <Button variant="light" onPress={onClose}>
                Schließen
              </Button>
              {!readOnly && (
                <Button color="primary" onPress={startEditing}>
                  Bearbeiten
                </Button>
              )}
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
