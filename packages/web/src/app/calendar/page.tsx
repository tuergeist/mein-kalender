"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CalendarView } from "@/components/CalendarView";
import { CalendarSidebar } from "@/components/CalendarSidebar";

function CalendarContent() {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") || undefined;
  const initialTime = searchParams.get("time") || undefined;

  return (
    <AppShell section="calendar" sidebarContent={<CalendarSidebar />}>
      <CalendarView initialDate={initialDate} initialTime={initialTime} />
    </AppShell>
  );
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarContent />
    </Suspense>
  );
}
