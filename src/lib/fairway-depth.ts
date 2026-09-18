/**
 * Truc 1 — DO SAU KHONG CHE CUA TUNG DOAN LUONG (fairway controlling depth).
 *
 * File nay giu TYPE + BO NHAN DANG VAN BAN + BA CONG AN TOAN (thuan, test
 * duoc) cho dataset tinh `public/data/fairway-depths.v1.json`, sinh boi
 * `scripts/link-fairway-depths.mjs`. File nay KHONG fetch, KHONG ve, KHONG doc
 * dong ho may — moi moc thoi gian truyen vao dang "YYYY-MM-DD".
 *
 * (Chu thich trong file nay viet KHONG DAU o phan tieu de de tranh lan voi
 * chinh cac chuoi tieng Viet CO DAU ma bo nhan dang phai so khop — phan giai
 * thich nghiep vu ben duoi van viet binh thuong.)
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Thông báo hàng hải ở Hải Phòng chiếm 32% cả kho (2.649/8.163) nhưng bóc ra
 * KHÔNG một điểm đo sâu nào: các cảng vụ phía Bắc không đăng bảng toạ độ điểm
 * cạn, họ viết theo ĐOẠN:
 *
 *     "Đoạn luồng từ cặp phao số 5, 6 đến cặp phao số 17, 18:
 *      … độ sâu đạt: 2.3m"
 *
 * Toạ độ của chính những cái phao đó thì app ĐÃ CÓ trong
 * `public/data/vn-aids.v1.json` (437 báo hiệu, 21 tuyến luồng, do Cục Hàng hải
 * công bố). Nối hai thứ lại là ra thứ bà con cần khi vào cửa lạch: độ sâu
 * khống chế của TỪNG ĐOẠN luồng, kèm ngày đo.
 *
 * ── ĐÂY LÀ KIỂU DỮ LIỆU KHÁC "SỐ ĐO SÂU" ──────────────────────────────────
 * `src/lib/soundings.ts` giữ ĐIỂM ("sâu ĐÚNG CHỖ NÀY 7,5 m"). File này giữ
 * ĐOẠN ("chỗ NÔNG NHẤT trong cả đoạn là 2,3 m"). Hai thứ không thay nhau
 * được và không nên trộn vào một lớp: một cái trả lời "dưới đáy tàu còn bao
 * nhiêu", cái kia trả lời "đi hết đoạn này có mắc cạn không".
 *
 * ── BA CHỖ DỄ SAI CHẾT NGƯỜI, MỖI CHỖ MỘT CỔNG ────────────────────────────
 * Án lệ của đợt trước (`soundings.ts`): chuỗi "DHN - 0 6" là TÊN ĐIỂM bị đọc
 * thành ĐỘ SÂU 6 m, ở toạ độ thật, trong dải hợp lý — không cổng nào chặn
 * được, đã sinh 4 điểm giả. Ba cổng dưới đây dựng để chặn đúng loại sai đó:
 *
 *  1. `chooseFairwaySegment` — KHỚP NHẦM PHAO. "Phao 5" có ở nhiều tuyến, và
 *     ngay TRONG tuyến Hải Phòng cũng có hai dãy phao số trùng nhau (Nam
 *     Triệu và Lạch Huyện, cách nhau ~4 km). Ghép nhầm là ra một đoạn dài vô
 *     lý hoặc lệch hẳn sang dãy khác. Cổng: chiều dài đoạn phải nằm trong dải
 *     hợp lý, VÀ khi còn nhiều cách ghép cho ra vị trí khác nhau thì BỎ, ghi
 *     lý do — không đoán.
 *  2. `isPlausibleFairwayDepth` — SỐ HIỆU PHAO ĐỌC THÀNH ĐỘ SÂU. Cổng: độ sâu
 *     phải trong dải hợp lý cho luồng, VÀ nếu con số viết không có phần thập
 *     phân mà lại trùng số hiệu phao trong cùng câu thì BỎ.
 *  3. `keepNewestPerSegment` — THÔNG BÁO CŨ ĐÈ THÔNG BÁO MỚI. Luồng được nạo
 *     vét thì độ sâu đổi; cùng một đoạn thì chỉ giữ bản MỚI NHẤT theo ngày
 *     (bằng ngày thì giữ bản NÔNG HƠN — an toàn hơn cho tàu).
 *
 * ## Assumptions
 * - Trần độ sâu 30 m cho luồng: luồng sâu nhất Việt Nam (Lạch Huyện) công bố
 *   quanh 13–14 m. Số lớn hơn 30 m gần như chắc chắn là bóc nhầm (bề rộng
 *   luồng, chiều dài dải cạn, cao độ tĩnh không cầu). Đây KHÔNG phải giới hạn
 *   của biển Việt Nam, chỉ là giới hạn của nguồn này.
 * - Sàn -2 m: thông báo THẬT có ghi "độ sâu đạt 0.0m" (luồng Lệ Môn bồi lấp
 *   hoàn toàn) và "đạt khoảng dương 0,2m" (luồng Diêm Điền, đáy CAO HƠN mặt
 *   chuẩn). Đó là số thật và là số quan trọng nhất với bà con, KHÔNG được
 *   loại như rác. Dưới -2 m thì đó là bãi khô, không còn là luồng — bóc nhầm.
 * - Trần chiều dài đoạn 25 km: đoạn dài nhất đo được trong nguồn (Lạch Huyện,
 *   phao 0 → cặp phao 29-30) khoảng 14 km. 25 km để chỗ cho luồng dài hơn mà
 *   vẫn chặn được kiểu ghép nhầm sang tuyến khác (thường hàng trăm km).
 * - "dương X m" đọc là ĐỘ SÂU ÂM (đáy cao hơn mực nước "số 0 hải đồ" X mét).
 *   Nguồn không định nghĩa chữ này, nên suy ra từ chính văn bản: thông báo
 *   409/TBHH-CVHHTB viết đoạn luồng "đạt khoảng dương 0,2m" rồi ngay sau đó
 *   nói dải CẠN trong đoạn ấy "có độ sâu từ dương 1,3m đến dương 0,3m". Đọc
 *   theo nghĩa thường thì dải CẠN lại SÂU HƠN cả đoạn — vô lý; đọc theo nghĩa
 *   "trên mặt chuẩn" thì dải cạn cao hơn đáy luồng, đúng. Cách viết tường
 *   minh của cùng cảng vụ ở thông báo khác ("0.1m (trên mực nước số 0 Hải
 *   đồ)") xác nhận cách đọc này. Gặp 1/85 văn bản đọc được.
 * - Mốc "thượng lưu/hạ lưu phao X khoảng N m" được neo VÀO CHÍNH PHAO X và
 *   đánh dấu `xapXi: true`. Nguồn không cho toạ độ của điểm lệch đó; bỏ cả
 *   đoạn vì vài trăm mét là mất phần lớn dữ liệu, còn im lặng làm như chính
 *   xác là hứa thứ nguồn không có. Nói thẳng ra là đường thứ ba.
 */

