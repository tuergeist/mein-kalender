"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardBody, CardHeader, Button, Input } from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function ProtonSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubscribe() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiAuthFetch("/api/ics/subscribe", token, {
        method: "POST",
        body: JSON.stringify({ url, label: label || "Proton Kalender" }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Abonnement fehlgeschlagen");
      } else {
        const data = await res.json();
        setSuccess(`Abonniert mit ${data.eventsImported} Terminen`);
        setTimeout(() => router.push("/settings"), 1500);
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="light"
            size="sm"
            onPress={() => router.push("/settings")}
          >
            &larr; Zurück
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Proton Kalender hinzufügen</h1>
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-2 px-6 pt-6">
            <h2 className="text-lg font-semibold">
              Proton Kalender Freigabelink abrufen
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-default-600">
              <li>
                Öffne{" "}
                <span className="font-medium text-default-800">
                  Proton Kalender
                </span>{" "}
                im Browser
              </li>
              <li>
                Klicke auf das{" "}
                <span className="font-medium text-default-800">
                  Drei-Punkte-Menü
                </span>{" "}
                neben dem Kalender, den du teilen möchtest
              </li>
              <li>
                Wähle{" "}
                <span className="font-medium text-default-800">
                  Teilen
                </span>
              </li>
              <li>
                Aktiviere{" "}
                <span className="font-medium text-default-800">
                  Mit jedem teilen
                </span>{" "}
                und kopiere den Link
              </li>
              <li>Füge den Link unten ein</li>
            </ol>
          </CardHeader>
          <CardBody className="flex flex-col gap-4 px-6 pb-6">
            <Input
              label="Kalender-Freigabelink"
              type="url"
              value={url}
              onValueChange={(v) => {
                setUrl(v);
                setError("");
              }}
              placeholder="https://calendar.proton.me/api/calendar/v1/..."
            />
            <Input
              label="Kalendername (optional)"
              value={label}
              onValueChange={setLabel}
              placeholder="Proton Kalender"
            />
            <p className="text-xs text-default-400">
              Der Kalender wird automatisch stündlich aktualisiert. Termine sind
              schreibgeschützt.
            </p>
            <Button
              color="primary"
              isLoading={loading}
              onPress={handleSubscribe}
              isDisabled={!url}
            >
              Abonnieren
            </Button>

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
