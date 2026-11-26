import Link from "next/link";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { ProjectChecks } from "@/components/project-checks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveDay } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { connection } from "next/server";
import { addDays, canEditWeek, formatDayShort, formatWeekRange, kabulToday, weekDates, weekStartFor } from "@/lib/dates";
import { ACTIVITIES, PROVINCES, activityLabel } from "@/lib/labels";
import { byLastName } from "@/lib/names";
import { getWorkDays, listProjects, listStaff, plansBetween } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "My week" };

export default function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the week…</p>}>
      <PlanForm searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanForm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await connection();
  const user = await getCurrentUser();
  const workDays = await getWorkDays();
  const today = kabulToday(new Date());
  const weekStart = weekStartFor(one(params.week) || today, workDays);
  const dates = weekDates(weekStart, workDays);
  const staff = byLastName(await listStaff());
  const viewed = staff.find((person) => person.id === one(params.staff)) ?? user;
  const own = viewed.id === user.id;
  const canFile = (own || user.isAdmin) && canEditWeek(dates, today, user.isAdmin);
  const [projects, plans] = await Promise.all([
    listProjects(),
    plansBetween(dates[0] ?? weekStart, dates[dates.length - 1] ?? weekStart),
  ]);
  const active = projects.filter((project) => project.active);
  const byDay = new Map(plans.filter((day) => day.staffId === viewed.id).map((day) => [day.day, day]));
  const picker = [...active];
  for (const day of byDay.values()) {
    for (const project of day.projects) {
      if (!picker.some((item) => item.id === project.id)) {
        const full = projects.find((item) => item.id === project.id);
        if (full) picker.push(full);
      }
    }
  }
  const staffQuery = own ? "" : `&staff=${viewed.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{own ? "My week" : viewed.fullName}</h1>
          <p className="text-sm text-muted-foreground">{formatWeekRange(dates)}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/plan?week=${addDays(weekStart, -7)}${staffQuery}`}>Previous</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/plan${own ? "" : `?staff=${viewed.id}`}`}>This week</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/plan?week=${addDays(weekStart, 7)}${staffQuery}`}>Next</Link>
          </Button>
        </div>
      </div>
      {user.isAdmin ? (
        <form method="get" action="/plan" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="week" value={weekStart} />
          <label className="text-sm">
            <span className="mb-1 block font-medium">Filing for</span>
            <select className={fieldClass} name="staff" defaultValue={viewed.id} aria-label="Staff member">
              {staff.filter((person) => person.active || person.id === viewed.id).map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline">
            Open
          </Button>
        </form>
      ) : null}
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <p className="text-sm leading-6 text-muted-foreground">
        Tick every project for that day, then save the day. A dropped connection keeps the other days.
      </p>
      {!own && canFile ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">You are filing {viewed.fullName}&apos;s week.</p>
      ) : null}
      {!own && !canFile ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">You are reading {viewed.fullName}&apos;s week.</p>
      ) : null}
      {!canFile && own ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          This week is closed. The current week and later weeks can still be edited.
        </p>
      ) : null}
      {dates.map((day) => {
        const entry = byDay.get(day);
        const selected = new Set(entry?.projects.map((project) => project.id) ?? []);
        const summary = [
          selected.size ? `${selected.size} project${selected.size === 1 ? "" : "s"}` : "No projects",
          entry?.activity ? activityLabel(entry.activity) : "",
          entry?.province ?? "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <form key={day} action={saveDay}>
            <input type="hidden" name="weekStart" value={weekStart} />
            <input type="hidden" name="staffId" value={viewed.id} />
            <input type="hidden" name="day" value={day} />
            <Card className="overflow-hidden">
              <details open={day === today || selected.size > 0 || Boolean(entry?.note)}>
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="font-semibold text-navy">{formatDayShort(day)}</span>
                    {day === today ? <span className="ml-2 text-xs font-medium text-primary">Today</span> : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{summary}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{canFile ? "Edit" : "Closed"}</span>
                </summary>
                <fieldset disabled={!canFile} className="space-y-4 border-t border-border px-4 py-4">
                  <ProjectChecks projects={picker} selected={selected} valueFor={(project) => `${day}|${project.id}`} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Activity</span>
                      <select className={fieldClass} name="activity" defaultValue={entry?.activity ?? ""}>
                        <option value="">Not set</option>
                        {ACTIVITIES.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Province</span>
                      <select className={fieldClass} name="province" defaultValue={entry?.province ?? ""}>
                        <option value="">Not set</option>
                        {PROVINCES.map((province) => (
                          <option key={province}>{province}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium">District / location</span>
                      <input className={fieldClass} name="location" defaultValue={entry?.location ?? ""} maxLength={200} placeholder="e.g. Yousuf Khail" />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="mb-1 block font-medium">Note</span>
                      <Textarea name="note" defaultValue={entry?.note ?? ""} maxLength={1000} />
                    </label>
                  </div>
                  {canFile ? (
                    <Button type="submit" size="lg" className="w-full sm:w-auto">
                      Save {formatDayShort(day)}
                    </Button>
                  ) : null}
                </fieldset>
              </details>
            </Card>
          </form>
        );
      })}
    </div>
  );
}