import { haversineKm, type LatLon } from "@/lib/route-plan";
import type { Provenance } from "@/lib/provenance";
import { fetchDataJson } from "@/lib/data-fetch";

/* ── 1. DẢI HỢP LỆ ──────────────────────────────────────────────────────── */

/**
 * Độ sâu khống chế nông nhất còn coi là số thật (m).
 *
 * ÂM là con số THẬT, không phải rác: thông báo viết "độ sâu đạt khoảng
 * DƯƠNG 0,2m" nghĩa là đáy luồng nằm CAO HƠN mực nước "số 0 hải đồ" 0,2 m —
 * luồng đã bồi lấp qua mặt chuẩn (409/TBHH-CVHHTB, luồng Diêm Điền). Đó là
 * con số đáng sợ nhất trong cả kho và là con số bà con cần nhất. Xem
 * Assumptions về cách đọc chữ "dương".
 */
export const FAIRWAY_DEPTH_MIN_M = -2;
/** Độ sâu khống chế sâu nhất còn hợp lý cho LUỒNG (m) — xem Assumptions. */
export const FAIRWAY_DEPTH_MAX_M = 30;
/** Đoạn ngắn nhất còn coi là đoạn thật (km) — dưới mức này là ghép trùng điểm. */
export const MIN_SEGMENT_KM = 0.05;
/** Đoạn dài nhất còn hợp lý (km) — xem Assumptions. */
export const MAX_SEGMENT_KM = 25;
/**
 * Hai cách ghép cho ra hai vị trí lệch nhau quá mức này (km) thì coi là KHÔNG
 * xác định được — bỏ đoạn. Dưới mức này thì chọn cách ghép ngắn nhất.
 */
