"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";

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

interface PracticeGoalItem {
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
  practiceGoals: PracticeGoalItem[];
  schedules: ScheduleItem[];
}

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "students" | "goals" | "schedules" | "settings"
  >("students");

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
  const [resetPinStudentId, setResetPinStudentId] = useState<string | null>(
    null,
  );
  const [resetPinValue, setResetPinValue] = useState("");

  // 연습 종목 추가 State
  const [newGoalName, setNewGoalName] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalName, setEditingGoalName] = useState("");
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);

  // 시간표 추가 State
  const [schedDay, setSchedDay] = useState(4); // 목요일
  const [schedStart, setSchedStart] = useState("14:00");
  const [schedEnd, setSchedEnd] = useState("16:00");
  const [addingSchedule, setAddingSchedule] = useState(false);

  const fetchClassDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/classes/${classId}`);
      const data = await res.json();
      if (res.ok) {
        setClassDetail(data.class);
      }
    } catch (err) {
      console.error("Fetch class detail error:", err);
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
        console.error("Fetch class detail error:", err);
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
      const res = await fetch("/api/teacher/students");
      const data = await res.json();
      if (res.ok) {
        // 이미 이 반에 등록된 학생(drop 되지 않은 학생) 필터링
        const currentEnrolledIds =
          classDetail?.enrollments
            .filter((e) => !e.droppedAt) // droppedAt 고려 안할경우 그냥 id만 비교 (API에서 제외처리시 droppedAt 업데이트)
            .map((e) => e.student.id) || [];

        const available = (data.students || []).filter(
          (s: StudentItem) => !currentEnrolledIds.includes(s.id),
        );
        setGlobalStudents(available);
      }
    } catch (err) {
      console.error("Fetch global students error:", err);
    } finally {
      setLoadingGlobalStudents(false);
    }
  };

  const handleEnrollStudents = async () => {
    if (selectedStudentIds.length === 0) return;

    setEnrolling(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });

      if (res.ok) {
        setIsEnrollModalOpen(false);
        setSelectedStudentIds([]);
        await fetchClassDetail();
      } else {
        const data = await res.json();
        alert(data.error || "배정에 실패했습니다.");
      }
    } catch (err) {
      console.error("Enroll students error:", err);
    } finally {
      setEnrolling(false);
    }
  };

  // 학생 제외
  const handleDropStudent = async (studentId: string) => {
    if (
      !confirm(
        "이 학생을 반에서 제외하시겠습니까?\n(수업 중이라면 다음 수업부터 적용됩니다)",
      )
    )
      return;

    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/students?studentId=${studentId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error("Drop student error:", err);
    }
  };

  // 학생 PIN 재설정
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStudentId || resetPinValue.length !== 4) return;

    try {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: resetPinStudentId,
          newPin: resetPinValue,
        }),
      });
      if (res.ok) {
        alert("학생 PIN 번호가 성공적으로 재설정되었습니다.");
        setResetPinStudentId(null);
        setResetPinValue("");
      }
    } catch (err) {
      console.error("Reset PIN error:", err);
    }
  };

  // 종목 추가
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;

    setAddingGoal(true);
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/practice-goals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newGoalName }),
        },
      );
      if (res.ok) {
        setNewGoalName("");
        await fetchClassDetail();
      }
    } catch (err) {
      console.error("Add practice goal error:", err);
    } finally {
      setAddingGoal(false);
    }
  };

  const startEditGoal = (goal: PracticeGoalItem) => {
    setEditingGoalId(goal.id);
    setEditingGoalName(goal.name);
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoalId || !editingGoalName.trim()) return;

    setSavingGoalId(editingGoalId);
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/practice-goals`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            practiceGoalId: editingGoalId,
            name: editingGoalName.trim(),
          }),
        },
      );

      if (res.ok) {
        setEditingGoalId(null);
        setEditingGoalName("");
        await fetchClassDetail();
      } else {
        const data = await res.json();
        alert(data.error || "연습 종목명 수정에 실패했습니다.");
      }
    } catch (err) {
      console.error("Update practice goal error:", err);
    } finally {
      setSavingGoalId(null);
    }
  };

  // 연습 목표 비활성화
  const handleDeleteGoal = async (practiceGoalId: string) => {
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/practice-goals?practiceGoalId=${practiceGoalId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error("Delete practice goal error:", err);
    }
  };

  // 시간표 추가
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSchedule(true);
    try {
      const res = await fetch(`/api/teacher/classes/${classId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.error("Add schedule error:", err);
    } finally {
      setAddingSchedule(false);
    }
  };

  // 시간표 삭제
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const res = await fetch(
        `/api/teacher/classes/${classId}/schedules?scheduleId=${scheduleId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        await fetchClassDetail();
      }
    } catch (err) {
      console.error("Delete schedule error:", err);
    }
  };

  const dayNames = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ];

  if (loading) {
    return (
      <div className="page-panel flex items-center justify-center p-8 text-sm text-slate-500">
        반 상세 정보를 불러오는 중입니다...
      </div>
    );
  }

  if (!classDetail) {
    return (
      <div className="page-panel flex flex-col items-center justify-center space-y-4 p-8">
        <p className="text-slate-500">반 정보를 찾을 수 없습니다.</p>
        <Link
          href="/teacher/dashboard/classes"
          className="text-xs text-blue-600 hover:underline"
        >
          ← 반 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-slate-200 py-4 space-y-2">
          <Link
            href="/teacher/dashboard/classes"
            className="text-xs text-blue-600 hover:underline"
          >
            ← 반 목록으로 돌아가기
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                {classDetail.name} 관리
              </h1>
              <p className="text-xs text-slate-500">
                담당 강사: {classDetail.teacher.name} (
                {classDetail.teacher.loginId})
              </p>
            </div>
          </div>
        </header>

        <div className="mobile-scroll flex border-b border-slate-200 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("students")}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === "students"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            학생 명단 ({classDetail.enrollments.length}명)
          </button>
          <button
            onClick={() => setActiveTab("goals")}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === "goals"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            연습 종목 (
            {classDetail.practiceGoals.filter((goal) => goal.isActive).length}개)
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === "schedules"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            정규 시간표 ({classDetail.schedules.length}개)
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-5 border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            반 설정 (실시간 즉시 적용)
          </button>
        </div>

        {/* 탭 1: 학생 명단 관리 */}
        {activeTab === "students" && (
          <div className="space-y-6">
            {/* 학생 추가 버튼 */}
            <div className="page-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-bold text-slate-950">
                이 반에 수강할 학생 배정
              </h3>
              <button
                onClick={openEnrollModal}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-500"
              >
                전역 학생 목록에서 배정하기
              </button>
            </div>

            {/* 학생 목록 (모바일 친화적 카드 레이아웃) */}
            <div className="space-y-3">
              {classDetail.enrollments.length === 0 ? (
                <div className="page-panel p-8 text-center text-xs text-slate-500">
                  배정된 학생이 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {classDetail.enrollments.map((e) => (
                    <div
                      key={e.id}
                      className="page-panel flex flex-col space-y-3 p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-base font-bold text-slate-950">
                            {e.student.name}
                          </h4>
                          <span className="text-[10px] text-slate-500">
                            등록일:{" "}
                            {new Date(e.enrolledAt).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          정상 수강
                        </span>
                      </div>

                      <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 pt-2">
                        <button
                          onClick={() => {
                            setResetPinStudentId(e.student.id);
                            setResetPinValue("");
                          }}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          PIN 재설정
                        </button>
                        <button
                          onClick={() => handleDropStudent(e.student.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
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
        {activeTab === "goals" && (
          <div className="space-y-6">
            <div className="page-panel space-y-3 p-5">
              <h3 className="text-sm font-bold text-slate-950">
                신규 연습 종목 등록
              </h3>
              <form onSubmit={handleAddGoal} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  required
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="연습 종목명 (예: 여성 숏커트, 핑거웨이브 등)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={addingGoal}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {addingGoal ? "추가 중..." : "목표 추가"}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {classDetail.practiceGoals
                .filter((goal) => goal.isActive)
                .map((goal) => (
                  <div
                    key={goal.id}
                    className="page-panel flex flex-col gap-3 p-4"
                  >
                    {editingGoalId === goal.id ? (
                      <form onSubmit={handleUpdateGoal} className="space-y-3">
                        <input
                          type="text"
                          required
                          value={editingGoalName}
                          onChange={(event) =>
                            setEditingGoalName(event.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGoalId(null);
                              setEditingGoalName("");
                            }}
                            className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            disabled={savingGoalId === goal.id}
                            className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                          >
                            {savingGoalId === goal.id ? "저장 중..." : "저장"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-800">
                          {goal.name}
                        </span>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEditGoal(goal)}
                            className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            이름 수정
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-600 transition-colors hover:bg-rose-100"
                          >
                            비활성화
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 탭 3: 정규 시간표 관리 */}
        {activeTab === "schedules" && (
          <div className="space-y-6">
            <div className="page-panel space-y-3 p-5">
              <h3 className="text-sm font-bold text-slate-950">정규 시간표 추가</h3>
              <form
                onSubmit={handleAddSchedule}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <select
                  value={schedDay}
                  onChange={(e) => setSchedDay(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  required
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                  placeholder="종료 (16:00)"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="submit"
                  disabled={addingSchedule}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {addingSchedule ? "추가 중..." : "시간표 등록"}
                </button>
              </form>
            </div>

            <div className="space-y-3">
              {classDetail.schedules.length === 0 ? (
                <div className="page-panel p-8 text-center text-xs text-slate-500">
                  등록된 정규 시간표가 없습니다.
                </div>
              ) : (
                classDetail.schedules.map((sch) => (
                  <div
                    key={sch.id}
                    className="page-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="mr-3 font-bold text-blue-700">
                        {dayNames[sch.dayOfWeek]}
                      </span>
                      <span className="text-sm font-semibold text-slate-950">
                        {sch.startTime} ~ {sch.endTime}
                      </span>
                      <span className="ml-0 block text-xs text-slate-500 sm:ml-3 sm:inline">
                        (사전접속 {sch.preEntryMinutes}분 전 / 제출유예{" "}
                        {sch.gracePeriodMinutes}분 후)
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteSchedule(sch.id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-600 transition-colors hover:bg-rose-100"
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
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-bold text-blue-800">
                  실시간 설정 즉시 적용
                </p>
                <p className="mt-1 leading-relaxed text-blue-700">
                  이 페이지에서 변경한 내용은{" "}
                  <strong>진행 중인 수업 및 향후 수업에 즉시 반영</strong>
                  됩니다.
                </p>
              </div>
            </div>

            <div className="page-panel space-y-4 p-6">
              <h3 className="text-base font-bold text-slate-950">
                접속 및 제출 규칙 설정
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSavingSettings(true);
                  try {
                    const res = await fetch(
                      `/api/teacher/classes/${classId}/settings`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          preEntryMinutes: Number(preEntryMin),
                          gracePeriodMinutes: Number(graceMin),
                        }),
                      },
                    );
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message || "설정이 저장되었습니다.");
                    }
                  } catch (err) {
                    console.error("Save settings error:", err);
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      사전 접속 허용시간 (분 전)
                    </label>
                    <input
                      type="number"
                      value={preEntryMin}
                      onChange={(e) => setPreEntryMin(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      제출 유예시간 (분 후)
                    </label>
                    <input
                      type="number"
                      value={graceMin}
                      onChange={(e) => setGraceMin(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      제출 파일 개수 제한
                    </label>
                    <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
                      개수 제한 없음 (무제한 첨부 가능)
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      개별 파일 최대 용량 (고정)
                    </label>
                    <div className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-700">
                      <span>50 MB 고정</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        (시스템 고정값)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50 p-3.5 text-xs text-blue-700">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      Google Drive 업로드 시{" "}
                      <strong>[학생이름]_[반이름]_[파일명]</strong> 규칙으로
                      자동 저장됩니다.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-rose-600">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-rose-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    <span>
                      첨부파일과 텍스트 기록은 <strong>1개월간 보관</strong>됩니다.
                      월별 엑셀 보관 후 Google Drive 파일과 제출 기록이 함께
                      삭제됩니다.
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                  >
                    {savingSettings ? "저장 중..." : "실시간 적용 설정 저장"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PIN 재설정 모달 */}
        {resetPinStudentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-base font-bold text-slate-950">
                학생 PIN 번호 재설정
              </h3>
              <form onSubmit={handleResetPin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    새 PIN 번호 (4자리)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={resetPinValue}
                    onChange={(e) =>
                      setResetPinValue(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="예: 9999"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPinStudentId(null)}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-500"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <h3 className="text-base font-bold text-slate-950">
                  이 반에 학생 배정하기
                </h3>
                <button
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  닫기
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-2 space-y-2 min-h-[200px]">
                {loadingGlobalStudents ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    학생 목록을 불러오는 중...
                  </div>
                ) : globalStudents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    배정 가능한 새로운 학생이 없습니다.
                    <br />
                    전역 학생 관리에서 먼저 등록해 주세요.
                  </div>
                ) : (
                  globalStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-slate-200 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds((prev) => [
                              ...prev,
                              student.id,
                            ]);
                          } else {
                            setSelectedStudentIds((prev) =>
                              prev.filter((id) => id !== student.id),
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-slate-800">
                        {student.name}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleEnrollStudents}
                  disabled={enrolling || selectedStudentIds.length === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {enrolling
                    ? "배정 중..."
                    : `${selectedStudentIds.length}명 배정 완료`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
