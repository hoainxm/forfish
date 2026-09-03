// Sinh VÙNG ĐỘ SÂU + ĐƯỜNG ĐẲNG SÂU cho lớp hải đồ Trục 1 — chạy MỘT LẦN:
//   node scripts/generate-isobaths.mjs
//
// Vì sao tự sinh: WMS đẳng sâu của EMODnet chỉ phủ châu Âu — vùng VN trắng.
// Nguồn: ETOPO 2022 (NOAA, public domain) qua ERDDAP — cùng nguồn với
// generate-depth-grid.mjs.
//
// Đầu ra: public/data/isobaths.v1.json — FeatureCollection, ĐÚNG 18 Feature:
//   { d: <mét, dương>, k: "duong" } → MultiLineString — nét + nhãn số mét,
//                                     cả 9 mức (5·10·20·50·100·200·500·1000·2000)
//   { d: <mét, dương>, k: "vung"  } → MultiPolygon — dải tô, CHỈ 8 mức từ 10 m
//                                     trở ra (xem khối FILL_MIN_M bên dưới)
// Hai vai dùng CHUNG một bộ đỉnh; vai "duong" là vòng của vai "vung" đã cắt bỏ
// đoạn chạy dọc mép khung. Chi tiết + số đo: khối chú thích trước ringsForLevel.
//
// ⚠️ ĐỔI HÌNH DẠNG (2026-09-01): trước đây file này là 5.110 Feature LineString
// phẳng, không có `k`. Lớp bản đồ đọc file này (src/lib/ocean-map.ts) PHẢI lọc
// theo `k` — không lọc thì lớp nét sẽ vẽ cả biên đa giác, và lớp tô sẽ nuốt cả
// LineString. Có test canh: src/lib/__tests__/isobath-areas.test.ts.
//
// ── BA LỰA CHỌN CỦA ĐỢT 2026-08-29 (nâng độ phân giải, giữ ngân sách) ──────
// 1) BƯỚC LƯỚI 1/48° ≈ 0,0208° (~2,3 km), trước là 0,1° (~11 km). Không lấy
//    tròn 0,02° vì lưới gốc ETOPO là 15" = 1/240°, mà 0,02° không chia hết cho
//    1/240 → ERDDAP chỉ nhận stride NGUYÊN. Stride 5 (=1/48°) là mức gần 0,02°
//    nhất mà mỗi mắt lưới rơi trúng đúng một ô nguồn, không nội suy oan.
// 2) THÊM HAI MỨC NÔNG 5 m VÀ 10 m. Tàu cá VN mớn 1,5–3 m, vùng 5–8 m là vùng
//    chạy hằng ngày; mức nông nhất cũ là 20 m — quá thô cho ven bờ. Hai mức mới
//    sinh trên TOÀN KHUNG (không giới hạn thềm lục địa): chúng tự chỉ xuất hiện
//    ở nơi có đáy nông, và giới hạn theo hộp toạ độ sẽ cắt mất bãi cạn giữa
//    biển (Trường Sa, Hoàng Sa) — đúng chỗ nguy hiểm nhất.
// 3) GIẢN LƯỢC DOUGLAS–PEUCKER, dung sai theo mức (TOL_DEG). Mọi dung sai đều
//    NHỎ HƠN NHIỀU so với bước lưới 0,0208°, nên đây là cắt điểm thừa gần thẳng
//    hàng, KHÔNG phải làm mờ hình. Mức nông (5/10/20 m) để dung sai chặt nhất
//    (0,002° ≈ 220 m) vì đó là đường bà con thật sự chạy men theo; mức sâu
//    2000 m nới rộng hơn vì chỉ để nhìn thế đáy.
//    Kết quả: ~1,3 MB — nằm dưới trần 1,5 MB. Trần này KHÔNG phải con số đẹp:
//    file nằm trong CRITICAL_SHELL của service worker (tải nguyên khối lúc cài
//    PWA), nặng quá là hỏng ngân sách cài đặt ở cảng sóng yếu.
//
// Vì sao tải bằng `.dods` (nhị phân DAP2) chứ không `.json`: float32 thuần,
// nhẹ hơn cả chục lần so với JSON chữ.

import { writeFileSync, mkdirSync } from "node:fs";

