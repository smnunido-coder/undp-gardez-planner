export type Staff = {
  id: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  active: boolean;
};

export type Project = {
  id: string;
  name: string;
  shortName: string;
  programme: string;
  partner: string;
  provinces: string[];
  status: string;
  windowText: string;
  startDate: string | null;
  endDate: string | null;
  budget: string;
  progress: string;
  ref: string;
  active: boolean;
};

export type PlanProject = {
  id: string;
  name: string;
  shortName: string;
  programme: string;
  partner: string;
  provinces: string[];
};

export type PlanDay = {
  id: string;
  staffId: string;
  day: string;
  weekStart: string;
  province: string;
  location: string;
  activity: string;
  note: string;
  projects: PlanProject[];
};

export type Mission = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  location: string;
  provinces: string[];
  purpose: string;
  btorDone: boolean;
  createdBy: string | null;
  projectIds: string[];
  staffIds: string[];
};

export type FieldUpdate = {
  kind: "mission" | "plan";
  date: string;
  endDate: string;
  title: string;
  place: string;
  status: string;
  detail: string;
  who: string;
  href: string;
  btorDone: boolean;
};

export type WorkplanItem = {
  id: string;
  partner: string;
  project: string;
  activity: string;
  startMonth: string;
  endMonth: string;
  status: string;
  progress: string;
  source: string;
};

export type DayDraft = {
  day: string;
  province: string;
  location: string;
  activity: string;
  note: string;
  projectIds: string[];
};
