"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Spinner } from "@heroui/react";
import { apiAuthFetch } from "@/lib/api";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = searchParams.get("provider");
    const tokensParam = searchParams.get("tokens");

    if (!provider || !tokensParam) {
      setError("Missing provider or tokens in callback URL.");
      return;
    }

    let tokens: { accessToken: string; refreshToken: string | null; expiresAt: string | null };
    try {
      // base64url → base64 → decode
      const base64 = tokensParam.replace(/-/g, "+").replace(/_/g, "/");
      tokens = JSON.parse(atob(base64));
    } catch {
      setError("Invalid token data.");
      return;
    }

    const token = (session as unknown as { accessToken?: string })?.accessToken;
    if (!token) return; // Wait for session

    apiAuthFetch("/api/oauth/complete", token, {
      method: "POST",
      body: JSON.stringify({ provider, tokens }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to connect calendar.");
          return;
        }
        router.push("/settings?connected=true");
      })
      .catch(() => {
        setError("Network error. Please try again.");
      });
  }, [searchParams, session, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-600">Connection Failed</p>
          <p className="mt-2 text-default-500">{error}</p>
          <a href="/settings" className="mt-4 inline-block text-rose-700 underline">
            Back to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-default-500">Connecting your calendar...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