export const AMBIGUOUS_KM = 0.5;

/**
 * CỔNG 2 — số hiệu phao đọc thành độ sâu (hoặc ngược lại).
 *
 * `literal` là con số ĐÚNG NHƯ THÔNG BÁO VIẾT ("2.3", "0.0", "8"). Thông báo
 * hàng hải luôn ghi độ sâu tới 0,1 m, nên một con số KHÔNG có phần thập phân
 * mà lại trùng số hiệu phao trong cùng câu ("từ phao số 5 đến phao số 8, độ
 * sâu 8m") là dấu hiệu bóc nhầm cột — thà bỏ còn hơn.
 */
export function isPlausibleFairwayDepth(
  depthM: number,
  literal: string,
  refNumbers: readonly string[] = [],
): boolean {
  if (!Number.isFinite(depthM)) return false;
  if (depthM < FAIRWAY_DEPTH_MIN_M || depthM > FAIRWAY_DEPTH_MAX_M) return false;
  if (/[.,]/.test(literal)) return true;
  return !refNumbers.some((n) => n === literal.replace(/^0+(?=\d)/, ""));
}

/** CỔNG 1, vế dải — chiều dài đoạn có hợp lý cho một đoạn luồng không. */
export function isPlausibleSegmentKm(km: number): boolean {
  return Number.isFinite(km) && km >= MIN_SEGMENT_KM && km <= MAX_SEGMENT_KM;
}

/* ── 2. CHUẨN HOÁ CHỮ BÓC TỪ PDF ────────────────────────────────────────── */

/** Dấu ngăn DÒNG trong chuỗi phẳng — chọn ký tự không bao giờ có trong PDF. */
export const LINE_MARK = "\u0001";

/**
 * Nhiều dòng chữ bóc từ PDF → MỘT chuỗi phẳng để dò khuôn.
 *
 * Bộ bóc PDF tách chữ theo VỊ TRÍ VẼ, nên cùng một câu có thể ra
 * `Đ o ạ n lu ồ ng t ừ phao s ố 0` — khoảng trắng nằm giữa các con chữ chứ
 * không giữa các từ. Không có cách nào biết khoảng trắng nào là thật. Cách
 * duy nhất chạy được trên CẢ HAI kiểu là BỎ HẾT khoảng trắng: tiếng Việt viết
 * rời từng âm tiết nên chuỗi không dấu cách vẫn dò khuôn được, và số thì
 * không dính vào nhau vì luôn có chữ hoặc dấu chen giữa.
 */
export function flattenNoticeText(lines: readonly string[]): string {
  return (
    LINE_MARK +
    lines
      .map((l) => String(l ?? "").normalize("NFC"))
      .join(LINE_MARK)
      .replace(/[ \t\u00a0]+/g, "")
      .toLowerCase()
  );
}

/**
 * PDF có lớp chữ nhưng bảng mã hỏng thì ra rác (`; X© W K LË Q`) — vẫn nhiều
 * dòng, vẫn ghi được file, không cổng nào đỏ. Hai từ này có trong MỌI thông
 * báo hàng hải; không thấy cả hai nghĩa là chữ không đọc được.
 */
export function isReadableNotice(flat: string): boolean {
  return flat.includes("hànghải") && flat.includes("độsâu");
}

