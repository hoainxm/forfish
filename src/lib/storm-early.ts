// Trục 1 — CẢNH BÁO SỚM: vùng áp thấp có khả năng MẠNH LÊN thành áp thấp nhiệt
// đới / bão (nguồn NCHMF, 2026-09-09).
//
// ═══ VÌ SAO CÓ FILE NÀY ═══
//
// `storms.ts`/`storms-vn.ts` chỉ bắt BẢN TIN CHÍNH THỨC (tin bão / tin ATNĐ —
// đã có tâm, có cấp gió). Nhưng NCHMF ra "khả năng hình thành ATNĐ" TRƯỚC đó
// vài ngày, nằm trong bản tin "gió mạnh, sóng lớn, mưa dông trên biển" (phát
// nhiều lần/ngày). Đó đúng là thứ người tính chuyến đi biển cần NHẤT — mà app
// đang bỏ. Đo bản tin thật 09/9/2026 (post53476):
//   "…nối với một vùng áp thấp lúc 13h có vị trí ở vào khoảng 16,5N-17,5N;
//    117,5E-118,5E. Dự báo khoảng 1-2 ngày tới, vùng áp thấp có khả năng mạnh
//    lên thành áp thấp nhiệt đới."
//
// ═══ ĐÂY LÀ TIN MỀM, KHÔNG PHẢI BẢN TIN BÃO ═══
//
// Khác hẳn `storms.ts` (dính tính mạng, cấm nói dối "không có bão"): cảnh báo
// sớm chỉ là NHẮC THEO DÕI. Parse hỏng / nguồn lỗi ⇒ trả `null` (im lặng, KHÔNG
// bịa) — và route để nó soft-fail, không kéo theo bản tin bão thật. Client chỉ
// hiện khi tin bão còn TƯƠI (stormStatus = "khong-co") và KHÔNG có bão thật;
// mất sóng/tin cũ thì lời dặn "nghe đài" của trục bão chính lên tiếng thay.
//
// Mọi hàm THUẦN, nhận chuỗi (đã qua htmlToText của storms-vn) → test bằng bản
// tin thật. TUYỆT ĐỐI không suy diễn số nào ngoài thứ bản tin viết ra: thiếu
// khung toạ độ thì `box: null` (vẫn hiện chữ, chỉ không vẽ vùng lên bản đồ).

/** Khung toạ độ "vùng áp thấp" bản tin cho — để vẽ vùng mờ lên bản đồ. */
export type ApThapBox = {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
};

export type EarlyWarning = {
  /** Nguồn nói vùng áp thấp có thể mạnh lên thành gì */
  kind: "atnd" | "bao";
  /** Khung "vùng áp thấp" (bản tin PHÁT, không tự chế) — null nếu bản tin không cho khung */
  box: ApThapBox | null;
  /** Mốc thời gian nguồn tự ghi ("1-2 ngày tới" / "ngày 12-13/9") — null nếu không có */
  when: string | null;
  /** URL bản tin nguồn (để soát sau) */
  url?: string;
};

/** "16,5" → 16.5 (bản tin VN dùng dấu PHẨY thập phân) */
const soVn = (s: string) => Number(s.replace(",", "."));

/** Khung Biển Đông + vùng tiếp cận — ngoài khung = đọc nhầm số khác trong câu. */
function trongKhung(lat: number, lon: number): boolean {
  return lat >= 0 && lat <= 30 && lon >= 95 && lon <= 140;
}

/*  TÍN HIỆU CẢNH BÁO SỚM: "(có) khả năng … (hình thành | mạnh lên thành) …
    (áp thấp nhiệt đới | bão)". Cụm động từ này chỉ xuất hiện trong ngữ cảnh DỰ
    BÁO HÌNH THÀNH — không khớp câu mô tả thời tiết thường. Bắt cả hai đích:
    → "bão" thì kind = "bao", còn lại "atnd". */
const HINH_THANH_RE =
  /(hình\s+thành|mạnh\s+lên\s+thành)\s+(?:một\s+)?(áp\s+thấp\s+nhiệt\s+đới|bão)/giu;
/** Phủ định ngay trước cụm ("ít/không có khả năng…") → KHÔNG phải cảnh báo. */
const PHU_DINH_RE = /(không|ít|chưa)\s+có\s+khả\s+năng[^.]*$/iu;

/**
 * Bản tin có báo "khả năng hình thành/mạnh lên thành ATNĐ/bão" không.
 * Trả "atnd" | "bao" | null. Cần có chữ "khả năng"/"có thể"/"dự báo" ở gần
 * để chắc là DỰ BÁO, và không bị phủ định ("ít có khả năng").
 */
export function detectHinhThanh(text: string): "atnd" | "bao" | null {
  for (const m of text.matchAll(HINH_THANH_RE)) {
    const idx = m.index ?? 0;
    const truoc = text.slice(Math.max(0, idx - 60), idx);
    // phải là DỰ BÁO (không phải "đã hình thành" — cái đó là bản tin bão thật)
    if (!/khả\s+năng|có\s+thể|dự\s+báo/iu.test(truoc)) continue;
    // "ít/không/chưa có khả năng …" ngay trước ⇒ bỏ
    if (PHU_DINH_RE.test(truoc)) continue;
    return /bão/iu.test(m[2]) ? "bao" : "atnd";
  }
  return null;
}

