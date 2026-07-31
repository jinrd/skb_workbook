import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTeacherSession } from "@/lib/auth";
import { z } from "zod";

const createClassSchema = z.object({
  name: z.string().min(1, "반 이름을 입력해 주세요."),
  description: z.string().optional(),
  teacherId: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    // 관리자는 전체 반, 일반 강사는 본인 담당 반 조회
    const whereCondition =
      session.role === "ADMIN" ? {} : { teacherId: session.teacherId };

    const classes = await prisma.class.findMany({
      where: whereCondition,
      include: {
        teacher: { select: { id: true, name: true, loginId: true } },
        enrollments: {
          where: { droppedAt: null },
          include: { student: { select: { id: true, name: true } } },
        },
        practiceGoals: { where: { isActive: true } },
        schedules: true,
        settingVersions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Fetch classes error:", error);
    return NextResponse.json(
      { error: "반 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const result = createClassSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, description, teacherId } = result.data;
    const assignedTeacherId =
      session.role === "ADMIN" && teacherId ? teacherId : session.teacherId;

    // 무작위 12자리 고정 QR 토큰 생성
    const randomArray = new Uint8Array(8);
    crypto.getRandomValues(randomArray);
    const randomHex = Array.from(randomArray, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const joinToken = `class-${randomHex}`;

    // 반 생성 및 기본 설정 버전 생성
    const newClass = await prisma.class.create({
      data: {
        name,
        description,
        joinToken,
        teacherId: assignedTeacherId,
        settingVersions: {
          create: {
            version: 1,
            name: `${name} 기본 설정 v1`,
            preEntryMinutes: 10,
            gracePeriodMinutes: 10,
            maxFilesPerSub: 5,
            maxFileSizeMB: 10,
            changedById: session.teacherId,
          },
        },
      },
      include: {
        teacher: { select: { id: true, name: true, loginId: true } },
      },
    });

    return NextResponse.json({ success: true, newClass });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json(
      { error: "반 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
