"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import Link from "next/link";

export default function SignInPage() {
  // Wer angemeldet ist, hat auf dieser Seite nichts verloren. Sie hat die
  // Sitzung bisher nicht angesehen und immer das Formular gezeigt — wer aus
  // einem Lesezeichen hier landete, hielt sich für abgemeldet, obwohl das
  // Cookie noch wochenlang gültig war.
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      // Aus window statt useSearchParams: Letzteres zwingt die Seite hinter
      // eine Suspense-Grenze und bricht das Vorab-Rendern. Hier läuft ohnehin
      // schon Browser-Code.
      const target = new URLSearchParams(window.location.search).get("callbackUrl") || "/dashboard";
      // replace, nicht push: Der Zurück-Knopf soll nicht auf die Anmeldeseite
      // zurückführen, von der gerade weitergeleitet wurde.
      router.replace(target);
    }
  }, [status, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Ungültige E-Mail oder Passwort");
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  // Solange die Sitzung geprüft wird oder bereits gültig ist, kein Formular:
  // Sonst blitzt eine Anmeldemaske auf, bevor weitergeleitet wird.
  if (status === "loading" || status === "authenticated") {
    return <div className="flex min-h-screen items-center justify-center p-4" aria-busy="true" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Anmelden</h1>
          <p className="text-sm text-default-500">Melde dich bei deinem Mein Kalender Konto an</p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="E-Mail"
              type="email"
              value={email}
              onValueChange={setEmail}
              isRequired
            />
            <Input
              label="Passwort"
              type="password"
              value={password}
              onValueChange={setPassword}
              isRequired
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading}>
              Anmelden
            </Button>
          </form>

          <Divider className="my-4" />

          <div className="flex flex-col gap-2">
            <Button
              variant="bordered"
              onPress={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Weiter mit Google
            </Button>
            <Button
              variant="bordered"
              onPress={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
            >
              Weiter mit Microsoft
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-default-500">
            Noch kein Konto?{" "}
            <Link href="/auth/signup" className="text-primary">
              Registrieren
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
