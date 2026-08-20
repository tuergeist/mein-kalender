"use client";

/**
 * Brand background for booking pages.
 *
 * The image is shown with `contain`, so it is always visible in full regardless
 * of the window aspect ratio. The margins left over are filled with a blurred,
 * `cover`-scaled copy of the same image, which yields an averaged-out edge
 * colour without having to read pixels (works with cross-origin URLs).
 *
 * `position` is "fixed" on the real booking pages so the image fits the
 * viewport even when the page scrolls, and "absolute" for the settings preview.
 */
export function BrandBackground({
  url,
  opacity = 0.85,
  position = "fixed",
  blur = 48,
}: {
  url: string;
  opacity?: number;
  position?: "fixed" | "absolute";
  blur?: number;
}) {
  const layer = "absolute inset-0 bg-no-repeat bg-center";
  return (
    <div className={`${position} inset-0 overflow-hidden pointer-events-none`} aria-hidden="true">
      <div
        className={`${layer} bg-cover`}
        style={{ backgroundImage: `url(${url})`, filter: `blur(${blur}px) saturate(1.1)`, transform: "scale(1.2)" }}
      />
      <div className={`${layer} bg-contain`} style={{ backgroundImage: `url(${url})` }} />
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(255,255,255,${opacity})` }} />
    </div>
  );
}
