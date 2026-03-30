"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CalendarView } from "@/components/CalendarView";
import { CalendarSidebar } from "@/components/CalendarSidebar";

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") || undefined;

  return (
    <AppShell section="calendar" sidebarContent={<CalendarSidebar />}>
      <CalendarView initialDate={initialDate} />
    </AppShell>
  );
}
