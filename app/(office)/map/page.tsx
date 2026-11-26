import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { ProjectMap, type MapProject } from "@/components/project-map";
import { getCurrentUser } from "@/lib/auth";
import { listFieldUpdates, listMapTags, listProjects } from "@/lib/queries";
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
  const user = await getCurrentUser();
  const [projects, updates, tags] = await Promise.all([listProjects(), listFieldUpdates(), listMapTags()]);
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
          OpenStreetMap of the South-East. Zoom into a district, open a project pin, or tag a village.
        </p>
      </div>
      <Banner notice={one(params.notice)} error={one(params.error)} />
      <ProjectMap projects={mapped} tags={tags} user={{ id: user.id, isAdmin: user.isAdmin }} initialId={initialId} />
    </div>
  );
}
