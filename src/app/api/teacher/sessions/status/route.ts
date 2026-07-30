import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession, clearTeacherSession } from '@/lib/auth';
import { checkClassAccess } from '@/lib/accessControl';

export async function GET() {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const validTeacher = await prisma.teacher.findUnique({
      where: { id: session.teacherId },
    });

    if (!validTeacher) {
      await clearTeacherSession();
      return NextResponse.json(
        { error: '로그인 세션이 만료되었거나 리셋되었습니다. 다시 로그인해 주세요.' },
        { status: 401 }
      );
    }

    const whereCondition = validTeacher.role === 'ADMIN' ? {} : { teacherId: validTeacher.id };

    const classes = await prisma.class.findMany({
      where: whereCondition,
      select: { id: true, name: true, joinToken: true },
    });

    const activeSessionsMap = await Promise.all(
      classes.map(async (c) => {
        const accessCheck = await checkClassAccess({ classId: c.id });

        const activeSession = await prisma.classSession.findFirst({
          where: {
            classId: c.id,
            status: { in: ['OPEN', 'EXTENDED'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          classId: c.id,
          className: c.name,
          joinToken: c.joinToken,
          isAllowed: accessCheck.isAllowed,
          blockedReason: accessCheck.reason,
          activeSession: accessCheck.isAllowed ? activeSession : null,
        };
      })
    );

    return NextResponse.json({ sessions: activeSessionsMap });
  } catch (error) {
    console.error('Fetch active sessions error:', error);
    return NextResponse.json({ error: '수업 현황 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
