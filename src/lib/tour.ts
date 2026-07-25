/**
 * HƯỚNG DẪN DÙNG APP — định nghĩa THUẦN (không React) cho coach-mark.
 *
 * Nguyên tắc (03-design-system §1: ngư dân 40–60 tuổi, ít rành công nghệ):
 * · chỉ chỉ vào NÚT CHÍNH của từng màn, không chỉ hết mọi nút — tour dài
 *   thì bà con bỏ giữa chừng, mất tác dụng.
 * · mỗi bước = một câu việc-làm-được, tiếng Việt đời thường, không jargon.
 * · bước nào không tìm thấy nút trên màn (chưa đăng nhập, tab khác) thì BỎ
 *   QUA — không bao giờ chỉ vào chỗ trống (xem `visibleSteps`).
 *
 * Nút được chỉ đánh dấu bằng thuộc tính `data-tour="<target>"` trong JSX.
 * Trạng thái "đã xem" lưu localStorage (KHÔNG scope theo user — đây là
 * UI pref như displaymode/maplayer, chung một máy thì xem một lần là đủ;
 * xem 02-architecture §4 danh sách key GIỮ khi đổi user).
 */

export interface TourStep {
  /** giá trị `data-tour` của nút cần chỉ; null = bước nói chung, không chỉ đâu */
  target: string | null;
  title: string;
  body: string;
}

export interface Tour {
  id: string;
  /** tên màn, hiện trên thẻ hướng dẫn */
  label: string;
  steps: TourStep[];
}

/** Bước dùng lại ở nhiều màn — chip chọn tàu nằm ngay dưới hero */
const BOAT_STEP: TourStep = {
  target: "chon-tau",
  title: "Chọn tàu đang xem",
  body: "Chạm để đổi tàu hoặc thêm tàu mới. Giấy tờ, bảo dưỡng, lãi lỗ đều tính theo tàu đang chọn ở đây.",
};

