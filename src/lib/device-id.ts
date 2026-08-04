/*  KHÔNG ĐƯỢC ĐẶT "use client" Ở FILE NÀY (sửa 2026-08-02c — lỗi CHẶN thật,
    bắt được trên production).

    LỖI: file này từng mở đầu bằng `"use client"`, mà `/api/me/heartbeat` lại
    `import { isValidDeviceId }` từ đây. Next biến MỌI export của một module
    "use client" thành `registerClientReference(() => { throw ... })` trong bản
    dựng server ⇒ route gọi hàm đó là **ném ngay**, HTTP 500, trước cả dòng ghi
    đầu tiên. Hậu quả đo được trên máy chủ thật: từ lúc bản đó lên (22:43
    01/08/2026) tới khi phát hiện, **0/717 khách có `device_id`**, bảng
    `customer_devices` TRỐNG HOÀN TOÀN, và những máy đang dùng app hằng ngày thì
    /quan-tri đứng im ở mốc cũ — nhân viên nhìn vào tưởng khách bỏ app.

    Vì sao không ai bắt được: `npm run build` XANH, `tsc` XANH, `lint` XANH —
    đây là lỗi ranh giới client/server, chỉ nổ lúc CHẠY. Nay có cổng chặn cả
    khuôn: `src/lib/__tests__/server-client-boundary.test.ts`.

    File này an toàn cho cả hai phía: mọi hàm tự gác `typeof window`. Cùng khuôn
    với `src/lib/phone.ts` (file đó đã ghi sẵn bài học này từ trước).  */

// MÃ MÁY — để biết bà con ĐỔI ĐIỆN THOẠI (2026-08-01j, chủ dự án chốt).
//
// Vì sao cần: ba cột mốc của migration 0021 nằm trên `customers` nên chúng tích
// luỹ theo TÀI KHOẢN chứ không theo MÁY:
//     máy cũ (iPhone) mở bản cài   → pwa_last_open_at = 10/07
//     đổi sang Android, chỉ mở web → web_last_open_at = 01/08
//                                    pwa_last_open_at VẪN 10/07
//     ⇒ /quan-tri báo "Đã mở bản cài" cho cái máy CHƯA BAO GIỜ mở bản cài.
// Có mã máy thì máy chủ nhận ra nhịp đến từ máy khác và xoá ba mốc đi ghi lại.
//
// ⚠️ ĐÂY KHÔNG PHẢI DẤU VÂN TAY. Mã do chính app sinh ngẫu nhiên rồi cất trong
// máy — không phải IMEI, không phải serial, không suy từ user-agent/màn hình/
// phần cứng. Xoá dữ liệu web là mất (máy thành "máy mới", chấp nhận được), và
// nó không nhận ra được máy đó ở bất kỳ trang nào khác. Cùng luật với 0021:
// KHÔNG vị trí, KHÔNG thao tác, KHÔNG nội dung.

/** Khoá localStorage giữ mã máy — quy ước forfish.* (state-registry) */
export const DEVICE_ID_KEY = "forfish.device.v1";

/** Mã hợp lệ chưa — THUẦN, có test. Chặn rác/chuỗi khổng lồ lọt xuống DB. */
export function isValidDeviceId(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{8,64}$/i.test(v);
}

/** Sinh mã mới. `crypto.randomUUID` không có (máy cũ / http) thì tự ghép. */
function makeDeviceId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* rơi xuống đường dưới */
  }
  // Không có nguồn ngẫu nhiên nào: mã này chỉ để PHÂN BIỆT máy, không phải bí
  // mật, nên trùng nhau cũng chỉ làm số liệu quản trị kém chính xác một chút.
  return `x${Math.floor(Math.random() * 1e16).toString(16)}${Date.now().toString(16)}`;
}

/**
 * Mã của máy này (tạo lần đầu rồi giữ nguyên). Trả `null` khi không lưu được —
 * chế độ riêng tư / storage bị chặn: khi đó nhịp gửi đi KHÔNG kèm mã, và máy
 * chủ giữ nguyên hành vi cũ (không reset gì) thay vì coi mỗi lần mở app là một
 * máy mới rồi xoá mốc liên tục.
 */
export function deviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(DEVICE_ID_KEY);
    if (isValidDeviceId(saved)) return saved;
    const fresh = makeDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, fresh);
    // đọc lại: ghi xong mà không nằm lại (hết chỗ) thì coi như không có mã
    return window.localStorage.getItem(DEVICE_ID_KEY) === fresh ? fresh : null;
  } catch {
    return null;
  }
}
