import { all, get, run, transaction } from "@/lib/db";
import { DEFAULT_WORK_DAYS, normalizeWorkDays } from "@/lib/dates";
import { activityLabel } from "@/lib/labels";
import type { DayDraft, FieldUpdate, Mission, PlanDay, PlanProject, Project, Staff, WorkplanItem } from "@/lib/types";

type SqlRow = Record<string, unknown>;

function text(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function flag(value: unknown): boolean {
  return Number(value) === 1;
}

function jsonList(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function splitIds(value: unknown): string[] {
  const raw = text(value);
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

function mapStaff(row: SqlRow): Staff {
  return {
    id: text(row.id),
    fullName: text(row.full_name),
    role: text(row.role),
    isAdmin: flag(row.is_admin),
    active: flag(row.active),
  };
}

function mapProject(row: SqlRow): Project {
  return {
    id: text(row.id),
    name: text(row.name),
    shortName: text(row.short_name),
    programme: text(row.programme),
    partner: text(row.partner),
    provinces: jsonList(row.provinces),
    status: text(row.status),
    windowText: text(row.window_text),
    startDate: row.start_date ? text(row.start_date) : null,
    endDate: row.end_date ? text(row.end_date) : null,
    budget: text(row.budget),
    progress: text(row.progress),
    ref: text(row.ref),
    active: flag(row.active),
  };
}

function mapPlanProject(row: SqlRow): PlanProject & { planDayId: string } {
  return {
    planDayId: text(row.plan_day_id),
    id: text(row.id),
    name: text(row.name),
    shortName: text(row.short_name),
    programme: text(row.programme),
    partner: text(row.partner),
    provinces: jsonList(row.provinces),
  };
}

function mapMission(row: SqlRow): Mission {
  return {
    id: text(row.id),
    title: text(row.title),
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    status: text(row.status),
    location: text(row.location),
    provinces: jsonList(row.provinces),
    purpose: text(row.purpose),
    btorDone: flag(row.btor_done),
    createdBy: row.created_by ? text(row.created_by) : null,
    projectIds: splitIds(row.project_ids),
    staffIds: splitIds(row.staff_ids),
  };
}

function mapWorkplan(row: SqlRow): WorkplanItem {
  return {
    id: text(row.id),
    partner: text(row.partner),
    project: text(row.project),
    activity: text(row.activity),
    startMonth: text(row.start_month),
    endMonth: text(row.end_month),
    status: text(row.status),
    progress: text(row.progress),
    source: text(row.source),
  };
}

const MISSION_SELECT = `
  SELECT m.*,
    (SELECT group_concat(project_id) FROM mission_projects mp WHERE mp.mission_id = m.id) AS project_ids,
    (SELECT group_concat(staff_id) FROM mission_staff ms WHERE ms.mission_id = m.id) AS staff_ids
  FROM missions m
`;

export async function listStaff(): Promise<Staff[]> {
  const rows = await all<SqlRow>("SELECT * FROM staff ORDER BY full_name COLLATE NOCASE");
  return rows.map(mapStaff);
}

export async function getStaff(id: string): Promise<Staff | undefined> {
  const row = await get<SqlRow>("SELECT * FROM staff WHERE id = ?", [id]);
  return row ? mapStaff(row) : undefined;
}

export async function countActiveAdmins(exceptId?: string): Promise<number> {
  const row = await get<SqlRow>(
    "SELECT COUNT(*) AS n FROM staff WHERE is_admin = 1 AND active = 1 AND id <> ?",
    [exceptId ?? ""],
  );
  return Number(row?.n ?? 0);
}

export async function saveStaff(input: {
  id: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  active: boolean;
  isNew: boolean;
}): Promise<void> {
  if (input.isNew) {
    await run(
      `INSERT INTO staff (id, full_name, role, is_admin, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.fullName, input.role, input.isAdmin ? 1 : 0, input.active ? 1 : 0, new Date().toISOString()],
    );
    return;
  }
  await run(
    "UPDATE staff SET full_name = ?, role = ?, is_admin = ?, active = ? WHERE id = ?",
    [input.fullName, input.role, input.isAdmin ? 1 : 0, input.active ? 1 : 0, input.id],
  );
}

export async function listProjects(): Promise<Project[]> {
  const rows = await all<SqlRow>("SELECT * FROM projects ORDER BY programme, short_name COLLATE NOCASE");
  return rows.map(mapProject);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const row = await get<SqlRow>("SELECT * FROM projects WHERE id = ?", [id]);
  return row ? mapProject(row) : undefined;
}

export async function saveProject(input: Project & { isNew: boolean }): Promise<void> {
  const provinces = JSON.stringify(input.provinces);
  if (input.isNew) {
    await run(
      `INSERT INTO projects
        (id, name, short_name, programme, partner, provinces, status, window_text, start_date, end_date, budget, progress, ref, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.name,
        input.shortName,
        input.programme,
        input.partner,
        provinces,
        input.status,
        input.windowText,
        input.startDate,
        input.endDate,
        input.budget,
        input.progress,
        input.ref,
        input.active ? 1 : 0,
        new Date().toISOString(),
      ],
    );
    return;
  }
  await run(
    `UPDATE projects SET
      name = ?, short_name = ?, programme = ?, partner = ?, provinces = ?, status = ?,
      window_text = ?, start_date = ?, end_date = ?, budget = ?, progress = ?, ref = ?, active = ?
     WHERE id = ?`,
    [
      input.name,
      input.shortName,
      input.programme,
      input.partner,
      provinces,
      input.status,
      input.windowText,
      input.startDate,
      input.endDate,
      input.budget,
      input.progress,
      input.ref,
      input.active ? 1 : 0,
      input.id,
    ],
  );
}

export async function getWorkDays(): Promise<number[]> {
  const row = await get<SqlRow>("SELECT value FROM settings WHERE key = 'work_days'");
  if (!row) return DEFAULT_WORK_DAYS;
  try {
    const parsed = JSON.parse(text(row.value)) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WORK_DAYS;
    const days = normalizeWorkDays(parsed.map(Number));
    return days.length ? days : DEFAULT_WORK_DAYS;
  } catch {
    return DEFAULT_WORK_DAYS;
  }
}

export async function setWorkDays(days: number[]): Promise<void> {
  await run(
    `INSERT INTO settings (key, value) VALUES ('work_days', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(days)],
  );
}

async function attachProjects(days: PlanDay[]): Promise<PlanDay[]> {
  if (!days.length) return days;
  const ids = days.map((day) => day.id);
  const placeholders = ids.map(() => "?").join(",");
  const links = await all<SqlRow>(
    `SELECT pdp.plan_day_id, p.id, p.short_name, p.name, p.programme, p.partner, p.provinces
     FROM plan_day_projects pdp
     JOIN projects p ON p.id = pdp.project_id
     WHERE pdp.plan_day_id IN (${placeholders})
     ORDER BY p.programme, p.short_name`,
    ids,
  );
  const byDay = new Map<string, PlanProject[]>();
  for (const link of links.map(mapPlanProject)) {
    const list = byDay.get(link.planDayId) ?? [];
    list.push(link);
    byDay.set(link.planDayId, list);
  }
  return days.map((day) => ({ ...day, projects: byDay.get(day.id) ?? [] }));
}

function mapPlanDay(row: SqlRow): PlanDay {
  return {
    id: text(row.id),
    staffId: text(row.staff_id),
    day: text(row.day),
    weekStart: text(row.week_start),
    province: text(row.province),
    location: text(row.location),
    activity: text(row.activity),
    note: text(row.note),
    projects: [],
  };
}

export async function plansBetween(from: string, to: string): Promise<PlanDay[]> {
  const rows = await all<SqlRow>(
    "SELECT * FROM plan_days WHERE day >= ? AND day <= ? ORDER BY day",
    [from, to],
  );
  return attachProjects(rows.map(mapPlanDay));
}

export async function replaceStaffWeek(staffId: string, weekStart: string, days: DayDraft[]): Promise<void> {
  const dates = days.map((day) => day.day);
  const now = new Date().toISOString();
  await transaction(async (tx) => {
    if (dates.length) {
      const placeholders = dates.map(() => "?").join(",");
      await tx.execute({
        sql: `DELETE FROM plan_day_projects WHERE plan_day_id IN (
          SELECT id FROM plan_days WHERE staff_id = ? AND day IN (${placeholders})
        )`,
        args: [staffId, ...dates],
      });
      await tx.execute({
        sql: `DELETE FROM plan_days WHERE staff_id = ? AND day IN (${placeholders})`,
        args: [staffId, ...dates],
      });
    }
    for (const day of days) {
      const empty =
        day.projectIds.length === 0 &&
        !day.province &&
        !day.location &&
        !day.activity &&
        !day.note;
      if (empty) continue;
      const id = crypto.randomUUID();
      await tx.execute({
        sql: `INSERT INTO plan_days
          (id, staff_id, day, week_start, province, location, activity, note, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, staffId, day.day, weekStart, day.province, day.location, day.activity, day.note, now],
      });
      for (const projectId of day.projectIds) {
        await tx.execute({
          sql: "INSERT INTO plan_day_projects (plan_day_id, project_id) VALUES (?, ?)",
          args: [id, projectId],
        });
      }
    }
  });
}

