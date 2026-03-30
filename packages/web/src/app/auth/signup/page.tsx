"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4200"}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, displayName }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registrierung fehlgeschlagen");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardBody className="p-6 text-center">
            <h1 className="text-2xl font-bold">Prüfe deine E-Mails</h1>
            <p className="mt-2 text-default-500">
              Wir haben einen Bestätigungslink an <strong>{email}</strong> gesendet.
              Bitte bestätige deine E-Mail, um fortzufahren.
            </p>
            <Link href="/auth/signin">
              <Button className="mt-4" color="primary">
                Zur Anmeldung
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Konto erstellen</h1>
          <p className="text-sm text-default-500">Registriere dich bei Mein Kalender</p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Anzeigename"
              value={displayName}
              onValueChange={setDisplayName}
            />
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
              description="Mindestens 8 Zeichen"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading}>
              Konto erstellen
            </Button>
          </form>

          <Divider className="my-4" />

          <div className="flex flex-col gap-2">
            <Button
              variant="bordered"
              onPress={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Registrieren mit Google
            </Button>
            <Button
              variant="bordered"
              onPress={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
            >
              Registrieren mit Microsoft
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-default-500">
            Bereits ein Konto?{" "}
            <Link href="/auth/signin" className="text-primary">
              Anmelden
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