/** Bỏ dấu ngăn dòng + ngoặc đơn để so khớp tên. */
function bare(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(new RegExp(LINE_MARK, "g"), "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[\s.]+/g, "");
}

/**
 * Tên báo hiệu → dạng so khớp được.
 *
 * Nhà nước đặt tên một kiểu (`nm` trong `vn-aids.v1.json`: "Phao 5",
 * "Phao số 24", "Tiêu SC5", "Đăng tiêu 3", "ĐT A", "P2A"), thông báo viết một
 * kiểu ("phao số 5", "phao 5", "đăng tiêu SC5"). Không gom về một dạng là mất
 * đúng phần dữ liệu lớn nhất.
 */
export function normalizeAidName(raw: string): string {
  let s = bare(raw);
  if (!s) return "";
  s = s.replace(/^đăngtiêu/, "tiêu").replace(/^đt/, "tiêu");
  s = s.replace(/^phaobáohiệu/, "phao");
  s = s.replace(/^(phao|tiêu)số/, "$1");
  if (/^p\d/.test(s)) s = "phao" + s.slice(1);
  return s;
}

/* ── 3. ĐỌC MỐC ĐẦU ĐOẠN ────────────────────────────────────────────────── */

/** Một đầu đoạn đã đọc được: một hoặc hai báo hiệu (cặp phao thì lấy điểm giữa). */
export type AidRef = {
  /** loại báo hiệu, dùng dựng nhãn tiếng Việt */
  loai: "phao" | "tiêu";
  /** tên đã chuẩn hoá, 1 phần tử = một phao, 2 phần tử = cặp phao hai bên luồng */
  names: string[];
  /** số hiệu như thông báo viết ("5", "17") — dùng cho cổng 2 */
  numbers: string[];
  /** mốc là "thượng/hạ lưu phao X khoảng N m" → neo vào phao X, không đúng hệt */
  xapXi: boolean;
};

/**
 * Số hiệu báo hiệu: "0", "15a", "kt7", "bđ5", "sc5".
 *
 * Chữ cái ĐUÔI chỉ được nhận khi SAU nó không còn chữ nữa. Không có vế chặn
 * đó thì "phao số 13 khoảng 250m" (bỏ khoảng trắng: `phaosố13khoảng250m`) đọc
 * ra số hiệu `13k` — không tra được phao nào, và cả đoạn im lặng rơi vào sọt
 * rác với lý do sai ("không tra được toạ độ" thay vì "đọc sai số hiệu"). Đã
 * dính thật khi chạy trên thông báo 1604/TBHH-CVHHHP và 83/TBHH-CHHĐTVN.
 */
const AID_ID =
  "[a-z\\u00e0-\\u1ef9]{0,3}\\d{1,3}(?:[a-z\\u00e0-\\u1ef9](?![a-z\\u00e0-\\u1ef9]))?";
const PAIR_RE = new RegExp(
  `cặpphao(?:báohiệu)?(?:số)?(${AID_ID})[,\\-–]+(?:số)?(${AID_ID})`,
);
const ONE_RE = new RegExp(`phao(?:báohiệu)?(?:số)?(${AID_ID})`);
const BEACON_RE = new RegExp(`(?:đăngtiêu|tiêu)(?:số)?(${AID_ID})`);
/** "thượng lưu phao số 13 khoảng 250m" — mốc lệch khỏi phao. */
const OFFSET_RE = /(?:thượnglưu|hạlưu)/;

/**
 * Một đầu đoạn (chữ giữa "từ" và "đến", hoặc sau "đến") → mốc báo hiệu.
 *
 * Trả `null` khi mốc KHÔNG phải báo hiệu ("đến cầu Bạch Đằng", "đến cảng
 * Thuận An", "đến cửa kênh Đình Vũ") — đó không phải lỗi, chỉ là đầu đoạn mà
 * nguồn không cho toạ độ. Người gọi phải bỏ đoạn và ghi lý do.
 */
export function parseAidRef(text: string): AidRef | null {
  const t = bare(text);
  if (!t) return null;
  const xapXi = OFFSET_RE.test(t);

  const pair = PAIR_RE.exec(t);
  if (pair) {
    return {
      loai: "phao",
      names: [normalizeAidName(`phao${pair[1]}`), normalizeAidName(`phao${pair[2]}`)],
      numbers: [pair[1], pair[2]],
      xapXi,
    };
  }
  const one = ONE_RE.exec(t);
  if (one) {
    return { loai: "phao", names: [normalizeAidName(`phao${one[1]}`)], numbers: [one[1]], xapXi };
  }
  const beacon = BEACON_RE.exec(t);
  if (beacon) {
    return { loai: "tiêu", names: [normalizeAidName(`tiêu${beacon[1]}`)], numbers: [beacon[1]], xapXi };
  }
  return null;
}

/**
 * Một mốc → chữ BÀ CON ĐỌC ĐƯỢC ("phao 5 và 6", "tiêu SC5").
 *
 * Chuỗi phẳng dùng để dò khuôn đã bỏ hết khoảng trắng, nên KHÔNG được đem
 * thẳng lên màn hình ("2.2.đoạnluồngtừcặpphaosố5,6đến…" là chữ không đọc
 * nổi). Nhãn dựng lại từ chính số hiệu đã đọc — cùng luật với bảng nhãn của
 * `seamarks.ts`: mọi chữ bà con thấy đều do app soạn.
 */
export function aidRefLabel(ref: AidRef): string {
  const ids = ref.numbers.map((n) => n.toUpperCase());
  return `${ref.loai} ${ids.join(" và ")}`;
}

/** Nhãn cả đoạn: "Từ phao 5 và 6 đến phao 17 và 18". */
export function fairwaySegmentLabel(a: AidRef, b: AidRef): string {
  const gan = a.xapXi || b.xapXi ? " (vị trí gần đúng)" : "";
  return `Từ ${aidRefLabel(a)} đến ${aidRefLabel(b)}${gan}`;
}

/* ── 4. DÒ KHUÔN "TỪ PHAO A ĐẾN PHAO B + ĐỘ SÂU" ────────────────────────── */

/**
 * Đầu một mục đoạn luồng. Khuôn thật gặp trong nguồn (đã bỏ khoảng trắng):
 *   `1.đoạnluồngtừ…`  `2.1.đoạntừ…`  `a.đoạnluồngtừ…`  `a)đoạnluồng…`
 *   `-đoạnluồngtừ…`   `1.đoạnlạchhuyện(từ…)`
 * `(?!congcó)` loại "đoạn cong có bán kính cong R=1010m" — chú thích trong
 * bảng toạ độ, không phải đầu mục.
 */
const HEAD_RE = new RegExp(
  `${LINE_MARK}(?:[-–•]|\\d+(?:\\.\\d+)*\\.?|[a-zđ][.)])?đoạn(?!congcó)`,
  "g",
);

/**
 * Câu độ sâu khống chế. Bốn cách viết đã gặp:
 *   `độ sâu đạt: 2.3m` · `độ sâu đạt 0.3m` · `độ sâu đạt khoảng 4.9m` ·
 *   `độ sâu đạt khoảng: 1.4m` — và một bản in lỗi `độ sâu đạt: đạt: 12.0m`.
 *
 * BẮT BUỘC có chữ "đạt": câu `Dải cạn có độ sâu TỪ 1.9m ĐẾN 2.2m` cũng có
 * "độ sâu" và cũng có số, nhưng đó là DẢI CẠN CẢNH BÁO chứ không phải độ sâu
 * khống chế của đoạn. Lẫn hai thứ này là cho bà con một con số nông hơn thực
 * tế ở chỗ họ không cần, và bỏ mất con số đúng.
 *
 * `dương` phải nằm TRONG khuôn chứ không được bỏ qua: `đạt khoảng dương 0,2m`
 * mà đọc thành 0,2 m nước là đọc ngược dấu một luồng đã bồi lấp lên trên mặt
 * chuẩn — đúng kiểu sai không tự lộ ra.
 */
const DEPTH_RE = new RegExp(
  `đạt(?:khoảng)?:?(?:đạt:?)?(dương)?(\\d{1,3}(?:[.,]\\d{1,2})?)m`,
  "g",
);

/** Chữ mở đầu câu mô tả bề rộng luồng — mốc kết thúc phần tiêu đề của mục. */
const BODY_MARK = "trongphạmvi";

/** Xa nhất còn nhận là câu độ sâu CỦA CHÍNH mục này (ký tự trong chuỗi phẳng). */
const DEPTH_WINDOW = 700;
/** Dài nhất của một mục khi không có mục kế tiếp để cắt. */
const SPAN_MAX = 1200;

/** Một đoạn đọc được từ chữ, CHƯA tra toạ độ. */
export type RawFairwaySegment = {
  /** nhãn tiếng Việt do app soạn ("Từ phao 5 và 6 đến phao 17 và 18") */
  ten: string;
  a: AidRef;
  b: AidRef;
  depthM: number;
  /** con số đúng như thông báo viết ("2.3") — cổng 2 cần */
  depthLiteral: string;
};

/**
 * Chuỗi phẳng của một thông báo → danh sách đoạn ĐỌC ĐƯỢC TỪ CHỮ.
 *
 * Bỏ QUA mục không dò được thay vì ném: một mục lạ không được làm mất cả
 * thông báo (cùng luật với `decodeSeamarks`/`decodeSoundings`).
 */
export function findFairwaySegments(flat: string): RawFairwaySegment[] {
  if (typeof flat !== "string" || !flat) return [];

  HEAD_RE.lastIndex = 0;
  const heads: number[] = [];
  let h: RegExpExecArray | null;
  while ((h = HEAD_RE.exec(flat)) !== null) heads.push(h.index);

  const out: RawFairwaySegment[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i];
    const end = Math.min(heads[i + 1] ?? flat.length, start + SPAN_MAX);
    const span = flat.slice(start, end);

    // Tiêu đề = phần trước câu "Trong phạm vi đáy luồng…"; mục nào không có
    // câu đó thì lấy 300 ký tự đầu (đủ cho tiêu đề dài nhất đã gặp).
    const bodyAt = span.indexOf(BODY_MARK);
    const head = span.slice(0, bodyAt >= 0 && bodyAt <= 300 ? bodyAt : 300);

    const tu = head.indexOf("từ");
    if (tu < 0) continue;
    const rest = head.slice(tu + 2);
    const den = rest.indexOf("đến");
    if (den < 0) continue;

    const a = parseAidRef(rest.slice(0, den));
    const b = parseAidRef(rest.slice(den + 3));
    if (!a || !b) continue;

    DEPTH_RE.lastIndex = tu + 2 + den;
    const d = DEPTH_RE.exec(span);
    if (!d || d.index > DEPTH_WINDOW) continue;
    // "dương X" = đáy luồng cao hơn mực nước "số 0 hải đồ" X mét ⇒ độ sâu ÂM.
    const sign = d[1] ? -1 : 1;
    const depthM = sign * Number.parseFloat(d[2].replace(",", "."));
    if (!Number.isFinite(depthM)) continue;

    out.push({
      ten: fairwaySegmentLabel(a, b),
      a,
      b,
      depthM: Math.round(depthM * 10) / 10,
      depthLiteral: (sign < 0 ? "-" : "") + d[2].replace(",", "."),
    });
  }
  return out;
}

