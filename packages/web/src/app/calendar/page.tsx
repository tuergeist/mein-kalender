import { AppShell } from "@/components/AppShell";
import { CalendarView } from "@/components/CalendarView";
import { CalendarSidebar } from "@/components/CalendarSidebar";

export default function CalendarPage() {
  return (
    <AppShell section="calendar" sidebarContent={<CalendarSidebar />}>
      <CalendarView />
    </AppShell>
  );
}
