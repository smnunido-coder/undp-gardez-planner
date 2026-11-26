import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { draftBtor } from "@/lib/btor-draft";
import { getBtor, getMission, listStaff } from "@/lib/queries";
import { one } from "@/lib/utils";

export const metadata = { title: "Back to office report" };

export default function BtorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the report…</p>}>
      <Report params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Report({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const mission = await getMission(id);
  if (!mission) notFound();
  const [saved, staff] = await Promise.all([getBtor(id), listStaff()]);
  const report = saved ?? draftBtor(mission, staff);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/missions/${mission.id}`} className="text-sm font-medium text-primary">
          Back to the mission
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">Back to office report</h1>
        <p className="text-sm text-muted-foreground">
          The same sections as the Gardez field-visit report. Saving fills a Word file you can download.
        </p>
      </div>
      <Banner notice={one(query.notice)} error={one(query.error)} />
      <Card className="p-4">
        <form action="/api/btor" method="post" className="space-y-4">
          <input type="hidden" name="missionId" value={mission.id} />
          <Field label="Partner name" name="partnerName" value={report.partnerName} />
          <Field label="Staff member(s)" name="staffText" value={report.staffText} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dates of visit" name="datesText" value={report.datesText} />
            <Field label="Location(s) visited" name="locationText" value={report.locationText} />
          </div>
          <Long label="Objectives / purpose of the visit" name="objectives" value={report.objectives} />
          <Long label="Key activities / outcomes of the visit" name="activities" value={report.activities} />
          <Long label="Key observations / findings" name="findings" value={report.findings} />
          <Long label="Key challenges" name="challenges" value={report.challenges} />
          <Long label="Recommendations" name="recommendations" value={report.recommendations} />
          <Long label="List of involved stakeholders (if any)" name="stakeholders" value={report.stakeholders} />
          <Long label="Pictures" name="pictures" value={report.pictures} hint="Say if photos were taken, or why there are none." />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="intent" value="save" size="lg">
              Save report
            </Button>
            <Button type="submit" name="intent" value="download" size="lg" variant="outline">
              Download Word
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input className={fieldClass} name={name} defaultValue={value} />
    </label>
  );
}

function Long({ label, name, value, hint }: { label: string; name: string; value: string; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {hint ? <span className="mb-1 block text-xs text-muted-foreground">{hint}</span> : null}
      <Textarea name={name} defaultValue={value} rows={6} />
    </label>
  );
}
