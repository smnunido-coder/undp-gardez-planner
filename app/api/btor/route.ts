import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { btorDocx, btorFileName } from "@/lib/btor-doc";
import { getMission, listBtorPhotos, replaceBtorPhotos, saveBtor } from "@/lib/queries";
import type { BtorReport } from "@/lib/types";

const MAX_PHOTOS = 8;
const MAX_BYTES = 2_000_000;

function reportText(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\r\n/g, "\n").trim().slice(0, 20000);
}

function json(body: { redirect?: string; message?: string }, status = 200) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const form = await request.formData();
  const missionId = reportText(form.get("missionId")).slice(0, 40);
  const page = `/missions/${missionId}/btor`;
  const mission = missionId ? await getMission(missionId) : undefined;
  if (!mission) return json({ redirect: "/missions" });

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
    return json({ message: "Add the partner, staff, dates, location, and purpose before saving the report." }, 400);
  }

  const keepIds = form.getAll("keepPhoto").map((value) => reportText(value).slice(0, 80)).filter(Boolean);
  const added: { name: string; bytes: Uint8Array }[] = [];
  for (const entry of form.getAll("photos")) {
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (!entry.type.startsWith("image/") || entry.size > MAX_BYTES) {
      return json({ message: "Each photo needs to be a picture the phone can send. Try again with fewer photos." }, 400);
    }
    added.push({ name: entry.name.slice(0, 120) || "photo.jpg", bytes: new Uint8Array(await entry.arrayBuffer()) });
  }
  if (keepIds.length + added.length > MAX_PHOTOS) {
    return json({ message: "Add up to 8 photos." }, 400);
  }

  await saveBtor(report, user.id);
  await replaceBtorPhotos(missionId, keepIds, added);
  if (form.get("intent") !== "download") return json({ redirect: `${page}?notice=btor` });

  const photos = await listBtorPhotos(missionId);
  const bytes = await btorDocx(report, photos);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${btorFileName(report)}"`,
      "Cache-Control": "no-store",
    },
  });
}
