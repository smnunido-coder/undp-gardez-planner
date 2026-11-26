import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import type { BtorPhoto, BtorReport } from "@/lib/types";

const TEMPLATE = join(process.cwd(), "templates", "undp-btor.docx");
const RUN =
  '<w:rPr><w:rFonts w:ascii="Proxima Nova" w:hAnsi="Proxima Nova" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text: string): string {
  return `<w:p><w:pPr>${RUN}</w:pPr><w:r>${RUN}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function textBlock(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return (lines.length ? lines : [""]).map((line) => paragraph(line)).join("");
}

function cellSpans(row: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let index = 0;
  while (index < row.length) {
    const start = row.indexOf("<w:tc", index);
    if (start < 0) break;
    const end = row.indexOf("</w:tc>", start);
    if (end < 0) break;
    spans.push([start, end + "</w:tc>".length]);
    index = end + "</w:tc>".length;
  }
  return spans;
}

function replaceCellBody(cell: string, body: string): string {
  const marker = "</w:tcPr>";
  const at = cell.indexOf(marker);
  if (at < 0) return cell;
  return `${cell.slice(0, at + marker.length)}${body}</w:tc>`;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 1),
        width: ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 1),
      };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return { width: 1200, height: 800 };
}

function imageParagraph(index: number, relId: string, bytes: Uint8Array): string {
  const size = jpegSize(bytes);
  const pixelToEmu = 9525;
  const maxWidth = 6_200_000;
  const maxHeight = 4_200_000;
  const scale = Math.min(maxWidth / (size.width * pixelToEmu), maxHeight / (size.height * pixelToEmu), 1);
  const cx = Math.max(1, Math.round(size.width * pixelToEmu * scale));
  const cy = Math.max(1, Math.round(size.height * pixelToEmu * scale));
  const id = 80 + index;
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="120000" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Photo ${index + 1}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="photo-${index + 1}.jpg"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function photoRow(photos: BtorPhoto[]): string {
  const pictures = photos
    .map((photo, index) => imageParagraph(index, `rIdPhoto${index + 1}`, photo.bytes))
    .join("");
  return `<w:tr><w:tc><w:tcPr><w:tcW w:w="10980" w:type="dxa"/><w:gridSpan w:val="3"/></w:tcPr>${pictures}</w:tc></w:tr>`;
}

export function btorFileName(report: BtorReport): string {
  const title = report.partnerName.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "mission";
  const date = report.datesText.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "date";
  return `BTOR_${title}_${date}.docx`;
}

export async function btorDocx(report: BtorReport, photos: BtorPhoto[] = []): Promise<Buffer> {
  const zip = await JSZip.loadAsync(await readFile(TEMPLATE));
  let xml = await zip.file("word/document.xml")!.async("string");
  const values = [
    report.partnerName,
    report.staffText,
    report.datesText,
    report.locationText,
    report.objectives,
    report.activities,
    report.findings,
    report.challenges,
    report.recommendations,
    report.stakeholders,
  ];
  const rows = xml.split(/(?=<w:tr[\s>])/);
  let valueIndex = 0;
  let phase: "values" | "note" | "done" = "values";
  const filled = rows.map((row) => {
    if (!row.startsWith("<w:tr")) return row;
    const spans = cellSpans(row);
    if (phase === "values" && spans.length >= 2 && valueIndex < values.length) {
      const [start, end] = spans[1]!;
      const updated = `${row.slice(0, start)}${replaceCellBody(row.slice(start, end), textBlock(values[valueIndex] ?? ""))}${row.slice(end)}`;
      valueIndex += 1;
      if (valueIndex === values.length) phase = "note";
      return updated;
    }
    if (phase === "note" && row.includes(">PICTURES<")) return row;
    if (phase === "note" && spans.length >= 1) {
      const [start, end] = spans[0]!;
      phase = "done";
      return `${row.slice(0, start)}${replaceCellBody(row.slice(start, end), textBlock(report.pictures.trim()))}${row.slice(end)}`;
    }
    return row;
  });
  xml = filled.join("");
  if (photos.length) {
    xml = xml.replace("</w:tbl>", `${photoRow(photos)}</w:tbl>`);
    if (!xml.includes("xmlns:pic=")) {
      xml = xml.replace("<w:document ", '<w:document xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ');
    }
  }
  zip.file("word/document.xml", xml);

  const relsPath = "word/_rels/document.xml.rels";
  let rels = await zip.file(relsPath)!.async("string");
  for (const [index, photo] of photos.entries()) {
    const media = `media/btor-photo-${index + 1}.jpg`;
    zip.file(`word/${media}`, photo.bytes);
    const tag = `<Relationship Id="rIdPhoto${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${media}"/>`;
    rels = rels.replace("</Relationships>", `${tag}</Relationships>`);
  }
  zip.file(relsPath, rels);

  if (photos.length) {
    const typesPath = "[Content_Types].xml";
    let types = await zip.file(typesPath)!.async("string");
    if (!types.includes('Extension="jpeg"') && !types.includes('Extension="jpg"')) {
      types = types.replace(
        "<Types ",
        '<Types ',
      ).replace(
        "</Types>",
        '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/></Types>',
      );
    }
    zip.file(typesPath, types);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
