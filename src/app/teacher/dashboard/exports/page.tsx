"use client";

import { useEffect, useState } from "react";

type ExportStatus = "GENERATED" | "DOWNLOADED" | "CLEANUP_COMPLETED" | "FAILED";

interface ExportLog {
  id: string;
  periodKey: string;
  status: ExportStatus;
  submissionCount: number;
  generatedAt: string;
  downloadedAt: string | null;
  dbDeletedAt: string | null;
  driveDeletedAt: string | null;
  errorMessage: string | null;
}

interface ExportStatusResponse {
  isAdmin: boolean;
  exportLogs: ExportLog[];
}

function getPreviousMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const currentYear = Number(values.year);
  const currentMonth = Number(values.month);
  const year = currentMonth === 1 ? currentYear - 1 : currentYear;
  const month = currentMonth === 1 ? 12 : currentMonth - 1;

  return `${year}-${String(month).padStart(2, "0")}`;
}

function getStatusLabel(status: ExportStatus) {
  const labels: Record<ExportStatus, string> = {
    GENERATED: "파일 생성됨",
    DOWNLOADED: "다운로드 완료",
    CLEANUP_COMPLETED: "보관 정리 완료",
    FAILED: "정리 재시도 필요",
  };

  return labels[status];
}

function getStatusClassName(status: ExportStatus) {
  const classes: Record<ExportStatus, string> = {
    GENERATED: "border border-amber-200 bg-amber-50 text-amber-700",
    DOWNLOADED: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    CLEANUP_COMPLETED: "border border-slate-200 bg-slate-50 text-slate-600",
    FAILED: "border border-rose-200 bg-rose-50 text-rose-700",
  };

  return classes[status];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export default function MonthlyExportPage() {
  const latestPeriod = getPreviousMonthKey();

  const [periodKey, setPeriodKey] = useState(latestPeriod);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedPeriod, setCompletedPeriod] = useState<string | null>(null);
  const [cleanupPeriod, setCleanupPeriod] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch("/api/teacher/exports/monthly")
      .then(async (response) => {
        const data = (await response.json()) as ExportStatusResponse & {
          error?: string;
        };

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(
            data.error || "월별 내보내기 이력을 불러오지 못했습니다.",
          );
          return;
        }

        setIsAdmin(data.isAdmin);
        setExportLogs(data.exportLogs);
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Monthly export status fetch error:", error);
        setErrorMessage(
          "월별 내보내기 이력을 불러오는 중 문제가 발생했습니다.",
        );
      });

    return () => {
      ignore = true;
    };
  }, []);

  const refreshExportLogs = async () => {
    const response = await fetch("/api/teacher/exports/monthly");

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ExportStatusResponse;

    setIsAdmin(data.isAdmin);
    setExportLogs(data.exportLogs);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setErrorMessage(null);
    setCompletedPeriod(null);

    try {
      const response = await fetch("/api/teacher/exports/monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ periodKey }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };

        throw new Error(data.error || "엑셀 파일을 만들지 못했습니다.");
      }

      const workbook = await response.blob();
      const downloadUrl = URL.createObjectURL(workbook);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `SKB_수업기록_${periodKey}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1_000);

      const confirmation = await fetch("/api/teacher/exports/monthly", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ periodKey }),
      });

      if (!confirmation.ok) {
        const data = (await confirmation.json()) as { error?: string };

        throw new Error(
          data.error || "다운로드 완료 기록을 저장하지 못했습니다.",
        );
      }

      setCompletedPeriod(periodKey);
      await refreshExportLogs();
    } catch (error) {
      console.error("Monthly export download error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "엑셀 파일을 만드는 중 문제가 발생했습니다.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAttendanceDownload = async () => {
    setErrorMessage(null);
    try {
      const response = await fetch("/api/teacher/exports/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "출석 엑셀 파일을 만들지 못했습니다.");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `SKB_출석기록_${periodKey}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "출석 엑셀 파일을 만들지 못했습니다.",
      );
    }
  };

  const handleCleanup = async () => {
    if (!cleanupPeriod) {
      return;
    }

    setIsCleaningUp(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/teacher/exports/monthly/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ periodKey: cleanupPeriod }),
      });

      const data = (await response.json()) as {
        completed?: boolean;
        remainingSubmissionCount?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "월별 보관 정리를 실행하지 못했습니다.");
      }

      if (!data.completed) {
        throw new Error(
          `${data.remainingSubmissionCount ?? 0}건이 남아 정리가 완료되지 않았습니다.`,
        );
      }

      setCleanupPeriod(null);
      await refreshExportLogs();
    } catch (error) {
      console.error("Monthly cleanup error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "월별 보관 정리 중 문제가 발생했습니다.",
      );
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-sm font-semibold text-blue-600">기록 보관</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          월별 엑셀 내보내기
        </h2>
      </div>

      <div className="page-panel max-w-md p-5">
        <label
          htmlFor="periodKey"
          className="block text-sm font-semibold text-slate-700"
        >
          내보낼 월
        </label>

        <input
          id="periodKey"
          type="month"
          value={periodKey}
          max={latestPeriod}
          onChange={(event) => {
            setPeriodKey(event.target.value);
            setErrorMessage(null);
            setCompletedPeriod(null);
          }}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-500"
        />

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || !periodKey}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-3 text-[13px] font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
              />
            </svg>
            <span className="truncate">
              {isDownloading ? "생성 중..." : "수업기록 다운로드"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleAttendanceDownload}
            disabled={isDownloading || !periodKey}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-3 text-[13px] font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
              />
            </svg>
            <span className="truncate">출석기록 다운로드</span>
          </button>
        </div>

        {completedPeriod && (
          <p className="mt-4 text-sm font-medium text-emerald-700">
            {completedPeriod} 기록을 다운로드했습니다.
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-lg font-bold text-slate-950">최근 내보내기</h3>

        <div className="page-panel mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">월</th>
                <th className="px-4 py-3 font-semibold">제출</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">다운로드 시각</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-right font-semibold">관리</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {exportLogs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">
                    {log.periodKey}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {log.submissionCount}건
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(log.status)}`}
                    >
                      {getStatusLabel(log.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {formatDateTime(log.downloadedAt)}
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {log.status === "DOWNLOADED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCleanupPeriod(log.periodKey);
                            setErrorMessage(null);
                          }}
                          className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          보관 정리
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {exportLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    내보낸 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cleanupPeriod && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cleanup-title"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold text-rose-600">
              되돌릴 수 없음
            </p>
            <h3
              id="cleanup-title"
              className="mt-1 text-xl font-bold text-slate-950"
            >
              {cleanupPeriod} 기록을 정리할까요?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              해당 월의 제출 기록과 Google Drive 파일이 삭제됩니다. 다운로드
              완료된 관리자 전체 엑셀은 서버에 보관되지 않습니다.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCleanupPeriod(null)}
                disabled={isCleaningUp}
                className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCleanup}
                disabled={isCleaningUp}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {isCleaningUp ? "정리 중..." : "삭제하고 정리"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
