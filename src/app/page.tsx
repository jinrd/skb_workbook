import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl backdrop-blur-xl border border-white/10 text-center space-y-6">
        {/* 헤더 & 아이콘 */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 mb-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white">
          미용학원 연습 기록 시스템
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          수업 시간 내 반별 QR 코드로 접속하여<br />
          이름과 개인 PIN 인증 후 연습 결과를 제출해 주세요.
        </p>

        {/* 강사 로그인 진입 카드 */}
        <div className="space-y-3 pt-2">
          <Link
            href="/teacher/login"
            className="w-full flex items-center justify-between p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-600/30"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>강사 / 관리자 로그인</span>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* 푸터 영역 */}
        <div className="pt-4 border-t border-white/10 text-xs text-slate-400">
          <p>운영 시간대: 대한민국 표준시 (Asia/Seoul)</p>
        </div>
      </div>
    </div>
  );
}
