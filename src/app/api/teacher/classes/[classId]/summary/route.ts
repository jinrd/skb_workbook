import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherSession } from "@/lib/auth";
import { verifyClassOwnership } from "@/lib/accessControl";
import {
  getSeoulDateKey,
  getSeoulEndOfDay,
  getSeoulNow,
  getSeoulStartOfDay,
} from "@/lib/timezone";

type GoalSummary = {
  goalName: string;
  count: number;
  totalDurationSeconds: number;
};

type StudentSummary = {
  studentId: string;
  studentName: string;
  count: number;
  totalDurationSeconds: number;
  goals: string[];
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { classId } = await params;

    const isOwner = await verifyClassOwnership(
      classId,
      session.teacherId,
      session.role,
    );

    if (!isOwner) {
      return NextResponse.json(
        { error: "해당 반에 대한 접근 권한이 없습니다." },
        { status: 403 },
      );
    }

    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          where: {
            droppedAt: null,
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!targetClass) {
      return NextResponse.json(
        { error: "존재하지 않는 반입니다." },
        { status: 404 },
      );
    }

    const now = getSeoulNow();
    const todayDateStr = getSeoulDateKey(now);
    const startOfDay = getSeoulStartOfDay(now);
    const endOfDay = getSeoulEndOfDay(now);

    const submissions = await prisma.submission.findMany({
      where: {
        classId,
        submittedAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        student: {
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

    const goalSummaryMap: Record<string, GoalSummary> = {};
    const studentSummaryMap: Record<string, StudentSummary> = {};

    for (const enrollment of targetClass.enrollments) {
      const student = enrollment.student;

      studentSummaryMap[student.id] = {
        studentId: student.id,
        studentName: student.name,
        count: 0,
        totalDurationSeconds: 0,
        goals: [],
      };
    }

    for (const submission of submissions) {
      const goalName = submission.goalName;

      if (!goalSummaryMap[goalName]) {
        goalSummaryMap[goalName] = {
          goalName,
          count: 0,
          totalDurationSeconds: 0,
        };
      }

      goalSummaryMap[goalName].count += 1;
      goalSummaryMap[goalName].totalDurationSeconds +=
        submission.durationSeconds;

      const studentSummary = studentSummaryMap[submission.studentId];

      if (studentSummary) {
        studentSummary.count += 1;
        studentSummary.totalDurationSeconds += submission.durationSeconds;

        if (!studentSummary.goals.includes(goalName)) {
          studentSummary.goals.push(goalName);
        }
      }
    }

    const goalSummary = Object.values(goalSummaryMap).sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds,
    );

    const studentSummary = Object.values(studentSummaryMap).sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds,
    );

    const totalDurationSeconds = submissions.reduce(
      (total, submission) => total + submission.durationSeconds,
      0,
    );

    const submittedStudentCount = new Set(
      submissions.map((submission) => submission.studentId),
    ).size;

    return NextResponse.json({
      classId: targetClass.id,
      className: targetClass.name,
      todayDateStr,
      todayDate: now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      summary: {
        totalCount: submissions.length,
        totalDurationSeconds,
        enrolledStudentCount: targetClass.enrollments.length,
        submittedStudentCount,
        missingStudentCount:
          targetClass.enrollments.length - submittedStudentCount,
      },
      goalSummary,
      studentSummary,
      recentSubmissions: submissions,
    });
  } catch (error) {
    console.error("Fetch class summary error:", error);

    return NextResponse.json(
      {
        error: "수업 결과 요약 정보를 불러오는 데 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
