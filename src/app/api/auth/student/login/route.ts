import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySecret, hashSecret, setStudentSessionCookie } from "@/lib/auth";
import { checkClassAccess } from "@/lib/accessControl";
import { z } from "zod";

const studentAuthSchema = z.object({
  joinToken: z.string().min(1, "반 토큰이 누락되었습니다."),
  name: z.string().min(1, "이름을 입력해 주세요."),
  pin: z.string().length(4, "PIN 번호는 4자리 숫자여야 합니다."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = studentAuthSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { joinToken, name, pin } = result.data;

    // 1. 실시간 동적 접속 통제 가드 검증 (Plan.md 준수)
    const accessCheck = await checkClassAccess({ joinToken });
    if (!accessCheck.isAllowed) {
      return NextResponse.json(
        { error: accessCheck.reason || "현재 수업 접속 허용 시간이 아닙니다." },
        { status: 403 },
      );
    }

    const classId = accessCheck.classId!;
    const classSessionId = accessCheck.classSessionId!;
    const expiresAt = accessCheck.actualAllowedEnd!;

    // 2. 학생 존재 여부 및 PIN 4자리 검증
    const existingStudents = await prisma.student.findMany({
      where: { name },
    });

    let authenticatedStudent = null;

    for (const student of existingStudents) {
      if (student.isBlocked) continue; // 차단된 학생 제외
      const isValid = await verifySecret(student.pinHash, pin);
      if (isValid) {
        authenticatedStudent = student;
        break;
      }
    }

    // 신규 수강생인 경우 자동 등록
    if (!authenticatedStudent) {
      if (existingStudents.length === 0) {
        const pinHash = await hashSecret(pin);
        authenticatedStudent = await prisma.student.create({
          data: {
            name,
            pinHash,
            enrollments: {
              create: { classId },
            },
          },
        });
      } else {
        return NextResponse.json(
          { error: "이름 또는 PIN 번호가 올바르지 않습니다." },
          { status: 401 },
        );
      }
    }

    // 3. StudentSession 기록 생성
    const studentSessionToken = `std_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const studentSession = await prisma.studentSession.create({
      data: {
        classSessionId,
        studentId: authenticatedStudent.id,
        token: studentSessionToken,
        expiresAt,
        isValid: true,
      },
    });

    // 4. 단기 세션 쿠키 설정
    await setStudentSessionCookie(
      {
        studentSessionId: studentSession.id,
        studentId: authenticatedStudent.id,
        studentName: authenticatedStudent.name,
        classSessionId,
        classId,
        className: accessCheck.className!,
      },
      expiresAt,
    );

    // 학생의 반 입실 시간 기록(upsert 로 한번 insert 후 입실 시간 변경되지 않게 )
    await prisma.studentAttendance.upsert({
      where: {
        classSessionId_studentId: {
          classSessionId,
          studentId: authenticatedStudent.id,
        },
      },
      create: {
        classId,
        classSessionId,
        studentId: authenticatedStudent.id,
        entryAt: new Date(),
      },
      update: {},
    });

    return NextResponse.json({
      success: true,
      studentName: authenticatedStudent.name,
      className: accessCheck.className,
      redirectUrl: "/student/submit",
    });
  } catch (error) {
    console.error("Student auth error:", error);
    return NextResponse.json(
      { error: "학생 인증 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
