import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';
import { verifyClassOwnership } from '@/lib/accessControl';
import { createNewClassSettingVersion } from '@/lib/sessionEngine';
import { z } from 'zod';

const updateSettingSchema = z.object({
  preEntryMinutes: z.number().min(0).max(120).optional(),
  gracePeriodMinutes: z.number().min(0).max(120).optional(),
  maxFilesPerSub: z.number().min(1).max(20).optional(),
  maxFileSizeMB: z.number().min(5).max(500).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { classId } = await params;
    const isOwner = await verifyClassOwnership(classId, session.teacherId, session.role);
    if (!isOwner) {
      return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
    }

    const settingVersions = await prisma.classSettingVersion.findMany({
      where: { classId },
      orderBy: { version: 'desc' },
    });

    const changeLogs = await prisma.settingChangeLog.findMany({
      where: { classId },
      include: { teacher: { select: { name: true, loginId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({ settingVersions, changeLogs });
  } catch (error) {
    console.error('Fetch settings error:', error);
    return NextResponse.json({ error: '반 설정 이력을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { classId } = await params;
    const isOwner = await verifyClassOwnership(classId, session.teacherId, session.role);
    if (!isOwner) {
      return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateSettingSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    // 1. 기존 최신 버전 조회
    const latestVersion = await prisma.classSettingVersion.findFirst({
      where: { classId },
      orderBy: { version: 'desc' },
    });

    const beforeVal = JSON.stringify({
      preEntryMinutes: latestVersion?.preEntryMinutes,
      gracePeriodMinutes: latestVersion?.gracePeriodMinutes,
      maxFilesPerSub: latestVersion?.maxFilesPerSub,
      maxFileSizeMB: latestVersion?.maxFileSizeMB,
    });

    const afterVal = JSON.stringify(result.data);

    // 2. 새 설정 버전 및 변경 이력 로그 기록 (Plan.md: 이 변경은 진행 중인 수업이 아닌 다음 수업부터 적용)
    const newVersion = await createNewClassSettingVersion({
      classId,
      teacherId: session.teacherId,
      changeType: 'GENERAL_SETTING_UPDATE',
      beforeValue: beforeVal,
      afterValue: afterVal,
      ...result.data,
    });

    return NextResponse.json({
      success: true,
      newVersion,
      message: '반 설정이 성공적으로 저장되어 진행 중인 수업 및 향후 수업에 즉시 적용되었습니다.',
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: '반 설정 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
