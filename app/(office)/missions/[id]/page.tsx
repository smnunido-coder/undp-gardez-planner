import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { MissionForm } from "@/components/mission-form";
import { formatDate } from "@/lib/dates";
import { byLastName } from "@/lib/names";
import { getMission, latestBtorsByProject, listProjects, listStaff } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Mission" };

export default function EditMissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the mission…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [mission, staff, projects, latest] = await Promise.all([
    getMission(id),
    listStaff(),
    listProjects(),
    latestBtorsByProject(),
  ]);
  if (!mission) notFound();
  const projectById = new Map(projects.map((project) => [project.id, project.shortName]));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy">Edit mission</h1>
        <Link href={`/missions/${mission.id}/btor`} className="text-sm font-medium text-primary">
          {mission.btorDone ? "Open the back to office report" : "Write the back to office report"}
        </Link>
      </div>
      <Banner notice={one(query.notice)} error={one(query.error)} />
      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="font-semibold text-navy">Projects visited</h2>
        {mission.projectIds.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No projects are ticked on this mission yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {mission.projectIds.map((projectId) => {
              const report = latest[projectId];
              return (
                <li key={projectId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{projectById.get(projectId) ?? projectId}</span>
                  {report ? (
                    <Link href={`/missions/${report.missionId}/btor`} className="font-medium text-primary">
                      Latest BTOR · {formatDate(report.date)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No BTOR yet</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <MissionForm mission={mission} staff={byLastName(staff)} projects={projects} />
    </div>
  );
}
