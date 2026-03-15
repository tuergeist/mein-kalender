"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardBody, CardHeader, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  notes: string | null;
  startTime: string;
  endTime: string;
  status: string;
  eventType: { name: string; durationMinutes: number };
}

export default function BookingsPage() {
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  useEffect(() => {
    if (accessToken) loadBookings();
  }, [accessToken]);

  async function loadBookings() {
    if (!accessToken) return;
    const res = await apiAuthFetch("/api/bookings", accessToken);
    if (res.ok) setBookings(await res.json());
  }

  async function handleCancel() {
    if (!accessToken || !cancelId) return;
    setCancelling(true);
    await apiAuthFetch(`/api/bookings/${cancelId}`, accessToken, { method: "DELETE" });
    setCancelId(null);
    setCancelling(false);
    loadBookings();
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.startTime) > now);
  const past = bookings.filter((b) => b.status !== "confirmed" || new Date(b.startTime) <= now);

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Bookings</h1>

        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Upcoming</h2></CardHeader>
          <CardBody>
            {upcoming.length === 0 ? (
              <p className="text-default-400">No upcoming bookings.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.guestName}</span>
                        <Chip size="sm" variant="flat">{b.eventType.name}</Chip>
                      </div>
                      <p className="text-sm text-default-400">
                        {formatDateTime(b.startTime)} &bull; {b.guestEmail}
                      </p>
                      {b.notes && <p className="mt-1 text-xs text-default-400">{b.notes}</p>}
                    </div>
                    <Button size="sm" color="danger" variant="light" onPress={() => setCancelId(b.id)}>
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {past.length > 0 && (
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Past / Cancelled</h2></CardHeader>
            <CardBody>
              <div className="space-y-3">
                {past.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-default-200 p-4 opacity-60">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{b.guestName}</span>
                        <Chip size="sm" variant="flat">{b.eventType.name}</Chip>
                        {b.status === "cancelled" && <Chip size="sm" color="danger" variant="flat">Cancelled</Chip>}
                      </div>
                      <p className="text-sm text-default-400">{formatDateTime(b.startTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Modal isOpen={!!cancelId} onClose={() => setCancelId(null)}>
          <ModalContent>
            <ModalHeader>Cancel Booking</ModalHeader>
            <ModalBody>
              <p>Are you sure you want to cancel this booking? The calendar event will be deleted.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={() => setCancelId(null)}>Keep</Button>
              <Button color="danger" isLoading={cancelling} onPress={handleCancel}>Cancel Booking</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </AppShell>
  );
}
