"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardBody, CardHeader, Input, Button, Avatar } from "@heroui/react";
import { AppShell } from "@/components/AppShell";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [displayName, setDisplayName] = useState(session?.user?.name || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // TODO: Call API to update display name
    await update({ name: displayName });
    setSaving(false);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold">Profile</h1>

        <Card>
          <CardBody className="flex flex-col items-center gap-4 p-6">
            <Avatar
              src={session?.user?.image || undefined}
              name={session?.user?.name || session?.user?.email || "U"}
              size="lg"
            />

            <div className="w-full space-y-4">
              <Input
                label="Email"
                value={session?.user?.email || ""}
                isReadOnly
                variant="bordered"
              />
              <Input
                label="Display Name"
                value={displayName}
                onValueChange={setDisplayName}
                variant="bordered"
              />
              <Button
                color="primary"
                isLoading={saving}
                onPress={handleSave}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
