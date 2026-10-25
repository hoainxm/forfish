// SEN BIỂN — HIỂU LỆNH CHỢ VẬT TƯ (thuần, có test, không mạng).
//
// Chủ dự án 2026-10-18: "toàn bộ thao tác sàn phải đảm bảo sen biển thực hiện". File này
// nghe câu → MỘT lệnh sàn kèm tham số (mã đơn, hẹn giao, nhà xe, lý do, số tiền, món, số
// lượng). Làm lệnh (gọi API, hỏi xác nhận) ở lam-cho.ts. Luật, không học máy: lệnh sàn cần
// TÁCH THAM SỐ chính xác (mã đơn, tiền) mà n-gram không làm được; n-gram vẫn lo phân ý chung.
//
// Phủ đủ thao tác của 3 vai trên sàn:
//   chủ tàu  : tìm món · thêm giỏ · xem giỏ · đặt hàng · đơn của tôi · hàng tới đâu ·
//              huỷ đơn · đã nhận hàng · báo đã chuyển khoản · gọi shop ·
//              đặt món chợ chưa có · xem báo giá · đồng ý báo giá · huỷ yêu cầu
//   chủ shop : đơn mới · xác nhận + hẹn giao · đi giao (nhà xe) · đã giao xong · dời hẹn ·
//              huỷ đơn (lý do) · đã nhận tiền
//   chủ sàn  : yêu cầu mới · báo giá (tiền hàng, phí giao, hẹn giao) · không tìm được (lý do)
import { extractQty, normalizeUtterance, vnNumberToInt } from "@/lib/assistant/normalize";
import { foldVn } from "@/lib/market/text";

export type LenhCho =
  | { k: "tim"; q: string }
  | { k: "them_gio"; q: string; qty: number }
  | { k: "xem_gio" }
  | { k: "dat_hang" }
  | { k: "don_xem"; ma?: string }
  | { k: "don_huy"; ma?: string; lyDo?: string; shop: boolean }
  | { k: "da_nhan"; ma?: string }
  | { k: "bao_chuyen"; ma?: string }
  | { k: "goi_shop"; ma?: string }
  | { k: "yc_moi"; q: string; qty: number; unit?: string }
  | { k: "yc_xem"; ma?: string }
  | { k: "yc_dong_y"; ma?: string }
  | { k: "yc_huy"; ma?: string }
  | { k: "shop_don_moi" }
  | { k: "shop_xac_nhan"; ma?: string; hen?: Hen }
  | { k: "shop_giao"; ma?: string; nhaXe?: string }
  | { k: "shop_da_giao"; ma?: string }
  | { k: "shop_doi_hen"; ma?: string; hen?: Hen }
  | { k: "shop_nhan_tien"; ma?: string }
  /** công tắc Tạm nghỉ bán (cơ cấu mới 2026-10-25; PATCH /api/ban-hang/shop {paused}) */
  | { k: "shop_tam_nghi" }
  | { k: "shop_mo_ban" }
  | { k: "san_yc_moi" }
  | { k: "san_bao_gia"; ma?: string; tienHang?: number; phiGiao?: number; hen?: Hen }
  | { k: "san_khong_tim_duoc"; ma?: string; lyDo?: string };

/** Hẹn giao = khoảng ngày tính từ HÔM NAY (0 = hôm nay). */
export type Hen = { tu: number; den: number };

/** Mã đơn "SD261018UY3Y" / mã yêu cầu "YC…" / 4 ký tự cuối ("đơn UY3Y"). Trả CHỮ HOA. */
export function tachMa(text: string, tienTo: "SD" | "YC"): string | undefined {
  const flat = foldVn(text).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const full = new RegExp(`${tienTo}\\d{6}[A-Z0-9]{4}`).exec(flat);
  if (full) return full[0];
  // "đơn UY3Y" / "yêu cầu 8W33" — 4 ký tự cuối, phải có ít nhất một CHỮ SỐ để không bắt nhầm chữ thường
  const words = foldVn(text).split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    const head = words[i];
    const w = words[i + 1].toUpperCase();
    if ((head === "don" || head === "ma" || head === "cau") && /^[A-Z0-9]{4}$/.test(w) && /\d/.test(w) && /[A-Z]/.test(w)) return w;
  }
  return undefined;
}

