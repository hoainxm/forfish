/**
 * Trục 1 — KÝ HIỆU HẢI ĐỒ cho lớp báo hiệu hàng hải.
 *
 * File này CHỌN ký hiệu; nó KHÔNG vẽ. Hình do `scripts/build-chart-sprite.mjs`
 * sinh ra thành sprite MapLibre (`public/icons/chart-sprite{,@2x}.{png,json}`).
 * Đây là bản đối chiếu thuần, test được — `chart-symbols.test.ts` đọc CHÍNH
 * tấm sprite đã sinh và bắt lỗi lệch giữa hai bên.
 *
 * ── VẤN ĐỀ ĐANG SỬA ───────────────────────────────────────────────────────
 * Bản đồ vẽ 5.851 báo hiệu OSM + 437 báo hiệu Cục Hàng hải bằng CHẤM TRÒN:
 * hồng sen nếu có đèn, xanh thép nếu không. Chấm tròn nói được hai điều — "có
 * cái gì đó ở đây" và "ban đêm có thấy không" — nhưng KHÔNG nói điều người
 * cầm lái cần nhất: **phao này bên nào của luồng**, **vòng qua phía nào thì
 * không cạn**. Ai quen hải đồ giấy đọc điều đó từ HÌNH.
 *
 * ── VIỆT NAM = IALA VÙNG A (đo được, không phải nghe nói) ──────────────────
 * Đếm trong `public/data/vn-aids.v1.json` (dữ liệu Cục Hàng hải):
 *   "Báo hiệu phía phải luồng"  → 144 phao đèn XANH LỤC / 6 đỏ
 *   "Báo hiệu phía trái luồng"  → 116 phao đèn ĐỎ       / 3 xanh lục
 * Đó đúng quy ước vùng A: từ biển vào thì ĐỎ bên trái, XANH LỤC bên phải.
 *
 * ── VÌ SAO TỰ VẼ ──────────────────────────────────────────────────────────
 * Hình dạng ký hiệu là QUY ƯỚC KỸ THUẬT trong quy chuẩn (IALA · QCVN
 * 20:2015/BGTVT) — không ai độc quyền được "phao trái luồng đỏ hình trụ".
 * Nhưng MỘT BỘ VẼ CỤ THỂ thì có bản quyền của người vẽ: IHO S-52 cấm
 * "adapted... or commercially exploited" nếu chưa xin phép, OpenCPN là GPL-2.0
 * (chép vào sản phẩm thương mại đóng = lây giấy phép sang cả sản phẩm). Bộ này
 * vẽ lại từ mô tả trong quy chuẩn, không byte nào lấy từ hai bộ đó.
 * Chi tiết: `docs/research/ky-hieu-hai-do-2026-08.md`.
 *
 * ## Assumptions
 * - Loại lạ (OSM thêm tag mới) → `aid-unknown` (vòng dày có lõi), KHÔNG im
 *   lặng rơi về chấm tròn. Chạm vào vẫn ra nhãn tiếng Việt của `seamarkLabel`.
 * - Nguồn không nói bên luồng / hướng phương vị thì vẽ biến thể `-unknown`.
 *   THÀ NÓI "CHƯA RÕ" CÒN HƠN VẼ BỪA MỘT BÊN: vẽ nhầm bên luồng là đưa tàu
 *   vào chỗ cạn.
 */

import type { Seamark } from "@/lib/seamarks";

/* ── HẰNG SỐ CHO LỚP BẢN ĐỒ ──────────────────────────────────────────────── */

/**
 * Đường dẫn sprite cho `buildMapStyle` (khoá `sprite` của style MapLibre).
 * KHÔNG có đuôi: MapLibre tự ghép `.json`/`.png` và tự thêm `@2x` khi
 * devicePixelRatio ≥ 2. TỰ HOST — cùng origin thì service worker giữ được,
 * mất sóng ngoài khơi vẫn còn ký hiệu (CDN ngoài thì không).
 */
export const CHART_SPRITE_URL = "/icons/chart-sprite";

