import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTeacherSession } from '@/lib/auth';
import { verifyClassOwnership } from '@/lib/accessControl';
import { getSeoulNow } from '@/lib/timezone';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getTeacherSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { classId } = await params;
    const isOwner = await verifyClassOwnership(classId, session.teacherId, session.role);
    if (!isOwner) {
      return NextResponse.json({ error: '해당 반에 대한 접근 권한이 없습니다.' }, { status: 403 });
    }

    // 반 정보 및 수강생 정보(Enrollment) 조회
    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          include: {
            student: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!targetClass) {
      return NextResponse.json({ error: '존재하지 않는 반입니다.' }, { status: 404 });
    }

    const enrolledStudents = targetClass.enrollments.map((e) => e.student);

    const now = getSeoulNow();
    const todayStr = now.toISOString().split('T')[0];
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // 1. 해당 반의 오늘 제출물(Submission) 레코드 조회
    const submissions = await prisma.submission.findMany({
      where: {
        classSession: {
          classId: classId,
        },
        submittedAt: {
          gte: startOfDay,
        },
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
        files: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    // 2. 해당 반의 오늘자 일별 종합 보고서(DailyStudentReport) 조회
    const dailyReports = await prisma.dailyStudentReport.findMany({
      where: {
        classId,
        date: todayStr,
      },
      include: {
        student: {
          select: { id: true, name: true },
        },
      },
    });

    // 데이터 집계 맵 초기화
    const categorySummaryMap: Record<string, { categoryName: string; count: number; totalMinutes: number }> = {};
    const studentSummaryMap: Record<string, { studentId: string; studentName: string; count: number; totalMinutes: number; categories: string[] }> = {};

    enrolledStudents.forEach((st) => {
      studentSummaryMap[st.id] = {
        studentId: st.id,
        studentName: st.name,
        count: 0,
        totalMinutes: 0,
        categories: [],
      };
    });

    // 3-A. Submission 이 있는 경우 우선 반영
    if (submissions.length > 0) {
      submissions.forEach((sub) => {
        if (!categorySummaryMap[sub.categoryName]) {
          categorySummaryMap[sub.categoryName] = {
            categoryName: sub.categoryName,
            count: 0,
            totalMinutes: 0,
          };
        }
        categorySummaryMap[sub.categoryName].count += 1;
        categorySummaryMap[sub.categoryName].totalMinutes += sub.durationMinutes || 0;

        if (studentSummaryMap[sub.studentId]) {
          studentSummaryMap[sub.studentId].count += 1;
          studentSummaryMap[sub.studentId].totalMinutes += sub.durationMinutes || 0;
          if (!studentSummaryMap[sub.studentId].categories.includes(sub.categoryName)) {
            studentSummaryMap[sub.studentId].categories.push(sub.categoryName);
          }
        }
      });
    } else {
      // 3-B. 원시 Submission이 없거나 4AM 청소된 경우, DailyStudentReport 로 보완 반영
      dailyReports.forEach((rpt) => {
        const catMap: Record<string, number> = JSON.parse(rpt.categorySummary || '{}');
        Object.entries(catMap).forEach(([catName, duration]) => {
          if (!categorySummaryMap[catName]) {
            categorySummaryMap[catName] = { categoryName: catName, count: 0, totalMinutes: 0 };
          }
          categorySummaryMap[catName].count += 1;
          categorySummaryMap[catName].totalMinutes += duration;
        });

        if (studentSummaryMap[rpt.studentId]) {
          studentSummaryMap[rpt.studentId].count = rpt.submissionCount;
          studentSummaryMap[rpt.studentId].totalMinutes = rpt.totalDurationMinutes;
          studentSummaryMap[rpt.studentId].categories = Object.keys(catMap);
        }
      });
    }

    const categorySummary = Object.values(categorySummaryMap).sort((a, b) => b.totalMinutes - a.totalMinutes);
    const studentSummary = Object.values(studentSummaryMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

    const totalCount = studentSummary.reduce((acc, st) => acc + st.count, 0);
    const totalDurationMinutes = studentSummary.reduce((acc, st) => acc + st.totalMinutes, 0);

    return NextResponse.json({
      classId: targetClass.id,
      className: targetClass.name,
      todayDateStr: todayStr,
      todayDate: now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
      summary: {
        totalCount,
        totalDurationMinutes,
      },
      categorySummary,
      studentSummary,
      recentSubmissions: submissions,
    });
  } catch (error) {
    console.error('Fetch class summary error:', error);
    return NextResponse.json({ error: '수업 결과 요약 정보를 불러오는 데 실패했습니다.' }, { status: 500 });
  }
}
