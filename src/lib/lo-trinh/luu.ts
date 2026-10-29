// LỘ TRÌNH CHUYẾN BIỂN ĐÃ LƯU — khoá `forfish.routes.v1` (09-ba-spec §5c). Logic thuần, test được.
//
// KHÁC `forfish.savedroutes.v1` (đường dẫn đường đã lưu — chỉ cất ĐIỂM, cố ý không cất số đã tính):
// ở đây CẤT CẢ KẾT QUẢ (lịch theo ngày, lít dầu, hải lý) vì đó chính là kế hoạch chuyến để mang ra
// khơi so vị trí khi mất sóng. Bù lại mỗi bản ghi mang TUỔI DỮ LIỆU lúc tính (`tuoiDuLieu`), và màn
// mở lại PHẢI nói thật "tính từ bản đồ cá lúc …" — không bày như số mới.
//
// Án lệ K4 (như places / route-stops / saved-routes): ĐỌC HỎNG ⇒ KHOÁ CỬA GHI (bản gốc còn nguyên),
// ghi qua `saveUserJson` và TRẢ false khi máy không giữ được — màn hình phải nói ra.

import { readUserList } from "@/lib/user-list-store";
import { saveUserJson } from "@/lib/user-store";
import { gioLuu } from "@/lib/offline-line";
import type { LoTrinhDaLuu } from "./types";

export const LO_TRINH_KEY = "forfish.routes.v1";

/** Trần số lộ trình giữ trong máy — danh sách đọc bằng mắt ở đầu `/lo-trinh`; đầy thì bỏ bản cũ nhất. */
export const MAX_LO_TRINH = 12;

let readFailed = false;

/** Lần đọc gần nhất có hỏng không — để màn hình nói thật. */
export function loTrinhReadFailed(): boolean {
  return readFailed;
}

function hopLe(r: unknown): r is LoTrinhDaLuu {
  const x = r as LoTrinhDaLuu;
  if (!x || typeof x.id !== "string" || typeof x.ten !== "string") return false;
  if (typeof x.taoLuc !== "string" || !Number.isFinite(Date.parse(x.taoLuc))) return false;
  if (!x.input || !x.ketQua) return false;
  const k = x.ketQua;
  if (!Array.isArray(k.moc) || !Array.isArray(k.lich) || !Array.isArray(k.vung)) return false;
  if (!k.moc.every((m) => m && Number.isFinite(m.lat) && Number.isFinite(m.lon))) return false;
  return typeof x.input.ngayDi === "string";
}

/** Mới tính nhất lên đầu. Bản ghi hỏng hình thì bỏ qua khi ĐỌC (không xoá khỏi kho). */
export function docLoTrinhDaLuu(): LoTrinhDaLuu[] {
  const r = readUserList<LoTrinhDaLuu>(LO_TRINH_KEY);
  readFailed = !r.ok;
  return (r.list ?? [])
    .filter(hopLe)
    .sort((a, b) => Date.parse(b.taoLuc) - Date.parse(a.taoLuc))
    .slice(0, MAX_LO_TRINH);
}

/** Ghi cả danh sách. `false` = KHÔNG giữ được (đọc hỏng ⇒ khoá ghi, hoặc máy hết chỗ). */
export function ghiLoTrinhDaLuu(list: LoTrinhDaLuu[]): boolean {
  if (readFailed) return false;
  return saveUserJson(LO_TRINH_KEY, list);
}

/** Thêm lên đầu; trùng id thì đè; quá trần thì bỏ bản CŨ NHẤT (không chặn bà con lưu cái đang cần). */
export function themLoTrinh(list: LoTrinhDaLuu[], rec: LoTrinhDaLuu): LoTrinhDaLuu[] {
  return [rec, ...list.filter((r) => r.id !== rec.id)].slice(0, MAX_LO_TRINH);
}

export function xoaLoTrinh(list: LoTrinhDaLuu[], id: string): LoTrinhDaLuu[] {
  return list.filter((r) => r.id !== id);
}

/**
 * Câu tuổi dữ liệu của một lộ trình: "Tính lúc HH:MM dd/MM · bản đồ cá lúc HH:MM dd/MM" — bản đồ cá
 * từ 1 ngày tuổi trở lên thì nói thẳng số ngày (§5c "tính từ bản đồ cá N ngày trước"); chưa đối
 * chiếu tin bão thì cũng nói. `nowMs` truyền vào để test được.
 */
export function cauTuoiLoTrinh(r: Pick<LoTrinhDaLuu, "taoLuc" | "tuoiDuLieu">, nowMs: number): string {
  const tao = Date.parse(r.taoLuc);
  const ca = r.tuoiDuLieu.ca ? Date.parse(r.tuoiDuLieu.ca) : NaN;
  const phan = [`Tính lúc ${gioLuu(tao)}`];
  phan.push(Number.isFinite(ca) ? `bản đồ cá lúc ${gioLuu(ca)}` : "chưa có bản đồ cá");
  if (!r.tuoiDuLieu.bao) phan.push("chưa đối chiếu tin bão");
  const ngayCu = Number.isFinite(ca) ? Math.floor((nowMs - ca) / 86_400_000) : 0;
  return phan.join(" · ") + (ngayCu >= 1 ? ` — bản đồ cá đã ${ngayCu} ngày, có sóng thì tính lại.` : "");
}

/** Tên gợi ý đời thường: "Quy Nhơn · 15 ngày · 02/11". */
export function tenLoTrinh(cangTen: string, soNgay: number, ngayDi: string): string {
  const [, m, d] = ngayDi.split("-");
  const ngay = m && d ? ` · ${d}/${m}` : "";
  return `${cangTen.replace(/^Cảng\s+/i, "")} · ${soNgay} ngày${ngay}`;
}
