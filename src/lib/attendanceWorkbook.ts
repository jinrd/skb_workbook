import ExcelJS from "exceljs";

const HEADER_FILL = "1F4E78";
const BORDER_COLOR = "B7C9D6";

type AttendanceExportData = {
  periodKey: string;
  attendances: Array<{
    entryAt: Date;
    exitAt: Date | null;
    exitSource: string | null;
    className: string;
    studentName: string;
  }>;
};

function formatSeoulDateTime(value: Date | null) {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, subtitle?: string) {
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  sheet.getRow(1).height = 28;
  if (subtitle) {
    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = subtitle;
    sheet.getCell("A2").font = { color: { argb: "FF52616B" }, size: 10 };
  }
}

function finishTable(sheet: ExcelJS.Worksheet, headerRow: number, endRow: number, columnCount: number) {
  const header = sheet.getRow(headerRow);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { horizontal: "center", vertical: "middle" };
  for (let row = headerRow; row <= endRow; row += 1) {
    for (let column = 1; column <= columnCount; column += 1) {
      sheet.getCell(row, column).border = {
        top: { style: "thin", color: { argb: BORDER_COLOR } },
        left: { style: "thin", color: { argb: BORDER_COLOR } },
        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
        right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    }
  }
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: endRow, column: columnCount } };
}

export async function createAttendanceWorkbook(data: AttendanceExportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SKB Workbook";
  workbook.subject = `${data.periodKey} 출석 기록`;

  const summary = workbook.addWorksheet("학생별 요약");
  addTitle(summary, `${data.periodKey} 출석 기록 요약`, "입실과 퇴실 시각은 한국 시간 기준입니다.");
  summary.columns = [{ width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }];
  summary.getRow(3).values = ["학생", "출석 횟수", "퇴실 완료", "미퇴실"];
  const studentMap = new Map<string, { count: number; completed: number }>();
  for (const attendance of data.attendances) {
    const current = studentMap.get(attendance.studentName) ?? { count: 0, completed: 0 };
    current.count += 1;
    if (attendance.exitAt) current.completed += 1;
    studentMap.set(attendance.studentName, current);
  }
  for (const [studentName, value] of [...studentMap.entries()].sort((a, b) => a[0].localeCompare(b[0], "ko"))) {
    summary.addRow([studentName, value.count, value.completed, value.count - value.completed]);
  }
  finishTable(summary, 3, Math.max(3, summary.rowCount), 4);

  const raw = workbook.addWorksheet("출석 원본 기록");
  addTitle(raw, `${data.periodKey} 출석 원본 기록`);
  raw.columns = [
    { width: 23 }, { width: 23 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 16 },
  ];
  raw.getRow(3).values = ["입실 시각", "퇴실 시각", "반", "학생", "체류 시간", "퇴실 방식"];
  for (const attendance of data.attendances) {
    const staySeconds = attendance.exitAt
      ? Math.max(0, Math.floor((attendance.exitAt.getTime() - attendance.entryAt.getTime()) / 1000))
      : null;
    raw.addRow([
      formatSeoulDateTime(attendance.entryAt),
      formatSeoulDateTime(attendance.exitAt),
      attendance.className,
      attendance.studentName,
      staySeconds === null ? "" : staySeconds / 86400,
      attendance.exitAt ? (attendance.exitSource === "MANUAL" ? "직접" : "자동") : "미퇴실",
    ]);
  }
  finishTable(raw, 3, Math.max(3, raw.rowCount), 6);
  for (let row = 4; row <= raw.rowCount; row += 1) raw.getCell(row, 5).numFmt = "[h]:mm:ss";

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
