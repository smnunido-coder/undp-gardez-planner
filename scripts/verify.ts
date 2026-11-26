import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), "gardez-")), "test.db");
process.env.SESSION_SECRET = "verify-secret";
delete process.env.TURSO_DATABASE_URL;

async function main() {
const { loginKey, matchStaff } = await import("../lib/names");
const { weekStartFor, weekDates, DEFAULT_WORK_DAYS } = await import("../lib/dates");
const { listStaff, listProjects, listMissions, listWorkplans, listFieldUpdates, getPasswordHash, setPassword, replaceStaffWeek, plansBetween } = await import(
  "../lib/queries"
);
const { verifyPassword } = await import("../lib/passwords");
const { PROVINCE_SHAPES } = await import("../lib/geo/southeast");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(loginKey("  Yarghal ") === "yarghal", "trim and case");
assert(loginKey("Saif ur Rehman Ludin") === "ludin", "last word Ludin");
assert(loginKey("Sayed Samoon Ahmadi") === "ahmadi", "Ahmadi not Samoon");
assert(loginKey("Dad Mohammad Samoon") === "samoon", "Samoon");
assert(weekStartFor("2026-11-25", DEFAULT_WORK_DAYS) === "2026-11-21", "week starts Saturday");
assert(weekDates("2026-11-21", DEFAULT_WORK_DAYS).join(",") === "2026-11-21,2026-11-22,2026-11-23,2026-11-24,2026-11-25,2026-11-26", "Sat-Thu");

const staff = await listStaff();
const projects = await listProjects();
const missions = await listMissions();
const workplans = await listWorkplans();
assert(staff.length === 12, `staff ${staff.length}`);
assert(projects.length === 24, `projects ${projects.length}`);
assert(missions.length === 11, `missions ${missions.length}`);
assert(workplans.length === 74, `workplans ${workplans.length}`);
assert(staff.filter((person) => person.isAdmin).map((person) => person.fullName).join() === "Dad Mohammad Samoon", "admin");
assert(matchStaff(staff, "Durani").length === 1, "Durani");
assert(matchStaff(staff, "samoon")[0]?.id === "STF-11", "Samoon login");
assert(matchStaff(staff, "Ahmadi")[0]?.id === "STF-06", "Ahmadi login");
assert(await verifyPassword("durani", await getPasswordHash("STF-02")), "starting password is the last name");
assert(await verifyPassword("ahmadi", await getPasswordHash("STF-06")), "Ahmadi password");
assert(!(await verifyPassword("samoon", await getPasswordHash("STF-06"))), "Ahmadi is not Samoon");
await setPassword("STF-02", "x");
assert(await verifyPassword("x", await getPasswordHash("STF-02")), "one character password");
await setPassword("STF-02", "a b  ");
assert(await verifyPassword("a b  ", await getPasswordHash("STF-02")), "password kept exactly");
assert(!(await verifyPassword("a b", await getPasswordHash("STF-02"))), "spaces are part of the password");

await replaceStaffWeek("STF-02", "2026-11-21", [
  {
    day: "2026-11-21",
    province: "Paktika",
    location: "Yousuf Khail",
    activity: "monitoring",
    note: "Two sites",
    projectIds: ["JICA-ALCC", "JICA-WNCC"],
  },
]);
const days = await plansBetween("2026-11-21", "2026-11-26");
const row = days.find((day) => day.staffId === "STF-02" && day.day === "2026-11-21");
assert(row?.projects.length === 2, "multi-project day");
const alcc = days.filter((day) => day.projects.some((project) => project.id === "JICA-ALCC")).length;
assert(alcc >= 1, "dashboard count");

const extra = [
  ...staff,
  { id: "X1", fullName: "Ahmad Khan", role: "", isAdmin: false, active: true },
  { id: "X2", fullName: "Laila Khan", role: "", isAdmin: false, active: true },
];
assert(matchStaff(extra, "khan").length === 2, "shared last name");
assert(matchStaff(extra, "Laila Khan").length === 1, "full name wins");

const shapes = new Set(PROVINCE_SHAPES.map((shape) => shape.name));
assert(shapes.size === 8, "eight provinces on the map");
for (const project of projects) {
  for (const name of project.provinces) assert(shapes.has(name), `map shape ${name}`);
}
const updates = await listFieldUpdates();
const alccUpdates = updates["JICA-ALCC"] ?? [];
assert(alccUpdates.some((update) => update.kind === "plan" && update.place.includes("Yousuf Khail")), "map plan update");
assert(alccUpdates.some((update) => update.kind === "mission"), "map mission update");

console.log("verify ok", { staff: staff.length, projects: projects.length, missions: missions.length, workplans: workplans.length });
}

main();
