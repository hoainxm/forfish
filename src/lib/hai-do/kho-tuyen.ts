"use client";

/*
  CHẾ ĐỘ HẢI ĐỒ đợt 4 — KHO tuyến / tuyến đang chạy / vết tàu (2026-11-04).
    `forfish.haiDoTuyen.v1`   — tuyến bà con tự vẽ (mảng Tuyen) — sao lưu nhóm "bà con tự gõ" (transfer)
    `forfish.haiDoChay.v1`    — tuyến đang chạy {id, toi} — KHÔNG sao lưu (trạng thái một lúc)
    `forfish.haiDoVetGhi.v1`  — id vết đang ghi — KHÔNG sao lưu
    IndexedDB `forfish-hai-do` / store `vet` — điểm vết (nhiều, không nhét localStorage).
  Đọc hỏng ⇒ bỏ mục hỏng / coi như không có, KHÔNG ném (không được làm sập màn giữa biển).
*/
import { taoKho } from "@/lib/hai-do/tam";
import type { DiemVet, Tuyen, Vet } from "@/lib/hai-do/tuyen";

export const TUYEN_KEY = "forfish.haiDoTuyen.v1";
export const CHAY_KEY = "forfish.haiDoChay.v1";
export const VET_GHI_KEY = "forfish.haiDoVetGhi.v1";

const so = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const llHopLe = (p: unknown) => {
  const x = p as { lat?: unknown; lon?: unknown };
  return !!x && so(x.lat) && so(x.lon) && Math.abs(x.lat as number) <= 90 && Math.abs(x.lon as number) <= 180;
};

/** Đọc danh sách tuyến — tuyến hỏng (dưới 2 điểm hợp lệ, thiếu id) bị bỏ, phần còn lại giữ. Thuần. */
export function docTuyen(raw: string | null): Tuyen[] | null {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a
      .map((t) => t as Partial<Tuyen>)
      .filter((t) => typeof t.id === "string" && Array.isArray(t.diem))
      .map((t) => ({ id: t.id!, ten: typeof t.ten === "string" ? t.ten : "Tuyến", diem: t.diem!.filter(llHopLe), luc: so(t.luc) ? t.luc! : 0 }))
      .filter((t) => t.diem.length >= 2);
  } catch {
    return [];
  }
}

export interface Chay {
  id: string;
  toi: number;
}
export function docChay(raw: string | null): Chay | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Chay>;
    return typeof p.id === "string" && so(p.toi) && p.toi! >= 1 ? { id: p.id, toi: p.toi! } : null;
  } catch {
    return null;
  }
}

const khoTuyen = taoKho<Tuyen[]>(TUYEN_KEY, docTuyen);
const khoChay = taoKho<Chay>(CHAY_KEY, docChay);
const khoVetGhi = taoKho<string>(VET_GHI_KEY, (r) => (r ? (JSON.parse(r) as string) : null));
export const setTuyen = khoTuyen.set;
export const useTuyen = () => khoTuyen.use() ?? [];
export const setChay = khoChay.set;
export const useChay = khoChay.use;
export const setVetGhi = khoVetGhi.set;
export const useVetGhi = khoVetGhi.use;

/* ── IndexedDB vết ─────────────────────────────────────────────────────────── */

const DB = "forfish-hai-do";
const STORE = "vet";

function moDb(): Promise<IDBDatabase> {
  return new Promise((ok, loi) => {
    if (typeof indexedDB === "undefined") return loi(new Error("không có IndexedDB"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => loi(r.error);
  });
}

function giaoDich<T>(mode: IDBTransactionMode, lam: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return moDb().then(
    (db) =>
      new Promise<T>((ok, loi) => {
        const tx = db.transaction(STORE, mode);
        const req = lam(tx.objectStore(STORE));
        req.onsuccess = () => ok(req.result);
        req.onerror = () => loi(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export function dsVet(): Promise<Vet[]> {
  return giaoDich<Vet[]>("readonly", (s) => s.getAll() as IDBRequest<Vet[]>).then((a) =>
    (a ?? []).filter((v) => v && typeof v.id === "string" && Array.isArray(v.diem)).sort((x, y) => y.batDau - x.batDau),
  );
}
export function luuVet(v: Vet): Promise<void> {
  return giaoDich("readwrite", (s) => s.put(v)).then(() => undefined);
}
export function xoaVet(id: string): Promise<void> {
  return giaoDich("readwrite", (s) => s.delete(id)).then(() => undefined);
}
export type { DiemVet };
