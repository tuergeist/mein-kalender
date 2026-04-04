"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button, Card, CardBody } from "@heroui/react";
import { AppShell } from "@/components/AppShell";
import { apiAuthFetch } from "@/lib/api";

interface BillingInfo {
  plan: "monthly" | "yearly" | null;
  status: "active" | "pending" | "cancelled" | null;
  trialEndsAt: string | null;
  isActive: boolean;
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("status") === "success";

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [successBanner, setSuccessBanner] = useState(justPaid);

  useEffect(() => {
    if (!accessToken) return;
    apiAuthFetch("/api/billing", accessToken)
      .then((r) => {
        if (r.status === 404) {
          // Backend not deployed yet — treat as no subscription
          setBilling({ plan: null, status: null, trialEndsAt: null, isActive: false });
          return null;
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data) setBilling(data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function handleCheckout(plan: "monthly" | "yearly") {
    if (!accessToken) return;
    setCheckoutLoading(plan);
    try {
      const res = await apiAuthFetch("/api/checkout", accessToken, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.checkoutUrl;
      }
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    if (!accessToken) return;
    setCancelling(true);
    try {
      const res = await apiAuthFetch("/api/billing/cancel", accessToken, { method: "POST" });
      if (res.ok) {
        setBilling((prev) => prev ? { ...prev, status: "cancelled" } : prev);
        setShowCancelConfirm(false);
      }
    } finally {
      setCancelling(false);
    }
  }

  const trialDaysLeft = billing?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  const isTrialActive = trialDaysLeft !== null && trialDaysLeft > 0 && !billing?.plan;
  const hasActiveSub = billing?.plan && billing.status === "active";

  return (
    <AppShell section="settings" settingsSection="billing">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-display text-[28px] font-bold leading-[1.2] tracking-[-0.03em]">
          Abrechnung
        </h1>

        {/* Success banner after checkout */}
        {successBanner && (
          <div
            className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4"
            style={{ animation: "fadeInUp 0.4s ease-out both" }}
          >
            <div>
              <p className="font-display text-base font-semibold text-emerald-800">
                Zahlung erfolgreich
              </p>
              <p className="mt-0.5 text-sm text-emerald-600">
                Dein Abonnement ist jetzt aktiv.
              </p>
            </div>
            <button
              onClick={() => setSuccessBanner(false)}
              className="text-emerald-400 hover:text-emerald-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-xl bg-stone-100" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-56 animate-pulse rounded-xl bg-stone-100" />
              <div className="h-56 animate-pulse rounded-xl bg-stone-100" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <Card>
            <CardBody className="p-6 text-center">
              <p className="text-sm text-stone-500">
                Abrechnungsdaten konnten nicht geladen werden. Bitte versuche es später erneut.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Active subscription */}
        {!loading && !error && hasActiveSub && (
          <Card>
            <CardBody className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold">
                      {billing.plan === "monthly" ? "Monatlich" : "Jährlich"}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Aktiv
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {billing.plan === "monthly" ? "19 EUR / Monat" : "190 EUR / Jahr"}
                  </p>
                </div>
                <p className="font-display text-2xl font-bold text-stone-900">
                  {billing.plan === "monthly" ? "19 EUR" : "190 EUR"}
                </p>
              </div>

              <div className="mt-6 border-t border-stone-100 pt-4">
                {!showCancelConfirm ? (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-sm text-stone-400 hover:text-red-600 transition-colors"
                  >
                    Abonnement kündigen
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-stone-600">Wirklich kündigen?</p>
                    <Button
                      color="danger"
                      size="sm"
                      isLoading={cancelling}
                      onPress={handleCancel}
                    >
                      Ja, kündigen
                    </Button>
                    <Button
                      variant="flat"
                      size="sm"
                      onPress={() => setShowCancelConfirm(false)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Cancelled subscription */}
        {!loading && !error && billing?.status === "cancelled" && (
          <Card>
            <CardBody className="p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-semibold">Abonnement gekündigt</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                  Gekündigt
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Dein Abonnement wurde gekündigt. Du kannst jederzeit ein neues Abonnement starten.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Trial active */}
        {!loading && !error && isTrialActive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-amber-800">
                  Testphase aktiv
                </h2>
                <p className="mt-0.5 text-sm text-amber-600">
                  Noch {trialDaysLeft} {trialDaysLeft === 1 ? "Tag" : "Tage"} verbleibend.
                  Wähle unten einen Plan, um nahtlos weiterzumachen.
                </p>
              </div>
              <span className="font-mono text-xs font-medium text-amber-500">
                {trialDaysLeft}d
              </span>
            </div>
          </div>
        )}

        {/* Pricing cards — show when no active subscription */}
        {!loading && !error && !hasActiveSub && (
          <>
            <div>
              <h2 className="font-display text-lg font-semibold">Plan wählen</h2>
              <p className="mt-1 text-sm text-stone-500">
                Alle Funktionen. Keine versteckten Kosten.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Monthly */}
              <Card className="border border-stone-200">
                <CardBody className="flex flex-col p-6">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
                    Monatlich
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold tracking-tight">19 EUR</span>
                    <span className="text-sm text-stone-400">/ Monat</span>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm text-stone-600">
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Alle Kalender synchronisieren
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Buchungsseiten
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Konflikterkennung
                    </li>
                  </ul>
                  <div className="mt-auto pt-6">
                    <Button
                      color="primary"
                      className="w-full"
                      isLoading={checkoutLoading === "monthly"}
                      isDisabled={checkoutLoading !== null}
                      onPress={() => handleCheckout("monthly")}
                    >
                      Jetzt starten
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Yearly */}
              <Card className="border-2 border-rose-200 relative">
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full bg-rose-700 px-3 py-1 text-xs font-medium text-white shadow-sm">
                    Spare 17%
                  </span>
                </div>
                <CardBody className="flex flex-col p-6">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
                    Jährlich
                  </p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold tracking-tight">190 EUR</span>
                    <span className="text-sm text-stone-400">/ Jahr</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">
                    entspricht ~15,83 EUR / Monat
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-stone-600">
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Alle Kalender synchronisieren
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Buchungsseiten
                    </li>
                    <li className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Konflikterkennung
                    </li>
                  </ul>
                  <div className="mt-auto pt-6">
                    <Button
                      color="primary"
                      className="w-full"
                      isLoading={checkoutLoading === "yearly"}
                      isDisabled={checkoutLoading !== null}
                      onPress={() => handleCheckout("yearly")}
                    >
                      Jetzt starten
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
