import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { saveProjectAction, saveStaffAction, saveWorkWeek } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { AFGHAN_WEEK, dayLabel, workDaySentence } from "@/lib/dates";
import { PROVINCES, PROJECT_STATUSES } from "@/lib/labels";
import { displayLastName } from "@/lib/names";
import { getProject, getStaff, getWorkDays, listProjects, listStaff } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Admin" };

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading admin…</p>}>
      <Admin searchParams={searchParams} />
    </Suspense>
  );
}

async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [workDays, staff, projects] = await Promise.all([getWorkDays(), listStaff(), listProjects()]);
  const staffKey = one(params.staff);
  const projectKey = one(params.project);
  const editingStaff = staffKey && staffKey !== "new" ? await getStaff(staffKey) : undefined;
  const editingProject = projectKey && projectKey !== "new" ? await getProject(projectKey) : undefined;
  const programmes = [...new Set(projects.map((project) => project.programme))];
  const partners = [...new Set(projects.map((project) => project.partner))];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Staff, projects, and the office work week. A password can be anything. Leave the box blank to keep the current one.
        </p>
      </div>
      <Banner notice={one(params.notice)} error={one(params.error)} />

      <Card className="p-4">
        <h2 className="font-semibold text-navy">Work week</h2>
        <p className="mt-1 text-sm text-muted-foreground">{workDaySentence(workDays)}</p>
        <form action={saveWorkWeek} className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {AFGHAN_WEEK.map((day) => (
              <label key={day} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" name="day" value={day} defaultChecked={workDays.includes(day)} className="size-5 accent-primary" />
                {dayLabel(day)}
              </label>
            ))}
          </div>
          <Button type="submit">Save work week</Button>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-navy">Staff</h2>
          <a href="/admin?staff=new" className="text-sm font-medium text-primary underline">
            Add staff
          </a>
        </div>
        {staffKey ? (
          <form action={saveStaffAction} className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
            {editingStaff ? <input type="hidden" name="id" value={editingStaff.id} /> : null}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Full name</span>
              <input className={fieldClass} name="fullName" required defaultValue={editingStaff?.fullName ?? ""} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Role</span>
              <input className={fieldClass} name="role" defaultValue={editingStaff?.role ?? ""} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Password</span>
              <input
                className={fieldClass}
                name="password"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={editingStaff ? "Leave blank to keep the current password" : "Type any password"}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isAdmin" value="1" defaultChecked={editingStaff?.isAdmin ?? false} className="size-5 accent-primary" />
              Admin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" value="1" defaultChecked={editingStaff?.active ?? true} className="size-5 accent-primary" />
              Active
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Save staff</Button>
            </div>
          </form>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th>Role</th>
                <th>Signs in as</th>
                <th>Admin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <tr key={person.id} className="border-t border-border">
                  <td className="py-2 pr-2">
                    {person.fullName}
                    {!person.active ? <span className="ml-2 text-xs text-muted-foreground">Inactive</span> : null}
                  </td>
                  <td className="pr-2 text-muted-foreground">{person.role || "—"}</td>
                  <td>{displayLastName(person.fullName)}</td>
                  <td>{person.isAdmin ? "Yes" : ""}</td>
                  <td className="text-right">
                    <a href={`/admin?staff=${person.id}`} className="text-primary underline">
                      Edit
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-navy">Projects</h2>
          <a href="/admin?project=new" className="text-sm font-medium text-primary underline">
            Add project
          </a>
        </div>
        {projectKey ? (
          <form action={saveProjectAction} className="mt-3 grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
            {editingProject ? <input type="hidden" name="id" value={editingProject.id} /> : null}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Name</span>
              <input className={fieldClass} name="name" required defaultValue={editingProject?.name ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Short name</span>
              <input className={fieldClass} name="shortName" required maxLength={40} defaultValue={editingProject?.shortName ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Status</span>
              <input className={fieldClass} name="status" required list="statuses" defaultValue={editingProject?.status ?? "Planned"} />
              <datalist id="statuses">
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Programme</span>
              <input className={fieldClass} name="programme" required list="programmes" defaultValue={editingProject?.programme ?? ""} />
              <datalist id="programmes">
                {programmes.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Partner</span>
              <input className={fieldClass} name="partner" required list="partners" defaultValue={editingProject?.partner ?? ""} />
              <datalist id="partners">
                {partners.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Provinces</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROVINCES.map((province) => (
                  <label key={province} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="province"
                      value={province}
                      defaultChecked={editingProject?.provinces.includes(province) ?? false}
                      className="size-4 accent-primary"
                    />
                    {province}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Start</span>
              <input className={fieldClass} type="date" name="startDate" defaultValue={editingProject?.startDate ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">End</span>
              <input className={fieldClass} type="date" name="endDate" defaultValue={editingProject?.endDate ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Window label</span>
              <input className={fieldClass} name="windowText" defaultValue={editingProject?.windowText ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Budget</span>
              <input className={fieldClass} name="budget" defaultValue={editingProject?.budget ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Progress</span>
              <input className={fieldClass} name="progress" placeholder="66.0%" defaultValue={editingProject?.progress ?? ""} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Reference</span>
              <input className={fieldClass} name="ref" defaultValue={editingProject?.ref ?? ""} />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="active" value="1" defaultChecked={editingProject?.active ?? true} className="size-5 accent-primary" />
              Show in weekly plans
            </label>
            <div>
              <Button type="submit">Save project</Button>
            </div>
          </form>
        ) : null}
        <ul className="mt-3 divide-y divide-border text-sm">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{project.shortName}</span>
                <span className="block text-xs text-muted-foreground">
                  {project.programme} · {project.status}
                  {!project.active ? " · Hidden" : ""}
                </span>
              </span>
              <a href={`/admin?project=${project.id}`} className="shrink-0 text-primary underline">
                Edit
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
