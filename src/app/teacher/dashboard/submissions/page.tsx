'use client';

import { useState, useEffect } from 'react';

interface ClassItem {
  id: string;
  name: string;
}

interface DailyReportItem {
  id: string;
  date: string;
  totalDurationMinutes: number;
  submissionCount: number;
  categorySummary: string; // JSON: {"원랭스 커트": 30, "와인딩": 60}
  memos: string; // JSON: ["메모 1", "메모 2"]
  createdAt: string;
  student: {
    id: string;
    name: string;
  };
  class: {
    id: string;
    name: string;
  };
}

export default function TeacherSubmissionsDashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchStudentName, setSearchStudentName] = useState<string>('');

  const [reports, setReports] = useState<DailyReportItem[]>([]);
  const [summary, setSummary] = useState({
    totalReportsCount: 0,
    totalSubmissionCount: 0,
    totalDurationMinutes: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [cleanupLoading, setCleanupLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        if (selectedClassId) params.append('classId', selectedClassId);
        if (selectedDate) params.append('date', selectedDate);
        if (searchStudentName) params.append('studentName', searchStudentName);

        const res = await fetch(`/api/teacher/submissions?${params.toString()}`);
        const data = await res.json();

        if (!ignore && res.ok) {
          setReports(data.dailyReports || []);
          setSummary(
            data.summary || {
              totalReportsCount: 0,
              totalSubmissionCount: 0,
              totalDurationMinutes: 0,
            }
          );
          if (data.teacherClasses) {
            setClasses(data.teacherClasses);
          }
        } else if (!ignore) {
          setErrorMessage(data.error || '일별 레포트를 가져오는 데 실패했습니다.');
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (!ignore) setErrorMessage('서버 연결 중 오류가 발생했습니다.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [selectedClassId, selectedDate, searchStudentName]);

  const handleRunCleanup = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('어제 자 이전의 구글 드라이브 파일과 DB 낱개 기록을 완전히 정리(삭제)하시겠습니까?\n(학생별 일별 종합 기록은 무사히 남습니다)')) {
      return;
    }

    setCleanupLoading(true);
    try {
      const res = await fetch('/api/cron/cleanup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`🎉 ${data.message}`);
        window.location.reload();
      } else {
        alert(`오류: ${data.error}`);
      }
    } catch (err) {
      console.error('Cleanup trigger error:', err);
      alert('정리 작업 호출 중 오류가 발생했습니다.');
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleResetFilters = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSelectedClassId('');
    setSelectedDate('');
    setSearchStudentName('');
  };

  return (
    <div className="space-y-6">
      {/* 상단 제목 & 통계 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">DAILY REPORTS</span>
          <h2 className="text-xl font-black text-white">학생 일별 종합 실습 기록</h2>
        </div>

        {/* 통계 요약 카드 */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 block uppercase font-semibold">총 제출</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">{summary.totalSubmissionCount}회</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <span className="text-[9px] text-slate-400 block uppercase font-semibold">총 연습시간</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {Math.floor(summary.totalDurationMinutes / 60)}시간 {summary.totalDurationMinutes % 60}분
            </span>
          </div>
        </div>
      </div>

      {/* 필터 패널 */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 반 선택 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">수업 반 선택</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">전체 수강 반 보기</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 선택 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-400">날짜 선택 (YYYY-MM-DD)</label>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[10px] text-indigo-400 hover:underline font-semibold"
                >
                  전체 날짜
                </button>
              )}
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
          </div>

          {/* 학생 검색 */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">학생 이름 검색</label>
            <input
              type="text"
              value={searchStudentName}
              onChange={(e) => setSearchStudentName(e.target.value)}
              placeholder="예: 김민지"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <span>🔄 필터 초기화</span>
          </button>
          <button
            type="button"
            onClick={handleRunCleanup}
            disabled={cleanupLoading}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>🗑️ 4:00 AM 파일 및 낱개 데이터 수동 정리</span>
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold text-center">
          {errorMessage}
        </div>
      )}

      {/* 로딩 표시 */}
      {loading ? (
        <div className="flex justify-center items-center py-16 text-indigo-400 text-xs gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>학생 일별 기록을 불러오는 중입니다...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <p className="text-base font-semibold">선택한 조건에 해당하는 학생 일별 기록이 없습니다.</p>
          <p className="text-xs text-slate-500">
            상단의 [🔄 필터 초기화] 버튼을 누르거나 검색 조건(날짜/학생명)을 변경해 보세요.
          </p>
        </div>
      ) : (
        /* 학생 일별 종합 기록 카드리스트 */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => {
            let categoryMap: Record<string, number> = {};
            let memoList: string[] = [];
            try {
              categoryMap = JSON.parse(report.categorySummary || '{}');
              memoList = JSON.parse(report.memos || '[]');
            } catch (e) {
              console.error('JSON parse error:', e);
            }

            return (
              <div
                key={report.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div className="space-y-3">
                  {/* 날짜 & 학생 헤더 */}
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 font-mono block">
                        📅 {report.date}
                      </span>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                        <span>{report.student.name}</span>
                        <span className="text-xs font-normal text-slate-400">수강생</span>
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {report.class.name}
                    </span>
                  </div>

                  {/* 하루 연습 시간 & 제출 횟수 통계 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">하루 총 연습시간</span>
                      <span className="text-base font-bold text-emerald-400 font-mono">
                        ⏱️ {Math.floor(report.totalDurationMinutes / 60) > 0 ? `${Math.floor(report.totalDurationMinutes / 60)}시간 ` : ''}
                        {report.totalDurationMinutes % 60}분
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[11px] block">제출 횟수</span>
                      <span className="text-sm font-bold text-indigo-300 font-mono">
                        총 {report.submissionCount}회 제출
                      </span>
                    </div>
                  </div>

                  {/* 연습 종목별 집계 내역 */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      ✂️ 종목별 연습 내역
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(categoryMap).map(([category, minutes]) => (
                        <div
                          key={category}
                          className="px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs flex items-center gap-2"
                        >
                          <span className="font-semibold text-indigo-200">{category}</span>
                          <span className="font-bold text-emerald-300 font-mono">{minutes}분</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 메모 모음 */}
                  {memoList.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        📝 제출 메모 모음 ({memoList.length}건)
                      </span>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {memoList.map((m, idx) => (
                          <p
                            key={idx}
                            className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 italic"
                          >
                            &ldquo;{m}&rdquo;
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
