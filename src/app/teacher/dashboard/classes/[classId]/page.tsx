'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

interface StudentItem {
  id: string;
  name: string;
  isBlocked: boolean;
  createdAt: string;
}

interface EnrollmentItem {
  id: string;
  student: StudentItem;
  enrolledAt: string;
  droppedAt: string | null;
}

interface CategoryItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  preEntryMinutes: number;
  gracePeriodMinutes: number;
}

interface ClassDetail {
  id: string;
  name: string;
  description: string | null;
  joinToken: string;
  isActive: boolean;
  teacher: { name: string; loginId: string };
  enrollments: EnrollmentItem[];
  practiceCategories: CategoryItem[];
  schedules: ScheduleItem[];
}

export default function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'categories' | 'schedules' | 'settings'>('students');

  // 반 설정 변경 State
  const [preEntryMin, setPreEntryMin] = useState(10);
  const [graceMin, setGraceMin] = useState(10);
  const [savingSettings, setSavingSettings] = useState(false);

  // 학생 배정 모달 State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [globalStudents, setGlobalStudents] = useState<StudentItem[]>([]);
  const [loadingGlobalStudents, setLoadingGlobalStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  // PIN 재설정 State
  const [resetPinStudentId, setResetPinStudentId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');

  // 연습 종목 추가 State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  // 시간표 추가 State
  const [schedDay, setSchedDay] = useState(4); // 목요일
  const [schedStart, setSchedStart] = useState('14:00');
  const [schedEnd, setSchedEnd] = useState('16:00');
  const [addingSchedule, setAddingSchedule] = useState(false);

  const fetchClassDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`);
      const data = await res.json();
      if (res.ok) {
        setClassDetail(data.class);
      }
    } catch (err) {
      console.error('Fetch class detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch(`/api/teacher/classes/${classId}`);
        const data = await res.json();
        if (!ignore && res.ok) {
          setClassDetail(data.class);
        }
      } catch (err) {
        console.error('Fetch class detail error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [classId]);

  const openEnrollModal = async () => {
    setIsEnrollModalOpen(true);
    setLoadingGlobalStudents(true);
    try {
      const res = await fetch('/api/teacher/students');
      const data = await res.json();
      if (res.ok) {
        // 이미 이 반에 등록된 학생(drop 되지 않은 학생) 필터링
        const currentEnrolledIds = classDetail?.enrollments
          .filter(e => !e.droppedAt) // droppedAt 고려 안할경우 그냥 id만 비교 (API에서 제외처리시 droppedAt 업데이트)
          .map(e => e.student.id) || [];
        
        const available = (data.students || []).filter(
          (s: StudentItem) => !currentEnrolledIds.includes(s.id)
        );
        setGlobalStudents(available);
      }
    } catch (err) {
      console.error('Fetch global students error:', err);
    } finally {
      setLoadingGlobalStudents(false);
    }
  };

  const handleEnrollStudents = async () => {
    if (selectedStudentIds.length === 0) return;

    setEnrolling(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });

      if (res.ok) {
        setIsEnrollModalOpen(false);
        setSelectedStudentIds([]);
        await fetchClassDetail();
      } else {
        const data = await res.json();
        alert(data.error || '배정에 실패했습니다.');
      }
    } catch (err) {
      console.error('Enroll students error:', err);
    } finally {
      setEnrolling(false);
    }
  };


  // 학생 제외
  const handleDropStudent = async (studentId: string) => {
    if (!confirm('이 학생을 반에서 제외하시겠습니까?\n(수업 중이라면 다음 수업부터 적용됩니다)')) return;

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students?studentId=${studentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error('Drop student error:', err);
    }
  };

  // 학생 PIN 재설정
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStudentId || resetPinValue.length !== 4) return;

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: resetPinStudentId, newPin: resetPinValue }),
      });
      if (res.ok) {
        alert('학생 PIN 번호가 성공적으로 재설정되었습니다.');
        setResetPinStudentId(null);
        setResetPinValue('');
      }
    } catch (err) {
      console.error('Reset PIN error:', err);
    }
  };

  // 종목 추가
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setAddingCategory(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (res.ok) {
        setNewCategoryName('');
        await fetchClassDetail();
      }
    } catch (err) {
      console.error('Add category error:', err);
    } finally {
      setAddingCategory(false);
    }
  };

  // 종목 비활성화
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/categories?categoryId=${categoryId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error('Delete category error:', err);
    }
  };

  // 시간표 추가
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSchedule(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: Number(schedDay),
          startTime: schedStart,
          endTime: schedEnd,
        }),
      });
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error('Add schedule error:', err);
    } finally {
      setAddingSchedule(false);
    }
  };

  // 시간표 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/schedules?scheduleId=${scheduleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error('Delete schedule error:', err);
    }
  };

  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex items-center justify-center text-sm">
        반 상세 정보를 불러오는 중입니다...
      </div>
    );
  }

  if (!classDetail) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
        <p className="text-slate-400">반 정보를 찾을 수 없습니다.</p>
        <Link href="/teacher/dashboard/classes" className="text-indigo-400 hover:underline text-xs">
          ← 반 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 상단 네비게이션 */}
        <header className="py-4 border-b border-slate-800 space-y-2">
          <Link href="/teacher/dashboard/classes" className="text-xs text-indigo-400 hover:underline">
            ← 반 목록으로 돌아가기
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">{classDetail.name} 관리</h1>
              <p className="text-xs text-slate-400">
                담당 강사: {classDetail.teacher.name} ({classDetail.teacher.loginId})
              </p>
            </div>
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-800 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === 'students'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            👨‍🎓 학생 명단 ({classDetail.enrollments.length}명)
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === 'categories'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ✂️ 연습 종목 ({classDetail.practiceCategories.filter((c) => c.isActive).length}개)
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === 'schedules'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⏰ 정규 시간표 ({classDetail.schedules.length}개)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ 반 설정 (실시간 즉시 적용)
          </button>
        </div>

        {/* 탭 1: 학생 명단 관리 */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            {/* 학생 추가 버튼 */}
            <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-bold text-white">이 반에 수강할 학생 배정</h3>
              <button
                onClick={openEnrollModal}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                + 전역 학생 목록에서 배정하기
              </button>
            </div>

            {/* 학생 목록 (모바일 친화적 카드 레이아웃) */}
            <div className="space-y-3">
              {classDetail.enrollments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs glass-panel rounded-2xl border border-slate-800">
                  배정된 학생이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {classDetail.enrollments.map((e) => (
                    <div key={e.id} className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-base">{e.student.name}</h4>
                          <span className="text-[10px] text-slate-400">
                            등록일: {new Date(e.enrolledAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          정상 수강
                        </span>
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60 mt-auto">
                        <button
                          onClick={() => {
                            setResetPinStudentId(e.student.id);
                            setResetPinValue('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium transition-colors"
                        >
                          PIN 재설정
                        </button>
                        <button
                          onClick={() => handleDropStudent(e.student.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-medium transition-colors"
                        >
                          반 제외
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 탭 2: 연습 종목 관리 */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">신규 연습 종목 등록</h3>
              <form onSubmit={handleAddCategory} className="flex gap-3">
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="연습 종목명 (예: 여성 숏커트, 핑거웨이브 등)"
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={addingCategory}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {addingCategory ? '추가 중...' : '종목 추가'}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {classDetail.practiceCategories
                .filter((c) => c.isActive)
                .map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-xl glass-panel border border-slate-800 flex justify-between items-center"
                  >
                    <span className="font-semibold text-sm text-slate-200">{cat.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs transition-colors"
                    >
                      비활성화
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 탭 3: 정규 시간표 관리 */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white">정규 시간표 추가</h3>
              <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={schedDay}
                  onChange={(e) => setSchedDay(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {dayNames.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  required
                  value={schedStart}
                  onChange={(e) => setSchedStart(e.target.value)}
                  placeholder="시작 (14:00)"
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <input
                  type="text"
                  required
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                  placeholder="종료 (16:00)"
                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  type="submit"
                  disabled={addingSchedule}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {addingSchedule ? '추가 중...' : '시간표 등록'}
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {classDetail.schedules.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs glass-panel rounded-xl">
                  등록된 정규 시간표가 없습니다.
                </div>
              ) : (
                classDetail.schedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="p-4 rounded-xl glass-panel border border-slate-800 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-indigo-400 mr-3">{dayNames[sch.dayOfWeek]}</span>
                      <span className="text-sm font-semibold text-white">
                        {sch.startTime} ~ {sch.endTime}
                      </span>
                      <span className="ml-3 text-xs text-slate-400">
                        (사전접속 {sch.preEntryMinutes}분 전 / 제출유예 {sch.gracePeriodMinutes}분 후)
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteSchedule(sch.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 탭 4: 반 설정 (즉시 적용) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-bold text-indigo-300">⚡ 실시간 설정 즉시 적용</p>
                <p className="mt-1 leading-relaxed text-indigo-200/90">
                  이 페이지에서 변경한 내용은 <strong>진행 중인 수업 및 향후 수업에 즉시 반영</strong>됩니다.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white">접속 및 제출 규칙 설정</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingSettings(true);
                  try {
                    const res = await fetch(`/api/teacher/classes/${classId}/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        preEntryMinutes: Number(preEntryMin),
                        gracePeriodMinutes: Number(graceMin),
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message || '설정이 저장되었습니다.');
                    }
                  } catch (err) {
                    console.error('Save settings error:', err);
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      사전 접속 허용시간 (분 전)
                    </label>
                    <input
                      type="number"
                      value={preEntryMin}
                      onChange={(e) => setPreEntryMin(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      제출 유예시간 (분 후)
                    </label>
                    <input
                      type="number"
                      value={graceMin}
                      onChange={(e) => setGraceMin(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      제출 파일 개수 제한
                    </label>
                    <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-emerald-400 text-xs font-semibold">
                      개수 제한 없음 (무제한 첨부 가능)
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      개별 파일 최대 용량 (고정)
                    </label>
                    <div className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-amber-300 text-xs font-semibold flex justify-between items-center">
                      <span>50 MB 고정</span>
                      <span className="text-[10px] text-slate-400 font-normal">(시스템 고정값)</span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>📁 Google Drive 업로드 시 <strong>[학생이름]_[반이름]_[파일명]</strong> 규칙으로 자동 저장됩니다.</span>
                  </div>
                  <div className="flex items-center gap-2 text-rose-300 font-medium">
                    <svg className="w-4 h-4 flex-shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>🗑️ 첨부파일은 <strong>제출 다음 날 오전 4시</strong>에 Google Drive에서 자동 일괄 삭제됩니다. (텍스트 기록은 보관)</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    {savingSettings ? '저장 중...' : '실시간 적용 설정 저장'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PIN 재설정 모달 */}
        {resetPinStudentId && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-sm p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4">
              <h3 className="text-base font-bold text-white">학생 PIN 번호 재설정</h3>
              <form onSubmit={handleResetPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    새 PIN 번호 (4자리)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={resetPinValue}
                    onChange={(e) => setResetPinValue(e.target.value.replace(/\D/g, ''))}
                    placeholder="예: 9999"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPinStudentId(null)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    재설정 저장
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 전역 학생 배정 모달 */}
        {isEnrollModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 space-y-4 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white">이 반에 학생 배정하기</h3>
                <button
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  닫기 ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-2 space-y-2 min-h-[200px]">
                {loadingGlobalStudents ? (
                  <div className="text-center text-slate-400 text-sm py-8">학생 목록을 불러오는 중...</div>
                ) : globalStudents.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-8">배정 가능한 새로운 학생이 없습니다.<br/>전역 학생 관리에서 먼저 등록해 주세요.</div>
                ) : (
                  globalStudents.map(student => (
                    <label key={student.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-700 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds(prev => [...prev, student.id]);
                          } else {
                            setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                      />
                      <span className="text-sm font-semibold text-white">{student.name}</span>
                    </label>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleEnrollStudents}
                  disabled={enrolling || selectedStudentIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {enrolling ? '배정 중...' : `${selectedStudentIds.length}명 배정 완료`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
