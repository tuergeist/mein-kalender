"use client";

import { useState, useRef, useEffect } from "react";
import type { Locale } from "@/lib/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
  setLocale: (l: Locale) => void;
  allLocales: Locale[];
  localeFlags: Record<Locale, string>;
  localeLabels: Record<Locale, string>;
}

export function LanguageSwitcher({ locale, setLocale, allLocales, localeFlags, localeLabels }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border border-stone-200 bg-white/80 px-2 py-1 text-xs font-medium text-stone-500 backdrop-blur-sm transition-colors hover:bg-white hover:text-stone-700"
      >
        {localeFlags[locale]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 right-0 z-50 min-w-[120px] overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          {allLocales.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-stone-50 ${
                l === locale ? "font-semibold text-stone-900" : "text-stone-600"
              }`}
            >
              <span className="w-5 text-center font-mono text-[10px] text-stone-400">{localeFlags[l]}</span>
              {localeLabels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
