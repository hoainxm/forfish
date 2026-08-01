// THANG TRẠNG THÁI DÙNG APP — luật THUẦN, dùng chung client (gửi nhịp) ·
// route /api/me/heartbeat (ghi) · /quan-tri (hiện). Có test.
//
// Mỗi bậc chứng tỏ ĐÚNG MỘT việc người dùng đã làm:
//   0 chua-ghi-nhan   — máy chưa gửi nhịp nào. KHÔNG có nghĩa "chưa dùng app":
//                       heartbeat chỉ gửi khi ĐÃ ĐĂNG NHẬP và CÒN SÓNG, và cột
//                       chỉ ghi từ 2026-08-01. Bậc này nghĩa là CHƯA BIẾT.
//   1 moi-vo-web      — đã mở trong trình duyệt (đăng nhập, còn sóng), CHƯA mở
//                       bản cài. Không phân biệt được "chưa cài icon" với "cài
//                       rồi mà chưa bấm vào" — mà hậu quả hai ca GIỐNG HỆT: kho
//                       của bản cài vẫn trống.
//   2 da-mo-ban-cai   — đã mở icon bản cài ít nhất một lần khi còn sóng. Đây là
//                       bằng chứng đã qua ải "kho bản cài bắt đầu từ trống".
//   3 du-do-di-bien   — vỏ app đủ + mọi lớp dữ liệu đã tải, ĐO TRÊN ĐÚNG CÁI
//                       KHO sẽ dùng ngoài biển (xem countsAsOfflineReady).

/** Loại máy thô — khớp check constraint của `customers.device_platform` (0022) */
export type DevicePlatform = "ios" | "android" | "khac";

/** Nhãn chip loại máy ở /quan-tri — cùng khuôn ngắn, một dòng (luật nhãn 03) */
export const PLATFORM_LABEL: Record<DevicePlatform, string> = {
  ios: "iPhone",
  android: "Android",
  khac: "Máy khác",
};

/**
 * Ép giá trị máy gửi lên về đúng một loại hợp lệ — THUẦN, có test.
 *
 * Vì sao cần: giá trị này đi thẳng vào cột có CHECK constraint. Client cũ
 * (chưa có bản mới) không gửi gì → `null`, và null phải được giữ nguyên là
 * "chưa biết" chứ KHÔNG được đoán thành 'khac' — hai thứ đó khác nhau: một
 * bên là chưa hỏi, một bên là hỏi rồi mà không phải iOS/Android.
 */
export function normalizePlatform(v: unknown): DevicePlatform | null {
  return v === "ios" || v === "android" || v === "khac" ? v : null;
}

export type UsageStage =
  | "chua-ghi-nhan"
  | "moi-vo-web"
  | "da-mo-ban-cai"
  | "du-do-di-bien";

/** Nhãn chip — cùng khuôn 3 chữ, một dòng (luật nhãn ngang hàng, 03) */
export const USAGE_STAGE_LABEL: Record<UsageStage, string> = {
  "chua-ghi-nhan": "Chưa ghi nhận",
  "moi-vo-web": "Chưa mở bản cài",
  "da-mo-ban-cai": "Chưa đủ dữ liệu",
  "du-do-di-bien": "Đủ đồ đi biển",
};

/**
 * Nhịp này có được tính là "ĐỦ ĐỒ ĐI BIỂN" không.
 *
 * LUẬT: **phải gửi TỪ BẢN CÀI**, mọi nền, không ngoại lệ.
 *
 * ⚠️ LÝ DO GỐC (2026-08-01): iOS cho bản "Thêm vào Màn hình chính" một KHO
 * LƯU TRỮ RIÊNG, tách hẳn Safari. Tải đủ dữ liệu TRONG SAFARI **không chứng
 * minh được gì** cho cái icon mà bà con sẽ bấm lúc ra khơi — chip báo xanh cho
 * đúng người sắp nhổ neo với bản cài TRỐNG TRƠN (TC-13 trong
 * ops/qa-offline-acceptance.md).
 *
 * ⚠️ SIẾT SANG CẢ ANDROID (2026-08-01j, chủ dự án chốt: "1 chiều thôi, web →
 * PWA → tải; nếu không PWA thì cứ nằm ở Web để đảm bảo họ có PWA"). Bản trước
 * miễn cho Android vì bản cài ở đó dùng CHUNG kho với Chrome, nên xét về DỮ
 * LIỆU thì tải ở tab cũng như tải ở bản cài. Nhưng thang này không chỉ đo dữ
 * liệu — nó là DANH SÁCH GỌI ĐIỆN. Người Android tải đủ trong tab sẽ nhảy
 * thẳng lên bậc cao nhất, `usageCallPriority` = 3 ("yên tâm nhất"), rơi khỏi
 * danh sách nhắc cài — dù màn hình họ chưa có cái icon nào. Mà tab Chrome dễ
 * bị dọn hơn bản cài, `persist()` cũng khó được cấp hơn, và bà con phải nhớ
 * đường vào thay vì bấm icon. Nay chưa cài thì đứng lại ở "Chưa mở bản cài",
 * bậc "đủ đồ" KHÔNG có đường tắt.
 */
export function countsAsOfflineReady(beat: {
  offlineReady: boolean;
  standalone: boolean;
}): boolean {
  if (!beat.offlineReady) return false;
  // chỉ tính khi nhịp gửi TỪ BẢN CÀI — đúng cái kho sẽ dùng ngoài biển
  return beat.standalone;
}

/** Quy 3 mốc trong DB về đúng một bậc (bậc cao nhất đạt được). */
export function usageStage(a: {
  pwaLastOpenAt: string | null;
  webLastOpenAt: string | null;
  offlineReadyAt: string | null;
}): UsageStage {
  if (a.offlineReadyAt) return "du-do-di-bien";
  if (a.pwaLastOpenAt) return "da-mo-ban-cai";
  if (a.webLastOpenAt) return "moi-vo-web";
  return "chua-ghi-nhan";
}

/**
 * Mức ĐÁNG GỌI ĐIỆN — số càng nhỏ càng cần liên hệ trước. Dùng để xếp danh
 * sách ở /quan-tri: nhóm mới-vô-web đứng đầu vì họ là nhóm sẽ ra khơi với máy
 * trắng tay mà không biết.
 */
export function usageCallPriority(stage: UsageStage): number {
  switch (stage) {
    case "moi-vo-web":
      return 0; // nguy hiểm nhất: đã dùng app mà bản cài vẫn trống
    case "da-mo-ban-cai":
      return 1; // chỉ cần nhắc bấm tải
    case "chua-ghi-nhan":
      return 2; // chưa biết gì — phải hỏi trực tiếp
    case "du-do-di-bien":
      return 3; // yên tâm nhất
  }
}
