"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export default function TeacherDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [teacherRole, setTeacherRole] = useState<"ADMIN" | "TEACHER" | null>(
    null,
  );

  useEffect(() => {
    let ignore = false;

    fetch("/api/teacher/sessions/status")
      .then(async (response) => {
        const data = await response.json();

        if (!ignore && response.ok) {
          setTeacherRole(data.teacher?.role ?? null);
        }
      })
      .catch((error) => {
        console.error("Fetch teacher role error:", error);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/teacher/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "/teacher/login";
    }
  };

  const navItems = [
    {
      label: "오늘 수업",
      href: "/teacher/dashboard",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
      exact: true,
    },
    {
      label: "반 관리",
      href: "/teacher/dashboard/classes",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h6m-6 0V10m6 11V10m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0T5 10"
          />
        </svg>
      ),
    },
    {
      label: "학생 관리",
      href: "/teacher/dashboard/students",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      label: "제출 결과",
      href: "/teacher/dashboard/submissions",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      label: "출석 기록",
      href: "/teacher/dashboard/attendance",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm2-5l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      label: "감사 로그",
      href: "/teacher/dashboard/audit-logs",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      href: "/teacher/dashboard/analytics",
      label: "기록 분석",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 19h16M7 16l3-3 3 2 4-6"
          />
        </svg>
      ),
    },
    {
      label: "엑셀 보관",
      href: "/teacher/dashboard/exports",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-slate-900 pb-24 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link href="/teacher/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm">
              S
            </span>
            <div>
              <h1 className="text-sm font-bold leading-tight text-slate-950">
                SKB 미용 실습 워크북
              </h1>
              <p className="text-[10px] font-medium text-slate-500">
                강사 통합 관리자 센터
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-3 sm:p-4 md:p-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-20 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-lg">
        <div className="mobile-scroll mx-auto max-w-5xl">
          <div className="grid min-w-[640px] grid-cols-8 gap-1">
            {navItems
              .filter(
                (item) =>
                  item.href !== "/teacher/dashboard/audit-logs" ||
                  teacherRole === "ADMIN",
              )
              .map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl px-1 transition-colors ${
                    isActive
                      ? "bg-blue-50 font-bold text-blue-700 shadow-inner"
                      : "text-slate-500 hover:text-slate-900 active:bg-slate-100"
                  }`}
                >
                  <div className="flex h-5 w-5 items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="mt-1 h-3 w-full truncate text-center text-[10px] leading-3 tracking-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