export const TOURS: Tour[] = [
  {
    id: "trang-chu",
    label: "Trang chủ",
    steps: [
      {
        target: "tai-khoan",
        title: "Nút tài khoản",
        body: "Chạm vào đây để xem tên mình, chỉnh cỡ chữ cho dễ đọc, đổi mật khẩu hoặc đăng xuất.",
      },
      BOAT_STEP,
      {
        target: "nhac-viec",
        title: "Việc cần làm ngay",
        body: "App tự nhắc giấy tờ, bảo hiểm, bảo dưỡng sắp hết hạn. Chạm vào dòng nhắc là tới thẳng chỗ xử lý.",
      },
      {
        target: "bon-viec",
        title: "Bốn việc chính",
        body: "Bốn ô lớn là bốn việc app lo giúp: Ra khơi (gió sóng, chỗ có cá) · Tàu của tôi (giấy tờ, dịch vụ) · Bạn thuyền (hồ sơ, bảo hiểm) · Sổ tiền (giá cá, lãi lỗ).",
      },
      {
        target: "dock",
        title: "Thanh dưới cùng",
        body: "Thanh này luôn có ở mọi màn. Chạm để nhảy qua lại giữa các mục, không sợ lạc.",
      },
    ],
  },
  {
    id: "ra-khoi",
    label: "Ra khơi",
    steps: [
      {
        target: "rail",
        title: "Sáu nút bên phải",
        body: "Mỗi nút mở một bảng: Hải đồ (nền bản đồ, độ sâu) · Ngư trường (chỗ có khả năng có cá) · Thời tiết (gió, sóng) · Điểm đã lưu (chỗ hay đánh, cảng nhà) · Công cụ (đo khoảng cách) · Cài đặt.",
      },
      {
        target: "sheet-day",
        title: "Bảng dưới đáy",
        body: "Cho biết biển êm hay động, sóng mấy mét, gió cấp mấy ở chỗ đang xem. Chạm 'Xem thêm' để mở rộng, 'Về cảng' để quay lại vùng biển cảng nhà.",
      },
      {
        target: null,
        title: "Ngày của ảnh vệ tinh",
        body: "Trong bảng Hải đồ, mỗi lớp đều ghi ảnh chụp ngày nào. Ảnh vệ tinh luôn chậm vài ngày — chỗ trống trên ảnh là mây che, không phải biển trống.",
      },
      {
        target: null,
        title: "Chạm vào biển để xem",
        body: "Chạm bất kỳ chỗ nào trên biển: bảng dưới đáy sẽ đổi sang gió sóng của đúng chỗ đó. Số liệu là tham khảo — quyết định ra khơi vẫn là của thuyền trưởng.",
      },
    ],
  },
  {
    id: "tau",
    label: "Tàu của tôi",
    steps: [
      BOAT_STEP,
      {
        target: "tab-giay-to",
        title: "Giấy tờ",
        body: "Checklist xuất bến đèn xanh–đỏ cho biết tàu đủ điều kiện ra khơi chưa, kèm tủ giấy tờ. App nhắc trước khi hết hạn.",
      },
      {
        target: "tab-dich-vu",
        title: "Dịch vụ",
        body: "Dịch vụ SDVICO đang dùng, cước còn chờ đóng, nút gọi SDVICO, và sổ nhắc bảo dưỡng tự ghi.",
      },
      {
        target: "tab-san-pham",
        title: "Sản phẩm",
        body: "Đồ đã mua và hạn bảo hành. Xem SDVICO còn có gì hợp với tàu mình.",
      },
      {
        target: "tab-muc-phat",
        title: "Mức phạt",
        body: "Tra mức phạt theo Nghị định 38/2024 trước khi ra khơi. Số liệu tham khảo, không thay văn bản gốc.",
      },
    ],
  },
  {
    id: "ban-thuyen",
    label: "Bạn thuyền",
    steps: [
      BOAT_STEP,
      {
        target: "them-thuyen-vien",
        title: "Thêm bạn thuyền",
        body: "Chạm để ghi tên, số điện thoại, chứng chỉ, bảo hiểm của từng người. App nhắc khi bảo hiểm hay chứng chỉ sắp hết hạn.",
      },
      {
        target: null,
        title: "Sổ ứng tiền",
        body: "Mỗi bạn thuyền có sổ ứng tiền riêng — ứng bao nhiêu, gạch nợ lúc nào đều ghi lại, khỏi cãi nhau cuối chuyến.",
      },
    ],
  },
  {
    id: "tien",
    label: "Sổ tiền",
    steps: [
      {
        target: "tab-giao-dich",
        title: "Giao dịch",
        body: "Giá cá tham khảo, ai đang cần mua, và bán ở đâu (vựa, đầu mối theo vùng). Không cần đăng nhập cũng xem được.",
      },
      {
        target: "tab-hieu-qua",
        title: "Hiệu quả",
        body: "Sổ lãi lỗ từng chuyến, báo cáo cả năm, máy tính tổn trước khi đi, và chia tiền cho bạn thuyền.",
      },
      {
        target: "tab-cong-no",
        title: "Công nợ",
        body: "Ghi nợ đại lý dầu, nậu, ngân hàng — mỗi chủ nợ một dư nợ, có lịch sử vay và trả.",
      },
      BOAT_STEP,
    ],
  },
  {
    id: "cang",
    label: "Danh bạ cảng",
    steps: [
      {
        target: null,
        title: "Danh bạ cảng cá",
        body: "173 cảng cá chỉ định trên cả nước. Lọc theo vùng Bắc–Trung–Nam hoặc gõ tên tỉnh để tìm nhanh.",
      },
    ],
  },
];

/** Màn nào không có hướng dẫn (đăng nhập, đổi mật khẩu…) thì trả null. */
export function tourForPath(pathname: string): Tour | null {
  const byId = (id: string) => TOURS.find((t) => t.id === id) ?? null;
  if (pathname === "/") return byId("trang-chu");
  if (pathname.startsWith("/ngu-truong")) return byId("ra-khoi");
  if (pathname.startsWith("/tau")) return byId("tau");
  if (pathname.startsWith("/nguoi")) return byId("ban-thuyen");
  if (pathname.startsWith("/tien")) return byId("tien");
  if (pathname.startsWith("/cang")) return byId("cang");
  return null;
}

