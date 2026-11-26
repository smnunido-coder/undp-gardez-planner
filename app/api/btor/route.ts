import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { btorDocx, btorFileName } from "@/lib/btor-doc";
import { getMission, saveBtor } from "@/lib/queries";
import type { BtorReport } from "@/lib/types";

function reportText(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\r\n/g, "\n").trim().slice(0, 20000);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const form = await request.formData();
  const missionId = reportText(form.get("missionId")).slice(0, 40);
  const back = (query: string) => NextResponse.redirect(new URL(`/missions/${missionId}/btor?${query}`, request.url), 303);
  const mission = missionId ? await getMission(missionId) : undefined;
  if (!mission) return NextResponse.redirect(new URL("/missions", request.url), 303);

  const report: BtorReport = {
    missionId,
    partnerName: reportText(form.get("partnerName")),
    staffText: reportText(form.get("staffText")),
    datesText: reportText(form.get("datesText")),
    locationText: reportText(form.get("locationText")),
    objectives: reportText(form.get("objectives")),
    activities: reportText(form.get("activities")),
    findings: reportText(form.get("findings")),
    challenges: reportText(form.get("challenges")),
    recommendations: reportText(form.get("recommendations")),
    stakeholders: reportText(form.get("stakeholders")),
    pictures: reportText(form.get("pictures")),
  };
  if (!report.partnerName || !report.staffText || !report.datesText || !report.locationText || !report.objectives) {
    return back("error=btor");
  }
  await saveBtor(report, user.id);
  if (form.get("intent") !== "download") return back("notice=btor");

  const bytes = await btorDocx(report);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${btorFileName(report)}"`,
      "Cache-Control": "no-store",
    },
  });
}
