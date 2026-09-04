/**
 * SINH BỘ KÝ HIỆU HẢI ĐỒ (sprite MapLibre) — `public/icons/chart-sprite.*`
 *
 * Chạy:  node scripts/build-chart-sprite.mjs
 * Ra:    public/icons/chart-sprite.png       + chart-sprite.json     (pixelRatio 1)
 *        public/icons/chart-sprite@2x.png    + chart-sprite@2x.json  (pixelRatio 2)
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Bản đồ đang vẽ 5.851 báo hiệu (OSM) + 437 báo hiệu Cục Hàng hải bằng CHẤM
 * TRÒN: hồng sen nếu có đèn, xanh thép nếu không. Chấm tròn nói được đúng hai
 * điều — "có cái gì đó ở đây" và "ban đêm có thấy không". Nó KHÔNG nói được
 * điều quan trọng nhất với người lái tàu: **phao này nằm bên nào của luồng**,
 * **đi vòng qua phía nào thì an toàn**. Người đi biển quen hải đồ giấy đọc
 * được điều đó từ HÌNH, không từ màu chấm.
 *
 * ── GIẤY PHÉP: VÌ SAO TỰ VẼ, KHÔNG CHÉP ───────────────────────────────────
 * Hai thứ khác nhau, đừng lẫn:
 *   · HÌNH DẠNG ký hiệu là QUY ƯỚC KỸ THUẬT trong quy chuẩn (IALA / QCVN
 *     20:2015/BGTVT). "Phao trái luồng màu đỏ hình trụ" không ai độc quyền
 *     được — đó là luật, không phải tác phẩm.
 *   · MỘT BỘ VẼ CỤ THỂ (file SVG/PNG của IHO S-52, của OpenCPN) thì CÓ bản
 *     quyền của người vẽ, và điều khoản của họ ràng buộc thật:
 *       – IHO S-52 PresLib: "no part may be translated, reproduced by any
 *         process, adapted, communicated or commercially exploited without
 *         prior written permission" ⇒ KHÔNG dùng.
 *       – OpenCPN (rastersymbols-day.png): GPL-2.0 ⇒ chép vào sản phẩm thương
 *         mại đóng là lây giấy phép sang cả sản phẩm ⇒ KHÔNG dùng.
 * File này VẼ LẠI TỪ MÔ TẢ trong quy chuẩn. Không byte nào đến từ hai bộ trên.
 * Chi tiết: docs/research/ky-hieu-hai-do-2026-08.md
 *
 * ── VIỆT NAM = IALA VÙNG A ────────────────────────────────────────────────
 * Không phải nghe nói — ĐO ĐƯỢC trong chính dữ liệu Cục Hàng hải
 * (public/data/vn-aids.v1.json): 144 phao ghi "Báo hiệu phía phải luồng" mang
 * đèn XANH LỤC, 116 phao "phía trái luồng" mang đèn ĐỎ. Đó đúng là quy ước
 * vùng A (đỏ bên trái khi từ biển vào).
 *
 * ── ĐỌC DƯỚI NẮNG: CHỖ CỐ Ý LÀM KHÁC HẢI ĐỒ GIẤY ──────────────────────────
 * Hải đồ giấy vẽ cho phòng hải đồ có đèn dịu và kính lúp. Đây là điện thoại
 * trong tay người 40–60 tuổi, trên tàu lắc, dưới nắng. Năm chỗ cãi lại chuẩn,
 * ghi rõ lý do ở docs/research/ky-hieu-hai-do-2026-08.md §5:
 *   1. TÔ ĐẶC thân phao thay vì vẽ viền rỗng (nét mảnh bay đầu tiên dưới nắng)
 *   2. Mọi ký hiệu có VIỀN ĐẬM `INK` — vàng và trắng chuẩn IALA chỉ đạt
 *      1,43:1 và 1,27:1 trên nền nước, tự chúng KHÔNG BAO GIỜ nhìn ra
 *   3. Neo ký hiệu vào GIỮA, đối xứng dọc — S-52 treo ký hiệu lệch một bên
 *      điểm; ở 24px thì không biết chạm vào đâu
 *   4. Gộp phân loại hình thân (trụ/nón/cột/tháp) còn HAI lớp: NỔI (phao) và
 *      CỐ ĐỊNH (tiêu, có chân đế) — bốn hình kia ở 24px không phân biệt được
 *   5. NHƯNG GIỮ NGUYÊN trụ-vs-nón cho phao luồng: đỏ và xanh lục chỉ chênh
 *      nhau 1,05:1 về độ sáng — người mù màu đỏ–lục (~8% đàn ông) thấy HAI
 *      KHỐI XÁM GIỐNG HỆT. Hình là đường sống duy nhất, không được gộp.
 */

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/* ── BẢNG MÀU ────────────────────────────────────────────────────────────
   Mọi giá trị ĐÃ ĐO trên nền nước SEA_MASK_COLOR = #d5e8eb (xem
   src/lib/__tests__/chart-symbols.test.ts — test đo lại, không tin chú thích).

     INK      #10202b  13,12:1 nền nước   — viền + thân đen
     RED      #d81f2a   3,99:1 nền nước / 3,28:1 với INK
     GREEN    #00843d   3,79:1 nền nước / 3,46:1 với INK
     MAGENTA  #c02a88   4,22:1 nền nước / 3,11:1 với INK  — ánh đèn
     SLATE    #456f8a   4,26:1 nền nước / 3,08:1 với INK  — "chưa rõ"
     YELLOW   #f2b705   1,43:1 nền nước / 9,14:1 với INK  ← PHẢI có viền INK
     WHITE    #ffffff   1,27:1 nền nước /16,62:1 với INK  ← PHẢI có viền INK
     TEAL     #0e7c86   3,90:1 nền nước / 3,36:1 với INK  — rạn / bãi (2026-09)

   Vàng và trắng là màu CHUẨN IALA, không đổi được (đổi là nói sai luật). Nên
   luật ở đây: **viền INK gánh phần tương phản với nước**, ruột gánh phần
   tương phản với viền. Bỏ viền = mất phao chuyên dùng dưới nắng.

   TEAL = ĐÚNG mã `REEF_DOT_COLOR` của src/lib/ocean-map.ts — chấm rạn cũ và
   icon rạn mới cùng một màu, bà con không phải học màu thứ hai cho cùng một
   thứ. Test chốt hai mã này bằng nhau. */
