/*
  KHO CHỜ ẢNH ĐIỂM (IndexedDB `forfish-anh-diem`, 2026-11-04) — ảnh chụp lúc mất sóng nằm đây tới khi đẩy được lên
  máy chủ (lib/hai-do/anh-diem). KHÔNG tự xoá gì (khác kho ảnh giấy tờ có trần 60 MB bỏ ảnh cũ): ảnh chưa đẩy mà bị
  bỏ là mất hẳn. Tách file riêng, không import mạng — để `device-token-store` (đăng xuất) gọi `xoaHetAnhCho` mà không
  kéo vòng import qua doc-photos. Mọi hàm KHÔNG ném: kho hỏng ⇒ null.
*/

export interface HangCho {
  khoa: string;
  placeId: string;
  blob: Blob;
  luc: number;
}

const DB = "forfish-anh-diem";
const STORE = "cho";

function moKho(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((ok) => {
    let r: IDBOpenDBRequest;
    try {
      r = indexedDB.open(DB, 1);
    } catch {
      return ok(null);
    }
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "khoa" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(null);
    r.onblocked = () => ok(null);
  });
}

/** Chạy một yêu cầu IDB; trả kết quả, `undefined` khi yêu cầu xong mà không có giá trị, null khi kho hỏng. */
async function lam<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null | undefined> {
  const db = await moKho();
  if (!db) return null;
  try {
    return await new Promise<T | null | undefined>((ok) => {
      const tx = db.transaction(STORE, mode);
      const req = f(tx.objectStore(STORE));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Cất một ảnh chờ. true = đã nằm trong kho. */
export async function datCho(h: HangCho): Promise<boolean> {
  return (await lam("readwrite", (s) => s.put(h))) != null;
}
export async function layCho(khoa: string): Promise<HangCho | null> {
  return ((await lam("readonly", (s) => s.get(khoa))) as HangCho | undefined | null) ?? null;
}
export async function tatCaCho(): Promise<HangCho[]> {
  return ((await lam("readonly", (s) => s.getAll())) as HangCho[] | undefined | null) ?? [];
}
/** Gỡ một ảnh chờ. true = kho làm được (kể cả khi khoá không có). */
export async function xoaCho(khoa: string): Promise<boolean> {
  return (await lam("readwrite", (s) => s.delete(khoa))) !== null;
}
/** Đăng xuất / gỡ máy: bỏ cả kho chờ (sổ điểm cũng bị xoá cùng lúc). */
export async function xoaHetAnhCho(): Promise<void> {
  await lam("readwrite", (s) => s.clear());
}
