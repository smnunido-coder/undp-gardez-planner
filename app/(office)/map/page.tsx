import { Suspense } from "react";
import { ProjectMap, type MapProject } from "@/components/project-map";
import { listFieldUpdates, listProjects } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Map" };

export default function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the map…</p>}>
      <Map searchParams={searchParams} />
    </Suspense>
  );
}

async function Map({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [projects, updates] = await Promise.all([listProjects(), listFieldUpdates()]);
  const mapped: MapProject[] = projects.map((project) => ({
    ...project,
    updates: updates[project.id] ?? [],
  }));
  const requested = one(params.project);
  const initialId = mapped.some((project) => project.id === requested) ? requested : "";

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Project map</h1>
        <p className="text-sm text-muted-foreground">
          {projects.length} projects across the South-East. A pin marks the province. Open one for the full description and the latest mission or weekly plan.
        </p>
      </div>
      <ProjectMap projects={mapped} initialId={initialId} />
    </div>
  );
}