const INK = "#10202b";
const RED = "#d81f2a";
const GREEN = "#00843d";
const YELLOW = "#f2b705";
const WHITE = "#ffffff";
const MAGENTA = "#c02a88";
const SLATE = "#456f8a";
const TEAL = "#0e7c86";
/*  BLUE #2b74c4 — 3,77:1 nền nước / 3,49:1 với INK — cột nước ĐANG LÊN của
    trạm con nước (2026-09-04). Cùng mã với TIDE_STATION_COLOR (ocean-map) để
    nhãn trạm và ruột ký hiệu một màu. Xanh dương chứ không phải xanh lục
    (GREEN = phao phải luồng) hay teal (rạn): ba thứ ba nghĩa, ba màu. */
const BLUE = "#2b74c4";

/** Khung vẽ (đơn vị SVG) — 1 đơn vị = 1 px CSS ở icon-size 1. */
const BOX = 24;
/** Bề rộng viền. 1,5 đơn vị ⇒ 3 px thật trên bản @2x ≈ 0,55 mm trên điện
 *  thoại — trên ngưỡng 3 phút cung (0,35 mm ở khoảng nhìn 40 cm). */
const K = 1.5;
/** Khe giữa các ô trong tấm sprite (tránh rỉ màu khi lấy mẫu texture). */
const GUTTER = 2;
const COLS = 8;

const OUT_DIR = "public/icons";
const BASENAME = "chart-sprite";

/* ── MẢNH HÌNH ───────────────────────────────────────────────────────────── */

const el = (tag, attrs, inner = "") => {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  return inner ? `<${tag} ${a}>${inner}</${tag}>` : `<${tag} ${a}/>`;
};

/** Viền chung: mọi hình đều đi qua đây, không hình nào được thiếu viền. */
const keyed = (extra = {}) => ({
  stroke: INK,
  "stroke-width": K,
  "stroke-linejoin": "round",
  "stroke-linecap": "round",
  ...extra,
});

/* Thân phao — ba dáng, mỗi dáng một bóng khác hẳn nhau ở 24 px.
   TRỤ (can)  = trái luồng   · NÓN (cone) = phải luồng · CỘT (pillar) = còn lại
   Đây là chỗ CỐ Ý giữ đúng chuẩn: xem chú thích đầu file, mục 5. */
const CAN = "M6.6,7 H17.4 V16.6 Q17.4,19.6 12,19.6 Q6.6,19.6 6.6,16.6 Z";
const CONE = "M12,5.6 L18,19.6 H6 Z";
const PILLAR = "M8.2,7.6 H15.8 V16.6 Q15.8,19.6 12,19.6 Q8.2,19.6 8.2,16.6 Z";
/** Thân của phao có dấu hiệu đỉnh — lùi xuống để chừa chỗ cho hai hình nón.
 *  KHE HỞ 2,9 đơn vị giữa đáy dấu hiệu đỉnh (y=7,1) và nóc thân (y=10) là CỐ Ý
 *  và là kích thước quan trọng nhất của cả bộ: nón đen của phao phương vị Bắc
 *  nằm ngay trên nửa thân cũng màu đen — dính vào nhau là mất luôn thông tin
 *  "đi vòng qua phía nào". Trừ hai nửa viền 0,75 thì còn ~1,4 px CSS khe trắng
 *  ở cỡ 24 px. Thu khe này lại là hỏng ký hiệu, dù nhìn trong phòng vẫn thấy ổn. */
const CARD_BODY = "M8.4,10 H15.6 V17.4 Q15.6,20.2 12,20.2 Q8.4,20.2 8.4,17.4 Z";

/** Chân đế "CỐ ĐỊNH" — tiêu/cột cắm đáy, khác phao NỔI. Bóng khác ngay. */
const fixedBase = () =>
  el("path", keyed({ d: "M12,17.8 V21.2 M6.4,21.6 H17.6", fill: "none", "stroke-width": K + 0.4 }));

/**
 * Tô ruột theo BĂNG NGANG hoặc SỌC DỌC trong lòng một dáng thân.
 * Dùng clipPath: băng vẽ tràn ra ngoài rồi bị cắt theo đúng dáng — nhờ vậy
 * băng luôn khít mép, không phải tính lại toạ độ cho từng dáng.
 */
const banded = (id, d, bands, dir = "h") => {
  const clip = el("clipPath", { id }, el("path", { d }));
  const fills = bands
    .map(([from, to, fill]) =>
      dir === "h"
        ? el("rect", { x: 0, y: from, width: BOX, height: to - from, fill })
        : el("rect", { x: from, y: 0, width: to - from, height: BOX, fill }),
    )
    .join("");
  return (
    el("defs", {}, clip) +
    el("g", { "clip-path": `url(#${id})` }, fills) +
    el("path", keyed({ d, fill: "none" }))
  );
};

/** Thân một màu. */
const solid = (d, fill) => el("path", keyed({ d, fill }));

/* Dấu hiệu đỉnh — hai hình nón của báo hiệu phương vị.
   Quy ước: NÓN CHỈ VÀO PHÍA MÀU ĐEN. Bắc hai nón lên (đen trên), Nam hai nón
   xuống (đen dưới), Đông hai nón chạm đáy (hình thoi), Tây hai nón chạm đỉnh
   (hình đồng hồ cát — mẹo nhớ "W như Wineglass"). */
const CONE_W = 2.5; // nửa bề rộng đáy nón
const CONE_H = 2.8;
const coneUp = (apexY) =>
  `M12,${apexY} L${12 + CONE_W},${apexY + CONE_H} H${12 - CONE_W} Z`;
const coneDown = (apexY) =>
  `M12,${apexY} L${12 + CONE_W},${apexY - CONE_H} H${12 - CONE_W} Z`;

const TOPMARK = {
  n: [coneUp(1.2), coneUp(4.3)],
  s: [coneDown(4.0), coneDown(7.1)],
  e: [`M12,1.2 L${12 + CONE_W},4.15 L12,7.1 L${12 - CONE_W},4.15 Z`],
  w: [
    `M${12 - CONE_W},1.2 H${12 + CONE_W} L12,4.15 Z`,
    `M12,4.15 L${12 + CONE_W},7.1 H${12 - CONE_W} Z`,
  ],
};

