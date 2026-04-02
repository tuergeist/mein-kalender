"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
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

const ADMIN_CONSENT_ERRORS = ["consent_required", "interaction_required", "access_denied", "AADSTS65001", "AADSTS90094"];
const MS_CLIENT_ID = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || "";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error") || null;
  const isConsentError = oauthError ? ADMIN_CONSENT_ERRORS.some((e) => oauthError.includes(e)) : false;
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

  const [resyncingId, setResyncingId] = useState<string | null>(null);

  async function handleFullResync(sourceId: string) {
    if (!accessToken) return;
    setResyncingId(sourceId);
    await apiAuthFetch(`/api/sources/${sourceId}/full-sync`, accessToken, { method: "POST" });
    loadData();
    setTimeout(() => setResyncingId(null), 10000);
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
        <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Kalenderquellen</h1>

        {/* OAuth Error Banner */}
        {oauthError && (
          <div className={`rounded-xl border p-5 ${isConsentError ? "border-[var(--color-amber-200)] bg-[var(--color-amber-50)]" : "border-red-200 bg-red-50"}`}>
            {isConsentError ? (
              <>
                <p className="text-sm font-medium text-[var(--color-amber-800)]">
                  Dein Unternehmen erfordert eine Admin-Freigabe für Mein Kalender.
                </p>
                <p className="mt-2 text-sm text-[var(--color-amber-700)]">
                  Bitte leite diesen Link an deinen IT-Administrator weiter, damit er Mein Kalender für deine Organisation freigibt:
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="block flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-[var(--text-secondary)] border border-[var(--color-amber-200)]">
                    {`https://login.microsoftonline.com/common/adminconsent?client_id=${MS_CLIENT_ID}`}
                  </code>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      navigator.clipboard.writeText(`https://login.microsoftonline.com/common/adminconsent?client_id=${MS_CLIENT_ID}`);
                    }}
                  >
                    Kopieren
                  </Button>
                </div>
                <p className="mt-2 text-xs text-[var(--color-amber-600)]">
                  Nach der Freigabe durch den Admin kannst du die Verbindung erneut versuchen.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-red-800">Kalender-Verbindung fehlgeschlagen</p>
                <p className="mt-1 text-sm text-red-600">{oauthError}</p>
              </>
            )}
          </div>
        )}

        {/* Connected Sources */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <span />
            <Button size="sm" color="primary" onPress={() => setShowAddModal(true)}>
              Kalender hinzufügen
            </Button>
          </CardHeader>
          <CardBody>
            {sources.length === 0 ? (
              <p className="text-default-500">Noch keine Kalender verbunden.</p>
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
                            className="group flex cursor-pointer items-center gap-1.5 font-medium hover:underline"
                            onClick={() => { setEditingSourceId(source.id); setEditingLabel(source.label || ""); }}
                          >
                            {source.label || { google: "Google Kalender", outlook: "Microsoft 365", proton: "Proton Kalender", ics: "ICS" }[source.provider] || source.provider}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-default-300 opacity-0 group-hover:opacity-100"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </span>
                        )}
                        <Chip size="sm" variant="flat">{source.provider}</Chip>
                        {source.syncStatus === "error" && (
                          <Chip size="sm" color="danger" variant="flat">Fehler</Chip>
                        )}
                      </div>
                      <p className="text-sm text-default-400">
                        {source.calendarEntries.length} Kalender &bull; Sync alle {source.syncInterval / 60} Min.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="flat" isDisabled={resyncingId === source.id} onPress={() => handleFullResync(source.id)}>
                        {resyncingId === source.id ? "Wird geladen..." : "Neu laden"}
                      </Button>
                      <Button size="sm" color="danger" variant="light" onPress={() => setShowDisconnectModal(source.id)}>
                        Trennen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>


        {/* Add Calendar Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <ModalContent>
            <ModalHeader>Kalender hinzufügen</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-3">
                <Button variant="bordered" className="justify-start" onPress={() => handleAddProvider("google")}>
                  Google Kalender
                </Button>
                <Button variant="bordered" className="justify-start" onPress={() => handleAddProvider("outlook")}>
                  Microsoft Outlook
                </Button>
                <Button variant="bordered" className="justify-start" onPress={() => { setShowAddModal(false); window.location.href = "/settings/proton"; }}>
                  Proton Kalender (via Bridge)
                </Button>
                <Divider />
                <Button variant="bordered" className="justify-start" onPress={() => { setShowAddModal(false); window.location.href = "/settings/ics"; }}>
                  ICS-Datei / URL importieren
                </Button>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Disconnect Confirmation Modal */}
        <Modal isOpen={!!showDisconnectModal} onClose={() => setShowDisconnectModal(null)}>
          <ModalContent>
            <ModalHeader>Kalender trennen</ModalHeader>
            <ModalBody>
              <p>Bist du sicher? Alle synchronisierten Termine aus dieser Quelle werden entfernt.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setShowDisconnectModal(null)}>Abbrechen</Button>
              <Button color="danger" onPress={() => handleDisconnect(showDisconnectModal!)}>Trennen</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
