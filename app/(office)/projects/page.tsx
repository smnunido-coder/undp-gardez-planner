import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { progressPercent, statusClass } from "@/lib/labels";
import { latestBtorsByProject, listProjects } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Projects" };

export default function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading projects…</p>}>
      <Projects searchParams={searchParams} />
    </Suspense>
  );
}

async function Projects({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q).toLowerCase();
  const programme = one(params.programme);
  const status = one(params.status);
  const province = one(params.province);
  const [projects, latest] = await Promise.all([listProjects(), latestBtorsByProject()]);
  const filtered = projects.filter((project) => {
    if (programme && project.programme !== programme) return false;
    if (status && project.status !== status) return false;
    if (province && !project.provinces.includes(province)) return false;
    if (q) {
      const haystack = `${project.name} ${project.shortName} ${project.partner} ${project.ref}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const programmes = [...new Set(projects.map((project) => project.programme))];
  const statuses = [...new Set(projects.map((project) => project.status))];
  const provinces = [...new Set(projects.flatMap((project) => project.provinces))].sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Projects</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {projects.length} in the South-East portfolio.{" "}
          <Link href="/map" className="font-medium text-primary underline-offset-2 hover:underline">
            Open the map
          </Link>
        </p>
      </div>
      <Card className="p-3">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className={fieldClass} name="q" defaultValue={one(params.q)} placeholder="Search" aria-label="Search projects" />
          <select className={fieldClass} name="programme" defaultValue={programme} aria-label="Programme">
            <option value="">All programmes</option>
            {programmes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select className={fieldClass} name="status" defaultValue={status} aria-label="Status">
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select className={fieldClass} name="province" defaultValue={province} aria-label="Province">
            <option value="">All provinces</option>
            {provinces.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects match.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((project) => {
            const percent = progressPercent(project.progress);
            const dates = [project.startDate, project.endDate].filter(Boolean).map((date) => formatDate(date!)).join(" – ");
            return (
              <Card key={project.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-navy">{project.shortName}</h2>
                  <Badge className={statusClass(project.status)}>{project.status}</Badge>
                </div>
                <p className="mt-1 text-sm leading-5">{project.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {project.programme} · {project.partner}
                </p>
                <p className="text-sm text-muted-foreground">{project.provinces.join(", ")}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {project.windowText || dates || "Dates not set"}
                  {project.budget ? ` · ${project.budget}` : ""}
                  {project.ref ? ` · ${project.ref}` : ""}
                </p>
                {latest[project.id] ? (
                  <p className="mt-2 text-sm">
                    <Link href={`/missions/${latest[project.id]!.missionId}/btor`} className="font-medium text-primary">
                      Latest BTOR · {formatDate(latest[project.id]!.date)}
                    </Link>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No BTOR yet</p>
                )}
                {percent != null ? (
                  <div className="mt-3">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{project.progress}</p>
                  </div>
                ) : project.progress ? (
                  <p className="mt-2 text-xs text-muted-foreground">{project.progress}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