/**
 * Bỏ bước chỉ vào nút KHÔNG có trên màn lúc này (chưa đăng nhập, tab khác,
 * màn hình nhỏ ẩn bớt). `exists` do phía React truyền vào (querySelector).
 * Bước `target: null` luôn giữ — đó là bước nói chung.
 */
export function visibleSteps(
  steps: TourStep[],
  exists: (target: string) => boolean,
): TourStep[] {
  return steps.filter((s) => s.target === null || exists(s.target));
}

/**
 * Bộ bước THỰC SỰ chạy được trên màn lúc này.
 *
 * Màn có nút để chỉ mà KHÔNG nút nào hiện ra (chưa đăng nhập → cổng
 * LoginGate che hết) thì trả rỗng: không chỉ dẫn về thứ bà con đang không
 * nhìn thấy. Tour vốn chỉ toàn bước nói chung (vd danh bạ cảng) thì vẫn chạy.
 */
export function runnableSteps(
  tour: Tour,
  exists: (target: string) => boolean,
): TourStep[] {
  const vis = visibleSteps(tour.steps, exists);
  const coNeo = tour.steps.some((s) => s.target !== null);
  const neoHien = vis.some((s) => s.target !== null);
  return coNeo && !neoHien ? [] : vis;
}

// ---------------------------------------------------------------- đã xem

export const TOUR_SEEN_KEY = "forfish.tour.v1";

export function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function serializeSeen(ids: string[]): string {
  return JSON.stringify(ids);
}

/** Thêm id vào danh sách đã xem, không trùng lặp (thuần — dễ test). */
export function withSeen(seen: string[], id: string): string[] {
  return seen.includes(id) ? seen : [...seen, id];
}

export function loadSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseSeen(window.localStorage.getItem(TOUR_SEEN_KEY));
  } catch {
    return [];
  }
}

export function markSeen(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, serializeSeen(withSeen(loadSeen(), id)));
  } catch {
    /* chế độ riêng tư chặn localStorage → tour chạy lại lần sau, chấp nhận được */
  }
}

/** Xem lại từ đầu toàn bộ hướng dẫn (nút trong sheet Tài khoản). */
export function resetTours(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOUR_SEEN_KEY);
  } catch {
    /* bỏ qua */
  }
}

// ------------------------------------------------------------- bật / tắt

/**
 * Công tắc TỔNG cho "chỉ dẫn trên màn": tắt = ẩn nút nổi "Hướng dẫn" VÀ không
 * tự chạy coach-tour ở bất kỳ màn nào. Bà con nào đã quen app thì tắt cho gọn,
 * bật lại khi cần (sheet Tài khoản). UI pref chung máy như displaymode/tour.v1.
 *
 * Quy ước lưu: VẮNG MẶT = bật (mặc định có hướng dẫn); chỉ ghi chuỗi "off" khi
 * người dùng chủ động tắt → cài mới / máy người khác vẫn có hướng dẫn.
 */
export const TOUR_ENABLED_KEY = "forfish.tour.enabled.v1";

/** Tên sự kiện window để launcher đổi ngay khi bật/tắt trong sheet (cùng tab,
 *  `storage` event chỉ bắn cross-tab nên không đủ). */
export const TOUR_ENABLED_EVENT = "forfish:tour-enabled";

/** Thuần (dễ test): chỉ đúng chuỗi "off" mới là tắt, còn lại (kể cả null) = bật. */
export function isTourEnabled(raw: string | null): boolean {
  return raw !== "off";
}

export function loadTourEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return isTourEnabled(window.localStorage.getItem(TOUR_ENABLED_KEY));
  } catch {
    return true;
  }
}

export function setTourEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.removeItem(TOUR_ENABLED_KEY);
    else window.localStorage.setItem(TOUR_ENABLED_KEY, "off");
  } catch {
    /* storage bị chặn → vẫn đổi cho phiên này qua sự kiện dưới */
  }
  try {
    window.dispatchEvent(new CustomEvent(TOUR_ENABLED_EVENT, { detail: on }));
  } catch {
    /* môi trường không có CustomEvent → bỏ qua */
  }
}
