"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import Link from "next/link";

export type AppSection = "calendar" | "bookings" | "sync" | "settings";

interface AppShellProps {
  children: React.ReactNode;
  section?: AppSection;
  sidebarContent?: React.ReactNode;
}

const NAV_ITEMS: { key: AppSection; label: string; href: string; icon: string }[] = [
  { key: "calendar", label: "Calendar", href: "/calendar", icon: "M6 2v2M18 2v2M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { key: "bookings", label: "Bookings", href: "/bookings", icon: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 14l2 2 4-4M12 2v4" },
  { key: "sync", label: "Cal Sync", href: "/sync", icon: "M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" },
  { key: "settings", label: "Settings", href: "/settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" },
];

export function AppShell({ children, section, sidebarContent }: AppShellProps) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Burger — mobile only */}
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="md:hidden"
            onPress={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Button>
          <Link href="/calendar" className="flex items-center hover:opacity-80">
            <img src="/logo-horizontal.svg" alt="mein-kalender.link" height="32" className="h-8" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {(session as any)?.role === "admin" && (
            <Link href="/admin">
              <Button variant="light" size="sm" className="hidden text-gray-600 sm:flex">
                Admin
              </Button>
            </Link>
          )}
          <Dropdown>
            <DropdownTrigger>
              <Avatar
                src={session?.user?.image || undefined}
                name={session?.user?.name || session?.user?.email || "U"}
                size="sm"
                className="cursor-pointer"
                color="primary"
              />
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem key="profile" href="/profile">
                Profile
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                Sign Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar overlay — mobile only */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            fixed z-30 flex h-[calc(100vh-3.5rem)] w-56 flex-col border-r border-gray-200 bg-white transition-transform duration-200
            md:relative md:z-auto md:h-auto
          `}
        >
          {/* Navigation links */}
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  section === item.key
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Contextual sidebar content (e.g. calendar list) */}
          {sidebarContent && (
            <div className="flex-1 overflow-y-auto border-t border-gray-100">
              {sidebarContent}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
