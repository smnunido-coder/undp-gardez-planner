import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOptionalUser } from "@/lib/auth";
import { ERRORS } from "@/lib/messages";
import { matchStaff } from "@/lib/names";
import { listStaff } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Sign in" };
export const instant = false;

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading sign-in…</p>}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await getOptionalUser();
  if (user) redirect("/");
  const params = await searchParams;
  const error = one(params.error);
  const choose = one(params.choose);
  const draft = one(params.name) || choose;
  const message = ERRORS[error];
  const matches = choose ? matchStaff(await listStaff(), choose) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-medium text-primary">UNDP South-East · Gardez</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy">Field planner</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Sign in with the last word of your name and your password. Sayed Samoon Ahmadi signs in as Ahmadi. Dad
        Mohammad Samoon signs in as Samoon.
      </p>
      <Card className="mt-6 p-4">
        {message ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {message}
          </p>
        ) : null}
        {matches.length > 1 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">More than one colleague uses that last name. Choose yours.</p>
            <form action="/api/login" method="post" className="space-y-3">
              <input type="hidden" name="lastName" value={choose} />
              {matches.map((person) => (
                <label key={person.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-3">
                  <input type="radio" name="staffId" value={person.id} required className="mt-1 size-4 accent-primary" />
                  <span>
                    <span className="block font-medium">{person.fullName}</span>
                    {person.role ? <span className="block text-sm text-muted-foreground">{person.role}</span> : null}
                  </span>
                </label>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="choose-password">Password</Label>
                <Input
                  id="choose-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Continue
              </Button>
            </form>
          </div>
        ) : (
          <form action="/api/login" method="post" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={draft}
                autoFocus
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder="Durani"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Continue
            </Button>
          </form>
        )}
      </Card>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        The starting password is the last name in lowercase, such as samoon or ahmadi. Samoon can change any of them. The phone remembers you for 60 days.
      </p>
    </main>
  );
}
