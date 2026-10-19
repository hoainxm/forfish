// TRỢ LÝ — DỮ LIỆU CHO BỘ HIỂU Ý (thuần, 14 §4.2). Chỉ bảng: từ khoá chặn,
// mẫu điều khiển, cụm tên màn, từ khoá chấm điểm, từ khoá câu hỏi mở. Thuật
// toán nằm ở parse.ts. Mọi regex chạy trên chuỗi ĐÃ normalizeUtterance.

import type { Intent, ScreenTarget } from "./types";

/* ───────────────── 0. CHẶN TRƯỚC (13 INT-26, AC-T06) ───────────────── */

export type BlockReason = "y_te" | "phap_ly" | "tien" | "tra_nguoi" | "khac";

/** Khớp bất kỳ → `ngoai_pham_vi`, KHÔNG BAO GIỜ lên máy chủ. Thứ tự = ưu tiên
 *  câu trả lời (y tế nói số 115, tra người chỉ về màn Bạn thuyền). */
export const BLOCKLIST: { reason: BlockReason; re: RegExp }[] = [
  { reason: "y_te", re: /\b(uong (gi|thuoc)|thuoc gi|thuoc (say|dau|cam|ho)|say song|dau bung|dau dau|nhuc dau|bi benh|bi om|bi sot|chong mat|cap cuu|bac si|benh vien|tram y te|ngo doc|bi thuong|chay mau|kham benh)\b/ },
  { reason: "phap_ly", re: /\b(phat bao nhieu|bi phat|muc phat|xu phat|tien phat|bi bat|kien (tung|ai)|toa an|luat su|thua kien|vi pham (gi|nao)|bi tich thu)\b/ },
  { reason: "tien", re: /\b(vay (tien|von|nong|ngan hang|o dau)|ngan hang|lai suat|dau tu|chung khoan|co phieu|tin dung|the chap|cam co|vay muon|xin vay|cho vay)\b/ },
  { reason: "tra_nguoi", re: /\b(tra (can cuoc|cccd|cmnd|nguoi|thong tin|so cua)|(can cuoc|cccd|cmnd) so|(can cuoc|cccd|cmnd)\b.*\b\d{4,}|tim (thong tin|dia chi) (nguoi|cua)|so dien thoai cua (anh|chi|ong|ba|thang|nguoi)|dia chi nha cua)\b/ },
  { reason: "khac", re: /\b(chinh tri|bau cu|bieu tinh|quoc hoi|chinh phu|thu tuong|chu tich nuoc|ke chuyen|chuyen cuoi|hat (bai|cho|di|mot)|hat di|doc tho|ke (toi|cho toi|cho tui) nghe|noi chuyen choi|tan gau)\b/ },
];

/* ───────────────── 1. ĐIỀU KHIỂN (khớp toàn câu) ───────────────── */

export const CONTROL: { intent: Intent; re: RegExp }[] = [
  { intent: "tat_tieng", re: /^(im|im di|im lang|im mieng|tat tieng|tat loa|dung noi|khoi doc|thoi noi|dung doc|khong doc nua|tat doc)$/ },
  { intent: "bat_tieng", re: /^(bat tieng|bat loa|noi di|doc di|doc len|bat doc|noi lai di|mo tieng|noi len|doc to len|noi to len)$/ },
  { intent: "lap_lai", re: /^(noi lai|nhac lai|doc lai|gi co|nghe lai|noi lai lan nua|lap lai|noi lai cai|hoi lai cau truoc|cau truoc)$/ },
  { intent: "tro_giup", re: /^((bac|may|ban|em|toi|tro ly) )?(noi|lam|hoi|giup|tra loi)( duoc| dc)? (gi|cai gi|nhung gi)( duoc| dc)?( khong)?$|^(tro giup|huong dan|chi toi cach dung|chi cach dung|giup toi|giup|hoi gi duoc|hoi gi|cach dung|dung sao|dung the nao)$/ },
  { intent: "chao_hoi", re: /^(alo|a lo|chao|xin chao|chao bac|chao em|cam on|cam on nhieu|cam on nha|cam on ban|cam on nhe|da|o|u ha|hello|hi|hey)$/ },
];

/** "ừ / được / đồng ý" — chỉ có nghĩa khi đang chờ xác nhận. */
export const YES_RE = /^(u|uh|um|ok|oke|okie|duoc|dc|dong y|chot|lam|lam di|dung roi|dung|phai|phai roi|ua|u dung|da|da duoc|duoc roi|chot di|goi di|them di|xac nhan|dong y di|ok di)$/;
/** "thôi / không / bỏ" — tu_choi khi đang chờ; thoi/dung/huy khi không chờ = huy. */
export const NO_RE = /^(thoi|khong|bo|dung|huy|thoi di|khong can|dung lai|thoi khoi|bo di|huy di|khong phai|thoi vay|dung roi thoi|thoi khong)$/;
/** Không chờ gì mà nói mấy chữ này = đóng trợ lý. */
export const CLOSE_RE = /^(thoi|dung|dung lai|huy|dong|thoat|dong lai|tat|thoi di|dong tro ly|tat tro ly|thoi khoi|nghi)$/;

