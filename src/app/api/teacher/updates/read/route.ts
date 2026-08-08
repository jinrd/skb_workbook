import { NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const updates = await prisma.updatePost.findMany({ select: { id: true } });
  await prisma.updatePostRead.createMany({
    data: updates.map((update) => ({ updatePostId: update.id, teacherId: session.teacherId })),
    skipDuplicates: true,
  });
  return NextResponse.json({ success: true });
}
