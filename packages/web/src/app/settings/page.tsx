"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card, CardBody, CardHeader, Button, Input, Divider,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface CalendarEntry {
  id: string;
  name: string;
  readOnly: boolean;
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
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (accessToken) loadData();
  }, [accessToken]);

  async function loadData() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/sources", accessToken);
    if (res.ok) setSources(await res.json());
  }

  async function handleRenameSource(sourceId: string, label: string) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/sources/${sourceId}`, accessToken, {
      method: "PUT",
      body: JSON.stringify({ label }),
    });
    setEditingSourceId(null);
    loadData();
  }

  async function handleDisconnect(sourceId: string) {
    if (!accessToken) return;
    await apiAuthFetch(`/api/sources/${sourceId}`, accessToken, { method: "DELETE" });
    setShowDisconnectModal(null);
    loadData();
  }

  function handleAddProvider(provider: string) {
    const origin = window.location.origin;
    const redirectUri = `${origin}/api/oauth/${provider}/callback`;
    window.location.href = `${origin}/api/oauth/${provider}/start?redirect=${encodeURIComponent(redirectUri)}`;
    setShowAddModal(false);
  }

  return (
    <AppShell section="settings" settingsSection="sources">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Calendar Sources</h1>

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
                        {editingSourceId === source.id ? (
                          <Input
                            size="sm"
                            value={editingLabel}
                            onValueChange={setEditingLabel}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRenameSource(source.id, editingLabel);
                              if (e.key === "Escape") setEditingSourceId(null);
                            }}
                            onBlur={() => handleRenameSource(source.id, editingLabel)}
                            autoFocus
                            className="w-48"
                          />
                        ) : (
                          <span
                            className="cursor-pointer font-medium hover:underline"
                            onClick={() => { setEditingSourceId(source.id); setEditingLabel(source.label || source.provider); }}
                          >
                            {source.label || source.provider}
                          </span>
                        )}
                        <Chip size="sm" variant="flat">{source.provider}</Chip>
                        {source.syncStatus === "error" && (
                          <Chip size="sm" color="danger" variant="flat">Error</Chip>
                        )}
                      </div>
                      <p className="text-sm text-default-400">
                        {source.calendarEntries.length} calendar(s) &bull; Sync every {source.syncInterval / 60} min
                      </p>
                    </div>
                    <Button size="sm" color="danger" variant="light" onPress={() => setShowDisconnectModal(source.id)}>
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>


        {/* Add Calendar Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <ModalContent>
            <ModalHeader>Add Calendar</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <Button variant="bordered" className="justify-start" onPress={() => handleAddProvider("google")}>
                  Google Calendar
                </Button>
                <Button variant="bordered" className="justify-start" onPress={() => handleAddProvider("outlook")}>
                  Microsoft Outlook
                </Button>
                <Button variant="bordered" className="justify-start" onPress={() => { setShowAddModal(false); window.location.href = "/settings/proton"; }}>
                  Proton Calendar (via Bridge)
                </Button>
                <Divider />
                <Button variant="bordered" className="justify-start" onPress={() => { setShowAddModal(false); window.location.href = "/settings/ics"; }}>
                  Import ICS File / URL
                </Button>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Disconnect Confirmation Modal */}
        <Modal isOpen={!!showDisconnectModal} onClose={() => setShowDisconnectModal(null)}>
          <ModalContent>
            <ModalHeader>Disconnect Calendar</ModalHeader>
            <ModalBody>
              <p>Are you sure? All synced events from this source will be removed.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowDisconnectModal(null)}>Cancel</Button>
              <Button color="danger" onPress={() => handleDisconnect(showDisconnectModal!)}>Disconnect</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