const topmark = (q, fill = INK) =>
  TOPMARK[q].map((d) => el("path", keyed({ d, fill }))).join("");

/** Quả cầu đen — dấu hiệu đỉnh của báo hiệu chướng ngại vật biệt lập. */
const sphere = (cy, r, fill = INK) => el("circle", keyed({ cx: 12, cy, r, fill }));

/** Chữ thập chéo — dấu hiệu đỉnh báo hiệu chuyên dùng.
    CÃI CHUẨN: chuẩn vẽ chữ X MÀU VÀNG. Vàng trên nền nước = 1,43:1, ở 24 px
    thì X vàng biến mất hẳn. Vẽ INK: HÌNH mới là thông tin (thân đã vàng rồi). */
const crossX = () =>
  el(
    "path",
    keyed({
      d: "M9.7,2.6 L14.3,7.0 M14.3,2.6 L9.7,7.0",
      fill: "none",
      "stroke-width": K + 0.4,
    }),
  );

/** Ánh đèn PHỤ — chấm hồng sen góc trên phải, cho biến thể `-lit`.
    CÃI CHUẨN: hải đồ vẽ "giọt lửa" hồng sen có tia. Ở 24 px tia mảnh dưới một
    pixel ⇒ thành nhiễu xám. Chấm đặc có viền thì luôn thấy. */
const litDot = () =>
  el("circle", keyed({ cx: 19.4, cy: 4.6, r: 2.9, fill: MAGENTA }));

/** Ánh đèn CHÍNH — cho đèn biển / phao đèn / tiêu ảo: to, có tia. */
const flare = (cx, cy, r) =>
  el("g", {}, [
    el("path", keyed({
      d: `M${cx},${cy - r - 3.4} V${cy - r + 0.6} M${cx},${cy + r - 0.6} V${cy + r + 3.4}` +
        ` M${cx - r - 3.4},${cy} H${cx - r + 0.6} M${cx + r - 0.6},${cy} H${cx + r + 3.4}`,
      fill: "none",
      stroke: MAGENTA,
      "stroke-width": K + 0.7,
    })),
    el("circle", keyed({ cx, cy, r, fill: MAGENTA })),
  ].join(""));

/** XÁC TÀU — thân tàu nghiêng nửa chìm, TỰ SÁNG TÁC (không đồ lại S-52 hay
 *  bộ nào): mũi hếch lên trái, đuôi chìm xuống phải, cột gãy xiên, hai vạch
 *  mặt nước hai bên nói "vật này nằm NGANG MẶT NƯỚC". Toàn INK — đây là tin
 *  nguy hiểm, không cần màu, cần ĐẬM.
 *
 *  Tham số hoá (s, dx, dy) để biến thể `wreck-depth` vẽ CÙNG MỘT HÌNH thu nhỏ
 *  dồn về trái — toạ độ co theo nhưng BỀ RỘNG NÉT GIỮ NGUYÊN (không dùng
 *  transform SVG vì transform co cả nét, hình nhỏ sẽ mảnh đi đúng chỗ cần đậm). */
const wreckShape = (s = 1, dx = 0, dy = 0) => {
  const p = (x, y) => `${(x * s + dx).toFixed(2)},${(y * s + dy).toFixed(2)}`;
  return (
    // vạch mặt nước hai bên
    el("path", keyed({
      d: `M${p(2.2, 14.8)} L${p(6.0, 14.8)} M${p(19.8, 14.8)} L${p(21.8, 14.8)}`,
      fill: "none",
      "stroke-width": K + 0.4,
    })) +
    // thân tàu nghiêng: mũi (4.4,7.6) → mép boong → đuôi chìm → sống tàu cong
    el("path", keyed({
      d: `M${p(4.4, 7.6)} L${p(19.4, 12.8)} L${p(18.2, 17.2)} Q${p(10.6, 18.4)} ${p(6.4, 11.2)} Z`,
      fill: INK,
    })) +
    // cột gãy xiên khỏi boong
    el("path", keyed({
      d: `M${p(11.0, 10.2)} L${p(14.0, 4.4)}`,
      fill: "none",
      "stroke-width": K + 0.4,
    }))
  );
};

/** HẢI ĐĂNG — sao INK ở gốc + QUẠT TIA magenta toả tròn. Tự sáng tác theo
 *  ngôn ngữ quen "đèn = ánh magenta" đã dùng cho flare/litDot; khác hẳn
 *  light-major (tháp + chữ thập tia) để lớp đèn biển nhận ra NGỌN HẢI ĐĂNG
 *  THẬT giữa các phao đèn nhỏ. */
const lighthouseShape = () => {
  const CX = 12;
  const CY = 12.6;
  const R1 = 5.2;
  const R2 = 8.6;
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const [c, sn] = [Math.cos(a), Math.sin(a)];
    rays.push(
      `M${(CX + R1 * c).toFixed(2)},${(CY + R1 * sn).toFixed(2)}` +
        ` L${(CX + R2 * c).toFixed(2)},${(CY + R2 * sn).toFixed(2)}`,
    );
  }
  return (
    el("path", keyed({
      d: rays.join(" "),
      fill: "none",
      stroke: MAGENTA,
      "stroke-width": K + 0.7,
    })) +
    // sao bốn cánh ở gốc — "vị trí chính xác của đèn" neo vào giữa
    el("path", keyed({
      d:
        `M${CX},${CY - 3.6} L${CX + 1.5},${CY - 1.5} L${CX + 3.6},${CY}` +
        ` L${CX + 1.5},${CY + 1.5} L${CX},${CY + 3.6} L${CX - 1.5},${CY + 1.5}` +
        ` L${CX - 3.6},${CY} L${CX - 1.5},${CY - 1.5} Z`,
      fill: INK,
    }))
  );
};

