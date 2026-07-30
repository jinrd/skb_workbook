import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';
import { verifyClassOwnership } from '@/lib/accessControl';
import { z } from 'zod';

const updateClassSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  regenerateToken: z.boolean().optional(),
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

    const classDetail = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        teacher: { select: { id: true, name: true, loginId: true } },
        enrollments: {
          where: { droppedAt: null },
          include: { student: true },
          orderBy: { student: { name: 'asc' } },
        },
        practiceCategories: { orderBy: { createdAt: 'asc' } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        scheduleExceptions: { orderBy: { date: 'asc' } },
        settingVersions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!classDetail) {
      return NextResponse.json({ error: '반 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ class: classDetail });
  } catch (error) {
    console.error('Get class detail error:', error);
    return NextResponse.json({ error: '반 상세 정보를 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(
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
    const result = updateClassSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, description, isActive, regenerateToken } = result.data;

    let joinToken = undefined;
    if (regenerateToken) {
      const randomArray = new Uint8Array(8);
      crypto.getRandomValues(randomArray);
      joinToken = `class-${Array.from(randomArray, b => b.toString(16).padStart(2, '0')).join('')}`;
    }

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(joinToken && { joinToken }),
      },
    });

    return NextResponse.json({ success: true, updatedClass });
  } catch (error) {
    console.error('Update class error:', error);
    return NextResponse.json({ error: '반 정보 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
