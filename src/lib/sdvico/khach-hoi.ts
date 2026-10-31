// SDVICO TRỰC KHÁCH TRÊN SDFISH (14 §3.14, migration 0072; anh Long 2026-10-25: "tổ chức luôn 1 agent để trực trên sdfish,
// nếu có người hỏi thăm về sản phẩm hoặc đặt thì nhận và sau đó chuyển vào Zalo công ty nhắn cho nhóm KD SDVico… trước đó
// bot phải làm rõ được các thông số cơ bản như sđt, số tàu, lắp ở cảng nào"). THUẦN — có test.
//
// Luồng: bà con (người thật) bình luận / đăng bài hỏi mua, hỏi giá, muốn đặt một sản phẩm SDVICO ⇒ hội thoại trực (0073)
// ⇒ bộ trực trên GPU (Claude, tu-van.mjs) tư vấn ngay trong luồng, hỏi dần số tàu + cảng lắp (KHÔNG hỏi SĐT — tài khoản là
// SĐT) ⇒ đủ thì máy chủ lập phiếu sdvico_khach_hoi ⇒ AI Assistant lấy phiếu, nhắn nhóm Zalo KD.

import { khuyenMaiCuaPhieu, soLuongTuLoiNhan, tienVn } from "@/data/khuyen-mai";
import { SDVICO_SHOWCASE } from "@/data/sdvico-showcase";
import { foldVn } from "@/lib/market/text";
import { isValidVnPhone, normalizeVnPhone } from "@/lib/phone";

export type NguonPhieu = "kairos" | "san-pham" | "sen-bien";

/** Tên gọi bà con hay nói ⇒ sản phẩm (đã bỏ dấu). Thứ tự = ưu tiên (tên riêng trước, tên chung sau). */
const TEN_GOI: { re: RegExp; id: string }[] = [
  { re: /thuraya|marine ?star|dien thoai ve tinh|xt ?pro/, id: "thuraya-marine-star-mnb-01" },
  { re: /s ?tracking|viettel|giam sat hanh trinh|hop den|\bvms\b|dinh vi tau/, id: "gsht-viettel-s-tracking" },
  { re: /adnano|phu gia/, id: "phu-gia-adnano" },
  { re: /loc nuoc|sea ?40|sea ?250|nuoc ngot/, id: "may-loc-nuoc-bien-sea" },
  { re: /loc dau|sf ?50|sf ?300/, id: "may-loc-dau-diesel-sf" },
  { re: /nano graphene|pv engine|nhot/, id: "pv-engine-rmi-nano-graphene" },
  { re: /ac quy|globe|wpm/, id: "ac-quy-globe-wpm-220" },
  { re: /son tau|pv paint|son chong ha/, id: "son-tau-bien-pv-paint" },
  { re: /ngu dan 247|nhat ky (khai thac|dien tu)/, id: "app-ngu-dan-247" },
];

/** Sản phẩm SDVICO nhắc tới trong câu; không có ⇒ null. */
export function timSanPham(text: string): { id: string; title: string; image: string } | null {
  const f = ` ${foldVn(text)} `;
  const t = TEN_GOI.find((x) => x.re.test(f));
  const sp = t ? SDVICO_SHOWCASE.find((p) => p.id === t.id) : null;
  return sp ? { id: sp.id, title: sp.title, image: sp.image } : null;
}

/** Ý hỏi mua / hỏi giá / muốn đặt / muốn lắp (đã bỏ dấu — bà con gõ đủ kiểu). */
const HOI_MUA =
  /gia (bao nhieu|nhieu|sao|the nao|ca)|bao nhieu (tien|1 cai|mot cai|1 bo|mot bo)|nhieu tien|mua (o dau|duoc khong|dc ko|dc k|sao|nhu the nao)|o dau ban|ban khong|ban ko|co ban|dat (mua|hang|lap)|muon (mua|dat|lap|gan|hoi|tu van)|lap (o dau|cho tau|duoc khong|dc ko)|tu van|lien he|xin (gia|so|sdt|thong tin)|con hang|ship|giao (hang|toi)|bao hanh (sao|may)|tra gop|\binbox\b|\bib\b|de lai so|goi (lai|cho) (tui|toi|minh|em)/;

/** Câu có ý hỏi mua không. */
export function laHoiMua(text: string): boolean {
  return HOI_MUA.test(` ${foldVn(text)} `);
}

/**
 * Câu này SDVICO có nên trực trả lời không: có ý hỏi mua VÀ (nhắc sản phẩm SDVICO, HOẶC đang hỏi trong luồng mà trên đó
 * có nhắc SDVICO — vd trả lời gợi ý của agent "bên SDVICO có S-Tracking đó"). `ngữCảnh` = chữ bình luận gốc / bài.
 */
