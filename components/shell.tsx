import { workDaySentence } from "@/lib/dates";
import type { Staff } from "@/lib/types";
import { Nav } from "@/components/nav";

export function Shell({
  user,
  workDays,
  children,
}: {
  user: Staff;
  workDays: number[];
  children: React.ReactNode;
}) {
  const items = [
    { href: "/", label: "Dashboard" },
    { href: "/plan", label: "My week" },
    { href: "/projects", label: "Projects" },
    { href: "/missions", label: "Missions" },
    { href: "/workplans", label: "Workplans" },
  ];
  if (user.isAdmin) items.push({ href: "/admin", label: "Admin" });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-200">UNDP South-East</p>
            <p className="text-lg font-semibold leading-tight">Gardez field planner</p>
          </div>
          <div className="max-w-[12rem] text-right text-sm sm:max-w-xs">
            <p className="font-medium leading-5">{user.fullName}</p>
            {user.role ? <p className="text-xs text-sky-100/80">{user.role}</p> : null}
            <form action="/api/logout" method="post">
              <button type="submit" className="mt-1 text-sm text-sky-200 underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl">
          <Nav items={items} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4">{children}</main>
      <footer className="no-print mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted-foreground">
        UNDP South-East region, Gardez field office. Internal planner. {workDaySentence(workDays)}
      </footer>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-40 rounded bg-navy" />
      <p className="mt-6 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
