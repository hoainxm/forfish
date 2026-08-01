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
 * ⚠️ LÝ DO CÓ HÀM NÀY (2026-08-01, chủ dự án chỉ ra): iOS cho bản "Thêm vào
 * Màn hình chính" một KHO LƯU TRỮ RIÊNG, tách hẳn Safari. Nên tải đủ dữ liệu
 * TRONG SAFARI **không chứng minh được gì** cho cái icon mà bà con sẽ bấm lúc
 * ra khơi. Bản đầu ghi `offline_ready_at` cho cả hai đường ⇒ chip báo xanh "đủ
 * đồ đi biển" cho đúng người sắp nhổ neo với bản cài TRỐNG TRƠN — nói dối ngay
 * tại ca nguy hiểm nhất (TC-13 trong ops/qa-offline-acceptance.md).
 *
 * Android KHÔNG dính: bản cài dùng CHUNG kho với Chrome (cùng origin), tải ở
 * đâu cũng như nhau — nên bắt buộc standalone ở đó là bắt oan.
 */
export function countsAsOfflineReady(beat: {
  offlineReady: boolean;
  standalone: boolean;
  ios: boolean;
}): boolean {
  if (!beat.offlineReady) return false;
  // iOS: chỉ tính khi nhịp gửi TỪ BẢN CÀI — đúng cái kho sẽ dùng ngoài biển
  if (beat.ios && !beat.standalone) return false;
  return true;
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