export function canTruc(text: string, nguCanh = ""): { sp: ReturnType<typeof timSanPham> } | null {
  if (!laHoiMua(text)) return null;
  const sp = timSanPham(text) ?? (/sdvico/i.test(nguCanh) || /sdvico/i.test(text) ? timSanPham(nguCanh) : null);
  if (sp) return { sp };
  return /sdvico/i.test(text) || /sdvico/i.test(nguCanh) ? { sp: null } : null;
}

export interface PhieuKhach {
  nguon: NguonPhieu;
  sanPham: string | null;
  ten: string;
  phone: string;
  soTau: string;
  cang: string;
  loiNhan: string | null;
  kairosPostId: string | null;
  kairosCommentId: string | null;
}

export type LoiPhieu = "thieu_ten" | "sai_sdt" | "thieu_so_tau" | "thieu_cang" | "qua_dai" | "sai_nguon";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sach = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** Kiểm phiếu ở RANH GIỚI (route). Đủ SĐT hợp lệ + số tàu + cảng mới nhận — đúng ý "làm rõ thông số cơ bản". */
export function kiemPhieu(raw: unknown): { ok: true; value: PhieuKhach } | { ok: false; code: LoiPhieu } {
  if (!raw || typeof raw !== "object") return { ok: false, code: "thieu_ten" };
  const r = raw as Record<string, unknown>;
  const nguon = r.nguon ?? "kairos";
  if (nguon !== "kairos" && nguon !== "san-pham" && nguon !== "sen-bien") return { ok: false, code: "sai_nguon" };
  const ten = sach(r.ten, 80);
  if (!ten) return { ok: false, code: "thieu_ten" };
  const phoneRaw = typeof r.phone === "string" ? r.phone : "";
  if (!isValidVnPhone(phoneRaw)) return { ok: false, code: "sai_sdt" };
  const soTau = sach(r.soTau, 30);
  if (!soTau || soTau.length < 3) return { ok: false, code: "thieu_so_tau" };
  const cang = sach(r.cang, 80);
  if (!cang || cang.length < 2) return { ok: false, code: "thieu_cang" };
  if (typeof r.loiNhan === "string" && r.loiNhan.length > 500) return { ok: false, code: "qua_dai" };
  const spId = typeof r.sanPham === "string" ? r.sanPham : null;
  const sp = spId ? SDVICO_SHOWCASE.find((p) => p.id === spId || p.title === spId) : null;
  return {
    ok: true,
    value: {
      nguon,
      sanPham: sp?.title ?? sach(r.sanPham, 120),
      ten,
      phone: normalizeVnPhone(phoneRaw),
      soTau,
      cang,
      loiNhan: sach(r.loiNhan, 500),
      kairosPostId: typeof r.kairosPostId === "string" && UUID.test(r.kairosPostId) ? r.kairosPostId.toLowerCase() : null,
      kairosCommentId: typeof r.kairosCommentId === "string" && UUID.test(r.kairosCommentId) ? r.kairosCommentId.toLowerCase() : null,
    },
  };
}

/*  ĐƠN CHỢ CỦA GIAN HÀNG SDVICO ⇒ PHIẾU ⇒ NHÓM ZALO KD (2026-10-31, anh Long: "ghi giá vào đi phải có giá" + "đưa luồng vô
    chỗ khách đk luôn đưa qua nhóm kd"). Hàng SDVICO nay có giá trong chợ ⇒ bà con đặt qua giỏ; đơn vẫn phải tới KD để gọi
    xác nhận, hẹn lắp — nên `api/cho/don` lập thêm một phiếu `sdvico_khach_hoi` (san_pham = "Đơn chợ SDVICO <mã>") và
    AI Assistant chuyển nhóm "Triển Khai Kinh Doanh" như phiếu đăng ký. Đơn chợ không có số tàu ⇒ ghi "chưa ghi" (cột bắt
    buộc ≥3 chữ), KD hỏi khi gọi. */
export const DAU_DON_CHO = "Đơn chợ SDVICO ";
export const CHAT_KD = "Triển Khai Kinh Doanh";

export function laDonCho(sanPham: string | null | undefined): boolean {
  return !!sanPham && sanPham.startsWith(DAU_DON_CHO);
}

/** Chat Zalo nhận phiếu: ưu đãi có `guiToi` / đơn chợ ⇒ nhóm KD; còn lại null (AI Assistant gửi chat mặc định). */
export function chatCuaPhieu(sanPham: string | null | undefined): string | null {
  return khuyenMaiCuaPhieu(sanPham)?.guiToi ?? (laDonCho(sanPham) ? CHAT_KD : null);
}