/** Hẹn giao trong câu (đã normalize): hôm nay · ngày mai · ngày kia · 2–3 ngày · tuần sau · N ngày. */
export function tachHen(n: string, folded?: string): Hen | undefined {
  // "hai ba ngày" phải đọc TRƯỚC khi chuẩn hoá — bộ đổi số gộp "hai ba" thành 3
  if (folded) {
    const w = /\b(mot|hai|ba|bon|nam|sau|bay)\s+(hai|ba|bon|nam|sau|bay|tam)\s+ngay\b/.exec(folded);
    if (w) {
      const a = vnNumberToInt(w[1]);
      const b = vnNumberToInt(w[2]);
      if (a != null && b != null && b > a) return { tu: a, den: b };
    }
  }
  if (/\bhom nay\b/.test(n)) return { tu: 0, den: 0 };
  if (/\bngay kia\b/.test(n)) return { tu: 2, den: 2 };
  if (/\bngay mai\b/.test(n)) return { tu: 1, den: 1 };
  if (/\b(tuan sau|trong tuan|1 tuan|mot tuan)\b/.test(n)) return { tu: 5, den: 7 };
  // "hai 3 ngay": bộ chuẩn hoá chỉ đổi từ số đứng NGAY trước "ngày" ⇒ số đầu có thể còn là chữ
  const r = /\b(\d{1,2}|mot|hai|ba|bon|nam|sau|bay)\s*(?:den|toi|-|hoac|)\s*(\d{1,2})\s*ngay\b/.exec(n);
  if (r) {
    const a = /^\d+$/.test(r[1]) ? Number(r[1]) : (vnNumberToInt(r[1]) ?? -1);
    const b = Number(r[2]);
    if (a >= 0 && b >= a && b <= 60) return { tu: a, den: b };
  }
  // "hai ba ngày" (chưa đổi số vì không có nhân tử)
  const w = /\b(mot|hai|ba|bon|nam|sau|bay)\s+(hai|ba|bon|nam|sau|bay|tam)\s+ngay\b/.exec(n);
  if (w) {
    const a = vnNumberToInt(w[1]);
    const b = vnNumberToInt(w[2]);
    if (a != null && b != null && b >= a) return { tu: a, den: b };
  }
  const one = /\b(\d{1,2})\s*ngay( nua)?\b/.exec(n);
  if (one) {
    const a = Number(one[1]);
    if (a >= 0 && a <= 60) return { tu: a, den: a };
  }
  return undefined;
}

const SO = "(?:\\d+(?:[.,]\\d+)?|(?:mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|muoi|muoi|tram|nua|linh|le)(?: (?:mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|muoi|tram|linh|le))*)";
function soTu(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const clean = t.replace(/\b(linh|le)\b/g, "").replace(/\s+/g, " ").trim();
  return vnNumberToInt(clean);
}

/**
 * Tiền nói miệng → đồng. "3 triệu 6" / "ba triệu sáu" = 3.600.000 · "3 triệu 650" = 3.650.000 ·
 * "năm mươi nghìn" / "50k" = 50.000 · "một triệu rưỡi" = 1.500.000. Lấy CỤM ĐẦU TIÊN từ `from`.
 */
export function tachTien(foldedText: string): number | undefined {
  const s = ` ${foldedText.replace(/\s+/g, " ")} `;
  const tr = new RegExp(`\\b(${SO}) trieu(?: (ruoi|${SO})(?: (nghin|ngan|k))?)?\\b`).exec(s);
  if (tr) {
    const a = soTu(tr[1]);
    if (a == null) return undefined;
    let v = a * 1_000_000;
    if (tr[2] === "ruoi") v += 500_000;
    else if (tr[2]) {
      const b = soTu(tr[2]);
      if (b != null) {
        if (tr[3]) v += b * 1000;
        else v += b < 10 ? b * 100_000 : b < 100 ? b * 10_000 : b < 1000 ? b * 1000 : 0;
      }
    }
    return Math.round(v);
  }
  const ng = new RegExp(`\\b(${SO}) ?(nghin|ngan|k)\\b`).exec(s);
  if (ng) {
    const a = soTu(ng[1]);
    return a == null ? undefined : Math.round(a * 1000);
  }
  return undefined;
}

/** Nhà xe / cách giao: "gửi xe Phương Trang" · "tự giao" · "gửi ra cảng". Giữ chữ gốc có dấu. */
function tachNhaXe(original: string): string | undefined {
  const m = /(tự giao|tự chở|gửi ra cảng|gửi xe(?: [^\s,.]+(?: [^\s,.]+)?)?|xe [A-ZĐ][^\s,.]*(?: [A-ZĐ][^\s,.]*)?)/i.exec(original);
  if (!m) return undefined;
  const t = m[1].trim();
  return t.charAt(0).toUpperCase() + t.slice(1, 40);
}