/**
 * URL sprite TUYỆT ĐỐI cho khoá `sprite` của style — MapLibre v5 TỪ CHỐI đường
 * dẫn tương đối: `Invalid sprite URL "/icons/chart-sprite", must be absolute`,
 * rồi đánh dấu "bộ ảnh đã nạp" với 0 ảnh và **im lặng bỏ mọi icon-image**.
 *
 * SỰ CỐ THẬT (dò 2026-09-03c, chủ dự án hỏi "sao không thấy đèn hải đăng nào"):
 * từ lúc nối sprite 2026-09-01 tới 2026-09-03 KHÔNG MỘT icon nào từng vẽ —
 * phao, đèn, xác tàu, rạn, giàn — vì lỗi này bị `onError` của map-view nuốt.
 * Cùng origin (SW vẫn giữ được), chỉ thêm scheme+host lúc chạy trong trình
 * duyệt; ngoài trình duyệt (SSR/test) trả localhost để style vẫn hợp lệ.
 */
export function chartSpriteUrl(): string {
  const origin = typeof window !== "undefined" ? window.location?.origin : "";
  if (origin && origin !== "null") return `${origin}${CHART_SPRITE_URL}`;
  return `http://localhost${CHART_SPRITE_URL}`;
}

/** Bốn file phải nằm trong SHELL của `public/sw.js` — thiếu một là mất ký hiệu offline. */
export const CHART_SPRITE_FILES = [
  "/icons/chart-sprite.png",
  "/icons/chart-sprite.json",
  "/icons/chart-sprite@2x.png",
  "/icons/chart-sprite@2x.json",
] as const;

/** Cỡ ký hiệu ở `icon-size: 1` — bằng cạnh ô sprite, tính bằng px CSS. */
export const CHART_ICON_BASE_PX = 24;

/**
 * SÀN CỨNG: dưới cỡ này thì KHÔNG VẼ NỮA, không thu nhỏ thêm.
 *
 * Vì sao 16. Hình phức tạp cần chắn ít nhất ~20 phút cung mới PHÂN BIỆT được
 * (chỉ để THẤY CÓ thì 1 phút cung là đủ — đó là lý do chấm tròn hiện tại vẫn
 * "nhìn thấy" mà vô dụng). Ở khoảng cầm điện thoại 40 cm, 20 phút cung ≈
 * 2,33 mm; điện thoại phổ thông ~5,3 px CSS mỗi mm ⇒ **12,4 px CSS** là ngưỡng
 * lý tưởng: mắt tốt, tay vững, trong nhà.
 *
 * Hoàn cảnh thật khác hẳn: tàu lắc (ảnh trên võng mạc trôi liên tục), nắng
 * chói (tương phản hiệu dụng tụt), mắt 40–60 tuổi đã lão thị. Nhân hệ số
 * ~1,3 cho rung lắc và ~1,25 cho chói + tuổi ⇒ **≈ 20 px CSS** là cỡ làm việc,
 * và 16 px là SÀN không được xuống dưới.
 *
 * Đối chiếu: IEC 62288 (trình bày thông tin hàng hải trên màn tàu) đòi chữ cao
 * ≥ 3,5 mm ở khoảng nhìn 1,0 m; quy về 40 cm là 1,4 mm — NHƯNG đó là màn buồng
 * lái có mái che, cố định, không phải điện thoại cầm tay ngoài trời. Chuẩn đó
 * KHÔNG dùng thẳng được ở đây, xem `docs/research/ky-hieu-hai-do-2026-08.md` §5.
 */
export const CHART_ICON_MIN_PX = 16;

/** Sàn tương phản áp cho mọi ký hiệu trên nền nước (WCAG 1.4.11 non-text). */
export const CHART_CONTRAST_FLOOR = 3;

/**
 * `icon-size` theo zoom — nhân với `CHART_ICON_BASE_PX`.
 * z9 → 16,8 px · z11 → 20 px · z13+ → 24 px. Không nấc nào xuống dưới sàn 16.
 * Lớp báo hiệu vốn đã chặn `minzoom` 9/11/13 nên dưới z9 không vẽ gì.
 */
export const CHART_ICON_SIZE = [
  "interpolate",
  ["linear"],
  ["zoom"],
  9,
  0.7,
  11,
  0.83,
  13,
  1,
] as const;

