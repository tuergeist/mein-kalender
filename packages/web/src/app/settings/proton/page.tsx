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
        body: JSON.stringify({ url, label: label || "Proton Calendar" }),
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
          <Button
            variant="light"
            size="sm"
            onPress={() => router.push("/settings")}
          >
            &larr; Back
          </Button>
          <h1 className="text-2xl font-bold">Add Proton Calendar</h1>
        </div>

        <Card>
          <CardHeader className="flex-col items-start gap-2 px-6 pt-6">
            <h2 className="text-lg font-semibold">
              Get your Proton Calendar share link
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-default-600">
              <li>
                Open{" "}
                <span className="font-medium text-default-800">
                  Proton Calendar
                </span>{" "}
                in your browser
              </li>
              <li>
                Click the{" "}
                <span className="font-medium text-default-800">
                  three-dot menu
                </span>{" "}
                next to the calendar you want to share
              </li>
              <li>
                Select{" "}
                <span className="font-medium text-default-800">
                  Share
                </span>
              </li>
              <li>
                Enable{" "}
                <span className="font-medium text-default-800">
                  Share with anyone
                </span>{" "}
                and copy the link
              </li>
              <li>Paste the link below</li>
            </ol>
          </CardHeader>
          <CardBody className="flex flex-col gap-4 px-6 pb-6">
            <Input
              label="Calendar Share Link"
              type="url"
              value={url}
              onValueChange={(v) => {
                setUrl(v);
                setError("");
              }}
              placeholder="https://calendar.proton.me/api/calendar/v1/..."
            />
            <Input
              label="Calendar Name (optional)"
              value={label}
              onValueChange={setLabel}
              placeholder="Proton Calendar"
            />
            <p className="text-xs text-default-400">
              The calendar will be refreshed automatically every hour. Events are
              read-only.
            </p>
            <Button
              color="primary"
              isLoading={loading}
              onPress={handleSubscribe}
              isDisabled={!url}
            >
              Subscribe
            </Button>

            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">{success}</p>}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
