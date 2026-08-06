import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자만 감사 로그를 조회할 수 있습니다.' }, { status: 403 });
    }

    // 최근 100개의 시스템 작업 로그(Cleanup) 조회
    const auditLogs = await prisma.cleanupLog.findMany({
      take: 100,
      orderBy: {
        executedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      auditLogs,
    });
  } catch (error) {
    console.error('Fetch audit logs error:', error);
    return NextResponse.json(
      { error: '감사 로그를 가져오는 도중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
