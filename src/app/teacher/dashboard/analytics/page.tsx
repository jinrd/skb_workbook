"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PracticeGoalItem {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
  practiceGoals: PracticeGoalItem[];
}

interface DailyItem {
  date: string;
  submissionCount: number;
  totalDurationSeconds: number;
}

interface SummaryItem {
  submissionCount: number;
  totalDurationSeconds: number;
}

interface NamedSummaryItem extends SummaryItem {
  className?: string;
  goalName?: string;
  studentId?: string;
  studentName?: string;
}

interface AnalyticsData {
  summary: {
    submissionCount: number;
    totalDurationSeconds: number;
    activeStudentCount: number;
  };
  daily: DailyItem[];
  classSummary: NamedSummaryItem[];
  goalSummary: NamedSummaryItem[];
  studentSummary: NamedSummaryItem[];
  submissionHistory: Array<{
    id: string;
    submittedAt: string;
    goalName: string;
    durationSeconds: number;
    previousDurationSeconds: number | null;
    durationChangeSeconds: number | null;
  }>;
  students: NamedSummaryItem[];
  teacherClasses: ClassItem[];
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

function formatDurationAxis(value: number | string): string {
  const totalSeconds = Number(value);

  return formatDuration(Number.isFinite(totalSeconds) ? totalSeconds : 0);
}

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatSubmissionChartLabel(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatSubmissionTooltipLabel(label: unknown): string {
  return typeof label === "string" ? formatSubmittedAt(label) : "";
}

function formatDateLabel(value: string): string {
  return value.slice(5).replace("-", "/");
}
function formatTooltipDuration(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  const totalSeconds =
    typeof rawValue === "number" || typeof rawValue === "string"
      ? Number(rawValue)
      : 0;

  return [
    formatDuration(Number.isFinite(totalSeconds) ? totalSeconds : 0),
    "연습시간",
  ] as const;
}

function formatTooltipCount(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  const count =
    typeof rawValue === "number" || typeof rawValue === "string"
      ? Number(rawValue)
      : 0;

  return [`${Number.isFinite(count) ? count : 0}회`, "제출"] as const;
}

function formatTooltipDate(label: unknown): string {
  return typeof label === "string" ? formatDateLabel(label) : "";
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const [selectedDays, setSelectedDays] = useState(30);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTrendGoalName, setSelectedTrendGoalName] = useState("");
  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableGoals = useMemo(() => {
    if (!analytics) {
      return [];
    }

    if (selectedClassId) {
      return (
        analytics.teacherClasses.find(
          (classItem) => classItem.id === selectedClassId,
        )?.practiceGoals ?? []
      );
    }

    return analytics.teacherClasses.flatMap(
      (classItem) => classItem.practiceGoals,
    );
  }, [analytics, selectedClassId]);

  const selectedStudentName = selectedStudentId
    ? analytics?.students.find(
        (student) => student.studentId === selectedStudentId,
      )?.studentName
    : null;

  const submissionTrend = useMemo(
    () =>
      [...(analytics?.submissionHistory ?? [])]
        .reverse()
        .filter(
          (submission) => submission.goalName === selectedTrendGoalName,
        )
        .slice(-10)
        .map((submission, index) => ({
          ...submission,
          roundLabel: `${index + 1}회`,
        })),
    [analytics, selectedTrendGoalName],
  );

  const trendGoalNames = useMemo(
    () =>
      Array.from(
        new Set(
          (analytics?.submissionHistory ?? []).map(
            (submission) => submission.goalName,
          ),
        ),
      ),
    [analytics],
  );

  useEffect(() => {
    let ignore = false;

    const params = new URLSearchParams({
      days: String(selectedDays),
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

    fetch(`/api/teacher/analytics?${params.toString()}`)
      .then(async (response) => {
        const data = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || "분석 데이터를 불러오지 못했습니다.");
          return;
        }

        setErrorMessage(null);
        setAnalytics(data);

        if (!selectedStudentId && data.students.length > 0) {
          setSelectedStudentId(data.students[0].studentId);
        }

        const availableTrendGoals = Array.from(
          new Set<string>(
            data.submissionHistory.map(
              (submission: { goalName: string }) => submission.goalName,
            ),
          ),
        );

        setSelectedTrendGoalName((currentGoalName) =>
          availableTrendGoals.includes(currentGoalName)
            ? currentGoalName
            : (availableTrendGoals[0] ?? ""),
        );
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Fetch analytics error:", error);

        setErrorMessage("분석 데이터를 불러오는 중 오류가 발생했습니다.");
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
    selectedDays,
    selectedClassId,
    selectedGoalId,
    selectedStudentId,
  ]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedGoalId("");
  };

  if (loading) {
    return (
      <div className="page-panel py-16 text-center text-xs text-slate-500">
        분석 데이터를 불러오는 중입니다.
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-700">
        {errorMessage || "분석 데이터를 불러오지 못했습니다."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600">
            최근 기록 분석
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            {selectedStudentName
              ? `${selectedStudentName} 학생 기록 분석`
              : "학생 기록 분석"}
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setSelectedDays(days)}
              className={`h-9 border px-3 text-xs font-semibold ${
                selectedDays === days
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {days}일
            </button>
          ))}
        </div>
      </header>

      <section className="page-panel grid gap-3 p-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">학생</span>
          <select
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {analytics.students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.studentName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">반</span>
          <select
            value={selectedClassId}
            onChange={(event) => handleClassChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">전체 반</option>
            {analytics.teacherClasses.map((classItem) => (
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
            onChange={(event) => setSelectedGoalId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">전체 목표</option>
            {availableGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="page-panel p-3">
          <p className="text-[11px] text-slate-500">제출</p>
          <p className="mt-1 font-mono text-lg font-bold text-blue-700">
            {analytics.summary.submissionCount}
          </p>
        </div>

        <div className="page-panel p-3">
          <p className="text-[11px] text-slate-500">총 연습시간</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-700">
            {formatDuration(analytics.summary.totalDurationSeconds)}
          </p>
        </div>

        <div className="page-panel p-3">
          <p className="text-[11px] text-slate-500">수강 반</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-950">
            {analytics.classSummary.length}
          </p>
        </div>
      </section>
      <section className="page-panel p-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-slate-950">
            최근 10회 연습 시간 추이
          </h3>
          <select
            value={selectedTrendGoalName}
            onChange={(event) => setSelectedTrendGoalName(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            {trendGoalNames.map((goalName) => (
              <option key={goalName} value={goalName}>
                {goalName}
              </option>
            ))}
          </select>
        </div>

        {submissionTrend.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            선택 기간에 제출 기록이 없습니다.
          </p>
        ) : submissionTrend.length === 1 ? (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-700">
              선택한 목표의 첫 기록입니다.
            </p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-950">
              {formatDuration(submissionTrend[0].durationSeconds)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatSubmittedAt(submissionTrend[0].submittedAt)}
            </p>
          </div>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={submissionTrend}>
                <CartesianGrid stroke="#dbe4df" strokeDasharray="3 3" />
                <XAxis
                  dataKey="submittedAt"
                  tickFormatter={formatSubmissionChartLabel}
                  tick={{ fill: "#64706d", fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={formatDurationAxis}
                  tick={{ fill: "#64706d", fontSize: 11 }}
                />
                <Tooltip
                  formatter={formatTooltipDuration}
                  labelFormatter={formatSubmissionTooltipLabel}
                />
                <Line
                  type="monotone"
                  dataKey="durationSeconds"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ fill: "#ffffff", r: 4, stroke: "#2563eb", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      <section className="page-panel overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-950">전체 제출 변화 기록</h3>
        </div>

        {analytics.submissionHistory.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            선택 기간에 제출 기록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">제출 시각</th>
                  <th className="px-4 py-3 font-semibold">연습 목표</th>
                  <th className="px-4 py-3 font-semibold">이번 기록</th>
                  <th className="px-4 py-3 font-semibold">이전 기록</th>
                  <th className="px-4 py-3 font-semibold">변화</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.submissionHistory.map((submission) => {
                  const change = submission.durationChangeSeconds;
                  const changeLabel =
                    change === null
                      ? "첫 기록"
                      : change < 0
                        ? `단축 ${formatDuration(Math.abs(change))}`
                        : change > 0
                          ? `증가 ${formatDuration(change)}`
                          : "변화 없음";

                  const changeClassName =
                    change === null
                      ? "text-slate-500"
                      : change < 0
                        ? "text-emerald-700"
                        : change > 0
                          ? "text-rose-600"
                          : "text-slate-600";

                  return (
                    <tr key={submission.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatSubmittedAt(submission.submittedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                        {submission.goalName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-emerald-700">
                        {formatDuration(submission.durationSeconds)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600">
                        {submission.previousDurationSeconds === null
                          ? "-"
                          : formatDuration(submission.previousDurationSeconds)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 font-semibold ${changeClassName}`}
                      >
                        {changeLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="page-panel p-4">
        <h3 className="text-sm font-bold text-slate-950">일별 총 연습시간</h3>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.daily}>
              <CartesianGrid stroke="#dbe4df" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: "#64706d", fontSize: 11 }}
              />
              <YAxis
                tickFormatter={formatDurationAxis}
                tick={{ fill: "#64706d", fontSize: 11 }}
              />
              <Tooltip
                formatter={formatTooltipDuration}
                labelFormatter={formatTooltipDate}
              />
              <Line
                type="monotone"
                dataKey="totalDurationSeconds"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="page-panel p-4">
        <h3 className="text-sm font-bold text-slate-950">일별 제출 횟수</h3>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.daily}>
              <CartesianGrid stroke="#dbe4df" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: "#64706d", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64706d", fontSize: 11 }}
              />
              <Tooltip
                formatter={formatTooltipCount}
                labelFormatter={formatTooltipDate}
              />
              <Bar dataKey="submissionCount" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