/** TRẠM CON NƯỚC — CỘT NƯỚC (tide gauge), ký hiệu quen của mọi máy hải đồ
 *  (chủ dự án 2026-09-04: "làm cái ký hiệu thuỷ triều cho đúng các loại hay
 *  dùng, đừng dùng hình tròn"): Navionics vẽ ô chữ nhật có thước nước xanh /
 *  đỏ, C-MAP vẽ ô đầy dần màu xanh khi nước lên và rút xuống màu đỏ khi nước
 *  xuống, OpenCPN vẽ cột vàng–xanh. Điểm chung: một CỘT ĐỨNG có mực nước, màu
 *  nói lên/xuống. Vẽ lại từ ý đó, không đồ hình của ai:
 *    · cột trắng viền INK, mực nước đầy tới 30 / 55 / 80 % (thấp / vừa / cao
 *      so với biên độ NGÀY ĐÓ của trạm) — bà con liếc là biết còn nước không;
 *    · ruột XANH DƯƠNG = đang lên, ĐỎ = đang xuống, SLATE = nước đứng;
 *    · mũi tên INK bên phải nhắc lại chiều (mù màu đỏ–xanh vẫn đọc được);
 *    · trạm MÔ HÌNH (ước tính): ruột kẻ SỌC ngang thay vì đặc — "chưa chắc",
 *      cùng nghĩa với chữ "ước tính" trong thẻ. Viền vẫn liền để vành ngoài
 *      giữ tương phản (viền đứt là để nước lộ qua khe, mất vành dưới nắng).
 *  Ruột cắt theo chính khung cột (clipPath) nên không màu nào lọt ra ngoài
 *  viền ở bốn góc bo. */
/*  BẢN 2 (chủ dự án cùng ngày: "icon thay vì gạch ngang thì dùng cái lượn
    sóng cho đẹp, đừng làm cái viền chữ nhật mà dạng không viền"):
      · KHÔNG khung, KHÔNG viền INK — chỉ một KHỐI NƯỚC màu, đáy bo tròn, MẶT
        TRÊN LƯỢN SÓNG (mặt nước). Khối cao 30 / 55 / 80 % của ô theo mực;
      · lên = BLUE + ▲ INK trên mặt sóng · xuống = RED + ▼ · đứng = SLATE,
        chỉ mặt sóng, không mũi tên;
      · trạm mô hình: khối kẻ SỌC ngang (khe trong suốt, không trắng).
    Ngoại lệ có đo của luật "mọi ký hiệu có viền INK" (đầu file, mục 2): viền
    sinh ra để cứu VÀNG/TRẮNG chuẩn IALA (1,3–1,4:1 trên nước); ba ruột ở đây
    tự đạt 3,77 / 3,99 / 4,26:1 trên nền nước nên cổng "vành ngoài ≥3:1" của
    chart-symbols.test vẫn đo và vẫn xanh — không phải bỏ luật, là luật đã thoả
    bằng chính màu ruột. */
const tideGauge = (trend, level, model) => {
  const X0 = 5.4;
  const X1 = 18.6;
  const YB = 21.6; // đáy khối
  const H = [0.3, 0.55, 0.8][level - 1] * 16; // 4,8 · 8,8 · 12,8
  const yt = YB - H; // đường mặt nước (giữa sóng)
  const A = 1.3; // biên độ sóng
  const xm = (X0 + X1) / 2;
  const q = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
  // mặt sóng: hai gợn — lên trái, xuống giữa — rồi thành phải, đáy bo tròn
  const body =
    `M${q(X0, yt)} Q${q(X0 + 3.3, yt - A * 2)} ${q(xm, yt)} Q${q(xm + 3.3, yt + A * 2)} ${q(X1, yt)}` +
    ` V${q(X1, YB - 2)} Q${q(X1, YB)} ${q(X1 - 2, YB)} H${q(X0 + 2, YB)} Q${q(X0, YB)} ${q(X0, YB - 2)} Z`;
  const color = trend === "up" ? BLUE : trend === "down" ? RED : SLATE;
  const inner = model
    ? // sọc ngang 1,7 màu / 1,1 trong suốt, từ đỉnh sóng xuống đáy, cắt theo khối
      Array.from({ length: Math.ceil((YB - (yt - A)) / 2.8) }, (_, i) =>
        el("rect", { x: X0, y: (yt - A + i * 2.8).toFixed(2), width: X1 - X0, height: 1.7, fill: color }),
      ).join("")
    : el("path", { d: body, fill: color });
  // mũi tên nằm TRÊN mặt sóng, cách đỉnh sóng 0,8; cao 4,6
  const ya = yt - A - 0.8;
  const arrow =
    trend === "up"
      ? el("path", keyed({ d: `M${q(xm - 3.4, ya)} L${q(xm, ya - 4.6)} L${q(xm + 3.4, ya)} Z`, fill: INK }))
      : trend === "down"
        ? el("path", keyed({ d: `M${q(xm - 3.4, ya - 4.6)} L${q(xm, ya)} L${q(xm + 3.4, ya - 4.6)} Z`, fill: INK }))
        : "";
  return (
    el("defs", {}, el("clipPath", { id: "g" }, el("path", { d: body }))) +
    (model ? el("g", { "clip-path": "url(#g)" }, inner) : inner) +
    arrow
  );
};

/* ── DANH MỤC KÝ HIỆU ────────────────────────────────────────────────────
   Mỗi khoá = một `icon-image` trong MapLibre. Giá trị = nội dung SVG.
   Danh sách này PHẢI phủ hết SEAMARK_LABEL của src/lib/seamarks.ts — test
   `chart-symbols.test.ts` chặn nếu thiếu (không loại nào được im lặng rơi về
   chấm tròn). */

const LATERAL_BANDS_PORT_PREF = [
  [7, 11.5, RED],
  [11.5, 15, GREEN],
  [15, 21, RED],
];

/** Nhánh san hô cho `coral-reef`: thân + ba nhánh cong, mỗi nhánh một chạc. */
const CORAL =
  "M12,19.6 V9.8 M12,9.8 Q12.2,6.4 14.6,4.4" +
  " M12,14.4 Q8.4,13.6 7,9.2 M7,9.2 Q6.6,7.6 5.2,6.6" +
  " M12,12.2 Q16,11.4 17.2,8.2 M17.2,8.2 Q17.6,6.4 19.2,5.8";

