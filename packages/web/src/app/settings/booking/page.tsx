"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Input, Switch, Divider,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface EventType {
  id: string;
  slug: string;
  name: string;
  durationMinutes: number;
  description: string | null;
  location: string | null;
  color: string;
  enabled: boolean;
}

interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BookingSettingsPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newDescription, setNewDescription] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    if (accessToken) {
      loadProfile();
      loadEventTypes();
      loadAvailability();
    }
  }, [accessToken]);

  async function loadProfile() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) {
      const data = await res.json();
      setUsername(data.username || "");
      setSavedUsername(data.username || "");
    }
  }

  async function loadEventTypes() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/event-types", accessToken);
    if (res.ok) setEventTypes(await res.json());
  }

  async function loadAvailability() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/availability", accessToken);
    if (res.ok) setRules(await res.json());
  }

  async function saveUsername() {
    if (!accessToken) return;
    setUsernameSaving(true);
    setUsernameError("");
    const res = await apiAuthFetch("/api/profile/username", accessToken, {
      method: "PUT",
      body: JSON.stringify({ username }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedUsername(data.username);
    } else {
      const data = await res.json().catch(() => ({}));
      setUsernameError(data.error || "Failed to save");
    }
    setUsernameSaving(false);
  }

  async function createEventType() {
    if (!accessToken || !newName.trim()) return;
    setCreating(true);
    await apiAuthFetch("/api/event-types", accessToken, {
      method: "POST",
      body: JSON.stringify({
        name: newName,
        durationMinutes: parseInt(newDuration) || 30,
        description: newDescription || undefined,
        location: newLocation || undefined,
      }),
    });
    setShowCreateModal(false);
    setNewName("");
    setNewDuration("30");
    setNewDescription("");
    setNewLocation("");
    setCreating(false);
    loadEventTypes();
  }

  async function toggleEventType(id: string, enabled: boolean) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/event-types/${id}`, accessToken, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
    loadEventTypes();
  }

  async function deleteEventType(id: string) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/event-types/${id}`, accessToken, { method: "DELETE" });
    loadEventTypes();
  }

  function updateRule(dayOfWeek: number, field: string, value: string | boolean) {
    setRules((prev) =>
      prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r))
    );
  }

  async function saveRules() {
    if (!accessToken) return;
    setSavingRules(true);
    await apiAuthFetch("/api/availability", accessToken, {
      method: "PUT",
      body: JSON.stringify(rules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        enabled: r.enabled,
      }))),
    });
    setSavingRules(false);
  }

  const bookingBaseUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${savedUsername}` : "";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="light" size="sm" isIconOnly className="text-gray-500">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Booking Settings</h1>
        </div>

        {/* Username */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Booking URL</h2></CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-default-500">
              Set your username for public booking links.
            </p>
            <div className="flex items-end gap-2">
              <Input
                label="Username"
                value={username}
                onValueChange={setUsername}
                description={savedUsername ? `Your booking URL: ${bookingBaseUrl}/...` : undefined}
                errorMessage={usernameError}
                isInvalid={!!usernameError}
                className="flex-1"
              />
              <Button
                size="sm"
                color="primary"
                isLoading={usernameSaving}
                isDisabled={username === savedUsername}
                onPress={saveUsername}
                className="shrink-0"
              >
                Save
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Event Types */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Event Types</h2>
            <Button size="sm" color="primary" onPress={() => setShowCreateModal(true)}>
              New Event Type
            </Button>
          </CardHeader>
          <CardBody>
            {eventTypes.length === 0 ? (
              <p className="text-default-400">No event types yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {eventTypes.map((et) => (
                  <div key={et.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color }} />
                      <div>
                        <span className="font-medium">{et.name}</span>
                        <span className="ml-2 text-sm text-default-400">{et.durationMinutes} min</span>
                        {savedUsername && (
                          <p className="text-xs text-default-400">/book/{savedUsername}/{et.slug}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch size="sm" isSelected={et.enabled} onValueChange={(v) => toggleEventType(et.id, v)} />
                      <Button size="sm" color="danger" variant="light" onPress={() => deleteEventType(et.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Availability */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Working Hours</h2>
            <Button size="sm" color="primary" isLoading={savingRules} onPress={saveRules}>
              Save
            </Button>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.dayOfWeek} className="flex items-center gap-3">
                  <Switch size="sm" isSelected={rule.enabled} onValueChange={(v) => updateRule(rule.dayOfWeek, "enabled", v)} />
                  <span className="w-10 text-sm font-medium">{DAY_NAMES[rule.dayOfWeek]}</span>
                  <Input
                    type="time"
                    size="sm"
                    value={rule.startTime}
                    onValueChange={(v) => updateRule(rule.dayOfWeek, "startTime", v)}
                    isDisabled={!rule.enabled}
                    className="w-28"
                  />
                  <span className="text-sm text-default-400">–</span>
                  <Input
                    type="time"
                    size="sm"
                    value={rule.endTime}
                    onValueChange={(v) => updateRule(rule.dayOfWeek, "endTime", v)}
                    isDisabled={!rule.enabled}
                    className="w-28"
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Create Event Type Modal */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <ModalContent>
            <ModalHeader>New Event Type</ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input label="Name" isRequired value={newName} onValueChange={setNewName} placeholder="e.g. 30-min Call" />
                <Input label="Duration (minutes)" type="number" value={newDuration} onValueChange={setNewDuration} />
                <Input label="Location (optional)" value={newLocation} onValueChange={setNewLocation} placeholder="e.g. Google Meet link" />
                <Input label="Description (optional)" value={newDescription} onValueChange={setNewDescription} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowCreateModal(false)}>Cancel</Button>
              <Button color="primary" isLoading={creating} onPress={createEventType}>Create</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