/* ── BẢNG MÀU ────────────────────────────────────────────────────────────
   Trùng khít bảng trong `scripts/build-chart-sprite.mjs` — test đối chiếu
   bằng cách ĐỌC PIXEL của sprite, nên lệch một mã màu là đỏ ngay.

   Số đo trên nền nước `SEA_MASK_COLOR` = #d5e8eb:
     INK      13,12:1   RED 3,99:1   GREEN 3,79:1   MAGENTA 4,22:1  SLATE 4,26:1
     TEAL      3,90:1 (3,36:1 với INK) — đúng mã `REEF_DOT_COLOR` của ocean-map.ts,
              ghi cứng ở đây vì ocean-map import file này (import ngược là vòng);
              test chốt hai mã bằng nhau.
     YELLOW    1,43:1   WHITE 1,27:1  ← hai màu này TỰ CHÚNG không đạt sàn

   Vàng và trắng là màu CHUẨN IALA — đổi hue là nói sai luật, không được đổi.
   Nên luật ở đây: **viền INK gánh phần tương phản với nước**; ruột chỉ cần
   tương phản với viền (vàng/INK = 9,14:1, trắng/INK = 16,62:1). Vì vậy mọi
   hình trong bộ đều CÓ VIỀN — bỏ viền là mất phao chuyên dùng dưới nắng. */
export const CHART_INK = "#10202b";
export const CHART_PALETTE = {
  ink: CHART_INK,
  red: "#d81f2a",
  green: "#00843d",
  yellow: "#f2b705",
  white: "#ffffff",
  magenta: "#c02a88",
  slate: "#456f8a",
  teal: "#0e7c86",
} as const;

/**
 * Hai màu quan trọng nhất của cả hệ IALA — đỏ (trái luồng) và xanh lục (phải
 * luồng) — chỉ chênh nhau **1,05:1** về độ sáng. Người mù màu đỏ–lục (~8% đàn
 * ông) nhìn ra HAI KHỐI XÁM GIỐNG HỆT NHAU.
 *
 * Vì thế trong bộ này, trái luồng là HÌNH TRỤ và phải luồng là HÌNH NÓN —
 * đúng quy ước IALA, và giữ lại đúng chỗ nó cứu người. Test
 * `chart-symbols.test.ts` so bóng hai ký hiệu và chặn nếu ai đó gộp hình.
 */
export const CHART_LATERAL_SHAPE_IS_LOAD_BEARING = true;

/* ── PHÂN GIẢI BÊN LUỒNG / HƯỚNG PHƯƠNG VỊ ───────────────────────────────── */

export type LateralSide = "port" | "stbd" | "pref-port" | "pref-stbd" | "unknown";
export type CardinalQuadrant = "n" | "e" | "s" | "w" | "unknown";

const parts = (colour?: string): string[] =>
  String(colour ?? "")
    .toLowerCase()
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * Màu THÂN phao → bên luồng (IALA vùng A).
 *   đỏ = trái · xanh lục = phải
 *   đỏ–lục–đỏ  = luồng chính chuyển sang phải (thân trụ, màu chính đỏ)
 *   lục–đỏ–lục = luồng chính chuyển sang trái (thân nón, màu chính xanh lục)
 */
export function sideFromBodyColour(colour?: string): LateralSide {
  const p = parts(colour);
  if (p.length === 1) {
    if (p[0] === "red") return "port";
    if (p[0] === "green") return "stbd";
    return "unknown";
  }
  const joined = p.join(";");
  if (joined === "red;green;red") return "pref-stbd";
  if (joined === "green;red;green") return "pref-port";
  return "unknown";
}

/**
 * Màu ÁNH ĐÈN → bên luồng. Chỉ dùng khi nguồn KHÔNG công bố màu thân — đúng
 * trường hợp `vn-aids.v1.json`, nơi cột màu thân luôn -1.
 *
 * Đây KHÔNG phải đoán mò: trong hệ IALA vùng A, phao trái luồng mang đèn đỏ và
 * phao phải luồng mang đèn xanh lục là bắt buộc, hai thứ khoá chặt vào nhau.
 * Suy ra bên luồng từ màu đèn là dùng lại chính đẳng thức của quy chuẩn. (Việc
 * `generate-vn-aids.mjs` từ chối GHI màu thân suy đoán vào dataset là chuyện
 * khác và vẫn đúng: dataset không được khẳng định thứ nguồn không nói.)
 */
