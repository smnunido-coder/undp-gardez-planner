import Link from "next/link";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { statusClass } from "@/lib/labels";
import { latestBtorsByProject, listMissions, listProjects, listStaff } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Missions" };

export default function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading missions…</p>}>
      <Missions searchParams={searchParams} />
    </Suspense>
  );
}

async function Missions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [missions, staff, projects, latest] = await Promise.all([
    listMissions(),
    listStaff(),
    listProjects(),
    latestBtorsByProject(),
  ]);
  const staffById = new Map(staff.map((person) => [person.id, person.fullName]));
  const projectById = new Map(projects.map((project) => [project.id, project.shortName]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Missions</h1>
          <p className="text-sm text-muted-foreground">Field travel, meetings, and whether the BTOR is done.</p>
        </div>
        <Button asChild>
          <Link href="/missions/new">Add mission</Link>
        </Button>
      </div>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      {missions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No missions yet.</p>
      ) : (
        <div className="space-y-3">
          {missions.map((mission) => (
            <Card key={mission.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(mission.startDate)}
                    {mission.endDate !== mission.startDate ? ` – ${formatDate(mission.endDate)}` : ""}
                  </p>
                  <Link href={`/missions/${mission.id}`} className="font-semibold text-navy hover:underline">
                    {mission.title}
                  </Link>
                </div>
                <Badge className={statusClass(mission.status)}>{mission.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {[mission.provinces.join(", "), mission.location].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-sm">
                {mission.staffIds.map((id) => staffById.get(id) ?? id).join(", ") || "No travellers listed"}
              </p>
              {mission.projectIds.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {mission.projectIds.map((id) => {
                    const report = latest[id];
                    return (
                      <li key={id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{projectById.get(id) ?? id}</span>
                        {report ? (
                          <Link href={`/missions/${report.missionId}/btor`} className="font-medium text-primary">
                            Latest BTOR · {formatDate(report.date)}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">No BTOR yet</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="mt-2 text-xs font-medium">
                {mission.btorDone ? "BTOR done" : "BTOR not done"}
                {" · "}
                <Link href={`/missions/${mission.id}/btor`} className="text-primary">
                  {mission.btorDone ? "Open the report" : "Write the report"}
                </Link>
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
