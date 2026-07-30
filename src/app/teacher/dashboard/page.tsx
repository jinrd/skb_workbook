'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActiveSessionItem {
  classId: string;
  className: string;
  joinToken: string;
  activeSession: {
    id: string;
    status: 'OPEN' | 'EXTENDED' | 'CLOSED';
    actualAllowedStart: string;
    actualAllowedEnd: string;
  } | null;
}

export default function TeacherDashboardPage() {
  const [sessionList, setSessionList] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadStatus() {
      try {
        const res = await fetch('/api/teacher/sessions/status');
        const data = await res.json();
        if (!ignore && res.ok) {
          setSessionList(data.sessions || []);
        }
      } catch (err) {
        console.error('Fetch sessions status error:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadStatus();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* 타이틀 및 상태 안내 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">HOME DASHBOARD</span>
          <h2 className="text-xl font-black text-white">오늘의 수업 상태</h2>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold transition-all border border-slate-700/60"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 모바일 퀵 링크 그리드 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/teacher/dashboard/classes"
          className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex items-center justify-between group"
        >
          <div>
            <span className="text-[10px] text-indigo-300 font-semibold block">반 & 시간표</span>
            <span className="text-sm font-bold text-white">반 관리 →</span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-sm font-bold">
            🏫
          </span>
        </Link>

        <Link
          href="/teacher/dashboard/students"
          className="p-3.5 rounded-2xl bg-violet-950/30 border border-violet-500/30 hover:border-violet-500/60 transition-all flex items-center justify-between group"
        >
          <div>
            <span className="text-[10px] text-violet-300 font-semibold block">학생 명단</span>
            <span className="text-sm font-bold text-white">학생 관리 →</span>
          </div>
          <span className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center text-sm font-bold">
            👨‍🎓
          </span>
        </Link>
      </div>

      {/* 오늘 수업 실시간 운영 피드 (모바일 친화적 1열 카드 리스트) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-slate-200">
            실시간 수업 개방 현황
          </h3>
          <span className="text-xs text-slate-400">자동 시간표 기준</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
            수업 실시간 상태를 불러오는 중입니다...
          </div>
        ) : sessionList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
            <p className="font-semibold text-slate-300">개설된 반이 없습니다.</p>
            <p>상단의 [반 관리] 메뉴에서 새 반을 추가해 보세요.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {sessionList.map((item) => {
              const session = item.activeSession;
              const isOpened = session && (session.status === 'OPEN' || session.status === 'EXTENDED');

              return (
                <div
                  key={item.classId}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOpened
                            ? session?.status === 'EXTENDED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isOpened ? (session?.status === 'EXTENDED' ? '⏱️ 시간 연장됨' : '🟢 수업 진행 중') : '🔒 수업 마감 / 미개방'}
                      </span>
                      <h4 className="text-lg font-bold text-white">{item.className}</h4>
                    </div>

                    <Link
                      href={`/teacher/dashboard/classes/${item.classId}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                    >
                      설정 ⚙️
                    </Link>
                  </div>

                  {isOpened && session && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">마감 예정 시각:</span>
                        <span className="font-bold text-indigo-300 font-mono">
                          {new Date(session.actualAllowedEnd).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 모바일 큼직한 액션 버튼 */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/teacher/dashboard/classes/${item.classId}/summary`}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 text-center transition-all active:scale-98"
                    >
                      📊 실습 리포트
                    </Link>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/join/${item.joinToken}`;
                        navigator.clipboard.writeText(url);
                        alert('학생 QR 접속 URL이 클립보드에 복사되었습니다!');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 text-center transition-all active:scale-98"
                    >
                      🔗 QR URL 복사
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
