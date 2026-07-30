import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession, hashSecret } from '@/lib/auth';
import { z } from 'zod';

const createStudentSchema = z.object({
  name: z.string().min(2, '학생 이름은 2자 이상이어야 합니다.').max(20, '이름이 너무 깁니다.'),
  pin: z.string().length(4, 'PIN은 4자리 숫자여야 합니다.').regex(/^\d{4}$/, '숫자만 입력 가능합니다.'),
});

export async function GET() {
  try {
    const session = await getTeacherSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const students = await prisma.student.findMany({
      orderBy: { name: 'asc' },
      include: {
        enrollments: {
          include: {
            class: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error('Fetch students error:', error);
    return NextResponse.json({ error: '학생 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const body = await request.json();
    const result = createStudentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { name, pin } = result.data;
    const pinHash = await hashSecret(pin);

    const newStudent = await prisma.student.create({
      data: {
        name,
        pinHash,
      },
    });

    return NextResponse.json({ success: true, student: newStudent });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json({ error: '학생 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: '삭제할 학생 ID가 필요합니다.' }, { status: 400 });
    }

    await prisma.student.delete({
      where: { id: studentId },
    });

    return NextResponse.json({ success: true, message: '학생이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json({ error: '학생 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
