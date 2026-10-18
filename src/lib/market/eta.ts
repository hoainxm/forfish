// HẸN GIAO của Chợ vật tư — THUẦN (2026-10-18, chủ dự án: "luồng giống Shopee như xác nhận
// đơn, thời gian giao"). Shop/chủ sàn bấm XÁC NHẬN là phải hẹn ngày giao — một khoảng
// [etaFrom, etaTo] theo LỊCH VIỆT NAM ("YYYY-MM-DD"), không giờ phút: ngoài biển "hôm nay /
// ngày mai / 2–3 ngày" là đủ, giờ chính xác là lời hứa shop không giữ được.
import { addDaysIso, daysUntil, todayIsoVN } from "@/lib/days";
import type { Order } from "./types";

/** hẹn xa nhất — quá thì là hàng đặt về, ghi ở ghi chú chứ không hứa ngày */
export const ETA_MAX_DAYS = 60;

export interface EtaPreset { id: "hom_nay" | "ngay_mai" | "2_3_ngay" | "3_5_ngay" | "tuan_toi"; label: string; from: number; to: number }
/** chip chọn nhanh — đủ cho 9/10 đơn, còn lại "Chọn ngày" */
export const ETA_PRESETS: readonly EtaPreset[] = [
  { id: "hom_nay", label: "Hôm nay", from: 0, to: 0 },
  { id: "ngay_mai", label: "Ngày mai", from: 1, to: 1 },
  { id: "2_3_ngay", label: "2–3 ngày", from: 2, to: 3 },
  { id: "3_5_ngay", label: "3–5 ngày", from: 3, to: 5 },
  { id: "tuan_toi", label: "Trong 7 ngày", from: 5, to: 7 },
];

export function vnToday(now: number = Date.now()): string {
  return todayIsoVN(now);
}

export function presetRange(id: EtaPreset["id"], today: string): { etaFrom: string; etaTo: string } | null {
  const p = ETA_PRESETS.find((x) => x.id === id);
  return p ? { etaFrom: addDaysIso(today, p.from), etaTo: addDaysIso(today, p.to) } : null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** null = hợp lệ; câu đời thường khi sai. `today` = ngày VN hôm nay. */
export function validateEta(etaFrom: unknown, etaTo: unknown, today: string): string | null {
  if (typeof etaFrom !== "string" || typeof etaTo !== "string" || !ISO.test(etaFrom) || !ISO.test(etaTo))
    return "Chọn ngày giao hàng.";
  const a = daysUntil(etaFrom, today);
  const b = daysUntil(etaTo, today);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Chọn ngày giao hàng.";
  if (a < 0) return "Ngày giao không được trước hôm nay.";
  if (b < a) return "Ngày giao xa nhất phải sau ngày gần nhất.";
  if (b > ETA_MAX_DAYS) return "Hẹn giao tối đa 60 ngày — hàng lâu hơn thì ghi vào ghi chú.";
  return null;
}

const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
function oneDay(iso: string, today: string): string {
  const d = daysUntil(iso, today);
  if (d === 0) return "hôm nay";
  if (d === 1) return "ngày mai";
  if (d === -1) return "hôm qua";
  const t = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t.getTime())) return iso;
  const dm = `${t.getUTCDate()}/${t.getUTCMonth() + 1}`;
  return d > 1 && d < 7 ? `${THU[t.getUTCDay()]} ${dm}` : dm;
}

/** "hôm nay" · "ngày mai" · "Thứ Năm 20/10" · "20/10 – 22/10" — chữ thường đầu câu, UI tự viết hoa khi cần */
export function etaLabel(etaFrom: string | undefined, etaTo: string | undefined, today: string): string {
  if (!etaFrom) return "";
  const to = etaTo || etaFrom;
  if (to === etaFrom) return oneDay(etaFrom, today);
  return `${oneDay(etaFrom, today)} – ${oneDay(to, today)}`;
}

/** Đã qua hạn hẹn mà chưa giao tới (da_xac_nhan / dang_giao, etaTo < hôm nay). */
export function isLate(o: Pick<Order, "status" | "etaFrom" | "etaTo">, today: string): boolean {
  if (o.status !== "da_xac_nhan" && o.status !== "dang_giao") return false;
  const end = o.etaTo || o.etaFrom;
  if (!end) return false;
  return daysUntil(end, today) < 0;
}

/** Đọc hẹn giao từ body route: {etaPreset} (chip / Sen Biển) HOẶC {etaFrom, etaTo}. Chuỗi = câu lỗi. */
export function readEta(b: { etaPreset?: unknown; etaFrom?: unknown; etaTo?: unknown }, today: string): { etaFrom: string; etaTo: string } | string {
  if (typeof b.etaPreset === "string") {
    const r = presetRange(b.etaPreset as EtaPreset["id"], today);
    return r ?? "Chọn ngày giao hàng.";
  }
  const to = b.etaTo == null || b.etaTo === "" ? b.etaFrom : b.etaTo;
  const err = validateEta(b.etaFrom, to, today);
  return err ?? { etaFrom: b.etaFrom as string, etaTo: to as string };
}
