import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySecret, setTeacherSessionCookie } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  loginId: z.string().min(1, '아이디를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { loginId, password } = result.data;

    // 강사 / 관리자 조회
    const teacher = await prisma.teacher.findUnique({
      where: { loginId },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 검증
    const isValid = await verifySecret(teacher.passwordHash, password);
    if (!isValid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 쿠키 세션 발급
    await setTeacherSessionCookie({
      teacherId: teacher.id,
      loginId: teacher.loginId,
      name: teacher.name,
      role: teacher.role,
    });

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        loginId: teacher.loginId,
        role: teacher.role,
      },
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