// Ô ETOPO 15" là ô TÂM (tâm ở (k + 0,5)/240 độ) → neo LAT0/LON0 vào tâm ô để
// toạ độ nguồn rơi trúng chỉ số nguyên. Cùng quy ước với generate-depth-grid.
const STRIDE = 5; // trên lưới gốc 15"
const STEP = STRIDE / 240; // 1/48° ≈ 0,0208°
const LAT0 = 5 + 1 / 480, LON0 = 102 + 1 / 480;
const N_LAT = 865; // tới ~23,00°B
const N_LON = 769; // tới ~118,00°Đ
const LEVELS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000];
/*  DUNG SAI GIẢN LƯỢC Douglas–Peucker theo mức (độ) — GẤP ĐÔI bản chỉ-có-đường
    (2026-09-01, đợt thêm vai VÙNG).

    Vì sao được phép nới: bước lưới nguồn là 1/48° ≈ 0,0208° (~2,3 km). Dung sai
    cũ 0,002° (~220 m) nhỏ hơn bước lưới TỚI 10 LẦN — tức đang giữ lại từng nếp
    gấp của phép nội suy chứ không phải của đáy biển. Nới lên 0,004° (~440 m)
    vẫn còn NHỎ HƠN BƯỚC LƯỚI 5 LẦN, không mất một khúc đáy thật nào.

    Vì sao PHẢI nới: nay file mang HAI vai (vùng + đường) trên cùng bộ đỉnh, gấp
    đôi số đỉnh phải lưu. Đo thật ở 3 chữ số thập phân:
       dung sai ×1   → 1,632 MB   ← vượt 1,272 MB của bản hiện hành
       dung sai ×2   → 1,212 MB   ← CHỌN, nhẹ hơn bản hiện hành
    Nới tiếp ×2,5 (1,076 MB) không mua thêm gì đáng giá mà bắt đầu thấy mép gãy.

    Đây đúng là đường mà CLAUDE.md §CHỐNG PHÌNH chỉ: chật thì ĐỔI CÁCH LƯU (bớt
    đỉnh thừa, gộp 5.110 Feature thành 18), KHÔNG đổi chỗ lưu. */
const TOL_DEG = {
  5: 0.004, 10: 0.004, 20: 0.004, 50: 0.006, 100: 0.010,
  200: 0.012, 500: 0.016, 1000: 0.016, 2000: 0.016,
};

const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.dods";
// ERDDAP trả 403 + HTML nếu thiếu User-Agent (án lệ 2026-06-23)
const HEADERS = { "User-Agent": "SDFish/1.0 (+https://github.com/Long-Forfun/ForFish)" };
const ROWS_PER_BAND = 200;
const TRIES = 4;

/** Đọc thân nhị phân DAP2: [z float32][latitude float64][longitude float64] */
function parseDods(ab) {
  const buf = Buffer.from(ab);
  const m = buf.indexOf("\nData:\n");
  if (m < 0) throw new Error("thân .dods không có mốc Data:");
  const dv = new DataView(ab);
  let o = m + 7;
  const nz = dv.getInt32(o);
  o += 8;
  const zOff = o;
  o += 4 * nz;
  const nLat = dv.getInt32(o);
  o += 8;
  const lats = new Float64Array(nLat);
  for (let i = 0; i < nLat; i++) lats[i] = dv.getFloat64(o + i * 8);
  o += 8 * nLat;
  const nLon = dv.getInt32(o);
  o += 8;
  const lons = new Float64Array(nLon);
  for (let i = 0; i < nLon; i++) lons[i] = dv.getFloat64(o + i * 8);
  if (nz !== nLat * nLon) throw new Error(`.dods lệch cỡ: ${nz} ≠ ${nLat}×${nLon}`);
  return { dv, zOff, lats, lons };
}

async function fetchBand(latA, latB) {
  const url =
    `${ERDDAP}?z%5B(${latA.toFixed(6)}):${STRIDE}:(${latB.toFixed(6)})%5D` +
    `%5B(${LON0.toFixed(6)}):${STRIDE}:(${(LON0 + (N_LON - 1) * STEP).toFixed(6)})%5D`;
  let last;
  for (let t = 1; t <= TRIES; t++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`ERDDAP ${res.status}`);
      return parseDods(await res.arrayBuffer());
    } catch (e) {
      last = e;
      process.stdout.write(`lỗi (${e.message}), thử lại ${t}/${TRIES} … `);
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
  }
  throw last;
}

