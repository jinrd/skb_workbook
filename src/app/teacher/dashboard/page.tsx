"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ClassQrModal } from "@/components/ClassQrModal";
interface ActiveSessionItem {
  classId: string;
  className: string;
  joinToken: string;
  activeSession: {
    id: string;
    status: "OPEN" | "EXTENDED" | "CLOSED";
    actualAllowedStart: string;
    actualAllowedEnd: string;
  } | null;
}

export default function TeacherDashboardPage() {
  const [sessionList, setSessionList] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState<{
    className: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadStatus() {
      try {
        const res = await fetch("/api/teacher/sessions/status");
        const data = await res.json();
        if (!ignore && res.ok) {
          setSessionList(data.sessions || []);
        }
      } catch (err) {
        console.error("Fetch sessions status error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadStatus();
    return () => {
      ignore = true;
    };
  }, []);
  const handleOpenQr = (className: string, joinToken: string) => {
    const url = new URL(
      `/join/${joinToken}`,
      window.location.origin,
    ).toString();

    setQrModal({
      className,
      url,
    });
  };
  return (
    <div className="space-y-6">
      {/* 타이틀 및 상태 안내 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600">
            HOME DASHBOARD
          </span>
          <h2 className="text-xl font-black text-slate-950">
            오늘의 수업 상태
          </h2>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/teacher/dashboard/classes"
          className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3.5 shadow-sm transition hover:border-blue-300"
        >
          <div>
            <span className="block text-[10px] font-semibold text-blue-600">
              반 & 시간표
            </span>
            <span className="text-sm font-bold text-slate-950">반 관리</span>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
            반
          </span>
        </Link>

        <Link
          href="/teacher/dashboard/students"
          className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white p-3.5 shadow-sm transition hover:border-emerald-300"
        >
          <div>
            <span className="block text-[10px] font-semibold text-emerald-700">
              학생 명단
            </span>
            <span className="text-sm font-bold text-slate-950">학생 관리</span>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
            명
          </span>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-slate-800">
            실시간 수업 개방 현황
          </h3>
          <span className="text-xs text-slate-400">자동 시간표 기준</span>
        </div>

        {loading ? (
          <div className="page-panel p-8 text-center text-xs text-slate-500">
            수업 실시간 상태를 불러오는 중입니다...
          </div>
        ) : sessionList.length === 0 ? (
          <div className="page-panel space-y-2 p-8 text-center text-xs text-slate-500">
            <p className="font-semibold text-slate-700">
              개설된 반이 없습니다.
            </p>
            <p>상단의 [반 관리] 메뉴에서 새 반을 추가해 보세요.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {sessionList.map((item) => {
              const session = item.activeSession;
              const isOpened =
                session &&
                (session.status === "OPEN" || session.status === "EXTENDED");

              return (
                <div
                  key={item.classId}
                  className="page-panel space-y-3 p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOpened
                            ? session?.status === "EXTENDED"
                              ? "border border-amber-200 bg-amber-50 text-amber-700"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {isOpened
                          ? session?.status === "EXTENDED"
                            ? "시간 연장됨"
                            : "수업 진행 중"
                          : "수업 마감 / 미개방"}
                      </span>
                      <h4 className="text-lg font-bold text-slate-950">
                        {item.className}
                      </h4>
                    </div>

                    <Link
                      href={`/teacher/dashboard/classes/${item.classId}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      설정
                    </Link>
                  </div>

                  {isOpened && session && (
                    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500">
                          마감 예정 시각:
                        </span>
                        <span className="font-mono font-bold text-blue-700">
                          {new Date(
                            session.actualAllowedEnd,
                          ).toLocaleTimeString("ko-KR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href={`/teacher/dashboard/classes/${item.classId}/summary`}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-98"
                    >
                      실습 리포트
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenQr(item.className, item.joinToken)
                      }
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-center text-xs font-bold text-blue-700 transition hover:bg-blue-100 active:scale-98"
                    >
                      QR 코드
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {qrModal && (
        <ClassQrModal
          className={qrModal.className}
          url={qrModal.url}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  );
}