const SYMBOLS = {
  /* ── PHAO LUỒNG (nổi) ─────────────────────────────────────────────────
     TRỤ đỏ = trái luồng · NÓN xanh lục = phải luồng (IALA vùng A, từ biển
     vào). Hình khác nhau là bắt buộc, không phải trang trí — xem đầu file. */
  "lat-port": solid(CAN, RED),
  "lat-stbd": solid(CONE, GREEN),
  // Luồng chính chuyển hướng: màu CHÍNH quyết dáng thân.
  "lat-pref-port": banded("cpp", CONE, [
    [5, 11.2, GREEN],
    [11.2, 14.4, RED],
    [14.4, 21, GREEN],
  ]),
  "lat-pref-stbd": banded("cps", CAN, LATERAL_BANDS_PORT_PREF),
  // Nguồn không nói bên nào — KHÔNG ĐOÁN. Dáng cột trung tính, màu xanh thép.
  "lat-unknown": solid(PILLAR, SLATE),

  /* ── TIÊU MÉP LUỒNG (cố định, có chân đế) ─────────────────────────────── */
  "bcn-lat-port": fixedBase() + solid(CAN, RED),
  "bcn-lat-stbd": fixedBase() + solid(CONE, GREEN),
  "bcn-lat-unknown": fixedBase() + solid(PILLAR, SLATE),

  /* ── BÁO HIỆU PHƯƠNG VỊ (đi vòng qua phía nào) ────────────────────────── */
  "card-n": topmark("n") + banded("cn", CARD_BODY, [[9, 15.1, INK], [15.1, 21, YELLOW]]),
  "card-s": topmark("s") + banded("cs", CARD_BODY, [[9, 15.1, YELLOW], [15.1, 21, INK]]),
  "card-e": topmark("e") + banded("ce", CARD_BODY, [
    [9, 13.4, INK],
    [13.4, 16.8, YELLOW],
    [16.8, 21, INK],
  ]),
  "card-w": topmark("w") + banded("cw", CARD_BODY, [
    [9, 13.4, YELLOW],
    [13.4, 16.8, INK],
    [16.8, 21, YELLOW],
  ]),
  // Là phao phương vị (thân đen–vàng) nhưng nguồn không nói hướng: hai nón
  // RỖNG. Rỗng = "chưa biết", chứ không im lặng vẽ bừa một hướng.
  "card-unknown":
    TOPMARK.n.map((d) => el("path", keyed({ d, fill: "none" }))).join("") +
    banded("cu", CARD_BODY, [[9, 15.1, SLATE], [15.1, 21, YELLOW]]),

  // Tiêu (cố định) của ba loại dưới đây hiếm nhưng CÓ trong SEAMARK_LABEL —
  // thiếu là một loại rơi về chấm tròn im lặng, đúng thứ test chặn.
  "bcn-iso-danger": SPLICE("iso-danger"),
  "bcn-safe-water": SPLICE("safe-water"),
  "bcn-special": SPLICE("special"),

  "bcn-card-n": SPLICE("card-n"),
  "bcn-card-s": SPLICE("card-s"),
  "bcn-card-e": SPLICE("card-e"),
  "bcn-card-w": SPLICE("card-w"),
  "bcn-card-unknown": SPLICE("card-unknown"),

  /* ── CHỖ NGUY HIỂM BIỆT LẬP — hai quả cầu đen, thân đen có băng đỏ ────── */
  "iso-danger":
    sphere(2.5, 1.65) + sphere(7.0, 1.65) +
    banded("id", CARD_BODY, [[9, 13.4, INK], [13.4, 16.8, RED], [16.8, 21, INK]]),

  /* ── VÙNG NƯỚC AN TOÀN — sọc DỌC đỏ/trắng, một quả cầu đỏ ────────────── */
  "safe-water":
    sphere(5.0, 2.3, RED) +
    banded("sw", CARD_BODY, [[8, 10, RED], [10, 12, WHITE], [12, 14, RED], [14, 16, WHITE]], "v"),

  /* ── CHUYÊN DÙNG — thân vàng, chữ thập chéo ──────────────────────────── */
  special: crossX() + solid(CARD_BODY, YELLOW),

  /* ── PHAO NEO CÔNG TRÌNH — thân vàng, dấu vuông ──────────────────────── */
  installation:
    el("rect", keyed({ x: 9.7, y: 2.6, width: 4.6, height: 4.6, fill: INK })) +
    solid(CARD_BODY, YELLOW),

  /* ── ĐÈN ─────────────────────────────────────────────────────────────── */
  // Đèn biển lớn: tháp đặc + ánh đèn to có tia.
  "light-major":
    el("path", keyed({ d: "M9.2,21.4 L10.4,11 H13.6 L14.8,21.4 Z", fill: INK })) +
    flare(12, 7.4, 4),
  "light-minor":
    el("path", keyed({ d: "M10.4,21.4 V13 H13.6 V21.4 Z", fill: INK })) +
    flare(12, 8.6, 3.2),
  "light-float":
    solid(PILLAR, RED) + litDot(),
  // Tàu đèn neo cố định: dáng vỏ tàu + cột + ánh đèn.
  "light-vessel":
    el("path", keyed({ d: "M4.6,15.6 H19.4 L16.8,20.6 H7.2 Z", fill: INK })) +
    el("path", keyed({ d: "M12,15.4 V9.6", fill: "none", "stroke-width": K + 0.4 })) +
    flare(12, 6.6, 2.9),
  // PHAO ẢO: ngoài biển KHÔNG CÓ VẬT NÀO. Viền ĐỨT nói đúng điều đó —
  // bà con đừng đi tìm cái phao không tồn tại.
  "virtual-aton":
    el("path", {
      d: "M12,3.4 L19.4,7.7 V16.3 L12,20.6 L4.6,16.3 V7.7 Z",
      fill: "none",
      stroke: MAGENTA,
      "stroke-width": K + 0.9,
      "stroke-dasharray": "3 2.2",
      "stroke-linejoin": "round",
    }) +
    el("circle", keyed({ cx: 12, cy: 12, r: 2.2, fill: MAGENTA })),
  // Mốc trên bờ có đèn: tháp tam giác trên nền đất + ánh đèn.
  landmark:
    el("path", keyed({ d: "M12,10.4 L16.4,20.4 H7.6 Z", fill: INK })) +
    el("path", keyed({ d: "M5.4,21.4 H18.6", fill: "none", "stroke-width": K + 0.4 })) +
    flare(12, 6.6, 2.9),

  /* ── XÁC TÀU · CHƯỚNG NGẠI (Thông báo hàng hải) ──────────────────────────
     Lớp xac-tau vẽ ba loại của Cục Hàng hải. Hình tự sáng tác — xem chú thích
     tại `wreckShape`. */
  wreck: wreckShape(),
  // Biến thể cho xác tàu CÓ SỐ ĐỘ SÂU vượt qua: hình dồn về trái, CHỪA TRỐNG
  // toàn bộ phần phải của ô (x ≥ 15/24) để layer dán số "6,8 m" đè lên —
  // test đo vùng trống này, thu hẹp là số đè lên hình.
  "wreck-depth": wreckShape(0.6, 0.3, 5.5),
  // Chướng ngại vật: dấu + đậm trong VÒNG CHẤM — ngôn ngữ "chỗ nguy hiểm,
  // ranh không chắc" quen mắt hải đồ, nhưng nét và nhịp chấm tự chọn.
  // Khác hẳn `wreck` (thân tàu) và `iso-danger` (thân phao + 2 quả cầu).
  obstruction:
    el("circle", keyed({
      cx: 12, cy: 12, r: 9,
      fill: "none",
      "stroke-dasharray": "0.1 3.2",
    })) +
    el("path", keyed({ d: "M12,7.2 V16.8 M7.2,12 H16.8", fill: "none", "stroke-width": K + 1.2 })),

  /* ── HẢI ĐĂNG (lớp đèn biển) ─────────────────────────────────────────────
     `light-major`/`light-minor` GIỮ NGUYÊN cho phao/đèn nhỏ của OSM; đây là
     ký hiệu riêng cho ngọn hải đăng thật. */
  lighthouse: lighthouseShape(),

  /* ── TIÊU CHUNG (cố định, không rõ vai trò) ──────────────────────────── */
  beacon: fixedBase() + el("path", keyed({ d: "M12,4.6 L16.6,15.4 H7.4 Z", fill: SLATE })),

  /* ── VÙNG / CÔNG TRÌNH ───────────────────────────────────────────────── */
  // Mỏ neo — ký hiệu này ai cũng đọc được, giữ đúng chuẩn, không cãi.
  anchorage: anchor(),
  // Cảng/bến = mỏ neo trong vòng tròn.
  harbour: el("circle", keyed({ cx: 12, cy: 12, r: 10, fill: "none", "stroke-width": K + 0.5 })) + anchor(0.72),
  // Trụ/phao buộc tàu: thân tròn + khuyên buộc.
  mooring:
    el("path", keyed({ d: "M12,7.4 V4.2", fill: "none", "stroke-width": K + 0.4 })) +
    el("circle", keyed({ cx: 12, cy: 3.2, r: 2, fill: "none", "stroke-width": K })) +
    el("circle", keyed({ cx: 12, cy: 14.4, r: 5.2, fill: SLATE })),
  // Cọc báo hiệu: cột + thanh ngang + chân đế.
  pile:
    el("path", keyed({ d: "M12,4.4 V21.2 M7.6,8.4 H16.4", fill: "none", "stroke-width": K + 1 })) +
    el("path", keyed({ d: "M6.4,21.6 H17.6", fill: "none", "stroke-width": K + 0.4 })),
  // Giàn khoan: khối vuông trên bốn chân.
  platform:
    el("rect", keyed({ x: 5.8, y: 6.2, width: 12.4, height: 6.4, fill: INK })) +
    el("path", keyed({
      d: "M7.6,12.6 L6.2,21.2 M16.4,12.6 L17.8,21.2 M10.6,12.6 V21.2 M13.4,12.6 V21.2",
      fill: "none",
      "stroke-width": K + 0.3,
    })),
  // Lồng bè nuôi: bốn ô lưới — nhìn ra ngay là bè, không phải phao.
  "marine-farm":
    el("rect", keyed({ x: 4.4, y: 4.4, width: 15.2, height: 15.2, rx: 1.6, fill: SLATE })) +
    el("path", keyed({ d: "M12,4.4 V19.6 M4.4,12 H19.6", fill: "none", "stroke-width": K })),
  // Cửa / âu tàu: hai vai chụm lại, chừa khe ở giữa = chỗ tàu chui qua.
  gate:
    el("path", keyed({
      d: "M5.2,4.2 L10.2,9.6 V14.4 L5.2,19.8 M18.8,4.2 L13.8,9.6 V14.4 L18.8,19.8",
      fill: "none",
      "stroke-width": K + 1.2,
    })),

  /* ── CHƯA RÕ LOẠI ────────────────────────────────────────────────────── */
  // OSM thêm tag mới thì rơi về đây. KHÔNG phải chấm tròn trơn: vòng dày +
  // lõi rỗng đọc ra "có báo hiệu, app chưa biết loại" — chạm vào vẫn ra chữ.
  "aid-unknown":
    el("circle", keyed({ cx: 12, cy: 12, r: 7.6, fill: SLATE, "stroke-width": K + 0.6 })) +
    el("circle", { cx: 12, cy: 12, r: 2.6, fill: INK }),

  /* ── ĐÁ · BÃI · RẠN (lớp coral-reefs, theo cột `type`) — thêm 2026-09 ────
     Trước đây 1.374 điểm là MỘT chấm teal: "Đá" ngầm (đâm là thủng) trông y
     hệt "Bãi" cạn (mắc thì chờ nước). Ba hình, tự sáng tác, KHÔNG đồ lại INT1
     hay S-52 (docs/research/danh-gia-hai-do-2026-09.md A.5). Cả ba phải đọc ra
     ở 16 px: hình nào cũng là MỘT khối lớn, không có chi tiết dưới 2 đơn vị. */
  // ĐÁ NGẦM / ĐÁ MÉP NƯỚC — ngôi sao sáu gai đỏ, tâm đen. Gai = "đâm", đỏ =
  // màu cảnh báo đã dùng cho băng đỏ của iso-danger. Khác hẳn `obstruction`
  // (dấu + trong vòng chấm) và `wreck` (thân tàu) — test bóng chặn.
  "rock-awash": el("path", keyed({ d: star(6, 10.2, 5.2), fill: RED })) + sphere(12, 1.7),
  // BÃI CẠN / CỒN — đụn cát mềm dưới một gợn nước: "cạn, có thể ngập".
  bank:
    el("path", keyed({ d: "M2.6,20 Q12,3.6 21.4,20 Z", fill: TEAL })) +
    el("path", keyed({
      d: "M3.6,5.6 Q7.8,1.6 12,5.6 Q16.2,9.6 20.4,5.6",
      fill: "none",
      // dày hơn viền thường: ở 16 px gợn này là thứ duy nhất nói "có nước trên"
      "stroke-width": K + 1.0,
    })),
  // RẠN SAN HÔ — nhánh san hô teal viền đen trên nền đá. Nhánh vẽ HAI LƯỢT:
  // nét INK dày dưới, nét TEAL mảnh đè lên ⇒ mỗi nhánh có viền INK khép kín
  // (luật viền của cả bộ) mà không phải vẽ đa giác bao quanh từng nhánh.
  "coral-reef":
    el("path", keyed({ d: "M4.4,20.8 Q12,15.6 19.6,20.8 Z", fill: TEAL })) +
    el("path", keyed({ d: CORAL, fill: "none", "stroke-width": K + 2.6 })) +
    el("path", { d: CORAL, fill: "none", stroke: TEAL, "stroke-width": K + 0.6, "stroke-linecap": "round", "stroke-linejoin": "round" }),

  /* ── CẤM NEO · CÁP CẬP BỜ · ỐNG DẪN (lớp sea-lanes) — thêm 2026-09 ────── */
  // CẤM NEO — mỏ neo (dùng lại `anchor`) bị GẠCH CHÉO đỏ viền đen. Đặt ở tâm
  // vòng 500 m quanh giàn khoan; bản thân vòng do layer vẽ.
  "no-anchor":
    anchor(0.82) +
    el("path", keyed({ d: "M4.4,4.4 L19.6,19.6", fill: "none", "stroke-width": K + 2.4 })) +
    el("path", { d: "M4.4,4.4 L19.6,19.6", fill: "none", stroke: RED, "stroke-width": K + 0.8, "stroke-linecap": "round" }),
  // ĐIỂM CÁP CẬP BỜ — nửa đĩa trắng (bờ, đáy phẳng là mép nước), khối đen ở
  // mép (trạm cập bờ), chuỗi chấm đi xuống nước (cáp). Thay cho "đốm 1 px".
  "cable-landing":
    el("path", keyed({ d: "M2.8,10.2 A9.2,9.2 0 0 1 21.2,10.2 Z", fill: WHITE })) +
    el("rect", keyed({ x: 9.6, y: 5.6, width: 4.8, height: 4.6, fill: INK })) +
    el("path", keyed({
      d: "M12,12.6 V21.4",
      fill: "none",
      "stroke-width": K + 1.4,
      "stroke-dasharray": "0.1 3.4",
    })),
  // DẤU ỐNG DẪN — đoạn ống có hai mặt bích, đặt lặp dọc tuyến ống dầu/khí để
  // tách khỏi cáp quang (kéo lưới trúng cáp là đền, trúng ống là cháy).
  "pipeline-mark":
    el("rect", keyed({ x: 2.6, y: 8.4, width: 18.8, height: 7.2, rx: 3.6, fill: WHITE })) +
    el("path", keyed({ d: "M7.2,6.4 V17.6 M16.8,6.4 V17.6", fill: "none", "stroke-width": K + 1 })),

  /* ── ĐỊA DANH NGẦM (Thông tư 33/2024 — 184 tên, lớp dia-danh-ngam) — 2026-09
     Trước đây chỉ có CHỮ: "Đồi ngầm Phong Điền" trôi trên nền, không biết to
     nhỏ, lồi hay lõm. Bảy hình mặt cắt địa hình, tự sáng tác, toàn TEAL/INK
     (thông tin, không phải nguy hiểm — đỏ để dành cho đá ngầm). Mọi hình đều
     là KHỐI ĐẶC nổi từ đáy hoặc khối đất có chỗ khoét: 16 px vẫn đọc ra
     "lồi" hay "lõm". Không nhầm với bank (đụn + gợn nước) — test bóng chặn. */
  // NÚI NGẦM / DÃY NÚI — hai chóp nhọn, chóp lớn bên trái. Đáy CỐ Ý hẹp hơn
  // guyot/ridge (3,4–20,6) — cùng đáy suốt ô thì bóng ba hình lẫn nhau
  // (đo: đáy suốt ô chỉ khác guyot 20 %, đáy hẹp 29 %; test chặn dưới 25 %).
  seamount: el("path", keyed({ d: "M3.4,20.6 L9.4,3 L13,12.4 L16.4,8 L20.6,20.6 Z", fill: TEAL })),
  // ĐỒI NGẦM — gò tròn thấp, có đường đồng mức bên trong (nói "gò", không phải bãi).
  knoll:
    el("path", keyed({ d: "M2.2,19.8 Q12,5.4 21.8,19.8 Z", fill: TEAL })) +
    el("path", keyed({ d: "M6.6,19.8 Q12,11.6 17.4,19.8", fill: "none" })),
  // SỐNG NÚI — dãy răng cưa dài, thấp, kéo suốt bề ngang.
  ridge: el("path", keyed({
    d: "M1.4,19.6 L4.4,11.4 L7.4,15.8 L10.4,9.2 L13.4,15.8 L16.4,11.4 L19.4,15.8 L22.6,12 V19.6 Z",
    fill: TEAL,
  })),
  // GUYOT — núi chóp phẳng: hình thang thấp, đỉnh bằng RỘNG như mặt bàn
  // (đỉnh hẹp là thành núi nhọn bị cắt — bóng lẫn với seamount, test chặn).
  guyot: el("path", keyed({ d: "M5.4,9.8 H18.6 L21.8,20.2 H2.2 Z", fill: TEAL })),
  // HỐ NGẦM — khối đáy bị khoét một hố hình V xuống sâu.
  deep: el("path", keyed({ d: "M1.6,7.6 H6.6 L12,19.4 L17.4,7.6 H22.4 V21.2 H1.6 Z", fill: TEAL })),
  // THUNG LŨNG / HẺM / KÊNH NGẦM — lòng máng chữ U rộng, hai bờ cao.
  valley: el("path", keyed({
    d: "M1.6,6.4 H5.4 V11.2 Q5.4,18.2 12,18.2 Q18.6,18.2 18.6,11.2 V6.4 H22.4 V21.2 H1.6 Z",
    fill: TEAL,
  })),
  // VÁCH / DỐC / ĐÈO — bậc vách đứng: thấp bên trái, cao bên phải.
  escarpment: el("path", keyed({ d: "M1.6,21 V16 H11.4 V5.4 H22.4 V21 Z", fill: TEAL })),
};