/** Lý do sau "vì / do / lý do là": giữ chữ gốc có dấu. */
function tachLyDo(original: string): string | undefined {
  // KHÔNG dùng \b quanh chữ có dấu ("vì") — JS coi "ì" là ngoài-từ nên \b không khớp
  const m = /(?:^|\s)(?:tại vì|lý do(?: là)?|vì|do)\s+(.+)$/i.exec(original);
  const t = m?.[1]?.trim().replace(/[.!?]+$/, "");
  return t && t.length >= 3 ? t.charAt(0).toUpperCase() + t.slice(1, 200) : undefined;
}

/** Phần món trong câu gốc (giữ dấu) — cắt đúng số từ như bản đã fold. */
function monGoc(original: string, foldedRest: string): string {
  const ow = original.trim().split(/\s+/);
  const n = foldedRest.trim().split(/\s+/).filter(Boolean).length;
  return n > 0 && n <= ow.length ? ow.slice(ow.length - n).join(" ") : foldedRest;
}

/**
 * Câu → lệnh sàn, hoặc null (không phải việc sàn — để Sen Biển hiểu theo đường khác).
 * Thứ tự kiểm: chủ sàn → chủ shop → yêu cầu đặt → đơn của chủ tàu → giỏ/tìm.
 */
export function hieuLenhCho(text: string): LenhCho | null {
  const goc = String(text ?? "").trim().slice(0, 300);
  const f = foldVn(goc);
  const n = normalizeUtterance(goc);
  if (!n) return null;
  const sd = tachMa(goc, "SD");
  const yc = tachMa(goc, "YC");
  const hen = tachHen(n, f);

  // ── CHỦ SÀN ────────────────────────────────────────────────────────────
  if (/\b(bao gia|gui gia|bao lai gia)\b/.test(f) && (/\b(phi giao|ship|trieu|nghin|ngan)\b/.test(f) || yc)) {
    const phi = /phi (?:giao|ship|van chuyen)\s+(.+?)(?:\s+(?:giao|hen)\b|$)/.exec(f);
    const hang = /(?:bao gia|gui gia|bao lai gia)(?:\s+(?:yeu cau|yc|ma)\s+\S+)?\s+(.+?)(?:\s+phi (?:giao|ship|van chuyen)\b|\s+(?:giao|hen)\b|$)/.exec(f);
    return {
      k: "san_bao_gia", ma: yc,
      tienHang: hang ? tachTien(hang[1]) : tachTien(f),
      phiGiao: /\b(mien phi|free) (giao|ship|van chuyen)\b|\bphi (giao|ship) (mien phi|khong dong|0 dong)\b/.test(f) ? 0 : phi ? tachTien(phi[1]) : undefined,
      hen,
    };
  }
  if (/\b(khong tim (duoc|ra|thay)|het hang ca|khong co hang)\b/.test(f) && /\b(yeu cau|yc|bao (ba con|khach))\b/.test(f))
    return { k: "san_khong_tim_duoc", ma: yc, lyDo: tachLyDo(goc) };
  if (/\b(yeu cau (dat hang )?(moi|nao|cho bao gia)|co (ai|bao nhieu nguoi) (dat|nho) (tim|gi)|bao nhieu yeu cau)\b/.test(f))
    return { k: "san_yc_moi" };

  // ── CHỦ SHOP ───────────────────────────────────────────────────────────
  if (/\bxac nhan (don|het|luon)\b|\bnhan don\b|\bchot don (cua khach|nay|do)\b/.test(f)) return { k: "shop_xac_nhan", ma: sd, hen };
  if (/\b(doi|lui|hen lai|doi lai|keo dai) (hen|ngay giao|lich giao)\b|\bhen lai\b/.test(f)) return { k: "shop_doi_hen", ma: sd, hen };
  if (/\b(da giao xong|giao xong( roi)?|giao toi noi roi|khach nhan roi|giao roi)\b/.test(f)) return { k: "shop_da_giao", ma: sd };
  if (/\b(bat dau giao|di giao|giao don|gui hang|gui xe|xuat hang|cho di giao)\b/.test(f)) return { k: "shop_giao", ma: sd, nhaXe: tachNhaXe(goc) };
  if (/\b(da nhan (duoc )?tien|tien ve roi|nhan du tien|tien da ve)\b/.test(f)) return { k: "shop_nhan_tien", ma: sd };
  // công tắc Tạm nghỉ bán / mở bán lại — "mở bán lại" xét trước vì "bán lại" cũng chứa "ban"
  if (/\b(mo ban lai|ban lai( roi)?|het nghi( roi)?|mo lai (gian hang|shop)|mo (gian hang|shop) lai|ban tiep|ngung nghi|nghi xong( roi)?|bo tam nghi|tat tam nghi|hoat dong lai)\b/.test(f)) return { k: "shop_mo_ban" };
  if (/\b(tam nghi( ban)?|nghi ban|dong (gian hang|shop)( tam| vai bua| may bua| it bua)?|tam dong( cua| gian hang)?|ngung ban( tam| vai bua)?|nghi (vai|may|it) bua|khong ban nua|treo bang nghi)\b/.test(f)) return { k: "shop_tam_nghi" };
  if (/\b(shop|cua hang)\b.*\b(co )?don (moi|cho)\b|\bdon (moi|cho xac nhan)\b.*\b(shop|khach)\b|\b(co|may) don moi\b|\bdon cho xac nhan\b/.test(f))
    return { k: "shop_don_moi" };
  if (/\bhuy don\b/.test(f) && /\b(cho khach|cua khach|het hang|khong giao|shop huy)\b/.test(f))
    return { k: "don_huy", ma: sd, lyDo: tachLyDo(goc), shop: true };

  // ── YÊU CẦU ĐẶT HÀNG (món chợ chưa có) ─────────────────────────────────
  if (/\b(dong y|chot|lay|dat theo|ok) (bao gia|gia do|gia nay)\b|\bdong y dat\b/.test(f)) return { k: "yc_dong_y", ma: yc };
  if (/\bhuy yeu cau\b/.test(f)) return { k: "yc_huy", ma: yc };
  if (/\b(co bao gia chua|bao gia (sao|chua|toi dau|the nao)|yeu cau (dat hang )?cua toi|xem (bao gia|yeu cau))\b/.test(f)) return { k: "yc_xem", ma: yc };
  const ycm = /\b(?:nho (?:chu san|san|sdvico) (?:tim|kiem|dat|mua)(?: giup| ho)?|yeu cau dat|dat (?:mon|hang) (?:khong co|ngoai cho|cho chua co|cho khong co)|tim mua giup|kiem giup|dat giup|dat ho|cho khong co)\s*(.*)$/.exec(n);
  if (ycm) {
    const rest = ycm[1].replace(/^(toi|minh|cho toi|mon|hang)\s+/, "").trim();
    const q = extractQty(rest);
    const mon = (q ? q.rest : rest).replace(/\s+(tren cho|o cho)$/, "").trim();
    if (mon.length >= 2) return { k: "yc_moi", q: monGoc(goc, mon), qty: q?.qty ?? 1, ...(q?.unit ? { unit: q.unit } : {}) };
    return { k: "yc_moi", q: "", qty: 1 };
  }

  // ── ĐƠN CỦA CHỦ TÀU ────────────────────────────────────────────────────
  if (/\b(da nhan (duoc )?hang|nhan hang roi|hang toi roi|hang ve roi|nhan du hang)\b/.test(f)) return { k: "da_nhan", ma: sd };
  if (/\b(da chuyen (khoan|tien)|bao (da )?chuyen khoan|chuyen khoan roi|ck roi)\b/.test(f)) return { k: "bao_chuyen", ma: sd };
  if (/\bhuy don\b/.test(f)) return { k: "don_huy", ma: sd, lyDo: tachLyDo(goc), shop: false };
  if (/\b(hang (toi dau|den dau|giao chua)|khi nao (giao|toi|co hang)|bao gio (giao|toi|co hang)|don (toi dau|den dau)|hen giao)\b/.test(f))
    return { k: "don_xem", ma: sd };
  if (/\bgoi (shop|cua hang|nguoi ban)\b/.test(n)) return { k: "goi_shop", ma: sd };

  // ── GIỎ / TÌM ──────────────────────────────────────────────────────────
  const gio = /\b(?:them|bo|cho|lay)\s+(.+?)\s+vao gio\b/.exec(n);
  if (gio) {
    const q = extractQty(gio[1]);
    const mon = (q ? q.rest : gio[1]).trim();
    if (mon.length >= 2) return { k: "them_gio", q: monGoc(goc.replace(/\s+vào giỏ.*$/i, ""), mon), qty: q?.qty ?? 1 };
  }
  if (/\b(dat hang luon|chot gio|thanh toan|dat het gio|dat hang)$/.test(n)) return { k: "dat_hang" };
  if (/\b(gio (hang )?(co gi|co nhung gi)|xem gio|trong gio)\b/.test(n)) return { k: "xem_gio" };
  return null;
}

