import { prisma } from '@/lib/prisma';
import {
  createSeoulDateTime,
  getSeoulDateKey,
  getSeoulDayName,
  getSeoulDayOfWeek,
  getSeoulHourMinute,
  getSeoulNow,
} from '@/lib/timezone';

export interface AccessCheckResult {
  isAllowed: boolean;
  reason?: string;
  classId?: string;
  className?: string;
  classSessionId?: string;
  actualAllowedStart?: Date;
  actualAllowedEnd?: Date;
  preEntryMinutes?: number;
  gracePeriodMinutes?: number;
}

/**
 * 특정 반(classId 또는 joinToken)의 실시간 접속 허용 여부를 판정하는 core 함수
 * (선생님 대시보드의 실시간 세션 상태와 학생 QR 접속 판정을 100% 완벽히 상호 동기화)
 */
export async function checkClassAccess(params: {
  classId?: string;
  joinToken?: string;
}): Promise<AccessCheckResult> {
  const { classId, joinToken } = params;

  if (!classId && !joinToken) {
    return { isAllowed: false, reason: '반 식별 정보가 입력되지 않았습니다.' };
  }

  // 1. 반 조회
  const targetClass = await prisma.class.findFirst({
    where: classId ? { id: classId } : { joinToken },
    include: {
      schedules: true,
      scheduleExceptions: true,
      settingVersions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });

  if (!targetClass || !targetClass.isActive) {
    return { isAllowed: false, reason: '존재하지 않거나 비활성화된 반입니다.' };
  }

  const now = getSeoulNow();
  const latestSetting = targetClass.settingVersions[0];
  const preEntryMin = latestSetting?.preEntryMinutes ?? 10;
  const graceMin = latestSetting?.gracePeriodMinutes ?? 10;
  const todayStr = getSeoulDateKey(now);

  // 2. 오늘 휴강(CANCEL) 예외가 있는지 확인
  const isCanceledToday = targetClass.scheduleExceptions.some(
    (e) => e.type === 'CANCEL' && getSeoulDateKey(e.date) === todayStr
  );

  if (isCanceledToday) {
    return { isAllowed: false, reason: '오늘은 휴강일로 지정되어 수업 및 제출이 차단됩니다.' };
  }

  const currentDayOfWeek = getSeoulDayOfWeek(now);
  const currentHHMM = getSeoulHourMinute(now);
  const todaySchedules = targetClass.schedules.filter((s) => s.dayOfWeek === currentDayOfWeek);

  const buildScheduleWindow = (sch: (typeof todaySchedules)[number]) => {
    const [startH, startM] = sch.startTime.split(':').map(Number);
    const [endH, endM] = sch.endTime.split(':').map(Number);

    const schedulePreEntryMin = sch.preEntryMinutes || preEntryMin;
    const scheduleGraceMin = sch.gracePeriodMinutes || graceMin;
    const scheduledStart = createSeoulDateTime(now, startH, startM);
    const scheduledEnd = createSeoulDateTime(now, endH, endM);
    const allowedStartDate = new Date(
      scheduledStart.getTime() - schedulePreEntryMin * 60 * 1000,
    );
    const allowedEndDate = new Date(
      scheduledEnd.getTime() + scheduleGraceMin * 60 * 1000,
    );

    return {
      scheduledStart,
      scheduledEnd,
      allowedStartDate,
      allowedEndDate,
      schedulePreEntryMin,
      scheduleGraceMin,
    };
  };

  // 3. 현재 활성화(OPEN)된 ClassSession 조회
  const activeSession = await prisma.classSession.findFirst({
    where: {
      classId: targetClass.id,
      status: { in: ['OPEN', 'EXTENDED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeSession) {
    const activeScheduleWindow = todaySchedules
      .map(buildScheduleWindow)
      .find(
        (window) =>
          now.getTime() >= window.allowedStartDate.getTime() &&
          now.getTime() <= window.allowedEndDate.getTime(),
      );

    if (activeScheduleWindow) {
      const allowedStart = activeScheduleWindow.allowedStartDate;
      const allowedEnd = activeScheduleWindow.allowedEndDate;

      if (
        activeSession.actualAllowedStart.getTime() !== allowedStart.getTime() ||
        activeSession.actualAllowedEnd.getTime() !== allowedEnd.getTime()
      ) {
        await prisma.classSession.update({
          where: { id: activeSession.id },
          data: {
            scheduledStartTime: activeScheduleWindow.scheduledStart,
            scheduledEndTime: activeScheduleWindow.scheduledEnd,
            actualAllowedStart: allowedStart,
            actualAllowedEnd: allowedEnd,
          },
        });
      }

      return {
        isAllowed: true,
        classId: targetClass.id,
        className: targetClass.name,
        classSessionId: activeSession.id,
        actualAllowedStart: allowedStart,
        actualAllowedEnd: allowedEnd,
        preEntryMinutes: activeScheduleWindow.schedulePreEntryMin,
        gracePeriodMinutes: activeScheduleWindow.scheduleGraceMin,
      };
    } else {
      // 시간 경과로 인한 세션 자동 마감 처리
      await prisma.$transaction([
        prisma.classSession.update({
          where: { id: activeSession.id },
          data: { status: 'CLOSED' },
        }),
        prisma.studentAttendance.updateMany({
          where: {
            classSessionId: activeSession.id,
            exitAt: null,
          },
          data: {
            exitAt: now,
            exitSource: 'AUTO_SESSION_END',
          },
        }),
      ]);
    }
  }

  // 4. 정규 시간표 조건 확인 (수업 정규 시간대이면 새로 OPEN 세션을 개방하여 접속 허용)
  for (const sch of todaySchedules) {
    const {
      scheduledStart,
      scheduledEnd,
      allowedStartDate,
      allowedEndDate,
      schedulePreEntryMin,
      scheduleGraceMin,
    } = buildScheduleWindow(sch);

    if (now.getTime() >= allowedStartDate.getTime() && now.getTime() <= allowedEndDate.getTime()) {
      // 정규 시간표 시간대에 해당함 -> ClassSession 생성하여 즉시 OPEN
      const newSession = await prisma.classSession.create({
        data: {
          classId: targetClass.id,
          settingVersionId: latestSetting?.id,
          date: now,
          scheduledStartTime: scheduledStart,
          scheduledEndTime: scheduledEnd,
          actualAllowedStart: allowedStartDate,
          actualAllowedEnd: allowedEndDate,
          status: 'OPEN',
          snapshotData: JSON.stringify({
            className: targetClass.name,
            version: latestSetting?.version || 1,
            preEntryMinutes: schedulePreEntryMin,
            gracePeriodMinutes: scheduleGraceMin,
          }),
        },
      });

      return {
        isAllowed: true,
        classId: targetClass.id,
        className: targetClass.name,
        classSessionId: newSession.id,
        actualAllowedStart: allowedStartDate,
        actualAllowedEnd: allowedEndDate,
        preEntryMinutes: schedulePreEntryMin,
        gracePeriodMinutes: scheduleGraceMin,
      };
    }
  }

  // 허용 시간이 아님
  const dayKorean = getSeoulDayName(now);
  return {
    isAllowed: false,
    reason: `현재(${dayKorean}요일 ${currentHHMM})는 ${targetClass.name}의 수업 접속 허용 시간이 아닙니다.`,
  };
}

/**
 * 강사가 해당 반(classId)의 소유자이거나 관리자(ADMIN) 권한인지 검증하는 함수
 */
export async function verifyClassOwnership(classId: string, teacherId: string, role: 'ADMIN' | 'TEACHER'): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const targetClass = await prisma.class.findFirst({
    where: {
      id: classId,
      teacherId,
    },
    select: { id: true },
  });

  return Boolean(targetClass);
}

/**
 * 강사가 해당 학생의 PIN을 재설정할 수 있는지 검증하는 함수
 * - ADMIN: 모든 학생 가능
 * - TEACHER: 본인 담당 반에 수강 이력이 있는 학생만 가능
 */
export async function verifyStudentPinResetPermission(
  studentId: string,
  teacherId: string,
  role: 'ADMIN' | 'TEACHER'
): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      class: {
        teacherId,
      },
    },
    select: { id: true },
  });

  return Boolean(enrollment);
}
