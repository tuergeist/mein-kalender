"use client";

import { useState } from "react";
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
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    setSaving(true);
    setError("");

    const res = await apiAuthFetch(`/api/events/${event!.id}`, token, {
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

  const readOnly = event.extendedProps.readOnly;

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
              </div>

              <div className="text-sm">
                <p className="text-default-500">
                  {new Date(event.start).toLocaleString()} &mdash;{" "}
                  {new Date(event.end).toLocaleString()}
                </p>
              </div>

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
          {editing ? (
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
