import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStudentSession } from '@/lib/auth';
import { getSeoulNow } from '@/lib/timezone';
import { buildFormattedFileName, uploadStreamToGoogleDrive } from '@/lib/gdrive';
import { checkClassAccess } from '@/lib/accessControl';



export async function POST(request: Request) {
  try {
    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json(
        { error: '로그인 세션이 만료되었습니다. QR 코드로 다시 입장해 주세요.' },
        { status: 401 }
      );
    }

    // 1-1. DB StudentSession 실존 및 유효성 검증
    const now = getSeoulNow();
    const dbStudentSession = await prisma.studentSession.findFirst({
      where: {
        id: session.studentSessionId,
        studentId: session.studentId,
        classSessionId: session.classSessionId,
        isValid: true,
        expiresAt: { gte: now },
      },
    });

    if (!dbStudentSession) {
      return NextResponse.json(
        { error: '유효하지 않거나 만료된 학생 세션입니다. QR 코드로 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    // 1-2. 실시간 접속 가드 재확인
    const accessCheck = await checkClassAccess({ classId: session.classId });
    if (!accessCheck.isAllowed) {
      return NextResponse.json(
        { error: accessCheck.reason || '현재 수업 마감되어 실습 결과를 제출할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 2. Multi-part FormData 파싱
    const formData = await request.formData();
    const categoryName = formData.get('categoryName') as string;
    const durationMinutesRaw = formData.get('durationMinutes') as string;
    const memo = (formData.get('memo') as string) || '';
    const fileEntries = (formData.getAll('files') as File[]).filter((f) => f && f.name);

    if (!categoryName) {
      return NextResponse.json({ error: '연습 종목을 선택해 주세요.' }, { status: 400 });
    }

    const durationMinutes = Number(durationMinutesRaw) || 0;
    if (durationMinutes <= 0) {
      return NextResponse.json({ error: '연습 시간을 1분 이상 입력해 주세요.' }, { status: 400 });
    }

    // 3. 동적 반 설정(파일 개수 및 용량) 검증
    const classSession = await prisma.classSession.findUnique({
      where: { id: session.classSessionId },
      include: {
        class: {
          include: {
            settingVersions: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
      },
    });

    const latestSetting = classSession?.class?.settingVersions[0];
    const maxFiles = latestSetting?.maxFilesPerSub ?? 5;
    const maxFileSizeMB = latestSetting?.maxFileSizeMB ?? 10;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

    if (fileEntries.length > maxFiles) {
      return NextResponse.json(
        { error: `첨부파일은 최대 ${maxFiles}개까지만 업로드할 수 있습니다.` },
        { status: 400 }
      );
    }

    for (const file of fileEntries) {
      if (file.size > maxFileSizeBytes) {
        return NextResponse.json(
          { error: `첨부파일 '${file.name}'의 용량이 ${maxFileSizeMB}MB 제한을 초과했습니다.` },
          { status: 400 }
        );
      }
    }



    // 4. Submission 레코드 생성
    const submission = await prisma.submission.create({
      data: {
        classSessionId: session.classSessionId,
        studentId: session.studentId,
        categoryName,
        durationMinutes,
        content: memo,
        submittedAt: now,
      },
    });

    const savedFiles = [];

    // 5. 각 파일별 Google Drive 업로드 및 SubmissionFile 기록 (파일이 있는 경우에만 수행)
    if (fileEntries.length > 0) {
      for (const file of fileEntries) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const formattedFileName = buildFormattedFileName({
          studentName: session.studentName,
          className: session.className,
          originalFileName: file.name,
        });

        try {
          const { Readable } = await import('node:stream');
          const driveResult = await uploadStreamToGoogleDrive({
            stream: Readable.from(buffer),
            fileName: formattedFileName,
            mimeType: file.type || 'application/octet-stream',
          });

          const subFile = await prisma.submissionFile.create({
            data: {
              submissionId: submission.id,
              googleFileId: driveResult.fileId,
              fileName: formattedFileName,
              fileSize: file.size,
              mimeType: file.type || 'application/octet-stream',
            },
          });

          savedFiles.push(subFile);
        } catch (gdriveError: unknown) {
          // Google Drive 업로드 실패 시 DB 트랜잭션 롤백 및 에러 반환
          await prisma.submission.delete({ where: { id: submission.id } });

          const rawMsg = gdriveError instanceof Error ? gdriveError.message : String(gdriveError);
          console.error('Google Drive Upload Failed:', rawMsg);

          let userMsg = `Google Drive 파일 업로드 실패: ${rawMsg}`;
          if (rawMsg.includes('storage quota')) {
            userMsg = 'Google Drive 업로드 오류: 지정된 구글 드라이브 폴더의 용량 권한이 부족합니다. (공유 드라이브 폴더 설정을 확인해 주세요)';
          }

          return NextResponse.json({ error: userMsg }, { status: 500 });
        }
      }
    }

    // 6. 학생 일별 통합 종합 기록 (DailyStudentReport) 누적 갱신/생성
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const existingReport = await prisma.dailyStudentReport.findUnique({
      where: {
        studentId_classId_date: {
          studentId: session.studentId,
          classId: session.classId,
          date: dateStr,
        },
      },
    });

    if (existingReport) {
      const categoryMap: Record<string, number> = JSON.parse(existingReport.categorySummary || '{}');
      categoryMap[categoryName] = (categoryMap[categoryName] || 0) + durationMinutes;

      const memoList: string[] = JSON.parse(existingReport.memos || '[]');
      if (memo.trim()) {
        memoList.push(memo.trim());
      }

      await prisma.dailyStudentReport.update({
        where: { id: existingReport.id },
        data: {
          totalDurationMinutes: existingReport.totalDurationMinutes + durationMinutes,
          submissionCount: existingReport.submissionCount + 1,
          categorySummary: JSON.stringify(categoryMap),
          memos: JSON.stringify(memoList),
        },
      });
    } else {
      const categoryMap: Record<string, number> = { [categoryName]: durationMinutes };
      const memoList: string[] = memo.trim() ? [memo.trim()] : [];

      await prisma.dailyStudentReport.create({
        data: {
          studentId: session.studentId,
          classId: session.classId,
          date: dateStr,
          totalDurationMinutes: durationMinutes,
          submissionCount: 1,
          categorySummary: JSON.stringify(categoryMap),
          memos: JSON.stringify(memoList),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '실습 결과물이 성공적으로 제출되었습니다.',
      submissionId: submission.id,
      filesCount: savedFiles.length,
    });
  } catch (error) {
    console.error('Student submission error:', error);
    return NextResponse.json(
      { error: '제출물 처리 도중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
