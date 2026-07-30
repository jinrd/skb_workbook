import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession, hashSecret } from '@/lib/auth';
import { verifyClassOwnership, verifyStudentPinResetPermission } from '@/lib/accessControl';
import { z } from 'zod';

const enrollStudentsSchema = z.object({
  studentIds: z.array(z.string()).min(1, '최소 1명 이상의 학생을 선택해야 합니다.'),
});

const resetPinSchema = z.object({
  studentId: z.string().min(1, '학생 ID가 누락되었습니다.'),
  newPin: z.string().length(4, '새 PIN 번호는 4자리 숫자여야 합니다.'),
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
    const result = enrollStudentsSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { studentIds } = result.data;

    // 복수 학생 배정 처리
    for (const studentId of studentIds) {
      const existing = await prisma.enrollment.findUnique({
        where: {
          classId_studentId: { classId, studentId },
        },
      });

      if (existing) {
        if (existing.droppedAt) {
          // 이미 배정되었으나 제외된 상태면 다시 살림
          await prisma.enrollment.update({
            where: { id: existing.id },
            data: { droppedAt: null },
          });
        }
      } else {
        // 새 배정
        await prisma.enrollment.create({
          data: { studentId, classId },
        });
      }
    }

    return NextResponse.json({ success: true, message: '선택한 학생이 성공적으로 배정되었습니다.' });
  } catch (error) {
    console.error('Add student error:', error);
    return NextResponse.json({ error: '학생 등록 중 오류가 발생했습니다.' }, { status: 500 });
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

    const body = await request.json();
    const result = resetPinSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { studentId, newPin } = result.data;
    const { classId } = await params;

    if (session.role !== 'ADMIN') {
      const isOwner = await verifyClassOwnership(classId, session.teacherId, session.role);
      if (!isOwner) {
        return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
      }

      const studentInClass = await prisma.enrollment.findFirst({
        where: { classId, studentId },
        select: { id: true },
      });
      if (!studentInClass) {
        return NextResponse.json({ error: '해당 반의 수강생이 아닙니다.' }, { status: 403 });
      }

      const canResetPin = await verifyStudentPinResetPermission(studentId, session.teacherId, session.role);
      if (!canResetPin) {
        return NextResponse.json({ error: '해당 학생의 PIN 번호를 재설정할 권한이 없습니다.' }, { status: 403 });
      }
    }

    const newPinHash = await hashSecret(newPin);

    await prisma.student.update({
      where: { id: studentId },
      data: { pinHash: newPinHash },
    });

    return NextResponse.json({ success: true, message: '학생 PIN 번호가 성공적으로 재설정되었습니다.' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return NextResponse.json({ error: 'PIN 번호 재설정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
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
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: '학생 ID가 필요합니다.' }, { status: 400 });
    }

    // 학생을 수강 목록에서 제외 (Plan.md: 제외 처리는 droppedAt 기록으로 다음 수업부터 반영)
    await prisma.enrollment.updateMany({
      where: { classId, studentId },
      data: { droppedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: '학생이 반에서 제외되었습니다 (다음 수업부터 반영됨).' });
  } catch (error) {
    console.error('Drop student error:', error);
    return NextResponse.json({ error: '학생 제외 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
