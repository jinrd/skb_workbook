"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ClassQrModal } from "@/components/ClassQrModal";

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  joinToken: string;
  isActive: boolean;
  teacher: { id: string; name: string; loginId: string };
  enrollments: { id: string; student: { id: string; name: string } }[];
  practiceGoals: {
    id: string;
    name: string;
  }[];
  schedules: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDesc, setNewClassDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  const [qrModal, setQrModal] = useState<{
    className: string;
    url: string;
  } | null>(null);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/classes");
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classes || []);
      }
    } catch (err) {
      console.error("Fetch classes error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch("/api/teacher/classes");
        const data = await res.json();
        if (!ignore && res.ok) {
          setClasses(data.classes || []);
        }
      } catch (err) {
        console.error("Fetch classes error:", err);
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
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName, description: newClassDesc }),
      });

      if (res.ok) {
        setNewClassName("");
        setNewClassDesc("");
        setShowCreateModal(false);
        await fetchClasses();
      }
    } catch (err) {
      console.error("Create class error:", err);
    } finally {
      setCreating(false);
    }
  };

  const getDayName = (dayOfWeek: number) => {
    return ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek] || "";
  };
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

  const handleDeleteClass = async (classItem: ClassItem) => {
    const confirmed = window.confirm(
      `“${classItem.name}” 반을 종료할까요?\n\n제출 기록이 있으면 엑셀 보관을 위해 반을 종료 상태로 변경합니다. 제출 기록이 없는 반만 완전히 삭제됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingClassId(classItem.id);

    try {
      const response = await fetch(`/api/teacher/classes/${classItem.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error || "반을 삭제하지 못했습니다.");
      }

      window.alert(data.message || "반을 삭제했습니다.");
      await fetchClasses();
    } catch (error) {
      console.error("Delete class error:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "반 종료 중 문제가 발생했습니다.",
      );
    } finally {
      setDeletingClassId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 신규 개설 버튼 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600">
            CLASS MANAGEMENT
          </span>
          <h2 className="text-xl font-black text-slate-950">
            반 개설 및 관리
          </h2>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500 active:scale-95"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>반 개설</span>
        </button>
      </div>

      {/* 반 목록 카드시스템 (모바일 1열 카드 리스트) */}
      {loading ? (
        <div className="page-panel p-8 text-center text-xs text-slate-500">
          반 목록을 불러오는 중입니다...
        </div>
      ) : classes.length === 0 ? (
        <div className="page-panel space-y-3 p-8 text-center">
          <p className="text-xs font-semibold text-slate-700">
            등록된 반이 없습니다.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
          >
            첫 번째 반 개설하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="page-panel flex flex-col justify-between space-y-3.5 p-4"
            >
              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${cls.isActive ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-500"}`}
                    >
                      {cls.isActive ? "운영 중" : "비활성"}
                    </span>
                    <h3 className="mt-0.5 text-lg font-bold text-slate-950">
                      {cls.name}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenQr(cls.name, cls.joinToken)}
                    className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <span>QR 코드</span>
                  </button>
                </div>

                <p className="line-clamp-2 text-xs text-slate-500">
                  {cls.description || "설명 없음"}
                </p>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500">담당: </span>
                    <span className="font-semibold text-slate-700">
                      {cls.teacher.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">
                      수강 인원:{" "}
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {cls.enrollments.length}명
                    </span>
                  </div>
                </div>

                {/* 정규 시간표 요약 */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500">
                  <span className="mb-0.5 block text-[10px] font-medium text-slate-500">
                    정규 시간표:
                  </span>
                  {cls.schedules.length === 0 ? (
                    <span className="text-[11px] italic text-slate-500">
                      시간표 미설정
                    </span>
                  ) : (
                    cls.schedules.map((sch) => (
                      <span
                        key={sch.id}
                        className="mr-2 inline-block font-mono text-[11px] text-slate-700"
                      >
                        {getDayName(sch.dayOfWeek)}요일 ({sch.startTime}~
                        {sch.endTime})
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-200 pt-2">
                <Link
                  href={`/teacher/dashboard/classes/${cls.id}`}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-center text-xs font-bold text-slate-800 transition hover:bg-slate-100 active:scale-98"
                >
                  반 상세 & 수강생/시간표 관리 →
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteClass(cls)}
                  disabled={deletingClassId === cls.id}
                  className="rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingClassId === cls.id ? "처리 중" : "종료"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 신규 반 개설 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-950">신규 반 개설</h3>
            <form onSubmit={handleCreateClass} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  반 이름
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="예: 헤어 커트 B반"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  반 설명 (선택)
                </label>
                <textarea
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  placeholder="반 운영시간 및 정규 코스 설명"
                  className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {creating ? "생성 중..." : "개설하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
