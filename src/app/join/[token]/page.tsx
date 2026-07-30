'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
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
          setBlockedReason(data.reason || '현재 수업 접속 허용 시간이 아닙니다.');
        } else {
          setClassName(data.className);
        }
      } catch (err) {
        console.error('Check access error:', err);
        setIsAllowed(false);
        setBlockedReason('접속 권한 상태를 확인하지 못했습니다.');
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
      setError('PIN 번호 4자리를 모두 입력해 주세요.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinToken: resolvedParams.token,
          name,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      router.push(data.redirectUrl || '/student/submit');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('인증 도중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-slate-900 text-white">
        <div className="flex items-center gap-3 text-indigo-400 text-sm">
          <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
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
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
        <div className="w-full max-w-sm p-6 rounded-2xl glass-panel border border-rose-500/30 shadow-2xl text-center space-y-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-white">수업 접속 차단됨</h1>

          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs leading-relaxed">
            {blockedReason}
          </div>

          <p className="text-[11px] text-slate-400">
            정규 수업 시간에 맞춰 교실 QR 코드를 다시 스캔해 주시기 바랍니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      <div className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl backdrop-blur-xl border border-white/10 space-y-5">
        {/* 헤더 */}
        <div className="text-center space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-1">
            🟢 수업 접속 가능 ({className || '실습반'})
          </span>
          <h1 className="text-xl font-bold text-white">학생 실습 인증</h1>
          <p className="text-xs text-slate-300">
            이름과 본인의 개인 PIN 4자리를 입력하세요.
          </p>
        </div>

        {/* 에러 메시지 알림 */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 입력 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              학생 이름
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민지"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* PIN 4자리 표시 박스 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 text-center">
              개인 PIN 번호 (4자리)
            </label>
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-11 h-12 rounded-xl flex items-center justify-center text-lg font-bold border transition-all ${
                    pin[idx]
                      ? 'bg-indigo-600/40 border-indigo-400 text-indigo-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-500'
                  }`}
                >
                  {pin[idx] ? '●' : ''}
                </div>
              ))}
            </div>
          </div>

          {/* 숫자 패드 UI */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handlePinClick(num)}
                className="py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-indigo-600/50 text-white font-semibold text-lg transition-colors border border-slate-700/50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="py-3 rounded-xl bg-slate-800/40 text-slate-400 font-medium text-xs hover:bg-slate-800 border border-slate-700/50"
            >
              전체 지움
            </button>
            <button
              type="button"
              onClick={() => handlePinClick('0')}
              className="py-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 active:bg-indigo-600/50 text-white font-semibold text-lg transition-colors border border-slate-700/50"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinDelete}
              className="py-3 rounded-xl bg-slate-800/40 text-slate-300 font-medium text-xs hover:bg-slate-800 border border-slate-700/50 flex items-center justify-center"
            >
              ⌫ 지움
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !name || pin.length !== 4}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? '인증 진행 중...' : '수업 입장 & 제출하기'}
          </button>
        </form>

        {/* 힌트 정보 카드 */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-white/5 text-center text-xs text-slate-400">
          <span>💡 반 토큰: </span>
          <span className="font-mono text-indigo-300">{resolvedParams.token}</span>
        </div>
      </div>
    </div>
  );
}
