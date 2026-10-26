// KAIROS — AGENT GỢI Ý SẢN PHẨM SDVICO DƯỚI TIN BÁO HỢP (16 §4 2c, 14 §3.13; anh Long 2026-10-25: "các tin có thể dẫn
// tới sản phẩm của sd thì comment lồng vào giới thiệu sản phẩm sdvico" → "đội 2000 acc đó, comment nghệ thuật thông minh
// vào, nhẹ nhàng, tự nhiên"). THUẦN — máy GPU (scripts/kairos-agent.mjs qua agent-dieu-phoi) và route /api/kairos/agent
// dùng CHUNG (máy chủ chạy LẠI luật + kiểm lời, không tin máy GPU). .mjs vì Node trần không import được .ts có alias.
//
// GIỚI HẠN KHÔNG ĐỔI (chốt khi làm, 2026-10-25): agent CHƯA từng dùng sản phẩm nào ⇒ KHÔNG nói đã dùng/lắp/xài
// (đánh giá bịa — lừa người đọc, trái luật L3 spec 16); KHÔNG chê hãng/hàng khác; câu nhắc sản phẩm PHẢI có chữ
// "SDVICO" (người đọc biết hàng của ai — chấm AI của agent vẫn hiện); không link, không giá, không thêm tính năng ngoài
// dòng `y` (lấy đúng mô tả trong src/data/sdvico-showcase.ts, tài liệu SDVICO 2026-09-24). Tin có người chết / mất tích
// ⇒ không gợi ý bán hàng.

/** Tin buồn — bỏ qua dù khớp luật. */
const TIN_BUON = /tử vong|thiệt mạng|tử nạn|mất tích|thi thể|đột tử|chết đuối|qua đời|thương vong/;

/**
 * @typedef {{ sp: string, ten: string, y: string, re: RegExp }} LuatSdvico
 *   sp = id trong SDVICO_SHOWCASE · ten = tên gọi ngắn khi nói · y = MỘT dòng sự thật được phép nói (từ mô tả SP)
 */
/** @type {LuatSdvico[]} thứ tự = ưu tiên, một bài ⇒ một sản phẩm */
export const LUAT_SDVICO = [
  {
    sp: "thuraya-marine-star-mnb-01",
    ten: "điện thoại vệ tinh Thuraya MarineStar",
    y: "gọi điện qua vệ tinh ngay trên biển, có nút SOS riêng",
    re: /mất liên lạc|gặp nạn|trôi dạt|cứu nạn|cứu hộ|điện thoại vệ tinh|liên lạc vệ tinh|vùng lõm sóng/,
  },
  // Giám sát hành trình: CHỈ gợi ý Viettel S-Tracking, KHÔNG Vifish.24 (anh Long 2026-10-25: "stracking chứ ko dùng vifish")
  {
    sp: "gsht-viettel-s-tracking",
    ten: "thiết bị giám sát hành trình Viettel S-Tracking",
    y: "định vị GPS, truyền qua di động và vệ tinh; SDVICO lắp tận bến, hỗ trợ hồ sơ đăng ký",
    re: /\biuu\b|thẻ vàng|vượt ranh|vùng biển nước ngoài|xâm phạm vùng biển|khai thác bất hợp pháp|vùng cấm khai thác|ranh giới trên biển|giám sát hành trình|\bvms\b|thiết bị định vị|mất kết nối|hộp đen tàu/,
  },
  {
    sp: "app-ngu-dan-247",
    ten: "ứng dụng nhật ký khai thác Ngư dân 247",
    y: "ghi nhật ký chuyến biển ngay trên điện thoại, không cần sóng ngoài biển",
    re: /nhật ký khai thác|truy xuất nguồn gốc|xác nhận nguồn gốc|chứng nhận nguồn gốc|\becdt\b|sản lượng bốc dỡ/,
  },
  {
    sp: "may-loc-nuoc-bien-sea",
    ten: "máy lọc nước biển SEA-40",
    y: "lọc nước biển thành nước ngọt ngay trên tàu bằng màng RO",
    re: /nước ngọt|thiếu nước|khan nước|nước sinh hoạt/,
  },
  {
    sp: "phu-gia-adnano",
    ten: "phụ gia dầu AdNANO",
    y: "một chai 1 lít pha được 8.000 lít dầu, giúp dầu cháy triệt để, bớt khói",
    re: /giá dầu|giá xăng dầu|giá nhiên liệu|xăng dầu (tăng|giảm)|chi phí nhiên liệu|tiết kiệm nhiên liệu|tiêu hao nhiên liệu/,
  },
  {
    sp: "may-loc-dau-diesel-sf",
    ten: "máy lọc dầu SF50",
    y: "lọc cặn siêu nhỏ và tách nước khỏi dầu, giữ kim phun sạch",
    re: /kim phun|dầu lẫn nước|dầu bẩn|máy tàu hỏng|hỏng máy tàu|động cơ tàu/,
  },
  {
    sp: "son-tau-bien-pv-paint",
    ten: "sơn tàu PV Paint",
    y: "sơn chống hà, chống rỉ cho tàu cá, công nghệ Chugoku của Nhật",
    re: /đóng mới tàu|sửa chữa tàu|lên đà|vỏ tàu|hà bám|bảo dưỡng tàu/,
  },
];

