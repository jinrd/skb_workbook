"use client";

import { useState, useEffect, useCallback } from "react";

interface AuditLogItem {
  id: string;
  type: "DAILY_FILE" | "MONTHLY_TEXT";
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
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await fetch("/api/teacher/audit-logs");
      const data = await res.json();
      if (res.ok) {
        setLogs(data.auditLogs || []);
      } else {
        setErrorMessage(data.error || "감사 로그를 가져오는데 실패했습니다.");
      }
    } catch (err) {
      console.error("Fetch audit logs error:", err);
      setErrorMessage("서버 연결 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch("/api/teacher/audit-logs");
        const data = await res.json();
        if (!ignore && res.ok) {
          setLogs(data.auditLogs || []);
        } else if (!ignore) {
          setErrorMessage(data.error || "감사 로그를 가져오는데 실패했습니다.");
        }
      } catch (err) {
        console.error('Fetch audit logs error:', err);
        if (!ignore) setErrorMessage("서버 연결 중 오류가 발생했습니다.");
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
    if (status === "SUCCESS") {
      return (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
          완료 ({type})
        </span>
      );
    }
    return (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
        실패 ({type})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 새로고침 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-700">SECURITY LOGS</span>
          <h2 className="text-xl font-black text-slate-950">시스템 보안 감사 로그</h2>
        </div>
        <button
          onClick={fetchLogs}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          새로고침
        </button>
      </div>

        {errorMessage && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold text-rose-700">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="page-panel flex items-center justify-center gap-2 py-16 text-xs text-blue-600">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>보안 감사 로그를 불러오는 중입니다...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="page-panel p-12 text-center text-slate-500">
            기록된 보안 감사 로그가 없습니다.
          </div>
        ) : (
          <div className="page-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3.5">발생 시각 (KST)</th>
                    <th className="px-4 py-3.5">이벤트 유형</th>
                    <th className="px-4 py-3.5">상세 내용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-sans text-slate-500">
                        {new Date(log.executedAt).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getActionBadge(log.type, log.status)}
                      </td>
                      <td className="px-4 py-3 font-sans text-xs text-slate-700">
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
