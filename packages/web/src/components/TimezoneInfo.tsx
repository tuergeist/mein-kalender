"use client";

import { useMemo } from "react";
import type { useLocale } from "@/lib/i18n";

type T = ReturnType<typeof useLocale>["t"];

function tzDisplayName(tz: string, locale: string): string {
  try {
    // Try to get a human-readable timezone name (e.g., "Central European Time")
    const parts = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart) return tzPart.value;
  } catch {
    // fallback
  }
  return tz.replace(/_/g, " ");
}

function getUtcOffsetMinutes(tz: string): number {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = now.toLocaleString("en-US", { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

interface TimezoneInfoProps {
  hostTimezone: string;
  hostName: string;
  t: T;
  bcp47: string;
}

export function TimezoneInfo({ hostTimezone, hostName, t, bcp47 }: TimezoneInfoProps) {
  const visitorTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);

  const isDifferent = visitorTimezone !== hostTimezone;

  const offsetInfo = useMemo(() => {
    if (!isDifferent) return null;
    const visitorOffset = getUtcOffsetMinutes(visitorTimezone);
    const hostOffset = getUtcOffsetMinutes(hostTimezone);
    const diffMinutes = visitorOffset - hostOffset;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours === 0) return null;
    return diffHours;
  }, [isDifferent, visitorTimezone, hostTimezone]);

  if (!isDifferent) return null;

  const visitorTzName = tzDisplayName(visitorTimezone, bcp47);
  const hostTzName = tzDisplayName(hostTimezone, bcp47);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700">
      <div className="flex items-start gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <div className="space-y-0.5">
          <p>
            <span className="font-medium">{t("tz.yourTimezone")}:</span> {visitorTzName}
          </p>
          <p>
            <span className="font-medium">{t("tz.hostTimezone", { host: hostName })}:</span> {hostTzName}
          </p>
          {offsetInfo !== null && (
            <p className="font-medium">
              {offsetInfo > 0
                ? t("tz.aheadBy", { hours: String(Math.abs(offsetInfo)) })
                : t("tz.behindBy", { hours: String(Math.abs(offsetInfo)) })}
              {" · "}
              {t("tz.timesInYourTimezone")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
