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

export function AppShell({ children, sidebar }: { children: React.ReactNode; sidebar?: React.ReactNode }) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="light"
            size="sm"
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
          <Link href="/settings">
            <Button variant="light" size="sm" className="hidden text-gray-600 sm:flex">
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

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar — overlay on mobile, inline on desktop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
            fixed z-30 h-[calc(100vh-3.5rem)] w-60 border-r border-gray-200 bg-white transition-transform duration-200
            md:relative md:z-auto md:h-auto
          `}
        >
          {sidebar || <CalendarSidebar />}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5">{children}</main>
      </div>
    </div>
  );
}
