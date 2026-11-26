import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), "gardez-")), "test.db");
process.env.SESSION_SECRET = "verify-secret";
delete process.env.TURSO_DATABASE_URL;

async function main() {
const { loginKey, matchStaff } = await import("../lib/names");
const { weekStartFor, weekDates, DEFAULT_WORK_DAYS } = await import("../lib/dates");
const { listStaff, listProjects, listMissions, listWorkplans, listFieldUpdates, getPasswordHash, getStaff, getMission, getBtor, saveBtor, setPassword, replaceStaffWeek, plansBetween } = await import(
  "../lib/queries"
);
const { btorDocx } = await import("../lib/btor-doc");
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
assert(!(await verifyPassword("durani", await getPasswordHash("STF-02"))), "last name is no longer the password");
assert(!(await verifyPassword("samoon", await getPasswordHash("STF-11"))), "Samoon password was replaced");
assert(!(await verifyPassword("ahmadi", await getPasswordHash("STF-06"))), "Ahmadi password was replaced");
assert((await getPasswordHash("STF-02")).startsWith("scrypt$"), "password is hashed");
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
await replaceStaffWeek("STF-02", "2026-11-21", [
  {
    day: "2026-11-22",
    province: "Ghazni",
    location: "Ghazni city",
    activity: "site_visit",
    note: "Keep this day",
    projectIds: ["REV2-EWSSO"],
  },
]);
await replaceStaffWeek("STF-02", "2026-11-21", [
  {
    day: "2026-11-21",
    province: "Paktika",
    location: "Yousuf Khail",
    activity: "monitoring",
    note: "Updated Saturday only",
    projectIds: ["JICA-ALCC"],
  },
]);
const afterDay = await plansBetween("2026-11-21", "2026-11-26");
const saturday = afterDay.find((day) => day.staffId === "STF-02" && day.day === "2026-11-21");
const sunday = afterDay.find((day) => day.staffId === "STF-02" && day.day === "2026-11-22");
assert(saturday?.note === "Updated Saturday only" && saturday.projects.length === 1, "one day saved");
assert(sunday?.note === "Keep this day", "other day kept");
assert((await getStaff("STF-02"))!.sessionVersion >= 3, "password change ends other sessions");
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

await saveBtor(
  {
    missionId: "MIS-2026-1008",
    partnerName: "UNRT meeting Logar",
    staffText: "Dad Mohammad Samoon – Livelihood Field Officer",
    datesText: "8 Oct 2026",
    locationText: "Pul-e-Alam, Logar Province",
    objectives: "Represent UNDP at the Logar UNRT meeting.",
    activities: "Presented UNDP activities.",
    findings: "The Deputy Governor chaired the meeting.",
    challenges: "Reduced funding.",
    recommendations: "Follow up with UNAMA.",
    stakeholders: "Deputy Governor of Logar; UNAMA",
    pictures: "Cameras were not encouraged.",
  },
  "STF-11",
);
const report = await getBtor("MIS-2026-1008");
assert(report?.findings.includes("Deputy Governor"), "btor saved");
assert((await getMission("MIS-2026-1008"))?.btorDone === true, "btor marks the mission done");
const file = await btorDocx(report!);
assert(file.subarray(0, 2).toString() === "PK", "word file");

console.log("verify ok", { staff: staff.length, projects: projects.length, missions: missions.length, workplans: workplans.length });
}

main();
