/**
 * Trục 1 — SỐ ĐO SÂU KHẢO SÁT (điểm cạn trong luồng, vũng cảng, cửa biển).
 *
 * File này giữ TYPE + BỘ PHÂN TÍCH TOẠ ĐỘ + GIẢI MÃ (thuần, test được) cho
 * dataset tĩnh `public/data/soundings.v1.json` (CẢ NƯỚC), sinh bởi
 * `scripts/fetch-soundings.mjs`. File này KHÔNG fetch, KHÔNG vẽ, KHÔNG đọc
 * đồng hồ máy — mọi mốc thời gian truyền vào dạng "YYYY-MM-DD".
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Bản đồ của app tới nay chỉ có ETOPO 2022 (~450 m/ô) — mô hình nội suy từ
 * vệ tinh, KHÔNG có lấy một điểm đo sâu khảo sát thật nào. Hải đồ thương mại
 * mà bà con thấy trên máy tính bảng ngoài chợ thì rải đầy số đo sâu rời (lớp
 * SOUNDG của chuẩn S-57). Khoảng cách đó là khoảng cách lớn nhất còn lại.
 *
 * Thông báo hàng hải do các Cảng vụ Hàng hải ban hành lấp đúng khúc này ở
 * luồng — cửa biển — vũng cảng: độ sâu đo bằng máy hồi âm 200 kHz, quy về mực
 * nước "số 0 hải đồ" (cùng chuẩn với hải đồ), kèm toạ độ WGS-84 tới 0,1 giây.
 *
 * ── HAI ĐIỀU KHÔNG ĐƯỢC BỎ ────────────────────────────────────────────────
 * 1. **NGÀY của thông báo đi kèm TỪNG điểm.** Luồng bồi lắng liên tục; một số
 *    đo sâu không có ngày là một con số nguy hiểm. Bà con phải thấy được số
 *    này đo hồi nào.
 * 2. **Lý lịch nguồn** (`src/lib/provenance.ts`) — truy được điểm này ra từ
 *    thông báo số mấy, ngày nào, ở URL nào.
 *
 * ── DATUM: CHỈ NHẬN WGS-84 ────────────────────────────────────────────────
 * Bảng toạ độ trong thông báo thường có HAI hệ cạnh nhau: VN-2000 và WGS-84.
 * Ở vùng biển Việt Nam hai hệ lệch nhau khoảng 5–7 giây cung (~150–200 m) —
 * đủ để đưa tàu ra ngoài luồng. Dataset này CHỈ giữ WGS-84 (hệ mà GPS của tàu
 * trả về). Hàng nào không xác định được hệ thì BỎ và ghi vào danh sách bỏ
 * sót, không đoán.
 *
 * ## Assumptions
 * - Trần độ sâu 200 m: Thông báo hàng hải nói về luồng/vũng cảng/cửa biển —
 *   sâu hơn 200 m là chắc chắn bóc nhầm số khác (chiều dài đoạn, cao độ cầu).
 *   Đây KHÔNG phải giới hạn của biển Việt Nam, chỉ là giới hạn của nguồn này.
 * - Sàn 0,1 m: thông báo ghi độ sâu tới 0,1 m; số 0 hoặc âm là bóc nhầm.
 */

/* ── 1. KHUNG & DẢI HỢP LỆ ──────────────────────────────────────────────── */

/** Khung biển Việt Nam (Nam, Tây, Bắc, Đông) — GIỐNG các script sinh dữ liệu khác. */
export const VN_SEA_BBOX = { south: 4, west: 102, north: 24, east: 118 } as const;

/** Độ sâu nông nhất còn coi là số đo thật (m). */
export const DEPTH_MIN_M = 0.1;
/** Độ sâu sâu nhất còn hợp lý cho nguồn LUỒNG/VŨNG CẢNG (m) — xem Assumptions. */
export const DEPTH_MAX_M = 200;

export function inVietnamSea(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= VN_SEA_BBOX.south &&
    lat <= VN_SEA_BBOX.north &&
    lon >= VN_SEA_BBOX.west &&
    lon <= VN_SEA_BBOX.east
  );
}

export function isPlausibleDepth(m: number): boolean {
  return Number.isFinite(m) && m >= DEPTH_MIN_M && m <= DEPTH_MAX_M;
}

/* ── 2. BỘ PHÂN TÍCH TOẠ ĐỘ ─────────────────────────────────────────────── */

/**
 * Ký tự "độ" trong các thông báo KHÔNG thống nhất: có bản dùng `°` (U+00B0),
 * có bản dùng `˚` (U+02DA, dấu vòng trên), có bản dùng `º`. Phút thì `'` hoặc
 * `’` hoặc `′`. Giây thì `"`, `”`, `″`, hoặc HAI dấu phút liền (`’’`).
 * Không gom hết là mất trắng cả bảng của một cảng vụ.
 */
const DEG = "[°˚º∘]";
const MIN = "['’′´]";
/*  Dấu giây KHÔNG nhận ký tự CJK nào (vd U+301E) — cổng chủ quyền cấm chữ Hán
    trong mã nguồn, và không thông báo hàng hải Việt Nam nào dùng tới nó. */
/*  U+301E (dấu nháy kép kiểu CJK) dựng bằng mã điểm, KHÔNG viết thẳng ký tự
    vào mã nguồn: cổng chủ quyền `scripts/audit-names.mjs` chạy trong
    `npm test` quét mọi ký tự Hán trong file dự án và sẽ đỏ ở đây. Cổng làm
    ĐÚNG việc — nó không thể biết ký tự này là dấu GIÂY toạ độ chứ không phải
    tên đất. Dựng bằng mã điểm cho hành vi y hệt lúc chạy mà file thì sạch.
    ĐỪNG đưa ký tự thật trở lại 'cho dễ đọc'. */
const SEC_CJK_PRIME = String.fromCodePoint(0x301e);
const SEC = `(?:["”″${SEC_CJK_PRIME}]|${MIN}${MIN})`;

/**
 * Ba trường số KHÔNG dùng chung một khuôn, và đây là chỗ dễ sai nhất.
 *
 * Độ và phút phải là chữ số LIỀN NHAU: nếu cho phép khoảng trắng bên trong thì
 * hàng `7,5 10˚44 ’ 39,04 ” N` (cột độ sâu 7,5 rồi mới tới toạ độ) bị đọc
 * thành `5 10` = 510 độ — cả hàng rơi vào sọt rác mà không ai biết vì sao.
 *
 * Riêng GIÂY thì phải chịu khoảng trắng: bộ bóc PDF tách chữ theo vị trí vẽ
 * nên trong bảng thật có `0 4,58` (nghĩa là 04,58 giây).
 */
const D_DEG = "\\d(?:\\s*\\d){0,2}";
const D_MIN = "\\d(?:\\s*\\d)?(?:\\s*[.,]\\s*\\d+)?";
const D_SEC = "\\d[\\d\\s]{0,3}(?:[.,]\\s*\\d(?:\\s*\\d){0,2})?";

/**
 * KHÔNG cho khuôn số bắt đầu ở GIỮA một con số khác.
 *
 * Vì độ nay chịu được khoảng trắng, hàng `7,5 10˚44’…` (cột độ sâu 7,5 đứng
 * trước) có thể bị đọc từ chữ `5` thành `5 10` = 510 độ — đúng cái bẫy đã dính
 * một lần. Chặn ngay từ đầu: phía trước phần độ không được là chữ số, dấu chấm
 * hay dấu phẩy.
 *
 * ⚠️ ĐỪNG viết lại thành lookbehind `(?<![\d.,])` — đó ĐÚNG LÀ bản cũ, và nó
 * làm màn "Ra khơi" ra TRẮNG TRƠN trên iPhone đời cũ (báo từ hiện trường
 * 2026-09-04, iPhone 12). Safari chỉ hiểu lookbehind từ 16.4; máy cũ hơn ném
 * `SyntaxError` lúc PARSE cả file .js — mà file này nằm trong chunk lazy của
 * `fishing-map-view`, nên bản đồ không mount, không một chữ báo lỗi.
 * Cũng ĐỪNG thay bằng `(?:^|[^\d.,])`: cách đó ĂN MẤT một ký tự, nên hai toạ
 * độ dính liền `10°44'N106°30'E` sẽ trượt cái thứ hai. Soi ký tự đứng trước
 * bằng tay là cách duy nhất giữ đủ cả hai điều.
 */
function batDauGiuaSo(text: string, index: number): boolean {
  return index > 0 && /[\d.,]/.test(text[index - 1]);
}

const toNum = (s: string): number => Number.parseFloat(s.replace(/\s+/g, "").replace(",", "."));

const DMS_RE = new RegExp(
  `(${D_DEG})\\s*${DEG}\\s*(${D_MIN})\\s*${MIN}\\s*(?:(${D_SEC})\\s*${SEC})?\\s*([NSEWnsew])?`,
  "g",
);
const DEC_RE = /(-?\d+(?:[.,]\d+)?)\s*°?\s*([NSEWnsew])?/g;