export function sideFromLightColour(colour?: string): LateralSide {
  const p = parts(colour);
  if (p.length !== 1) return "unknown";
  if (p[0] === "red") return "port";
  if (p[0] === "green") return "stbd";
  return "unknown";
}

/**
 * Câu "tác dụng" do nhà nước ghi → bên luồng. Đây là nguồn ĐÁNG TIN NHẤT:
 * chính cơ quan quản lý nói phao nằm bên nào, không phải app suy ra.
 *
 *   "Báo hiệu phía phải luồng"                  → phải
 *   "Báo hiệu hướng luồng chính chuyển sang trái" → luồng chính chuyển sang trái
 *   "Báo hiệu phía phải trái luồng"             → CHƯA RÕ (câu nói cả hai bên)
 */
export function sideFromPurposeVN(purpose?: string): LateralSide {
  const t = String(purpose ?? "").toLowerCase();
  if (!t) return "unknown";
  if (t.includes("chuyển sang phải") || t.includes("chuyển hướng sang phải"))
    return "pref-stbd";
  if (t.includes("chuyển sang trái") || t.includes("chuyển hướng sang trái"))
    return "pref-port";
  const right = t.includes("phải");
  const left = t.includes("trái");
  if (right && left) return "unknown"; // "phía phải trái luồng" — nói cả hai bên
  if (right) return "stbd";
  if (left) return "port";
  return "unknown";
}

/**
 * Màu thân → hướng phương vị. Quy ước: NÓN CHỈ VÀO PHÍA MÀU ĐEN.
 *   đen trên vàng      = Bắc   · vàng trên đen      = Nam
 *   đen–vàng–đen       = Đông  · vàng–đen–vàng      = Tây
 */
export function quadrantFromBodyColour(colour?: string): CardinalQuadrant {
  switch (parts(colour).join(";")) {
    case "black;yellow":
      return "n";
    case "yellow;black":
      return "s";
    case "black;yellow;black":
      return "e";
    case "yellow;black;yellow":
      return "w";
    default:
      return "unknown";
  }
}

/**
 * Câu "tác dụng" tiếng Việt → hướng phương vị ("BH an toàn phía Nam" → `s`).
 * Lấy từ hướng CUỐI CÙNG trong câu để "Nam Định", "Việt Nam" ở đầu câu không
 * cướp mất hướng thật ở cuối.
 */
export function cardinalFromPurposeVN(purpose?: string): CardinalQuadrant {
  const t = String(purpose ?? "").toLowerCase();
  const found = [...t.matchAll(/(bắc|nam|đông|tây)/g)];
  if (!found.length) return "unknown";
  const last = found[found.length - 1][1];
  return last === "bắc" ? "n" : last === "nam" ? "s" : last === "đông" ? "e" : "w";
}

/* ── LOẠI → KÝ HIỆU ──────────────────────────────────────────────────────── */

/**
 * Loại KHÔNG phụ thuộc màu → ký hiệu gốc. Phải phủ mọi khoá của
 * `SEAMARK_LABEL` trừ nhóm luồng/phương vị (giải ở hàm dưới) — test chặn nếu
 * thiếu, để không loại nào âm thầm rơi về `aid-unknown`.
 */
const PLAIN_ICON: Record<string, string> = {
  buoy_safe_water: "safe-water",
  beacon_safe_water: "bcn-safe-water",
  buoy_special_purpose: "special",
  beacon_special_purpose: "bcn-special",
  buoy_isolated_danger: "iso-danger",
  beacon_isolated_danger: "bcn-iso-danger",
  buoy_installation: "installation",
  beacon: "beacon",
  light: "light-minor",
  light_minor: "light-minor",
  light_major: "light-major",
  light_vessel: "light-vessel",
  light_float: "light-float",
  virtual_aton: "virtual-aton",
  landmark: "landmark",
  anchorage: "anchorage",
  harbour: "harbour",
  mooring: "mooring",
  pile: "pile",
  platform: "platform",
  marine_farm: "marine-farm",
  gate: "gate",
};