/** Ngôi sao `n` gai, tâm (12,12): gai ra tới `outer`, lõm vào tới `inner`.
 *  Gai đầu tiên chỉ thẳng lên. Dùng cho `rock-awash`. */
function star(n, outer, inner) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Mỏ neo — vẽ một lần, dùng cho `anchorage` và `harbour`. */
function anchor(scale = 1) {
  const g =
    el("path", keyed({
      d: "M12,6.2 V19.8 M7.4,10 H16.6 M4.8,13.4 Q4.8,19.8 12,19.8 Q19.2,19.8 19.2,13.4",
      fill: "none",
      "stroke-width": K + 1.4,
    })) +
    el("circle", keyed({ cx: 12, cy: 4.4, r: 2.1, fill: "none", "stroke-width": K }));
  return scale === 1
    ? g
    : el("g", { transform: `translate(12,12) scale(${scale}) translate(-12,-12)` }, g);
}

/** Lấy dáng của một ký hiệu phao và biến thành TIÊU (cố định) — cùng đầu,
 *  khác chân. Khai báo sau `SYMBOLS` nên phải là hàm hoisted. */
function SPLICE(baseId) {
  return () => fixedBase() + SYMBOLS[baseId];
}

// `SPLICE` trả hàm để tránh đọc `SYMBOLS` khi nó chưa dựng xong; gọi ra ngay
// sau khi object đã đủ.
for (const [id, v] of Object.entries(SYMBOLS)) {
  if (typeof v === "function") SYMBOLS[id] = v();
}

