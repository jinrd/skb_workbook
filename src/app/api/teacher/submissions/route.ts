import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTeacherSession } from "@/lib/auth";

function subtractOneMonth(date: Date): Date {
  const result = new Date(date);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() - 1);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
}

function parseStartDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEndDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + 1);
  return date;
}

export async function GET(request: Request) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const classId = searchParams.get("classId");
    const studentName = searchParams.get("studentName")?.trim() ?? "";
    const practiceGoalId = searchParams.get("practiceGoalId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const requestedPage = Number(searchParams.get("page") ?? "1");

    const requestedPageSize = Number(searchParams.get("pageSize") ?? "30");

    const page =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const pageSize =
      Number.isInteger(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, 100)
        : 30;

    const teacherClasses = await prisma.class.findMany({
      where: session.role === "ADMIN" ? {} : { teacherId: session.teacherId },
      select: {
        id: true,
        name: true,
        practiceGoals: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const allowedClassIds = teacherClasses.map((classItem) => classItem.id);

    if (
      classId &&
      session.role !== "ADMIN" &&
      !allowedClassIds.includes(classId)
    ) {
      return NextResponse.json(
        {
          error: "해당 반의 제출물을 조회할 권한이 없습니다.",
        },
        { status: 403 },
      );
    }

    const now = new Date();
    const retentionStart = subtractOneMonth(now);

    const requestedStart = parseStartDate(from);
    const requestedEnd = parseEndDate(to);

    const startDate =
      requestedStart && requestedStart > retentionStart
        ? requestedStart
        : retentionStart;

    if (requestedEnd && requestedEnd <= startDate) {
      return NextResponse.json(
        {
          error: "조회 종료일은 시작일보다 이후여야 합니다.",
        },
        { status: 400 },
      );
    }

    const where: Prisma.SubmissionWhereInput = {
      submittedAt: {
        gte: startDate,
        ...(requestedEnd ? { lt: requestedEnd } : { lte: now }),
      },
    };

    if (classId) {
      where.classId = classId;
    } else if (session.role !== "ADMIN") {
      where.classId = {
        in: allowedClassIds,
      };
    }

    if (studentName) {
      where.student = {
        name: {
          contains: studentName,
          mode: "insensitive",
        },
      };
    }

    if (practiceGoalId) {
      where.practiceGoalId = practiceGoalId;
    }

    const [submissions, totalSubmissionCount, durationAggregate] =
      await Promise.all([
        prisma.submission.findMany({
          where,
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
            student: {
              select: {
                id: true,
                name: true,
              },
            },
            practiceGoal: {
              select: {
                id: true,
                name: true,
              },
            },
            files: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            submittedAt: "desc",
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),

        prisma.submission.count({
          where,
        }),

        prisma.submission.aggregate({
          where,
          _sum: {
            durationSeconds: true,
          },
        }),
      ]);

    return NextResponse.json({
      submissions,
      summary: {
        totalSubmissionCount,
        totalDurationSeconds: durationAggregate._sum.durationSeconds ?? 0,
      },
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(totalSubmissionCount / pageSize),
      },
      filters: {
        retentionStart: retentionStart.toISOString(),
        startDate: startDate.toISOString(),
        endDate: requestedEnd?.toISOString() ?? now.toISOString(),
      },
      teacherClasses,
    });
  } catch (error) {
    console.error("Fetch teacher submissions error:", error);

    return NextResponse.json(
      {
        error: "학생 제출 기록을 불러오는 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
