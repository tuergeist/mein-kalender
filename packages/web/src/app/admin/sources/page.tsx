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
  Select,
  SelectItem,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { AdminSidebar } from "@/components/AdminSidebar";
import { apiAuthFetch } from "@/lib/api";

interface Source {
  id: string;
  label: string | null;
  provider: string;
  syncInterval: number;
  syncStatus: string;
  syncError: string | null;
  lastSyncAt: string | null;
  userEmail: string;
}

const intervalOptions = [
  { value: "60", label: "1 min" },
  { value: "120", label: "2 min" },
  { value: "300", label: "5 min" },
  { value: "600", label: "10 min" },
  { value: "900", label: "15 min" },
  { value: "1800", label: "30 min" },
  { value: "3600", label: "1 hour" },
  { value: "7200", label: "2 hours" },
  { value: "21600", label: "6 hours" },
  { value: "43200", label: "12 hours" },
  { value: "86400", label: "24 hours" },
];

function formatInterval(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}min`;
  return `${seconds / 3600}h`;
}

const statusColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  ok: "success",
  syncing: "warning",
  error: "danger",
};

export default function AdminSourcesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const role = (session as any)?.role;

  useEffect(() => {
    if (status === "authenticated" && role !== "admin") {
      router.replace("/");
    }
  }, [status, role, router]);

  const fetchSources = useCallback(async () => {
    const token = (session as any)?.accessToken;
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await apiAuthFetch(`/api/admin/sources?${params}`, token);
      if (!res.ok) {
        setError("Quellen konnten nicht geladen werden");
        return;
      }
      const data = await res.json();
      setSources(data.sources);
      setTotal(data.total);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [session, page, search]);

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      fetchSources();
    }
  }, [status, role, fetchSources]);

  async function updateInterval(sourceId: string, syncInterval: number) {
    const token = (session as any)?.accessToken;
    if (!token) return;

    setSaving(sourceId);
    try {
      const res = await apiAuthFetch(`/api/admin/sources/${sourceId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ syncInterval }),
      });
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, syncInterval } : s))
        );
      }
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  if (status === "loading" || role !== "admin") {
    return null;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <AppShell sidebarContent={<AdminSidebar />}>
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-bold">Quellen</h1>

        <Input
          placeholder="Nach Benutzer, Label oder Anbieter suchen..."
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
              <Table aria-label="Sources" removeWrapper>
                <TableHeader>
                  <TableColumn>Benutzer</TableColumn>
                  <TableColumn>Quelle</TableColumn>
                  <TableColumn>Anbieter</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Letzter Sync</TableColumn>
                  <TableColumn>Intervall</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Keine Quellen gefunden">
                  {sources.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <span className="text-xs">{s.userEmail}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {s.label || s.id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">
                          {s.provider}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={statusColors[s.syncStatus] || "default"}
                          variant="flat"
                        >
                          {s.syncStatus}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-xs text-default-500">
                        {s.lastSyncAt
                          ? new Date(s.lastSyncAt).toLocaleString()
                          : "nie"}
                      </TableCell>
                      <TableCell>
                        <Select
                          size="sm"
                          aria-label="Sync interval"
                          selectedKeys={[String(s.syncInterval)]}
                          onSelectionChange={(keys) => {
                            const val = Array.from(keys)[0] as string;
                            if (val) updateInterval(s.id, parseInt(val, 10));
                          }}
                          isLoading={saving === s.id}
                          className="min-w-[100px]"
                        >
                          {intervalOptions.map((opt) => (
                            <SelectItem key={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </Select>
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
              {total} Quellen — Seite {page} von {totalPages}
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
