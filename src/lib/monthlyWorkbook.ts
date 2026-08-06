import ExcelJS from "exceljs";
import sharp from "sharp";
import type { MonthlyExportData } from "@/lib/monthlyExport";

const HEADER_FILL = "1F4E78";
const BORDER_COLOR = "B7C9D6";

function secondsToExcelTime(seconds: number) {
  return seconds / 86_400;
}

function formatSeoulDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );
}

function addSheetTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
) {
  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 16,
  };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  sheet.getCell("A1").alignment = {
    vertical: "middle",
  };
  sheet.getRow(1).height = 28;

  if (subtitle) {
    sheet.mergeCells("A2:F2");
    sheet.getCell("A2").value = subtitle;
    sheet.getCell("A2").font = {
      color: { argb: "FF52616B" },
      size: 10,
    };
    sheet.getRow(2).height = 20;
  }
}

function styleTableHeader(row: ExcelJS.Row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  row.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  for (const cell of row.values as ExcelJS.CellValue[]) {
    if (typeof cell !== "object" || cell === null) {
      continue;
    }
  }
}

function addBorders(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  columnCount: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
      sheet.getCell(rowNumber, columnNumber).border = {
        top: { style: "thin", color: { argb: BORDER_COLOR } },
        left: { style: "thin", color: { argb: BORDER_COLOR } },
        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
        right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    }
  }
}

function finalizeTable(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  endRow: number,
  columnCount: number,
) {
  styleTableHeader(sheet.getRow(headerRow));
  addBorders(sheet, headerRow, endRow, columnCount);
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: endRow, column: columnCount },
  };
}

function addPngImage(workbook: ExcelJS.Workbook, image: Uint8Array) {
  return workbook.addImage({
    buffer: image as never,
    extension: "png",
  });
}

function formatChartDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function getStudentChartSheetName(
  studentName: string,
  usedNames: Set<string>,
) {
  const baseName = `${studentName} 기록차트`
    .replace(/[\\/:?*\[\]]/g, "")
    .slice(0, 31) || "학생 기록차트";
  let name = baseName;
  let index = 2;

  while (usedNames.has(name)) {
    const suffix = ` ${index}`;
    name = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }

  usedNames.add(name);
  return name;
}