/* ── TRẠM CON NƯỚC (lớp tram-trieu, 2026-09-04) ──────────────────────────
   18 ô = 3 chiều (up/down/flat) × 3 mực (1 thấp · 2 vừa · 3 cao) × {đo, ước
   tính}. Id khớp `tideSymbolId()` của src/lib/chart-symbols.ts — test chặn. */
for (const trend of ["up", "down", "flat"]) {
  for (const level of [1, 2, 3]) {
    SYMBOLS[`tide-${trend}-${level}`] = tideGauge(trend, level, false);
    SYMBOLS[`tide-${trend}-${level}-uoc`] = tideGauge(trend, level, true);
  }
}

/* ── BIẾN THỂ CÓ ĐÈN ─────────────────────────────────────────────────────
   Ban đêm cái nào còn thấy được là thông tin thật, phải giữ. Thay vì thêm một
   lớp symbol thứ hai trên bản đồ (tốn lớp, dễ lệch), nướng sẵn biến thể
   `<id>-lit` = ký hiệu + chấm hồng sen góc trên phải.
   Loại nào BẢN THÂN đã là đèn (light-*, landmark, virtual-aton) hoặc là VÙNG
   (anchorage, harbour, gate, marine-farm) thì không sinh — "vùng neo có đèn"
   là câu vô nghĩa. */
