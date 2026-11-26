import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { BtorReport } from "@/lib/types";

const NAVY = "003865";
const LINE = { style: BorderStyle.SINGLE, size: 4, color: "8AA0B3" };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };

function lines(text: string, bold = false): Paragraph[] {
  const parts = (text || "—").replace(/\r\n/g, "\n").split("\n");
  return parts.map(
    (line) =>
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: line || " ", bold, font: "Calibri", size: 21, color: "1C2834" })],
      }),
  );
}

function labelCell(text: string): TableCell {
  return new TableCell({
    width: { size: 3200, type: WidthType.DXA },
    borders: BORDERS,
    shading: { fill: "E7F2FB" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: lines(text, true),
  });
}

function valueCell(text: string): TableCell {
  return new TableCell({
    width: { size: 6400, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: lines(text),
  });
}

function reportRow(label: string, value: string): TableRow {
  return new TableRow({ cantSplit: false, children: [labelCell(label), valueCell(value)] });
}

export function btorFileName(report: BtorReport): string {
  const title = report.partnerName.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "mission";
  const date = report.datesText.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "date";
  return `BTOR_${title}_${date}.docx`;
}

export async function btorDocx(report: BtorReport): Promise<Buffer> {
  const header = new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "United Nations Development Programme",
            bold: true,
            font: "Calibri",
            size: 28,
            color: NAVY,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: "Field Visit / Monitoring Report", font: "Calibri", size: 22, color: NAVY })],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: "UNDP Country Office, UNOCA Complex, Jalalabad Rd, Kabul, Afghanistan",
            font: "Calibri",
            size: 14,
            color: "5C6B7A",
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "registry.af@undp.org  ·  www.af.undp.org",
            font: "Calibri",
            size: 14,
            color: "5C6B7A",
          }),
        ],
      }),
    ],
  });
  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 900, left: 900, right: 900 } },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Back to office report", bold: true, font: "Calibri", size: 32, color: NAVY }),
            ],
          }),
          new Table({
            width: { size: 9600, type: WidthType.DXA },
            columnWidths: [3200, 6400],
            rows: [
              reportRow("Partner name", report.partnerName),
              reportRow("Staff member(s)", report.staffText),
              reportRow("Dates of visit", report.datesText),
              reportRow("Location(s) visited", report.locationText),
              reportRow("Objectives / purpose of the visit", report.objectives),
              reportRow("Key activities / outcomes of the visit", report.activities),
              reportRow("Key observations / findings", report.findings),
              reportRow("Key challenges", report.challenges),
              reportRow("Recommendations", report.recommendations),
              reportRow("List of involved stakeholders (if any)", report.stakeholders),
              reportRow("Pictures", report.pictures),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
