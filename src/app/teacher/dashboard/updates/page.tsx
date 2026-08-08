"use client";

import { FormEvent, useEffect, useState } from "react";

type Update = { id: string; title: string; content: string; changeType: string; version: string | null; target: string | null; publishedAt: string; author: { name: string } };

const emptyForm = { title: "", content: "", changeType: "기능 개선", version: "", target: "" };

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/teacher/updates");
      const text = await response.text();
      const data = text ? (JSON.parse(text) as { error?: string; updates?: Update[]; isDeveloper?: boolean }) : {};
      if (!response.ok) { setError(data.error || "업데이트 기록을 불러오지 못했습니다."); return; }
      setUpdates(data.updates ?? []); setIsDeveloper(Boolean(data.isDeveloper));
      await fetch("/api/teacher/updates/read", { method: "POST" });
    } catch (loadError) {
      console.error("Fetch updates page error:", loadError);
      setError("업데이트 기록을 불러오는 중 오류가 발생했습니다.");
    }
  };
  // The initial request synchronizes this page with the server-backed update list.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    const response = await fetch("/api/teacher/updates", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(editingId ? { id: editingId } : {}) }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "저장하지 못했습니다."); return; }
    setForm(emptyForm); setEditingId(null); await load();
  };

  const edit = (update: Update) => { setEditingId(update.id); setForm({ title: update.title, content: update.content, changeType: update.changeType, version: update.version || "", target: update.target || "" }); };
  const remove = async (id: string) => { if (!window.confirm("이 업데이트 기록을 삭제할까요?")) return; await fetch("/api/teacher/updates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); await load(); };

  return <div className="space-y-5">
    <header className="border-b border-slate-200 pb-4"><p className="text-xs font-semibold text-blue-600">서비스 변경 기록</p><h2 className="mt-1 text-xl font-bold text-slate-950">업데이트 기록</h2></header>
    {isDeveloper && <form onSubmit={submit} className="page-panel space-y-3 p-4">
      <h3 className="text-sm font-bold text-slate-950">{editingId ? "업데이트 기록 수정" : "업데이트 기록 작성"}</h3>
      <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
      <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="변경 내용을 입력하세요." className="min-h-28 w-full rounded-lg border border-slate-200 p-3 text-sm" />
      <div className="grid gap-2 sm:grid-cols-3"><select value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option>기능 추가</option><option>기능 개선</option><option>버그 수정</option><option>운영 정책 변경</option></select><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="적용 버전" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /><input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="변경 페이지/기능" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" /></div>
      <div className="flex gap-2"><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">{editingId ? "수정 저장" : "게시"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">취소</button>}</div>
    </form>}
    {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="space-y-3">{updates.map((update) => <article key={update.id} className="page-panel space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold text-blue-600">{update.changeType}</span><h3 className="mt-1 text-base font-bold text-slate-950">{update.title}</h3></div>{isDeveloper && <div className="flex gap-2"><button onClick={() => edit(update)} className="text-xs font-semibold text-blue-700">수정</button><button onClick={() => void remove(update.id)} className="text-xs font-semibold text-rose-600">삭제</button></div>}</div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{update.content}</p><p className="text-xs text-slate-500">{update.target || "전체 서비스"}{update.version ? ` · ${update.version}` : ""} · {new Date(update.publishedAt).toLocaleDateString("ko-KR")} · {update.author.name}</p></article>)}{updates.length === 0 && <div className="page-panel p-8 text-center text-sm text-slate-500">등록된 업데이트 기록이 없습니다.</div>}</div>
  </div>;
}
