import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherSession } from "@/lib/auth";
import { verifyClassOwnership } from "@/lib/accessControl";
import { z } from "zod";

const createPracticeGoalSchema = z.object({
  name: z.string().min(1, "연습 목표명을 입력해 주세요."),
});

const updatePracticeGoalSchema = z.object({
  practiceGoalId: z.string().min(1, "연습 목표 ID가 필요합니다."),
  name: z.string().min(1, "연습 목표명을 입력해 주세요."),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { classId } = await params;
    const isOwner = await verifyClassOwnership(
      classId,
      session.teacherId,
      session.role,
    );
    if (!isOwner) {
      return NextResponse.json(
        { error: "해당 반에 대한 접근 권한이 없습니다." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const result = createPracticeGoalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const practiceGoal = await prisma.practiceGoal.create({
      data: {
        classId,
        name: result.data.name,
      },
    });

    return NextResponse.json({ success: true, practiceGoal });
  } catch (error) {
    console.error("Create practice goal error:", error);
    return NextResponse.json(
      { error: "연습 목표 추가 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const result = updatePracticeGoalSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const practiceGoal = await prisma.practiceGoal.findUnique({
      where: { id: result.data.practiceGoalId },
      select: { classId: true },
    });

    if (!practiceGoal) {
      return NextResponse.json(
        { error: "연습 목표를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const isOwner = await verifyClassOwnership(
      practiceGoal.classId,
      session.teacherId,
      session.role,
    );
    if (!isOwner) {
      return NextResponse.json(
        { error: "해당 반에 대한 접근 권한이 없습니다." },
        { status: 403 },
      );
    }

    const updatedPracticeGoal = await prisma.practiceGoal.update({
      where: { id: result.data.practiceGoalId },
      data: { name: result.data.name.trim() },
    });

    return NextResponse.json({
      success: true,
      practiceGoal: updatedPracticeGoal,
    });
  } catch (error) {
    console.error("Update practice goal error:", error);
    return NextResponse.json(
      { error: "연습 목표 수정 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const practiceGoalId = searchParams.get("practiceGoalId");

    if (!practiceGoalId) {
      return NextResponse.json(
        { error: "연습 목표 ID가 필요합니다." },
        { status: 400 },
      );
    }

    const practiceGoal = await prisma.practiceGoal.findUnique({
      where: { id: practiceGoalId },
      select: { classId: true },
    });
    if (!practiceGoal) {
      return NextResponse.json(
        { error: "연습 목표를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const isOwner = await verifyClassOwnership(
      practiceGoal.classId,
      session.teacherId,
      session.role,
    );
    if (!isOwner) {
      return NextResponse.json(
        { error: "해당 반에 대한 접근 권한이 없습니다." },
        { status: 403 },
      );
    }

    await prisma.practiceGoal.update({
      where: { id: practiceGoalId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "연습 목표가 비활성화되었습니다.",
    });
  } catch (error) {
    console.error("Delete practice goal error:", error);
    return NextResponse.json(
      { error: "연습 목표 비활성화 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
