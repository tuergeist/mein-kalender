"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, CardBody, Input, Button, Avatar } from "@heroui/react";
import { AppShell } from "@/components/AppShell";

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const [displayName, setDisplayName] = useState(session?.user?.name || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await update({ name: displayName });
    setSaving(false);
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell section="settings" settingsSection="profile">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>

        <Card>
          <CardBody className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <Avatar
                src={session?.user?.image || undefined}
                name={session?.user?.name || session?.user?.email || "U"}
                size="lg"
              />
              <div>
                <p className="font-medium">{session?.user?.name || "User"}</p>
                <p className="text-sm text-default-500">{session?.user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Email"
                value={session?.user?.email || ""}
                isReadOnly
                variant="bordered"
              />
              <Input
                label="Display Name"
                value={displayName}
                onValueChange={setDisplayName}
                variant="bordered"
              />
              <Button
                color="primary"
                isLoading={saving}
                onPress={handleSave}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
        {/* Delete Account */}
        <Card className="border border-danger-200">
          <CardBody className="p-6">
            <h2 className="font-display text-lg font-semibold text-danger">Konto löschen</h2>
            <p className="mt-1 text-sm text-default-500">
              Alle Daten werden unwiderruflich gelöscht: Kalender-Verbindungen, Buchungsseiten, Sync-Daten und dein Profil.
            </p>
            {!showDeleteConfirm ? (
              <Button
                color="danger"
                variant="flat"
                className="mt-4"
                onPress={() => setShowDeleteConfirm(true)}
              >
                Konto löschen
              </Button>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <Button
                  color="danger"
                  isLoading={deleting}
                  onPress={handleDeleteAccount}
                >
                  Ja, unwiderruflich löschen
                </Button>
                <Button
                  variant="flat"
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  Abbrechen
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
