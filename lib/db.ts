import { createClient as createHttpClient, type Client, type InValue, type Transaction } from "@libsql/client/http";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { MISSIONS } from "@/data/seed/missions";
import { PLANS } from "@/data/seed/plans";
import { PROJECTS } from "@/data/seed/projects";
import { STAFF } from "@/data/seed/staff";
import { WORKPLANS } from "@/data/seed/workplans";
import { PASSWORD_RESETS } from "@/data/seed/password-resets";
import { DEFAULT_WORK_DAYS, parseWindow } from "@/lib/dates";
import { loginKey } from "@/lib/names";
import { hashPassword, verifyPassword } from "@/lib/passwords";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    is_admin INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    password_hash TEXT NOT NULL DEFAULT '',
    session_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    programme TEXT NOT NULL,
    partner TEXT NOT NULL,
    provinces TEXT NOT NULL,
    status TEXT NOT NULL,
    window_text TEXT NOT NULL DEFAULT '',
    start_date TEXT,
    end_date TEXT,
    budget TEXT NOT NULL DEFAULT '',
    progress TEXT NOT NULL DEFAULT '',
    ref TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plan_days (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    day TEXT NOT NULL,
    week_start TEXT NOT NULL,
    province TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    activity TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE (staff_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS plan_day_projects (
    plan_day_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    PRIMARY KEY (plan_day_id, project_id)
  )`,
  `CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    provinces TEXT NOT NULL DEFAULT '[]',
    purpose TEXT NOT NULL DEFAULT '',
    btor_done INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mission_projects (
    mission_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    PRIMARY KEY (mission_id, project_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mission_staff (
    mission_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    PRIMARY KEY (mission_id, staff_id)
  )`,
  `CREATE TABLE IF NOT EXISTS workplan_items (
    id TEXT PRIMARY KEY,
    partner TEXT NOT NULL,
    project TEXT NOT NULL,
    activity TEXT NOT NULL,
    start_month TEXT NOT NULL,
    end_month TEXT NOT NULL,
    status TEXT NOT NULL,
    progress TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_plan_days_day ON plan_days(day)`,
  `CREATE INDEX IF NOT EXISTS idx_plan_days_staff ON plan_days(staff_id)`,
  `CREATE INDEX IF NOT EXISTS idx_missions_dates ON missions(start_date, end_date)`,
  `CREATE INDEX IF NOT EXISTS idx_workplans_partner ON workplan_items(partner)`,
  `CREATE TABLE IF NOT EXISTS mission_reports (
    mission_id TEXT PRIMARY KEY,
    partner_name TEXT NOT NULL DEFAULT '',
    staff_text TEXT NOT NULL DEFAULT '',
    dates_text TEXT NOT NULL DEFAULT '',
    location_text TEXT NOT NULL DEFAULT '',
    objectives TEXT NOT NULL DEFAULT '',
    activities TEXT NOT NULL DEFAULT '',
    findings TEXT NOT NULL DEFAULT '',
    challenges TEXT NOT NULL DEFAULT '',
    recommendations TEXT NOT NULL DEFAULT '',
    stakeholders TEXT NOT NULL DEFAULT '',
    pictures TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by TEXT
  )`,
];

const globalForDb = globalThis as unknown as {
  gardezClient?: Client;
  gardezReady?: Promise<void>;
};

function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL || process.env.NETLIFY) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Create a Turso database and add it to the host before opening the planner. See the README.",
    );
  }
  const file = process.env.DATABASE_FILE || join(process.cwd(), "data", "gardez.db");
  mkdirSync(dirname(file), { recursive: true });
  return `file:${file}`;
}

function remoteUrl(url: string): string {
  if (url.startsWith("libsql://")) return `https://${url.slice("libsql://".length)}`;
  return url;
}

type SqlStatement = { sql: string; args: InValue[] };

async function openClient(): Promise<Client> {
  if (!globalForDb.gardezClient) {
    const url = databaseUrl();
    if (url.startsWith("file:")) {
      const { createClient } = await import("@libsql/client");
      globalForDb.gardezClient = createClient({ url, timeout: 8000 });
    } else {
      globalForDb.gardezClient = createHttpClient({
        url: remoteUrl(url),
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    }
  }
  return globalForDb.gardezClient;
}

function seedStatements(): SqlStatement[] {
  const now = "2026-11-25T00:00:00.000Z";
  const statements: SqlStatement[] = [];
  for (const person of STAFF) {
    statements.push({
      sql: `INSERT OR IGNORE INTO staff (id, full_name, role, is_admin, active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)`,
      args: [person.id, person.fullName, person.role, person.isAdmin ? 1 : 0, now],
    });
  }
  for (const project of PROJECTS) {
    const dates = parseWindow(project.window);
    statements.push({
      sql: `INSERT OR IGNORE INTO projects
        (id, name, short_name, programme, partner, provinces, status, window_text, start_date, end_date, budget, progress, ref, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        project.id,
        project.name,
        project.shortName,
        project.programme,
        project.partner,
        JSON.stringify(project.provinces),
        project.status,
        project.window,
        dates.start,
        dates.end,
        project.budget,
        project.progress,
        project.ref,
        now,
      ],
    });
  }
  for (const mission of MISSIONS) {
    statements.push({
      sql: `INSERT OR IGNORE INTO missions
        (id, title, start_date, end_date, status, location, provinces, purpose, btor_done, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      args: [
        mission.id,
        mission.title,
        mission.startDate,
        mission.endDate,
        mission.status,
        mission.location,
        JSON.stringify(mission.provinces),
        mission.purpose,
        mission.btor === "On file" ? 1 : 0,
        now,
        now,
      ],
    });
    for (const projectId of mission.projectIds) {
      statements.push({
        sql: "INSERT OR IGNORE INTO mission_projects (mission_id, project_id) VALUES (?, ?)",
        args: [mission.id, projectId],
      });
    }
    for (const staffId of mission.staffIds) {
      statements.push({
        sql: "INSERT OR IGNORE INTO mission_staff (mission_id, staff_id) VALUES (?, ?)",
        args: [mission.id, staffId],
      });
    }
  }
  for (const item of WORKPLANS) {
    statements.push({
      sql: `INSERT OR IGNORE INTO workplan_items
        (id, partner, project, activity, start_month, end_month, status, progress, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.id,
        item.partner,
        item.project,
        item.activity,
        item.startMonth,
        item.endMonth,
        item.status,
        item.progress,
        item.source,
      ],
    });
  }
  for (const plan of PLANS) {
    statements.push({
      sql: `INSERT OR IGNORE INTO plan_days
        (id, staff_id, day, week_start, province, location, activity, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        plan.id,
        plan.staffId,
        plan.day,
        plan.weekStart,
        plan.province,
        plan.location,
        plan.activity,
        plan.note,
        now,
      ],
    });
    for (const projectId of plan.projectIds) {
      statements.push({
        sql: "INSERT OR IGNORE INTO plan_day_projects (plan_day_id, project_id) VALUES (?, ?)",
        args: [plan.id, projectId],
      });
    }
  }
  statements.push({
    sql: "INSERT OR IGNORE INTO settings (key, value) VALUES ('work_days', ?)",
    args: [JSON.stringify(DEFAULT_WORK_DAYS)],
  });
  statements.push({
    sql: "INSERT INTO settings (key, value) VALUES ('seed_version', '1')",
    args: [],
  });
  return statements;
}

async function runBatch(client: Client, statements: SqlStatement[]) {
  const size = 40;
  for (let index = 0; index < statements.length; index += size) {
    await client.batch(statements.slice(index, index + size), "write");
  }
}

async function init() {
  const client = await openClient();
  await runBatch(
    client,
    SCHEMA.map((sql) => ({ sql, args: [] })),
  );
  const existing = await client.execute("SELECT value FROM settings WHERE key = 'seed_version'");
  if (String(existing.rows[0]?.value ?? "") !== "1") {
    await runBatch(client, seedStatements());
  }
  await ensurePasswords(client);
}

async function addColumn(client: Client, sql: string) {
  try {
    await client.execute(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column/i.test(message)) throw error;
  }
}

async function ensurePasswords(client: Client) {
  await addColumn(client, "ALTER TABLE staff ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
  await addColumn(client, "ALTER TABLE staff ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1");
  const rows = await client.execute("SELECT id, full_name, password_hash FROM staff");
  for (const row of rows.rows) {
    const id = String(row.id);
    const current = String(row.password_hash ?? "");
    const replacement = PASSWORD_RESETS[id];
    if (!current) {
      const hash = replacement ?? (await hashPassword(loginKey(String(row.full_name))));
      await client.execute({
        sql: "UPDATE staff SET password_hash = ? WHERE id = ? AND password_hash = ''",
        args: [hash, id],
      });
      continue;
    }
    if (!replacement) continue;
    if (!(await verifyPassword(loginKey(String(row.full_name)), current))) continue;
    await client.execute({
      sql: "UPDATE staff SET password_hash = ?, session_version = session_version + 1 WHERE id = ?",
      args: [replacement, id],
    });
  }
}

export function ready(): Promise<void> {
  if (!globalForDb.gardezReady) {
    globalForDb.gardezReady = init().catch((error: unknown) => {
      globalForDb.gardezReady = undefined;
      throw error;
    });
  }
  return globalForDb.gardezReady;
}

export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  await ready();
  const tx = await (await openClient()).transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  await ready();
  const result = await (await openClient()).execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function get<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(sql: string, args: InValue[] = []): Promise<void> {
  await ready();
  await (await openClient()).execute({ sql, args });
}
