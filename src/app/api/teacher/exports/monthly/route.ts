import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeacherSession } from "@/lib/auth";
import { getMonthlyExportData } from "@/lib/monthlyExport";
import { createMonthlyWorkbook } from "@/lib/monthlyWorkbook";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const requestSchema = z.object({
  periodKey: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

function getPreviousMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const currentYear = Number(values.year);
  const currentMonth = Number(values.month);
  const year = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = currentMonth === 1 ? 12 : currentMonth - 1;

  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function POST(request: Request) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => ({}));

    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "내보내기 기간 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const periodKey = parsed.data.periodKey ?? getPreviousMonthKey();
    const data = await getMonthlyExportData(session, periodKey);

    const fileCount = await prisma.submissionFile.count({
      where: {
        isDeleted: false,
        submission: {
          submittedAt: {
            gte: data.periodStart,
            lt: data.periodEnd,
          },
          ...(session.role === "ADMIN"
            ? {}
            : {
                class: {
                  teacherId: session.teacherId,
                },
              }),
        },
      },
    });

    const scopeKey = session.role === "ADMIN" ? "ALL" : session.teacherId;

    await prisma.monthlyExportLog.upsert({
      where: {
        periodKey_scopeKey: {
          periodKey,
          scopeKey,
        },
      },
      create: {
        periodKey,
        scopeKey,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        submissionCount: data.summary.submissionCount,
        fileCount,
        status: "GENERATED",
      },
      update: {
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        submissionCount: data.summary.submissionCount,
        fileCount,
        status: "GENERATED",
        generatedAt: new Date(),
        errorMessage: null,
      },
    });

    const workbook = await createMonthlyWorkbook(data);
    const fileName = `SKB_수업기록_${periodKey}.xlsx`;

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Monthly export failed:", error);

    return NextResponse.json(
      { error: "엑셀 파일을 만드는 중 문제가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => ({}));

    const parsed = z
      .object({
        periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "내보내기 기간 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const scopeKey = session.role === "ADMIN" ? "ALL" : session.teacherId;

    const exportLog = await prisma.monthlyExportLog.findUnique({
      where: {
        periodKey_scopeKey: {
          periodKey: parsed.data.periodKey,
          scopeKey,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!exportLog) {
      return NextResponse.json(
        { error: "다운로드할 내보내기 이력을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    if (exportLog.status === "CLEANUP_COMPLETED") {
      return NextResponse.json(
        { error: "이미 보관 정리가 완료된 기록입니다." },
        { status: 409 },
      );
    }

    await prisma.monthlyExportLog.update({
      where: {
        id: exportLog.id,
      },
      data: {
        status: "DOWNLOADED",
        downloadedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Monthly export download confirmation failed:", error);

    return NextResponse.json(
      { error: "다운로드 완료 기록을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const scopeKey = session.role === "ADMIN" ? "ALL" : session.teacherId;

    const exportLogs = await prisma.monthlyExportLog.findMany({
      where: {
        scopeKey,
      },
      select: {
        id: true,
        periodKey: true,
        status: true,
        submissionCount: true,
        generatedAt: true,
        downloadedAt: true,
        dbDeletedAt: true,
        driveDeletedAt: true,
        errorMessage: true,
      },
      orderBy: {
        periodKey: "desc",
      },
      take: 12,
    });

    return NextResponse.json({
      isAdmin: session.role === "ADMIN",
      exportLogs,
    });
  } catch (error) {
    console.error("Monthly export status fetch failed:", error);

    return NextResponse.json(
      { error: "월별 내보내기 이력을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
