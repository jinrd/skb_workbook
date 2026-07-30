import { getSeoulNow } from '@/lib/timezone';
import { runDailyDriveCleanup } from '@/lib/cleanupEngine';

// 글로벌 스케줄러 타입 선언
const globalForScheduler = globalThis as typeof globalThis & {
  __internal_cleanup_timer__?: NodeJS.Timeout;
};

/**
 * 다음 매일 오전 4:00 KST까지 남은 밀리초 계산
 */
function getMsUntilNext4AMKST(): number {
  const now = getSeoulNow();
  const next4AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0);

  // 이미 오늘 4시가 지났다면 내일 4시로 설정
  if (now.getTime() >= next4AM.getTime()) {
    next4AM.setDate(next4AM.getDate() + 1);
  }

  return next4AM.getTime() - now.getTime();
}

/**
 * Next.js 애플리케이션 내부 매일 오전 4시 크론 스케줄러 초기화
 */
export function initInternalCronScheduler() {
  if (globalForScheduler.__internal_cleanup_timer__) {
    return; // 이미 타이머가 등록된 경우 중복 생성 안 함
  }

  const msUntilTarget = getMsUntilNext4AMKST();
  console.log(`[Internal Cron] Next Google Drive cleanup scheduled in ${Math.round(msUntilTarget / 1000 / 60)} minutes (4:00 AM KST).`);

  globalForScheduler.__internal_cleanup_timer__ = setTimeout(async () => {
    console.log('[Internal Cron] Running scheduled 4:00 AM KST Google Drive cleanup...');
    try {
      const result = await runDailyDriveCleanup();
      console.log(`[Internal Cron] Cleanup finished: ${result.deletedCount} files deleted, ${result.failedCount} failed.`);
    } catch (err) {
      console.error('[Internal Cron] Cleanup execution error:', err);
    } finally {
      // 실행 완료 후 다음 날 4:00 AM 타이머 재등록
      globalForScheduler.__internal_cleanup_timer__ = undefined;
      initInternalCronScheduler();
    }
  }, msUntilTarget);
}
