import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getStudentSession();

    if (!session) {
      return NextResponse.json(
        {
          error:
            "학생 세션이 만료되었거나 존재하지 않습니다. QR 코드로 다시 입장해 주세요.",
        },
        { status: 401 },
      );
    }

    // 해당 반과 활성화된 연습 목표를 조회합니다.
    const targetClass = await prisma.class.findUnique({
      where: { id: session.classId },
      include: {
        practiceGoals: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!targetClass) {
      return NextResponse.json(
        { error: "반 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const mySubmissions = await prisma.submission.findMany({
      where: {
        studentId: session.studentId,
        classId: session.classId,
        classSessionId: session.classSessionId,
      },
      include: {
        files: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    return NextResponse.json({
      studentName: session.studentName,
      className: targetClass.name,
      goals: targetClass.practiceGoals,
      submissions: mySubmissions,
    });
  } catch (error) {
    console.error("Fetch student session info error:", error);

    return NextResponse.json(
      { error: "학생 세션 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