export type CoordKind = "lat" | "lon";

const LIMIT: Record<CoordKind, number> = { lat: 90, lon: 180 };
const NEG: Record<CoordKind, string> = { lat: "S", lon: "W" };

/**
 * Đọc MỘT toạ độ, chấp cả hai định dạng thông báo dùng:
 *   · độ-phút-giây  `10°44'39,04"N` · `10 ˚ 44 ’ 35,4 ’’ N` · `15°23'43.0"`
 *   · độ thập phân  `10.7442` · `106,7452 E`
 *
 * Trả `null` khi không đọc được HOẶC ra ngoài dải của loại toạ độ — người gọi
 * phải xử lý, KHÔNG được coi `null` là 0.
 */
export function parseCoordinate(text: string, kind: CoordKind): number | null {
  if (typeof text !== "string") return null;

  DMS_RE.lastIndex = 0;
  let dms: RegExpExecArray | null;
  let thayDms = false;
  while ((dms = DMS_RE.exec(text)) !== null) {
    // Bắt đầu GIỮA một con số khác ⇒ coi như CHƯA TỪNG khớp (đúng vai cũ của
    // lookbehind): dò lại từ ký tự kế, và KHÔNG bật `thayDms` — bật là nuốt
    // mất đường lùi sang khuôn thập phân ở dưới.
    if (batDauGiuaSo(text, dms.index)) {
      DMS_RE.lastIndex = dms.index + 1;
      continue;
    }
    thayDms = true;
    const v = dmsValue(dms[1], dms[2], dms[3], dms[4], kind);
    if (v !== null) return v;
    // THỬ LẠI chỉ khi phần độ CÓ KHOẢNG TRẮNG bên trong — nghĩa là khuôn có
    // thể đã nuốt chữ số của cột bên cạnh (`8 10˚44’` đọc thành 810 độ). Số
    // liền mạch mà ra ngoài dải thì đó là số sai thật: trả null, KHÔNG mò tiếp
    // để khỏi biến `200°00’00”E` thành 0.
    if (!/\s/.test(dms[1])) return null;
    DMS_RE.lastIndex = dms.index + 1;
  }
  if (thayDms) return null;

  DEC_RE.lastIndex = 0;
  const dec = DEC_RE.exec(text);
  if (dec) {
    const v = Number.parseFloat(dec[1].replace(",", "."));
    if (!Number.isFinite(v)) return null;
    return finish(Math.abs(v), dec[2], kind, v < 0);
  }
  return null;
}

/**
 * Ba trường độ-phút-giây đã bắt được → giá trị, hoặc `null` khi vô lý.
 *
 * Tách riêng vì `parseSoundingRow` cần biết TOẠ ĐỘ BẮT ĐẦU Ở ĐÂU trong dòng
 * (để biết ô nào là ô độ sâu), nên nó KHÔNG được gọi `parseCoordinate` — hàm
 * kia có bước "thử lại lùi một ký tự" và sẽ trả về một giá trị đúng cho một
 * vị trí SAI. Đã dính thật: hàng `8 10˚44’…` cho toạ độ đúng nhưng ô độ sâu
 * "8" biến mất, vì khuôn báo là toạ độ bắt đầu từ chữ `8`.
 */
function dmsValue(
  degTxt: string,
  minTxt: string,
  secTxt: string | undefined,
  hemi: string | undefined,
  kind: CoordKind,
): number | null {
  const d = toNum(degTxt);
  const m = toNum(minTxt);
  const sec = secTxt ? toNum(secTxt) : 0;
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (m >= 60 || sec >= 60) return null;
  return finish(d + m / 60 + sec / 3600, hemi, kind);
}

function finish(v: number, hemi: string | undefined, kind: CoordKind, negative = false): number | null {
  if (!Number.isFinite(v) || v > LIMIT[kind]) return null;
  const neg = negative || (hemi ? hemi.toUpperCase() === NEG[kind] : false);
  return neg ? -v : v;
}

/* ── 3. ĐỌC MỘT HÀNG BẢNG TOẠ ĐỘ ────────────────────────────────────────── */

export type LatLon = { lat: number; lon: number };

export type SoundingRow = {
  /** độ sâu ghi ở đầu hàng (m); `null` khi hàng chỉ có toạ độ (điểm góc vùng) */
  depthM: number | null;
  /**
   * Con số ĐÚNG NHƯ BẢNG VIẾT ("7,5", "06", "2") — `null` khi không có ô nào.
   * Cổng `hasDepthColumn` cần chính chữ viết, không cần giá trị: một cột toàn
   * số NGUYÊN là dấu hiệu đó là cột TÊN ĐIỂM chứ không phải cột độ sâu.
   */
  depthLiteral: string | null;
  /** các CẶP toạ độ trên hàng, theo thứ tự trái→phải như trong bảng */
  pairs: LatLon[];
};

/** Bắt trọn một chuỗi toạ độ (DMS hoặc thập phân có ghi bán cầu) kèm bán cầu. */
const TOKEN_RE = new RegExp(
  `(${D_DEG})\\s*${DEG}\\s*(${D_MIN})\\s*${MIN}\\s*(?:(${D_SEC})\\s*${SEC})?\\s*([NSEWnsew])` +
    `|(-?\\d+[.,]\\d{3,})\\s*°?\\s*([NSEWnsew])`,
  "g",
);

/**
 * Đọc một DÒNG chữ bóc từ PDF thành hàng bảng độ sâu.
 *
 * Khuôn thật của thông báo (cột trái→phải):
 *   `Độ sâu (m) | VN-2000 Vĩ độ | VN-2000 Kinh độ | WGS-84 Vĩ độ | WGS-84 Kinh độ`
 * ví dụ: `7,5 10˚44 ’ 39,04 ” N 106˚44 ’ 42,29 ” E 10 ˚ 44 ’ 35,4 ’’ N 106 ˚ 44 ’ 48,7 ’’ E`
 *
 * Trả `null` khi dòng không có cặp toạ độ nào — dòng văn xuôi không phải lỗi,
 * chỉ là không phải hàng bảng.
 */
export function parseSoundingRow(line: string): SoundingRow | null {
  if (typeof line !== "string" || !line) return null;

  TOKEN_RE.lastIndex = 0;
  const tokens: Array<{ start: number; end: number; hemi: string; value: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    /*  CHỈ soi nhánh DMS (`m[1]`). Nhánh thập phân của khuôn này trước nay
        KHÔNG có chốt "không bắt đầu giữa số" — lookbehind cũ đứng trong nhánh
        đầu, không phủ nhánh sau. Thêm cho nó là đổi hành vi ngoài bản vá. */
    if (m[1] && batDauGiuaSo(line, m.index)) {
      TOKEN_RE.lastIndex = m.index + 1;
      continue;
    }
    const hemi = (m[4] ?? m[6] ?? "").toUpperCase();
    const kind: CoordKind = hemi === "N" || hemi === "S" ? "lat" : "lon";
    // Tính TẠI CHỖ, KHÔNG gọi `parseCoordinate`: hàm kia thử lại lùi một ký tự
    // nên trả giá trị đúng cho vị trí sai, và ô độ sâu đứng trước toạ độ sẽ bị
    // nuốt mất (xem `dmsValue`).
    let value: number | null = null;
    if (m[1]) value = dmsValue(m[1], m[2], m[3], m[4], kind);
    else if (m[5]) {
      const v = Number.parseFloat(m[5].replace(",", "."));
      value = Number.isFinite(v) ? finish(Math.abs(v), m[6], kind, v < 0) : null;
    }
    if (value === null) {
      // Độ nay chịu được khoảng trắng, nên khuôn có thể đã bắt đầu SỚM một chữ
      // số và nuốt cột bên cạnh (`8 10˚44’` đọc thành 810 độ). Lùi MỘT ký tự
      // rồi dò lại, thay vì nhảy qua cả đoạn vừa khớp — nhảy qua là mất luôn
      // toạ độ thật nằm bên trong nó.
      if (m[1] && /\s/.test(m[1])) TOKEN_RE.lastIndex = m.index + 1;
      continue;
    }
    tokens.push({ start: m.index, end: m.index + m[0].length, hemi, value });
  }
  if (!tokens.length) return null;

  // Ghép theo thứ tự xuất hiện: một vĩ độ gặp một kinh độ NGAY SAU nó là một cặp.
  const pairs: LatLon[] = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const aIsLat = a.hemi === "N" || a.hemi === "S";
    const bIsLat = b.hemi === "N" || b.hemi === "S";
    if (aIsLat && !bIsLat) {
      pairs.push({ lat: a.value, lon: b.value });
      i++;
    }
  }
  if (!pairs.length) return null;

  // Độ sâu = số ở cột "Độ sâu (m)", đứng TRƯỚC toạ độ trong khuôn phổ biến;
  // vài cảng vụ để nó ở CUỐI hàng.
  //
  // Ô đó phải CHỈ CHỨA con số, không gì khác. Nới ra một chút là dính ngay bảng
  // toạ độ GÓC VÙNG, nơi cột đầu là TÊN ĐIỂM: "DHN - 0 6", "B14", "SR3" (bộ bóc
  // PDF tách chữ theo vị trí vẽ nên tên điểm có khoảng trắng bên trong). Đọc
  // "DHN - 0 6" thành 6 m là bịa ra một số đo sâu hợp lý ở đúng một toạ độ thật
  // — không cổng nào chặn được, và bà con tin nó. Thà bỏ hàng còn hơn.
  const NUM_ONLY = /^\s*(\d+(?:[.,]\d+)?)\s*(?:m)?\s*$/i;
  const dm =
    line.slice(0, tokens[0].start).match(NUM_ONLY) ??
    line.slice(tokens[tokens.length - 1].end).match(NUM_ONLY);
  const depthLiteral = dm ? dm[1] : null;
  const depthM = depthLiteral ? Number.parseFloat(depthLiteral.replace(",", ".")) : null;

  return {
    depthM: depthM !== null && Number.isFinite(depthM) ? depthM : null,
    depthLiteral,
    pairs,
  };
}

