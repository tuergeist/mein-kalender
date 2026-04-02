"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      size="sm"
      variant="light"
      isIconOnly
      className={className || "h-7 w-7 min-w-0"}
      onPress={handleCopy}
    >
      {copied ? (
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: "fadeInUp 0.15s ease-out both" }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </Button>
  );
}
