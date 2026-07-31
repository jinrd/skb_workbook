"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

interface SummaryData {
  classId: string;
  className: string;
  todayDateStr: string;
  todayDate: string;
  summary: {
    totalCount: number;
    totalDurationSeconds: number;
    enrolledStudentCount: number;
    submittedStudentCount: number;
    missingStudentCount: number;
  };
  goalSummary: Array<{
    goalName: string;
    count: number;
    totalDurationSeconds: number;
  }>;
  studentSummary: Array<{
    studentId: string;
    studentName: string;
    count: number;
    totalDurationSeconds: number;
    goals: string[];
  }>;
  recentSubmissions: Array<{
    id: string;
    goalName: string;
    durationSeconds: number;
    memo: string | null;
    submittedAt: string;
    student: {
      name: string;
    };
  }>;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export default function ClassSummaryPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/teacher/classes/${classId}/summary`)
      .then(async (response) => {
        const result = (await response.json()) as SummaryData & {
          error?: string;
        };

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(
            result.error || "수업 요약 정보를 가져오는 데 실패했습니다.",
          );
          return;
        }

        setErrorMessage(null);
        setData(result);
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Fetch class summary error:", error);
        setErrorMessage("수업 요약 정보를 불러오는 중 문제가 발생했습니다.");
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [classId]);

  if (loading) {
    return (
      <div className="border border-slate-800 bg-slate-900 py-16 text-center text-sm text-slate-400">
        수업 요약을 불러오는 중입니다.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          href="/teacher/dashboard"
          className="inline-flex border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          대시보드
        </Link>
        <p className="border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMessage || "수업 요약을 불러오지 못했습니다."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/teacher/dashboard"
            className="text-sm text-slate-400 hover:text-white"
          >
            대시보드
          </Link>
          <p className="mt-3 text-sm font-semibold text-indigo-300">
            {data.todayDate}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            {data.className} 수업 요약
          </h2>
        </div>

        <Link
          href={`/teacher/dashboard/submissions?classId=${classId}`}
          className="border border-slate-700 px-4 py-2.5 text-center text-sm font-bold text-slate-200 hover:bg-slate-800"
        >
          제출 기록 보기
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">제출</p>
          <p className="mt-1 text-lg font-bold text-indigo-300">
            {data.summary.totalCount}회
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">총 연습시간</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
            {formatDuration(data.summary.totalDurationSeconds)}
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">제출 학생</p>
          <p className="mt-1 text-lg font-bold text-white">
            {data.summary.submittedStudentCount}명
          </p>
        </div>
        <div className="border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">미제출 학생</p>
          <p className="mt-1 text-lg font-bold text-rose-300">
            {data.summary.missingStudentCount}명
          </p>
        </div>
      </section>

      <section className="border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-base font-bold text-white">학생별 기록</h3>
          <span className="text-xs text-slate-400">
            수강 {data.summary.enrolledStudentCount}명
          </span>
        </div>

        <div className="divide-y divide-slate-800">
          {data.studentSummary.map((student) => (
            <div
              key={student.studentId}
              className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white">{student.studentName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  제출 {student.count}회
                  {student.goals.length > 0
                    ? ` · ${student.goals.join(", ")}`
                    : " · 제출 기록 없음"}
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-emerald-300">
                {formatDuration(student.totalDurationSeconds)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-base font-bold text-white">목표별 기록</h3>
        </div>

        {data.goalSummary.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">오늘 제출 기록이 없습니다.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {data.goalSummary.map((goal) => (
              <div
                key={goal.goalName}
                className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-white">{goal.goalName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    제출 {goal.count}회
                  </p>
                </div>
                <p className="font-mono text-sm font-bold text-emerald-300">
                  {formatDuration(goal.totalDurationSeconds)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-base font-bold text-white">최근 제출 기록</h3>
        </div>

        {data.recentSubmissions.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">오늘 제출 기록이 없습니다.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {data.recentSubmissions.map((submission) => (
              <article key={submission.id} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {submission.student.name}
                    </p>
                    <p className="mt-1 text-sm text-indigo-300">
                      {submission.goalName}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-bold text-emerald-300">
                    {formatDuration(submission.durationSeconds)}
                  </p>
                </div>

                {submission.memo && (
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {submission.memo}
                  </p>
                )}

                <time className="block text-xs text-slate-500">
                  {formatTime(submission.submittedAt)}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