/**
 * CỔNG 2 (mở rộng) — CẢ BẢNG này có cột độ sâu thật không?
 *
 * `parseSoundingRow` chặn được tên điểm có CHỮ ("DHN - 0 6"). Nó KHÔNG chặn
 * được bảng mà cột tên điểm chỉ là SỐ — "01", "06", "12" — vì hàng nào cũng
 * trông y hệt một hàng độ sâu: một con số, rồi hai cặp toạ độ thật, trong dải
 * hợp lý. Đó đúng là án lệ "DHN - 0 6" ở dạng còn khó thấy hơn.
 *
 * Chỗ phân biệt được nằm ở CẢ BẢNG, không ở một hàng: máy hồi âm đo tới 0,1 m
 * nên một cột độ sâu thật gần như chắc chắn có ÍT NHẤT MỘT số lẻ ("7,5", "2.3").
 * Cột tên điểm/số thứ tự thì toàn số nguyên. Vậy: bảng nào không có lấy một số
 * lẻ nào thì KHÔNG được coi là có cột độ sâu — bỏ cả bảng, ghi lý do.
 *
 * Giá phải trả đã cân: bảng độ sâu thật mà mọi giá trị đều tròn mét là hiếm;
 * bịa một số đo sâu ở toạ độ thật thì bà con tin và không cổng nào đỏ.
 */
export function hasDepthColumn(rows: readonly SoundingRow[]): boolean {
  if (!Array.isArray(rows)) return false;
  return rows.some(
    (r) => r && r.depthM !== null && typeof r.depthLiteral === "string" && /[.,]/.test(r.depthLiteral),
  );
}

/* ── 4. DATASET ─────────────────────────────────────────────────────────── */

import type { Provenance } from "@/lib/provenance";
import { fetchDataJson } from "@/lib/data-fetch";
import { DEPTH_CLASS_DEEP } from "@/lib/depth-grid";
// Dùng lại bản haversine DUY NHẤT của repo (nguyên tắc 3). `fairway-depth.ts`
// đã nhập đúng bản này; thêm bản thứ hai ở đây là mở đường cho hai bản trôi.
import { haversineKm } from "@/lib/route-plan";

/** Một thông báo hàng hải đã bóc — mang NGÀY và LÝ LỊCH cho mọi điểm của nó. */
export type SoundingNotice = {
  /** số hiệu như thông báo ghi, vd "947/TBHH-CVHHTPHCM" */
  so: string;
  /** ngày ban hành ("YYYY-MM-DD") — bà con phải biết số đo này đo hồi nào */
  ngay: string;
  tieuDe: string;
  /** trang chi tiết trên danh mục */
  url: string;
  /** file PDF gốc */
  pdf: string;
  /** chỉ số trong `luong[]` */
  luong: number;
  prov: Provenance;
  /**
   * NGÀY NÀY LÀ SUY RA, KHÔNG PHẢI NGÀY KÝ.
   *
   * Bản lưu trữ không có danh mục để hỏi ngày, và bản ký số hay để trống ô
   * ngày; khi đó `ngay` lùi về ngày 01 của tháng đọc từ đường dẫn
   * `/uploads/<năm>/<tháng>/`. Cờ này là THỨ DUY NHẤT phân biệt được nó với
   * một ngày ký chính xác — giao diện đọc chính nó để vẽ điểm cũ rỗng ruột và
   * nói "Số cũ — cửa lạch có thể đã bồi lắng".
   *
   * Đã dính thật: đường ống bản trước hứa ghi cờ này trong chú thích nhưng
   * KHÔNG có một dòng mã nào ghi, nên 149 điểm mang ngày `2019-01-01` trông
   * như ngày ký. Vắng cờ = ngày thật; đừng để mặc định nói dối.
   */
  ngayUocLuong?: boolean;
  /**
   * Chữ của thông báo này lấy bằng OCR ảnh scan, không phải lớp chữ của PDF.
   * Sai sót của OCR khác hẳn sai sót của bộ bóc chữ, nên chỗ nào rà lại chất
   * lượng cũng cần biết điểm đến từ đường nào — xem `scripts/ocr-soundings.mjs`.
   */
  ocr?: boolean;
};

/**
 * Vùng = **CƠ QUAN BAN HÀNH thông báo**, đọc từ SỐ HIỆU. KHÔNG phải chuyên mục
 * trên danh mục — xem `areaFromNotice` để biết vì sao chuyên mục là cái bẫy.
 */
export type SoundingArea = {
  /** mã cơ quan trong số hiệu, vd "CVHHKG" (KHÔNG phải slug chuyên mục) */
  ma: string;
  /** tên tiếng Việt hiển thị, vd "Cảng vụ Hàng hải Kiên Giang" */
  ten: string;
};

/**
 * TIM TUYẾN / GÓC VÙNG + ĐỘ SÂU KHỐNG CHẾ — khuôn thứ hai của thông báo.
 *
 * Phần lớn thông báo KHÔNG in bảng "độ sâu tại điểm cạn". Chúng in một bảng
 * toạ độ **không có cột độ sâu** (tim tuyến khảo sát `T2`, `T2-1`… hoặc góc
 * khu nước) rồi nói độ sâu ở VĂN XUÔI, theo đoạn:
 *
 *     "Đoạn luồng từ phao số 8 đến phao số 12 +1.000 m … độ sâu đạt 1,8 m."
 *
 * Đợt trước vứt hết khuôn này vào `boSot` ("hàng có toạ độ nhưng không có cột
 * độ sâu"). Đó là bỏ đúng phần đa số. Ở đây giữ lại: một ĐƯỜNG có toạ độ thật
 * kèm độ sâu khống chế NÔNG NHẤT của thông báo.
 *
 * ⚠️ KHÔNG phải số đo sâu tại điểm. `sauM` trả lời "đi hết tuyến này có mắc
 * cạn không", không trả lời "dưới đáy tàu còn bao nhiêu". Cùng ranh giới mà
 * `src/lib/fairway-depth.ts` đã vạch giữa ĐIỂM và ĐOẠN — và câu độ sâu ở đây
 * đọc bằng CHÍNH bộ nhận dạng của file đó, không có bản chép tay thứ hai.
 */
export type SoundingRoute = {
  /** chỉ số trong `thongBao[]` */
  tb: number;
  /** tên tuyến/khu nước thông báo tự khai; `null` khi không đọc được */
  ten: string | null;
  /** [lon, lat] theo đúng thứ tự hàng trong bảng */
  diem: number[][];
  /** độ sâu khống chế NÔNG NHẤT đọc được (×10, dm); `null` khi văn xuôi không nói */
  sau: number | null;
};

export type SoundingsFile = {
  v: number;
  nguon: string;
  nhan: string;
  layNgay: string;
  luong: SoundingArea[];
  thongBao: SoundingNotice[];
  /** [lon, lat, độ sâu ×10 (dm), chỉ số thongBao] */
  diem: number[][];
  /** tim tuyến / góc vùng + độ sâu khống chế — khuôn thứ hai, xem `SoundingRoute` */
  tuyen?: SoundingRoute[];
  /** thông báo ĐỌC KHÔNG ĐƯỢC — ghi ra chứ không im lặng */
  boSot: Array<{ so: string; ngay: string; url: string; lyDo: string }>;
};

/** Một số đo sâu đã giải mã, mang sẵn ngày + lý lịch. */
export type Sounding = {
  lat: number;
  lon: number;
  /** mét, quy về mực nước "số 0 hải đồ" */
  depthM: number;
  /** ngày ban hành thông báo ("YYYY-MM-DD") */
  at: string;
  notice: SoundingNotice;
  area: SoundingArea | null;
};

