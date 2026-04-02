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
        <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">Einstellungen</h1>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Kartenanbieter</h2></CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-default-500">
              Wähle den Kartendienst für Veranstaltungsorte.
            </p>
            <Select
              label="Kartenanbieter"
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
              <SelectItem key="none">Keine Karte</SelectItem>
            </Select>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
