export const NOTICES: Record<string, string> = {
  plan: "Week saved. The dashboard now shows this plan to the whole office.",
  day: "Day saved. The dashboard now shows it to the whole office.",
  btor: "Back to office report saved.",
  week: "Work week saved. New plans use these days.",
  staff: "Staff list saved.",
  password: "Password saved.",
  project: "Project saved.",
  mission: "Mission saved.",
  "mission-deleted": "Mission removed from the log.",
};

export const ERRORS: Record<string, string> = {
  days: "Choose at least one working day.",
  "last-admin": "Keep at least one active admin. Add another admin before changing this one.",
  name: "Enter the person's full name.",
  project: "Name, short name, programme, partner, status, and at least one province are required.",
  dates: "The end date is before the start date.",
  closed: "That week is closed. You can edit the current week and later weeks.",
  week: "That week does not match the office calendar.",
  mission: "Add a title, dates, a status, and a short purpose.",
  empty: "Type your last name.",
  password: "That password does not match.",
  "password-needed": "Type a password for this person. Any text is fine.",
  btor: "Add the partner, staff, dates, location, and purpose before saving the report.",
  none: "No one on the staff list has that last name.",
  inactive: "That name is inactive. Ask Samoon to turn it back on.",
  database: "The site cannot reach the database yet. The Turso address and token need to be saved, then the site deployed again.",
};
