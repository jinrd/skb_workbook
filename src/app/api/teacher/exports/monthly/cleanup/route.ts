import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeacherSession } from "@/lib/auth";
import { runMonthlyCleanup } from "@/lib/monthlyCleanup";

const requestSchema = z.object({
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export async function POST(request: Request) {
  try {
    const session = await getTeacherSession();

    if (!session) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    if (session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자만 월별 보관 정리를 실행할 수 있습니다." },
        { status: 403 },
      );
    }

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "정리할 월 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const result = await runMonthlyCleanup(parsed.data.periodKey);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Monthly cleanup failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "월별 보관 정리 중 문제가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
