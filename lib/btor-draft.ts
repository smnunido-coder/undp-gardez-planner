import { formatDate } from "@/lib/dates";
import type { BtorReport, Mission, Staff } from "@/lib/types";

export function draftBtor(mission: Mission, staff: Staff[]): BtorReport {
  const people = mission.staffIds
    .map((id) => staff.find((person) => person.id === id))
    .filter((person): person is Staff => Boolean(person));
  const staffText = people
    .map((person) => (person.role ? `${person.fullName} – ${person.role}` : person.fullName))
    .join("; ");
  const datesText =
    mission.endDate && mission.endDate !== mission.startDate
      ? `${formatDate(mission.startDate)} – ${formatDate(mission.endDate)}`
      : formatDate(mission.startDate);
  const locationText = [mission.location, mission.provinces.join(", ")].filter(Boolean).join(", ");
  return {
    missionId: mission.id,
    partnerName: mission.title,
    staffText,
    datesText,
    locationText,
    objectives: mission.purpose,
    activities: "",
    findings: "",
    challenges: "",
    recommendations: "",
    stakeholders: "",
    pictures: "",
  };
}
