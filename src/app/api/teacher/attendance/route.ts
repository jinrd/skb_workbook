import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function getStaySeconds(entryAt: Date, exitAt: Date | null): number {
  if (!exitAt) {
    return 0;
  }

  return Math.max(0, Math.floor((exitAt.getTime() - entryAt.getTime()) / 1000));
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
    const studentId = searchParams.get("studentId");
    const studentName = searchParams.get("studentName")?.trim() ?? "";
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
      },
      orderBy: {
        name: "asc",
      },
    });

    const allowedClassIds = teacherClasses.map((classItem) => classItem.id);

    const students = await prisma.student.findMany({
      where:
        session.role === "ADMIN"
          ? {}
          : {
              enrollments: {
                some: {
                  classId: {
                    in: allowedClassIds,
                  },
                  droppedAt: null,
                },
              },
            },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (
      classId &&
      session.role !== "ADMIN" &&
      !allowedClassIds.includes(classId)
    ) {
      return NextResponse.json(
        { error: "해당 반의 출석 기록을 조회할 권한이 없습니다." },
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
        { error: "조회 종료일은 시작일보다 이후여야 합니다." },
        { status: 400 },
      );
    }

    const where: Prisma.StudentAttendanceWhereInput = {
      entryAt: {
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

    if (studentId) {
      where.studentId = studentId;
    } else if (studentName) {
      where.student = {
        name: {
          contains: studentName,
          mode: "insensitive",
        },
      };
    }

    const [attendances, totalAttendanceCount, activeAttendanceCount] =
      await Promise.all([
        prisma.studentAttendance.findMany({
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
            classSession: {
              select: {
                id: true,
                scheduledStartTime: true,
                scheduledEndTime: true,
              },
            },
          },
          orderBy: [{ student: { name: "asc" } }, { entryAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),

        prisma.studentAttendance.count({
          where,
        }),

        prisma.studentAttendance.count({
          where: {
            ...where,
            exitAt: null,
          },
        }),
      ]);

    const totalStaySeconds = attendances.reduce(
      (sum, attendance) =>
        sum + getStaySeconds(attendance.entryAt, attendance.exitAt),
      0,
    );

    return NextResponse.json({
      attendances,
      summary: {
        totalAttendanceCount,
        activeAttendanceCount,
        completedAttendanceCount: totalAttendanceCount - activeAttendanceCount,
        totalStaySeconds,
      },
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(totalAttendanceCount / pageSize),
      },
      filters: {
        retentionStart: retentionStart.toISOString(),
        startDate: startDate.toISOString(),
        endDate: requestedEnd?.toISOString() ?? now.toISOString(),
      },
      teacherClasses,
      students,
    });
  } catch (error) {
    console.error("Fetch teacher attendance error:", error);

    return NextResponse.json(
      { error: "학생 출석 기록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
