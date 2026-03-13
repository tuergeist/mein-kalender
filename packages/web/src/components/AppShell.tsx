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
import { CalendarSidebar } from "./CalendarSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
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
          <Link href="/calendar" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-600">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="14" r="1" fill="currentColor" />
              <circle cx="12" cy="14" r="1" fill="currentColor" />
              <circle cx="16" cy="14" r="1" fill="currentColor" />
              <circle cx="8" cy="18" r="1" fill="currentColor" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
            </svg>
            Calendar Sync
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/settings">
            <Button variant="light" size="sm" className="text-gray-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6.5 1.5h3l.3 1.7a5 5 0 011.2.7l1.6-.6 1.5 2.6-1.3 1.1a5 5 0 010 1.4l1.3 1.1-1.5 2.6-1.6-.6a5 5 0 01-1.2.7l-.3 1.7h-3l-.3-1.7a5 5 0 01-1.2-.7l-1.6.6-1.5-2.6 1.3-1.1a5 5 0 010-1.4L2.9 5.9l1.5-2.6 1.6.6a5 5 0 011.2-.7l.3-1.7z" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              Settings
            </Button>
          </Link>
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
              <DropdownItem key="settings" href="/settings">
                Settings
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-60" : "w-0"
          } shrink-0 overflow-y-auto border-r border-gray-200 bg-white transition-all duration-200 md:w-60`}
        >
          <CalendarSidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
