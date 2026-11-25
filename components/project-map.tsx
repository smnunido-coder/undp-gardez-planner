"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { COUNTRY, PROVINCE_SHAPES } from "@/lib/geo/southeast";
import { progressPercent, statusClass, statusColor } from "@/lib/labels";
import type { FieldUpdate, Project } from "@/lib/types";

export type MapProject = Project & { updates: FieldUpdate[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return iso;
  return `${Number(day)} ${monthName} ${year}`;
}

const WIDTH = 640;

function bounds() {
  const points = PROVINCE_SHAPES.flatMap((shape) => shape.ring);
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  const pad = 0.55;
  return {
    minLon: Math.min(...lons) - pad,
    maxLon: Math.max(...lons) + pad,
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
  };
}

const FRAME = bounds();
const X_SCALE = Math.cos((((FRAME.minLat + FRAME.maxLat) / 2) * Math.PI) / 180);
const LON_SPAN = (FRAME.maxLon - FRAME.minLon) * X_SCALE;
const LAT_SPAN = FRAME.maxLat - FRAME.minLat;
const HEIGHT = Math.round(WIDTH * (LAT_SPAN / LON_SPAN));

function xy(lon: number, lat: number): [number, number] {
  return [
    ((lon - FRAME.minLon) * X_SCALE / LON_SPAN) * WIDTH,
    ((FRAME.maxLat - lat) / LAT_SPAN) * HEIGHT,
  ];
}

function pathOf(ring: [number, number][]): string {
  return `${ring.map((point, index) => `${index === 0 ? "M" : "L"}${xy(point[0], point[1]).join(" ")}`).join("")}Z`;
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
  initialId,
}: {
  projects: MapProject[];
  initialId?: string;
}) {
  const [programme, setProgramme] = useState("");
  const [province, setProvince] = useState("");
  const [selectedId, setSelectedId] = useState(initialId ?? "");

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

  const pins = useMemo(() => {
    const byProvince = new Map<string, MapProject[]>();
    for (const project of visible) {
      for (const name of project.provinces) {
        if (!CENTROIDS.has(name)) continue;
        const list = byProvince.get(name) ?? [];
        list.push(project);
        byProvince.set(name, list);
      }
    }
    const placed: { key: string; project: MapProject; province: string; x: number; y: number }[] = [];
    for (const [name, items] of byProvince) {
      const center = CENTROIDS.get(name);
      if (!center) continue;
      const [cx, cy] = xy(center[0], center[1]);
      items.forEach((project, index) => {
        const radius = items.length === 1 ? 0 : 16 + Math.floor(index / 8) * 14;
        const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
        placed.push({
          key: `${project.id}:${name}`,
          project,
          province: name,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      });
    }
    return placed;
  }, [visible]);

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

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-[#e7f0f8]">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full touch-manipulation"
            role="img"
            aria-label="Map of UNDP South-East projects by province"
          >
            <path d={pathOf(COUNTRY)} fill="#d5e2ee" stroke="#b7c9d8" strokeWidth="1.5" />
            {PROVINCE_SHAPES.map((shape) => {
              const active = province === shape.name;
              return (
                <path
                  key={shape.name}
                  d={pathOf(shape.ring)}
                  fill={active ? "#c5e2f6" : "#f7fbfe"}
                  stroke={active ? "#0468b1" : "#7f9bb0"}
                  strokeWidth={active ? 2.5 : 1.25}
                  className="cursor-pointer"
                  onClick={() => setProvince((current) => (current === shape.name ? "" : shape.name))}
                >
                  <title>{shape.name}</title>
                </path>
              );
            })}
            {pins.map((pin) => {
              const on = selected?.id === pin.project.id;
              return (
                <g
                  key={pin.key}
                  transform={`translate(${pin.x} ${pin.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(pin.project.id)}
                >
                  <circle r="16" fill="transparent" />
                  <circle
                    r={on ? 9 : 7}
                    fill={statusColor(pin.project.status)}
                    stroke={on ? "#003865" : "#ffffff"}
                    strokeWidth={on ? 3 : 2}
                    opacity={pin.project.active ? 1 : 0.45}
                  />
                  <title>
                    {pin.project.shortName} · {pin.province}
                  </title>
                </g>
              );
            })}
            {PROVINCE_SHAPES.map((shape) => {
              const center = CENTROIDS.get(shape.name);
              if (!center) return null;
              const [x, y] = xy(center[0], center[1]);
              const count = pins.filter((pin) => pin.province === shape.name).length;
              const radius = count <= 1 ? 0 : 16 + Math.floor((count - 1) / 8) * 14;
              const above = y - radius - 18;
              const labelY = above > 16 ? above : y + radius + 18;
              return (
                <text
                  key={`${shape.name}-label`}
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  fill="#003865"
                  stroke="#f4f7fb"
                  strokeWidth="5"
                  paintOrder="stroke"
                  fontSize="13"
                  fontWeight="600"
                  style={{ pointerEvents: "none" }}
                >
                  {shape.name}
                </text>
              );
            })}
          </svg>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border bg-white/90 px-3 py-2 text-xs text-muted-foreground">
            <Legend color="#0468b1" label="Ongoing" />
            <Legend color="#5b8eb8" label="Planned" />
            <Legend color="#8aa0b3" label="Procurement" />
            <Legend color="#b45309" label="Closing" />
          </div>
          {selected ? <ProjectOverlay project={selected} onClose={() => setSelectedId("")} /> : null}
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
    <aside className="absolute inset-x-2 bottom-12 z-10 flex h-[68%] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-lg sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-14 sm:h-auto sm:w-80">
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