/** Lệnh nào là việc GHI có hậu quả ⇒ phải bấm xác nhận một chạm trước khi làm (13 §4.3). */
export function canXacNhan(l: LenhCho): boolean {
  return ["don_huy", "da_nhan", "bao_chuyen", "yc_dong_y", "yc_huy", "shop_xac_nhan", "shop_giao", "shop_da_giao", "shop_doi_hen", "shop_nhan_tien", "shop_tam_nghi", "shop_mo_ban", "san_bao_gia", "san_khong_tim_duoc"].includes(l.k);
}

/*  CỔNG PHỤ n-gram (v4, 2026-10-18). Luật trên trả null mà bộ n-gram CHẮC đây là việc sàn ⇒ Sen Biển
    hỏi lại kèm MỘT câu mẫu luật hiểu được — không đoán làm hộ (việc sàn đa số là việc ghi, cần mã đơn,
    tiền, hẹn giao mà chỉ luật tách được). Câu mẫu phải qua đúng `hieuLenhCho` (test khoá). */
export const Y_CHO = [
  "don_huy", "da_nhan", "bao_chuyen", "yc_moi", "yc_xem", "yc_dong_y",
  "shop_xac_nhan", "shop_giao", "shop_da_giao", "shop_doi_hen", "shop_nhan_tien", "san_yc_moi", "san_bao_gia",
  "shop_tam_nghi", "shop_mo_ban",
] as const satisfies readonly LenhCho["k"][];
export type YCho = (typeof Y_CHO)[number];