/** Ký hiệu cuối cùng khi không nhận ra loại — CÓ HÌNH RIÊNG, không phải chấm trơn. */
export const CHART_FALLBACK_ICON = "aid-unknown";

/** Loại nào tự nó đã là ánh đèn hoặc là VÙNG thì không sinh biến thể `-lit`. */
const NO_LIT_VARIANT = new Set([
  "light-minor",
  "light-major",
  "light-vessel",
  "light-float",
  "landmark",
  "virtual-aton",
  "anchorage",
  "harbour",
  "gate",
  "marine-farm",
]);

/** Tiêu (cố định) dùng chung dáng đầu với phao — chỉ khác chân đế. */
const BEACON_TYPES = new Set(["beacon_lateral", "beacon_cardinal"]);

/**
 * Một báo hiệu → tên `icon-image` trong sprite.
 *
 * `purpose` là câu "tác dụng" của `vn-aids.v1.json` (cột `pp`). Truyền vào thì
 * bên luồng / hướng phương vị lấy theo lời cơ quan quản lý — chính xác hơn mọi
 * suy luận, và cần thiết vì nguồn Cục Hàng hải KHÔNG công bố màu thân phao.
 *
 * Thứ tự ưu tiên: câu tác dụng → màu thân → màu ánh đèn → "chưa rõ".
 */
export function chartSymbolId(
  mark: Pick<Seamark, "type" | "colour" | "light">,
  purpose?: string,
): string {
  const type = String(mark.type);
  const lit = !!mark.light && Object.keys(mark.light).length > 0;

  let base: string;
  if (type === "buoy_lateral" || type === "beacon_lateral") {
    let side = sideFromPurposeVN(purpose);
    if (side === "unknown") side = sideFromBodyColour(mark.colour);
    if (side === "unknown") side = sideFromLightColour(mark.light?.colour);
    // Tiêu cố định không có biến thể "luồng chính chuyển hướng" riêng — gom về
    // bên mà MÀU CHÍNH của nó chỉ, đúng cách người đi biển đọc dấu hiệu đó.
    const beacon = BEACON_TYPES.has(type);
    const flat: LateralSide =
      beacon && side === "pref-stbd"
        ? "port"
        : beacon && side === "pref-port"
          ? "stbd"
          : side;
    base = beacon ? `bcn-lat-${flat}` : `lat-${flat}`;
  } else if (type === "buoy_cardinal" || type === "beacon_cardinal") {
    let q = cardinalFromPurposeVN(purpose);
    if (q === "unknown") q = quadrantFromBodyColour(mark.colour);
    base = BEACON_TYPES.has(type) ? `bcn-card-${q}` : `card-${q}`;
  } else {
    base = PLAIN_ICON[type] ?? CHART_FALLBACK_ICON;
  }

  return lit && !NO_LIT_VARIANT.has(base) ? `${base}-lit` : base;
}

/** Mọi loại `SeamarkType` mà bảng trên giải được — test dùng để soát phủ sóng. */
export const CHART_TYPED_ICONS = Object.freeze({ ...PLAIN_ICON });

/* ── XÁC TÀU · CHƯỚNG NGẠI · HẢI ĐĂNG ────────────────────────────────────
   Hai lớp NGOÀI hệ Seamark cũng lấy ký hiệu từ CÙNG tấm sprite. Hàm riêng,
   KHÔNG nhét vào `PLAIN_ICON`: khoá của bảng đó là `SeamarkType` (OSM), còn
   `loai` dưới đây là từ vựng của Thông báo hàng hải (`xac-tau.ts`) — trộn hai
   từ vựng là mở đường cho khoá lạ lọt qua test phủ sóng của SEAMARK_LABEL. */