export async function listWeekStarts(): Promise<string[]> {
  const rows = await all<SqlRow>(
    "SELECT DISTINCT week_start FROM plan_days ORDER BY week_start DESC LIMIT 16",
  );
  return rows.map((row) => text(row.week_start));
}

export async function listMissions(): Promise<Mission[]> {
  const rows = await all<SqlRow>(`${MISSION_SELECT} ORDER BY m.start_date DESC, m.title`);
  return rows.map(mapMission);
}

export async function missionsCovering(day: string): Promise<Mission[]> {
  const rows = await all<SqlRow>(
    `${MISSION_SELECT} WHERE m.start_date <= ? AND m.end_date >= ? ORDER BY m.title`,
    [day, day],
  );
  return rows.map(mapMission);
}

export async function getMission(id: string): Promise<Mission | undefined> {
  const row = await get<SqlRow>(`${MISSION_SELECT} WHERE m.id = ?`, [id]);
  return row ? mapMission(row) : undefined;
}

export async function saveMission(input: Mission & { isNew: boolean }): Promise<void> {
  const now = new Date().toISOString();
  await transaction(async (tx) => {
    if (input.isNew) {
      await tx.execute({
        sql: `INSERT INTO missions
          (id, title, start_date, end_date, status, location, provinces, purpose, btor_done, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.id,
          input.title,
          input.startDate,
          input.endDate,
          input.status,
          input.location,
          JSON.stringify(input.provinces),
          input.purpose,
          input.btorDone ? 1 : 0,
          input.createdBy,
          now,
          now,
        ],
      });
    } else {
      await tx.execute({
        sql: `UPDATE missions SET
          title = ?, start_date = ?, end_date = ?, status = ?, location = ?, provinces = ?,
          purpose = ?, btor_done = ?, updated_at = ?
          WHERE id = ?`,
        args: [
          input.title,
          input.startDate,
          input.endDate,
          input.status,
          input.location,
          JSON.stringify(input.provinces),
          input.purpose,
          input.btorDone ? 1 : 0,
          now,
          input.id,
        ],
      });
      await tx.execute({ sql: "DELETE FROM mission_projects WHERE mission_id = ?", args: [input.id] });
      await tx.execute({ sql: "DELETE FROM mission_staff WHERE mission_id = ?", args: [input.id] });
    }
    for (const projectId of input.projectIds) {
      await tx.execute({
        sql: "INSERT OR IGNORE INTO mission_projects (mission_id, project_id) VALUES (?, ?)",
        args: [input.id, projectId],
      });
    }
    for (const staffId of input.staffIds) {
      await tx.execute({
        sql: "INSERT OR IGNORE INTO mission_staff (mission_id, staff_id) VALUES (?, ?)",
        args: [input.id, staffId],
      });
    }
  });
}

export async function deleteMission(id: string): Promise<void> {
  await transaction(async (tx) => {
    await tx.execute({ sql: "DELETE FROM mission_projects WHERE mission_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM mission_staff WHERE mission_id = ?", args: [id] });
    await tx.execute({ sql: "DELETE FROM missions WHERE id = ?", args: [id] });
  });
}

export async function listFieldUpdates(): Promise<Record<string, FieldUpdate[]>> {
  const missions = await all<SqlRow>(
    `SELECT mp.project_id, m.id, m.title, m.start_date, m.end_date, m.status, m.location, m.purpose, m.btor_done,
        (SELECT group_concat(s.full_name, ', ')
         FROM mission_staff ms JOIN staff s ON s.id = ms.staff_id
         WHERE ms.mission_id = m.id) AS who
     FROM mission_projects mp
     JOIN missions m ON m.id = mp.mission_id
     ORDER BY m.start_date DESC`,
  );
  const plans = await all<SqlRow>(
    `SELECT pdp.project_id, pd.day, pd.province, pd.location, pd.activity, pd.note, pd.staff_id, s.full_name
     FROM plan_day_projects pdp
     JOIN plan_days pd ON pd.id = pdp.plan_day_id
     JOIN staff s ON s.id = pd.staff_id
     ORDER BY pd.day DESC`,
  );
  const grouped = new Map<string, FieldUpdate[]>();
  const push = (projectId: string, update: FieldUpdate) => {
    if (!projectId) return;
    const list = grouped.get(projectId) ?? [];
    list.push(update);
    grouped.set(projectId, list);
  };
  for (const row of missions) {
    push(text(row.project_id), {
      kind: "mission",
      date: text(row.start_date),
      endDate: text(row.end_date),
      title: text(row.title),
      place: text(row.location),
      status: text(row.status),
      detail: text(row.purpose),
      who: text(row.who),
      href: `/missions/${text(row.id)}`,
      btorDone: flag(row.btor_done),
    });
  }
  for (const row of plans) {
    const place = [text(row.location), text(row.province)].filter(Boolean).join(", ");
    push(text(row.project_id), {
      kind: "plan",
      date: text(row.day),
      endDate: text(row.day),
      title: activityLabel(text(row.activity)) || "Weekly plan",
      place,
      status: "Weekly plan",
      detail: text(row.note),
      who: text(row.full_name),
      href: `/plan?week=${encodeURIComponent(text(row.day))}&staff=${encodeURIComponent(text(row.staff_id))}`,
      btorDone: false,
    });
  }
  const result: Record<string, FieldUpdate[]> = {};
  for (const [id, list] of grouped) {
    list.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "mission" ? -1 : 1));
    result[id] = list.slice(0, 3);
  }
  return result;
}

export async function listWorkplans(partner = "", status = ""): Promise<WorkplanItem[]> {
  const clauses: string[] = [];
  const args: string[] = [];
  if (partner) {
    clauses.push("partner = ?");
    args.push(partner);
  }
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await all<SqlRow>(
    `SELECT * FROM workplan_items ${where} ORDER BY partner, project, start_month, activity`,
    args,
  );
  return rows.map(mapWorkplan);
}
