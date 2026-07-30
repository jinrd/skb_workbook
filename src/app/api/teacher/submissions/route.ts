import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';

/**
 * 낱개 Submission 데이터를 기반으로 DailyStudentReport를 무한 누적이 아닌 '정확히 재계산(Recalculate)'하는 안전한 백필 함수
 */
export async function recalculateDailyReportsFromSubmissions() {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        classSession: {
          select: { classId: true },
        },
      },
    });

    // studentId_classId_date -> 집계 객체 맵
    const reportMap = new Map<string, {
      studentId: string;
      classId: string;
      date: string;
      totalDurationMinutes: number;
      submissionCount: number;
      categorySummaryMap: Record<string, number>;
      memosSet: Set<string>;
    }>();

    for (const sub of submissions) {
      const dateStr = sub.submittedAt.toISOString().split('T')[0];
      const classId = sub.classSession.classId;
      const studentId = sub.studentId;
      const key = `${studentId}_${classId}_${dateStr}`;

      if (!reportMap.has(key)) {
        reportMap.set(key, {
          studentId,
          classId,
          date: dateStr,
          totalDurationMinutes: 0,
          submissionCount: 0,
          categorySummaryMap: {},
          memosSet: new Set(),
        });
      }

      const item = reportMap.get(key)!;
      item.totalDurationMinutes += sub.durationMinutes;
      item.submissionCount += 1;
      item.categorySummaryMap[sub.categoryName] = (item.categorySummaryMap[sub.categoryName] || 0) + sub.durationMinutes;
      if (sub.content && sub.content.trim()) {
        item.memosSet.add(sub.content.trim());
      }
    }

    // 데이터베이스에 정확히 덮어쓰기 (Upsert)
    for (const item of reportMap.values()) {
      await prisma.dailyStudentReport.upsert({
        where: {
          studentId_classId_date: {
            studentId: item.studentId,
            classId: item.classId,
            date: item.date,
          },
        },
        update: {
          totalDurationMinutes: item.totalDurationMinutes,
          submissionCount: item.submissionCount,
          categorySummary: JSON.stringify(item.categorySummaryMap),
          memos: JSON.stringify(Array.from(item.memosSet)),
        },
        create: {
          studentId: item.studentId,
          classId: item.classId,
          date: item.date,
          totalDurationMinutes: item.totalDurationMinutes,
          submissionCount: item.submissionCount,
          categorySummary: JSON.stringify(item.categorySummaryMap),
          memos: JSON.stringify(Array.from(item.memosSet)),
        },
      });
    }
  } catch (err) {
    console.error('Recalculate daily reports error:', err);
  }
}

export async function GET(request: Request) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const dateStr = searchParams.get('date'); // YYYY-MM-DD
    const studentName = searchParams.get('studentName');

    // 1. 강사 소유 클래스 안전 조회 (ADMIN은 전체 반, 일반 강사는 본인 담당 반)
    const teacherClasses = await prisma.class.findMany({
      where: session.role === 'ADMIN' ? {} : { teacherId: session.teacherId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const allowedClassIds = teacherClasses.map((c) => c.id);

    // 일반 강사인데 소유한 반이 없는 경우 빈 결과 반환
    if (session.role !== 'ADMIN' && allowedClassIds.length === 0) {
      return NextResponse.json({
        dailyReports: [],
        summary: { totalReportsCount: 0, totalSubmissionCount: 0, totalDurationMinutes: 0 },
        teacherClasses: [],
      });
    }

    // 2. 검색 조건 구성 (DailyStudentReport 기준)
    const whereCondition: Record<string, unknown> = {};

    if (classId) {
      if (session.role !== 'ADMIN' && !allowedClassIds.includes(classId)) {
        return NextResponse.json({ error: '해당 반의 제출물을 조회할 권한이 없습니다.' }, { status: 403 });
      }
      whereCondition.classId = classId;
    } else if (session.role !== 'ADMIN') {
      whereCondition.classId = { in: allowedClassIds };
    }

    if (dateStr) {
      whereCondition.date = dateStr;
    }

    if (studentName && studentName.trim() !== '') {
      whereCondition.student = {
        name: { contains: studentName.trim() },
      };
    }

    const dailyReports = await prisma.dailyStudentReport.findMany({
      where: whereCondition,
      include: {
        student: {
          select: { id: true, name: true },
        },
        class: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const totalDurationMinutes = dailyReports.reduce((sum, r) => sum + (r.totalDurationMinutes || 0), 0);
    const totalSubmissionCount = dailyReports.reduce((sum, r) => sum + (r.submissionCount || 0), 0);

    return NextResponse.json({
      dailyReports,
      summary: {
        totalReportsCount: dailyReports.length,
        totalSubmissionCount,
        totalDurationMinutes,
      },
      teacherClasses,
    });
  } catch (error) {
    console.error('Fetch teacher daily reports error:', error);
    return NextResponse.json(
      { error: '학생 일별 종합 기록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