/**
 * Loại của lớp xác tàu (`XacTauLoai`) → ký hiệu.
 *
 *   xac-tau                → `wreck` (thân tàu nửa chìm)
 *   xac-tau có độ sâu công bố → `wreck-depth` (hình dồn trái, chừa chỗ phải
 *                            để layer dán số "6,8 m" — số 0 hải đồ)
 *   chuong-ngai · vat-chim → `obstruction` (dấu + trong vòng chấm)
 *
 * Loại lạ rơi về `obstruction` — cùng chiều an toàn với `xacTauLabel`
 * (vẫn là "thứ phải tránh"), KHÔNG rơi về ký hiệu "chưa rõ" của hệ phao.
 * `doSauVuotQua` chỉ nhận số dương thật — `decodeXacTau` đã đổi `-1`
 * (nguồn không công bố) thành `undefined`, nhưng vẫn chặn ở đây cho caller
 * đưa số thô vào.
 */
export function wreckSymbolId(loai: string | undefined, doSauVuotQua?: number): string {
  if (loai === "xac-tau")
    return typeof doSauVuotQua === "number" && Number.isFinite(doSauVuotQua) && doSauVuotQua > 0
      ? "wreck-depth"
      : "wreck";
  return "obstruction";
}

/**
 * Ký hiệu cho lớp ĐÈN BIỂN (`den-bien.ts` — 90 ngọn hải đăng thật của nhà
 * nước): `light_major` → `lighthouse` (sao gốc + quạt tia magenta), nổi hẳn
 * so với phao đèn nhỏ. Các loại khác (light_minor…) đi đường cũ.
 *
 * KHÔNG đổi trong `chartSymbolId`: hàm đó phục vụ cả seamarks OSM + vn-aids,
 * nơi `light_major` phải giữ nguyên `light-major` (hành vi đã ghim bằng test).
 */
export function lighthouseSymbolId(den: Pick<Seamark, "type">): string {
  if (String(den.type) === "light_major") return "lighthouse";
  return PLAIN_ICON[String(den.type)] ?? CHART_FALLBACK_ICON;
}

/* ── ĐÁ · BÃI · RẠN · CẤM NEO · CÁP CẬP BỜ · ỐNG DẪN (thêm 2026-09) ──────
   Sáu ký hiệu cho hai lớp KHÔNG phải báo hiệu: coral-reefs (địa hình đáy) và
   sea-lanes (công trình tuyến). Tên xuất ra làm HẰNG để layer không gõ chuỗi
   tay — gõ sai một chữ là MapLibre im lặng không vẽ, không báo. Test đối chiếu
   từng tên với sprite thật. Lý do có: docs/research/danh-gia-hai-do-2026-09.md
   A.4 (cáp/ống/cấm neo) và A.5 (đá/bãi/rạn cùng một chấm teal). */
export const CHART_FEATURE_ICON = Object.freeze({
  /** Đá ngầm / đá mép nước — sao sáu gai đỏ. NGUY HIỂM, phải nổi hơn bãi. */
  rockAwash: "rock-awash",
  /** Bãi cạn / cồn cát — đụn mềm dưới gợn nước. */
  bank: "bank",
  /** Rạn san hô — nhánh san hô teal. */
  coralReef: "coral-reef",
  /** Cấm neo — mỏ neo gạch chéo đỏ; tâm vòng 500 m quanh công trình biển. */
  noAnchor: "no-anchor",
  /** Điểm cáp/ống cập bờ — nửa đĩa bờ + chuỗi chấm xuống nước. */
  cableLanding: "cable-landing",
  /** Dấu lặp dọc ống dẫn dầu/khí — đoạn ống hai mặt bích. Tách ống khỏi cáp. */
  pipelineMark: "pipeline-mark",

  /* Địa danh ngầm (Thông tư 33/2024) — mặt cắt địa hình, toàn teal/INK. */
  /** Núi ngầm / dãy núi — hai chóp nhọn. */
  seamount: "seamount",
  /** Đồi ngầm — gò tròn thấp có đường đồng mức. */
  knoll: "knoll",
  /** Sống núi — răng cưa dài. */
  ridge: "ridge",
  /** Núi chóp phẳng — hình thang. */
  guyot: "guyot",
  /** Hố ngầm — đáy khoét hố chữ V. */
  deep: "deep",
  /** Thung lũng / hẻm / kênh ngầm — lòng máng chữ U. */
  valley: "valley",
  /** Vách / dốc / đèo — bậc vách đứng. */
  escarpment: "escarpment",
} as const);

