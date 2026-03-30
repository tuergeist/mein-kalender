"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Spinner,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { AdminSidebar } from "@/components/AdminSidebar";
import { apiAuthFetch } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  calendarSourceCount: number;
  providers: string[];
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const role = (session as any)?.role;

  useEffect(() => {
    if (status === "authenticated" && role !== "admin") {
      router.replace("/");
    }
  }, [status, role, router]);

  const fetchUsers = useCallback(async () => {
    const token = (session as any)?.accessToken;
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await apiAuthFetch(`/api/admin/users?${params}`, token);
      if (!res.ok) {
        setError("Benutzer konnten nicht geladen werden");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [session, page, search]);

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      fetchUsers();
    }
  }, [status, role, fetchUsers]);

  if (status === "loading" || role !== "admin") {
    return null;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AppShell sidebarContent={<AdminSidebar />}>
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">Benutzer</h1>

        <Input
          placeholder="Nach E-Mail oder Name suchen..."
          value={search}
          onValueChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          isClearable
          onClear={() => {
            setSearch("");
            setPage(1);
          }}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <Card>
          <CardBody className="p-0">
            {loading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : (
              <Table aria-label="Users" removeWrapper>
                <TableHeader>
                  <TableColumn>E-Mail</TableColumn>
                  <TableColumn>Name</TableColumn>
                  <TableColumn>Anbieter</TableColumn>
                  <TableColumn>Kalender</TableColumn>
                  <TableColumn>Beigetreten</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Keine Benutzer gefunden">
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <span className="font-mono text-sm">{u.email}</span>
                        {u.role === "admin" && (
                          <Chip size="sm" color="warning" variant="flat" className="ml-2">
                            admin
                          </Chip>
                        )}
                      </TableCell>
                      <TableCell>{u.displayName || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {u.providers.length > 0 ? (
                            u.providers.map((p) => (
                              <Chip key={p} size="sm" variant="flat">
                                {p}
                              </Chip>
                            ))
                          ) : (
                            <Chip size="sm" variant="flat">
                              credentials
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{u.calendarSourceCount}</TableCell>
                      <TableCell className="text-sm text-default-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-default-500">
            <span>
              {total} Benutzer — Seite {page} von {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                isDisabled={page <= 1}
                onPress={() => setPage(page - 1)}
              >
                Zurück
              </Button>
              <Button
                size="sm"
                variant="flat"
                isDisabled={page >= totalPages}
                onPress={() => setPage(page + 1)}
              >
                Weiter
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
