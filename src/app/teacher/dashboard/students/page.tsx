"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
interface StudentItem {
  id: string;
  name: string;
  enrollments: {
    class: {
      id: string;
      name: string;
    };
  }[];
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch("/api/teacher/students");
        const data = await res.json();
        if (!ignore && res.ok) {
          setStudents(data.students);
        } else if (!ignore) {
          setErrorMessage(data.error);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) setErrorMessage("학생 목록을 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length !== 4) {
      alert("이름과 4자리 숫자로 된 PIN 번호를 정확히 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/teacher/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), pin: newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewPin("");
        window.location.reload();
        alert("학생이 성공적으로 등록되었습니다!");
      } else {
        alert(data.error || "학생 등록에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (studentId: string, studentName: string) => {
    if (
      !confirm(
        `${studentName} 학생을 정말 삭제하시겠습니까?\n모든 반 배정 내역과 제출 기록이 함께 삭제될 수 있습니다.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/teacher/students?studentId=${studentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error || "삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 새로고침 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-blue-600">
            STUDENT DIRECTORY
          </span>
          <h2 className="text-xl font-black text-slate-950">전역 학생 관리</h2>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
        >
          새로고침
        </button>
      </div>

      <div className="page-panel space-y-3 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-950">
          <span>신규 수강생 추가</span>
        </h3>
        <form onSubmit={handleAddStudent} className="flex flex-col gap-2.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="학생 이름 (예: 김민지)"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="PIN 4자리 (예: 1234)"
              maxLength={4}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting || !newName || newPin.length !== 4}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-500 active:scale-98 disabled:bg-slate-200 disabled:text-slate-500"
            >
              {isSubmitting ? "등록 중..." : "+ 등록"}
            </button>
          </div>
        </form>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-center text-xs font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* 학생 목록 (모바일 카드 뷰) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            등록된 학생 명단{" "}
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">
              {students.length}명
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="page-panel p-8 text-center text-xs text-slate-500">
            학생 목록을 불러오는 중입니다...
          </div>
        ) : students.length === 0 ? (
          <div className="page-panel p-8 text-center text-xs text-slate-500">
            아직 등록된 학생이 없습니다. 위에서 학생을 추가해 주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="page-panel flex flex-col justify-between space-y-3 p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-slate-950">
                      {student.name}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      ID: {student.id.slice(-6)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(student.id, student.name)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="학생 삭제"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <div className="border-t border-slate-200 pt-2">
                  <span className="mb-1 block text-[10px] font-semibold text-slate-500">
                    소속된 수강 반
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {student.enrollments.length > 0 ? (
                      student.enrollments.map((e) => (
                        <span
                          key={e.class.id}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {e.class.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] italic text-slate-500">
                        배정된 반 없음
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/teacher/dashboard/students/${student.id}`}
                  className="block h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  기록 보기
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
