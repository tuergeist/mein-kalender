"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardBody, CardHeader, Button, Input, Divider } from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function AppleSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleConnect() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiAuthFetch("/api/sources/apple/connect", token, {
        method: "POST",
        body: JSON.stringify({ appleId, appPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Verbindung fehlgeschlagen");
      } else {
        const data = await res.json();
        setSuccess(`Verbunden — ${data.calendarsImported} Kalender importiert`);
        setTimeout(() => router.push("/settings"), 2000);
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    }
    setLoading(false);
  }

  return (
    <AppShell section="settings" settingsSection="sources">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">iCloud Kalender</h1>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Verbindung einrichten</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-lg border border-default-200 bg-default-50 p-4 space-y-3">
              <p className="text-sm font-medium">App-spezifisches Passwort erstellen</p>
              <p className="text-sm text-default-500">
                Apple erlaubt keinen direkten Zugriff auf iCloud-Kalender. Du musst ein spezielles App-Passwort erstellen:
              </p>
              <ol className="list-decimal ml-5 space-y-1 text-sm text-default-500">
                <li>
                  Öffne{" "}
                  <a
                    href="https://appleid.apple.com/account/manage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    appleid.apple.com
                  </a>{" "}
                  und melde dich an
                </li>
                <li>Gehe zu <strong>Anmeldung und Sicherheit</strong> &rarr; <strong>App-spezifische Passwörter</strong></li>
                <li>Klicke auf <strong>App-spezifisches Passwort erstellen</strong></li>
                <li>Gib als Name z.B. &quot;Mein Kalender&quot; ein</li>
                <li>Kopiere das generierte Passwort (Format: xxxx-xxxx-xxxx-xxxx)</li>
              </ol>
            </div>

            <Divider />

            <Input
              label="Apple-ID (E-Mail)"
              type="email"
              placeholder="name@icloud.com"
              value={appleId}
              onValueChange={setAppleId}
            />
            <Input
              label="App-spezifisches Passwort"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onValueChange={setAppPassword}
            />

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="light" onPress={() => router.push("/settings")}>
                Abbrechen
              </Button>
              <Button
                color="primary"
                isLoading={loading}
                isDisabled={!appleId || !appPassword}
                onPress={handleConnect}
              >
                Verbinden
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
