import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';
import { verifyClassOwnership } from '@/lib/accessControl';
import { z } from 'zod';

const createScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm 형식으로 입력해 주세요.'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm 형식으로 입력해 주세요.'),
  preEntryMinutes: z.number().default(10),
  gracePeriodMinutes: z.number().default(10),
});

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
    const result = createScheduleSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const schedule = await prisma.classSchedule.create({
      data: {
        classId,
        ...result.data,
      },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('Create schedule error:', error);
    return NextResponse.json({ error: '시간표 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (!scheduleId) {
      return NextResponse.json({ error: '시간표 ID가 필요합니다.' }, { status: 400 });
    }

    const schedule = await prisma.classSchedule.findUnique({
      where: { id: scheduleId },
      select: { classId: true },
    });
    if (!schedule) {
      return NextResponse.json({ error: '시간표 항목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = await verifyClassOwnership(schedule.classId, session.teacherId, session.role);
    if (!isOwner) {
      return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
    }

    await prisma.classSchedule.delete({ where: { id: scheduleId } });

    return NextResponse.json({ success: true, message: '시간표 항목이 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    return NextResponse.json({ error: '시간표 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
