import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { changePassword } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/lib/utils";

export const metadata = { title: "Password" };

export default function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Password searchParams={searchParams} />
    </Suspense>
  );
}

async function Password({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Password</h1>
        <p className="text-sm text-muted-foreground">
          {user.fullName}. The new password can be anything, of any length.
        </p>
      </div>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <Card className="p-4">
        <form action={changePassword} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Current password</span>
            <input className={fieldClass} name="current" type="password" autoComplete="current-password" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">New password</span>
            <input className={fieldClass} name="next" type="text" autoComplete="off" spellCheck={false} />
          </label>
          <Button type="submit">Save password</Button>
        </form>
      </Card>
    </div>
  );
}
