import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f4] p-4 text-slate-900 sm:p-6">
      <div className="page-panel w-full max-w-md space-y-6 p-6 text-center sm:p-8">
        <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
          <svg
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          미용학원 연습 기록 시스템
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          수업 시간 내 반별 QR 코드로 접속하여
          <br />
          이름과 개인 PIN 인증 후 연습 결과를 제출해 주세요.
        </p>

        <div className="space-y-3 pt-2">
          <Link
            href="/teacher/login"
            className="flex w-full items-center justify-between rounded-lg bg-blue-600 p-4 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-500"
          >
            <div className="flex items-center gap-3">
              <svg
                className="h-5 w-5 text-blue-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>강사 / 관리자 로그인</span>
            </div>
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>

        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>운영 시간대: 대한민국 표준시 (Asia/Seoul)</p>
        </div>
      </div>
    </div>
  );
}