// ── kéo lưới z ───────────────────────────────────────────────────────────
const z = new Float32Array(N_LAT * N_LON).fill(NaN);
const bands = Math.ceil(N_LAT / ROWS_PER_BAND);
for (let b = 0; b < bands; b++) {
  const i0 = b * ROWS_PER_BAND;
  const i1 = Math.min(N_LAT - 1, i0 + ROWS_PER_BAND - 1);
  process.stdout.write(`băng ${b + 1}/${bands} … `);
  const { dv, zOff, lats, lons } = await fetchBand(LAT0 + i0 * STEP, LAT0 + i1 * STEP);
  for (let a = 0; a < lats.length; a++) {
    const i = Math.round((lats[a] - LAT0) / STEP);
    if (i < 0 || i >= N_LAT) continue;
    for (let c = 0; c < lons.length; c++) {
      const j = Math.round((lons[c] - LON0) / STEP);
      if (j < 0 || j >= N_LON) continue;
      z[i * N_LON + j] = dv.getFloat32(zOff + (a * lons.length + c) * 4);
    }
  }
  console.log("ok");
}
const holes = z.reduce((n, v) => (Number.isNaN(v) ? n + 1 : n), 0);
if (holes > 0) throw new Error(`Thiếu ${holes} mắt lưới — kiểm tra lại stride/nguồn`);

/* ──────────────────────────────────────────────────────────────────────────
   MARCHING SQUARES — CHẾ ĐỘ VÙNG, KHÔNG PHẢI CHẾ ĐỘ ĐƯỜNG (2026-09-01)

   Trước đây file này chỉ dò ĐƯỜNG (`độ sâu = L`) rồi nối thành polyline. Nay
   dò VÙNG (`độ sâu ≥ L`) và trả về VÒNG KHÉP KÍN, vì lớp hải đồ cần tô dải
   (`DEPARE` của chuẩn S-57 — lớp Display Base trên ECDIS, xem
   docs/research/do-phu-hai-do-2026-08.md §A).

   VÌ SAO KHÔNG "khép kín đường cũ lại": đường đẳng sâu cắt ở mép khung thì
   không có cách nào biết phải nối vòng qua đâu. Cách đúng rẻ hơn nhiều —
   ĐỆM MỘT VÒNG Ô "ĐẤT" quanh lưới rồi dò vùng: mọi vùng tự đóng kín BÊN TRONG
   lưới đệm, theo định nghĩa chứ không theo may mắn. Đo trên bản sinh thật:
   0 vòng hở.

   MỘT HÌNH HỌC, HAI VAI — ĐÂY LÀ RÀNG BUỘC, KHÔNG PHẢI TỐI ƯU:
    · vai "vung"  → MultiPolygon, để tô dải.
    · vai "duong" → MultiLineString, để vẽ nét + dán nhãn số mét.
   Hai vai dùng CHUNG một bộ đỉnh (vai đường là vòng của vai vùng, cắt bỏ đoạn
   chạy dọc mép khung). Nếu sinh rời nhau ở hai dung sai khác nhau thì nét
   "50 m" sẽ nằm lệch khỏi mép dải 50 m tới vài km — bà con nhìn ra ngay là bản
   đồ tự mâu thuẫn.

   VÌ SAO PHẢI CẮT ĐOẠN DỌC MÉP KHUNG khỏi vai "duong": vòng khép kín chạy dọc
   biên lưới đệm. Đo được: tổng chiều dài đoạn mép ~201° (~22.000 km). Vẽ nguyên
   vòng ra thành nét là bản đồ có một "đường 2000 m" thẳng băng chạy dọc 102°Đ /
   118°Đ / 5°B — đường đẳng sâu KHÔNG CÓ THẬT. Bản đồ mặc định không đặt
   maxBounds (xem LOCKED_BOUNDS trong fishing-map-view — chỉ áp khi bật lớp dự
   báo) nên bà con pan tới mép được. Vai "vung" thì giữ nguyên đoạn mép — nó chỉ
   đóng hình, không vẽ ra nét nào.
   ────────────────────────────────────────────────────────────────────────── */

