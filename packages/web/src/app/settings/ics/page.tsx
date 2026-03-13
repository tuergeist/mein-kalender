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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setIcsData(ev.target?.result as string);
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }

  async function handleUpload() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    if (!icsData) {
      setError("Please select an ICS file first");
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
        setError(data.error || "Upload failed");
      } else {
        const data = await res.json();
        setSuccess(`Imported ${data.eventsImported} events`);
        setTimeout(() => router.push("/settings"), 1500);
      }
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  }

  async function handleSubscribe() {
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return;

    if (!url) {
      setError("Please enter an ICS URL");
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
        setError(data.error || "Subscription failed");
      } else {
        const data = await res.json();
        setSuccess(`Subscribed with ${data.eventsImported} events`);
        setTimeout(() => router.push("/settings"), 1500);
      }
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="light" size="sm" onPress={() => router.push("/settings")}>
            &larr; Back
          </Button>
          <h1 className="text-2xl font-bold">Import ICS Calendar</h1>
        </div>

        <Card>
          <CardHeader className="px-6 pt-6">
            <Input
              label="Calendar Name (optional)"
              value={label}
              onValueChange={setLabel}
              placeholder="e.g. Work Schedule, Holidays"
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
              <Tab key="file" title="Upload File">
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
                      Choose File
                    </Button>
                    <span className="text-sm text-default-500">
                      {fileName || "No file selected"}
                    </span>
                  </div>
                  {icsData && (
                    <p className="text-sm text-default-400">
                      File loaded ({Math.round(icsData.length / 1024)} KB)
                    </p>
                  )}
                  <Button
                    color="primary"
                    isLoading={loading}
                    onPress={handleUpload}
                    isDisabled={!icsData}
                  >
                    Import
                  </Button>
                </div>
              </Tab>
              <Tab key="url" title="Subscribe to URL">
                <div className="flex flex-col gap-4 pt-4">
                  <Input
                    label="ICS URL"
                    type="url"
                    value={url}
                    onValueChange={setUrl}
                    placeholder="https://example.com/calendar.ics"
                  />
                  <p className="text-xs text-default-400">
                    The calendar will be refreshed automatically every hour.
                  </p>
                  <Button
                    color="primary"
                    isLoading={loading}
                    onPress={handleSubscribe}
                    isDisabled={!url}
                  >
                    Subscribe
                  </Button>
                </div>
              </Tab>
            </Tabs>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            {success && <p className="mt-4 text-sm text-success">{success}</p>}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
