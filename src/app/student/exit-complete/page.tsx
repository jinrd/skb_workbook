"use client";

export default function StudentExitCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f4] p-4 text-slate-900">
      <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <span className="text-2xl font-bold">✓</span>
        </div>

        <h1 className="text-xl font-bold text-slate-950">퇴실 완료</h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          퇴실 시간이 정상적으로 기록되었습니다.
          <br />
          수고하셨습니다.
        </p>
      </section>
    </main>
  );
}
