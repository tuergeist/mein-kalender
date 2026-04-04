"use client";

import { useEffect, useState } from "react";

interface LocationMapProps {
  location: string;
  className?: string;
}

export function LocationMap({ location, className = "" }: LocationMapProps) {
  const [provider, setProvider] = useState<string>("google");

  useEffect(() => {
    setProvider(localStorage.getItem("mapProvider") || "google");
  }, []);

  if (provider === "none") return null;

  // If location is a URL (meeting link), just show it as a link — no map
  const isUrl = /^https?:\/\//i.test(location);
  if (isUrl) {
    const isMeeting = /meet\.google|teams\.microsoft|zoom\.(us|com)/i.test(location);
    return (
      <p className={`text-sm ${className}`}>
        <span className="text-default-400">Ort: </span>
        <a href={location} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline">
          {isMeeting ? "Online-Meeting" : location}
        </a>
      </p>
    );
  }

  const q = encodeURIComponent(location);

  const linkUrl =
    provider === "apple"
      ? `https://maps.apple.com/?q=${q}`
      : provider === "osm"
        ? `https://www.openstreetmap.org/search?query=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`;

  const embedUrl =
    provider === "osm"
      ? `https://www.openstreetmap.org/export/embed.html?bbox=&layer=mapnik&marker=&query=${q}`
      : `https://maps.google.com/maps?q=${q}&output=embed&z=15`;

  const showEmbed = provider !== "apple";

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-sm">
        <span className="text-default-400">Ort: </span>
        <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-rose-700 hover:underline">
          {location}
        </a>
      </p>
      {showEmbed && (
        <iframe
          className="h-40 w-full rounded-lg border border-gray-200"
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
