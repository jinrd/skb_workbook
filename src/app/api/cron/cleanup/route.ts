import { NextResponse } from 'next/server';
import { runDailyDriveCleanup } from '@/lib/cleanupEngine';
import { initInternalCronScheduler } from '@/lib/cronScheduler';
import { getTeacherSession } from '@/lib/auth';

// 서버 내부 타이머 스케줄러 자동 초기화
initInternalCronScheduler();

export async function POST(request: Request) {
  try {
    // 1. 강사 세션 또는 Authorization 헤더 검증
    const teacherSession = await getTeacherSession();
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET || 'skb-workbook-cron-secret-key-2026';

    const isAuthorized =
      Boolean(teacherSession) ||
      (authHeader && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 401 });
    }

    // 2. Google Drive Cleanup 일괄 실행
    const result = await runDailyDriveCleanup();

    return NextResponse.json({
      success: true,
      message: `구글 드라이브 파일 정리 작업이 완료되었습니다. (${result.deletedCount}개 삭제, ${result.failedCount}개 실패)`,
      result,
    });
  } catch (error) {
    console.error('Cleanup API error:', error);
    return NextResponse.json(
      { error: 'Cleanup 작업 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 스케줄러 활성화 재확인용 헬스체크
  initInternalCronScheduler();
  return NextResponse.json({
    status: 'ACTIVE',
    scheduler: 'Internal 4:00 AM KST Cron Timer Enabled',
  });
}
