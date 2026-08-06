"use client";

import { useEffect, useMemo, useState } from "react";

interface ClassItem {
  id: string;
  name: string;
}

interface StudentItem {
  id: string;
  name: string;
}

interface AttendanceItem {
  id: string;
  entryAt: string;
  exitAt: string | null;
  exitSource: "MANUAL" | "AUTO_SESSION_END" | null;
  class: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    name: string;
  };
}

interface AttendanceSummary {
  totalAttendanceCount: number;
  activeAttendanceCount: number;
  completedAttendanceCount: number;
  totalStaySeconds: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatSeoulDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

function formatSeoulTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function getStaySeconds(entryAt: string, exitAt: string | null): number {
  if (!exitAt) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 1000),
  );
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours <= 0 && minutes <= 0) {
    return "1분 미만";
  }

  if (hours <= 0) {
    return `${minutes}분`;
  }

  return `${hours}시간 ${minutes}분`;
}

function formatExitSource(value: AttendanceItem["exitSource"]): string {
  if (value === "AUTO_SESSION_END") {
    return "자동";
  }

  if (value === "MANUAL") {
    return "직접";
  }

  return "-";
}

export default function TeacherAttendanceDashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [attendances, setAttendances] = useState<AttendanceItem[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalAttendanceCount: 0,
    activeAttendanceCount: 0,
    completedAttendanceCount: 0,
    totalStaySeconds: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 30,
    totalPages: 0,
  });

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groupedAttendances = useMemo(() => {
    const groups = new Map<string, AttendanceItem[]>();

    for (const attendance of attendances) {
      const key = `${attendance.student.id}:${attendance.student.name}`;
      groups.set(key, [...(groups.get(key) ?? []), attendance]);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      studentName: items[0].student.name,
      items,
    }));
  }, [attendances]);

  useEffect(() => {
    let ignore = false;

    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    });

    if (selectedClassId) {
      params.set("classId", selectedClassId);
    }

    if (selectedStudentId) {
      params.set("studentId", selectedStudentId);
    }

    if (fromDate) {
      params.set("from", fromDate);
    }

    if (toDate) {
      params.set("to", toDate);
    }

    fetch(`/api/teacher/attendance?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || "출석 기록을 불러오지 못했습니다.");
          return;
        }

        setErrorMessage(null);
        setClasses(data.teacherClasses ?? []);
        setStudents(data.students ?? []);
        setAttendances(data.attendances ?? []);
        setSummary(
          data.summary ?? {
            totalAttendanceCount: 0,
            activeAttendanceCount: 0,
            completedAttendanceCount: 0,
            totalStaySeconds: 0,
          },
        );
        setPagination(
          data.pagination ?? {
            page: 1,
            pageSize: 30,
            totalPages: 0,
          },
        );
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Fetch attendance error:", error);
        setErrorMessage("서버 연결 중 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    selectedClassId,
    selectedStudentId,
    fromDate,
    toDate,
    pagination.page,
    pagination.pageSize,
  ]);

  const resetPage = () => {
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setSelectedClassId("");
    setSelectedStudentId("");
    setFromDate("");
    setToDate("");
    resetPage();
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600">최근 1개월</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">출석 기록</h2>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="page-panel px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">입실</p>
            <p className="font-mono text-base font-bold text-blue-700">
              {summary.totalAttendanceCount}회
            </p>
          </div>

          <div className="page-panel px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">수강 중</p>
            <p className="font-mono text-base font-bold text-amber-700">
              {summary.activeAttendanceCount}명
            </p>
          </div>

          <div className="page-panel px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">체류시간</p>
            <p className="font-mono text-base font-bold text-emerald-700">
              {formatDuration(summary.totalStaySeconds)}
            </p>
          </div>
        </div>
      </header>

      <section className="page-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">반</span>
            <select
              value={selectedClassId}
              onChange={(event) => {
                setSelectedClassId(event.target.value);
                setSelectedStudentId("");
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체 반</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">학생</span>
            <select
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체 학생</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">시작일</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">종료일</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                resetPage();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            필터 초기화
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-xs text-rose-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="page-panel py-16 text-center text-xs text-slate-500">
          출석 기록을 불러오는 중입니다.
        </div>
      ) : attendances.length === 0 ? (
        <div className="page-panel py-16 text-center text-xs text-slate-500">
          조건에 맞는 출석 기록이 없습니다.
        </div>
      ) : (
        <section className="space-y-3">
          {groupedAttendances.map((group) => (
            <article
              key={group.key}
              className="page-panel overflow-hidden bg-white"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-950">
                  {group.studentName}
                </h3>
                <span className="font-mono text-xs font-semibold text-blue-700">
                  {group.items.length}회
                </span>
              </div>

              <div className="hidden grid-cols-[150px_120px_100px_100px_120px_90px] gap-4 border-b border-slate-100 px-4 py-2 text-[11px] font-semibold text-slate-500 md:grid">
                <span>날짜</span>
                <span>반</span>
                <span>입실</span>
                <span>퇴실</span>
                <span>체류시간</span>
                <span>방식</span>
              </div>

              <div className="divide-y divide-slate-100">
                {group.items.map((attendance) => {
                  const isActive = !attendance.exitAt;

                  return (
                    <div
                      key={attendance.id}
                      className="grid gap-2 px-4 py-3 text-xs md:grid-cols-[150px_120px_100px_100px_120px_90px] md:items-center md:gap-4"
                    >
                      <time className="font-mono text-slate-500">
                        {formatSeoulDate(attendance.entryAt)}
                      </time>

                      <p className="font-semibold text-slate-950">
                        {attendance.class.name}
                      </p>

                      <p className="font-mono font-semibold text-blue-700">
                        {formatSeoulTime(attendance.entryAt)}
                      </p>

                      <p
                        className={`font-mono font-semibold ${
                          isActive ? "text-amber-700" : "text-slate-700"
                        }`}
                      >
                        {isActive ? "수강 중" : formatSeoulTime(attendance.exitAt)}
                      </p>

                      <p className="font-mono text-emerald-700">
                        {isActive
                          ? "-"
                          : formatDuration(
                              getStaySeconds(
                                attendance.entryAt,
                                attendance.exitAt,
                              ),
                            )}
                      </p>

                      <p className="text-slate-500">
                        {formatExitSource(attendance.exitSource)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}

      {pagination.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page: Math.max(1, current.page - 1),
              }))
            }
            disabled={pagination.page <= 1}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 disabled:opacity-40"
          >
            이전
          </button>

          <span className="font-mono text-xs text-slate-500">
            {pagination.page} / {pagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPagination((current) => ({
                ...current,
                page: Math.min(current.totalPages, current.page + 1),
              }))
            }
            disabled={pagination.page >= pagination.totalPages}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      )}
    </div>
  );
}
