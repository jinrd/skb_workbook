"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function StudentJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 접속 허용 여부 체크 State
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch(`/api/classes/${resolvedParams.token}/access-status`);
        const data = await res.json();
        setIsAllowed(data.isAllowed);
        if (!data.isAllowed) {
          setBlockedReason(data.reason || "현재 수업 접속 허용 시간이 아닙니다.");
        } else {
          setClassName(data.className);
        }
      } catch (err) {
        console.error("Check access error:", err);
        setIsAllowed(false);
        setBlockedReason("접속 권한 상태를 확인하지 못했습니다.");
      } finally {
        setCheckingAccess(false);
      }
    }
    checkAccess();
  }, [resolvedParams.token]);

  const handlePinClick = (num: string) => {
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
  };

  const handlePinDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("PIN 번호 4자리를 모두 입력해 주세요.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinToken: resolvedParams.token,
          name,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "인증에 실패했습니다.");
      }

      router.push(data.redirectUrl || "/student/submit");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("인증 도중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] p-4 text-slate-900">
        <div className="flex items-center gap-3 text-sm text-blue-600">
          <svg className="h-5 w-5 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>수업 접속 허용 시간 확인 중...</span>
        </div>
      </div>
    );
  }

  // 접속 차단 화면 (Plan.md 준수)
  if (isAllowed === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] p-4 text-slate-900">
        <div className="page-panel w-full max-w-sm space-y-4 p-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-950">수업 접속 차단됨</h1>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
            {blockedReason}
          </div>

          <p className="text-[11px] text-slate-500">
            정규 수업 시간에 맞춰 교실 QR 코드를 다시 스캔해 주시기 바랍니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] p-3 text-slate-900 sm:p-4">
      <div className="page-panel w-full max-w-sm space-y-5 p-5 sm:p-6">
        <div className="text-center space-y-1">
          <span className="mb-1 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            수업 접속 가능 ({className || "실습반"})
          </span>
          <h1 className="text-xl font-bold text-slate-950">학생 실습 인증</h1>
          <p className="text-xs text-slate-500">
            이름과 본인의 개인 PIN 4자리를 입력하세요.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center text-xs font-medium text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              학생 이름
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민지"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-center text-xs font-semibold uppercase tracking-wider text-slate-700">
              개인 PIN 번호 (4자리)
            </label>
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`flex h-12 w-11 items-center justify-center rounded-lg border text-lg font-bold transition-all ${
                    pin[idx]
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  {pin[idx] ? "●" : ""}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinClick(num)}
                className="rounded-lg border border-slate-200 bg-white py-3 text-lg font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-blue-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin("")}
              className="rounded-lg border border-slate-200 bg-slate-50 py-3 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              전체 지움
            </button>
            <button
              type="button"
              onClick={() => handlePinClick("0")}
              className="rounded-lg border border-slate-200 bg-white py-3 text-lg font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-blue-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinDelete}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-3 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              지움
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !name || pin.length !== 4}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40"
          >
            {loading ? "인증 진행 중..." : "수업 입장 & 제출하기"}
          </button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
          <span>반 토큰: </span>
          <span className="font-mono text-blue-700">{resolvedParams.token}</span>
        </div>
      </div>
    </div>
  );
}