/** Trần cả đội: số bình luận gợi ý SDVICO / 24 giờ (không ngập dòng tin bằng quảng bá). */
export const TRAN_SDVICO_NGAY = 6;
/** Chỉ bài báo trong chừng này giờ. */
export const TUOI_TOI_DA_GIO = 48;
/** Mỗi lượt 10 phút tối đa chừng này việc gợi ý. */
export const MOI_LUOT = 1;

const chuThuong = (s) => String(s ?? "").normalize("NFC").toLowerCase();

/**
 * Bài báo (tiêu đề + tóm tắt) ⇒ luật sản phẩm hợp; không hợp / tin buồn ⇒ null.
 * @param {string} text
 * @returns {LuatSdvico | null}
 */
export function chonSanPham(text) {
  const t = chuThuong(text);
  if (!t.trim() || TIN_BUON.test(t)) return null;
  return LUAT_SDVICO.find((x) => x.re.test(t)) ?? null;
}

/** Nhận đã dùng / đã lắp / đã mua — agent chưa từng dùng ⇒ cấm (có dấu + không dấu, các kiểu xưng hô). */
export const NHAN_DA_DUNG =
  /(tui|tôi|toi|mình|minh|tao|em|anh|chú|chu|bác|bac|nhà tui|nha tui|ghe tui|tàu tui|tau tui|tàu mình|tau minh|bên tui|ben tui)\s+(cũng\s+|cung\s+|đã\s+|da\s+|mới\s+|moi\s+|có\s+|co\s+)?(dùng|dung|xài|xai|lắp|lap|gắn|gan|mua|sắm|sam|thử|thu|chạy|chay)(?=[\s,.!?]|$)|(đã|da)\s+(dùng|dung|xài|xai|lắp|lap|mua|thử|thu)\s+(rồi|roi|qua)|dùng thấy|dung thay|xài thấy|xai thay|dùng rồi|xài rồi|lắp rồi/i;
/** Chê hàng / hãng khác. */
export const CHE_KHAC = /(hãng|hang|hàng|loại|loai|bên|ben|đồ|do)\s+(khác|khac)|đồ dỏm|do dom|hàng dỏm|hang dom|hàng nhái|hang nhai|thua xa|không bằng|khong bang|tệ hơn|te hon/i;

/**
 * Kiểm lời gợi ý của agent. Lỗi ⇒ mã; ổn ⇒ null.
 * @param {string} body
 * @returns {"thieu_sdvico" | "nhan_da_dung" | "che_hang_khac" | null}
 */
export function loiGoiY(body) {
  const t = String(body ?? "");
  if (!/sdvico/i.test(t)) return "thieu_sdvico";
  if (NHAN_DA_DUNG.test(t)) return "nhan_da_dung";
  if (CHE_KHAC.test(t)) return "che_hang_khac";
  return null;
}

/**
 * Bài báo ứng viên trong dòng tin (máy GPU): báo, còn mới, hợp luật, trong 2 bình luận nổi chưa ai nhắc SDVICO.
 * Máy chủ kiểm lại đủ (toàn bộ bình luận).
 * @param {{ id: string, kind: string, title?: string|null, summary?: string|null, body?: string, publishedAt: string,
 *   topComments?: { body?: string }[] }[]} feed
 * @param {number} now
 * @param {number} [toiDa]
 * @returns {{ post: (typeof feed)[number], luat: LuatSdvico }[]}
 */
export function ungVienSdvico(feed, now, toiDa = MOI_LUOT) {
  const out = [];
  for (const p of feed) {
    if (out.length >= toiDa) break;
    if (p.kind !== "bao") continue;
    const t = Date.parse(p.publishedAt);
    if (!Number.isFinite(t) || now - t > TUOI_TOI_DA_GIO * 3_600_000) continue;
    if ((p.topComments ?? []).some((c) => /sdvico/i.test(c.body ?? ""))) continue;
    const luat = chonSanPham(`${p.title ?? ""}\n${p.summary ?? p.body ?? ""}`);
    if (luat && !out.some((x) => x.post.id === p.id)) out.push({ post: p, luat });
  }
  return out;
}
