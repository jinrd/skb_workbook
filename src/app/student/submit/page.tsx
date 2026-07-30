'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface CategoryItem {
  id: string;
  name: string;
}

interface SubmissionFileItem {
  id: string;
  fileName: string;
  fileSize: number;
}

interface SubmissionItem {
  id: string;
  submittedAt: string;
  categoryName: string;
  durationMinutes: number;
  content: string | null;
  files: SubmissionFileItem[];
}

export default function StudentSubmitPage() {
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 입력 State
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [memo, setMemo] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/student/session-info');
      const data = await res.json();
      if (res.ok) {
        setStudentName(data.studentName);
        setClassName(data.className);
        setCategories(data.categories || []);
        setSubmissions(data.submissions || []);
        if (data.categories && data.categories.length > 0) {
          setSelectedCategoryName((prev) => prev || data.categories[0].name);
        }
      } else {
        setErrorMessage(data.error || '세션 정보를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Fetch info error:', err);
      setErrorMessage('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadSessionData() {
      try {
        const res = await fetch('/api/student/session-info');
        const data = await res.json();
        if (!ignore && res.ok) {
          setStudentName(data.studentName);
          setClassName(data.className);
          setCategories(data.categories || []);
          setSubmissions(data.submissions || []);
          if (data.categories && data.categories.length > 0) {
            setSelectedCategoryName(data.categories[0].name);
          }
        } else if (!ignore) {
          setErrorMessage(data.error || '세션 정보를 불러올 수 없습니다.');
        }
      } catch (err) {
        console.error('Fetch info error:', err);
        if (!ignore) setErrorMessage('서버 연결 중 오류가 발생했습니다.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadSessionData();
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryName) {
      alert('연습 종목을 선택해 주세요.');
      return;
    }
    if (!durationMinutes || durationMinutes <= 0) {
      alert('연습 시간을 1분 이상 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('categoryName', selectedCategoryName);
      formData.append('durationMinutes', String(durationMinutes));
      formData.append('memo', memo);

      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await fetch('/api/student/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        alert('🎉 실습 결과물이 성공적으로 제출되었습니다!');
        setSelectedFiles([]);
        setMemo('');
        await fetchInfo();
      } else {
        setErrorMessage(data.error || '제출 도중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setErrorMessage('제출물 전송 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-slate-900 text-white text-xs">
        <div className="flex items-center gap-2 text-indigo-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>수업 및 제출 페이지를 구성 중입니다...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-4 pb-12">
      <div className="max-w-md mx-auto space-y-5">
        {/* 상단 프로필 카드리스트 */}
        <header className="p-5 rounded-2xl glass-panel border border-white/10 shadow-xl space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">수업 수강 중</span>
              <h1 className="text-xl font-bold text-white">{studentName} 수강생</h1>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {className}
            </span>
          </div>

          {/* 구글 드라이브 일괄 삭제 안내 배너 */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <svg className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-0.5">
              <p className="font-bold text-amber-300">🗑️ 파일 삭제 사전 안내</p>
              <p className="text-[11px] leading-relaxed text-amber-200/90">
                제출하신 사진/동영상 첨부파일은 <strong>제출 다음 날 오전 4시</strong>에 Google Drive에서 자동 일괄 삭제됩니다. (텍스트 제출 기록은 보관됩니다)
              </p>
            </div>
          </div>
        </header>

        {/* 제출 폼 카드리스트 */}
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl glass-panel border border-white/10 shadow-xl space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>📷 실습 결과물 제출</span>
          </h2>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* 연습 종목 선택 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              연습 종목 선택
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryName(cat.name)}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all text-left flex items-center justify-between ${
                    selectedCategoryName === cat.name
                      ? 'bg-indigo-600/40 border-indigo-400 text-indigo-200 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.name}</span>
                  {selectedCategoryName === cat.name && <span className="text-indigo-400">✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 연습 시간 입력 (분) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              실습/연습 진행 시간 (분 단위)
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  required
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  placeholder="예: 60"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-300 flex-shrink-0">분 동안 연습함</span>
              </div>

              {/* 시간 선택 퀵 버튼 */}
              <div className="flex gap-1.5">
                {[30, 45, 60, 90, 120].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => setDurationMinutes(min)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      durationMinutes === min
                        ? 'bg-indigo-600/40 border-indigo-400 text-indigo-200'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {min}분
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 파일 첨부 영역 (선택 사항) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                결과물 사진/영상 첨부 <span className="text-slate-400 font-normal">(선택 사항)</span>
              </label>
              <span className="text-[10px] text-indigo-300 font-medium">개별 10MB 고정</span>
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
              className="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-800/40 hover:bg-slate-800/70 cursor-pointer transition-all space-y-1 text-center"
            >
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-white">사진 또는 동영상 선택하기 (선택)</span>
              <span className="text-[10px] text-slate-400">사진 없이 시간만 제출할 수 있습니다</span>
            </label>

            {/* 선택된 파일 목록 */}
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-300">
                  첨부 예정 파일 ({selectedFiles.length}개):
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs"
                    >
                      <div className="truncate mr-2">
                        <p className="font-medium text-slate-200 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-bold px-1.5 py-0.5"
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
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              학생 메모 (선택 입력)
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="커트 시 유의사항이나 강사님께 전달할 내용"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
            />
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>실습 결과 제출 중...</span>
              </span>
            ) : (
              '📤 실습 결과물 제출하기'
            )}
          </button>
        </form>

        {/* 오늘 나의 제출 이력 내역 카드리스트 */}
        <div className="p-5 rounded-2xl glass-panel border border-white/10 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>📋 오늘 나의 제출 내역 ({submissions.length}회)</span>
          </h3>

          {submissions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              오늘 제출한 실습 결과물이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {sub.categoryName}
                      </span>
                      {sub.durationMinutes > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                          ⏱️ {sub.durationMinutes}분 연습
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(sub.submittedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {sub.content && <p className="text-xs text-slate-300 italic">{sub.content}</p>}

                  {sub.files && sub.files.length > 0 && (
                    <div className="space-y-1">
                      {sub.files.map((file) => (
                        <div key={file.id} className="text-[11px] text-slate-400 flex items-center justify-between">
                          <span className="truncate mr-2">📎 {file.fileName}</span>
                          <span className="font-mono flex-shrink-0 text-[10px]">{(file.fileSize / (1024 * 1024)).toFixed(1)}MB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
