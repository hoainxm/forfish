// Helper THUẦN cho khu CHỢ CÁ (/tien) — không window, không fetch. Test ở
// src/lib/__tests__/cho-ca.test.ts. Gom một chỗ để ba màn (giá cá · mua bán ·
// đầu mối) không mỗi nơi tự chế một bản (nguyên tắc 3: `fold` từng nằm riêng
// trong price-board.tsx).

import type { PricePoint } from "@/lib/port-price-history";
import { normalizeVnPhone } from "@/lib/phone";

/** "cá hố" → "ca ho": so khớp bỏ dấu cho người gõ vội / bàn phím thiếu dấu. */
export function boDau(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/** Chuỗi "0905 568 899 / 0902 869 888" → từng số, để MỖI số chạm gọi được
 *  (CC-10). Cùng dấu tách với `CallButton` (ui/primitives) — đổi một nơi thì
 *  đổi cả hai. */
export function tachSdt(phone: string): string[] {
  return phone
    .split(/[/,;]| - | hoặc /i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `tel:` chỉ nhận số và dấu + — bỏ khoảng trắng, dấu chấm. */
export function telHref(so: string): string {
  return `tel:${so.replace(/[^\d+]/g, "")}`;
}

/** Số DI ĐỘNG VN (đầu 03/05/07/08/09, 10 số) — chỉ số này mới có Zalo; số bàn 02xx thì
 *  không (CC-18). Nhận cả "+84 905…" / "0905 568 899". */
export function laSoDiDong(so: string): boolean {
  return /^0(3|5|7|8|9)\d{8}$/.test(normalizeVnPhone(so));
}

/** Đường mở Zalo tới số di động ĐẦU TIÊN trong chuỗi SĐT ("09xx / 02yy" ⇒ 09xx);
 *  không có số di động ⇒ null (chỗ gọi chỉ vẽ "Gọi"). */
export function zaloHref(phone: string): string | null {
  const so = tachSdt(phone).find(laSoDiDong);
  return so ? `https://zalo.me/${normalizeVnPhone(so)}` : null;
}

/** Địa chỉ vựa/chợ ⇒ link mở bản đồ máy (Google Maps mở app nếu có — `geo:` không có trên
 *  iOS) (CC-19). Địa chỉ ngắn hơn 6 ký tự ("—", trống) ⇒ null, không hứa bản đồ. */
export function banDoHref(diaChi: string | undefined, tinh?: string): string | null {
  const d = (diaChi ?? "").trim();
  if (d.length < 6) return null;
  const q = tinh && !boDau(d).includes(boDau(tinh)) ? `${d}, ${tinh}` : d;
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}

/** Đọc một tham số trong `?a=b&c=d`, chỉ nhận giá trị trong `cho` — lạ thì về
 *  `macDinh` (link cũ / gõ tay không làm màn trắng). */
export function docThamSo<T extends string>(
  search: string,
  key: string,
  cho: readonly T[],
  macDinh: T,
): T {
  const v = new URLSearchParams(search).get(key);
  return v && (cho as readonly string[]).includes(v) ? (v as T) : macDinh;
}

/** Trả chuỗi `?…` mới sau khi đặt một tham số (giữ các tham số khác). Chuỗi rỗng
 *  khi không còn tham số nào — để `replaceState` không để lại dấu `?` trần. */
export function datThamSo(search: string, key: string, value: string | null): string {
  const p = new URLSearchParams(search);
  if (value == null) p.delete(key);
  else p.set(key, value);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Khoảng tuần VASEP "30/5 – 05/6/2026" → ISO ngày CUỐI tuần "2026-06-05";
 *  không đọc được thì null (không đoán). */
export function weekEndIso(week: string | undefined): string | null {
  if (!week) return null;
  const m = week.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Lịch sử (kho cron) có thể dừng ở tuần trước trong khi bảng giá đã là tuần
 *  này — ghép điểm tuần hiện tại vào cuối chuỗi để hai "mới nhất" trên cùng màn
 *  không lệch nhau (CC-14). Chỉ ghép khi tuần ấy MỚI HƠN điểm cuối; trùng/cũ
 *  hơn thì giữ nguyên. */
export function ghepTuanHienTai(
  points: PricePoint[],
  tuan: { date: string | null; minVnd: number; maxVnd: number } | null,
): PricePoint[] {
  if (!tuan || !tuan.date) return points;
  const last = points[points.length - 1];
  if (last && last.date >= tuan.date) return points;
  return [...points, { date: tuan.date, minVnd: tuan.minVnd, maxVnd: tuan.maxVnd }];
}