/*  MỨC NÔNG NHẤT ĐƯỢC TÔ = 10 m. Mức 5 m CHỈ CÒN LÀ ĐƯỜNG.

    Đây là quyết định CÓ ĐO, không phải cho gọn. Trọng tài: 557 điểm đo sâu
    Thông báo hàng hải (public/data/soundings.v1.json + soundings-cangvu.v1.json)
    — khảo sát thật của cơ quan nhà nước, cùng chuẩn "số 0 hải đồ".

     · Ô lưới 1/48° (~2,3 km) gọi 193/557 điểm ĐÃ KHẢO SÁT là ĐẤT LIỀN (34,6%):
       cửa lạch bị bờ nuốt. Chỗ đó lớp tô im lặng — ĐÚNG hướng an toàn, và cũng
       đúng bằng hiện trạng (hôm nay chưa có lớp tô nào).
     · Nguy hiểm là hướng NGƯỢC LẠI: tô SÂU HƠN sự thật. Đo dải 5 m: 6 điểm ở
       Kiên Giang (737/TBHH-CVHHKG) nước thật 1,2–1,4 m bị tô "≥ 5 m". Tàu vỏ gỗ
       mớn 1,8–2,5 m đọc con số đó là mắc cạn.
     · Vì sao đúng mức 5 m: mô hình MÙ ở đúng dải này. Đối chiếu 415 điểm khảo
       sát (docs/research/phan-bien-vung-do-sau-2026-09.md §5): trong 13 điểm
       thật sự nông dưới 4 m, mô hình xếp đúng ĐÚNG 1.

    Số đo trước/sau (mức nông nhất được tô → ca tô sâu hơn khảo sát quá 3 m /
    điểm bỏ trắng / điểm tô đúng, trên 557 điểm):
       tô từ  5 m:  15 ca quá 3 m · 262 bỏ trắng · 276 tô đúng
       tô từ 10 m:  11 ca quá 3 m · 386 bỏ trắng · 156 tô đúng   ← CHỌN
       tô từ 20 m:  11 ca quá 3 m · 546 bỏ trắng ·   0 tô đúng   ← bỏ, xem dưới

    ĐÃ THỬ VÀ BỎ "tô từ 20 m trở ra": nó KHÔNG bỏ được ca nguy hiểm nào so với
    mức 10 m (11 ca cả hai), mà xoá sạch 156 điểm tô đúng. Cắt sâu hơn nữa chỉ
    là bỏ thông tin, không phải bỏ rủi ro.

    Chỗ bỏ trắng KHÔNG phải chỗ bà con mù: ven bờ đã có 557 số đo sâu khảo sát
    (soundings*), 13 đoạn luồng có độ sâu khống chế (fairway-depths), và chính
    nét đẳng sâu 5 m + 10 m của file này. Lớp tô chỉ thôi nói cái nó không biết.

    Nguyên tắc chốt: THÀ KHÔNG TÔ CÒN HƠN TÔ SAI VÀO CHỖ CÓ NƯỚC. */
const FILL_MIN_M = 10;

/*  LƯỚI CÓ ĐỆM: một vòng ô "đất" (giá trị canh gác) bọc quanh lưới thật, nên
    mọi vòng đều đóng kín, và đoạn chạy dọc biên nhận ra được bằng khoảng cách
    tới mép thật. */
const PAD_LAND = -9999; // "độ sâu" âm sâu = đất, không mức nào chạm tới
const PH = N_LAT + 2, PW = N_LON + 2;
const depth = new Float32Array(PH * PW).fill(PAD_LAND);
for (let i = 0; i < N_LAT; i++) {
  for (let j = 0; j < N_LON; j++) {
    // z âm dưới mực nước → độ sâu DƯƠNG xuống dưới
    depth[(i + 1) * PW + (j + 1)] = -z[i * N_LON + j];
  }
}
/** toạ độ theo chỉ số của lưới ĐỆM (i=1, j=1 là mắt lưới thật đầu tiên) */
const platY = (i) => LAT0 + (i - 1) * STEP;
const platX = (j) => LON0 + (j - 1) * STEP;