/* ───────────────── 2. HÀNH ĐỘNG CÓ HẬU QUẢ — KHÔNG CÓ Ý ĐỊNH (13 P8, AC-T45) ───────────────── */

/** Nói tới thì chỉ đường tới màn (followUp), KHÔNG làm. */
export const DESTRUCTIVE: { re: RegExp; goto: Intent }[] = [
  { re: /\b(huy|xoa|bo) (don|hang)\b|\bhuy don\b/, goto: "don_cua_toi" },
  { re: /\b(dat hang|dat mua|dat luon|mua luon|thanh toan|tra tien|chuyen khoan|dat don)\b/, goto: "xem_gio" },
  { re: /\b(da nhan|nhan hang roi|danh gia|cham sao)\b/, goto: "don_cua_toi" },
  { re: /\b(xoa|bo|huy) (giay|dang kiem|bao hiem|chung chi|giay phep)\b/, goto: "giay_to" },
  { re: /\b(xoa|bo|huy) (tau|thuyen)\b/, goto: "tau_cua_toi" },
  { re: /\b(xoa|bo|huy) (thuyen vien|ban thuyen|nguoi|anh|chu)\b/, goto: "thuyen_vien" },
  { re: /\b(xoa|bo|huy) (diem|cho|bai)\b/, goto: "dan_duong" },
  // "đăng tin bán cá" = INT-19 mở màn Giao dịch (13 §3.3) — chỉ chặn gửi/nhắn cho người
  { re: /\b(gui tin|nhan tin cho|gui cho|dang bai)\b/, goto: "tin_mua_ban" },
  { re: /\b(dang xuat|doi mat khau|xoa tai khoan|thoat tai khoan)\b/, goto: "mo_man" },
];

/* ───────────────── 3. CÂU HỎI MỞ (13 INT-25) ───────────────── */

/** Chỉ báo MẠNH: gặp là đi thẳng online (không qua "không hiểu"), trước cả mẫu thời tiết. */
export const OPEN_STRONG = /\b(tai sao|vi sao|sao (gia|dau|ca|nam nay|mua nay)|kinh nghiem|so sanh|khac gi|khac nhau|giai thich|lam sao|cach (nao|bao quan|lam|xu ly|chon|nhan biet|sua|giu|tranh)|nao tot|loai nao|mua nay|tot hon|co tot khong|bao quan|nao duoc gia|nen (mua|xai|dung|chon|lam|thay) (gi|loai|cai|nhot|dau|luoi|may)|mua nao|thang nao|nghia la gi|la gi|co nghia)\b|^sao\b/;
/** Chỉ báo YẾU: chỉ dùng khi KHÔNG mẫu nào khớp (bậc 3). */
export const OPEN_WEAK = /\b(the nao|nen|cach|nao|tot|nhu the nao|ra sao|hay khong|co nen)\b/;

/* ───────────────── 4. MÀN (INT-20) ───────────────── */

/** Cụm (đã fold) → màn. Cụm dài đứng trước để khớp trước. */
export const SCREEN_PHRASES: [string, ScreenTarget][] = [
  ["kenh nguoi ban", "ban_hang"], ["ban hang", "ban_hang"], ["nguoi ban", "ban_hang"],
  ["tu giay to", "giay_to"], ["giay to", "giay_to"], ["giay phep", "giay_to"], ["tab giay to", "giay_to"],
  ["so bao duong", "bao_duong"], ["bao duong", "bao_duong"], ["dich vu", "bao_duong"],
  ["san pham", "san_pham"], ["do sdvico", "san_pham"], ["cua hang sdvico", "san_pham"], ["do da mua", "san_pham"],
  ["ban thuyen", "ban_thuyen"], ["thuyen vien", "ban_thuyen"], ["so thuyen vien", "ban_thuyen"], ["nguoi", "ban_thuyen"],
  ["giao dich", "giao_dich"], ["cho ca", "giao_dich"], ["tin mua ban", "giao_dich"], ["bang gia", "giao_dich"], ["mua ban", "giao_dich"], ["ban ca", "giao_dich"],
  ["cua hang vat tu", "cho"], ["cua hang", "cho"], ["cho vat tu", "cho"], ["vat tu", "cho"], ["cho", "cho"], ["tiem", "cho"], ["tim mon", "cho"], ["mua sam", "cho"],
  ["gio hang", "gio_hang"], ["gio", "gio_hang"],
  ["don cua toi", "don_hang"], ["don", "don_hang"], ["dang giao", "don_hang"],
  ["trang chu", "trang_chu"], ["trang dau", "trang_chu"], ["man chinh", "trang_chu"], ["nha", "trang_chu"], ["man dau", "trang_chu"],
  ["hop thu", "hop_thu"], ["tin nhan", "hop_thu"], ["thong bao", "hop_thu"], ["tin moi", "hop_thu"],
  ["danh sach cang", "cang_ca"], ["cang ca", "cang_ca"], ["cang", "cang_ca"],
  ["huong dan", "huong_dan"], ["cach dung", "huong_dan"],
  ["ra khoi", "ra_khoi"], ["ngu truong", "ra_khoi"], ["ban do", "ra_khoi"], ["ra bien", "ra_khoi"], ["di bien", "ra_khoi"], ["thoi tiet", "ra_khoi"], ["du bao", "ra_khoi"],
  ["tau ca", "tau"], ["tau cua toi", "tau"], ["tau toi", "tau"], ["tau", "tau"],
];

