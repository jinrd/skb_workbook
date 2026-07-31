import { deleteFileFromGoogleDrive } from "@/lib/gdrive";
import { prisma } from "@/lib/prisma";

type MonthlyCleanupResult = {
  periodKey: string;
  targetSubmissionCount: number;
  deletedSubmissionCount: number;
  deletedFileCount: number;
  remainingSubmissionCount: number;
  failedFileCount: number;
  completed: boolean;
};

export async function runMonthlyCleanup(
  periodKey: string,
): Promise<MonthlyCleanupResult> {
  const exportLog = await prisma.monthlyExportLog.findUnique({
    where: {
      periodKey_scopeKey: {
        periodKey,
        scopeKey: "ALL",
      },
    },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  if (!exportLog) {
    throw new Error("관리자 전체 엑셀 내보내기 기록이 없습니다.");
  }

  if (exportLog.status !== "DOWNLOADED" && exportLog.status !== "FAILED") {
    throw new Error("다운로드 완료된 엑셀 기록만 정리할 수 있습니다.");
  }

  const submissions = await prisma.submission.findMany({
    where: {
      submittedAt: {
        gte: exportLog.periodStart,
        lt: exportLog.periodEnd,
      },
    },
    select: {
      id: true,
      files: {
        where: {
          isDeleted: false,
        },
        select: {
          id: true,
          googleFileId: true,
        },
      },
    },
  });

  const failedFileIds: string[] = [];
  let deletedFileCount = 0;

  for (const submission of submissions) {
    for (const file of submission.files) {
      const deleted = await deleteFileFromGoogleDrive(file.googleFileId);

      if (!deleted) {
        failedFileIds.push(file.id);
        continue;
      }

      await prisma.submissionFile.update({
        where: {
          id: file.id,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      deletedFileCount += 1;
    }
  }

  const deletedSubmissions = await prisma.submission.deleteMany({
    where: {
      submittedAt: {
        gte: exportLog.periodStart,
        lt: exportLog.periodEnd,
      },
      files: {
        none: {
          isDeleted: false,
        },
      },
    },
  });

  const remainingSubmissionCount = await prisma.submission.count({
    where: {
      submittedAt: {
        gte: exportLog.periodStart,
        lt: exportLog.periodEnd,
      },
    },
  });

  const completed = remainingSubmissionCount === 0;
  const errorMessage = completed
    ? null
    : `${remainingSubmissionCount}건의 제출 기록이 남아 있습니다.`;

  await prisma.monthlyExportLog.update({
    where: {
      id: exportLog.id,
    },
    data: completed
      ? {
          status: "CLEANUP_COMPLETED",
          dbDeletedAt: new Date(),
          driveDeletedAt: new Date(),
          errorMessage: null,
        }
      : {
          status: "FAILED",
          errorMessage,
        },
  });

  await prisma.cleanupLog.create({
    data: {
      type: "MONTHLY_RETENTION",
      status: completed ? "SUCCESS" : "PARTIAL_FAILURE",
      targetCount: submissions.length,
      deletedCount: deletedSubmissions.count,
      failCount: failedFileIds.length,
      details:
        failedFileIds.length > 0
          ? JSON.stringify({
              periodKey,
              failedSubmissionFileIds: failedFileIds,
            })
          : null,
    },
  });

  return {
    periodKey,
    targetSubmissionCount: submissions.length,
    deletedSubmissionCount: deletedSubmissions.count,
    deletedFileCount,
    remainingSubmissionCount,
    failedFileCount: failedFileIds.length,
    completed,
  };
}