/** Câu mẫu nói lại — viết đúng kiểu luật bắt, mã đơn mẫu đuôi 4 ký tự. */
export const CAU_MAU_CHO: Record<YCho, { viec: string; mau: string }> = {
  don_huy: { viec: "huỷ đơn", mau: "huỷ đơn UY3Y vì đặt nhầm" },
  da_nhan: { viec: "báo đã nhận hàng", mau: "đã nhận hàng đơn UY3Y" },
  bao_chuyen: { viec: "báo đã chuyển khoản", mau: "đã chuyển khoản đơn UY3Y" },
  yc_moi: { viec: "nhờ chủ sàn tìm món chợ chưa có", mau: "nhờ chủ sàn tìm 2 cuộn lưới cước" },
  yc_xem: { viec: "xem báo giá", mau: "có báo giá chưa" },
  yc_dong_y: { viec: "đồng ý báo giá", mau: "đồng ý báo giá" },
  shop_xac_nhan: { viec: "xác nhận đơn", mau: "xác nhận đơn UY3Y giao ngày mai" },
  shop_giao: { viec: "đi giao hàng", mau: "đi giao đơn UY3Y gửi xe Phương Trang" },
  shop_da_giao: { viec: "báo đã giao xong", mau: "đã giao xong đơn UY3Y" },
  shop_doi_hen: { viec: "dời hẹn giao", mau: "dời hẹn giao đơn UY3Y sang ngày kia" },
  shop_nhan_tien: { viec: "báo đã nhận tiền", mau: "đã nhận tiền đơn UY3Y" },
  san_yc_moi: { viec: "xem yêu cầu mới", mau: "có yêu cầu mới không" },
  san_bao_gia: { viec: "báo giá", mau: "báo giá 3 triệu 6 phí giao 50 nghìn giao 2 3 ngày" },
  shop_tam_nghi: { viec: "tạm nghỉ bán", mau: "tạm nghỉ bán vài bữa" },
  shop_mo_ban: { viec: "mở bán lại", mau: "mở bán lại" },
};

/** Độ tin n-gram từ đó mới coi là việc sàn — cùng mốc với hieu-y (NGRAM_CHAC). */
export const CHO_CHAC = 0.5;

/** n-gram ra ý sàn đủ chắc (và luật đã hụt) ⇒ câu hỏi lại kèm ví dụ; còn lại null. */
export function hoiLaiCho(y: string, conf: number): string | null {
  if (conf < CHO_CHAC || !(Y_CHO as readonly string[]).includes(y)) return null;
  const m = CAU_MAU_CHO[y as YCho];
  return `Bà con muốn ${m.viec} phải không? Nói rõ giúp, ví dụ: "${m.mau}".`;
}
