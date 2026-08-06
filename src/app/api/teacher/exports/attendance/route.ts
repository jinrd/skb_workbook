import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAttendanceWorkbook } from "@/lib/attendanceWorkbook";

export const runtime = "nodejs";

const requestSchema = z.object({ periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

function getMonthRange(periodKey: string) {
  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: new Date(`${periodKey}-01T00:00:00+09:00`),
    end: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`),
  };
}

export async function POST(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "내보내기 기간 형식이 올바르지 않습니다." }, { status: 400 });
    const { start, end } = getMonthRange(parsed.data.periodKey);
    const attendances = await prisma.studentAttendance.findMany({
      where: {
        entryAt: { gte: start, lt: end },
        ...(session.role === "ADMIN" ? {} : { class: { teacherId: session.teacherId } }),
      },
      select: { entryAt: true, exitAt: true, exitSource: true, class: { select: { name: true } }, student: { select: { name: true } } },
      orderBy: [{ entryAt: "asc" }, { studentId: "asc" }],
    });
    const workbook = await createAttendanceWorkbook({
      periodKey: parsed.data.periodKey,
      attendances: attendances.map((attendance) => ({ ...attendance, className: attendance.class.name, studentName: attendance.student.name })),
    });
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`SKB_출석기록_${parsed.data.periodKey}.xlsx`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Attendance export failed:", error);
    return NextResponse.json({ error: "출석 엑셀 파일을 만드는 중 문제가 발생했습니다." }, { status: 500 });
  }
}
