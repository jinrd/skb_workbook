import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getOneMonthAgo() {
  const result = new Date();
  result.setMonth(result.getMonth() - 1);

  return result;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { studentId } = await params;

    const teacherClasses = await prisma.class.findMany({
      where: session.role === "ADMIN" ? {} : { teacherId: session.teacherId },
      select: {
        id: true,
      },
    });

    const allowedClassIds = teacherClasses.map((classItem) => classItem.id);

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        ...(session.role === "ADMIN"
          ? {}
          : {
              enrollments: {
                some: {
                  classId: {
                    in: allowedClassIds,
                  },
                },
              },
            }),
      },
      select: {
        id: true,
        name: true,
        enrollments: {
          where:
            session.role === "ADMIN"
              ? {}
              : {
                  classId: {
                    in: allowedClassIds,
                  },
                },
          select: {
            enrolledAt: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            enrolledAt: "asc",
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "학생을 찾을 수 없거나 조회 권한이 없습니다." },
        { status: 404 },
      );
    }

    const where: Prisma.SubmissionWhereInput = {
      studentId,
      submittedAt: {
        gte: getOneMonthAgo(),
        lte: new Date(),
      },
      ...(session.role === "ADMIN"
        ? {}
        : {
            classId: {
              in: allowedClassIds,
            },
          }),
    };

    const submissions = await prisma.submission.findMany({
      where,
      select: {
        id: true,
        submittedAt: true,
        goalName: true,
        durationSeconds: true,
        memo: true,
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    const classMap = new Map<
      string,
      {
        classId: string;
        className: string;
        submissionCount: number;
        totalDurationSeconds: number;
        lastSubmittedAt: Date | null;
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

    let totalDurationSeconds = 0;

    for (const submission of submissions) {
      totalDurationSeconds += submission.durationSeconds;

      const classSummary = classMap.get(submission.class.id) ?? {
        classId: submission.class.id,
        className: submission.class.name,
        submissionCount: 0,
        totalDurationSeconds: 0,
        lastSubmittedAt: null,
      };

      classSummary.submissionCount += 1;
      classSummary.totalDurationSeconds += submission.durationSeconds;

      if (
        !classSummary.lastSubmittedAt ||
        submission.submittedAt > classSummary.lastSubmittedAt
      ) {
        classSummary.lastSubmittedAt = submission.submittedAt;
      }

      classMap.set(submission.class.id, classSummary);

      const goalSummary = goalMap.get(submission.goalName) ?? {
        goalName: submission.goalName,
        submissionCount: 0,
        totalDurationSeconds: 0,
      };

      goalSummary.submissionCount += 1;
      goalSummary.totalDurationSeconds += submission.durationSeconds;
      goalMap.set(submission.goalName, goalSummary);
    }

    return NextResponse.json({
      student,
      summary: {
        classCount: student.enrollments.length,
        submissionCount: submissions.length,
        totalDurationSeconds,
        lastSubmittedAt: submissions[0]?.submittedAt ?? null,
      },
      classSummaries: [...classMap.values()].sort(
        (first, second) =>
          second.totalDurationSeconds - first.totalDurationSeconds,
      ),
      goalSummaries: [...goalMap.values()].sort(
        (first, second) =>
          second.totalDurationSeconds - first.totalDurationSeconds,
      ),
      submissions,
    });
  } catch (error) {
    console.error("Fetch student records error:", error);

    return NextResponse.json(
      { error: "학생 기록을 불러오는 중 문제가 발생했습니다." },
      { status: 500 },
    );
  }
}
