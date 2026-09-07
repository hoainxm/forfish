// TRỢ LÝ — CHIP GỢI Ý THEO MÀN + GIỜ + VIỆC (thuần, 14 §4.4; bảng NGUYÊN 13 §5.3).
//
// `suggestionsFor(route, hour, snapshot)` trả ≤4 chip: 2 theo màn đang đứng +
// 1 theo giờ VN + 1 theo việc đỏ/vàng trong máy (chỉ khi có). Không trùng ý —
// mỗi chip mang nhãn ý định tĩnh (`tag`) để loại trùng mà không phải parse lại.
// Không đọc window/localStorage — snapshot là tham số (null = chưa gom).

import { STORM_MAX_AGE_MS } from "@/lib/storms";
import type { DeviceSnapshot, Intent, Suggestion } from "./types";

type Chip = Suggestion & { tag: Intent };

const c = (label: string, utterance: string, tag: Intent): Chip => ({ label, utterance, tag });

/** 2 chip theo màn — bảng 13 §5.3, thứ tự = ưu tiên khớp (cụ thể trước). */
const BY_ROUTE: [RegExp, Chip[]][] = [
  [/^\/cho\/sp\//, [c("Gọi shop", "gọi shop", "goi_shop"), c("Xem giỏ", "giỏ có gì", "xem_gio")]],
  [/^\/cho\/gio/, [c("Giỏ có gì", "giỏ có gì", "xem_gio"), c("Tìm thêm món", "tìm nhớt máy", "tim_mon")]],
  [/^\/cho\/don/, [c("Đơn đang giao", "đơn đang giao", "don_cua_toi"), c("Gọi shop", "gọi shop", "goi_shop")]],
  [/^\/cho/, [c("Tìm nhớt máy", "tìm nhớt máy", "tim_mon"), c("Xem giỏ", "giỏ có gì", "xem_gio")]],
  [/^\/ban-hang/, [c("Đơn cần xác nhận", "mở bán hàng", "mo_man"), c("Về chợ", "mở chợ", "mo_man")]],
  [/^\/ngu-truong/, [c("Có bão không", "có bão không", "bao"), c("Con nước hôm nay", "con nước hôm nay", "con_nuoc")]],
  [/^\/tau\?tab=dich-vu/, [c("Bảo dưỡng tới hạn", "bảo dưỡng gì tới hạn", "bao_duong"), c("Gọi SDVICO", "gọi SDVICO", "goi_sdvico")]],
  [/^\/tau\?tab=san-pham/, [c("Vào chợ vật tư", "mở chợ", "mo_man"), c("Đơn của tôi", "đơn của tôi", "don_cua_toi")]],
  [/^\/tau/, [c("Giấy sắp hết hạn", "giấy nào sắp hết hạn", "giay_to"), c("Mở sổ bảo dưỡng", "mở sổ bảo dưỡng", "mo_man")]],
  [/^\/nguoi/, [c("Ai chưa có bảo hiểm", "ai chưa có bảo hiểm", "thuyen_vien"), c("Tàu có mấy người", "tàu có mấy người", "thuyen_vien")]],
  [/^\/tien/, [c("Giá cá ngừ", "giá cá ngừ hôm nay", "gia_ca"), c("Giá dầu hôm nay", "giá dầu hôm nay", "gia_dau")]],
  [/^\/cang/, [c("Đặt cảng nhà", "đặt cảng nhà", "dat_cang_nha"), c("Thời tiết cảng này", "thời tiết hôm nay", "thoi_tiet")]],
  [/^\/?$/, [c("Thời tiết hôm nay", "thời tiết hôm nay", "thoi_tiet"), c("Giấy sắp hết hạn", "giấy tờ sắp hết hạn", "giay_to")]],
];

const DEFAULT_ROUTE_CHIPS: Chip[] = [
  c("Thời tiết hôm nay", "thời tiết hôm nay", "thoi_tiet"),
  c("Giấy sắp hết hạn", "giấy tờ sắp hết hạn", "giay_to"),
];

/** 1 chip theo giờ VN (13 §5.3). */
export function hourChip(hour: number): Suggestion {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 3 && h <= 9) return c("Hôm nay đi được không", "hôm nay đi được không", "thoi_tiet");
  if (h >= 10 && h <= 14) return c("Giá cá hôm nay", "giá cá hôm nay", "gia_ca");
  if (h >= 15 && h <= 19) return c("Ngày mai sao", "ngày mai sao", "thoi_tiet");
  return c("Có bão không", "có bão không", "bao");
}

/** 1 chip theo việc đỏ/vàng trong máy — ưu tiên trên → dưới, lấy 1; không có việc → null. */
export function taskChip(s: DeviceSnapshot | null, now: number): Chip | null {
  if (!s) return null;
  if (s.storm && (s.storm.storms.length > 0 || now - s.storm.savedAt > STORM_MAX_AGE_MS)) {
    return c("Tin bão", "có bão không", "bao");
  }
  if (s.docs?.some((d) => d.level === "expired" || d.level === "soon")) {
    return c("Giấy tờ cần lo", "giấy tờ sắp hết hạn", "giay_to");
  }
  if (s.maintenance?.some((m) => m.level === "overdue")) {
    return c("Bảo dưỡng quá hạn", "bảo dưỡng gì quá hạn", "bao_duong");
  }
  if (s.orders?.items.some((o) => o.status === "dang_giao")) {
    return c("Đơn đang giao", "đơn đang giao", "don_cua_toi");
  }
  if (s.inboxUnread > 0) return c("Tin mới", "có tin mới không", "hop_thu");
  return null;
}

function routeChips(route: string): Chip[] {
  const r = route || "/";
  for (const [re, chips] of BY_ROUTE) if (re.test(r)) return chips;
  return DEFAULT_ROUTE_CHIPS;
}

/**
 * `suggestionsFor(route, hour, snapshot)` — ≤4 chip, không trùng ý (13 AC-T26).
 * `now` chỉ để so tuổi tin bão; mặc định giờ máy (chỗ gọi có `now` thì truyền).
 */
export function suggestionsFor(
  route: string,
  hour: number,
  s: DeviceSnapshot | null,
  now: number = Date.now(),
): Suggestion[] {
  const out: Chip[] = [];
  const seen = new Set<Intent>();
  const push = (chip: Chip | null) => {
    if (!chip || seen.has(chip.tag) || out.length >= 4) return;
    seen.add(chip.tag);
    out.push(chip);
  };
  for (const chip of routeChips(route)) push(chip);
  push(hourChip(hour) as Chip);
  push(taskChip(s, now));
  return out.map(({ label, utterance }) => ({ label, utterance }));
}