/** Tên tuyến luồng thông báo tự khai ("Tên luồng: Phà Rừng"), đã chuẩn hoá. */
export function readFairwayName(flat: string): string | null {
  const m = /tên(?:đoạn)?luồng:?([^\u0001]{1,60})/.exec(flat);
  if (!m) return null;
  const v = normalizeFairwayName(m[1]);
  return v || null;
}

/** "Tuyến luồng Hòn Gai - Cái Lân" và "luồng hàng hải Hòn Gai – Cái Lân" → cùng một khoá. */
export function normalizeFairwayName(raw: string): string {
  return bare(raw)
    .replace(/^tuyếnluồng/, "")
    .replace(/^luồnghànghải/, "")
    .replace(/^luồng/, "")
    .replace(/[-–,;:]+$/, "")
    .replace(/[-–]/g, "");
}

/* ── 5. CỔNG 1 — CHỌN CÁCH GHÉP PHAO ────────────────────────────────────── */

export type ChosenSegment = { a: LatLon; b: LatLon; km: number };

/** Điểm giữa của một cặp phao hai bên luồng (hoặc chính nó khi chỉ có một). */
export function midpoint(points: readonly LatLon[]): LatLon {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}

/**
 * CỔNG 1 — chọn một cách ghép, hoặc từ chối.
 *
 * `aCands`/`bCands` là MỌI cách đọc được của mỗi đầu đoạn trong CÙNG một
 * tuyến luồng. Có nhiều cách vì tên phao trùng nhau ngay trong một tuyến:
 * tuyến Hải Phòng có hai dãy "Phao 0…Phao 21" (Nam Triệu và Lạch Huyện) cách
 * nhau khoảng 4 km. Chọn bừa là vẽ một đoạn luồng nằm sai chỗ 4 km — vẫn
 * trông hợp lý trên bản đồ, và bà con tin nó.
 *
 * Luật: giữ mọi cách ghép có chiều dài hợp lý; nếu các cách còn lại cho ra
 * cùng một chỗ (lệch dưới `AMBIGUOUS_KM`) thì lấy cách ngắn nhất, còn không
 * thì BỎ. Trả `{ lyDo }` để người gọi ghi vào danh sách bỏ sót.
 */
