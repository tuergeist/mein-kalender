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
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardBody className="p-6 text-center">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-default-500">
              We sent a verification link to <strong>{email}</strong>.
              Please verify your email to continue.
            </p>
            <Link href="/auth/signin">
              <Button className="mt-4" color="primary">
                Go to Sign In
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
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-default-500">Sign up for Calendar Sync</p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Display Name"
              value={displayName}
              onValueChange={setDisplayName}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onValueChange={setEmail}
              isRequired
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onValueChange={setPassword}
              isRequired
              description="Minimum 8 characters"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading}>
              Create Account
            </Button>
          </form>

          <Divider className="my-4" />

          <div className="flex flex-col gap-2">
            <Button
              variant="bordered"
              onPress={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Sign up with Google
            </Button>
            <Button
              variant="bordered"
              onPress={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
            >
              Sign up with Microsoft
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-default-500">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-primary">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