type DonCho = {
  code: string;
  buyerPhone: string;
  items: { title: string; variantLabel?: string; qty: number; lineTotalVnd: number }[];
  totalVnd: number;
  paymentMethod: string;
  address: { name: string; phone: string; province: string; detail: string };
  buyerNote?: string;
};

/** Dòng phiếu từ một đơn chợ SDVICO — THUẦN; null khi không lập được (SĐT hỏng). Vừa đúng ràng buộc cột 0072. */
export function phieuDonCho(o: DonCho): {
  nguon: "san-pham"; san_pham: string; ten: string; phone: string; so_tau: string; cang: string; loi_nhan: string;
} | null {
  const sdt = isValidVnPhone(o.address.phone) ? o.address.phone : o.buyerPhone;
  if (!isValidVnPhone(sdt)) return null;
  const hang = o.items.map((i) => `${i.qty} × ${i.title}${i.variantLabel ? ` (${i.variantLabel})` : ""} ${tienVn(i.lineTotalVnd)}`).join("; ");
  const tra = o.paymentMethod === "chuyen_khoan" ? "chuyển khoản" : "trả khi nhận";
  const ghi = o.buyerNote?.trim() ? ` · khách ghi: ${o.buyerNote.trim()}` : "";
  return {
    nguon: "san-pham",
    san_pham: `${DAU_DON_CHO}${o.code}`.slice(0, 120),
    ten: (o.address.name.trim() || "Khách SDFish").slice(0, 80),
    phone: normalizeVnPhone(sdt),
    so_tau: "chưa ghi",
    cang: `${o.address.detail.trim()}, ${o.address.province.trim()}`.slice(0, 80),
    loi_nhan: `${hang} · Tổng ${tienVn(o.totalVnd)} · ${tra}${ghi}`.slice(0, 500),
  };
}

/** Tin nhắn cho nhóm Zalo KD SDVICO (AI Assistant gửi nguyên văn). Chữ thường, không emoji.
 *  Phiếu ĐĂNG KÝ KHUYẾN MÃI (`san_pham` = `KhuyenMai.tenPhieu`, 2026-10-26) ⇒ đầu tin "ĐĂNG KÝ MUA KM" + giá + số lượng,
 *  "Cảng lắp" thành "Nhận tại" — Quân đọc một dòng là biết đơn hàng, không lẫn với khách hỏi thường. */
export function tinNhanKd(p: PhieuKhach & { createdAt: string }, linkBinhLuan: string | null): string {
  const gio = new Date(p.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
  const km = khuyenMaiCuaPhieu(p.sanPham);
  const nguon = p.nguon === "kairos" ? "Kairos" : p.nguon === "san-pham" ? (km ? "thẻ khuyến mãi trong app" : "trang sản phẩm") : "Sen Biển";
  if (laDonCho(p.sanPham)) {
    return [
      `[SDFish] ĐƠN CHỢ SDVICO ${p.sanPham!.slice(DAU_DON_CHO.length)} — gọi xác nhận, hẹn lắp`,
      `- Tên: ${p.ten}`,
      `- SĐT: ${p.phone}`,
      `- Giao tới: ${p.cang}`,
      p.loiNhan ? `- Hàng: ${p.loiNhan}` : null,
      `- Nguồn: Chợ vật tư lúc ${gio}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (km) {
    const sl = soLuongTuLoiNhan(p.loiNhan);
    return [
      km.giaThiTruong != null
        ? `[SDFish] ĐĂNG KÝ MUA KM: ${km.ten} ${tienVn(km.giaApp)} (giá thị trường ${tienVn(km.giaThiTruong)})`
        : `[SDFish] ĐĂNG KÝ MUA: ${km.ten}${km.bienThe?.length ? "" : ` ${tienVn(km.giaApp)}`}`,
      `- Tên: ${p.ten}`,
      `- SĐT: ${p.phone}`,
      `- Số tàu: ${p.soTau}`,
      `- Nhận tại: ${p.cang}`,
      sl ? `- Số lượng: ${sl}` : null,
      p.loiNhan ? `- Khách ghi: ${p.loiNhan}` : null,
      `- Nguồn: ${nguon} lúc ${gio}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `[SDFish] Khách hỏi ${p.sanPham ?? "sản phẩm SDVICO"}`,
    `- Tên: ${p.ten}`,
    `- SĐT: ${p.phone}`,
    `- Số tàu: ${p.soTau}`,
    `- Cảng lắp: ${p.cang}`,
    p.loiNhan ? `- Khách nhắn: ${p.loiNhan}` : null,
    `- Nguồn: ${nguon} lúc ${gio}`,
    linkBinhLuan ? `- Bình luận: ${linkBinhLuan}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Trần: SDVICO trực trả lời một người tối đa chừng này lần / 24 giờ (không đeo bám). */
export const TRUC_MOI_NGUOI_NGAY = 2;
