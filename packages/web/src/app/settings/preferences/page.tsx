"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { AppShell } from "@/components/AppShell";

export default function PreferencesPage() {
  const [mapProvider, setMapProvider] = useState<string>("google");

  useEffect(() => {
    setMapProvider(localStorage.getItem("mapProvider") || "google");
  }, []);

  return (
    <AppShell section="settings" settingsSection="other">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Preferences</h1>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Map Provider</h2></CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Choose which map service to use for event locations.
            </p>
            <Select
              label="Map Provider"
              selectedKeys={[mapProvider]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected) {
                  setMapProvider(selected);
                  localStorage.setItem("mapProvider", selected);
                }
              }}
            >
              <SelectItem key="google">Google Maps</SelectItem>
              <SelectItem key="osm">OpenStreetMap</SelectItem>
              <SelectItem key="apple">Apple Maps</SelectItem>
              <SelectItem key="none">No map</SelectItem>
            </Select>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
