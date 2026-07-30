import { prisma } from '@/lib/prisma';
import { getSeoulNow } from '@/lib/timezone';
import { deleteFileFromGoogleDrive } from '@/lib/gdrive';

export interface CleanupResult {
  executedAt: string;
  targetCount: number;
  deletedCount: number;
  failedCount: number;
  details: Array<{
    fileId: string;
    fileName: string;
    status: 'SUCCESS' | 'FAILED';
    error?: string;
  }>;
}

/**
 * 제출 다음 날이 된 Google Drive 첨부파일 일괄 삭제 실행기
 * 기준: KST 오늘 00:00:00 이전에 제출된 과제 중 아직 삭제되지 않은(isDeleted: false) 파일
 */
export async function runDailyDriveCleanup(): Promise<CleanupResult> {
  const now = getSeoulNow();
  
  // KST 기준 오늘의 시작 시각 (00:00:00)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // 삭제 대상 파일 조회: 제출일이 오늘 00:00:00 이전이며, 아직 삭제되지 않은 파일
  const targetFiles = await prisma.submissionFile.findMany({
    where: {
      isDeleted: false,
      submission: {
        submittedAt: {
          lt: todayStart,
        },
      },
    },
    include: {
      submission: {
        select: {
          submittedAt: true,
        },
      },
    },
  });

  const details: CleanupResult['details'] = [];
  let deletedCount = 0;
  let failedCount = 0;

  for (const file of targetFiles) {
    try {
      const isSuccess = await deleteFileFromGoogleDrive(file.googleFileId);

      if (isSuccess) {
        // DB 상태 업데이트
        await prisma.submissionFile.update({
          where: { id: file.id },
          data: {
            isDeleted: true,
            deletedAt: now,
          },
        });

        deletedCount++;
        details.push({
          fileId: file.id,
          fileName: file.fileName,
          status: 'SUCCESS',
        });
      } else {
        failedCount++;
        details.push({
          fileId: file.id,
          fileName: file.fileName,
          status: 'FAILED',
          error: 'Google Drive deletion API returned false',
        });
      }
    } catch (error) {
      failedCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      details.push({
        fileId: file.id,
        fileName: file.fileName,
        status: 'FAILED',
        error: errorMsg,
      });
    }
  }

  // 구글 드라이브 파일 정리 후, 어제 자 이전의 낱개 Submission 레코드 완전히 삭제 (Purge)
  try {
    await prisma.submission.deleteMany({
      where: {
        submittedAt: {
          lt: todayStart,
        },
      },
    });
  } catch (purgeErr) {
    console.error('Raw submission DB purge error:', purgeErr);
  }

  return {
    executedAt: now.toISOString(),
    targetCount: targetFiles.length,
    deletedCount,
    failedCount,
    details,
  };
}
