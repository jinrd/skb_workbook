'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface CategoryStat {
  categoryName: string;
  count: number;
  totalMinutes: number;
}

interface StudentStat {
  studentId: string;
  studentName: string;
  count: number;
  totalMinutes: number;
  categories: string[];
}

interface SubmissionFileItem {
  id: string;
  googleFileId: string;
  fileName: string;
  fileSize: number;
  isDeleted: boolean;
}

interface RecentSubmissionItem {
  id: string;
  categoryName: string;
  durationMinutes: number;
  content: string | null;
  submittedAt: string;
  student: {
    name: string;
  };
  files: SubmissionFileItem[];
}

interface SummaryData {
  classId: string;
  className: string;
  todayDateStr: string;
  todayDate: string;
  summary: {
    totalCount: number;
    totalDurationMinutes: number;
  };
  categorySummary: CategoryStat[];
  studentSummary: StudentStat[];
  recentSubmissions: RecentSubmissionItem[];
}

export default function ClassSummaryPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const { classId } = resolvedParams;

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadSummary() {
      try {
        const res = await fetch(`/api/teacher/classes/${classId}/summary`);
        const result = await res.json();
        if (!ignore && res.ok) {
          setData(result);
        } else if (!ignore) {
          setErrorMessage(result.error || '수업 요약 정보를 가져오는 데 실패했습니다.');
        }
      } catch (err) {
        console.error('Fetch summary error:', err);
        if (!ignore) setErrorMessage('서버 연결 중 오류가 발생했습니다.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSummary();
    return () => {
      ignore = true;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-indigo-400 text-xs">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>수업 요약 리포트를 구성 중입니다...</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-100">
        <div className="p-6 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs text-center space-y-3">
          <p className="font-bold">{errorMessage || '정보를 불러올 수 없습니다.'}</p>
          <Link
            href="/teacher/dashboard"
            className="inline-block px-4 py-2 rounded-xl bg-slate-800 text-white font-semibold"
          >
            ← 메인 대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/teacher/dashboard"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                ← 대시보드
              </Link>
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                {data.todayDate} 수업 마감 결과
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-1">🎓 {data.className} 학생별 실습 요약 리포트</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-center">
              <span className="text-[10px] text-indigo-300 block uppercase font-medium">총 제출 회수</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">{data.summary.totalCount}회</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center">
              <span className="text-[10px] text-emerald-300 block uppercase font-medium">총 연습 시간</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">
                {Math.floor(data.summary.totalDurationMinutes / 60)}시간 {data.summary.totalDurationMinutes % 60}분
              </span>
            </div>
            <Link
              href={`/teacher/dashboard/submissions?classId=${classId}&date=${data.todayDateStr}`}
              className="px-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition-all border border-indigo-400/40 flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>📂 제출 결과 전체보기</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* 1. 핵심: 학생별 제출 횟수 & 총 연습 시간 요약 리스트 */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-4 shadow-2xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>👥 학생별 실습 제출 & 연습 시간 요약 목록</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">총 {data.studentSummary.length}명 수강생</span>
          </div>

          {data.studentSummary.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">수강생 정보가 없습니다.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {data.studentSummary.map((st, idx) => (
                <div
                  key={st.studentId}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/40 px-3 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 w-5">{idx + 1}.</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{st.studentName} 학생</span>
                        {st.count > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {st.count}번 제출
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-400">
                            미제출
                          </span>
                        )}
                      </div>

                      {st.categories.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <span>연습 종목:</span>
                          <span className="text-indigo-300 font-medium">{st.categories.join(', ')}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right font-mono pl-8 sm:pl-0">
                    {st.totalMinutes > 0 ? (
                      <span className="text-base font-bold text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/30">
                        ⏱️ 총 {st.totalMinutes}분 연습함
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">0분</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. 연습 종목별 집계 요약 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>✂️ 연습 종목별 제출 & 총 시간 집계</span>
          </h2>

          {data.categorySummary.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">오늘 제출된 연습 종목이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.categorySummary.map((cat) => (
                <div key={cat.categoryName} className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 flex justify-between items-center text-xs">
                  <span className="font-bold text-indigo-300 text-sm">{cat.categoryName}</span>
                  <div className="text-right font-mono space-y-0.5">
                    <p className="text-slate-200 font-semibold">{cat.count}번 제출됨</p>
                    <p className="text-emerald-400 font-bold">⏱️ 총 {cat.totalMinutes}분 연습</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. 제출물 원본 및 구글 드라이브 링크 목록 */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📋 제출물 타임라인 & 첨부 파일 ({data.recentSubmissions.length}건)</span>
          </h2>

          <div className="space-y-3">
            {data.recentSubmissions.map((sub) => (
              <div key={sub.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{sub.student.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300">
                      {sub.categoryName}
                    </span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      ⏱️ {sub.durationMinutes}분 연습
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(sub.submittedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {sub.content && <p className="text-slate-300 italic text-[11px]">&ldquo;{sub.content}&rdquo;</p>}

                <div className="space-y-1">
                  {sub.files.map((file) => (
                    <div key={file.id} className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 truncate mr-2">📎 {file.fileName}</span>
                      {file.isDeleted ? (
                        <span className="text-amber-400 text-[10px]">🗑️ 4:00 AM 삭제됨</span>
                      ) : (
                        <a
                          href={`https://drive.google.com/file/d/${file.googleFileId}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 font-semibold hover:underline"
                        >
                          구글 드라이브 열기 ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
