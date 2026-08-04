/**
 * 대한민국 표준시 (Asia/Seoul, KST = UTC+9) 전용 날짜 및 시간 처리 유틸리티
 */

export const SEOUL_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 실제 시각을 반환합니다.
 * Date 자체는 시간대가 없는 순간값이므로, KST 표시는 Intl timeZone 옵션으로 처리합니다.
 */
export function getSeoulNow(): Date {
  return new Date();
}

/**
 * 특정 Date에 한국 시간 오프셋(+9시간)을 적용한 Date 반환
 */
export function toSeoulDate(date: Date | string | number): Date {
  return typeof date === 'object' ? date : new Date(date);
}

export function getSeoulDateParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

export function getSeoulDateKey(date: Date = new Date()): string {
  const { year, month, day } = getSeoulDateParts(date);

  return [
    String(year),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function getSeoulHourMinute(date: Date = new Date()): string {
  const { hour, minute } = getSeoulDateParts(date);

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getSeoulDayOfWeek(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIMEZONE,
    weekday: 'short',
  });

  const weekdayShort = formatter.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return dayMap[weekdayShort] ?? 1;
}

export function createSeoulDateTime(
  baseDate: Date,
  hour: number,
  minute: number,
): Date {
  const { year, month, day } = getSeoulDateParts(baseDate);

  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
}

export function getSeoulStartOfDay(date: Date = new Date()): Date {
  return createSeoulDateTime(date, 0, 0);
}

export function getSeoulEndOfDay(date: Date = new Date()): Date {
  const { year, month, day } = getSeoulDateParts(date);

  return new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0, 0));
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
