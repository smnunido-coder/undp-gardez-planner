# Gardez field planner

Shared weekly planner for the UNDP South-East field office in Gardez. Staff sign in with their last name, file a Saturday–Thursday plan (one or more projects per day), and everyone can see the week on the dashboard. The same app holds the project list, the mission log, and partner workplans.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

The first request creates `data/gardez.db` (SQLite, via libSQL) and loads the office lists: 12 staff, 24 projects, the mission log, and the partner workplan bars. That file is gitignored. `npm run db:seed` opens the same database and prints the row counts. `npm run verify` checks sign-in matching, the Afghan week, and a two-project day against a temporary database.

Sign in with the last word of your name and a password, for example `Durani`, `Yarghal`, `Ludin`, `Ahmadi`, or `Samoon`. `Samoon` is Dad Mohammad Samoon (admin). Sayed Samoon Ahmadi signs in as `Ahmadi`. A password can be anything, of any length. Changing a password signs that person out of other phones. The browser keeps an httpOnly cookie for 60 days.

No personal emails or phone numbers are stored.

## Deploy on Vercel + Turso

SQLite on the Vercel filesystem does not keep writes. Production uses [Turso](https://turso.tech), which speaks the same SQLite dialect.

1. Create a database and a token:

   ```bash
   turso db create undp-gardez
   turso db show undp-gardez --url
   turso db tokens create undp-gardez
   ```

2. Generate a session secret:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. In the Vercel project (framework preset: Next.js), set:

   | Name | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | the `libsql://…` URL |
   | `TURSO_AUTH_TOKEN` | the token |
   | `SESSION_SECRET` | the hex string |

   Copy the names from `.env.example`. Do not commit real values.

4. Import this git repository and deploy. The first visit creates the tables and loads the seed lists into Turso. Later visits do not overwrite staff, projects, plans, or missions that already exist.

5. Optional check from your machine, with the same three variables exported:

   ```bash
   npm run db:seed
   ```

`next build` and `next start` also require `SESSION_SECRET` once `NODE_ENV` is `production`.

## What staff can do

- **Dashboard.** Staff × day grid for the selected week, filters (week, staff, project, programme, province), staff-day counts, who is in the field today (site visit, monitoring, or travel), earlier weeks, CSV and Excel export.
- **My week.** For each working day, tick one or more projects, and optionally set province, district, activity (site visit, monitoring, meeting, office work, travel), and a note. Each day saves on its own. Current and upcoming weeks can be edited. An admin can file any colleague's week, including past weeks.
- **Projects.** The 24 seeded projects, with programme, partner, provinces, status, dates, budget, and progress.
- **Map.** The same projects as pins on the South-East provinces. Open a pin for the full project record and the latest mission or weekly-plan note. The map is drawn in the page, with no map-tile download.
- **Missions.** Log of trips. Anyone signed in can add or edit dates, location, projects, travellers, purpose, status, and whether the BTOR is done. Open a mission and write the back-to-office report. Download makes a Word file with the same sections as the Gardez field-visit report.
- **Workplans.** Partner activities as a month-by-month bar chart.
- **Password.** Each person can change their own password. It can be any text, of any length. An admin can set anyone's password from the staff form. Leave that box blank to keep the current password.
- **Admin** (Samoon, or anyone else marked admin). Add or edit staff and projects, and change which days count as the work week. Default is Saturday–Thursday.

If two active staff share a last name, sign-in shows a list of full names.

## Decisions

- Last name plus a password, and a 60-day cookie. Passwords are stored as a salted hash. There is no length or character rule. The cookie also carries a session number, so changing a password signs out phones that were already in.
- English UI, UNDP blue (`#0468b1` / `#003865`), system fonts, server-rendered pages, and no chart or map-tile library, so the pages stay small on a slow connection.
- Map pins sit on the province. The office list records provinces, not GPS points for each site.
- One SQLite schema for laptop and Turso. Dates use the Asia/Kabul calendar.
- “In the field today” means the activity is a site visit, monitoring, or travel.
- A project staff-day is one person including that project on one day. A province staff-day is one person on one day, using the province they set (or, if they left it blank, a province on the chosen project).
- The 25 November 2026 Ghazni EWSSO visit is pre-filled on Samoon’s week from the mission log. Other staff weeks start empty.
