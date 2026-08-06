import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTeacherSession } from "@/lib/auth";

function getSeoulDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getRecentDateKeys(days: number): string[] {
  const todayKey = getSeoulDateKey(new Date());

  const today = new Date(`${todayKey}T00:00:00+09:00`);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);

    date.setUTCDate(today.getUTCDate() - (days - index - 1));

    return getSeoulDateKey(date);
  });
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
    const practiceGoalId = searchParams.get("practiceGoalId");
    const studentId = searchParams.get("studentId");

    const requestedDays = Number(searchParams.get("days") ?? "30");

    const days = [7, 14, 30].includes(requestedDays) ? requestedDays : 30;

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
        {
          error: "해당 반의 분석 기록을 조회할 권한이 없습니다.",
        },
        { status: 403 },
      );
    }

    const dateKeys = getRecentDateKeys(days);

    const startAt = new Date(`${dateKeys[0]}T00:00:00+09:00`);

    const where: Prisma.SubmissionWhereInput = {
      submittedAt: {
        gte: startAt,
        lte: new Date(),
      },
    };

    if (classId) {
      where.classId = classId;
    } else if (session.role !== "ADMIN") {
      where.classId = {
        in: allowedClassIds,
      };
    }

    if (practiceGoalId) {
      where.practiceGoalId = practiceGoalId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    const submissions = await prisma.submission.findMany({
      where,
      select: {
        id: true,
        submittedAt: true,
        practiceGoalId: true,
        goalName: true,
        durationSeconds: true,
        practiceGoal: {
          select: {
            name: true,
          },
        },
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
      },
    });

    const dailyMap = new Map(
      dateKeys.map((date) => [
        date,
        {
          date,
          submissionCount: 0,
          totalDurationSeconds: 0,
        },
      ]),
    );

    const classMap = new Map<
      string,
      {
        classId: string;
        className: string;
        submissionCount: number;
        totalDurationSeconds: number;
      }
    >();

    const goalMap = new Map<
      string,
      {
        goalName: string;
        submissionCount: number;
        totalDurationSeconds: number;
      }
    >();

    const studentMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        submissionCount: number;
        totalDurationSeconds: number;
      }
    >();

    for (const submission of submissions) {
      const currentGoalName = submission.practiceGoal.name;
      const dateKey = getSeoulDateKey(submission.submittedAt);

      const daily = dailyMap.get(dateKey);

      if (daily) {
        daily.submissionCount += 1;
        daily.totalDurationSeconds += submission.durationSeconds;
      }

      const classSummary = classMap.get(submission.class.id) ?? {
        classId: submission.class.id,
        className: submission.class.name,
        submissionCount: 0,
        totalDurationSeconds: 0,
      };

      classSummary.submissionCount += 1;
      classSummary.totalDurationSeconds += submission.durationSeconds;

      classMap.set(submission.class.id, classSummary);

      const goalSummary = goalMap.get(currentGoalName) ?? {
        goalName: currentGoalName,
        submissionCount: 0,
        totalDurationSeconds: 0,
      };

      goalSummary.submissionCount += 1;
      goalSummary.totalDurationSeconds += submission.durationSeconds;

      goalMap.set(currentGoalName, goalSummary);

      const studentSummary = studentMap.get(submission.student.id) ?? {
        studentId: submission.student.id,
        studentName: submission.student.name,
        submissionCount: 0,
        totalDurationSeconds: 0,
      };

      studentSummary.submissionCount += 1;
      studentSummary.totalDurationSeconds += submission.durationSeconds;

      studentMap.set(submission.student.id, studentSummary);
    }

    const totalDurationSeconds = submissions.reduce(
      (total, submission) => total + submission.durationSeconds,
      0,
    );

    const previousDurationByGoal = new Map<string, number>();

    const submissionHistory = [...submissions]
      .sort(
        (first, second) =>
          first.submittedAt.getTime() - second.submittedAt.getTime(),
      )
      .map((submission) => {
        const previousDurationSeconds = previousDurationByGoal.get(
          submission.practiceGoalId,
        );

        previousDurationByGoal.set(
          submission.practiceGoalId,
          submission.durationSeconds,
        );

        return {
          id: submission.id,
          submittedAt: submission.submittedAt,
          goalName: submission.practiceGoal.name,
          durationSeconds: submission.durationSeconds,
          previousDurationSeconds: previousDurationSeconds ?? null,
          durationChangeSeconds:
            previousDurationSeconds === undefined
              ? null
              : submission.durationSeconds - previousDurationSeconds,
        };
      })
      .reverse();

    return NextResponse.json({
      filters: {
        days,
        classId,
        practiceGoalId,
        studentId,
      },
      summary: {
        submissionCount: submissions.length,
        totalDurationSeconds,
        activeStudentCount: studentMap.size,
      },
      daily: Array.from(dailyMap.values()),
      classSummary: Array.from(classMap.values()).sort(
        (first, second) =>
          second.totalDurationSeconds - first.totalDurationSeconds,
      ),
      goalSummary: Array.from(goalMap.values()).sort(
        (first, second) =>
          second.totalDurationSeconds - first.totalDurationSeconds,
      ),
      studentSummary: Array.from(studentMap.values())
        .sort(
          (first, second) =>
            second.totalDurationSeconds - first.totalDurationSeconds,
        )
        .slice(0, 10),
      submissionHistory: studentId ? submissionHistory : [],
      students: students.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        submissionCount: 0,
        totalDurationSeconds: 0,
      })),
      teacherClasses,
    });
  } catch (error) {
    console.error("Fetch analytics error:", error);

    return NextResponse.json(
      {
        error: "기록 분석 데이터를 불러오는 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
