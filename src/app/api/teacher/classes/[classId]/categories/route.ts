import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';
import { verifyClassOwnership } from '@/lib/accessControl';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1, '연습 종목명을 입력해 주세요.'),
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
    const result = createCategorySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const category = await prisma.practiceCategory.create({
      data: {
        classId,
        name: result.data.name,
      },
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: '연습 종목 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json({ error: '종목 ID가 필요합니다.' }, { status: 400 });
    }

    const category = await prisma.practiceCategory.findUnique({
      where: { id: categoryId },
      select: { classId: true },
    });
    if (!category) {
      return NextResponse.json({ error: '연습 종목을 찾을 수 없습니다.' }, { status: 404 });
    }

    const isOwner = await verifyClassOwnership(category.classId, session.teacherId, session.role);
    if (!isOwner) {
      return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
    }

    await prisma.practiceCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: '연습 종목이 비활성화되었습니다.' });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: '연습 종목 비활성화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
