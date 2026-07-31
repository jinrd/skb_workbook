"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface EnrollmentItem {
  enrolledAt: string;
  class: {
    id: string;
    name: string;
  };
}

interface SubmissionItem {
  id: string;
  submittedAt: string;
  goalName: string;
  durationSeconds: number;
  memo: string | null;
  class: {
    id: string;
    name: string;
  };
}

interface StudentRecordData {
  student: {
    id: string;
    name: string;
    enrollments: EnrollmentItem[];
  };
  summary: {
    classCount: number;
    submissionCount: number;
    totalDurationSeconds: number;
    lastSubmittedAt: string | null;
  };
  classSummaries: {
    classId: string;
    className: string;
    submissionCount: number;
    totalDurationSeconds: number;
    lastSubmittedAt: string | null;
  }[];
  goalSummaries: {
    goalName: string;
    submissionCount: number;
    totalDurationSeconds: number;
  }[];
  submissions: SubmissionItem[];
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

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

export default function StudentRecordsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);

  const [recordData, setRecordData] = useState<StudentRecordData | null>(null);

  const [selectedClassId, setSelectedClassId] = useState("");

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/teacher/students/${studentId}/records`)
      .then(async (response) => {
        const data = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || "학생 기록을 불러오지 못했습니다.");
          return;
        }

        setErrorMessage(null);
        setRecordData(data);
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Fetch student records error:", error);

        setErrorMessage("학생 기록을 불러오는 중 오류가 발생했습니다.");
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [studentId]);

  const displayedSubmissions = useMemo(() => {
    if (!recordData) {
      return [];
    }

    if (!selectedClassId) {
      return recordData.submissions;
    }

    return recordData.submissions.filter(
      (submission) => submission.class.id === selectedClassId,
    );
  }, [recordData, selectedClassId]);

  const displayedDurationSeconds = useMemo(
    () =>
      displayedSubmissions.reduce(
        (total, submission) => total + submission.durationSeconds,
        0,
      ),
    [displayedSubmissions],
  );

  if (loading) {
    return (
      <div className="border border-slate-800 bg-slate-900 py-16 text-center text-xs text-slate-400">
        학생 기록을 불러오는 중입니다.
      </div>
    );
  }

  if (!recordData) {
    return (
      <div className="space-y-4">
        <Link
          href="/teacher/dashboard/students"
          className="inline-flex h-9 items-center border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
        >
          학생 목록
        </Link>

        <div className="border border-rose-500/30 bg-rose-500/10 p-4 text-center text-xs text-rose-200">
          {errorMessage || "학생 기록을 찾을 수 없습니다."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-slate-800 pb-4">
        <Link
          href="/teacher/dashboard/students"
          className="text-xs text-slate-400 hover:text-white"
        >
          학생 목록
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-300">
              최근 1개월 기록
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              {recordData.student.name}
            </h2>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">수강 반</span>

            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="h-10 min-w-44 border border-slate-700 bg-slate-950 px-3 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">전체 반</option>

              {recordData.student.enrollments.map((enrollment) => (
                <option key={enrollment.class.id} value={enrollment.class.id}>
                  {enrollment.class.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-[11px] text-slate-400">수강 반</p>
          <p className="mt-1 font-mono text-lg font-bold text-white">
            {recordData.summary.classCount}
          </p>
        </div>

        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-[11px] text-slate-400">제출 횟수</p>
          <p className="mt-1 font-mono text-lg font-bold text-indigo-300">
            {displayedSubmissions.length}
          </p>
        </div>

        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-[11px] text-slate-400">총 연습시간</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
            {formatDuration(displayedDurationSeconds)}
          </p>
        </div>

        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-[11px] text-slate-400">최근 제출</p>
          <p className="mt-1 text-xs font-semibold text-slate-200">
            {formatDateTime(
              selectedClassId
                ? (displayedSubmissions[0]?.submittedAt ?? null)
                : recordData.summary.lastSubmittedAt,
            )}
          </p>
        </div>
      </section>

      <section className="border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-bold text-white">반별 요약</h3>
        </div>

        {recordData.classSummaries.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">
            최근 1개월 제출 기록이 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recordData.classSummaries.map((item) => (
              <div
                key={item.classId}
                className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.className}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    제출 {item.submissionCount}회 · 최근 제출{" "}
                    {formatDateTime(item.lastSubmittedAt)}
                  </p>
                </div>

                <p className="font-mono text-sm font-semibold text-emerald-300">
                  {formatDuration(item.totalDurationSeconds)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950 px-4 py-3">
          <h3 className="text-sm font-bold text-white">제출 기록</h3>
        </div>

        {displayedSubmissions.length === 0 ? (
          <p className="bg-slate-900 p-8 text-center text-xs text-slate-400">
            조건에 맞는 제출 기록이 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {displayedSubmissions.map((submission) => (
              <article
                key={submission.id}
                className="space-y-2 bg-slate-900 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-indigo-200">
                      {submission.goalName}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {submission.class.name}
                    </p>
                  </div>

                  <p className="shrink-0 font-mono text-sm font-semibold text-emerald-300">
                    {formatDuration(submission.durationSeconds)}
                  </p>
                </div>

                {submission.memo && (
                  <p className="whitespace-pre-wrap text-xs leading-5 text-slate-300">
                    {submission.memo}
                  </p>
                )}

                <time className="block font-mono text-[11px] text-slate-500">
                  {formatDateTime(submission.submittedAt)}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