export function chooseFairwaySegment(
  aCands: readonly LatLon[][],
  bCands: readonly LatLon[][],
): ChosenSegment | { lyDo: string } {
  if (!aCands.length || !bCands.length) return { lyDo: "không tra được toạ độ báo hiệu" };

  const all: ChosenSegment[] = [];
  for (const ac of aCands) {
    for (const bc of bCands) {
      const a = midpoint(ac);
      const b = midpoint(bc);
      all.push({ a, b, km: haversineKm(a, b) });
    }
  }
  const ok = all.filter((s) => isPlausibleSegmentKm(s.km)).sort((x, y) => x.km - y.km);
  if (!ok.length) {
    const km = Math.min(...all.map((s) => s.km));
    return {
      lyDo: `chiều dài đoạn vô lý ${km.toFixed(1)} km (ngoài ${MIN_SEGMENT_KM}–${MAX_SEGMENT_KM} km) — nghi khớp nhầm phao`,
    };
  }
  const first = ok[0];
  const spread = ok.some(
    (s) => haversineKm(s.a, first.a) > AMBIGUOUS_KM || haversineKm(s.b, first.b) > AMBIGUOUS_KM,
  );
  if (spread) {
    return {
      lyDo: `tên phao trùng trong tuyến — ${ok.length} cách ghép cho ra vị trí khác nhau`,
    };
  }
  return first;
}

