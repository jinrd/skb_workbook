"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PracticeGoalItem {
  id: string;
  name: string;
  description: string | null;
}

interface SubmissionFileItem {
  id: string;
  fileName: string;
  fileSize: number;
}

interface SubmissionItem {
  id: string;
  submittedAt: string;
  goalName: string;
  durationSeconds: number;
  memo: string | null;
  files: SubmissionFileItem[];
}

export default function StudentSubmitPage() {
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [goals, setGoals] = useState<PracticeGoalItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 입력 State
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [memo, setMemo] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalDurationSeconds =
    durationHours * 3600 + durationMinutes * 60 + durationSeconds;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/student/session-info");

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "세션 정보를 불러올 수 없습니다.");
        return;
      }

      const receivedGoals: PracticeGoalItem[] = data.goals ?? [];

      setStudentName(data.studentName);
      setClassName(data.className);
      setGoals(receivedGoals);
      setSubmissions(data.submissions ?? []);

      setSelectedGoalId((currentGoalId) => {
        const currentGoalStillExists = receivedGoals.some(
          (goal) => goal.id === currentGoalId,
        );

        if (currentGoalStillExists) {
          return currentGoalId;
        }

        return receivedGoals[0]?.id ?? "";
      });
    } catch (error) {
      console.error("Fetch info error:", error);
      setErrorMessage("서버 연결 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    fetch("/api/student/session-info")
      .then(async (response) => {
        const data = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setErrorMessage(data.error || "세션 정보를 불러올 수 없습니다.");
          return;
        }

        const receivedGoals: PracticeGoalItem[] = data.goals ?? [];

        setStudentName(data.studentName);
        setClassName(data.className);
        setGoals(receivedGoals);
        setSubmissions(data.submissions ?? []);
        setSelectedGoalId(receivedGoals[0]?.id ?? "");
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        console.error("Fetch info error:", error);
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
  }, []);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);

    const overSizedFile = newFiles.find((f) => f.size > 10 * 1024 * 1024);
    if (overSizedFile) {
      alert(`파일 '${overSizedFile.name}'의 용량이 10MB를 초과합니다.`);
      return;
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedGoalId) {
      setErrorMessage("연습 목표를 선택해 주세요.");
      return;
    }

    if (
      durationHours < 0 ||
      durationMinutes < 0 ||
      durationMinutes > 59 ||
      durationSeconds < 0 ||
      durationSeconds > 59
    ) {
      setErrorMessage("연습 시간을 올바르게 입력해 주세요.");
      return;
    }

    if (totalDurationSeconds <= 0) {
      setErrorMessage("연습 시간을 1초 이상 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();

      formData.append("practiceGoalId", selectedGoalId);

      formData.append("durationSeconds", String(totalDurationSeconds));

      formData.append("memo", memo);

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/student/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "제출 중 오류가 발생했습니다.");
        return;
      }

      setSelectedFiles([]);
      setMemo("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchInfo();
    } catch (error) {
      console.error("Submit error:", error);
      setErrorMessage("제출물을 전송하는 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };
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

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] p-4 text-xs text-slate-900">
        <div className="flex items-center gap-2 text-blue-600">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>수업 및 제출 페이지를 구성 중입니다...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] p-3 pb-10 text-slate-900 sm:p-4">
      <div className="max-w-md mx-auto space-y-5">
        <header className="page-panel space-y-3 p-5">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                수업 수강 중
              </span>
              <h1 className="text-xl font-bold text-slate-950">
                {studentName} 수강생
              </h1>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {className}
            </span>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
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
            <div className="space-y-0.5">
              <p className="font-bold text-amber-800">파일 삭제 사전 안내</p>
              <p className="text-[11px] leading-relaxed text-amber-800/90">
                제출하신 사진/동영상 첨부파일과 텍스트 제출 기록은{" "}
                <strong>1개월간 보관</strong>됩니다. 월별 엑셀 보관 후 Google
                Drive 파일과 제출 기록이 함께 삭제됩니다.
              </p>
            </div>
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          className="page-panel space-y-5 p-5"
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-950">
            <span>실습 결과물 제출</span>
          </h2>

          {errorMessage && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* 연습 목표 선택 */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              연습 목표
            </label>

            {goals.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                현재 선택할 수 있는 연습 목표가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {goals.map((goal) => {
                  const isSelected = selectedGoalId === goal.id;

                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoalId(goal.id)}
                      className={`min-h-12 rounded-lg border p-3 text-left text-xs font-semibold transition-colors ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block">{goal.name}</span>

                      {goal.description && (
                        <span className="mt-1 block text-[11px] font-normal text-slate-500">
                          {goal.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 연습 시간 입력 */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-700">
              연습 시간
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-center text-[11px] text-slate-500">
                  시간
                </span>
                <input
                  type="number"
                  min={0}
                  value={durationHours}
                  onChange={(event) =>
                    setDurationHours(
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-center text-[11px] text-slate-500">
                  분
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMinutes}
                  onChange={(event) =>
                    setDurationMinutes(
                      Math.min(
                        59,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-center text-[11px] text-slate-500">
                  초
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationSeconds}
                  onChange={(event) =>
                    setDurationSeconds(
                      Math.min(
                        59,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    )
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setDurationHours(Math.floor(minutes / 60));
                    setDurationMinutes(minutes % 60);
                    setDurationSeconds(0);
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  {minutes}분
                </button>
              ))}
            </div>
          </div>

          {/* 파일 첨부 영역 (선택 사항) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                결과물 사진/영상 첨부{" "}
                <span className="font-normal text-slate-500">(선택 사항)</span>
              </label>
              <span className="text-[10px] font-medium text-blue-700">
                개별 10MB 고정
              </span>
            </div>

            <input
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              id="file-upload-input"
            />

            <label
              htmlFor="file-upload-input"
              className="flex cursor-pointer flex-col items-center justify-center space-y-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-all hover:border-blue-400 hover:bg-blue-50"
            >
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs font-semibold text-slate-800">
                사진 또는 동영상 선택하기 (선택)
              </span>
              <span className="text-[10px] text-slate-500">
                사진 없이 시간만 제출할 수 있습니다
              </span>
            </label>

            {/* 선택된 파일 목록 */}
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">
                  첨부 예정 파일 ({selectedFiles.length}개):
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="truncate mr-2">
                        <p className="truncate font-medium text-slate-800">
                          {file.name}
                        </p>
                        <p className="font-mono text-[10px] text-slate-500">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="px-1.5 py-0.5 text-xs font-bold text-rose-600 hover:text-rose-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 메모 입력 */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              학생 메모 (선택 입력)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="커트 시 유의사항이나 강사님께 전달할 내용"
              className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={
              submitting || goals.length === 0 || totalDurationSeconds <= 0
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>실습 결과 제출 중...</span>
              </span>
            ) : (
              "실습 결과물 제출하기"
            )}
          </button>
        </form>

        {/* 이번 수업 제출 내역 */}
        <section className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-950">
              이번 수업 제출 내역
            </h3>

            <span className="text-xs font-semibold text-blue-700">
              {submissions.length}회
            </span>
          </div>

          {submissions.length === 0 ? (
            <div className="page-panel px-4 py-8 text-center">
              <p className="text-xs text-slate-500">
                아직 제출한 기록이 없습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((submission) => (
                <article
                  key={submission.id}
                  className="page-panel space-y-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {submission.goalName}
                      </p>

                      <p className="mt-1 font-mono text-xs text-emerald-700">
                        {formatDuration(submission.durationSeconds)}
                      </p>
                    </div>

                    <time className="shrink-0 font-mono text-[11px] text-slate-500">
                      {new Date(submission.submittedAt).toLocaleTimeString(
                        "ko-KR",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        },
                      )}
                    </time>
                  </div>

                  {submission.memo && (
                    <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                      {submission.memo}
                    </p>
                  )}

                  {submission.files.length > 0 && (
                    <div className="border-t border-slate-200 pt-2">
                      <p className="text-[11px] text-slate-500">
                        첨부파일 {submission.files.length}개
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
