'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  joinToken: string;
  isActive: boolean;
  teacher: { id: string; name: string; loginId: string };
  enrollments: { id: string; student: { id: string; name: string } }[];
  practiceCategories: { id: string; name: string }[];
  schedules: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrModalToken, setQrModalToken] = useState<{ name: string; token: string } | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classes || []);
      }
    } catch (err) {
      console.error('Fetch classes error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch('/api/teacher/classes');
        const data = await res.json();
        if (!ignore && res.ok) {
          setClasses(data.classes || []);
        }
      } catch (err) {
        console.error('Fetch classes error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName, description: newClassDesc }),
      });

      if (res.ok) {
        setNewClassName('');
        setNewClassDesc('');
        setShowCreateModal(false);
        await fetchClasses();
      }
    } catch (err) {
      console.error('Create class error:', err);
    } finally {
      setCreating(false);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    return ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek] || '';
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 신규 개설 버튼 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">CLASS MANAGEMENT</span>
          <h2 className="text-xl font-black text-white">반 개설 및 관리</h2>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>+ 반 개설</span>
        </button>
      </div>

      {/* 반 목록 카드시스템 (모바일 1열 카드 리스트) */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
          반 목록을 불러오는 중입니다...
        </div>
      ) : classes.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
          <p className="text-slate-300 text-xs font-semibold">등록된 반이 없습니다.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600/30 text-indigo-300 text-xs font-bold hover:bg-indigo-600/50 transition-colors"
          >
            첫 번째 반 개설하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="p-4.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-md flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${cls.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                      {cls.isActive ? '운영 중' : '비활성'}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{cls.name}</h3>
                  </div>

                  <button
                    onClick={() => setQrModalToken({ name: cls.name, token: cls.joinToken })}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold border border-indigo-500/30 flex items-center gap-1 transition-colors"
                  >
                    <span>🔗 QR 주소</span>
                  </button>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {cls.description || '설명 없음'}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">담당: </span>
                    <span className="font-semibold text-slate-200">{cls.teacher.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">수강 인원: </span>
                    <span className="font-bold text-indigo-400 font-mono">{cls.enrollments.length}명</span>
                  </div>
                </div>

                {/* 정규 시간표 요약 */}
                <div className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 font-medium block text-[10px] mb-0.5">정규 시간표:</span>
                  {cls.schedules.length === 0 ? (
                    <span className="text-slate-500 italic text-[11px]">시간표 미설정</span>
                  ) : (
                    cls.schedules.map((sch) => (
                      <span key={sch.id} className="inline-block mr-2 text-slate-300 text-[11px] font-mono">
                        {getDayName(sch.dayOfWeek)}요일 ({sch.startTime}~{sch.endTime})
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <Link
                  href={`/teacher/dashboard/classes/${cls.id}`}
                  className="w-full block text-center py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-98 text-xs font-bold text-white transition-all border border-slate-700"
                >
                  반 상세 & 수강생/시간표 관리 →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 신규 반 개설 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">신규 반 개설</h3>
            <form onSubmit={handleCreateClass} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">반 이름</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="예: 헤어 커트 B반"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">반 설명 (선택)</label>
                <textarea
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  placeholder="반 운영시간 및 정규 코스 설명"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {creating ? '생성 중...' : '개설하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR 코드 모달 */}
      {qrModalToken && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-center shadow-2xl">
            <h3 className="text-base font-bold text-white">{qrModalToken.name} 접속 QR</h3>
            <p className="text-xs text-slate-300">
              학생들이 교실에서 아래 고정 주소로 접속합니다.
            </p>

            <div className="p-4 rounded-xl bg-white text-slate-900 inline-block mx-auto font-mono text-xs break-all font-bold select-all shadow-inner">
              {typeof window !== 'undefined' ? `${window.location.origin}/join/${qrModalToken.token}` : `/join/${qrModalToken.token}`}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/join/${qrModalToken.token}`;
                  navigator.clipboard.writeText(url);
                  alert('QR 접속 URL이 클립보드에 복사되었습니다!');
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                주소 복사
              </button>
              <button
                type="button"
                onClick={() => setQrModalToken(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
