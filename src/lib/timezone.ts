/**
 * 대한민국 표준시 (Asia/Seoul, KST = UTC+9) 전용 날짜 및 시간 처리 유틸리티
 */

export const SEOUL_TIMEZONE = 'Asia/Seoul';

/**
 * 한국 시각(KST, UTC+9) 숫자가 직관적으로 반영된 Date 객체 반환
 * (Prisma Studio나 DB에서 조회할 때 한국 시각 숫자가 그대로 보이도록 처리)
 */
export function getSeoulNow(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kstOffset = 9 * 60 * 60 * 1000; // +9시간
  return new Date(utc + kstOffset);
}

/**
 * 특정 Date에 한국 시간 오프셋(+9시간)을 적용한 Date 반환
 */
export function toSeoulDate(date: Date | string | number): Date {
  const targetDate = typeof date === 'object' ? date : new Date(date);
  const utc = targetDate.getTime() + (targetDate.getTimezoneOffset() * 60 * 1000);
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(utc + kstOffset);
}

/**
 * 주어진 Date를 Korea/Seoul 시간대의 YYYY-MM-DD HH:mm:ss 포맷 스트링으로 변환
 */
export function formatSeoulDateTime(date: Date | string | number): string {
  const targetDate = typeof date === 'object' ? date : new Date(date);

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(targetDate);
}

/**
 * 주어진 Date를 Korea/Seoul 시간대의 YYYY-MM-DD 포맷 스트링으로 변환
 */
export function formatSeoulDate(date: Date | string | number): string {
  const targetDate = typeof date === 'object' ? date : new Date(date);

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: SEOUL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(targetDate);
}

/**
 * 요일 한글 변환 (0: 일, 1: 월, ..., 6: 토)
 */
export const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function getSeoulDayName(date: Date = new Date()): typeof KOREAN_DAY_NAMES[number] {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIMEZONE,
    weekday: 'short',
  });
  const weekdayShort = formatter.format(date);
  const dayMap: Record<string, typeof KOREAN_DAY_NAMES[number]> = {
    Sun: '일',
    Mon: '월',
    Tue: '화',
    Wed: '수',
    Thu: '목',
    Fri: '금',
    Sat: '토',
  };
  return dayMap[weekdayShort] || '월';
}
