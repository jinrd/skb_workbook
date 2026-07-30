import { prisma } from '@/lib/prisma';
import { getSeoulNow } from '@/lib/timezone';

export interface SessionSnapshotData {
  className: string;
  version: number;
  settingVersionId: string;
  preEntryMinutes: number;
  gracePeriodMinutes: number;
  maxFilesPerSub: number;
  maxFileSizeMB: number;
  categories: { id: string; name: string }[];
  enrolledStudents: { studentId: string; name: string }[];
  snapshotCreatedAt: string;
}

/**
 * 반 설정을 변경할 때 최신 버전을 저장하고, 
 * 현재 진행 중인 활성 수업 회차(ClassSession)가 있다면 즉시 함께 반영하는 함수 (사용자 직접 요구 반영)
 */
export async function createNewClassSettingVersion(params: {
  classId: string;
  teacherId: string;
  changeType: string;
  beforeValue: string;
  afterValue: string;
  preEntryMinutes?: number;
  gracePeriodMinutes?: number;
  maxFilesPerSub?: number;
  maxFileSizeMB?: number;
}) {
  const {
    classId,
    teacherId,
    changeType,
    beforeValue,
    afterValue,
    preEntryMinutes,
    gracePeriodMinutes,
    maxFilesPerSub,
    maxFileSizeMB,
  } = params;

  // 1. 현재 최신 버전 조회
  const latestVersion = await prisma.classSettingVersion.findFirst({
    where: { classId },
    orderBy: { version: 'desc' },
  });

  const nextVersionNumber = (latestVersion?.version || 0) + 1;

  const finalPreEntry = preEntryMinutes ?? latestVersion?.preEntryMinutes ?? 10;
  const finalGrace = gracePeriodMinutes ?? latestVersion?.gracePeriodMinutes ?? 10;
  const finalMaxFiles = maxFilesPerSub ?? latestVersion?.maxFilesPerSub ?? 5;
  const finalMaxFileSize = maxFileSizeMB ?? latestVersion?.maxFileSizeMB ?? 10;

  // 2. 새 ClassSettingVersion 생성
  const newSettingVersion = await prisma.classSettingVersion.create({
    data: {
      classId,
      version: nextVersionNumber,
      name: `설정 버전 v${nextVersionNumber}`,
      preEntryMinutes: finalPreEntry,
      gracePeriodMinutes: finalGrace,
      maxFilesPerSub: finalMaxFiles,
      maxFileSizeMB: finalMaxFileSize,
      changedById: teacherId,
    },
  });

  // 3. SettingChangeLog 이력 기록
  await prisma.settingChangeLog.create({
    data: {
      classId,
      teacherId,
      changeType,
      beforeValue,
      afterValue,
      appliedFrom: `즉시 적용 (v${nextVersionNumber})`,
    },
  });

  // 4. 현재 진행 중(OPEN / EXTENDED)인 ClassSession이 존재하면 즉시 스냅샷 & 허용시간 갱신!
  const now = getSeoulNow();
  const activeSessions = await prisma.classSession.findMany({
    where: {
      classId,
      status: { in: ['OPEN', 'EXTENDED'] },
    },
  });

  for (const session of activeSessions) {
    try {
      let snapshotObj: SessionSnapshotData = {
        className: '',
        version: nextVersionNumber,
        settingVersionId: newSettingVersion.id,
        preEntryMinutes: finalPreEntry,
        gracePeriodMinutes: finalGrace,
        maxFilesPerSub: finalMaxFiles,
        maxFileSizeMB: finalMaxFileSize,
        categories: [],
        enrolledStudents: [],
        snapshotCreatedAt: now.toISOString(),
      };

      if (session.snapshotData) {
        snapshotObj = {
          ...JSON.parse(session.snapshotData),
          version: nextVersionNumber,
          settingVersionId: newSettingVersion.id,
          preEntryMinutes: finalPreEntry,
          gracePeriodMinutes: finalGrace,
          maxFilesPerSub: finalMaxFiles,
          maxFileSizeMB: finalMaxFileSize,
        };
      }

      // 사전접속 및 유예 시각 재계산
      const newAllowedStart = new Date(session.scheduledStartTime.getTime() - finalPreEntry * 60 * 1000);
      const newAllowedEnd = new Date(session.scheduledEndTime.getTime() + finalGrace * 60 * 1000);

      await prisma.classSession.update({
        where: { id: session.id },
        data: {
          settingVersionId: newSettingVersion.id,
          actualAllowedStart: newAllowedStart,
          actualAllowedEnd: newAllowedEnd,
          snapshotData: JSON.stringify(snapshotObj),
        },
      });
    } catch (e) {
      console.error('Active session instant update error:', e);
    }
  }

  return newSettingVersion;
}

/**
 * 수업 회차(ClassSession)를 생성할 때 해당 시점의 반 설정/학생/종목 스냅샷 복사 저장
 */
export async function createClassSessionSnapshot(params: {
  classId: string;
  date: Date;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualAllowedStart: Date;
  actualAllowedEnd: Date;
}) {
  const { classId, date, scheduledStartTime, scheduledEndTime, actualAllowedStart, actualAllowedEnd } = params;

  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      settingVersions: { orderBy: { version: 'desc' }, take: 1 },
      practiceCategories: { where: { isActive: true } },
      enrollments: {
        where: { droppedAt: null },
        include: { student: { select: { id: true, name: true } } },
      },
    },
  });

  if (!targetClass) {
    throw new Error('Target class not found.');
  }

  const latestSetting = targetClass.settingVersions[0];

  const snapshotDataObj: SessionSnapshotData = {
    className: targetClass.name,
    version: latestSetting?.version || 1,
    settingVersionId: latestSetting?.id || '',
    preEntryMinutes: latestSetting?.preEntryMinutes ?? 10,
    gracePeriodMinutes: latestSetting?.gracePeriodMinutes ?? 10,
    maxFilesPerSub: latestSetting?.maxFilesPerSub ?? 5,
    maxFileSizeMB: latestSetting?.maxFileSizeMB ?? 10,
    categories: targetClass.practiceCategories.map((c) => ({ id: c.id, name: c.name })),
    enrolledStudents: targetClass.enrollments.map((e) => ({ studentId: e.student.id, name: e.student.name })),
    snapshotCreatedAt: getSeoulNow().toISOString(),
  };

  const session = await prisma.classSession.create({
    data: {
      classId,
      settingVersionId: latestSetting?.id,
      date,
      scheduledStartTime,
      scheduledEndTime,
      actualAllowedStart,
      actualAllowedEnd,
      status: 'OPEN',
      snapshotData: JSON.stringify(snapshotDataObj),
    },
  });

  return session;
}