/** mép khung DỮ LIỆU thật — dùng để nhận ra đoạn chạy dọc biên */
const FR_W = LON0, FR_E = LON0 + (N_LON - 1) * STEP;
const FR_S = LAT0, FR_N = LAT0 + (N_LAT - 1) * STEP;
const onFrame = (p) =>
  p[0] <= FR_W + STEP || p[0] >= FR_E - STEP ||
  p[1] <= FR_S + STEP || p[1] >= FR_N - STEP;

const r3 = (v) => Math.round(v * 1000) / 1000;
/** điểm cắt nội suy giữa 2 đỉnh lưới — KHÔNG làm tròn ở đây (giản lược trước,
    làm tròn sau; làm tròn sớm là giản lược trên dữ liệu đã méo) */
const crossing = (v1, v2, t, p1, p2) => {
  const f = (t - v1) / (v2 - v1);
  return [p1[0] + f * (p2[0] - p1[0]), p1[1] + f * (p2[1] - p1[1])];
};

/**
 * Vòng khép kín bao vùng `độ sâu ≥ level`, hướng NGƯỢC KIM ĐỒNG HỒ cho vòng
 * ngoài và THUẬN kim cho lỗ (quy ước "trong nằm bên trái hướng đi") — nhờ vậy
 * dấu của diện tích Gauss phân biệt được vòng ngoài với lỗ, không cần test bao
 * hàm nào.
 *
 * Hai ca yên ngựa (5 và 10) phân xử bằng giá trị TRUNG BÌNH 4 góc — KHÔNG "nối
 * đơn giản" như bản dò đường cũ: ở chế độ vùng, nối sai một ca yên ngựa là hai
 * vùng dính vào nhau hoặc một lỗ biến thành vòng ngoài.
 */
function ringsForLevel(level) {
  const segs = [];
  for (let i = 0; i < PH - 1; i++) {
    for (let j = 0; j < PW - 1; j++) {
      const a = depth[i * PW + j];           // SW
      const b = depth[i * PW + j + 1];       // SE
      const c = depth[(i + 1) * PW + j + 1]; // NE
      const d = depth[(i + 1) * PW + j];     // NW
      const idx =
        (a >= level ? 1 : 0) | (b >= level ? 2 : 0) |
        (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const SW = [platX(j), platY(i)], SE = [platX(j + 1), platY(i)];
      const NE = [platX(j + 1), platY(i + 1)], NW = [platX(j), platY(i + 1)];
      const B = () => crossing(a, b, level, SW, SE);
      const R = () => crossing(b, c, level, SE, NE);
      const T = () => crossing(d, c, level, NW, NE);
      const L = () => crossing(a, d, level, SW, NW);
      const put = (p, q) => segs.push([p(), q()]);
      switch (idx) {
        case 1: put(B, L); break;
        case 2: put(R, B); break;
        case 4: put(T, R); break;
        case 8: put(L, T); break;
        case 14: put(L, B); break;
        case 13: put(B, R); break;
        case 11: put(R, T); break;
        case 7: put(T, L); break;
        case 3: put(R, L); break;
        case 6: put(T, B); break;
        case 12: put(L, R); break;
        case 9: put(B, T); break;
        case 5: {
          if ((a + b + c + d) / 4 >= level) { put(B, R); put(T, L); }
          else { put(B, L); put(T, R); }
          break;
        }
        case 10: {
          if ((a + b + c + d) / 4 >= level) { put(L, B); put(R, T); }
          else { put(R, B); put(L, T); }
          break;
        }
      }
    }
  }
  // nối đoạn thành vòng: đầu đoạn này là cuối đoạn kia (hướng đã nhất quán)
  const key = (p) => `${p[0]}|${p[1]}`;
  const byStart = new Map();
  segs.forEach((s, i) => {
    const k = key(s[0]);
    let arr = byStart.get(k);
    if (!arr) { arr = []; byStart.set(k, arr); }
    arr.push(i);
  });
  const used = new Uint8Array(segs.length);
  const rings = [];
  let open = 0;
  for (let si = 0; si < segs.length; si++) {
    if (used[si]) continue;
    used[si] = 1;
    const ring = [segs[si][0], segs[si][1]];
    for (;;) {
      const cands = byStart.get(key(ring[ring.length - 1]));
      let nxt = -1;
      if (cands) for (const c of cands) if (!used[c]) { nxt = c; break; }
      if (nxt < 0) break;
      used[nxt] = 1;
      ring.push(segs[nxt][1]);
      if (key(ring[ring.length - 1]) === key(ring[0])) break;
    }
    /*  Không bao giờ nên xảy ra (lưới đã đệm). Nếu xảy ra thì đóng lại và ĐẾM —
        con số này ném ở cuối và có test canh phải bằng 0; im lặng vá là mất
        đúng dấu hiệu cho biết bảng ca yên ngựa đã sai. */
    if (key(ring[ring.length - 1]) !== key(ring[0])) { open++; ring.push(ring[0]); }
    rings.push(ring);
  }
  return { rings, open, nSeg: segs.length };
}

/** diện tích Gauss có dấu (độ²) — dương = vòng ngoài, âm = lỗ */
function signedArea(r) {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) {
    s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  }
  return s / 2;
}
function bboxOf(r) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of r) {
    if (p[0] < a) a = p[0];
    if (p[1] < b) b = p[1];
    if (p[0] > c) c = p[0];
    if (p[1] > d) d = p[1];
  }
  return [a, b, c, d];
}
/** điểm trong vòng (ray casting) — vòng đã khép nên bỏ đỉnh lặp cuối */
function pointInRing(pt, r) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = r.length - 2; i < r.length - 1; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/*  GẮN LỖ VÀO ĐÚNG VÒNG NGOÀI — KHÔNG ĐƯỢC BỎ BƯỚC NÀY.
    Nếu để mỗi vòng thành một Polygon riêng thì LỖ CŨNG BỊ TÔ: một hòn ngầm nhô
    lên giữa vùng 2000 m sẽ được tô đúng màu "sâu hơn 2000 m" — tức bản đồ nói
    chỗ nông nhất là chỗ sâu nhất, đúng chiều nguy hiểm mà cả file này sinh ra
    để tránh. Chọn vòng ngoài NHỎ NHẤT chứa lỗ (duyệt theo diện tích tăng dần)
    để lỗ nằm trong vùng lồng sát nó, không nhảy ra vòng bao ngoài cùng. */
