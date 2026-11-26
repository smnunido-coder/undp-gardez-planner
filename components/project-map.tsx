"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OsmMap, type MapPin } from "@/components/osm-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteMapTagAction, saveMapTagAction } from "@/lib/actions";
import { PROVINCE_SHAPES } from "@/lib/geo/southeast";
import { progressPercent, statusClass, statusColor } from "@/lib/labels";
import type { FieldUpdate, MapTag, Project } from "@/lib/types";

export type MapProject = Project & { updates: FieldUpdate[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return iso;
  return `${Number(day)} ${monthName} ${year}`;
}

function centroid(ring: [number, number][]): [number, number] {
  const body = ring.slice(0, -1);
  const lon = body.reduce((sum, point) => sum + point[0], 0) / body.length;
  const lat = body.reduce((sum, point) => sum + point[1], 0) / body.length;
  return [lon, lat];
}

const CENTROIDS = new Map(PROVINCE_SHAPES.map((shape) => [shape.name, centroid(shape.ring)]));

function dateLabel(update: FieldUpdate): string {
  if (update.endDate && update.endDate !== update.date) {
    return `${formatDate(update.date)} – ${formatDate(update.endDate)}`;
  }
  return formatDate(update.date);
}

export function ProjectMap({
  projects,
  tags,
  user,
  initialId,
}: {
  projects: MapProject[];
  tags: MapTag[];
  user: { id: string; isAdmin: boolean };
  initialId?: string;
}) {
  const [programme, setProgramme] = useState("");
  const [province, setProvince] = useState("");
  const [selectedId, setSelectedId] = useState(initialId ?? "");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [tagging, setTagging] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);

  const programmes = useMemo(
    () => [...new Set(projects.map((project) => project.programme))],
    [projects],
  );
  const visible = useMemo(
    () =>
      projects.filter((project) => {
        if (programme && project.programme !== programme) return false;
        if (province && !project.provinces.includes(province)) return false;
        return true;
      }),
    [projects, programme, province],
  );
  const selected = visible.find((project) => project.id === selectedId) ?? null;
  const selectedTag = tags.find((tag) => tag.id === selectedTagId) ?? null;

  const pins = useMemo(() => {
    const byProvince = new Map<string, MapProject[]>();
    for (const project of visible) {
      const name = project.provinces.find((provinceName) => CENTROIDS.has(provinceName));
      if (!name) continue;
      const list = byProvince.get(name) ?? [];
      list.push(project);
      byProvince.set(name, list);
    }
    const placed: MapPin[] = [];
    for (const [name, items] of byProvince) {
      const center = CENTROIDS.get(name);
      if (!center) continue;
      items.forEach((project, index) => {
        const radius = items.length === 1 ? 0 : 0.06;
        const angle = (index / items.length) * Math.PI * 2;
        placed.push({
          id: project.id,
          lat: center[1] + Math.sin(angle) * radius,
          lng: center[0] + Math.cos(angle) * radius,
          title: project.shortName,
          detail: name,
          color: statusColor(project.status),
          kind: "project",
        });
      });
    }
    for (const tag of tags) {
      const linked = projects.find((project) => project.id === tag.projectId);
      if (programme && linked?.programme !== programme) continue;
      if (province && linked && !linked.provinces.includes(province)) continue;
      placed.push({
        id: tag.id,
        lat: tag.lat,
        lng: tag.lng,
        title: tag.name,
        detail: linked?.shortName ?? "Tagged place",
        color: "#b45309",
        kind: "tag",
      });
    }
    return placed;
  }, [visible, tags, projects, programme, province]);

  const focus = useMemo(() => {
    const name = province || selected?.provinces.find((item) => CENTROIDS.has(item));
    const center = name ? CENTROIDS.get(name) : undefined;
    if (!center) return null;
    return { lng: center[0], lat: center[1], zoom: province ? 9 : 8 };
  }, [province, selected]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          id="map-programme"
          name="programme"
          className="h-11 rounded-md border border-input bg-white px-3 text-sm"
          value={programme}
          aria-label="Programme"
          onChange={(event) => setProgramme(event.target.value)}
        >
          <option value="">All programmes</option>
          {programmes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          id="map-province"
          name="province"
          className="h-11 rounded-md border border-input bg-white px-3 text-sm"
          value={province}
          aria-label="Province"
          onChange={(event) => setProvince(event.target.value)}
        >
          <option value="">All provinces</option>
          {PROVINCE_SHAPES.map((shape) => (
            <option key={shape.name}>{shape.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={tagging ? "default" : "outline"}
          onClick={() => {
            setTagging((current) => !current);
            setDraft(null);
            setSelectedId("");
            setSelectedTagId("");
          }}
        >
          {tagging ? "Stop tagging" : "Tag a place"}
        </Button>
        {tagging ? <p className="text-sm text-muted-foreground">Tap the map on the village or site.</p> : null}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-[#e7f0f8]">
          <div className="relative z-0 h-[70vh] min-h-[28rem]">
            <OsmMap
              pins={pins}
              focus={focus}
              tagging={tagging}
              onProject={(id) => {
                setSelectedTagId("");
                setDraft(null);
                setSelectedId(id);
              }}
              onTag={(id) => {
                setSelectedId("");
                setDraft(null);
                setSelectedTagId(id);
              }}
              onPlace={(lat, lng) => setDraft({ lat, lng })}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border bg-white/90 px-3 py-2 text-xs text-muted-foreground">
            <Legend color="#0468b1" label="Ongoing" />
            <Legend color="#5b8eb8" label="Planned" />
            <Legend color="#8aa0b3" label="Procurement" />
            <Legend color="#b45309" label="Tagged place" />
          </div>
          {selected ? <ProjectOverlay project={selected} onClose={() => setSelectedId("")} /> : null}
          {selectedTag ? (
            <TagOverlay
              tag={selectedTag}
              projectName={projects.find((project) => project.id === selectedTag.projectId)?.shortName ?? ""}
              canDelete={user.isAdmin || selectedTag.createdBy === user.id}
              onClose={() => setSelectedTagId("")}
            />
          ) : null}
          {draft ? (
            <form action={saveMapTagAction} className="absolute inset-x-2 bottom-12 z-[800] space-y-2 rounded-lg border border-border bg-white p-3 shadow-lg sm:inset-x-auto sm:right-3 sm:w-80">
              <input type="hidden" name="lat" value={draft.lat} />
              <input type="hidden" name="lng" value={draft.lng} />
              <p className="text-sm font-medium text-navy">Tag this place</p>
              <input className={fieldClass} name="name" required maxLength={120} placeholder="Place name, e.g. Yousuf Khail" aria-label="Place name" />
              <select className={fieldClass} name="projectId" defaultValue="" aria-label="Project">
                <option value="">No project</option>
                {projects.filter((project) => project.active).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.shortName}
                  </option>
                ))}
              </select>
              <Textarea name="note" maxLength={1000} placeholder="What is here" aria-label="Note" />
              <div className="flex gap-2">
                <Button type="submit">Save tag</Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        <ul className="max-h-[36rem] space-y-1 overflow-y-auto rounded-lg border border-border bg-white p-1">
          {visible.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">No projects match.</li>
          ) : (
            visible.map((project) => {
              const latest = project.updates[0];
              const on = selected?.id === project.id;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(project.id)}
                    className={`w-full rounded-md px-3 py-2 text-left ${on ? "bg-accent" : "hover:bg-muted"}`}
                  >
                    <span className="block text-sm font-medium text-navy">{project.shortName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {project.provinces.join(", ")}
                      {latest ? ` · ${formatDate(latest.date)}` : " · No update yet"}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

function TagOverlay({
  tag,
  projectName,
  canDelete,
  onClose,
}: {
  tag: MapTag;
  projectName: string;
  canDelete: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="absolute inset-x-2 bottom-12 z-[800] max-h-[60%] overflow-y-auto rounded-lg border border-border bg-white p-4 shadow-lg sm:inset-x-auto sm:right-3 sm:w-80">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-navy">{tag.name}</h2>
        <button type="button" onClick={onClose} className="text-sm font-medium text-primary">
          Close
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{projectName || "No project linked"}</p>
      {tag.note ? <p className="mt-2 text-sm leading-5">{tag.note}</p> : null}
      {tag.createdByName ? <p className="mt-2 text-xs text-muted-foreground">Tagged by {tag.createdByName}</p> : null}
      {canDelete ? (
        <form action={deleteMapTagAction} className="mt-3">
          <input type="hidden" name="id" value={tag.id} />
          <Button type="submit" variant="destructive" size="sm">
            Remove tag
          </Button>
        </form>
      ) : null}
    </aside>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ProjectOverlay({ project, onClose }: { project: MapProject; onClose: () => void }) {
  const percent = progressPercent(project.progress);
  const dates = project.windowText || [project.startDate, project.endDate].filter(Boolean).map((date) => formatDate(date!)).join(" – ");
  return (
    <aside className="absolute inset-x-2 bottom-12 z-[800] flex h-[68%] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-lg sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-14 sm:h-auto sm:w-80">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-semibold text-navy">{project.shortName}</h2>
        <button type="button" onClick={onClose} className="shrink-0 text-sm font-medium text-primary">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <Badge className={statusClass(project.status)}>{project.status}</Badge>
      <p className="mt-3 text-sm leading-5">{project.name}</p>
      <dl className="mt-3 space-y-1 text-sm">
        <Row label="Programme" value={project.programme} />
        <Row label="Partner" value={project.partner} />
        <Row label="Provinces" value={project.provinces.join(", ")} />
        <Row label="Dates" value={dates || "Not set"} />
        {project.budget ? <Row label="Budget" value={project.budget} /> : null}
        {project.ref ? <Row label="Reference" value={project.ref} /> : null}
      </dl>
      {percent != null ? (
        <div className="mt-3">
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{project.progress} complete</p>
        </div>
      ) : project.progress ? (
        <p className="mt-3 text-xs text-muted-foreground">{project.progress}</p>
      ) : null}
      <h3 className="mt-4 text-sm font-semibold text-navy">Latest updates</h3>
      {project.updates.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No mission or weekly plan has been filed for this project yet.</p>
      ) : (
        <ol className="mt-2 space-y-3">
          {project.updates.map((update) => (
            <li key={`${update.kind}-${update.href}-${update.date}`} className="border-t border-border pt-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {update.kind === "mission" ? "Mission" : "Weekly plan"} · {dateLabel(update)}
              </p>
              <p className="mt-0.5 font-medium">{update.title}</p>
              {update.place ? <p className="text-muted-foreground">{update.place}</p> : null}
              {update.who ? <p className="text-muted-foreground">{update.who}</p> : null}
              {update.detail ? <p className="mt-1 leading-5">{update.detail}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {update.status}
                {update.kind === "mission" ? ` · ${update.btorDone ? "BTOR on file" : "BTOR not filed"}` : ""}
              </p>
              <Link href={update.href} className="mt-1 inline-block text-sm font-medium text-primary">
                {update.kind === "mission" ? "Open the mission" : "Open that week"}
              </Link>
            </li>
          ))}
        </ol>
      )}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
