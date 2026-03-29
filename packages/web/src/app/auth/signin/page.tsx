"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Input, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import Link from "next/link";

export default function SignInPage() {
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
      setError("Invalid email or password");
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 px-6 pt-6">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-sm text-default-500">Sign in to your Calendar Sync account</p>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading}>
              Sign In
            </Button>
          </form>

          <Divider className="my-4" />

          <div className="flex flex-col gap-2">
            <Button
              variant="bordered"
              onPress={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              Continue with Google
            </Button>
            <Button
              variant="bordered"
              onPress={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
            >
              Continue with Microsoft
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-default-500">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-primary">
              Sign up
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
