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

  // Email invitation state (shown after successful subscription)
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailError, setEmailError] = useState("");

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
        setSourceId(data.sourceId);
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    }
    setLoading(false);
  }

  async function handleSaveEmail() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token || !sourceId) return;

    setEmailSaving(true);
    setEmailError("");
    setEmailSuccess("");

    try {
      const res = await apiAuthFetch(`/api/sources/${sourceId}`, token, {
        method: "PUT",
        body: JSON.stringify({ emailForInvitations: email || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEmailError(data.error || "Speichern fehlgeschlagen");
      } else {
        setEmailSuccess("Gespeichert");
        setTimeout(() => router.push("/settings"), 1500);
      }
    } catch {
      setEmailError("Verbindung zum Server fehlgeschlagen");
    }
    setEmailSaving(false);
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
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Proton Kalender hinzufügen</h1>
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-2 px-6 pt-6">
            <h2 className="text-lg font-semibold">
              Proton Kalender Freigabelink abrufen
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-default-600">
              <li>
                Öffne{" "}
                <a
                  href="https://account.proton.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-500"
                >
                  account.proton.me
                </a>{" "}
                und navigiere zu{" "}
                <span className="font-medium text-default-800">
                  Kalender-Einstellungen
                </span>
              </li>
              <li>
                Finde den gewünschten Kalender und klicke auf{" "}
                <span className="font-medium text-default-800">
                  Aktionen
                </span>
              </li>
              <li>
                Kopiere den Link für{" "}
                <span className="font-medium text-default-800">
                  Vollansicht
                </span>{" "}
                (alle Details) oder{" "}
                <span className="font-medium text-default-800">
                  Eingeschränkte Ansicht
                </span>{" "}
                (nur Verfügbarkeit)
              </li>
              <li>Füge den ICS-Link unten ein</li>
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
              isDisabled={!!sourceId}
            />
            <Input
              label="Kalendername (optional)"
              value={label}
              onValueChange={setLabel}
              placeholder="Proton Kalender"
              isDisabled={!!sourceId}
            />
            <p className="text-xs text-default-400">
              Der Kalender wird automatisch stündlich aktualisiert. Termine sind
              schreibgeschützt.
            </p>
            {!sourceId && (
              <Button
                color="primary"
                isLoading={loading}
                onPress={handleSubscribe}
                isDisabled={!url}
              >
                Abonnieren
              </Button>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}
          </CardBody>
        </Card>

        {sourceId && (
          <Card>
            <CardBody className="flex flex-col gap-4 px-6 py-6">
              <Input
                label="E-Mail für Termineinladungen (optional)"
                description="Wenn du hier deine Proton-E-Mail eingibst, werden Buchungen als Kalendereinladung an diese Adresse gesendet und erscheinen direkt in deinem Proton-Kalender."
                type="email"
                value={email}
                onValueChange={(v) => {
                  setEmail(v);
                  setEmailError("");
                  setEmailSuccess("");
                }}
                placeholder="name@proton.me"
              />
              <div className="flex items-center gap-3">
                <Button
                  color="primary"
                  size="sm"
                  isLoading={emailSaving}
                  onPress={handleSaveEmail}
                >
                  {email ? "Speichern" : "Überspringen"}
                </Button>
                {!email && (
                  <Button
                    variant="light"
                    size="sm"
                    onPress={() => router.push("/settings")}
                  >
                    Überspringen
                  </Button>
                )}
              </div>
              {emailError && <p className="text-sm text-danger">{emailError}</p>}
              {emailSuccess && <p className="text-sm text-success">{emailSuccess}</p>}
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