/**
 * Cột `type` của `coral-reefs.v1.json` (`ReefType`: ran · da · bai · con) → ký hiệu.
 *
 *   da        → `rock-awash`  (đá ngầm — 390 điểm, đâm là thủng)
 *   ran       → `coral-reef`  (rạn san hô — 41 điểm)
 *   bai · con → `bank`        (bãi cạn 650 + cồn 293 — cạn, mắc thì chờ nước)
 *
 * ## Assumptions
 * - Loại LẠ (script sinh dữ liệu thêm giá trị mới) → `bank`, theo chốt của Lead
 *   2026-09. Đây là hình MỀM nhất — nghĩa là loại lạ hiện ra "ít nguy hiểm";
 *   đổi lại nó không giả vờ là đá. Muốn loại mới nổi hơn thì thêm nhánh ở đây,
 *   test `reefs.test.ts` chặn giá trị `type` ngoài `ReefType` lúc sinh dữ liệu.
 * - Nhận chuỗi thô (không ép `ReefType`) vì layer đọc từ GeoJSON đã tải, không
 *   qua parse; chuẩn hoá hoa/thường + khoảng trắng để "Da " không rơi về bank.
 */
export function reefSymbolId(type: string): string {
  const t = String(type ?? "").trim().toLowerCase();
  if (t === "da") return CHART_FEATURE_ICON.rockAwash;
  if (t === "ran") return CHART_FEATURE_ICON.coralReef;
  return CHART_FEATURE_ICON.bank;
}

/**
 * `loai` của địa danh ngầm (`DiaDanhNgamLoai` — 13 mã Thông tư 33/2024) → ký hiệu.
 * Loại hiếm gom theo HÌNH DẠNG ĐỊA HÌNH, không theo tên:
 *
 *   nui · day              → `seamount`   (núi ngầm 57, dãy núi 3)
 *   doi                    → `knoll`      (đồi ngầm 85 — đông nhất)
 *   song                   → `ridge`      (sống núi 11)
 *   guyot                  → `guyot`      (3)
 *   ho                     → `deep`       (hố ngầm 4)
 *   thunglung · hem · kenh → `valley`     (6 + 7 + 1 — đều là lòng máng)
 *   vach · doc · deo       → `escarpment` (3 + 1 + 1 — đều là bậc dốc)
 *   baivenbo               → `bank`       (dùng lại icon bãi cạn, không vẽ mới)
 *
 * ## Assumptions
 * - Loại LẠ → `knoll` (chốt Lead 2026-09): là hình của loại đông nhất, nghĩa là
 *   một mã mới sẽ hiện như "đồi" — thông tin thuần, không giả vờ nguy hiểm.
 *   `dia-danh-ngam.ts` ép `loai` về `DiaDanhNgamLoai` lúc parse nên nhánh này
 *   chỉ chạy khi script sinh dữ liệu thêm mã mà quên thêm hình.
 */
const DIA_DANH_NGAM_ICON: Record<string, string> = {
  nui: CHART_FEATURE_ICON.seamount,
  day: CHART_FEATURE_ICON.seamount,
  doi: CHART_FEATURE_ICON.knoll,
  song: CHART_FEATURE_ICON.ridge,
  guyot: CHART_FEATURE_ICON.guyot,
  ho: CHART_FEATURE_ICON.deep,
  thunglung: CHART_FEATURE_ICON.valley,
  hem: CHART_FEATURE_ICON.valley,
  kenh: CHART_FEATURE_ICON.valley,
  vach: CHART_FEATURE_ICON.escarpment,
  doc: CHART_FEATURE_ICON.escarpment,
  deo: CHART_FEATURE_ICON.escarpment,
  baivenbo: CHART_FEATURE_ICON.bank,
};

export function diaDanhNgamSymbolId(loai: string): string {
  const t = String(loai ?? "").trim().toLowerCase();
  return DIA_DANH_NGAM_ICON[t] ?? CHART_FEATURE_ICON.knoll;
}
