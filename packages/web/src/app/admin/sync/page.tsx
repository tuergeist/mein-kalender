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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { AdminSidebar } from "@/components/AdminSidebar";
import { apiAuthFetch } from "@/lib/api";

interface SyncJob {
  id: string;
  name: string;
  state: string;
  data: { sourceId?: string; userId?: string };
  userEmail: string | null;
  sourceLabel: string | null;
  sourceProvider: string | null;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
  attemptsMade: number;
}

interface JobCounts {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}

const stateColors: Record<string, "success" | "warning" | "danger" | "default"> = {
  completed: "success",
  active: "warning",
  failed: "danger",
  waiting: "default",
};

function formatTime(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function AdminSyncPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [counts, setCounts] = useState<JobCounts | null>(null);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedError, setSelectedError] = useState<{ job: SyncJob } | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const role = (session as any)?.role;

  useEffect(() => {
    if (status === "authenticated" && role !== "admin") {
      router.replace("/");
    }
  }, [status, role, router]);

  const fetchSync = useCallback(async () => {
    const token = (session as any)?.accessToken;
    if (!token) return;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await apiAuthFetch(`/api/admin/sync?${params}`, token);
      if (!res.ok) {
        setError("Sync-Daten konnten nicht geladen werden");
        return;
      }
      const data = await res.json();
      setCounts(data.counts);
      setJobs(data.jobs);
      setTotal(data.total);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [session, page, search]);

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      fetchSync();
    }
  }, [status, role, fetchSync]);

  if (status === "loading" || role !== "admin") {
    return null;
  }

  return (
    <AppShell sidebarContent={<AdminSidebar />}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sync-Warteschlange</h1>
          <Button size="sm" variant="flat" onPress={fetchSync} isLoading={loading}>
            Aktualisieren
          </Button>
        </div>

        <Input
          placeholder="Nach Benutzer, Quelle, Status oder Fehler suchen..."
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

        {counts && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Aktiv", counts.active, "warning"],
                ["Wartend", counts.waiting, "default"],
                ["Abgeschlossen", counts.completed, "success"],
                ["Fehlgeschlagen", counts.failed, "danger"],
              ] as const
            ).map(([label, count, color]) => (
              <Card key={label}>
                <CardBody className="text-center">
                  <p className="text-sm text-default-500">{label}</p>
                  <p className="text-2xl font-bold">
                    <Chip color={color} variant="flat" size="lg">
                      {count}
                    </Chip>
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardBody className="p-0">
            {loading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : (
              <Table aria-label="Sync jobs" removeWrapper>
                <TableHeader>
                  <TableColumn>Benutzer</TableColumn>
                  <TableColumn>Quelle</TableColumn>
                  <TableColumn>Status</TableColumn>
                  <TableColumn>Gestartet</TableColumn>
                  <TableColumn>Beendet</TableColumn>
                  <TableColumn>Fehler</TableColumn>
                  <TableColumn>Versuche</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Keine Sync-Jobs">
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>
                        <span className="text-xs">
                          {j.userEmail || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">
                            {j.sourceLabel || j.data?.sourceId?.slice(0, 8) || "—"}
                          </span>
                          {j.sourceProvider && (
                            <span className="text-xs text-default-400">
                              {j.sourceProvider}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={stateColors[j.state] || "default"}
                          variant="flat"
                        >
                          {j.state}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-xs text-default-500">
                        {formatTime(j.processedOn || j.timestamp)}
                      </TableCell>
                      <TableCell className="text-xs text-default-500">
                        {formatTime(j.finishedOn)}
                      </TableCell>
                      <TableCell>
                        {j.failedReason ? (
                          <button
                            className="max-w-[200px] cursor-pointer truncate text-left text-xs text-danger hover:underline"
                            onClick={() => {
                              setSelectedError({ job: j });
                              onOpen();
                            }}
                          >
                            {j.failedReason.slice(0, 60)}...
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{j.attemptsMade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
        {(() => {
          const totalPages = Math.ceil(total / 20);
          return totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-default-500">
              <span>
                {total} Jobs — Seite {page} von {totalPages}
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
          ) : null;
        })()}
      </div>

      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {selectedError && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <span>Fehlerdetails</span>
                <span className="text-sm font-normal text-default-500">
                  {selectedError.job.userEmail || "Unbekannter Benutzer"} — {selectedError.job.sourceLabel || selectedError.job.data?.sourceId || "Unbekannte Quelle"}
                </span>
              </ModalHeader>
              <ModalBody className="pb-6">
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-default-100 p-4 font-mono text-xs">
                  {selectedError.job.failedReason}
                </pre>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </AppShell>
  );
}
