'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditLogItem {
  id: string;
  type: 'DAILY_FILE' | 'MONTHLY_TEXT';
  status: string;
  targetCount: number;
  deletedCount: number;
  failCount: number;
  details: string | null;
  executedAt: string;
}

export default function TeacherAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/teacher/audit-logs');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.auditLogs || []);
      } else {
        setErrorMessage(data.error || '감사 로그를 가져오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
      setErrorMessage('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch('/api/teacher/audit-logs');
        const data = await res.json();
        if (!ignore && res.ok) {
          setLogs(data.auditLogs || []);
        } else if (!ignore) {
          setErrorMessage(data.error || '감사 로그를 가져오는데 실패했습니다.');
        }
      } catch (err) {
        console.error('Fetch audit logs error:', err);
        if (!ignore) setErrorMessage('서버 연결 중 오류가 발생했습니다.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const getActionBadge = (type: string, status: string) => {
    if (status === 'SUCCESS') {
      return <span className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ 완료 ({type})</span>;
    }
    return <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">🛑 실패 ({type})</span>;
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 새로고침 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">SECURITY LOGS</span>
          <h2 className="text-xl font-black text-white">시스템 보안 감사 로그</h2>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold transition-all border border-slate-700/60"
        >
          🔄 새로고침
        </button>
      </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold text-center">
            {errorMessage}
          </div>
        )}

        {/* 로딩 표시 및 로그 목록 */}
        {loading ? (
          <div className="flex justify-center items-center py-16 text-indigo-400 text-xs gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>보안 감사 로그를 불러오는 중입니다...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400">
            기록된 보안 감사 로그가 없습니다.
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">발생 시각 (KST)</th>
                    <th className="px-4 py-3.5">이벤트 유형</th>
                    <th className="px-4 py-3.5">상세 내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-sans whitespace-nowrap">
                        {new Date(log.executedAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getActionBadge(log.type, log.status)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-sans text-xs">
                        삭제 대상: {log.targetCount}건 / 삭제 완료: {log.deletedCount}건 / 실패: {log.failCount}건
                        {log.details && <div className="mt-1 text-[10px] text-slate-500">{log.details}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