/**
 * Bảng tra + hàng số → danh sách số đo sâu. BỎ QUA hàng hỏng thay vì ném: một
 * dòng lỗi không được làm mất cả lớp độ sâu của chuyến biển (cùng luật với
 * `decodeSeamarks`). Hàng ngoài khung VN hoặc độ sâu vô lý cũng bị loại ở đây
 * — cổng chặn nằm ở HÀM DÙNG CHUNG, không rải ở chỗ gọi.
 */
export function decodeSoundings(raw: unknown): Sounding[] {
  const f = raw as Partial<SoundingsFile> | null;
  if (!f || !Array.isArray(f.diem)) return [];
  const notices = Array.isArray(f.thongBao) ? f.thongBao : [];
  const areas = Array.isArray(f.luong) ? f.luong : [];

  const out: Sounding[] = [];
  for (const row of f.diem) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [lon, lat, dm, ti] = row;
    if (!inVietnamSea(lat, lon)) continue;
    const depthM = Number(dm) / 10;
    if (!isPlausibleDepth(depthM)) continue;
    const notice = notices[ti as number];
    if (!notice || typeof notice.ngay !== "string" || !notice.prov) continue;
    out.push({
      lat,
      lon,
      depthM: Math.round(depthM * 10) / 10,
      at: notice.ngay,
      notice,
      area: areas[notice.luong] ?? null,
    });
  }
  return out;
}