function nestRings(rings) {
  const items = rings.map((r) => ({ r, a: signedArea(r), bb: bboxOf(r) }));
  const outers = items.filter((x) => x.a > 0).sort((p, q) => p.a - q.a);
  const holes = items.filter((x) => x.a < 0);
  const polys = outers.map((o) => ({ o, h: [] }));
  let orphan = 0;
  for (const hl of holes) {
    const p = hl.r[0];
    let hit = null;
    for (const cand of polys) {
      const [a, b, c, d] = cand.o.bb;
      if (p[0] < a || p[0] > c || p[1] < b || p[1] > d) continue;
      if (pointInRing(p, cand.o.r)) { hit = cand; break; }
    }
    if (hit) hit.h.push(hl.r);
    else orphan++;
  }
  return { polys, orphan };
}

/** Douglas–Peucker: bỏ điểm gần thẳng hàng, giữ nguyên đầu/cuối và mọi khúc gãy
    lệch quá `tol` độ. Lặp bằng ngăn xếp — vòng dài cả vạn điểm không tràn stack. */
function simplify(pts, tol) {
  if (pts.length < 3 || tol <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1, bi = -1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = pts[k];
      const d = len === 0
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * (px - ax) - dx * (py - ay)) / len;
      if (d > best) { best = d; bi = k; }
    }
    if (best > tol) {
      keep[bi] = 1;
      stack.push([a, bi], [bi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** giản lược → làm tròn 3 chữ số → bỏ đỉnh trùng → đóng lại. null nếu vụn. */
function tidyRing(ring, tol) {
  const s = simplify(ring, tol);
  const out = [];
  for (const p of s) {
    const q = [r3(p[0]), r3(p[1])];
    const last = out[out.length - 1];
    if (last && last[0] === q[0] && last[1] === q[1]) continue; // trùng sau làm tròn
    out.push(q);
  }
  if (out.length < 4) return null;
  const a = out[0], b = out[out.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  if (out.length < 4) return null;
  // vòng suy biến (diện tích ~0 sau làm tròn) không tô ra gì, chỉ tốn byte
  if (Math.abs(signedArea(out)) < 1e-9) return null;
  return out;
}

/** cắt vòng thành các tuyến KHÔNG chạy dọc mép khung (vai "duong") */
function ringToLines(ring) {
  const out = [];
  let cur = [];
  for (let i = 0; i < ring.length - 1; i++) {
    if (onFrame(ring[i]) && onFrame(ring[i + 1])) {
      if (cur.length >= 2) out.push(cur);
      cur = [];
      continue;
    }
    if (cur.length === 0) cur.push(ring[i]);
    cur.push(ring[i + 1]);
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

// ── dựng cả 9 mức ────────────────────────────────────────────────────────
const features = [];
let totRings = 0, totOpen = 0, totOrphan = 0, totV = 0;
const areaByLevel = [];
for (const level of LEVELS) {
  const { rings, open, nSeg } = ringsForLevel(level);
  const tidy = [];
  for (const r of rings) {
    const t = tidyRing(r, TOL_DEG[level] ?? 0);
    if (t) tidy.push(t);
  }
  const { polys, orphan } = nestRings(tidy);
  totRings += tidy.length;
  totOpen += open;
  totOrphan += orphan;
  totV += tidy.reduce((s, r) => s + r.length, 0);
  areaByLevel.push(
    polys.reduce(
      (s, p) => s + signedArea(p.o.r) + p.h.reduce((t, h) => t + signedArea(h), 0),
      0,
    ),
  );

  // vai ĐƯỜNG — mọi mức, kể cả mức không được tô
  const lines = [];
  for (const r of tidy) for (const ln of ringToLines(r)) lines.push(ln);
  features.push({
    type: "Feature",
    properties: { d: level, k: "duong" },
    geometry: { type: "MultiLineString", coordinates: lines },
  });

  // vai VÙNG — CHỈ từ FILL_MIN_M trở ra (xem khối lý do ở đầu file).
  // KHÔNG sinh đa giác cho mức nông hơn là bảo đảm CỨNG: không có hình thì
  // không ai tô nhầm được, chắc hơn một lá cờ boolean chờ người khác đọc.
  if (level >= FILL_MIN_M) {
    features.push({
      type: "Feature",
      properties: { d: level, k: "vung" },
      geometry: {
        type: "MultiPolygon",
        coordinates: polys.map((p) => [p.o.r, ...p.h]),
      },
    });
  }
  console.log(
    `mức ${level} m: ${nSeg} đoạn → ${tidy.length} vòng` +
      ` (${polys.length} đa giác, ${tidy.length - polys.length} lỗ)` +
      `, ${lines.length} tuyến nét${level >= FILL_MIN_M ? "" : " — KHÔNG tô"}`,
  );
}

if (totOpen > 0) {
  throw new Error(`${totOpen} vòng HỞ — bảng ca yên ngựa hoặc lưới đệm sai`);
}
if (totOrphan > 0) {
  throw new Error(`${totOrphan} lỗ không tìm được vòng ngoài chứa nó`);
}
for (let i = 1; i < areaByLevel.length; i++) {
  if (!(areaByLevel[i] < areaByLevel[i - 1])) {
    throw new Error(
      `vùng KHÔNG lồng nhau: mức ${LEVELS[i]} m (${areaByLevel[i].toFixed(1)} độ vuông)` +
        ` không nhỏ hơn mức ${LEVELS[i - 1]} m (${areaByLevel[i - 1].toFixed(1)} độ vuông)`,
    );
  }
}

mkdirSync("public/data", { recursive: true });
const out = { type: "FeatureCollection", features };
const json = JSON.stringify(out);
writeFileSync("public/data/isobaths.v1.json", json);
console.log(
  `OK: public/data/isobaths.v1.json — ${features.length} feature` +
    ` (${LEVELS.length} vai đường + ${LEVELS.filter((l) => l >= FILL_MIN_M).length} vai vùng)` +
    `, ${totRings} vòng, ${totV} đỉnh, ${totOpen} vòng hở` +
    `, ${Math.round(json.length / 1024)} KB`,
);
