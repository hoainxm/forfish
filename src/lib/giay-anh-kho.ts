// KHO ẢNH GIẤY TỜ TRONG MÁY (IndexedDB `forfish-giay-anh`, 2026-10-26, ADR 0017) — để XUẤT TRÌNH cho cán bộ khi mất sóng.
//
// Ảnh giấy tờ nằm ở Supabase Storage bucket riêng, xem bằng signed URL ⇒ v1 (08/2026) ngoài biển KHÔNG mở được. Mà
// kiểm tra của biên phòng / kiểm ngư hay ở cửa lạch, trên biển — đúng chỗ không có sóng. Nay: mỗi ảnh vừa tải lên
// (hoặc vừa xem được khi có sóng) được cất BYTES vào đây theo `path`; màn Xuất trình + dải ảnh đọc kho trước, mạng sau.
// Không dùng Cache Storage: sw.js `activate` xoá mọi kho lạ (phải sửa sw.js + chạy bộ QA offline); IndexedDB thì SW
// không đụng. Không dùng chung DB `forecast-store` (phiên bản/kho khác, nâng version là chuyện của dự báo).
// Mọi hàm KHÔNG ném: kho hỏng (Safari riêng tư, đầy bộ nhớ) ⇒ null/false, app chạy như không có kho.
// Khoá ảnh = path Storage (đã có tiền tố SĐT chủ) ⇒ đăng xuất/gỡ máy gọi `xoaHetAnhGiay()` (ảnh giấy là dữ liệu riêng).

const DB_NAME = "forfish-giay-anh";
const DB_VERSION = 1;
const STORE = "anh";
/** Trần tổng ảnh giữ trong máy — 4 ảnh × 7 giấy × 1,8 MB ≈ 50 MB là quá đủ, hơn là bỏ ảnh cũ nhất. */
export const KHO_ANH_TOI_DA_BYTES = 60 * 1024 * 1024;

interface HangAnh {
  path: string;
  blob: Blob;
  bytes: number;
  luc: number;
}

const coIdb = () => typeof indexedDB !== "undefined";

function moKho(): Promise<IDBDatabase | null> {
  if (!coIdb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "path" }).createIndex("luc", "luc");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function xong<T>(r: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
}

/** Cất bytes một ảnh. Trả true nếu đã nằm trong kho. */
export async function catAnhGiay(path: string, blob: Blob): Promise<boolean> {
  const db = await moKho();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const hang: HangAnh = { path, blob, bytes: blob.size, luc: Date.now() };
    const ok = (await xong(st.put(hang))) !== null;
    await donKho(st);
    return ok;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** Vượt trần ⇒ bỏ ảnh CŨ NHẤT cho tới khi lọt. Chạy trong cùng transaction; lỗi ⇒ thôi. */
async function donKho(st: IDBObjectStore): Promise<void> {
  const tat = (await xong(st.getAll())) as HangAnh[] | null;
  if (!tat) return;
  let tong = tat.reduce((s, h) => s + (h.bytes || 0), 0);
  if (tong <= KHO_ANH_TOI_DA_BYTES) return;
  for (const h of [...tat].sort((a, b) => a.luc - b.luc)) {
    if (tong <= KHO_ANH_TOI_DA_BYTES) break;
    await xong(st.delete(h.path));
    tong -= h.bytes || 0;
  }
}

/** Ảnh đã nằm trong kho chưa (chỉ đếm khoá, không đọc bytes). Kho hỏng ⇒ false (coi như chưa có). */
export async function coAnhGiay(path: string): Promise<boolean> {
  const db = await moKho();
  if (!db) return false;
  try {
    const n = await xong(db.transaction(STORE, "readonly").objectStore(STORE).count(path));
    return (n ?? 0) > 0;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** Lấy bytes ảnh đã cất; không có / kho hỏng ⇒ null. */
export async function layAnhGiay(path: string): Promise<Blob | null> {
  const db = await moKho();
  if (!db) return null;
  try {
    const h = (await xong(db.transaction(STORE, "readonly").objectStore(STORE).get(path))) as HangAnh | null;
    return h?.blob instanceof Blob ? h.blob : null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Xoá một ảnh khỏi kho (bà con gỡ ảnh). */
export async function xoaAnhGiay(path: string): Promise<void> {
  const db = await moKho();
  if (!db) return;
  try {
    await xong(db.transaction(STORE, "readwrite").objectStore(STORE).delete(path));
  } catch {
    /* kho hỏng — ảnh mồ côi chỉ tốn chỗ */
  } finally {
    db.close();
  }
}

/** Xoá sạch (đăng xuất / gỡ máy — ảnh giấy là dữ liệu riêng, không để lại cho người sau). */
export async function xoaHetAnhGiay(): Promise<void> {
  const db = await moKho();
  if (!db) return;
  try {
    await xong(db.transaction(STORE, "readwrite").objectStore(STORE).clear());
  } catch {
    /* như trên */
  } finally {
    db.close();
  }
}