export const SCREEN_LABEL: Record<ScreenTarget, string> = {
  trang_chu: "Trang chủ",
  ra_khoi: "Bản đồ",
  tau: "Tàu tôi",
  giay_to: "Giấy tờ",
  bao_duong: "Sổ bảo dưỡng",
  san_pham: "Sản phẩm",
  ban_thuyen: "Bạn thuyền",
  giao_dich: "Chợ cá",
  cho: "Vật tư",
  gio_hang: "Giỏ hàng",
  don_hang: "Đơn hàng",
  ban_hang: "Bán hàng",
  hop_thu: "Hộp thư",
  cang_ca: "Cảng cá",
  huong_dan: "Hướng dẫn",
};

/** Động từ mở màn (13 §3 ưu tiên #6: chỉ khi có động từ + tên màn). */
export const OPEN_VERBS = "mo|vao|vo|qua|xem|di toi|toi|ve|chuyen sang|mo man|chuyen qua|bam vao|bam|vao lai|mo lai|len|xuong";

/* ───────────────── 5. TỪ KHOÁ CHẤM ĐIỂM (bậc 3) ───────────────── */

export const KEYWORDS: Partial<Record<Intent, string[]>> = {
  thoi_tiet: ["thoi tiet", "song", "gio", "mua", "bien", "troi", "em", "dong", "diem", "nang"],
  bao: ["bao", "ap thap", "atnd", "bao so"],
  con_nuoc: ["con nuoc", "nuoc", "thuy trieu", "nuoc lon", "nuoc rong", "trieu"],
  dan_duong: ["dan duong", "chi duong", "diem", "toi", "ve cang"],
  dat_cang_nha: ["cang nha", "cang", "hay di tu"],
  giay_to: ["giay", "giay to", "han", "dang kiem", "bao hiem", "chung chi", "giay phep"],
  bao_duong: ["bao duong", "nhot", "loc", "may", "ky", "han"],
  thuyen_vien: ["thuyen vien", "ban thuyen", "nguoi", "ai"],
  tau_cua_toi: ["tau", "so hieu", "doi tau"],
  tim_mon: ["mua", "tim", "kiem", "ban", "cho", "mon", "hang"],
  them_gio: ["them", "gio", "bo vo"],
  xem_gio: ["gio", "gio hang"],
  don_cua_toi: ["don", "hang", "giao", "ship", "shop"],
  gia_ca: ["gia", "ca", "tom", "muc", "ky", "ngan"],
  gia_dau: ["gia dau", "dau", "lit"],
  tin_mua_ban: ["mua ban", "thu mua", "vua", "ban ca", "tin"],
  goi_shop: ["goi", "shop", "cua hang", "dai ly"],
  goi_sdvico: ["goi", "sdvico", "cong ty", "tong dai"],
  mo_man: ["mo", "vao", "qua", "man"],
  hop_thu: ["hop thu", "tin", "thong bao", "tin nhan"],
};

/** Tên loài cá hay hỏi giá (đã fold) — để tách slot species khỏi câu thường. */
export const SPECIES_WORDS = /\b(ca ngu( dai duong)?|ca thu|ca com|ca nuc|ca chim|ca bop|ca mu|ca hong|ca dua|ca kem|ca thu|ca de|ca chuon|ca sop|ca bac ma|ca trich|ca ngan|ca ho|ca lieng|ca chim trang|ca hanh|ca doi|ca dieu hong|muc( ong| la| nang| trung| khoi)?|tom( hum| su| the| dat| bac)?|ghe|cua( bien| gach)?|oc( huong)?|so diep|so huyet|ngheu|hau|ca)\b/;
