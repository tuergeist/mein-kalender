"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Select,
  SelectItem,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface CalendarEntry {
  id: string;
  name: string;
  color: string;
  readOnly: boolean;
  isTarget: boolean;
}

interface CalendarSource {
  id: string;
  provider: string;
  label: string | null;
  syncStatus: string;
  syncInterval: number;
  calendarEntries: CalendarEntry[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState<string | null>(null);
  const [targetCalendarId, setTargetCalendarId] = useState<string>("");
  const [mapProvider, setMapProvider] = useState<string>("google");

  useEffect(() => {
    setMapProvider(localStorage.getItem("mapProvider") || "google");
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function loadData() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    const [sourcesRes, targetRes] = await Promise.all([
      apiAuthFetch("/api/sources", token),
      apiAuthFetch("/api/target-calendar", token),
    ]);

    if (sourcesRes.ok) setSources(await sourcesRes.json());
    if (targetRes.ok) {
      const data = await targetRes.json();
      setTargetCalendarId(data.targetCalendar?.id || "");
    }
  }

  async function handleDisconnect(sourceId: string) {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    await apiAuthFetch(`/api/sources/${sourceId}`, token, { method: "DELETE" });
    setShowDisconnectModal(null);
    loadData();
  }

  async function handleSetTarget(calendarEntryId: string) {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    await apiAuthFetch("/api/target-calendar", token, {
      method: "PUT",
      body: JSON.stringify({ calendarEntryId }),
    });
    setTargetCalendarId(calendarEntryId);
    loadData();
  }

  function handleAddProvider(provider: string) {
    const origin = window.location.origin;
    const redirectUri = `${origin}/api/oauth/${provider}/callback`;

    window.location.href = `${origin}/api/oauth/${provider}/start?redirect=${encodeURIComponent(redirectUri)}`;
    setShowAddModal(false);
  }

  const allCalendarEntries = sources.flatMap((s) =>
    s.calendarEntries
      .filter((e) => !e.readOnly)
      .map((e) => ({
        ...e,
        sourceName: s.label || s.provider,
      }))
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Connected Sources */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Calendar Sources</h2>
            <Button size="sm" color="primary" onPress={() => setShowAddModal(true)}>
              Add Calendar
            </Button>
          </CardHeader>
          <CardBody>
            {sources.length === 0 ? (
              <p className="text-default-500">No calendars connected yet.</p>
            ) : (
              <div className="space-y-4">
                {sources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {source.label || source.provider}
                        </span>
                        <Chip size="sm" variant="flat">
                          {source.provider}
                        </Chip>
                        {source.syncStatus === "error" && (
                          <Chip size="sm" color="danger" variant="flat">
                            Error
                          </Chip>
                        )}
                      </div>
                      <p className="text-sm text-default-400">
                        {source.calendarEntries.length} calendar(s) &bull; Sync every{" "}
                        {source.syncInterval / 60} min
                      </p>
                    </div>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => setShowDisconnectModal(source.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Target Calendar */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Target Calendar</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Select a writable calendar to clone all events into. This is optional — the
              unified UI view works without a target.
            </p>

            {allCalendarEntries.length === 0 ? (
              <p className="text-default-400">
                Connect a calendar with write access to set a target.
              </p>
            ) : (
              <Select
                label="Target Calendar"
                selectedKeys={targetCalendarId ? [targetCalendarId] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) handleSetTarget(selected);
                }}
              >
                {allCalendarEntries.map((entry) => (
                  <SelectItem key={entry.id}>
                    {entry.name} ({entry.sourceName})
                  </SelectItem>
                ))}
              </Select>
            )}
          </CardBody>
        </Card>

        {/* Map Provider */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Map Provider</h2>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Choose which map service to use for event locations.
            </p>
            <Select
              label="Map Provider"
              selectedKeys={[mapProvider]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) {
                  setMapProvider(selected);
                  localStorage.setItem("mapProvider", selected);
                }
              }}
            >
              <SelectItem key="google">Google Maps</SelectItem>
              <SelectItem key="osm">OpenStreetMap</SelectItem>
              <SelectItem key="apple">Apple Maps</SelectItem>
              <SelectItem key="none">No map</SelectItem>
            </Select>
          </CardBody>
        </Card>

        {/* Add Calendar Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <ModalContent>
            <ModalHeader>Add Calendar</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => handleAddProvider("google")}
                >
                  Google Calendar
                </Button>
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => handleAddProvider("outlook")}
                >
                  Microsoft Outlook
                </Button>
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => {
                    setShowAddModal(false);
                    // Navigate to Proton setup page
                    window.location.href = "/settings/proton";
                  }}
                >
                  Proton Calendar (via Bridge)
                </Button>
                <Divider />
                <Button
                  variant="bordered"
                  className="justify-start"
                  onPress={() => {
                    setShowAddModal(false);
                    window.location.href = "/settings/ics";
                  }}
                >
                  Import ICS File / URL
                </Button>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Disconnect Confirmation Modal */}
        <Modal
          isOpen={!!showDisconnectModal}
          onClose={() => setShowDisconnectModal(null)}
        >
          <ModalContent>
            <ModalHeader>Disconnect Calendar</ModalHeader>
            <ModalBody>
              <p>
                Are you sure you want to disconnect this calendar? All synced events from
                this source will be removed.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowDisconnectModal(null)}>
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={() => handleDisconnect(showDisconnectModal!)}
              >
                Disconnect
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
