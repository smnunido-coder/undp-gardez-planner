"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BtorReport } from "@/lib/types";

const MAX_PHOTOS = 8;

async function shrink(file: File): Promise<File> {
  try {
    return await shrinkImage(file);
  } catch {
    return file;
  }
}

async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const edge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1600 / edge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) return file;
  const name = file.name.replace(/\.\w+$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}

export function BtorForm({
  report,
  photos,
}: {
  report: BtorReport;
  photos: { id: string; name: string }[];
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function submit(intent: "save" | "download") {
    const formElement = document.getElementById("btor-form");
    if (!(formElement instanceof HTMLFormElement)) return;
    setBusy(intent);
    setMessage("");
    try {
      const body = new FormData(formElement);
      body.set("intent", intent);
      const picked = formElement.elements.namedItem("photos");
      body.delete("photos");
      const files = picked instanceof HTMLInputElement && picked.files ? Array.from(picked.files) : [];
      const kept = body.getAll("keepPhoto").length;
      if (kept + files.length > MAX_PHOTOS) {
        setMessage(`Add up to ${MAX_PHOTOS} photos.`);
        return;
      }
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setMessage("Choose photo files only.");
          return;
        }
        body.append("photos", await shrink(file), file.name.replace(/\.\w+$/, "") + ".jpg");
      }
      const response = await fetch("/api/btor", { method: "POST", body });
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const data = (await response.json()) as { redirect?: string; message?: string };
        if (data.redirect) {
          window.location.href = data.redirect;
          return;
        }
        setMessage(data.message || "The report could not be saved.");
        return;
      }
      if (!response.ok) {
        setMessage("The report could not be saved.");
        return;
      }
      const blob = await response.blob();
      const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = match?.[1] || "BTOR.docx";
      link.click();
      URL.revokeObjectURL(url);
      window.location.href = `/missions/${report.missionId}/btor?notice=btor`;
    } catch {
      setMessage("The report could not be saved. Try fewer or smaller photos.");
    } finally {
      setBusy("");
    }
  }

  return (
    <form id="btor-form" className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      <input type="hidden" name="missionId" value={report.missionId} />
      {message ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {message}
        </p>
      ) : null}
      <Field label="Partner Name" name="partnerName" value={report.partnerName} />
      <Field label="Staff member (s)" name="staffText" value={report.staffText} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dates of Visit" name="datesText" value={report.datesText} />
        <Field label="Location (s) visited" name="locationText" value={report.locationText} />
      </div>
      <Long label="Objectives / Purpose of the visit" name="objectives" value={report.objectives} />
      <Long label="Key Activities/ Outcomes of the visit" name="activities" value={report.activities} />
      <Long label="Key Observations/ Findings" name="findings" value={report.findings} />
      <Long label="Key Challenges" name="challenges" value={report.challenges} />
      <Long label="Recommendations" name="recommendations" value={report.recommendations} />
      <Long label="List of involved stakeholders (If any)" name="stakeholders" value={report.stakeholders} />
      <Long label="Picture note" name="pictures" value={report.pictures} hint="A line under PICTURES, such as what the photos show." />
      <div className="space-y-2 text-sm">
        <span className="block font-medium">Photos</span>
        <p className="text-xs text-muted-foreground">Up to {MAX_PHOTOS}. They are placed in the PICTURES section of the Word file.</p>
        {photos.length ? (
          <ul className="space-y-2">
            {photos.map((photo) => (
              <li key={photo.id} className="flex items-center gap-3">
                <img src={`/api/btor/photo/${photo.id}`} alt={photo.name} className="h-16 w-16 rounded border border-border object-cover" />
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="keepPhoto" value={photo.id} defaultChecked className="size-5 accent-primary" />
                  Keep {photo.name}
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <input name="photos" type="file" accept="image/*" multiple capture="environment" className="block w-full text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" disabled={busy !== ""} onClick={() => submit("save")}>
          {busy === "save" ? "Saving…" : "Save report"}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={busy !== ""} onClick={() => submit("download")}>
          {busy === "download" ? "Preparing the Word file…" : "Download Word"}
        </Button>
      </div>
    </form>
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
