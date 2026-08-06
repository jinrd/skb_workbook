import { NextResponse } from "next/server";
import { clearStudentSession, getStudentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getStudentSession();

  if (!session) {
    return NextResponse.json(
      { error: "학생 세션이 만료되었습니다. QR 코드로 다시 입장해 주세요." },
      { status: 401 },
    );
  }

  const attendance = await prisma.studentAttendance.update({
    where: {
      classSessionId_studentId: {
        classSessionId: session.classSessionId,
        studentId: session.studentId,
      },
    },
    data: {
      exitAt: new Date(),
      exitSource: "MANUAL",
    },
  });

  await prisma.studentSession.updateMany({
    where: {
      id: session.studentSessionId,
      studentId: session.studentId,
      classSessionId: session.classSessionId,
    },
    data: {
      isValid: false,
    },
  });

  await clearStudentSession();

  return NextResponse.json({
    success: true,
    exitAt: attendance.exitAt,
    redirectUrl: "/student/exit-complete",
  });
}
