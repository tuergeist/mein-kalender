"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
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
import { apiAuthFetch } from "@/lib/api";

interface SyncJob {
  id: string;
  name: string;
  state: string;
  data: { sourceId?: string; userId?: string };
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const res = await apiAuthFetch("/api/admin/sync", token);
      if (!res.ok) {
        setError("Failed to load sync data");
        return;
      }
      const data = await res.json();
      setCounts(data.counts);
      setJobs(data.jobs);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      fetchSync();
    }
  }, [status, role, fetchSync]);

  if (status === "loading" || role !== "admin") {
    return null;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="light"
              size="sm"
              onPress={() => router.push("/admin")}
            >
              &larr; Users
            </Button>
            <h1 className="text-2xl font-bold">Admin: Sync Queue</h1>
          </div>
          <Button size="sm" variant="flat" onPress={fetchSync} isLoading={loading}>
            Refresh
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {counts && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Active", counts.active, "warning"],
                ["Waiting", counts.waiting, "default"],
                ["Completed", counts.completed, "success"],
                ["Failed", counts.failed, "danger"],
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
                  <TableColumn>Source ID</TableColumn>
                  <TableColumn>State</TableColumn>
                  <TableColumn>Started</TableColumn>
                  <TableColumn>Finished</TableColumn>
                  <TableColumn>Error</TableColumn>
                  <TableColumn>Attempts</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No sync jobs">
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {j.data?.sourceId?.slice(0, 8) || "—"}
                        </span>
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
                          <span className="text-xs text-danger">
                            {j.failedReason.slice(0, 80)}
                          </span>
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
      </div>
    </AppShell>
  );
}
