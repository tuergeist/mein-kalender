"use client";

import { useEffect, useState } from "react";

/**
 * True once the component has hydrated in the browser.
 *
 * For anything that reads the environment — the current time, the browser's
 * timezone, its locale. Those differ between the server and the visitor, and a
 * client component still gets rendered on the server: the greeting on the
 * dashboard is built from `new Date().getHours()`, which is UTC on the server
 * and Europe/Berlin in the browser. Between 10:00 and 12:00 UTC the server
 * writes "Guten Morgen" and the browser expects "Guten Tag", React finds two
 * different texts and aborts hydration with error #418.
 *
 * Guarding on this makes the first client render identical to the server's;
 * the environment-dependent value appears in the render right after, which is
 * an ordinary update and not a mismatch.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