async function createLineChartImage(
  title: string,
  rows: Array<{ label: string; value: number }>,
) {
  const width = 1100;
  const height = 500;
  const left = 170;
  const right = 60;
  const top = 80;
  const bottom = 90;
  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  const step = rows.length > 1 ? graphWidth / (rows.length - 1) : graphWidth;

  const points = rows
    .map((row, index) => {
      const x = left + step * index;
      const y = top + graphHeight - (row.value / maximum) * graphHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const labels = rows
    .filter(
      (_, index) => index === 0 || index === rows.length - 1 || index % 5 === 0,
    )
    .map((row) => {
      const originalIndex = rows.indexOf(row);
      const x = left + step * originalIndex;

      return `
        <text x="${x}" y="${height - 40}" text-anchor="middle"
          font-size="14" fill="#52616B">${escapeXml(row.label.includes("-") ? row.label.slice(5) : row.label)}</text>
      `;
    })
    .join("");

  const circles = rows
    .map((row, index) => {
      const x = left + step * index;
      const y = top + graphHeight - (row.value / maximum) * graphHeight;
      return `<circle cx="${x}" cy="${y}" r="4" fill="#2D7DD2" />`;
    })
    .join("");

  const yAxis = Array.from({ length: 5 }, (_, index) => {
    const value = maximum * (index / 4);
    const y = top + graphHeight - (value / maximum) * graphHeight;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#D8E0E6" stroke-width="1" />
      <text x="${left - 12}" y="${y + 5}" text-anchor="end" font-size="14" fill="#52616B">${formatChartDuration(value)}</text>`;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#FFFFFF" />
      <text x="${left}" y="42" font-size="26" font-weight="700" fill="#16324F">
        ${escapeXml(title)}
      </text>
      <line x1="${left}" y1="${top + graphHeight}" x2="${width - right}"
        y2="${top + graphHeight}" stroke="#AAB7C4" stroke-width="2" />
      ${yAxis}
      <polyline points="${points}" fill="none" stroke="#2D7DD2" stroke-width="4" />
      ${circles}
      ${labels}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function createCountChartImage(
  title: string,
  rows: Array<{ label: string; value: number }>,
) {
  const width = 1100;
  const height = 500;
  const left = 170;
  const right = 60;
  const top = 80;
  const bottom = 90;
  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  const barWidth = rows.length ? graphWidth / rows.length * 0.65 : graphWidth;
  const gap = rows.length ? graphWidth / rows.length : graphWidth;
  const bars = rows.map((row, index) => {
    const x = left + index * gap + (gap - barWidth) / 2;
    const barHeight = (row.value / maximum) * graphHeight;
    const y = top + graphHeight - barHeight;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#2563eb" />
      <text x="${x + barWidth / 2}" y="${height - 44}" text-anchor="middle" font-size="14" fill="#52616B">${escapeXml(row.label.slice(5))}</text>
      <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="14" fill="#263238">${row.value}</text>`;
  }).join("");
  const yAxis = Array.from({ length: 5 }, (_, index) => {
    const value = Math.round(maximum * (index / 4));
    const y = top + graphHeight - (value / maximum) * graphHeight;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#D8E0E6" stroke-width="1" />
      <text x="${left - 12}" y="${y + 5}" text-anchor="end" font-size="14" fill="#52616B">${value}회</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    <text x="${left}" y="42" font-size="26" font-weight="700" fill="#16324F">${escapeXml(title)}</text>
    <line x1="${left}" y1="${top + graphHeight}" x2="${width - right}" y2="${top + graphHeight}" stroke="#AAB7C4" stroke-width="2" />
    ${yAxis}
    ${bars}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function createMonthlyWorkbook(data: MonthlyExportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SKB Workbook";
  workbook.created = new Date();
  workbook.subject = `${data.periodKey} 수업 기록`;

  const summarySheet = workbook.addWorksheet("요약");
  addSheetTitle(
    summarySheet,
    `${data.periodKey} 수업 기록 요약`,
    "첨부파일 정보는 포함하지 않습니다.",
  );

  summarySheet.columns = [{ width: 22 }, { width: 18 }, { width: 22 }];

  summarySheet.addRow([]);
  summarySheet.addRow(["항목", "값"]);
  summarySheet.addRow(["제출 건수", data.summary.submissionCount]);
  summarySheet.addRow([
    "총 연습 시간",
    secondsToExcelTime(data.summary.totalDurationSeconds),
  ]);
  summarySheet.addRow(["학생 수", data.summary.studentCount]);
  summarySheet.addRow(["반 수", data.summary.classCount]);

  finalizeTable(summarySheet, 4, 8, 2);
  summarySheet.getCell("B6").numFmt = "[h]:mm:ss";

  const rawSheet = workbook.addWorksheet("원본 기록");
  addSheetTitle(rawSheet, `${data.periodKey} 원본 제출 기록`);

  rawSheet.columns = [
    { header: "제출 시각", width: 23 },
    { header: "반", width: 18 },
    { header: "학생", width: 15 },
    { header: "연습 목표", width: 22 },
    { header: "연습 시간", width: 15 },
    { header: "메모", width: 45 },
  ];

  rawSheet.getRow(3).values = [
    "제출 시각",
    "반",
    "학생",
    "연습 목표",
    "연습 시간",
    "메모",
  ];

  for (const submission of data.submissions) {
    rawSheet.addRow([
      formatSeoulDateTime(submission.submittedAt),
      submission.className,
      submission.studentName,
      submission.goalName,
      secondsToExcelTime(submission.durationSeconds),
      submission.memo ?? "",
    ]);
  }

  const rawEndRow = Math.max(3, rawSheet.rowCount);
  finalizeTable(rawSheet, 3, rawEndRow, 6);

  for (let row = 4; row <= rawEndRow; row += 1) {
    rawSheet.getCell(row, 5).numFmt = "[h]:mm:ss";
    rawSheet.getCell(row, 6).alignment = {
      vertical: "top",
      wrapText: true,
    };
  }

  const createSummarySheet = (
    name: string,
    title: string,
    firstColumnTitle: string,
    rows: Array<{
      label: string;
      submissionCount: number;
      totalDurationSeconds: number;
    }>,
  ) => {
    const sheet = workbook.addWorksheet(name);
    addSheetTitle(sheet, title);
    sheet.columns = [{ width: 24 }, { width: 15 }, { width: 18 }];

    sheet.getRow(3).values = [firstColumnTitle, "제출 건수", "총 연습 시간"];

    for (const row of rows) {
      sheet.addRow([
        row.label,
        row.submissionCount,
        secondsToExcelTime(row.totalDurationSeconds),
      ]);
    }

    const endRow = Math.max(3, sheet.rowCount);
    finalizeTable(sheet, 3, endRow, 3);

    for (let row = 4; row <= endRow; row += 1) {
      sheet.getCell(row, 3).numFmt = "[h]:mm:ss";
    }
  };

  createSummarySheet(
    "학생별 요약",
    `${data.periodKey} 학생별 요약`,
    "학생",
    data.studentSummaries.map((row) => ({
      label: row.studentName,
      submissionCount: row.submissionCount,
      totalDurationSeconds: row.totalDurationSeconds,
    })),
  );

  createSummarySheet(
    "목표별 요약",
    `${data.periodKey} 목표별 요약`,
    "연습 목표",
    data.goalSummaries.map((row) => ({
      label: row.goalName,
      submissionCount: row.submissionCount,
      totalDurationSeconds: row.totalDurationSeconds,
    })),
  );

  createSummarySheet(
    "반별 요약",
    `${data.periodKey} 반별 요약`,
    "반",
    data.classSummaries.map((row) => ({
      label: row.className,
      submissionCount: row.submissionCount,
      totalDurationSeconds: row.totalDurationSeconds,
    })),
  );

  const dailySheet = workbook.addWorksheet("일별 분석");
  addSheetTitle(dailySheet, `${data.periodKey} 일별 분석`);
  dailySheet.columns = [{ width: 18 }, { width: 15 }, { width: 18 }];

  dailySheet.getRow(3).values = ["날짜", "제출 건수", "총 연습 시간"];

  for (const row of data.dailySummaries) {
    dailySheet.addRow([
      row.dateKey,
      row.submissionCount,
      secondsToExcelTime(row.totalDurationSeconds),
    ]);
  }

  const dailyEndRow = Math.max(3, dailySheet.rowCount);
  finalizeTable(dailySheet, 3, dailyEndRow, 3);

  for (let row = 4; row <= dailyEndRow; row += 1) {
    dailySheet.getCell(row, 3).numFmt = "[h]:mm:ss";
  }

  const usedChartSheetNames = new Set<string>([
    "요약",
    "원본 기록",
    "학생별 요약",
    "목표별 요약",
    "반별 요약",
    "일별 분석",
  ]);

  for (const student of data.studentCharts) {
    const chartSheet = workbook.addWorksheet(
      getStudentChartSheetName(student.studentName, usedChartSheetNames),
    );
    addSheetTitle(
      chartSheet,
      `${data.periodKey} ${student.studentName} 기록 차트`,
      "기록 분석 탭의 학생별 추이 차트입니다.",
    );
    chartSheet.getColumn(1).width = 16;

    const [trendChart, dailyChart, countChart] = await Promise.all([
      createLineChartImage(
        `${student.studentName} 최근 10회 연습 시간 추이`,
        student.recentSubmissions.map((row, index) => ({
          label: `${index + 1}회`,
          value: row.durationSeconds,
        })),
      ),
      createLineChartImage(
        `${student.studentName} 일별 총 연습시간`,
        student.daily.map((row) => ({ label: row.dateKey, value: row.totalDurationSeconds })),
      ),
      createCountChartImage(
        `${student.studentName} 일별 제출 횟수`,
        student.daily.map((row) => ({ label: row.dateKey, value: row.submissionCount })),
      ),
    ]);
    chartSheet.addImage(addPngImage(workbook, trendChart), { tl: { col: 0, row: 3 }, ext: { width: 880, height: 400 } });
    chartSheet.addImage(addPngImage(workbook, dailyChart), { tl: { col: 0, row: 31 }, ext: { width: 880, height: 400 } });
    chartSheet.addImage(addPngImage(workbook, countChart), { tl: { col: 0, row: 59 }, ext: { width: 880, height: 400 } });
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
