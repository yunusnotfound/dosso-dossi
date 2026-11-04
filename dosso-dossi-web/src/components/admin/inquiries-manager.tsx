"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError, adminRequest, type Admin } from "@/lib/admin-catalog";
import s from "./inquiries-manager.module.css";

const states = { NEW: "Yeni", IN_REVIEW: "İnceleniyor", CONTACTED: "İletişime geçildi", CLOSED: "Kapandı" };
type Status = keyof typeof states;
type Inquiry = { id: string; receipt: string; name: string; email: string; phone: string; city: string; space: string; experience: string; message: string; note: string; status: Status; version: number; createdAt: string };
export function InquiriesManager({ admin, onExpired, onDirty, onBusy }: { admin: Admin; onExpired: () => void; onDirty: (value: boolean) => void; onBusy: (value: boolean) => void }) {
  const [rows, setRows] = useState<Inquiry[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [filter, setFilter] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [selected, setSelected] = useState<Inquiry | null>(null), [status, setStatus] = useState<Status>("NEW"), [note, setNote] = useState("");
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const generation = useRef(0), control = useRef<AbortController | null>(null), pending = useRef(false);
  const dirty = Boolean(selected && (selected.note !== note || selected.status !== status));
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { onBusy(saving); return () => onBusy(false); }, [saving, onBusy]);
  const clearPrivateState = useCallback(() => {
    generation.current++; control.current?.abort(); pending.current = false;
    setRows([]); setSelected(null); setNote(""); setNotice(""); setError(""); setTotal(0); setSaving(false); setLoading(true);
  }, []);
  const fail = useCallback((cause: unknown) => {
    if (cause instanceof AdminApiError && [401, 403].includes(cause.status)) { clearPrivateState(); onExpired(); return; }
    setError(cause instanceof AdminApiError && cause.status === 409 ? "Başvuru başka bir oturumda değişti. Listeyi yenileyip güncel kaydı açın." : "Başvuru işlemi tamamlanamadı. Yeniden deneyin.");
  }, [onExpired, clearPrivateState]);
  const load = useCallback(async () => {
    const epoch = ++generation.current;
    control.current?.abort(); const controller = new AbortController(); control.current = controller;
    setLoading(true); setSaving(false); pending.current = false; setError(""); setRows([]); setSelected(null); setNote("");
    try {
      const session = await adminRequest<{ admin: Admin }>("/auth/session", { signal: controller.signal });
      if (controller.signal.aborted || epoch !== generation.current) return;
      if (session.admin.id !== admin.id || session.admin.role !== "ADMIN") { clearPrivateState(); onExpired(); return; }
      const result = await adminRequest<{ inquiries: Inquiry[]; total: number }>(`/franchise-inquiries?page=${page}${filter ? `&status=${filter}` : ""}`, { signal: controller.signal });
      if (controller.signal.aborted || epoch !== generation.current) return;
      setRows(result.inquiries); setTotal(result.total);
    } catch (cause) { if (!controller.signal.aborted && epoch === generation.current) fail(cause); }
    finally { if (!controller.signal.aborted && epoch === generation.current) setLoading(false); }
  }, [filter, page, admin.id, onExpired, clearPrivateState, fail]);
  useEffect(() => {
    void load();
    const resume = () => { if (document.visibilityState === "visible") void load(); };
    const visibility = () => { if (document.visibilityState === "hidden") clearPrivateState(); else resume(); };
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("pagehide", clearPrivateState);
    document.addEventListener("visibilitychange", visibility);
    return () => { generation.current++; control.current?.abort(); window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("pagehide", clearPrivateState); document.removeEventListener("visibilitychange", visibility); };
  }, [load, clearPrivateState]);
  function canLeave() { return !pending.current && !saving && (!dirty || window.confirm("Kaydedilmemiş başvuru notunu bırakmak istiyor musunuz?")); }
  function select(row: Inquiry) { if (!canLeave()) return; setSelected(row); setStatus(row.status); setNote(row.note); setNotice(""); setError(""); }
  async function save() {
    if (!selected || pending.current || saving) return;
    pending.current = true; setSaving(true); setError(""); setNotice("");
    const epoch = generation.current, controller = new AbortController(); control.current = controller;
    try {
      const session = await adminRequest<{ admin: Admin }>("/auth/session", { signal: controller.signal });
      if (controller.signal.aborted || epoch !== generation.current) return;
      if (session.admin.id !== admin.id || session.admin.role !== "ADMIN") { clearPrivateState(); onExpired(); return; }
      const { inquiry } = await adminRequest<{ inquiry: Inquiry }>(`/franchise-inquiries/${selected.id}`, { method: "PATCH", body: JSON.stringify({ version: selected.version, status, note }), signal: controller.signal });
      if (controller.signal.aborted || epoch !== generation.current) return;
      setSelected(inquiry); setNote(inquiry.note); setStatus(inquiry.status); setNotice("Başvuru güncellendi. Otomatik mesaj gönderilmedi.");
      setRows(current => current.map(row => row.id === inquiry.id ? inquiry : row).filter(row => !filter || row.status === filter));
      if (filter && inquiry.status !== filter) setTotal(current => Math.max(0, current - 1));
    } catch (cause) { if (!controller.signal.aborted && epoch === generation.current) fail(cause); }
    finally { if (!controller.signal.aborted && epoch === generation.current) { pending.current = false; setSaving(false); } }
  }
  return <section className={s.manager} aria-busy={loading || saving}>
    <header><div><p>İŞ ORTAKLIĞI</p><h1>Franchise başvuruları</h1><span>Başvuruları değerlendir, görüşme notlarını ve durumlarını kaydet.</span></div><button onClick={() => { if (canLeave()) { setSelected(null); void load(); } }} disabled={saving}>Listeyi yenile</button></header>
    <label className={s.filter}>Durum<select value={filter} disabled={saving} onChange={e => { if (canLeave()) { setSelected(null); setFilter(e.target.value); setPage(1); } }}><option value="">Tümü</option>{Object.entries(states).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    {error && <p role="alert" className={s.error}>{error}</p>}{notice && <p role="status" className={s.notice}>{notice}</p>}
    <div className={s.layout}><div className={s.list}>{loading ? <p role="status">Yükleniyor…</p> : rows.length ? rows.map(row => <button key={row.id} className={s.row} aria-pressed={selected?.id === row.id} onClick={() => select(row)}><span><strong>{row.name}</strong><small>{row.city} · {new Date(row.createdAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })}</small></span><span>{states[row.status]}<small>{row.receipt}</small></span></button>) : <p>Bu filtrede başvuru bulunmuyor.</p>}<nav aria-label="Başvuru sayfaları" className={s.pagination}><button disabled={page === 1 || loading || saving} onClick={() => { if (canLeave()) { setSelected(null); setPage(page - 1); } }}>← Önceki</button><span>{page} / {Math.max(1, Math.ceil(total / 20))}</span><button disabled={page * 20 >= total || loading || saving} onClick={() => { if (canLeave()) { setSelected(null); setPage(page + 1); } }}>Sonraki →</button></nav></div>
    {selected && <article className={s.detail}><p>{selected.receipt}</p><h2>{selected.name}</h2><a href={`mailto:${selected.email}`}>{selected.email}</a><a href={`tel:${selected.phone}`}>{selected.phone}</a><dl><dt>Şehir</dt><dd>{selected.city}</dd><dt>Mekân</dt><dd>{{ READY: "Yer hazır", SEARCHING: "Yer arıyor", UNDECIDED: "Henüz karar vermedi" }[selected.space] ?? selected.space}</dd><dt>Deneyim</dt><dd>{selected.experience === "FIRST" ? "İlk girişim" : "İşletmecilik deneyimi var"}</dd></dl><p className={s.message}>{selected.message}</p><label>Başvuru durumu<select value={status} disabled={saving} onChange={e => setStatus(e.target.value as Status)}>{Object.entries(states).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Ekip içi görüşme notu<textarea value={note} maxLength={2000} rows={5} disabled={saving} onChange={e => setNote(e.target.value)} /></label><button className={s.save} onClick={save} disabled={!dirty || saving}>{saving ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button><small>Bu not yalnızca yönetim panelinde görünür.</small></article>}</div>
  </section>;
}
