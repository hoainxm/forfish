// ĐỌC danh sách bà con TỰ GÕ (mối quen · đồ trên tàu) — phân biệt cho được
// "CHƯA CÓ GÌ" với "KHÔNG ĐỌC ĐƯỢC".
//
// Vì sao có file này (K4, 2026-08-02): các màn tự nhập đều viết kiểu
//   try { raw = getItem(); if (raw) return JSON.parse(raw) } catch {} return [];
// tức JSON hỏng một ký tự (ghi dở lúc máy đầy / pin sập) cũng trả về MẢNG RỖNG.
// Màn hình bật cờ `ready` rồi effect ghi ngay `"[]"` ĐÈ LÊN chuỗi gốc — dữ liệu
// bà con gõ tay (nậu vựa + số điện thoại, đồ trên tàu + hạn bảo hành) bị xoá
// sạch bởi chính cú "khôi phục". Sổ tay giấy không bao giờ tự trắng trang.
//
// Luật: KHÔNG ĐỌC ĐƯỢC thì KHÔNG MỞ CỬA GHI. Ghi thì đi qua `saveUserJson`
// (lib/user-store.ts) để dự báo nhường chỗ, và nhường không đủ thì BÁO ĐỎ.

/**
 * Kết quả đọc một danh sách tự nhập:
 *  · `{ ok: true,  list: [...] }` — đọc được (mảng rỗng = bà con chưa thêm gì)
 *  · `{ ok: true,  list: null }`  — CHƯA CÓ khoá nào trong máy (màn tự quyết:
 *                                   để trống hay dựng sổ mẫu)
 *  · `{ ok: false, list: null }`  — KHÔNG ĐỌC ĐƯỢC (JSON hỏng / máy chặn
 *                                   localStorage) ⇒ ĐỪNG ghi đè lên nó
 */
export interface UserListRead<T> {
  ok: boolean;
  list: T[] | null;
}

/**
 * Như `UserListRead` nhưng cho khoá giữ một ĐỐI TƯỢNG (không phải mảng): bảng
 * gán đồ SDVICO (`{id: boatId}`), hồ sơ tàu (`{speedKn, litersPerHour}`).
 *  · `{ ok: true,  value: {...} }` — đọc được
 *  · `{ ok: true,  value: null }`  — CHƯA CÓ khoá nào trong máy
 *  · `{ ok: false, value: null }`  — KHÔNG ĐỌC ĐƯỢC ⇒ ĐỪNG ghi đè lên nó
 */
export interface UserRecordRead<T> {
  ok: boolean;
  value: T | null;
}

export function readUserList<T>(key: string): UserListRead<T> {
  if (typeof window === "undefined") return { ok: false, list: null };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    // Safari chế độ riêng tư / storage bị chặn — KHÔNG phải "chưa có gì".
    return { ok: false, list: null };
  }
  if (raw == null || raw === "") return { ok: true, list: null };
  try {
    const v = JSON.parse(raw) as unknown;
    // Đúng hình mảng mới coi là đọc được: `{}` hay `"abc"` nghĩa là khoá đang
    // giữ thứ khác — ghi đè lên là mất luôn thứ đó.
    if (!Array.isArray(v)) return { ok: false, list: null };
    return { ok: true, list: v as T[] };
  } catch {
    return { ok: false, list: null };
  }
}

/**
 * ĐỌC một khoá giữ ĐỐI TƯỢNG — cùng luật ba nhánh với `readUserList` (K4 mở
 * rộng 2026-08-02). Không ép mọi chỗ về hình MẢNG: `forfish.sdvico-boat.v1` là
 * bảng tra id→tàu, `forfish.boat.v1` là hồ sơ tàu; nhét chúng vào khuôn mảng
 * chỉ để dùng chung một hàm là bẻ dữ liệu cho vừa cái hàm.
 *
 * MẢNG bị coi là KHÔNG ĐỌC ĐƯỢC ở đây (và ngược lại bên `readUserList`): khoá
 * đang giữ thứ khác hình mong đợi ⇒ ghi đè lên là mất luôn thứ đó.
 */
export function readUserRecord<T>(key: string): UserRecordRead<T> {
  if (typeof window === "undefined") return { ok: false, value: null };
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { ok: false, value: null }; // storage bị chặn — KHÔNG phải "chưa có gì"
  }
  if (raw == null || raw === "") return { ok: true, value: null };
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v))
      return { ok: false, value: null };
    return { ok: true, value: v as T };
  } catch {
    return { ok: false, value: null };
  }
}
