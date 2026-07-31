import type { TeacherSessionData } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type MonthlyExportData = {
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  submissions: Array<{
    submittedAt: Date;
    className: string;
    studentName: string;
    goalName: string;
    durationSeconds: number;
    memo: string | null;
  }>;
  summary: {
    submissionCount: number;
    totalDurationSeconds: number;
    studentCount: number;
    classCount: number;
  };
  studentSummaries: Array<{
    studentName: string;
    submissionCount: number;
    totalDurationSeconds: number;
  }>;
  goalSummaries: Array<{
    goalName: string;
    submissionCount: number;
    totalDurationSeconds: number;
  }>;
  classSummaries: Array<{
    className: string;
    submissionCount: number;
    totalDurationSeconds: number;
  }>;
  dailySummaries: Array<{
    dateKey: string;
    submissionCount: number;
    totalDurationSeconds: number;
  }>;
};

function getMonthRange(periodKey: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new Error("내보내기 기간은 YYYY-MM 형식이어야 합니다.");
  }

  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    periodStart: new Date(`${yearText}-${monthText}-01T00:00:00+09:00`),
    periodEnd: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+09:00`,
    ),
  };
}

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

export async function getMonthlyExportData(
  session: TeacherSessionData,
  periodKey: string,
): Promise<MonthlyExportData> {
  const { periodStart, periodEnd } = getMonthRange(periodKey);

  const classWhere =
    session.role === "ADMIN" ? {} : { teacherId: session.teacherId };

  const teacherClasses = await prisma.class.findMany({
    where: classWhere,
    select: {
      id: true,
      name: true,
    },
  });

  const allowedClassIds = teacherClasses.map((classItem) => classItem.id);

  const submissions = await prisma.submission.findMany({
    where: {
      classId: session.role === "ADMIN" ? undefined : { in: allowedClassIds },
      submittedAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    select: {
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
      student: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      submittedAt: "asc",
    },
  });

  const studentMap = new Map<
    string,
    {
      studentName: string;
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

  const classMap = new Map<
    string,
    {
      className: string;
      submissionCount: number;
      totalDurationSeconds: number;
    }
  >();

  const dailyMap = new Map<
    string,
    {
      dateKey: string;
      submissionCount: number;
      totalDurationSeconds: number;
    }
  >();

  let totalDurationSeconds = 0;

  for (const submission of submissions) {
    totalDurationSeconds += submission.durationSeconds;

    const studentSummary = studentMap.get(submission.student.id) ?? {
      studentName: submission.student.name,
      submissionCount: 0,
      totalDurationSeconds: 0,
    };

    studentSummary.submissionCount += 1;
    studentSummary.totalDurationSeconds += submission.durationSeconds;
    studentMap.set(submission.student.id, studentSummary);

    const goalSummary = goalMap.get(submission.goalName) ?? {
      goalName: submission.goalName,
      submissionCount: 0,
      totalDurationSeconds: 0,
    };

    goalSummary.submissionCount += 1;
    goalSummary.totalDurationSeconds += submission.durationSeconds;
    goalMap.set(submission.goalName, goalSummary);

    const classSummary = classMap.get(submission.class.id) ?? {
      className: submission.class.name,
      submissionCount: 0,
      totalDurationSeconds: 0,
    };

    classSummary.submissionCount += 1;
    classSummary.totalDurationSeconds += submission.durationSeconds;
    classMap.set(submission.class.id, classSummary);

    const dateKey = getSeoulDateKey(submission.submittedAt);

    const dailySummary = dailyMap.get(dateKey) ?? {
      dateKey,
      submissionCount: 0,
      totalDurationSeconds: 0,
    };

    dailySummary.submissionCount += 1;
    dailySummary.totalDurationSeconds += submission.durationSeconds;
    dailyMap.set(dateKey, dailySummary);
  }

  return {
    periodKey,
    periodStart,
    periodEnd,
    submissions: submissions.map((submission) => ({
      submittedAt: submission.submittedAt,
      className: submission.class.name,
      studentName: submission.student.name,
      goalName: submission.goalName,
      durationSeconds: submission.durationSeconds,
      memo: submission.memo,
    })),
    summary: {
      submissionCount: submissions.length,
      totalDurationSeconds,
      studentCount: studentMap.size,
      classCount: classMap.size,
    },
    studentSummaries: [...studentMap.values()].sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds,
    ),
    goalSummaries: [...goalMap.values()].sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds,
    ),
    classSummaries: [...classMap.values()].sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds,
    ),
    dailySummaries: [...dailyMap.values()].sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    ),
  };
}
