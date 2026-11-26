import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { MissionForm } from "@/components/mission-form";
import { byLastName } from "@/lib/names";
import { getMission, listProjects, listStaff } from "@/lib/queries";
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
  const [mission, staff, projects] = await Promise.all([getMission(id), listStaff(), listProjects()]);
  if (!mission) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy">Edit mission</h1>
        <Link href={`/missions/${mission.id}/btor`} className="text-sm font-medium text-primary">
          {mission.btorDone ? "Open the back to office report" : "Write the back to office report"}
        </Link>
      </div>
      <Banner notice={one(query.notice)} error={one(query.error)} />
      <MissionForm mission={mission} staff={byLastName(staff)} projects={projects} />
    </div>
  );
}