const LIT_CAPABLE = Object.keys(SYMBOLS).filter(
  (id) =>
    !id.startsWith("light-") &&
    // trạm con nước không phải báo hiệu, không có đèn
    !id.startsWith("tide-") &&
    ![
      "landmark", "virtual-aton", "anchorage", "harbour", "gate", "marine-farm",
      // hải đăng TỰ NÓ là đèn; xác tàu/chướng ngại đến từ Thông báo hàng hải
      // không kèm đặc tính đèn (có đèn thì nguồn công bố thành báo hiệu riêng,
      // đã vào lớp vn-aids) — và chấm -lit sẽ đè đúng chỗ trống dán số độ sâu.
      "lighthouse", "wreck", "wreck-depth", "obstruction",
      // đá/bãi/rạn là ĐỊA HÌNH, cấm neo/cáp/ống là CÔNG TRÌNH — không cái nào
      // "có đèn"; sinh biến thể -lit cho chúng là thêm ô vô nghĩa vào sprite.
      "rock-awash", "bank", "coral-reef", "no-anchor", "cable-landing", "pipeline-mark",
      "seamount", "knoll", "ridge", "guyot", "deep", "valley", "escarpment",
    ].includes(id),
);
for (const id of LIT_CAPABLE) SYMBOLS[`${id}-lit`] = SYMBOLS[id] + litDot();

/* ── DỰNG TẤM SPRITE ─────────────────────────────────────────────────────── */

const svgOf = (inner, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
  `viewBox="0 0 ${BOX} ${BOX}">${inner}</svg>`;

async function buildSheet(ratio) {
  const cell = BOX * ratio;
  const gut = GUTTER * ratio;
  const ids = Object.keys(SYMBOLS).sort();
  const rows = Math.ceil(ids.length / COLS);
  const width = COLS * cell + (COLS - 1) * gut;
  const height = rows * cell + (rows - 1) * gut;

  const index = {};
  const composite = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * (cell + gut);
    const y = row * (cell + gut);
    index[id] = { width: cell, height: cell, x, y, pixelRatio: ratio };
    composite.push({
      input: Buffer.from(svgOf(SYMBOLS[id], cell)),
      left: x,
      top: y,
    });
  }

  const png = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png({ compressionLevel: 9 })
    .toBuffer();

  const suffix = ratio === 1 ? "" : `@${ratio}x`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, `${BASENAME}${suffix}.png`), png);
  writeFileSync(
    path.join(OUT_DIR, `${BASENAME}${suffix}.json`),
    JSON.stringify(index, null, 1) + "\n",
  );
  return { ids, width, height, bytes: png.length, suffix: suffix || "(1x)" };
}

const one = await buildSheet(1);
const two = await buildSheet(2);

console.log(`Ký hiệu: ${one.ids.length}  (gốc ${one.ids.length - LIT_CAPABLE.length}, có đèn ${LIT_CAPABLE.length})`);
for (const s of [one, two]) {
  console.log(`  ${s.suffix.padEnd(5)} ${s.width}×${s.height}px  ${(s.bytes / 1024).toFixed(1)} KB`);
}
console.log(`Ra: ${OUT_DIR}/${BASENAME}{,@2x}.{png,json}`);