/* ── 6. DATASET ─────────────────────────────────────────────────────────── */

/** Tuyến luồng (đi kèm lý lịch nguồn của bảng báo hiệu). */
export type FairwayRoute = {
  ten: string;
  /** tỉnh/thành quản lý tuyến */
  noi: string;
  prov: Provenance;
};

/** Một thông báo hàng hải đã bóc — mang NGÀY và LÝ LỊCH cho mọi đoạn của nó. */
export type FairwayNotice = {
  /** số hiệu như thông báo ghi, vd "1813/TBHH-CVHHHP" */
  so: string;
  /** ngày ban hành ("YYYY-MM-DD") */
  ngay: string;
  tieuDe: string;
  /** trang chi tiết trên danh mục */
  url: string;
  /** file PDF gốc */
  pdf: string;
  /** khoá vùng biển trên danh mục, vd "hai-phong-253" */
  vung: string;
  prov: Provenance;
  /**
   * Chữ của thông báo này lấy bằng OCR ảnh scan, không phải lớp chữ của PDF.
   *
   * Miền Bắc là chỗ cờ này xuất hiện nhiều nhất, vì miền Bắc vừa viết theo
   * ĐOẠN (khuôn của file này) vừa là nơi ảnh scan dày nhất — riêng Hải Phòng
   * 183 thông báo. Sai sót của OCR khác hẳn sai sót của bộ bóc chữ, nên chỗ
   * nào rà lại chất lượng cũng cần biết đoạn này đến từ đường nào.
   */
  ocr?: boolean;
};

export type FairwayDepthsFile = {
  v: number;
  nguon: string;
  nhan: string;
  layNgay: string;
  tuyen: FairwayRoute[];
  thongBao: FairwayNotice[];
  /** [chỉ số tuyen, chỉ số thongBao, độ sâu ×10 (dm), xấp xỉ 0/1, lon1, lat1, lon2, lat2, nhãn] */
  doan: Array<[number, number, number, number, number, number, number, number, string]>;
  /** thông báo/mục ĐỌC KHÔNG ĐƯỢC — ghi ra chứ không im lặng */
  boSot: Array<{ so: string; ngay: string; url: string; lyDo: string }>;
};

/** Một đoạn luồng đã giải mã, mang sẵn ngày + lý lịch. */
export type FairwayDepth = {
  /** hai đầu đoạn (điểm giữa cặp phao khi thông báo nói "cặp phao") */
  tu: LatLon;
  den: LatLon;
  /** độ sâu KHỐNG CHẾ của cả đoạn (m), quy về mực nước "số 0 hải đồ" */
  sauM: number;
  /** chiều dài đoạn (km) */
  daiKm: number;
  /** đầu đoạn neo vào "thượng/hạ lưu phao X khoảng N m" — vị trí chỉ gần đúng */
  xapXi: boolean;
  /** ngày ban hành thông báo ("YYYY-MM-DD") */
  at: string;
  ten: string;
  route: FairwayRoute;
  notice: FairwayNotice;
};

/**
 * Bảng tra + hàng số → danh sách đoạn luồng. BỎ QUA hàng hỏng thay vì ném:
 * một dòng lỗi không được làm mất cả lớp độ sâu của chuyến biển. Ba cổng chạy
 * LẠI ở đây — cổng đặt ở HÀM DÙNG CHUNG, không chỉ ở lúc sinh file.
 */
