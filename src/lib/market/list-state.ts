// GIỮ TRẠNG THÁI DANH SÁCH CỬA HÀNG QUA MỘT LẦN RỜI MÀN (11 §5b.2).
//
// Vì sao có (chủ dự án 2026-09-08: "khi đóng hoặc quay lại phải giữ nguyên từ
// tìm, bộ lọc, thứ tự, số món đã tải và vị trí cuộn — đây là thay đổi quan
// trọng nhất để hết cảm giác nhảy qua nhảy lại"):
// `market-search` giữ mọi thứ trong `useState`, nên mở một món rồi bấm Quay lại
// là mất sạch — bà con gõ lại chữ tìm, chọn lại nhóm, bấm "Xem thêm" lại mấy
// lượt, rồi cuộn tìm đúng chỗ cũ. Trên tàu, tay ướt, sóng yếu, mỗi lượt tải lại
// là tiền và là thời gian.
//
// PHẠM VI CỐ Ý HẸP — `sessionStorage`, không phải `localStorage`:
// · đây là chỗ đang đứng trong MỘT phiên, không phải sổ của bà con;
// · mở app lần sau phải là danh sách mới, không phải giá của hôm qua;
// · không đi vào tệp sao lưu, không qua máy khác (cùng luật với các khoá chợ khác).
// Ghi hỏng hoặc máy chật thì im lặng bỏ qua: mất thì danh sách tải lại từ đầu,
// không mất gì của bà con — khác hẳn `saveUserJson` (mất là mất sổ).

/** Một ngăn cho mỗi danh sách; khoá mang tên màn để hai danh sách không đè nhau. */
const KHOA = "forfish.mlist.v1";

/** Bản chụp còn dùng được trong bao lâu — quá thì coi như chưa có, tải mới.
 *  10 phút: đủ cho một vòng xem món rồi quay lại, không đủ để giá kịp cũ. */
export const HAN_MS = 10 * 60 * 1000;

export type ListSnapshot<T> = {
  /** chữ đang tìm */
  q: string;
  /** nhóm hàng / lọc gần / thứ tự — mỗi màn tự đặt tên, lib không cần biết */
  filters: Record<string, string | number | boolean | null>;
  /** CÁC MÓN ĐÃ TẢI — giữ để không phải xin lại trang 1..n */
  items: T[];
  /** tổng số món khớp, để nút "Xem thêm" biết còn hay hết */
  total: number;
  /** đã tải tới trang mấy */
  page: number;
  /** vị trí cuộn (px) */
  scrollY: number;
  /** mốc ghi (epoch ms) — để tính hạn */
  at: number;
};

function kho(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // Safari riêng tư có thể ném ngay khi chạm
  }
}

function doc(): Record<string, unknown> {
  const s = kho();
  if (!s) return {};
  try {
    const raw = s.getItem(KHOA);
    if (!raw) return {};
    const v: unknown = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Ghi bản chụp. Trả `false` khi máy không giữ được — nơi gọi KHÔNG cần báo gì. */
export function saveListState<T>(id: string, snap: Omit<ListSnapshot<T>, "at">): boolean {
  const s = kho();
  if (!s) return false;
  try {
    s.setItem(KHOA, JSON.stringify({ ...doc(), [id]: { ...snap, at: Date.now() } }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Bản chụp còn hạn, hoặc `null`. Đọc XONG LÀ XOÁ (dùng một lần):
 * quay lại danh sách thì khôi phục, còn vào lại từ dock hay từ Sen Biển là
 * việc MỚI — bà con gõ chữ tìm mới mà máy nhả ra kết quả cũ thì tệ hơn là
 * không giữ gì. Màn nào cần giữ lâu hơn thì tự ghi lại sau khi đọc.
 */
export function takeListState<T>(id: string, now: number = Date.now()): ListSnapshot<T> | null {
  const all = doc();
  const raw = all[id];
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as ListSnapshot<T>;
  const s = kho();
  if (s) {
    try {
      const { [id]: _bo, ...con } = all;
      void _bo;
      s.setItem(KHOA, JSON.stringify(con));
    } catch {
      /* không xoá được thì thôi — hạn bên dưới vẫn chặn bản quá cũ */
    }
  }
  if (typeof snap.at !== "number" || now - snap.at > HAN_MS) return null;
  if (!Array.isArray(snap.items)) return null;
  return snap;
}

/** Xoá ngăn của một danh sách (vd bà con vừa đặt hàng xong, danh sách cũ hết nghĩa). */
export function clearListState(id: string): void {
  const s = kho();
  if (!s) return;
  try {
    const all = doc();
    if (!(id in all)) return;
    const { [id]: _bo, ...con } = all;
    void _bo;
    s.setItem(KHOA, JSON.stringify(con));
  } catch {
    /* không xoá được cũng không sao — có hạn 10 phút */
  }
}
