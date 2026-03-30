"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, CardBody, CardHeader, Input, Button, Avatar } from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

export default function ProfileSettingsPage() {
  const { data: session, update } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const [displayName, setDisplayName] = useState(session?.user?.name || "");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) loadBranding();
  }, [accessToken]);

  async function loadBranding() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/profile", accessToken);
    if (res.ok) {
      const data = await res.json();
      setAvatarUrl(data.avatarUrl || null);
      setBackgroundUrl(data.backgroundUrl || null);
    }
  }

  async function handleSave() {
    setSaving(true);
    await update({ name: displayName });
    setSaving(false);
  }

  async function uploadImage(type: "avatar" | "background") {
    if (!accessToken) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(type);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/profile/image/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (type === "avatar") setAvatarUrl(data.url);
        else setBackgroundUrl(data.url);
      }
      setUploading(null);
    };
    input.click();
  }

  async function removeImage(type: "avatar" | "background") {
    if (!accessToken) return;
    setRemoving(type);
    const res = await fetch(`/api/profile/image/${type}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      if (type === "avatar") setAvatarUrl(null);
      else setBackgroundUrl(null);
    }
    setRemoving(null);
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Profil</h1>

        <Card>
          <CardBody className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <Avatar
                src={avatarUrl || session?.user?.image || undefined}
                name={session?.user?.name || session?.user?.email || "U"}
                size="lg"
              />
              <div>
                <p className="font-medium">{session?.user?.name || "Benutzer"}</p>
                <p className="text-sm text-default-500">{session?.user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="E-Mail"
                value={session?.user?.email || ""}
                isReadOnly
                variant="bordered"
              />
              <Input
                label="Anzeigename"
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
                Änderungen speichern
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Branding Images */}
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Bilder</h2></CardHeader>
          <CardBody className="space-y-5 p-6 pt-0">
            {/* Avatar */}
            <div>
              <label className="mb-2 block text-sm font-medium">Profilbild</label>
              {avatarUrl ? (
                <div className="flex items-center gap-3">
                  <img src={avatarUrl} alt="Profilbild" className="h-16 w-16 rounded-full object-cover border border-default-200" />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-default-500">Bild hochgeladen</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")}>Ersetzen</Button>
                      <Button size="sm" variant="flat" color="danger" isLoading={removing === "avatar"} onPress={() => removeImage("avatar")}>Entfernen</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-default-300 bg-default-50">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-default-400"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-4 3.5-7 7-7s7 3 7 7"/></svg>
                  </div>
                  <Button size="sm" variant="bordered" isLoading={uploading === "avatar"} onPress={() => uploadImage("avatar")}>Bild hochladen</Button>
                </div>
              )}
            </div>

            {/* Background */}
            <div>
              <label className="mb-2 block text-sm font-medium">Hintergrundbild</label>
              {backgroundUrl ? (
                <div className="space-y-2">
                  <img src={backgroundUrl} alt="Hintergrundbild" className="h-36 w-full max-w-md rounded-lg object-cover border border-default-200" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-default-500">Bild hochgeladen</span>
                    <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")}>Ersetzen</Button>
                    <Button size="sm" variant="flat" color="danger" isLoading={removing === "background"} onPress={() => removeImage("background")}>Entfernen</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-default-300 bg-default-50">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-default-400"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 4-4 5 5"/></svg>
                  </div>
                  <Button size="sm" variant="bordered" isLoading={uploading === "background"} onPress={() => uploadImage("background")}>Bild hochladen</Button>
                </div>
              )}
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
