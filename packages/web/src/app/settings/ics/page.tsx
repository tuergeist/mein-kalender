"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Tabs,
  Tab,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function ICSSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<string>("file");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [icsData, setIcsData] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email invitation state (shown after successful import/subscription)
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setIcsData(ev.target?.result as string);
    };
    reader.onerror = () => setError("Datei konnte nicht gelesen werden");
    reader.readAsText(file);
  }

  async function handleUpload() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    if (!icsData) {
      setError("Bitte zuerst eine ICS-Datei auswählen");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiAuthFetch("/api/ics/upload", token, {
        method: "POST",
        body: JSON.stringify({ icsData, label: label || fileName || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Hochladen fehlgeschlagen");
      } else {
        const data = await res.json();
        setSuccess(`${data.eventsImported} Termine importiert`);
        setSourceId(data.sourceId);
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    }
    setLoading(false);
  }

  async function handleSubscribe() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    if (!url) {
      setError("Bitte eine ICS-URL eingeben");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await apiAuthFetch("/api/ics/subscribe", token, {
        method: "POST",
        body: JSON.stringify({ url, label: label || undefined }),
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
          <Button variant="light" size="sm" onPress={() => router.push("/settings")}>
            &larr; Zurück
          </Button>
          <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">ICS-Kalender importieren</h1>
        </div>

        <Card>
          <CardHeader className="px-6 pt-6">
            <Input
              label="Kalendername (optional)"
              value={label}
              onValueChange={setLabel}
              placeholder="z.B. Arbeitsplan, Feiertage"
            />
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <Tabs
              selectedKey={tab}
              onSelectionChange={(key) => {
                setTab(key as string);
                setError("");
                setSuccess("");
              }}
            >
              <Tab key="file" title="Datei hochladen">
                <div className="flex flex-col gap-4 pt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,.ical,.ifb,.icalendar"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="bordered"
                      onPress={() => fileInputRef.current?.click()}
                    >
                      Datei wählen
                    </Button>
                    <span className="text-sm text-default-500">
                      {fileName || "Keine Datei ausgewählt"}
                    </span>
                  </div>
                  {icsData && (
                    <p className="text-sm text-default-400">
                      Datei geladen ({Math.round(icsData.length / 1024)} KB)
                    </p>
                  )}
                  <Button
                    color="primary"
                    isLoading={loading}
                    onPress={handleUpload}
                    isDisabled={!icsData}
                  >
                    Importieren
                  </Button>
                </div>
              </Tab>
              <Tab key="url" title="URL abonnieren">
                <div className="flex flex-col gap-4 pt-4">
                  <Input
                    label="ICS URL"
                    type="url"
                    value={url}
                    onValueChange={setUrl}
                    placeholder="https://example.com/calendar.ics"
                  />
                  <details className="group rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100">
                      <span className="ml-1">Proton Kalender? So findest du die ICS-URL</span>
                    </summary>
                    <div className="border-t border-stone-200 px-4 py-3 dark:border-stone-700">
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-stone-600 dark:text-stone-400">
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
                          &rarr; <span className="font-medium text-stone-800 dark:text-stone-200">Kalender-Einstellungen</span>
                        </li>
                        <li>
                          Finde den Kalender &rarr; <span className="font-medium text-stone-800 dark:text-stone-200">Aktionen</span>
                        </li>
                        <li>
                          Link kopieren: <span className="font-medium text-stone-800 dark:text-stone-200">Vollansicht</span>{" "}
                          (alle Details) oder <span className="font-medium text-stone-800 dark:text-stone-200">Eingeschränkte Ansicht</span>{" "}
                          (nur Verfügbarkeit)
                        </li>
                        <li>ICS-Link hier einfügen</li>
                      </ol>
                    </div>
                  </details>
                  <p className="text-xs text-default-400">
                    Der Kalender wird automatisch stündlich aktualisiert.
                  </p>
                  <Button
                    color="primary"
                    isLoading={loading}
                    onPress={handleSubscribe}
                    isDisabled={!url}
                  >
                    Abonnieren
                  </Button>
                </div>
              </Tab>
            </Tabs>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            {success && <p className="mt-4 text-sm text-success">{success}</p>}
          </CardBody>
        </Card>

        {sourceId && (
          <Card>
            <CardBody className="flex flex-col gap-4 px-6 py-6">
              <Input
                label="E-Mail für Termineinladungen (optional)"
                description="Wenn du hier eine E-Mail eingibst, werden Buchungen als Kalendereinladung an diese Adresse gesendet und erscheinen direkt in deinem Kalender."
                type="email"
                value={email}
                onValueChange={(v) => {
                  setEmail(v);
                  setEmailError("");
                  setEmailSuccess("");
                }}
                placeholder="name@example.com"
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
