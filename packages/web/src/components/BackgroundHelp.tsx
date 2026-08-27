"use client";

/**
 * Shared help for the booking-page background field.
 *
 * The booking card is `max-w-3xl` (768px) and sits centred on the page, while
 * the background is scaled with `contain` to the viewport. What has to stay
 * clear is therefore a proportion, not a pixel box: the middle 64% of the width
 * and 53% of the height. The template offers those proportions as 770 × 420 on
 * a 1200 × 800 canvas, which is easier to work with in an image editor.
 */

export const SAFE_ZONE_WIDTH = "64%";
export const SAFE_ZONE_HEIGHT = "53%";
export const TEMPLATE_URL = "/hintergrund-vorlage.svg";

/**
 * Dashed outline of the area the booking card covers, drawn over a preview.
 * The parent needs `position: relative`.
 */
export function SafeZoneOverlay({ label = true }: { label?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="flex items-center justify-center rounded border-2 border-dashed border-white/80"
        style={{
          width: SAFE_ZONE_WIDTH,
          height: SAFE_ZONE_HEIGHT,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.18)",
        }}
      >
        {label && (
          <span className="rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
            Buchungskarte
          </span>
        )}
      </div>
    </div>
  );
}

/** Sizing guidance plus the downloadable template. */
export function BackgroundHint() {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-default-400">
      1200 × 800 px. Die mittleren 770 × 420 px bleiben frei — dort liegt die
      Buchungskarte. Nicht bis an den Rand setzen, je nach Fensterformat wird
      dort angeschnitten.{" "}
      <a
        href={TEMPLATE_URL}
        download
        className="underline underline-offset-2 hover:text-default-600"
      >
        Vorlage herunterladen
      </a>
    </p>
  );
}

/**
 * Slider for how strongly the image shows through.
 *
 * The stored value is the opacity of a white veil over the image, so 0 means
 * the image is fully visible and 1 means it is washed out completely — the
 * opposite of what the number suggests. The control therefore shows the
 * complement and converts on the way in and out; nothing about the stored
 * value changes.
 */
export function ImageStrengthSlider({
  overlayOpacity,
  onChange,
}: {
  overlayOpacity: number;
  onChange: (overlayOpacity: number) => void;
}) {
  const strength = 1 - overlayOpacity;
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs text-default-400">Bildstärke</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={strength}
        onChange={(e) => onChange(1 - parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-8 text-xs text-default-400">{Math.round(strength * 100)}%</span>
    </div>
  );
}
