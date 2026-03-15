"use client";

import { HeroUIProvider } from "@heroui/react";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={5 * 60}>
      <HeroUIProvider>{children}</HeroUIProvider>
    </SessionProvider>
  );
}
