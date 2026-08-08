import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeacherSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const postSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  changeType: z.string().trim().min(1),
  version: z.string().trim().optional(),
  target: z.string().trim().optional(),
  publishedAt: z.string().datetime().optional(),
});

async function requireSession() {
  const session = await getTeacherSession();
  return session;
}

function isDeveloper(session: Awaited<ReturnType<typeof requireSession>>) {
  return Boolean(session?.loginId.startsWith("gkwlsdnjs95"));
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

    const updates = await prisma.updatePost.findMany({
      include: { author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
    });
    const unreadCount = await prisma.updatePost.count({
      where: {
        reads: { none: { teacherId: session.teacherId } },
      },
    });
    return NextResponse.json({ updates, unreadCount, isDeveloper: isDeveloper(session) });
  } catch (error) {
    console.error("Fetch update posts error:", error);
    return NextResponse.json({ error: "업데이트 기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!isDeveloper(session)) return NextResponse.json({ error: "개발자만 업데이트 기록을 작성할 수 있습니다." }, { status: 403 });
  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 });
  const update = await prisma.updatePost.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      changeType: parsed.data.changeType,
      version: parsed.data.version || null,
      target: parsed.data.target || null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
      authorId: session.teacherId,
    },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json({ success: true, update });
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!isDeveloper(session)) return NextResponse.json({ error: "개발자만 업데이트 기록을 수정할 수 있습니다." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const parsed = postSchema.safeParse(body);
  if (!id || !parsed.success) return NextResponse.json({ error: "입력 내용을 확인해 주세요." }, { status: 400 });
  const update = await prisma.updatePost.update({
    where: { id },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      changeType: parsed.data.changeType,
      version: parsed.data.version || null,
      target: parsed.data.target || null,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined,
    },
    include: { author: { select: { name: true } } },
  });
  return NextResponse.json({ success: true, update });
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  if (!isDeveloper(session)) return NextResponse.json({ error: "개발자만 업데이트 기록을 삭제할 수 있습니다." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "기록 ID가 필요합니다." }, { status: 400 });
  await prisma.updatePost.delete({ where: { id: body.id } });
  return NextResponse.json({ success: true });
}
