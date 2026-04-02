"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  RadioGroup,
  Radio,
} from "@heroui/react";
import Link from "next/link";
import { apiAuthFetch } from "@/lib/api";

export type AppSection = "dashboard" | "calendar" | "event-types" | "sync" | "settings";
export type SettingsSubSection = "sources" | "events" | "booking" | "profile" | "other";

interface AppShellProps {
  children: React.ReactNode;
  section?: AppSection;
  settingsSection?: SettingsSubSection;
  sidebarContent?: React.ReactNode;
}

const SETTINGS_NAV: { key: SettingsSubSection; label: string; href: string; icon: string }[] = [
  { key: "sources", label: "Kalenderquellen", href: "/settings", icon: "M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" },
  { key: "booking", label: "Buchungsstandards", href: "/settings/booking", icon: "M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 14l2 2 4-4M12 2v4" },
  { key: "profile", label: "Profil", href: "/settings/profile", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" },
  { key: "other", label: "Einstellungen", href: "/settings/preferences", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
];

const NAV_ITEMS: { key: AppSection; label: string; href: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { key: "calendar", label: "Kalender", href: "/calendar", icon: "M6 2v2M18 2v2M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" },
  { key: "event-types", label: "Terminarten", href: "/settings/events", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { key: "sync", label: "Kalender-Sync", href: "/sync", icon: "M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" },
  { key: "settings", label: "Einstellungen", href: "/settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" },
];

function useSyncHeartbeat() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const [status, setStatus] = useState<"unknown" | "ok" | "warning" | "error">("unknown");

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    function check() {
      apiAuthFetch("/api/dashboard/sync-status", accessToken!)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!mounted || !data?.sources) return;
          const statuses = data.sources.map((s: { syncStatus: string }) => s.syncStatus);
          if (statuses.length === 0) setStatus("unknown");
          else if (statuses.every((s: string) => s === "ok")) setStatus("ok");
          else if (statuses.some((s: string) => s === "error")) setStatus("error");
          else setStatus("warning");
        })
        .catch(() => {});
    }

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // 5 min
    return () => { mounted = false; clearInterval(interval); };
  }, [accessToken]);

  return status;
}

export function AppShell({ children, section, settingsSection, sidebarContent }: AppShellProps) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const heartbeat = useSyncHeartbeat();
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbType, setFbType] = useState<"bug" | "feature">("bug");
  const [fbTitle, setFbTitle] = useState("");
  const [fbDesc, setFbDesc] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);

  async function handleFeedbackSubmit() {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!token || !fbTitle.trim()) return;
    setFbSending(true);
    try {
      await apiAuthFetch("/api/feedback", token, {
        method: "POST",
        body: JSON.stringify({ type: fbType, title: fbTitle.trim(), description: fbDesc.trim() || undefined }),
      });
      setFbDone(true);
      setTimeout(() => { setShowFeedback(false); setFbDone(false); setFbTitle(""); setFbDesc(""); setFbType("bug"); }, 1500);
    } finally {
      setFbSending(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      {/* Navbar */}
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 shadow-sm">
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
          <Link href="/dashboard" className="flex items-center gap-1.5 hover:opacity-80">
            <span className="font-display text-lg font-bold tracking-tight">
              <span className="text-rose-700">Mein</span>{" "}
              <span className="text-stone-900">Kalender</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {heartbeat !== "unknown" && (
            <span className={`inline-block h-2 w-2 rounded-full ${
              heartbeat === "ok" ? "bg-[#059669]" :
              heartbeat === "warning" ? "bg-[var(--color-amber-500)] animate-pulse" :
              "bg-red-500 animate-pulse"
            }`} title={heartbeat === "ok" ? "Sync läuft" : heartbeat === "warning" ? "Sync verzögert" : "Sync-Fehler"} />
          )}
          {(session as any)?.role === "admin" && (
            <Link href="/admin">
              <Button variant="light" size="sm" className="hidden text-stone-600 sm:flex">
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
              <DropdownItem key="profile" href="/settings/profile">
                Profil
              </DropdownItem>
              <DropdownItem key="feedback" onPress={() => setShowFeedback(true)}>
                Feedback geben
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                Abmelden
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
            fixed z-30 flex h-[calc(100vh-3.5rem)] w-52 flex-col border-r border-stone-200 bg-white transition-transform duration-200
            md:relative md:z-auto md:h-auto
          `}
        >
          {/* Navigation links */}
          <nav className="flex flex-col gap-0.5 p-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  section === item.key
                    ? "border-l-2 border-rose-700 bg-rose-50 text-rose-700"
                    : "border-l-2 border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Settings sub-navigation */}
          {section === "settings" && (
            <div className="border-t border-stone-100 px-2 py-2">
              <p className="mb-1 px-3 font-mono text-[10px] font-medium uppercase tracking-widest text-stone-400">Einstellungen</p>
              <nav className="flex flex-col gap-0.5">
                {SETTINGS_NAV.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      settingsSection === item.key
                        ? "border-l-2 border-rose-700 bg-rose-50 font-medium text-rose-700"
                        : "border-l-2 border-transparent text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Contextual sidebar content (e.g. calendar list) */}
          {sidebarContent && (
            <div className="flex-1 overflow-y-auto border-t border-stone-100">
              {sidebarContent}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-5">{children}</main>
      </div>

      {/* Feedback Modal */}
      <Modal isOpen={showFeedback} onClose={() => { setShowFeedback(false); setFbDone(false); }}>
        <ModalContent>
          {fbDone ? (
            <ModalBody className="py-10 text-center">
              <p className="text-lg font-medium text-[#059669]">Danke fuer dein Feedback!</p>
            </ModalBody>
          ) : (
            <>
              <ModalHeader>Feedback geben</ModalHeader>
              <ModalBody className="flex flex-col gap-4">
                <RadioGroup label="Art" orientation="horizontal" value={fbType} onValueChange={(v) => setFbType(v as "bug" | "feature")}>
                  <Radio value="bug">Fehler melden</Radio>
                  <Radio value="feature">Wunsch / Idee</Radio>
                </RadioGroup>
                <Input label="Titel" placeholder="Kurze Beschreibung" value={fbTitle} onValueChange={setFbTitle} variant="bordered" />
                <Textarea label="Details (optional)" placeholder="Was ist passiert? Was wuenschst du dir?" value={fbDesc} onValueChange={setFbDesc} variant="bordered" minRows={3} />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => setShowFeedback(false)}>Abbrechen</Button>
                <Button color="primary" isLoading={fbSending} isDisabled={fbTitle.trim().length < 3} onPress={handleFeedbackSubmit}>Absenden</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
