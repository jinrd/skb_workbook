"use client";

import { useEffect, useMemo, useState } from "react";

interface PracticeGoalItem {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
  practiceGoals: PracticeGoalItem[];
}

interface StudentItem {
  id: string;
  name: string;
}

interface SubmissionItem {
  id: string;
  goalName: string;
  durationSeconds: number;
  memo: string | null;
  submittedAt: string;
  class: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    name: string;
  };
  practiceGoal?: {
    id: string;
    name: string;
  } | null;
  files: Array<{
    id: string;
    fileName: string;
    mimeType: string | null;
  }>;
}

interface SubmissionSummary {
  totalSubmissionCount: number;
  totalDurationSeconds: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function TeacherSubmissionsDashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);

  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);

  const [summary, setSummary] = useState<SubmissionSummary>({
    totalSubmissionCount: 0,
    totalDurationSeconds: 0,
  });

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 30,
    totalPages: 0,
  });

  const [selectedClassId, setSelectedClassId] = useState("");

  const [selectedGoalId, setSelectedGoalId] = useState("");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableGoals = useMemo(() => {
    if (selectedClassId) {
      return (
        classes.find((classItem) => classItem.id === selectedClassId)
          ?.practiceGoals ?? []
      );
    }

    return classes.flatMap((classItem) => classItem.practiceGoals);
  }, [classes, selectedClassId]);

  useEffect(() => {
    let ignore = false;

    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    });

    if (selectedClassId) {
      params.set("classId", selectedClassId);
    }

    if (selectedGoalId) {
      params.set("practiceGoalId", selectedGoalId);
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

    fetch(`/api/teacher/submissions?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || "제출 기록을 불러오지 못했습니다.");
          return;
        }

        setErrorMessage(null);

        setClasses(data.teacherClasses ?? []);
        setStudents(data.students ?? []);
        setSubmissions(data.submissions ?? []);
        setSummary(
          data.summary ?? {
            totalSubmissionCount: 0,
            totalDurationSeconds: 0,
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

        console.error("Fetch submissions error:", error);

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
    selectedGoalId,
    selectedStudentId,
    fromDate,
    toDate,
    pagination.page,
    pagination.pageSize,
  ]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedGoalId("");
    setSelectedStudentId("");
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleGoalChange = (goalId: string) => {
    setSelectedGoalId(goalId);
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setSelectedClassId("");
    setSelectedGoalId("");
    setSelectedStudentId("");
    setFromDate("");
    setToDate("");
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  };

  const handlePreviousPage = () => {
    setPagination((current) => ({
      ...current,
      page: Math.max(1, current.page - 1),
    }));
  };

  const handleNextPage = () => {
    setPagination((current) => ({
      ...current,
      page: Math.min(current.totalPages, current.page + 1),
    }));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600">최근 1개월</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">제출함</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="page-panel px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">제출</p>
            <p className="font-mono text-base font-bold text-blue-700">
              {summary.totalSubmissionCount}회
            </p>
          </div>

          <div className="page-panel px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">총 연습시간</p>
            <p className="font-mono text-base font-bold text-emerald-700">
              {formatDuration(summary.totalDurationSeconds)}
            </p>
          </div>
        </div>
      </header>

      <section className="page-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">반</span>
            <select
              value={selectedClassId}
              onChange={(event) => handleClassChange(event.target.value)}
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
            <span className="mb-1 block text-xs text-slate-500">연습 목표</span>
            <select
              value={selectedGoalId}
              onChange={(event) => handleGoalChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체 목표</option>
              {availableGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
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
                setPagination((current) => ({
                  ...current,
                  page: 1,
                }));
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
                setPagination((current) => ({
                  ...current,
                  page: 1,
                }));
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
                setPagination((current) => ({
                  ...current,
                  page: 1,
                }));
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
          제출 기록을 불러오는 중입니다.
        </div>
      ) : submissions.length === 0 ? (
        <div className="page-panel py-16 text-center text-xs text-slate-500">
          조건에 맞는 제출 기록이 없습니다.
        </div>
      ) : (
        <section className="page-panel overflow-hidden">
          <div className="hidden grid-cols-[150px_120px_1fr_140px_110px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold text-slate-500 md:grid">
            <span>제출일시</span>
            <span>반 / 학생</span>
            <span>연습 목표 / 메모</span>
            <span>연습시간</span>
            <span>첨부</span>
          </div>

          <div className="divide-y divide-slate-100">
            {submissions.map((submission) => (
              <article
                key={submission.id}
                className="grid gap-3 bg-white px-4 py-4 md:grid-cols-[150px_120px_1fr_140px_110px] md:items-center md:gap-4"
              >
                <time className="font-mono text-xs text-slate-500">
                  {formatSubmittedAt(submission.submittedAt)}
                </time>

                <div>
                  <p className="text-xs font-semibold text-slate-950">
                    {submission.student.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {submission.class.name}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-blue-700">
                    {submission.practiceGoal?.name ?? submission.goalName}
                  </p>

                  {submission.memo && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                      {submission.memo}
                    </p>
                  )}
                </div>

                <p className="font-mono text-sm font-semibold text-emerald-700">
                  {formatDuration(submission.durationSeconds)}
                </p>

                <div className="min-w-0">
                  {submission.files.length === 0 ? (
                    <span className="text-xs text-slate-400">없음</span>
                  ) : (
                    <div className="space-y-1">
                      {submission.files.map((file) => (
                        <a
                          key={file.id}
                          href={`/api/teacher/submissions/${submission.id}/files/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs font-semibold text-blue-700 underline underline-offset-2"
                        >
                          {file.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pagination.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePreviousPage}
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
            onClick={handleNextPage}
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
