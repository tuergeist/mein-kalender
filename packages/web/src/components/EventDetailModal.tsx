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
    setDescription(event!.extendedProps.description || "");
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
      setError(data.error || "Failed to save");
    }
    setSaving(false);
  }

  const readOnly = event.extendedProps.readOnly;

  return (
    <Modal isOpen={!!event} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: event.extendedProps.calendarColor }}
          />
          {editing ? "Edit Event" : event.title}
        </ModalHeader>

        <ModalBody>
          {editing ? (
            <div className="flex flex-col gap-3">
              <Input label="Title" value={title} onValueChange={setTitle} />
              <Input
                label="Start"
                type="datetime-local"
                value={startTime}
                onValueChange={setStartTime}
              />
              <Input
                label="End"
                type="datetime-local"
                value={endTime}
                onValueChange={setEndTime}
              />
              <Input label="Location" value={location} onValueChange={setLocation} />
              <Textarea
                label="Description"
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
                    Read-only
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
                <p className="text-sm">
                  <span className="text-default-400">Location: </span>
                  {event.extendedProps.location}
                </p>
              )}

              {event.extendedProps.description && (
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {event.extendedProps.description}
                </p>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {editing ? (
            <>
              <Button variant="light" onPress={() => setEditing(false)}>
                Cancel
              </Button>
              <Button color="primary" isLoading={saving} onPress={handleSave}>
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="light" onPress={onClose}>
                Close
              </Button>
              {!readOnly && (
                <Button color="primary" onPress={startEditing}>
                  Edit
                </Button>
              )}
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
