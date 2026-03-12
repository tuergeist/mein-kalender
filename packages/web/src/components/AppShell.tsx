"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
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
    <div className="flex h-screen flex-col">
      <Navbar maxWidth="full" isBordered>
        <NavbarBrand>
          <Button
            isIconOnly
            variant="light"
            className="mr-2 md:hidden"
            onPress={() => setSidebarOpen(!sidebarOpen)}
          >
            <span className="text-xl">&#9776;</span>
          </Button>
          <Link href="/calendar" className="font-bold text-inherit">
            Calendar Sync
          </Link>
        </NavbarBrand>

        <NavbarContent justify="end">
          <NavbarItem>
            <Link href="/settings">
              <Button variant="light" size="sm">
                Settings
              </Button>
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Dropdown>
              <DropdownTrigger>
                <Avatar
                  src={session?.user?.image || undefined}
                  name={session?.user?.name || session?.user?.email || "U"}
                  size="sm"
                  className="cursor-pointer"
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
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } flex-shrink-0 overflow-y-auto border-r border-default-200 bg-default-50 transition-all duration-200 md:w-64`}
        >
          <CalendarSidebar />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
