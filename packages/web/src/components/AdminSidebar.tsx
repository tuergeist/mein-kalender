"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Users" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/sync", label: "Sync Queue" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400">
        Admin
      </p>
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-rose-50 font-medium text-rose-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <hr className="my-3 border-gray-200" />
      <Link
        href="/dashboard"
        className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
      >
        Back to Dashboard
      </Link>
    </nav>
  );
}
