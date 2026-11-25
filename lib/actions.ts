"use server";

import { redirect } from "next/navigation";
import { requireAdmin, setSession, clearSession, getCurrentUser } from "@/lib/auth";
import { connection } from "next/server";
import { AFGHAN_WEEK, canEditWeek, kabulToday, normalizeWorkDays, weekDates, weekStartFor } from "@/lib/dates";
import { ACTIVITIES, MISSION_STATUSES, PROVINCES } from "@/lib/labels";
import { loginKey, matchStaff, normalizeNameInput } from "@/lib/names";
import {
  countActiveAdmins,
  deleteMission,
  getMission,
  getProject,
  getStaff,
  getWorkDays,
  listProjects,
  listStaff,
  replaceStaffWeek,
  saveMission,
  saveProject,
  saveStaff,
  setWorkDays,
} from "@/lib/queries";
import type { DayDraft } from "@/lib/types";
import { cleanLine, cleanNote } from "@/lib/utils";

function notice(path: string, key: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}notice=${key}`);
}

function fail(path: string, key: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${key}`);
}

export async function login(formData: FormData) {
  const raw = String(formData.get("lastName") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const cleaned = normalizeNameInput(raw);
  if (!cleaned) redirect("/login?error=empty");

  let staff;
  try {
    staff = await listStaff();
  } catch {
    redirect("/login?error=database");
  }
  const any = matchStaff(staff, cleaned, { includeInactive: true });
  const matches = any.filter((person) => person.active);
  if (any.length > 0 && matches.length === 0) {
    redirect(`/login?error=inactive&name=${encodeURIComponent(cleaned)}`);
  }
  if (staffId) {
    const chosen = matches.find((person) => person.id === staffId);
    if (!chosen) redirect(`/login?error=none&name=${encodeURIComponent(cleaned)}`);
    await setSession(chosen.id);
    redirect("/");
  }
  if (matches.length === 0) redirect(`/login?error=none&name=${encodeURIComponent(cleaned)}`);
  if (matches.length > 1) redirect(`/login?choose=${encodeURIComponent(cleaned)}`);
  try {
    await setSession(matches[0]!.id);
  } catch {
    redirect("/login?error=database");
  }
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function saveWeek(formData: FormData) {
  const user = await getCurrentUser();
  const weekStart = String(formData.get("weekStart") ?? "");
  const workDays = await getWorkDays();
  const dates = weekDates(weekStart, workDays);
  if (!dates.length || dates[0] !== weekStart || weekStartFor(weekStart, workDays) !== weekStart) {
    fail(`/plan?week=${encodeURIComponent(weekStart)}`, "week");
  }
  await connection();
  const today = kabulToday(new Date());
  if (!canEditWeek(dates, today, user.isAdmin)) {
    fail(`/plan?week=${weekStart}`, "closed");
  }

  const known = new Set((await listProjects()).map((project) => project.id));
  const provinces = new Set<string>(PROVINCES);
  const activities = new Set<string>(ACTIVITIES.map((item) => item.id));
  const drafts = new Map<string, DayDraft>();
  for (const day of dates) {
    const province = cleanLine(formData.get(`province_${day}`), 80);
    const activity = cleanLine(formData.get(`activity_${day}`), 40);
    drafts.set(day, {
      day,
      province: provinces.has(province) ? province : "",
      location: cleanLine(formData.get(`location_${day}`), 200),
      activity: activities.has(activity) ? activity : "",
      note: cleanNote(formData.get(`note_${day}`), 1000),
      projectIds: [],
    });
  }
  for (const value of formData.getAll("project")) {
    const [day, projectId] = String(value).split("|");
    const draft = day ? drafts.get(day) : undefined;
    if (!draft || !projectId || !known.has(projectId) || draft.projectIds.includes(projectId)) continue;
    draft.projectIds.push(projectId);
  }
  await replaceStaffWeek(user.id, weekStart, [...drafts.values()]);
  redirect(`/plan?week=${weekStart}&notice=plan`);
}

export async function saveWorkWeek(formData: FormData) {
  await requireAdmin();
  const picked = AFGHAN_WEEK.filter((day) => formData.getAll("day").map(Number).includes(day));
  const days = normalizeWorkDays([...picked]);
  if (!days.length) fail("/admin", "days");
  await setWorkDays(days);
  notice("/admin", "week");
}

export async function saveStaffAction(formData: FormData) {
  await requireAdmin();
  const existingId = cleanLine(formData.get("id"), 40);
  const isNew = !existingId;
  const fullName = cleanLine(formData.get("fullName"), 120);
  const role = cleanLine(formData.get("role"), 160);
  const isAdmin = formData.get("isAdmin") === "1";
  const active = formData.get("active") === "1";
  if (fullName.length < 2 || !loginKey(fullName)) fail(`/admin?staff=${existingId || "new"}`, "name");

  if (!isNew) {
    const existing = await getStaff(existingId);
    if (!existing) fail("/admin", "name");
    const droppingAdmin = existing.isAdmin && existing.active && (!isAdmin || !active);
    if (droppingAdmin && (await countActiveAdmins(existingId)) === 0) {
      fail(`/admin?staff=${existingId}`, "last-admin");
    }
  }

  const id = isNew ? `STF-${crypto.randomUUID().slice(0, 8)}` : existingId;
  await saveStaff({ id, fullName, role, isAdmin, active, isNew });
  notice("/admin", "staff");
}

export async function saveProjectAction(formData: FormData) {
  await requireAdmin();
  const existingId = cleanLine(formData.get("id"), 80);
  const isNew = !existingId;
  const name = cleanLine(formData.get("name"), 240);
  const shortName = cleanLine(formData.get("shortName"), 40);
  const programme = cleanLine(formData.get("programme"), 80);
  const partner = cleanLine(formData.get("partner"), 80);
  const status = cleanLine(formData.get("status"), 80);
  const startDate = cleanLine(formData.get("startDate"), 10);
  const endDate = cleanLine(formData.get("endDate"), 10);
  const provinces = formData
    .getAll("province")
    .map((value) => cleanLine(value, 40))
    .filter((value) => (PROVINCES as readonly string[]).includes(value));
  if (!name || !shortName || !programme || !partner || !status || provinces.length === 0) {
    fail(`/admin?project=${existingId || "new"}`, "project");
  }
  if (startDate && endDate && endDate < startDate) fail(`/admin?project=${existingId || "new"}`, "dates");
  if (!isNew && !(await getProject(existingId))) fail("/admin", "project");

  const id = isNew ? `PRJ-${crypto.randomUUID().slice(0, 8)}` : existingId;
  const windowText = cleanLine(formData.get("windowText"), 80);
  await saveProject({
    id,
    name,
    shortName,
    programme,
    partner,
    provinces,
    status,
    windowText: windowText || (startDate && endDate ? `${startDate.slice(0, 7)} to ${endDate.slice(0, 7)}` : ""),
    startDate: startDate || null,
    endDate: endDate || null,
    budget: cleanLine(formData.get("budget"), 80),
    progress: cleanLine(formData.get("progress"), 40),
    ref: cleanLine(formData.get("ref"), 80),
    active: formData.get("active") === "1",
    isNew,
  });
  notice("/admin", "project");
}

export async function saveMissionAction(formData: FormData) {
  const user = await getCurrentUser();
  const existingId = cleanLine(formData.get("id"), 40);
  const isNew = !existingId;
  const title = cleanLine(formData.get("title"), 180);
  const startDate = cleanLine(formData.get("startDate"), 10);
  const endDate = cleanLine(formData.get("endDate"), 10);
  const status = cleanLine(formData.get("status"), 80);
  const purpose = cleanNote(formData.get("purpose"), 2000);
  if (!title || !startDate || !endDate || !purpose || !MISSION_STATUSES.includes(status as (typeof MISSION_STATUSES)[number])) {
    fail(isNew ? "/missions/new" : `/missions/${existingId}`, "mission");
  }
  if (endDate < startDate) fail(isNew ? "/missions/new" : `/missions/${existingId}`, "dates");
  if (!isNew && !(await getMission(existingId))) fail("/missions", "mission");

  const staffIds = new Set((await listStaff()).map((person) => person.id));
  const projectIds = new Set((await listProjects()).map((project) => project.id));
  const id = isNew ? `MIS-${startDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 4)}` : existingId;
  const previous = isNew ? undefined : await getMission(existingId);
  await saveMission({
    id,
    title,
    startDate,
    endDate,
    status,
    location: cleanLine(formData.get("location"), 200),
    provinces: formData
      .getAll("province")
      .map((value) => cleanLine(value, 40))
      .filter((value) => (PROVINCES as readonly string[]).includes(value)),
    purpose,
    btorDone: formData.get("btor") === "yes",
    createdBy: previous?.createdBy ?? user.id,
    projectIds: formData.getAll("missionProject").map(String).filter((value) => projectIds.has(value)),
    staffIds: formData.getAll("traveller").map(String).filter((value) => staffIds.has(value)),
    isNew,
  });
  redirect(`/missions/${id}?notice=mission`);
}

export async function deleteMissionAction(formData: FormData) {
  await getCurrentUser();
  const id = cleanLine(formData.get("id"), 40);
  if (formData.get("confirm") !== "yes" || !id) fail(`/missions/${id}`, "mission");
  await deleteMission(id);
  redirect("/missions?notice=mission-deleted");
}