/** Số ngày từ ngày thông báo tới `todayISO`. Cả hai dạng "YYYY-MM-DD". */
export function soundingAgeDays(s: Sounding, todayISO: string): number | null {
  const a = Date.parse(`${s.at}T00:00:00Z`);
  const b = Date.parse(`${todayISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/* ── 5. VÙNG ĐỌC TỪ SỐ HIỆU, KHÔNG ĐỌC TỪ CHUYÊN MỤC ────────────────────── */

/**
 * 🔴 BẪY ĐÃ ĐẶT SẴN: chuyên mục trên danh mục vmsa.vn dùng **tên tỉnh sau sáp
 * nhập 2025**, và cảng vụ nào phụ trách vùng nào thì KHÔNG theo tên tỉnh đó:
 *
 *   · `an-giang-456`        → thông báo ghi `CVHHKG`  = **Kiên Giang** (An Giang không giáp Rạch Giá)
 *   · `ca-mau-455`          → cũng ghi `CVHHKG`       = Kiên Giang phụ trách luôn Cà Mau
 *   · `gia-lai-449`         → ghi `CVHHQNh`           = **Quy Nhơn**
 *   · `lam-dong-457`        → ghi `CVHHBT`            = **Bình Thuận**
 *   · `tp.-ho-chi-minh-452` → gồm cả **Vũng Tàu**
 *
 * Gán vùng theo slug là **dán nhãn sai tỉnh cho số đo sâu** — bà con đọc "An
 * Giang" cho một điểm cạn ở Rạch Giá. Nguồn đúng duy nhất là **số hiệu**, nơi
 * chính cơ quan ban hành tự khai mình là ai.
 *
 * Nên "vùng" ở đây là **CƠ QUAN BAN HÀNH**, không phải tỉnh: đó là thứ số hiệu
 * nói được chắc chắn. Suy ra tỉnh từ cơ quan là thêm một tầng đoán nữa.
 *
 * ## Assumptions
 * - Bảng dưới chỉ ghi mã **đã gặp thật** khi quét cả nước (2026-08-31), và mỗi
 *   mã được đối chiếu chéo với chuyên mục nó xuất hiện, chứ không suy từ chữ
 *   viết tắt. `CVHHQN` xuất hiện **78/78 lần dưới `quang-ninh-252`** nên là
 *   Quảng Ninh — KHÔNG phải Quy Nhơn (`CVHHQNh`) hay Quảng Ngãi (`CVHHQNg`),
 *   hai mã đó tồn tại riêng. Mã lạ vẫn trả `null`: người gọi phải ghi ra,
 *   KHÔNG được đoán. Bản bóc từ PDF hỏng cho ra mã cụt (`TCTBĐATHHM`,
 *   `TCTB`) — cụt thì cũng là mã lạ, cũng bị bỏ, đúng như thiết kế.
 * - `CVHHĐN` trùng khít cho **Đà Nẵng** và **Đồng Nai**. Không tách được bằng
 *   chữ, tách bằng VĨ ĐỘ: Đà Nẵng ~16,1°N, Đồng Nai ~10,6°N — mốc 14°N để giữa
 *   hai bên hơn 300 km, không có cách nào lệch.
 */
export const DA_NANG_DONG_NAI_LAT = 14;

/** Mã cơ quan trong số hiệu → tên tiếng Việt hiển thị. */
export const CO_QUAN: Record<string, string> = {
  CVHHQN: "Cảng vụ Hàng hải Quảng Ninh",
  CVHHHP: "Cảng vụ Hàng hải Hải Phòng",
  CVHHTB: "Cảng vụ Hàng hải Thái Bình",
  CVHHTH: "Cảng vụ Hàng hải Thanh Hoá",
  CVHHNA: "Cảng vụ Hàng hải Nghệ An",
  CVHHHT: "Cảng vụ Hàng hải Hà Tĩnh",
  CVHHQT: "Cảng vụ Hàng hải Quảng Trị",
  CVHHTTH: "Cảng vụ Hàng hải Thừa Thiên Huế",
  CVHHQNa: "Cảng vụ Hàng hải Quảng Nam",
  CVHHQNg: "Cảng vụ Hàng hải Quảng Ngãi",
  CVHHQNh: "Cảng vụ Hàng hải Quy Nhơn",
  CVHHNT: "Cảng vụ Hàng hải Nha Trang",
  CVHHBT: "Cảng vụ Hàng hải Bình Thuận",
  CVHHVT: "Cảng vụ Hàng hải Vũng Tàu",
  CVHHTPHCM: "Cảng vụ Hàng hải TP. Hồ Chí Minh",
  CVHHCT: "Cảng vụ Hàng hải Cần Thơ",
  CVHHKG: "Cảng vụ Hàng hải Kiên Giang",
  CVHHMT: "Cảng vụ Hàng hải Mỹ Tho",
  CVĐTNĐIV: "Cảng vụ Đường thuỷ nội địa khu vực IV",
  CHHĐTVN: "Cục Hàng hải và Đường thuỷ Việt Nam",
  CHHVN: "Cục Hàng hải Việt Nam",
  TCTBĐATHHMB: "Bảo đảm an toàn hàng hải miền Bắc",
  TCTBĐATHHMN: "Bảo đảm an toàn hàng hải miền Nam",
  CTBĐATHHMB: "Bảo đảm an toàn hàng hải miền Bắc",
  CTBĐATHHMN: "Bảo đảm an toàn hàng hải miền Nam",
  // Bản lưu trữ đặt TÊN FILE không dấu ("35-TBHH-TCTBDATHHMN_1-Signed.pdf") và
  // số hiệu nhiều khi chỉ còn ở tên file. Nhận luôn dạng không dấu — cùng cơ
  // quan, chỉ khác cách gõ.
  TCTBDATHHMN: "Bảo đảm an toàn hàng hải miền Nam",
  TCTBDATHHMB: "Bảo đảm an toàn hàng hải miền Bắc",
  CTBDATHHMN: "Bảo đảm an toàn hàng hải miền Nam",
  CTBDATHHMB: "Bảo đảm an toàn hàng hải miền Bắc",
  CHHDTVN: "Cục Hàng hải và Đường thuỷ Việt Nam",
  CVDTNDIV: "Cảng vụ Đường thuỷ nội địa khu vực IV",
};

/** Hai cảng vụ viết tắt trùng nhau — tách bằng vĩ độ, xem `areaFromNotice`. */
const CO_QUAN_TRUNG: Record<string, { bac: string; nam: string }> = {
  CVHHĐN: { bac: "Cảng vụ Hàng hải Đà Nẵng", nam: "Cảng vụ Hàng hải Đồng Nai" },
  CVHHDN: { bac: "Cảng vụ Hàng hải Đà Nẵng", nam: "Cảng vụ Hàng hải Đồng Nai" },
};

/**
 * Số hiệu → mã cơ quan, đã gột sạch rác của danh mục.
 *
 * Số hiệu thật viết đủ kiểu: `1844/TBHH - CVHHHP` (có dấu cách quanh gạch),
 * `140/2020/TBHH-TCTBĐATHHMB` (có chèn năm), `24/TBHH-CT.BĐATHHMB` (có dấu
 * chấm), `…MB,` (dính dấu phẩy), `…ĐN&nbsp;` (dính khoảng trắng cứng).
 *
 * KHÔNG viết hoa toàn bộ: `CVHHQNg` (Quảng Ngãi) và `CVHHQNh` (Quy Nhơn) chỉ
 * khác nhau ở chữ cái cuối viết thường — viết hoa là gộp hai cảng vụ làm một.
 */
export function noticeAuthorityCode(so: string): string | null {
  if (typeof so !== "string") return null;
  const m = /TBHH\s*[-–—]\s*([^\s,;/]+)/.exec(so.replace(/ /g, " "));
  if (!m) return null;
  const code = m[1].replace(/[.\s,;]+/g, "");
  return code || null;
}

/**
 * Số hiệu (+ vĩ độ để tách mã trùng) → vùng. `null` khi mã lạ — người gọi
 * PHẢI ghi ra chứ không được lấy chuyên mục thay thế.
 */
export function areaFromNotice(so: string, lat: number | null = null): SoundingArea | null {
  const ma = noticeAuthorityCode(so);
  if (!ma) return null;
  const trung = CO_QUAN_TRUNG[ma];
  if (trung) {
    if (!Number.isFinite(lat as number)) return null;
    return { ma, ten: (lat as number) >= DA_NANG_DONG_NAI_LAT ? trung.bac : trung.nam };
  }
  const ten = CO_QUAN[ma];
  return ten ? { ma, ten } : null;
}

/* ── 6. THÔNG BÁO MỚI ĐÈ THÔNG BÁO CŨ ───────────────────────────────────── */

/**
 * Luồng được nạo vét thì độ sâu đổi, và các cảng vụ khảo sát lại đúng những
 * điểm cạn cũ. Hai thông báo cách nhau một năm cho hai con số khác nhau ở
 * CÙNG MỘT CHỖ — giữ cả hai là để bà con tự bốc thăm.
 *
 * Ô lưới ~11 m (0,0001°): thông báo ghi toạ độ tới 0,01 giây (~0,3 m) nên
 * cùng một điểm cạn khảo sát lại thường lệch vài mét, không lệch chục mét.
 *
 * Bằng ngày thì giữ bản NÔNG HƠN — an toàn hơn cho tàu (cùng luật với
 * `keepNewestPerSegment` của `fairway-depth.ts`).
 */
export const SPOT_GRID_DEG = 1e-4;

export function spotKey(lat: number, lon: number): string {
  return `${Math.round(lat / SPOT_GRID_DEG)}:${Math.round(lon / SPOT_GRID_DEG)}`;
}

export function keepNewestPerSpot<T extends { lat: number; lon: number; at: string; depthM: number }>(
  points: readonly T[],
): T[] {
  const best = new Map<string, T>();
  for (const p of points) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const k = spotKey(p.lat, p.lon);
    const cur = best.get(k);
    if (!cur) {
      best.set(k, p);
      continue;
    }
    if (p.at > cur.at || (p.at === cur.at && p.depthM < cur.depthM)) best.set(k, p);
  }
  return [...best.values()];
}

/* ── 7. GIẢI MÃ TIM TUYẾN ───────────────────────────────────────────────── */

/** Một tuyến/khu nước đã giải mã, mang sẵn ngày + lý lịch. */
export type SoundingRouteDecoded = {
  ten: string | null;
  points: LatLon[];
  /** độ sâu khống chế nông nhất (m); `null` khi thông báo không nói */
  sauM: number | null;
  at: string;
  notice: SoundingNotice;
  area: SoundingArea | null;
};

/**
 * Bỏ QUA tuyến hỏng thay vì ném — cùng luật với `decodeSoundings`. Một tuyến
 * lỗi không được làm mất cả lớp.
 */
export function decodeSoundingRoutes(raw: unknown): SoundingRouteDecoded[] {
  const f = raw as Partial<SoundingsFile> | null;
  if (!f || !Array.isArray(f.tuyen)) return [];
  const notices = Array.isArray(f.thongBao) ? f.thongBao : [];
  const areas = Array.isArray(f.luong) ? f.luong : [];

  const out: SoundingRouteDecoded[] = [];
  for (const r of f.tuyen) {
    if (!r || !Array.isArray(r.diem) || r.diem.length < 2) continue;
    const notice = notices[r.tb];
    if (!notice || typeof notice.ngay !== "string" || !notice.prov) continue;
    const points: LatLon[] = [];
    for (const c of r.diem) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const [lon, lat] = c;
      if (!inVietnamSea(lat, lon)) continue;
      points.push({ lat, lon });
    }
    if (points.length < 2) continue;
    const sauM = r.sau === null || r.sau === undefined ? null : Math.round(Number(r.sau)) / 10;
    out.push({
      ten: typeof r.ten === "string" && r.ten ? r.ten : null,
      points,
      sauM: sauM !== null && Number.isFinite(sauM) ? sauM : null,
      at: notice.ngay,
      notice,
      area: areas[notice.luong] ?? null,
    });
  }
  return out;
}

/* ── 8. ĐỘ SÂU KHỐNG CHẾ VIẾT Ở VĂN XUÔI ────────────────────────────────── */

/**
 * Bảng tim tuyến KHÔNG có cột độ sâu; độ sâu của chính đoạn ấy nằm ở câu văn
 * ngay SAU bảng, đo thật trong thông báo 969/TBHH-CVHHKG (Năm Căn – Bồ Đề):
 *
 *     "Độ sâu đoạn luồng đạt 11,8 m."   ·   "Đ ộ sâu đoạn luồng đạt 10 ,0 mét."
 *
 * Hai chỗ phải chịu được: bộ bóc PDF tách chữ theo vị trí vẽ nên **khoảng
 * trắng rơi vào giữa chữ và giữa số** ("10 ,0", "2, 7"), và đơn vị viết cả
 * `m` lẫn `mét`.
 *
 * BẮT BUỘC có chữ "đạt": câu "Dải cạn có độ sâu TỪ 1,9m ĐẾN 2,2m" cũng có
 * "độ sâu" và cũng có số, nhưng đó là DẢI CẠN CẢNH BÁO chứ không phải độ sâu
 * khống chế — lẫn hai thứ là đưa bà con một con số sai chỗ.
 *
 * ## Assumptions
 * - "dương X m" (đáy luồng CAO HƠN mực nước "số 0 hải đồ") trả về số ÂM, cùng
 *   cách đọc mà `src/lib/fairway-depth.ts` đã lập luận từ văn bản gốc.
 * - Dải hợp lệ −2…30 m là **cùng con số và cùng lý do** với
 *   `FAIRWAY_DEPTH_MIN_M`/`FAIRWAY_DEPTH_MAX_M` của `fairway-depth.ts`. CỐ Ý
 *   không import: `soundings.ts` mà phụ thuộc file đó là kéo cả cây
 *   `route-plan → depth-grid → sea` vào bundle của app cho hai con số. Đổi một
 *   chỗ thì đổi cả hai — dòng này là mối nối.
 */
export const ROUTE_DEPTH_MIN_M = -2;
export const ROUTE_DEPTH_MAX_M = 30;

export function isPlausibleRouteDepth(m: number): boolean {
  return Number.isFinite(m) && m >= ROUTE_DEPTH_MIN_M && m <= ROUTE_DEPTH_MAX_M;
}

/**
 * Khoảng cách cho phép giữa chữ "độ sâu" và chữ "đạt" trong CÙNG một câu.
 *
 * ⚠️ ĐO THẬT trước khi đổi con số này. Bản đầu để 80 và **chặn đứng cả một
 * vùng**: câu chuẩn của các cảng vụ miền Nam dài hơn thế —
 *
 *     "Độ sâu được xác định bằng máy đo sâu hồi âm tần số 200 kHz
 *      tính đến mực nước "số 0 Hải đồ" đạt 12,66 m"          ← 85 ký tự
 *
 * và khi bộ bóc PDF rắc khoảng trắng vào giữa chữ thì đúng câu ấy dài tới
 * **107**. Hậu quả đo được: Bình Thuận có 33 PDF CÓ LỚP CHỮ mà ra 0 điểm;
 * Kiên Giang, Thừa Thiên Huế, Quảng Trị cùng dính. 120 ôm trọn câu dài nhất
 * gặp thật (107) còn dư một chút — KHÔNG phải số chọn cho tròn.
 *
 * Nới ra thì rủi ro vớ nhầm câu khác tăng, chặn bằng hai thứ và cả hai đều có
 * ca test: `[^.]` cấm bước qua dấu chấm (tức qua câu khác), và BẮT BUỘC có chữ
 * "đạt" nên câu cảnh báo "Dải cạn có độ sâu TỪ 1.9m ĐẾN 2.2m" không lọt.
 */
const CONTROLLING_RE =
  /đ\s*ộ\s*s\s*â\s*u[^.]{0,120}?đ\s*ạ\s*t\s*(?:kho\s*ả\s*ng)?\s*:?\s*(d\s*ư\s*ơ\s*n\s*g)?\s*(\d{1,3}(?:\s*[.,]\s*\d{1,2})?)\s*(?:m\b|mé\s*t)/i;

/**
 * Câu văn sau bảng → độ sâu khống chế (m). `null` khi không có câu nào hoặc
 * số đọc ra vô lý — người gọi ghi `null`, KHÔNG đoán và KHÔNG coi là 0.
 */
export function readControllingDepthM(text: string): number | null {
  if (typeof text !== "string" || !text) return null;
  const m = CONTROLLING_RE.exec(text);
  if (!m) return null;
  const raw = Number.parseFloat(m[2].replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(raw)) return null;
  const v = Math.round((m[1] ? -raw : raw) * 10) / 10;
  return isPlausibleRouteDepth(v) ? v : null;
}

/* ── 9. NGÀY BAN HÀNH CÓ ĐÁNG TIN KHÔNG ─────────────────────────────────── */

/** Năm sớm nhất còn nhận là ngày ban hành thật của một thông báo hàng hải. */
export const NOTICE_YEAR_MIN = 2000;

/**
 * Bản lưu trữ KHÔNG có danh mục để hỏi ngày, nên ngày phải bóc từ chính PDF —
 * và đó là chỗ có bẫy: bản ký số thường **để trống ô ngày** ("Số:    /TBHH-…,
 * ngày    tháng    năm    "), nên bộ đọc trượt xuống và vớ phải ngày của một
 * VĂN BẢN ĐƯỢC DẪN trong phần căn cứ — "Nghị định 58/2017 ngày 10/5/2017".
 * Kết quả: một khảo sát năm 2025 bị ghi là đo năm 2017. Không cổng nào khác
 * chặn được: ngày đúng khuôn, năm có thật, điểm vẫn nằm trong khung biển. Và
 * một số đo sâu gắn sai năm là thứ nguy hiểm hơn không có số đo sâu.
 *
 * Cổng: ngày chỉ đáng tin khi NĂM của nó khớp năm của chính bản lưu trữ (đọc
 * từ đường dẫn `/uploads/<năm>/<tháng>/`), lệch tối đa một năm — thông báo ký
 * cuối tháng 12 có thể được đăng sang tháng 1. Không khớp thì người gọi phải
 * lùi về năm-tháng của bản lưu, KHÔNG được dùng ngày vừa đọc.
 */
export function trustNoticeDate(iso: string, namNguon: number | null, namToiDa = 2100): boolean {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  if (new Date(t).toISOString().slice(0, 10) !== iso) return false; // 2026-02-31
  const nam = Number(iso.slice(0, 4));
  if (nam < NOTICE_YEAR_MIN || nam > namToiDa) return false;
  if (namNguon === null || !Number.isFinite(namNguon)) return true;
  return Math.abs(nam - namNguon) <= 1;
}

/* ── 10. CHỮ BÓC BẰNG OCR (ẢNH SCAN) ────────────────────────────────────── */

/*
  985/2.261 thông báo trong kho là ẢNH SCAN — không có lớp chữ, nên đường ống
  cũ bỏ hết vào `boSot`. `scripts/ocr-soundings.mjs` chạy OCR cho chúng rồi
  nộp lại CHÍNH những dòng chữ ấy cho `readNotice`. Nhưng chữ OCR KHÔNG giống
  chữ bóc từ lớp text, và ba khác biệt dưới đây làm hỏng bộ đọc toạ độ nếu
  không gột trước. Đo thật trên 976/TBHH-CVHHHP và 859/TBHH-CVHHHP:

    ·  ký tự "độ" KHÔNG có trong bảng chữ của mô hình → nó đoán ra một CHỮ SỐ:
       `20°48'11,3"` ra thành `20948'11.3"`, `106°54'` ra thành `106054'`
    ·  chữ cái đội lốt chữ số ở ô độ sâu: `1,5m` ra `1,Sm`, `1,0m` ra `I,Om`,
       `200kHz` ra `2OOkHz` — đọc `1,Sm` là mất trắng một câu độ sâu
    ·  ô toạ độ trong bảng KHÔNG in chữ N/E (chữ ấy nằm ở dòng tiêu đề cột
       "Vĩ độ (N) | Kinh độ (E)"), mà `parseSoundingRow` lại BẮT BUỘC có

  Ba hàm dưới đây gột đúng ba thứ đó và KHÔNG gột gì thêm. Nguyên tắc xuyên
  suốt: chỗ nào còn HAI cách đọc đều hợp lý thì BỎ DÒNG, không bốc thăm —
  một toạ độ đoán sai là một điểm cạn đặt nhầm chỗ giữa luồng.
*/

/**
 * Chữ cái đội lốt chữ số → chữ số. Chỉ sửa khi cụm chữ đó CÓ BẰNG CHỨNG là
 * một con số, và có đúng hai thứ được nhận làm bằng chứng:
 *
 *   (1) trong cụm đã có sẵn ít nhất một CHỮ SỐ THẬT (`1,Sm`, `2OOkHz`) — một
 *       cụm liền mạch chỉ gồm `[0-9OoSsIiLlZzBbGgTt.,]` mà có chữ số thì gần
 *       như chắc chắn là con số bị đọc lẫn, không phải từ tiếng Việt (từ tiếng
 *       Việt có nguyên âm/dấu nằm ngoài lớp ký tự này nên không tạo được cụm);
 *   (2) cụm có DẤU THẬP PHÂN ở giữa và dính ngay ĐƠN VỊ `m` (`I,Om`) — cấu
 *       trúc "phần nguyên , phần lẻ + đơn vị" là cấu trúc của một phép đo, và
 *       không từ tiếng Việt nào có hình dạng đó.
 *
 * Ngoài hai thứ ấy thì KHÔNG sửa. Vì vậy `khoảng IOm` (không chữ số, không dấu
 * thập phân) vẫn để nguyên — nó *có thể* là 10 m nhưng không có gì làm chứng,
 * và nó là bề rộng dải cạn chứ không phải độ sâu. Thà bỏ còn hơn đoán.
 */
const OCR_CHU_SO: Record<string, string> = {
  O: "0",
  o: "0",
  I: "1",
  i: "1",
  L: "1",
  l: "1",
  Z: "2",
  z: "2",
  S: "5",
  s: "5",
  G: "6",
  g: "9",
  T: "7",
  t: "7",
  B: "8",
  b: "8",
};
const OCR_CUM_RE = /[0-9OoIiLlZzSsGgTtBb][0-9OoIiLlZzSsGgTtBb.,]*/g;

/** Cụm dạng "phần nguyên , phần lẻ" — bằng chứng (2), xem `repairOcrDigits`. */
const OCR_DANG_DO_RE = /^[0-9OoIiLlZzSsGgTtBb]{1,3}[.,][0-9OoIiLlZzSsGgTtBb]{1,2}$/;

export function repairOcrDigits(line: string): string {
  if (typeof line !== "string" || !line) return "";
  return line.replace(OCR_CUM_RE, (cum, off: number, full: string) => {
    if (!/[OoIiLlZzSsGgTtBb]/.test(cum)) return cum; // không có gì để sửa
    const laDo = OCR_DANG_DO_RE.test(cum) && /^m(?![a-zà-ỹ])/i.test(full.slice(off + cum.length));
    if (!/\d/.test(cum) && !laDo) return cum; // không có bằng chứng → không đoán
    return cum.replace(/[OoIiLlZzSsGgTtBb]/g, (c) => OCR_CHU_SO[c] ?? c);
  });
}

/**
 * `20948'11.3"` → có thể là 20°48'11,3" hoặc 209°48'11,3". Sinh MỌI cách tách
 * hợp lệ của cụm số đứng trước dấu phút: `độ (2–3 chữ số) + rác (0–2 chữ số,
 * chính là ký tự "độ" bị đọc lẫn) + phút (2 chữ số)`. Khung biển VN dùng ở đây
 * để CHỌN cách tách, cổng chặn cuối vẫn là `inVietnamSea` như mọi đường khác.
 */
type OcrDms = { kind: CoordKind; deg: number; min: number; sec: number; value: number };

function ocrDmsCandidates(run: string, secTxt: string): OcrDms[] {
  const sec = secTxt ? Number.parseFloat(secTxt.replace(",", ".")) : 0;
  if (!Number.isFinite(sec) || sec >= 60) return [];
  const out: OcrDms[] = [];
  for (const nDeg of [2, 3]) {
    const nJunk = run.length - nDeg - 2;
    if (nJunk < 0 || nJunk > 2) continue;
    const deg = Number(run.slice(0, nDeg));
    const min = Number(run.slice(nDeg + nJunk));
    if (!Number.isFinite(deg) || !Number.isFinite(min) || min >= 60) continue;
    const value = deg + min / 60 + sec / 3600;
    if (nDeg === 2 && value >= VN_SEA_BBOX.south && value <= VN_SEA_BBOX.north) {
      out.push({ kind: "lat", deg, min, sec, value });
    }
    if (nDeg === 3 && value >= VN_SEA_BBOX.west && value <= VN_SEA_BBOX.east) {
      out.push({ kind: "lon", deg, min, sec, value });
    }
  }
  return out;
}

const OCR_TOKEN_RE = /(\d{4,7})\s*['’′´]\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:["”″]|['’′´]{1,2})?/g;

const dmsText = (d: OcrDms, hemi: string): string =>
  `${d.deg}°${String(d.min).padStart(2, "0")}'${String(d.sec).replace(".", ",")}"${hemi}`;

/**
 * Một dòng OCR → dòng viết đúng khuôn thông báo (có ký tự độ, có N/E), để
 * `parseSoundingRow` đọc được mà KHÔNG phải nới lỏng bộ đọc dùng chung.
 *
 * Ghép CẶP theo thứ tự cột của mọi bảng thông báo hàng hải: vĩ độ trước, kinh
 * độ sau. Một cặp chỉ được viết lại khi có ĐÚNG MỘT cách đọc rơi vào khung
 * biển Việt Nam. Không cách nào, hoặc từ hai cách trở lên → trả `null` cho cả
 * dòng (người gọi ghi `boSot`), vì đoán ở đây là đặt một điểm cạn vào một toạ
 * độ không có thật.
 */
export function ocrCoordLine(line: string): string | null {
  if (typeof line !== "string" || !line) return null;
  // Dòng nào OCR đọc trúng luôn (có ký tự độ + N/E) thì để nguyên, đừng đụng.
  if (parseSoundingRow(line)) return line;

  OCR_TOKEN_RE.lastIndex = 0;
  const toks: Array<{ start: number; end: number; cands: OcrDms[] }> = [];
  let m: RegExpExecArray | null;
  while ((m = OCR_TOKEN_RE.exec(line)) !== null) {
    if (batDauGiuaSo(line, m.index)) {
      OCR_TOKEN_RE.lastIndex = m.index + 1;
      continue;
    }
    toks.push({ start: m.index, end: m.index + m[0].length, cands: ocrDmsCandidates(m[1], m[2]) });
  }
  if (toks.length < 2) return null;

  const thay: Array<{ start: number; end: number; txt: string }> = [];
  for (let i = 0; i + 1 < toks.length; i += 2) {
    const a = toks[i];
    const b = toks[i + 1];
    const hop: Array<[OcrDms, OcrDms]> = [];
    for (const la of a.cands) {
      if (la.kind !== "lat") continue;
      for (const lo of b.cands) {
        if (lo.kind !== "lon") continue;
        if (inVietnamSea(la.value, lo.value)) hop.push([la, lo]);
      }
    }
    if (hop.length !== 1) return null; // 0 = không đọc được, ≥2 = mập mờ → BỎ
    thay.push({ start: a.start, end: a.end, txt: dmsText(hop[0][0], "N") });
    thay.push({ start: b.start, end: b.end, txt: dmsText(hop[0][1], "E") });
  }
  if (!thay.length) return null;

  let out = "";
  let cur = 0;
  for (const t of thay) {
    out += line.slice(cur, t.start) + t.txt;
    cur = t.end;
  }
  return out + line.slice(cur);
}

/**
 * Một dòng OCR thô → dòng nộp cho `readNotice`. Gột chữ số trước, dựng toạ độ
 * sau; dòng nào không phải hàng toạ độ thì giữ nguyên phần chữ đã gột (văn xuôi
 * "độ sâu đạt …" đi đường này).
 */
/**
 * OCR DÍNH THÊM một chữ số ngay sau DẤU GIÂY đóng toạ độ. Bảng thật in
 * `10°07'35,9"` thì chữ ra `10907'35,9"1` — dấu độ thành `9`, và thừa một
 * chữ `1` sau dấu giây.
 *
 * Nhiễu này KHÔNG vô hại. Nó là nguồn gốc của gần hết số đo sâu GIẢ trong đợt
 * miền Nam, qua một đường vòng dễ bỏ sót:
 *
 *   raw   `A 10907'35,9"1 105941'10,8"5`
 *   sau khi `ocrCoordLine` dựng lại  →  `A 10°07'35,9"N1 105°41'10,8"E5`
 *
 * Tức chính bộ dựng toạ độ CHÈN chữ `N`/`E` vào, dán liền chữ số nhiễu đứng
 * sau. Rồi `parseSoundingRow` ăn hết hai toạ độ, thấy còn đúng một chữ `5` ở
 * cuối hàng — mà khuôn CHO PHÉP ô độ sâu nằm cuối hàng (vài cảng vụ in vậy).
 * Thế là một hàng chỉ có toạ độ góc vùng bỗng mang "độ sâu 5 m". Đo thật:
 * 5/11 thông báo miền Nam sinh điểm từ đúng cái nhiễu này, và vì nhiễu luôn là
 * SỐ NGUYÊN nên tỉ lệ mét chẵn của điểm OCR vọt lên 65% (nền: 14%).
 *
 * Vì vậy phải gỡ TRƯỚC khi dựng toạ độ, và gỡ ở dạng RAW — lúc đó chưa có chữ
 * bán cầu nào cả. Chữ bán cầu để `?` vì bảng nào OCR đọc trúng thì nó có sẵn.
 *
 * Hai điều kiện làm luật này an toàn:
 *   · chữ số phải DÍNH LIỀN dấu giây (không khoảng trắng) — ô độ sâu thật đứng
 *     cuối hàng luôn cách ít nhất một khoảng trắng (`…"E 7,5`), nên không đụng tới;
 *   · chữ số phải KẾT THÚC token (`(?=\s|$)`) — nếu không thì bản đầu của hàm
 *     này đã ăn mất kinh độ trong `11°18'27,81"N108°48'28"E`, biến nó thành
 *     `"N°48'28"E`. Sai mà vẫn chạy, không cổng nào đỏ; bắt được nhờ so dòng
 *     dựng lại với dòng đã lưu.
 */
const OCR_NHIEU_SAU_GIAY = /(["”″'’′][NSEWnsew]?)\d{1,2}(?=\s|$)/g;

export function stripOcrHemisphereNoise(line: string): string {
  if (typeof line !== "string" || !line) return "";
  return line.replace(OCR_NHIEU_SAU_GIAY, "$1");
}

export function ocrLineToNoticeLine(line: string): string {
  // Gỡ nhiễu bán cầu TRƯỚC: `ocrCoordLine` trả nguyên dòng khi
  // `parseSoundingRow` đã đọc được, nên nhiễu còn sót là nhiễu đi thẳng vào
  // cột độ sâu.
  const sach = repairOcrDigits(stripOcrHemisphereNoise(line));
  return ocrCoordLine(sach) ?? sach;
}

/**
 * CỔNG ĐỘC LẬP VỚI OCR — "tỉ lệ số mét chẵn".
 *
 * Máy hồi âm ghi tới 0,1 m, nên một cột độ sâu thật hầu như không bao giờ toàn
 * số nguyên. Bảng nào có từ 8 số trở lên mà trên 80% là mét chẵn thì hoặc đó
 * KHÔNG phải cột độ sâu (là cột số thứ tự / tên điểm), hoặc OCR đã đánh rơi
 * phần thập phân — cả hai đều dẫn tới số đo sâu sai ở một toạ độ thật.
 *
 * Cổng này KHÔNG dùng gì của OCR để phán, nên nó bắt được lỗi mà chính OCR gây
 * ra. Đây là bài học `7,7` bị đọc thành `7` đã làm hỏng 16/17 số của một thông
 * báo trong đợt trước.
 */
export const OCR_WHOLE_METRE_MIN = 8;
export const OCR_WHOLE_METRE_MAX_RATIO = 0.8;

export function wholeMetreRatio(literals: readonly string[]): number {
  if (!Array.isArray(literals) || !literals.length) return 0;
  let n = 0;
  let chan = 0;
  for (const l of literals) {
    if (typeof l !== "string" || !/\d/.test(l)) continue;
    n++;
    if (!/[.,]/.test(l)) chan++;
  }
  return n ? chan / n : 0;
}

export function isSuspectWholeMetreTable(literals: readonly string[]): boolean {
  const n = Array.isArray(literals)
    ? literals.filter((l) => typeof l === "string" && /\d/.test(l)).length
    : 0;
  if (n < OCR_WHOLE_METRE_MIN) return false;
  return wholeMetreRatio(literals) > OCR_WHOLE_METRE_MAX_RATIO;
}

/**
 * CỔNG ĐỘC LẬP VỚI OCR #2 — MỘT THÔNG BÁO CHỈ NÓI VỀ MỘT CHỖ.
 *
 * Một thông báo hàng hải mô tả MỘT đoạn luồng, MỘT vũng quay tàu, MỘT khu nước
 * trước bến. Các đỉnh của nó không thể cách nhau hàng trăm cây số. Cổng này
 * không cần biết gì về OCR, nên nó bắt được đúng loại lỗi mà OCR gây ra và
 * không cổng nào khác thấy.
 *
 * Đã bắt được thật (2026-09-01): `2980/TBHH-CVHHHP` — "vùng nước trước bến cảng
 * dầu Thượng Lý", Hải Phòng. Bộ dựng dòng OCR đan hai hàng bảng vào nhau làm
 * `106°39'` rụng mất chữ số đầu thành `10°39'`, và đỉnh ấy rơi xuống 10,66°B —
 * giữa Thành phố Hồ Chí Minh, cách hai đỉnh còn lại 1.137 km. Mọi cổng cũ đều
 * XANH: toạ độ trong khung biển VN, độ sâu 3,8 m hợp lý, số hiệu khớp cơ quan
 * ban hành, ngày đứng vững. Một đoạn luồng Hải Phòng vắt xuống Sài Gòn.
 *
 * Trần 50 km chọn theo số đo, không chọn cho tròn: trong 96 tuyến bóc từ PDF CÓ
 * LỚP CHỮ, tuyến "toè" nhất là 15 km. 50 km để rộng gấp ba lần cái rộng nhất
 * từng gặp thật, mà vẫn chặn đúng một tuyến hỏng duy nhất.
 */
export const ROUTE_SPREAD_MAX_KM = 50;

/** Khoảng cách xa nhất từ TÂM (trung vị) tới một đỉnh của tuyến, km. */
export function routeSpreadKm(diem: readonly (readonly number[])[]): number {
  if (!Array.isArray(diem) || !diem.length) return 0;
  const pts = diem
    .filter((d) => Array.isArray(d) && Number.isFinite(d[0]) && Number.isFinite(d[1]))
    .map((d) => ({ lon: d[0], lat: d[1] }));
  if (!pts.length) return 0;
  // Trung vị, KHÔNG phải trung bình: một đỉnh sai lệch hàng nghìn km sẽ kéo
  // trung bình đi theo nó và tự giấu mình.
  const lon = [...pts.map((p) => p.lon)].sort((a, b) => a - b);
  const lat = [...pts.map((p) => p.lat)].sort((a, b) => a - b);
  const tam = { lon: lon[lon.length >> 1], lat: lat[lat.length >> 1] };
  return pts.reduce((m, p) => Math.max(m, haversineKm(tam, p)), 0);
}

export function isCoherentRoute(diem: readonly (readonly number[])[]): boolean {
  return routeSpreadKm(diem) <= ROUTE_SPREAD_MAX_KM;
}

/**
 * CỔNG ĐỘC LẬP VỚI OCR #3 — CỘT ĐỘ SÂU THẬT THÌ ĐIỀN KÍN, CỘT TÊN ĐIỂM THÌ KHÔNG.
 *
 * `hasDepthColumn` chặn được cột tên khi tên có chữ ("DHN - 0 6") hoặc khi cả
 * cột toàn số nguyên. Nó KHÔNG chặn được ca này, và OCR sinh ra ca này:
 *
 *     985/TBHH-CVHHQT — bảng có 11 hàng, cột đầu là TÊN ĐIỂM:
 *     B1 · KNA · KN7 · KN9 · KN3 · KN2 · B2 · BL.1 …
 *     OCR đọc `BL.1` thành `81.1`. Có dấu thập phân nên `hasDepthColumn` gật
 *     đầu, 81,1 m thì dưới trần 200 m nên cổng dải cũng gật. Kết quả: MỘT số
 *     đo sâu 81,1 m đặt vào một toạ độ THẬT, trong một vũng cảng mà chính
 *     thông báo ấy nói "độ sâu đạt: 2,1 m". Không cổng nào đỏ.
 *
 * Chỗ phân biệt được: **máy khảo sát đo hết mọi điểm nó liệt kê**, nên cột độ
 * sâu thật gần như luôn điền kín. Cột TÊN thì chỉ tình cờ có vài ô trông giống
 * số — ở đây đúng 1/11. Đòi phủ tối thiểu 60% là bỏ xa cả hai phía: bảng thật
 * điền ~100%, bảng tên điền vài phần trăm.
 *
 * Chỉ áp cho ĐƯỜNG OCR. Đường bóc từ lớp chữ chưa gặp ca nào cần tới nó, và
 * nới/siết một cổng dùng chung mà không có ca thật là đoán.
 */
export const OCR_DEPTH_COVERAGE_MIN = 0.6;

/** Tỉ lệ hàng có ô độ sâu đọc được trên tổng số hàng của bảng. */
export function depthColumnCoverage(rows: readonly SoundingRow[]): number {
  if (!Array.isArray(rows) || !rows.length) return 0;
  const n = rows.filter((r) => r && r.depthM !== null).length;
  return n / rows.length;
}

export function isSparseDepthColumn(rows: readonly SoundingRow[]): boolean {
  if (!Array.isArray(rows) || !rows.length) return false;
  return depthColumnCoverage(rows) < OCR_DEPTH_COVERAGE_MIN;
}

/**
 * CỔNG ĐỘC LẬP VỚI OCR #4 — RA KHỎI ĐỊA BÀN CỦA CHÍNH NGUỒN.
 *
 * Thông báo hàng hải nói về LUỒNG — CỬA BIỂN — VŨNG CẢNG. Không cảng vụ nào ra
 * giữa Biển Đông cắm mốc luồng. Nên một tuyến vừa CÁCH BỜ hàng chục km vừa nằm
 * trên vùng nước SÂU là toạ độ đọc sai, không phải dữ liệu hiếm.
 *
 * Vì sao phải có CẢ HAI vế: khoảng cách tới bờ MỘT MÌNH thì kết tội oan cảng
 * sông. Cần Thơ nằm 52 km ngược sông Hậu — xa bờ y như một điểm sai ngoài
 * khơi. Cái tách hai ca đó ra là lớp độ sâu của chính app: cảng sông rơi vào
 * lớp 0 (đất/sông, ETOPO không thấy lòng sông), còn điểm sai ngoài khơi rơi
 * vào lớp "đủ sâu" (biển khơi — `DEPTH_CLASS_DEEP`, là 3 ở lưới 2 bit cũ và 5
 * ở lưới 6 lớp từ 2026-09-04).
 *
 * Đo thật 2026-09-01, đợt OCR miền Nam — ba tuyến bị bắt, cả ba đều được HAI
 * mô hình độ sâu độc lập xác nhận là sai sau đó:
 *   · 307/TBHH-TCTBDATHHMN  52 km, lớp 3 — mô hình nói 248–249 m, ghi 5,3 m
 *   · 141/TBHH-TCTBDATHHMN  50 km, lớp 3 — mô hình nói 222–227 m, ghi 1,0 m
 *   · 02/TBHH-CVĐTNĐIV      46 km, lớp 3 — mô hình nói 109–127 m, ghi 9,0 m
 * Trong khi 231 và 268/TBHH-CVHHCT (cảng sông Cần Thơ, 21–52 km, lớp 0) KHÔNG
 * bị đụng tới. Và KHÔNG một tuyến nào bóc từ lớp chữ nằm quá 17,8 km khỏi bờ,
 * nên trần 20 km không cắt vào dữ liệu đang có.
 */
export const OFFSHORE_MIN_KM = 20;

export function isOutsideSourceDomain(
  distToCoastKm: number,
  depthClass: number | null,
): boolean {
  if (!Number.isFinite(distToCoastKm)) return false;
  if (distToCoastKm <= OFFSHORE_MIN_KM) return false;
  // "đủ sâu" (biển khơi) — lớp cao nhất của `depth-grid.ts` (5 từ bản 6 lớp 2026-09-04)
  return depthClass === DEPTH_CLASS_DEEP;
}

/*
  NẠP LỚP ĐỘ SÂU (2026-08-31).

  Vì sao mãi tới giờ mới có: file `soundings.v1.json` đã nằm trong repo và được
  đẩy xuống máy bà con từ đợt trước, nhưng KHÔNG có dòng code nào đọc nó — mọi
  tham chiếu trong `src/` đều là chú thích. 379 số đo sâu của cơ quan nhà nước
  nằm trong máy mà không ai nhìn thấy. Đây là chỗ nối.

  Nạp MỘT LẦN rồi giữ trong `cached`: 379 điểm + 96 tuyến giải mã lại mỗi lần
  chuyển màn là phí, và chuyển màn thì hay xảy ra lúc đang chạy tàu.

  Hỏng thì XOÁ `cached` để lần sóng về sau thử lại — mất sóng không được khoá
  vĩnh viễn (cùng luật với `fetchSeamarks`). Đồng hồ 20 giây: ngoài khơi sóng
  chập chờn, một request treo vô hạn là một màn hình đứng.
*/
let cachedSoundings: Promise<SoundingsBundle> | null = null;

export type SoundingsBundle = {
  diem: Sounding[];
  tuyen: SoundingRouteDecoded[];
};

export async function fetchSoundings(): Promise<SoundingsBundle> {
  if (!cachedSoundings) {
    cachedSoundings = fetchDataJson("/data/soundings.v1.json", 20000, "soundings")
      .then((raw) => ({
        diem: decodeSoundings(raw),
        tuyen: decodeSoundingRoutes(raw),
      }))
      .catch((e) => {
        cachedSoundings = null; // lần sau thử lại
        throw e;
      });
  }
  return cachedSoundings;
}
