// DỮ LIỆU BÀ CON TỰ GÕ VÀO (giấy tờ · bạn thuyền · mốc bảo dưỡng) — ghi xuống
// máy và NÓI THẬT khi không ghi được.
//
// Vì sao có file này (2026-07-31): ba màn trên đều tự `localStorage.setItem`
// trong một khối try/catch RỖNG. Máy hết chỗ (dự báo tải sẵn chiếm gần hết) thì
// màn hình vẫn hiện đúng thứ vừa nhập — vì nó nằm trong bộ nhớ — nhưng máy
// KHÔNG giữ gì; mở lại app là mất trắng, tệ hơn là tủ giấy tờ rơi về SỔ MẪU.
// Giấy tờ bà con gõ tay mất là mất luôn, còn dự báo có sóng là tải lại được ⇒
// khi chật chỗ thì DỰ BÁO NHƯỜNG, và nhường vẫn không đủ thì phải BÁO ĐỎ.

import { reclaimForecastSpace } from "@/lib/forecast-cache";

/** Số lần "bỏ bớt dự báo rồi ghi lại" trước khi chịu thua (thà báo thật) */
const MAX_RETRY = 3;

/**
 * Ghi JSON dữ liệu tự nhập. Trả `false` khi máy KHÔNG giữ được — nơi gọi PHẢI
 * hiện câu báo, không được nuốt im.
 */
export function saveUserJson(key: string, value: unknown): boolean {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return false; // không stringify được — không phải lỗi bộ nhớ
  }
  // localStorage đếm UTF-16 ⇒ ~2 byte/ký tự
  const needBytes = (key.length + payload.length) * 2;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    try {
      window.localStorage.setItem(key, payload);
      return true;
    } catch {
      // Máy hết chỗ / trình duyệt chặn storage. Bỏ bớt bản dự báo CŨ NHẤT rồi
      // thử lại; không còn gì để bỏ (hoặc bị chặn hẳn) thì thôi, báo thật.
      if (attempt === MAX_RETRY || reclaimForecastSpace(needBytes) === 0)
        return false;
    }
  }
  return false;
}
