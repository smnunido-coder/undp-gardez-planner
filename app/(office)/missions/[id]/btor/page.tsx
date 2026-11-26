import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Banner } from "@/components/banner";
import { BtorForm } from "@/components/btor-form";
import { Card } from "@/components/ui/card";
import { draftBtor } from "@/lib/btor-draft";
import { getBtor, getMission, listBtorPhotoMeta, listStaff } from "@/lib/queries";
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
  const [saved, staff, photos] = await Promise.all([getBtor(id), listStaff(), listBtorPhotoMeta(id)]);
  const report = saved ?? draftBtor(mission, staff);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href={`/missions/${mission.id}`} className="text-sm font-medium text-primary">
          Back to the mission
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">Back to office report</h1>
        <p className="text-sm text-muted-foreground">
          Enter the visit here. Download Word fills the UNDP field-visit template, including any photos.
        </p>
      </div>
      <Banner notice={one(query.notice)} error={one(query.error)} />
      <Card className="p-4">
        <BtorForm report={report} photos={photos} />
      </Card>
    </div>
  );
}