export function decodeFairwayDepths(raw: unknown): FairwayDepth[] {
  const f = raw as Partial<FairwayDepthsFile> | null;
  if (!f || !Array.isArray(f.doan)) return [];
  const routes = Array.isArray(f.tuyen) ? f.tuyen : [];
  const notices = Array.isArray(f.thongBao) ? f.thongBao : [];

  const out: FairwayDepth[] = [];
  for (const row of f.doan) {
    if (!Array.isArray(row) || row.length < 9) continue;
    const [ri, ni, dm, ap, lon1, lat1, lon2, lat2, ten] = row;
    const route = routes[ri as number];
    const notice = notices[ni as number];
    if (!route || !notice || typeof notice.ngay !== "string" || !notice.prov) continue;

    const tu = { lat: lat1, lon: lon1 };
    const den = { lat: lat2, lon: lon2 };
    if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) continue;

    const sauM = Number(dm) / 10;
    if (!isPlausibleFairwayDepth(sauM, String(sauM))) continue;
    const daiKm = haversineKm(tu, den);
    if (!isPlausibleSegmentKm(daiKm)) continue;

    out.push({
      tu,
      den,
      sauM: Math.round(sauM * 10) / 10,
      daiKm: Math.round(daiKm * 100) / 100,
      xapXi: ap === 1,
      at: notice.ngay,
      ten: typeof ten === "string" ? ten : "",
      route,
      notice,
    });
  }
  return out;
}

/* ── 7. CỔNG 3 — CÙNG MỘT ĐOẠN THÌ GIỮ BẢN MỚI NHẤT ─────────────────────── */

/** Khoá nhận dạng "cùng một đoạn": tuyến + hai đầu, KHÔNG kể chiều đi. */
export function segmentKey(routeName: string, aNames: readonly string[], bNames: readonly string[]): string {
  const a = [...aNames].sort().join("+");
  const b = [...bNames].sort().join("+");
  return [normalizeFairwayName(routeName), ...[a, b].sort()].join("|");
}

/**
 * CỔNG 3 — luồng được nạo vét thì độ sâu đổi, nên cùng một đoạn chỉ giữ MỘT
 * bản: mới nhất theo ngày. Bằng ngày thì giữ bản NÔNG HƠN — hai nhánh đi/về
 * của cùng một đoạn có độ sâu khác nhau, và con số bà con cần là con số làm
 * tàu mắc cạn.
 *
 * Giữ nguyên thứ tự xuất hiện của bản được chọn để đầu ra ổn định giữa hai
 * lần chạy.
 */
export function keepNewestPerSegment<T extends { khoa: string; ngay: string; sauM: number }>(
  list: readonly T[],
): T[] {
  const best = new Map<string, T>();
  for (const item of list) {
    const cur = best.get(item.khoa);
    if (
      !cur ||
      item.ngay > cur.ngay ||
      (item.ngay === cur.ngay && item.sauM < cur.sauM)
    ) {
      best.set(item.khoa, item);
    }
  }
  return list.filter((x) => best.get(x.khoa) === x);
}

/** Số ngày từ ngày thông báo tới `todayISO`. Cả hai dạng "YYYY-MM-DD". */
export function fairwayAgeDays(d: FairwayDepth, todayISO: string): number | null {
  const a = Date.parse(`${d.at}T00:00:00Z`);
  const b = Date.parse(`${todayISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/*
  NẠP LỚP ĐỘ SÂU LUỒNG (2026-08-31) — cùng lý do với `fetchSoundings`.

  Bộ này bù cho bộ điểm chứ không chồng: miền Nam viết thông báo theo TOẠ ĐỘ
  RỜI (ra `soundings.v1.json`), miền Bắc viết theo ĐOẠN GIỮA HAI PHAO (ra đây).
  Bỏ một trong hai là mất trắng một nửa đất nước — Hải Phòng chiếm 32% cả kho
  thông báo mà không đóng góp một điểm rời nào.
*/
let cachedFairway: Promise<FairwayDepth[]> | null = null;

export async function fetchFairwayDepths(): Promise<FairwayDepth[]> {
  if (!cachedFairway) {
    cachedFairway = fetchDataJson("/data/fairway-depths.v1.json", 20000, "fairway-depths")
      .then(decodeFairwayDepths)
      .catch((e) => {
        cachedFairway = null; // lần sau thử lại
        throw e;
      });
  }
  return cachedFairway;
}
