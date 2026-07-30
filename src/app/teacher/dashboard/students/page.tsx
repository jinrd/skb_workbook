'use client';

import { useState, useEffect } from 'react';

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

  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch('/api/teacher/students');
        const data = await res.json();
        if (!ignore && res.ok) {
          setStudents(data.students);
        } else if (!ignore) {
          setErrorMessage(data.error);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) setErrorMessage('학생 목록을 불러오지 못했습니다.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => { ignore = true; };
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length !== 4) {
      alert('이름과 4자리 숫자로 된 PIN 번호를 정확히 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), pin: newPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName('');
        setNewPin('');
        window.location.reload();
        alert('학생이 성공적으로 등록되었습니다!');
      } else {
        alert(data.error || '학생 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName} 학생을 정말 삭제하시겠습니까?\n모든 반 배정 내역과 제출 기록이 함께 삭제될 수 있습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/teacher/students?studentId=${studentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 및 새로고침 */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">STUDENT DIRECTORY</span>
          <h2 className="text-xl font-black text-white">전역 학생 관리</h2>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold transition-all border border-slate-700/60"
        >
          🔄 새로고침
        </button>
      </div>

      {/* 신규 학생 등록 폼 (모바일 친화적) */}
      <div className="p-4.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <span>✨ 신규 수강생 일괄 추가</span>
        </h3>
        <form onSubmit={handleAddStudent} className="flex flex-col gap-2.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="학생 이름 (예: 김민지)"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="PIN 4자리 (예: 1234)"
              maxLength={4}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono tracking-widest"
              required
            />
            <button
              type="submit"
              disabled={isSubmitting || !newName || newPin.length !== 4}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold transition-all shadow-md shadow-indigo-600/20 whitespace-nowrap"
            >
              {isSubmitting ? '등록 중...' : '+ 등록'}
            </button>
          </div>
        </form>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold text-center">
          {errorMessage}
        </div>
      )}

      {/* 학생 목록 (모바일 카드 뷰) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            등록된 학생 명단 <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full text-xs font-mono">{students.length}명</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
            학생 목록을 불러오는 중입니다...
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
            아직 등록된 학생이 없습니다. 위에서 학생을 추가해 주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-white">{student.name}</h4>
                    <span className="text-[10px] text-slate-400">ID: {student.id.slice(-6)}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(student.id, student.name)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    title="학생 삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold mb-1 block">소속된 수강 반</span>
                  <div className="flex flex-wrap gap-1.5">
                    {student.enrollments.length > 0 ? (
                      student.enrollments.map((e) => (
                        <span key={e.class.id} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {e.class.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">배정된 반 없음</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