/*  KHUNG "VÙNG ÁP THẤP" — hai lối viết, cùng một ý (đo trên bản tin thật):
      "16,5N-17,5N; 117,5E-118,5E"                         (bản tin biển)
      "16,5-17,5 độ vĩ bắc và 115,5-116,5 độ kinh đông"    (nhận định KTTV)
    Regex đòi ĐỦ cả dải vĩ VÀ dải kinh nên KHÔNG khớp dải một chiều (vd "trục ở
    khoảng 15-18 độ vĩ Bắc" của dải hội tụ) — thiếu kinh thì thôi, không đoán. */
const BOX_A_RE =
  /(\d{1,2}(?:,\d)?)\s*N\s*[-–]\s*(\d{1,2}(?:,\d)?)\s*N\s*[;,]?\s*(\d{2,3}(?:,\d)?)\s*E\s*[-–]\s*(\d{2,3}(?:,\d)?)\s*E/iu;
const BOX_B_RE =
  /(\d{1,2}(?:,\d)?)\s*[-–]\s*(\d{1,2}(?:,\d)?)\s*độ\s+vĩ\s+bắc\s*(?:và|;|,)?\s*(\d{2,3}(?:,\d)?)\s*[-–]\s*(\d{2,3}(?:,\d)?)\s*độ\s+kinh\s+đông/iu;

/** Khung toạ độ vùng áp thấp trong bản tin (null nếu không có / ngoài khung). */
export function parseVungApThapBox(text: string): ApThapBox | null {
  const m = BOX_A_RE.exec(text) ?? BOX_B_RE.exec(text);
  if (!m) return null;
  const a = soVn(m[1]);
  const b = soVn(m[2]);
  const c = soVn(m[3]);
  const d = soVn(m[4]);
  if (![a, b, c, d].every(Number.isFinite)) return null;
  const box: ApThapBox = {
    latMin: Math.min(a, b),
    latMax: Math.max(a, b),
    lonMin: Math.min(c, d),
    lonMax: Math.max(c, d),
  };
  // hai GÓC phải nằm trong khung, không thì là đọc nhầm số
  if (!trongKhung(box.latMin, box.lonMin) || !trongKhung(box.latMax, box.lonMax)) {
    return null;
  }
  return box;
}

const WHEN_NGAY_RE = /ngày\s+\d{1,2}\s*[-–]\s*\d{1,2}\s*\/\s*\d{1,2}/iu;
const WHEN_TUONG_DOI_RE = /\d{1,2}\s*[-–]\s*\d{1,2}\s*ngày\s+tới/iu;

/** Mốc thời gian nguồn tự ghi ("ngày 12-13/9" ưu tiên, rồi "1-2 ngày tới"). */
export function parseWhen(text: string): string | null {
  const m = WHEN_NGAY_RE.exec(text) ?? WHEN_TUONG_DOI_RE.exec(text);
  return m ? m[0].replace(/\s+/g, " ").trim().toLowerCase() : null;
}

/**
 * Bản tin biển NCHMF (chữ thuần) → cảnh báo sớm, hoặc `null` khi bản tin KHÔNG
 * báo khả năng hình thành ATNĐ/bão. `url` để soát nguồn sau.
 */
export function parseEarlyWarning(text: string, url?: string): EarlyWarning | null {
  const kind = detectHinhThanh(text);
  if (!kind) return null;
  return {
    kind,
    box: parseVungApThapBox(text),
    when: parseWhen(text),
    url,
  };
}

/** "áp thấp nhiệt đới" | "bão" — nói đúng thứ bản tin nói. */
function nhanLoai(kind: EarlyWarning["kind"]): string {
  return kind === "bao" ? "bão" : "áp thấp nhiệt đới";
}

/** Mốc thời gian thành lời: "ngày 12-13/9" → "khoảng ngày 12-13/9"; dạng tương
 *  đối ("1-2 ngày tới") → "trong …". Phân biệt bằng "ngày" ĐỨNG ĐẦU (mốc tuyệt
 *  đối), vì "1-2 ngày tới" cũng chứa chữ "ngày" nên không xét chung được. */
function nhanKhi(when: string | null): string {
  if (!when) return "";
  return /^ngày\s/.test(when) ? ` khoảng ${when}` : ` trong ${when}`;
}

/**
 * Câu cho chip cảnh báo sớm — chỗ DUY NHẤT phát biểu, để bản đồ và mọi nơi khác
 * nói cùng một thứ. `short` cho chip thu gọn, `full` cho câu bung đầy đủ.
 */
export function earlyWarningLine(ew: EarlyWarning): { short: string; full: string } {
  const loai = nhanLoai(ew.kind);
  const khi = nhanKhi(ew.when);
  return {
    short: `Cảnh báo sớm: có thể hình thành ${loai}`,
    full: `Cảnh báo sớm: vùng áp thấp giữa Biển Đông có khả năng mạnh lên thành ${loai}${khi}. Theo dõi thêm, nghe đài duyên hải.`,
  };
}
