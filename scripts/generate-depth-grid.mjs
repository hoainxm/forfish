// Tạo lưới độ sâu tĩnh cho dẫn đường (Trục 1) — chạy MỘT LẦN khi cần làm mới:
//   node scripts/generate-depth-grid.mjs
//
// ⚠️ SINH LẠI LÀ HÀNH ĐỘNG CÓ CHỦ Ý (CLAUDE.md "chống phình"): mỗi lần chạy là
// một bản 8,5 MB nằm lại trong lịch sử git mãi mãi. Chỉ chạy khi NGUỒN hoặc
// LUẬT PHÂN LỚP đổi, không phải khi sửa một dòng script.
//
//   Ngày chốt nguồn:  ETOPO 2022 v1 (ERDDAP PIFSC) · GEBCO_2026 (ODB NTU) ·
//                     reef-shapes.v1.json (OSM, 2026-08-29) ·
//                     vn-coast.v1.json (526 Polygon, 2026-08-10)
//   Lần sinh:         2026-09-04 (Đợt 0 — tuyến/dẫn đường có kho hải đồ)
//   Vì sao sinh lại:  briefing-03 (2026-09-04). Bản 2 bit cũ trộn "đất" với
//                     "nước sâu < 2 m ở mực trung bình": mẫu 0,1° toàn vùng biển
//                     có 257/19.865 ô NƯỚC theo đường bờ bị coi là ĐẤT (bãi bùn
//                     vịnh Thái Lan, cửa lạch Đông Nam, vịnh Bắc Bộ), và ngưỡng
//                     "rất cạn = 4 m" cố định cho mọi tàu ⇒ Rạch Giá KHÔNG có
//                     tuyến nào ra khơi (null trong 2 ms, cả vòng khung 200 km)
//                     dù tàu mớn 1–2 m làm nghề ở đó hằng ngày.
//
// BA NGUỒN CHỒNG LÊN NHAU, LUÔN LẤY CÁI NGUY HIỂM HƠN:
//   (1) ETOPO 2022 15" (NOAA NCEI, public domain) qua ERDDAP OceanWatch PIFSC
//   (2) GEBCO_2026 15" qua ODB NTU (api.odb.ntu.edu.tw/gebco)
//   (3) mặt nạ rạn/bãi cạn/đá/xác tàu từ public/data/reef-shapes.v1.json (OSM)
//   + (4) ĐƯỜNG BỜ THẬT public/data/vn-coast.v1.json quyết định cái gì là ĐẤT
//
// VÌ SAO PHẢI CÓ (2) VÀ (3) — sự cố 2026-08-29, đây là lỗi AN TOÀN, không phải
// lỗi làm đẹp. Bản trước chỉ có ETOPO. Lấy tâm 25 hình rạn thật rồi hỏi hai
// nguồn thì 5 tâm bị ETOPO xếp "đủ sâu" trong khi GEBCO nói nước sâu
// 1–2 m (9,761/116,514 · 9,726/116,588 · 9,761/114,341 · 8,682/114,177 ·
// 22,379/113,886). "Đủ sâu" nghĩa là bộ dẫn đường VẠCH TUYẾN CHẠY THẲNG QUA —
// tàu mớn 1,5–3 m đi vào là mắc cạn.
//
// Nguyên nhân KHÔNG phải lỗi code: ô ETOPO 15" rộng ~450 m, mà trong
// reef-shapes.v1.json một nửa số hình (1.159/2.535) còn nhỏ hơn MỘT ô, trung vị
// chỉ 1,27 ô. Một mô hình độ sâu 450 m về nguyên tắc không phân giải nổi cái
// rạn — không có cách nào "lấy mẫu khéo hơn" để cứu. Muốn biết rạn ở đâu thì
// phải hỏi thứ biết rạn ở đâu: chính hình rạn. Vì vậy (3) là RÀNG BUỘC CỨNG,
// đứng trên mọi con số độ sâu; (2) là nguồn thứ hai bắt các mỏm/đỉnh ngầm mà
// OSM chưa vẽ (đo độc lập: ETOPO↔GEBCO khớp 100% ở biển sâu và thềm lục địa,
// chỉ 85,2% ở vùng rạn — có ô ETOPO nói −344 m mà GEBCO nói −5 m).
//
// VÌ SAO PHẢI CÓ (4) — briefing-03: ETOPO/GEBCO ghi bãi bùn ven bờ sâu 0–2 m
// (mực nước trung bình), mà "đất = z > −2 m" biến cả dải nước đó thành đất.
// Đất phải do ĐƯỜNG BỜ nói: tâm ô nằm TRONG đa giác vn-coast, HOẶC z > 0 theo
// CẢ HAI mô hình (đảo nhỏ mà đường bờ giản lược đã cắt mất; một mô hình nói
// đất một mô hình nói nước thì là lớp 2 — xem chú thích trong mergeGebco).
// Đường bờ giản lược cũng có giá: phá Tam Giang (Huế) và vài dải mép bờ hẹp
// nằm TRONG đa giác nên thành đất dù mô hình nói nước (đo 2026-09-04: ~6,5k ô
// nước cũ → đất, cụm lớn nhất là phá Tam Giang; không vịnh sâu nào bị lấp).
// Dập bằng SCANLINE theo hàng vĩ độ
// (giao cạnh đa giác với y = lat → các khoảng x → tô): 4.441 hàng × ~10,8k
// đỉnh ≈ 48 M phép, dưới 1 s — KHÔNG point-in-polygon từng ô (1,8·10¹¹ phép).
//
// Vì sao tải ETOPO bằng `.dods` (nhị phân DAP2) chứ không `.json`: 17 triệu ô ở
// dạng JSON là ~700 MB chữ, tải cả buổi; `.dods` là float32 thuần ≈ 68 MB.
// GEBCO thì ODB nhận GeoJSON Polygon + `mode=zonly&sample=1` và trả ĐÚNG lưới
// 15" trong đa giác (tâm ô trùng khít ETOPO: k/240 + 1/480) — 90 ô vuông 2°×2°
// là xong cả khung, không phải bắn từng điểm. `mode=point` (bắn điểm lẻ) chỉ
// dùng khi dò tay; thiếu nó API nội suy thành TRẮC DIỆN chứ không trả điểm.
//
// Độ sâu đáy biển không đổi theo ngày → đóng gói thành asset tĩnh, runtime
// không gọi API.
//
// Đầu ra: public/data/depth-grid.v1.bin — 4 bit/ô, 2 ô/byte (ô chẵn ở 4 bit
// thấp), row-major từ góc Tây Nam (~8,5 MB — đổi ĐỊNH DẠNG, giữ ĐƯỜNG DẪN để
// service worker `addAll` + `cache:"reload"` tự ghi đè, không bump vỏ).
// Hằng số lưới phải KHỚP src/lib/depth-grid.ts (DEPTH_META không đổi).
//   0 = ĐẤT LIỀN   (tâm ô trong đa giác vn-coast HOẶC cả ETOPO lẫn GEBCO z > 0)
//   1 = MẶT NẠ     (ô chạm hình rạn/bãi cạn/đá ngầm/xác tàu OSM, đã nở) →
//       tuyến không đi qua
//   2 = rất cạn    (nước, z ∈ (−2, 0]) → tuyến không đi qua (như lớp 1)
//   3 = cạn        (nước, z ∈ (−4, −2]) → chỉ tàu ĐÃ KHAI MỚN và cần ≤ 2,0 m
//       (mớn + 0,5 + ½·sóng) mới được đi qua — chưa khai thì chặn
//   4 = nước nông  (z ∈ (−12, −4]) → đi được, cảnh báo (tàu cá VN mớn 1,5–3 m
//       chạy vùng 5–8 m hằng ngày — vd vịnh Rạch Giá cạn <10 m suốt 45 km;
//       lưu ý ETOPO ~mực nước trung bình, thuỷ triều có nơi ±2 m)
//   5 = đủ sâu     (z ≤ −12)
// "Hạ lớp khi nông hơn" giữ nguyên nghĩa trên thang mới: số nhỏ hơn = nguy
// hiểm hơn = luôn thắng.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Ô ETOPO/GEBCO 15" là ô TÂM: tâm ô nằm ở (k + 0,5)/240 độ. Neo LAT0/LON0 vào
// đúng tâm ô đầu tiên ≥ 5°N / 102°Đ để mọi toạ độ nguồn rơi trúng chỉ số nguyên.
const STEP = 1 / 240; // 15 giây cung ≈ 463 m theo vĩ độ
const LAT0 = 5 + STEP / 2; // 5,002083…
const LON0 = 102 + STEP / 2; // 102,002083…
const N_LAT = 4441; // phủ tới 23,502°B (khung cũ: 5–23,5°B)
const N_LON = 3841; // phủ tới 118,002°Đ (khung cũ: 102–118°Đ)
const N_CELL = N_LAT * N_LON;

/** Lớp cao nhất — ô thiếu số liệu và ô "đủ sâu" đều mang lớp này */
const CLASS_DEEP = 5;
const CLASS_MASK = 1;

const HEADERS = { "User-Agent": "SDFish/1.0 (+https://github.com/Long-Forfun/ForFish)" };
const TRIES = 4;
/*  TRẦN CHỜ MỖI LÔ. `fetch` không có trần thì một kết nối treo là treo VĨNH VIỄN
    — đã dính thật 2026-08-29: ERDDAP nhận băng thứ 31 rồi im, script đứng 9 phút
    không một dòng log, không thử lại, mà `TRIES` vẫn còn nguyên vì chưa hề có
    lỗi nào ném ra. Có trần thì lô treo hoá thành lỗi, rơi vào nhánh thử lại. */
const FETCH_TIMEOUT_MS = 120000;

const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.dods";
const ROWS_PER_BAND = 120; // ~1,9 MB/băng — đủ nhỏ để thử lại rẻ

const ODB_GEBCO = "https://api.odb.ntu.edu.tw/gebco";
const GEBCO_TILE_DEG = 2; // 2° × 2° = 230.400 ô ≈ 10 MB JSON, ~0,6 s/ô vuông
const GEBCO_PAUSE_MS = 300; // nghỉ giữa lô — API học thuật miễn phí, đừng đấm

const REEF_SHAPES = "public/data/reef-shapes.v1.json";
const COAST = "public/data/vn-coast.v1.json";
const OUT = "public/data/depth-grid.v1.bin";

/*  BÁN KÍNH NỞ CỦA MẶT NẠ HIỂM HOẠ — ba con số này là phần "an toàn" của cả
    bản vá, nên ghi rõ vì sao:

    REEF_BUFFER_M = 1000 (rạn, bãi cạn — hình có bề rộng thật)
      · Đường viền rạn trong OSM vẽ từ ảnh vệ tinh, mép khô thật thường LỚN HƠN
        nét vẽ (nước đục, chụp lúc triều cao, sóng vỡ ngoài mép).
      · route-plan.ts lấy mẫu độ sâu MỖI 2 KM dọc chặng. Dải cấm hẹp hơn 2 km
        có thể lọt trọn giữa hai mẫu → vạch tuyến vẫn xuyên qua. 1000 m nở cộng
        450 m bề ngang ô cho dải rộng ≥ 2,4 km, không nhảy qua được.
      · Đây cũng đúng cỡ khoảng cách tránh rạn mà tàu nhỏ nên giữ.

    POINT_BUFFER_M = 1500 (đá ngầm, xác tàu — chỉ có MỘT điểm, không có bề rộng)
      · Điểm không mang thông tin kích thước: một xác tàu dài 200 m ghim ở mũi
        tàu vẫn là một chấm. Sai số ghim node loại này trong OSM hay tới vài
        trăm mét vì gốc là toạ độ hải đồ cũ.
      · Nới rộng hơn rạn 500 m để bù đúng chỗ mình KHÔNG BIẾT. Cả file chỉ có
        87 điểm nên giá phải trả gần như bằng không.

    CELL_HALF_DIAG_M = 330 (nửa đường chéo ô 450 m)
      · Cộng thêm để "ô nào CHẠM vào vùng nở" đều bị đánh dấu, chứ không phải
        "tâm ô rơi vào vùng nở". Thiếu nó thì một cái rạn nhỏ hơn ô nằm lọt
        giữa bốn tâm ô là biến mất — đúng cái bẫy đã gây ra sự cố. */
const REEF_BUFFER_M = 1000;
const POINT_BUFFER_M = 1500;
const CELL_HALF_DIAG_M = 330;

/*  Trần cho bước "lấp lòng hồ": vùng nước bị vành rạn vây kín thì lấp, nhưng
    nếu một ngày dữ liệu OSM đổi và vô tình khép thành một vòng khổng lồ thì
    ĐỪNG lấp — chặn cả một vùng biển còn tệ hơn lỗi đang sửa. 20.000 ô ≈ 4.000
    km², lớn hơn mọi vụng rạn thật ở Biển Đông (lớn nhất đo được: 1.750 ô). */
const MAX_ENCLOSED_CELLS = 20000;

const M_PER_DEG_LAT = 110574;
const mPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/**
 * Lớp theo độ cao/độ sâu z (m, âm = dưới mặt nước). Chỉ z > 0 mới là đất ở
 * bước này; đất theo ĐƯỜNG BỜ dập sau (stampCoastLand). Lớp 1 KHÔNG sinh từ z
 * — nó là mặt nạ rạn.
 */
function classify(z) {
  if (z > 0) return 0;
  if (z > -2) return 2;
  if (z > -4) return 3;
  if (z > -12) return 4;
  return CLASS_DEEP;
}

// ───────────────────────────── ETOPO (nguồn 1) ─────────────────────────────

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

async function fetchEtopoBand(latA, latB) {
  const url =
    `${ERDDAP}?z%5B(${latA.toFixed(6)}):1:(${latB.toFixed(6)})%5D` +
    `%5B(${LON0.toFixed(6)}):1:(${(LON0 + (N_LON - 1) * STEP).toFixed(6)})%5D`;
  let last;
  for (let t = 1; t <= TRIES; t++) {
    try {
      // ERDDAP trả 403 + HTML nếu thiếu User-Agent (án lệ 2026-06-23)
      const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
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

/** Lớp độ sâu theo ETOPO cho cả khung; -1 = ô chưa có số liệu */
async function loadEtopo() {
  const cls = new Int8Array(N_CELL).fill(-1);
  const bands = Math.ceil(N_LAT / ROWS_PER_BAND);
  const t0 = Date.now();
  for (let b = 0; b < bands; b++) {
    const i0 = b * ROWS_PER_BAND;
    const i1 = Math.min(N_LAT - 1, i0 + ROWS_PER_BAND - 1);
    const latA = LAT0 + i0 * STEP;
    const latB = LAT0 + i1 * STEP;
    process.stdout.write(
      `ETOPO băng ${b + 1}/${bands} ${latA.toFixed(3)}–${latB.toFixed(3)}°B … `,
    );
    const { dv, zOff, lats, lons } = await fetchEtopoBand(latA, latB);
    let filled = 0;
    for (let a = 0; a < lats.length; a++) {
      const i = Math.round((lats[a] - LAT0) / STEP);
      if (i < 0 || i >= N_LAT) continue;
      for (let c = 0; c < lons.length; c++) {
        const j = Math.round((lons[c] - LON0) / STEP);
        if (j < 0 || j >= N_LON) continue;
        cls[i * N_LON + j] = classify(dv.getFloat32(zOff + (a * lons.length + c) * 4));
        filled++;
      }
    }
    console.log(`${filled} ô (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  return cls;
}

// ───────────────────────────── GEBCO (nguồn 2) ─────────────────────────────

/**
 * Kéo GEBCO_2026 cả khung theo ô vuông 2°×2°, hạ lớp của `cls` xuống khi GEBCO
 * thấy NÔNG HƠN. Trả về số ô GEBCO phủ được (để chỗ gọi tự soát, không đoán).
 *
 * KHÔNG dừng cả mẻ khi một ô vuông hỏng: mỗi lô có `.catch` + thử lại riêng,
 * hỏng hẳn thì đếm vào `failed` và đi tiếp — nhưng chỗ gọi PHẢI ném nếu thiếu
 * quá nhiều. Rơi lặng lẽ về "chỉ có ETOPO" chính là cái đã gây ra sự cố.
 */
async function mergeGebco(cls) {
  const latMax = LAT0 + (N_LAT - 1) * STEP;
  const lonMax = LON0 + (N_LON - 1) * STEP;
  const tiles = [];
  for (let la = 5; la < latMax; la += GEBCO_TILE_DEG) {
    for (let lo = 102; lo < lonMax; lo += GEBCO_TILE_DEG) {
      tiles.push([
        lo,
        la,
        Math.min(lo + GEBCO_TILE_DEG, lonMax + STEP),
        Math.min(la + GEBCO_TILE_DEG, latMax + STEP),
      ]);
    }
  }
  const t0 = Date.now();
  // đếm ô RIÊNG BIỆT, không đếm lượt: mép hai ô vuông cạnh nhau chồng lên nhau,
  // đếm lượt thì một lỗ thủng thật vẫn qua được ngưỡng "phủ 98%".
  const touched = new Uint8Array(N_CELL);
  let covered = 0;
  let shallower = 0;
  let failed = 0;
  for (let n = 0; n < tiles.length; n++) {
    const [a, b, c, d] = tiles[n];
    const src = JSON.stringify({
      type: "Polygon",
      coordinates: [[[a, b], [a, d], [c, d], [c, b], [a, b]]],
    });
    const url = `${ODB_GEBCO}?mode=zonly&sample=1&jsonsrc=${encodeURIComponent(src)}`;
    let ok = false;
    for (let t = 1; t <= TRIES && !ok; t++) {
      try {
        const res = await fetch(url, {
          headers: HEADERS,
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`ODB ${res.status}`);
        const j = await res.json();
        if (j.Error) throw new Error(String(j.Error));
        const { longitude: lons, latitude: lats, z } = j;
        if (!Array.isArray(z) || z.length === 0) throw new Error("lô rỗng");
        for (let k = 0; k < z.length; k++) {
          const i = Math.round((lats[k] - LAT0) / STEP);
          const jj = Math.round((lons[k] - LON0) / STEP);
          if (i < 0 || i >= N_LAT || jj < 0 || jj >= N_LON) continue;
          const idx = i * N_LON + jj;
          let g = classify(z[k]);
          if (!touched[idx]) { touched[idx] = 1; covered++; }
          const e = cls[idx];
          /*  ĐẤT NGOÀI ĐA GIÁC BỜ CẦN CẢ HAI NGUỒN CÙNG NÓI z > 0 (2026-09-04).
              Đo thật ở chính điểm briefing-03 (10,02°B 104,99°Đ — vịnh Rạch
              Giá, 10 km ngoài khơi, KHÔNG trong đa giác bờ): ETOPO z = −2 m,
              GEBCO z = +1 m. Luật "min" thuần lấy đất của một nguồn làm đất
              của cả lưới, và đó là lý do bản cũ vẫn "đất ngoài khơi" dù đã bỏ
              ngưỡng −2 m. Một nguồn nói đất, nguồn kia nói nước ⇒ hạ về lớp 2
              "rất cạn" (vẫn KHÔNG đi qua ngoài 12 km quanh hai đầu — không mất
              an toàn, chỉ không còn gọi nhầm là bờ). Đảo thật (Côn Đảo, Hạ
              Long…) cả hai nguồn đều > 0 nên vẫn là đất. Với các lớp NƯỚC, min
              vẫn giữ nguyên: nông hơn = nguy hiểm hơn = thắng. */
          if (e > 0 && g === 0) g = 2;
          else if (e === 0 && g > 0) { cls[idx] = Math.min(2, g); shallower++; continue; }
          // lớp nhỏ hơn = nông hơn = nguy hiểm hơn → luôn thắng
          if (e === -1 || g < e) {
            if (e !== -1) shallower++;
            cls[idx] = g;
          }
        }
        ok = true;
      } catch (e) {
        process.stdout.write(`[lỗi ${e.message}, thử lại ${t}/${TRIES}] `);
        await new Promise((r) => setTimeout(r, 2000 * t));
      }
    }
    if (!ok) failed++;
    process.stdout.write(
      `GEBCO ${n + 1}/${tiles.length}${ok ? "" : " HỎNG"} (${Math.round((Date.now() - t0) / 1000)} s)\r`,
    );
    await new Promise((r) => setTimeout(r, GEBCO_PAUSE_MS));
  }
  console.log(
    `\nGEBCO xong: phủ ${covered}/${N_CELL} ô, hạ lớp ${shallower} ô, ô vuông hỏng ${failed}/${tiles.length}`,
  );
  return { covered, failed, tiles: tiles.length, shallower };
}

// ─────────────────────── Đường bờ thật — cái gì là ĐẤT (4) ───────────────────────

/**
 * Dập ĐẤT theo đa giác đường bờ bằng SCANLINE theo hàng vĩ độ: với mỗi hàng
 * lưới cắt qua đa giác, lấy giao điểm của các cạnh với y = lat, sắp theo x rồi
 * tô các khoảng [x₂ₜ, x₂ₜ₊₁] (luật chẵn-lẻ — lỗ trong đa giác tự thành nước).
 * Mỗi đa giác xử lý RIÊNG rồi OR vào lưới, để hai đa giác chồng mép không
 * triệt tiêu nhau. Chỉ ĐẶT 0, không bao giờ nâng ô đã là 0.
 */
function stampCoastLand(cls, fc) {
  let stamped = 0;
  let polys = 0;
  const xs = [];
  for (const f of fc.features) {
    const g = f?.geometry;
    if (!g?.coordinates) continue;
    const list =
      g.type === "Polygon" ? [g.coordinates]
        : g.type === "MultiPolygon" ? g.coordinates
          : [];
    for (const rings of list) {
      polys++;
      let y0 = Infinity, y1 = -Infinity;
      for (const r of rings) for (const p of r) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
      const i0 = Math.max(0, Math.ceil((y0 - LAT0) / STEP));
      const i1 = Math.min(N_LAT - 1, Math.floor((y1 - LAT0) / STEP));
      for (let i = i0; i <= i1; i++) {
        const lat = LAT0 + i * STEP;
        xs.length = 0;
        for (const r of rings) {
          const n = r.length;
          for (let s = 0; s < n; s++) {
            const a = r[s];
            const b = r[s + 1 < n ? s + 1 : 0];
            const ya = a[1], yb = b[1];
            // nửa mở (ya > lat) ≠ (yb > lat): đỉnh nằm đúng trên hàng chỉ đếm một lần
            if ((ya > lat) !== (yb > lat)) xs.push(a[0] + ((lat - ya) * (b[0] - a[0])) / (yb - ya));
          }
        }
        if (xs.length < 2) continue;
        xs.sort((p, q) => p - q);
        for (let t = 0; t + 1 < xs.length; t += 2) {
          const j0 = Math.max(0, Math.ceil((xs[t] - LON0) / STEP));
          const j1 = Math.min(N_LON - 1, Math.floor((xs[t + 1] - LON0) / STEP));
          for (let j = j0; j <= j1; j++) {
            const k = i * N_LON + j;
            if (cls[k] !== 0) { cls[k] = 0; stamped++; }
          }
        }
      }
    }
  }
  return { stamped, polys };
}

// ─────────────────── Mặt nạ rạn / bãi cạn / đá / xác tàu (3) ───────────────────

const ringsOf = (g) =>
  g.type === "Polygon"
    ? g.coordinates
    : g.type === "MultiPolygon"
      ? g.coordinates.flat()
      : g.type === "LineString"
        ? [g.coordinates]
        : g.type === "MultiLineString"
          ? g.coordinates
          : [];

/** Bình phương khoảng cách từ điểm tới đoạn thẳng (toạ độ đã đổi ra mét) */
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** Điểm nằm trong vòng đa giác (ray casting) */
function inRing(lon, lat, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0];
    const yi = r[i][1];
    const xj = r[j][0];
    const yj = r[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Đánh dấu mọi ô CHẠM vào hình hiểm hoạ (đã nở bán kính an toàn).
 * Phép chiếu phẳng cục bộ (mét) đủ dùng: hình lớn nhất chỉ ~35 km ngang.
 */
function buildHazardMask(fc) {
  const mask = new Uint8Array(N_CELL);
  let marked = 0;
  for (const f of fc.features) {
    const g = f?.geometry;
    if (!g?.coordinates) continue;
    const isPoint = g.type === "Point" || g.type === "MultiPoint";
    const R = (isPoint ? POINT_BUFFER_M : REEF_BUFFER_M) + CELL_HALF_DIAG_M;
    const R2 = R * R;
    const pts = isPoint ? (g.type === "Point" ? [g.coordinates] : g.coordinates) : [];
    const rings = ringsOf(g);
    const isPoly = g.type === "Polygon" || g.type === "MultiPolygon";

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const walk = (a) => {
      if (typeof a[0] === "number") {
        if (x0 > a[0]) x0 = a[0];
        if (x1 < a[0]) x1 = a[0];
        if (y0 > a[1]) y0 = a[1];
        if (y1 < a[1]) y1 = a[1];
      } else a.forEach(walk);
    };
    walk(g.coordinates);
    if (!Number.isFinite(x0)) continue;

    const mLon = mPerDegLon((y0 + y1) / 2);
    const i0 = Math.max(0, Math.floor((y0 - R / M_PER_DEG_LAT - LAT0) / STEP));
    const i1 = Math.min(N_LAT - 1, Math.ceil((y1 + R / M_PER_DEG_LAT - LAT0) / STEP));
    const j0 = Math.max(0, Math.floor((x0 - R / mLon - LON0) / STEP));
    const j1 = Math.min(N_LON - 1, Math.ceil((x1 + R / mLon - LON0) / STEP));

    for (let i = i0; i <= i1; i++) {
      const lat = LAT0 + i * STEP;
      const py = lat * M_PER_DEG_LAT;
      for (let j = j0; j <= j1; j++) {
        const k = i * N_LON + j;
        if (mask[k]) continue;
        const lon = LON0 + j * STEP;
        const px = lon * mLon;
        let hit = false;
        if (isPoly) {
          for (const r of rings) if (inRing(lon, lat, r)) { hit = true; break; }
        }
        if (!hit) {
          for (const p of pts) {
            const dx = p[0] * mLon - px;
            const dy = p[1] * M_PER_DEG_LAT - py;
            if (dx * dx + dy * dy <= R2) { hit = true; break; }
          }
        }
        if (!hit) {
          outer: for (const r of rings) {
            for (let s = 0; s + 1 < r.length; s++) {
              if (
                segDist2(px, py, r[s][0] * mLon, r[s][1] * M_PER_DEG_LAT,
                  r[s + 1][0] * mLon, r[s + 1][1] * M_PER_DEG_LAT) <= R2
              ) { hit = true; break outer; }
            }
          }
        }
        if (hit) { mask[k] = 1; marked++; }
      }
    }
  }
  return { mask, marked };
}

/**
 * Lấp lòng hồ: ô nước KHÔNG nối được ra rìa khung khi coi mặt nạ là tường thì
 * nó nằm trong vụng rạn — vào được cũng chỉ để mắc cạn, tuyến đường không có
 * việc gì ở đó. (Vành san hô vòng như Đá Chữ Thập vẽ thành nhiều mảnh rời;
 * nếu chỉ nở mép thì giữa vụng vẫn là "đủ sâu".)
 *
 * CHỈ lấy mặt nạ làm tường, KHÔNG lấy đất liền: vịnh/cảng có cửa hẹp cũng là
 * "không nối ra rìa" — lấy đất làm tường là chặn luôn nơi bà con vào bờ.
 */
function fillEnclosed(mask) {
  const seen = new Uint8Array(N_CELL);
  const stack = new Int32Array(N_CELL);
  let sp = 0;
  const push = (k) => { if (!mask[k] && !seen[k]) { seen[k] = 1; stack[sp++] = k; } };
  for (let j = 0; j < N_LON; j++) { push(j); push((N_LAT - 1) * N_LON + j); }
  for (let i = 0; i < N_LAT; i++) { push(i * N_LON); push(i * N_LON + N_LON - 1); }
  while (sp > 0) {
    const k = stack[--sp];
    const i = (k / N_LON) | 0;
    const j = k - i * N_LON;
    if (i > 0) push(k - N_LON);
    if (i < N_LAT - 1) push(k + N_LON);
    if (j > 0) push(k - 1);
    if (j < N_LON - 1) push(k + 1);
  }

  const done = new Uint8Array(N_CELL);
  let filled = 0, pockets = 0, skipped = 0, biggest = 0;
  const cells = new Int32Array(MAX_ENCLOSED_CELLS + 1);
  for (let k0 = 0; k0 < N_CELL; k0++) {
    if (mask[k0] || seen[k0] || done[k0]) continue;
    let n = 0, over = false;
    sp = 0;
    stack[sp++] = k0;
    done[k0] = 1;
    while (sp > 0) {
      const k = stack[--sp];
      if (n <= MAX_ENCLOSED_CELLS) cells[n] = k;
      n++;
      if (n > MAX_ENCLOSED_CELLS) over = true;
      const i = (k / N_LON) | 0;
      const j = k - i * N_LON;
      const nb = [i > 0 ? k - N_LON : -1, i < N_LAT - 1 ? k + N_LON : -1,
        j > 0 ? k - 1 : -1, j < N_LON - 1 ? k + 1 : -1];
      for (const q of nb) {
        if (q >= 0 && !mask[q] && !seen[q] && !done[q]) { done[q] = 1; stack[sp++] = q; }
      }
    }
    pockets++;
    if (over) { skipped++; continue; } // vòng khép bất thường — không lấp, báo ra
    if (n > biggest) biggest = n;
    for (let t = 0; t < n; t++) { mask[cells[t]] = 1; filled++; }
  }
  return { filled, pockets, skipped, biggest };
}

// ───────────────────────────────── chạy ─────────────────────────────────

const tStart = Date.now();
const cls = await loadEtopo();
const gebco = await mergeGebco(cls);

// Soát ở RANH GIỚI, không nuốt: thiếu GEBCO nhiều nghĩa là bản .bin này yếu hơn
// bản nó thay thế — thà đỏ còn hơn đóng gói một file trông-như-thật.
if (gebco.failed > gebco.tiles * 0.02) {
  throw new Error(`GEBCO hỏng ${gebco.failed}/${gebco.tiles} ô vuông (> 2%) — chạy lại`);
}
if (gebco.covered < N_CELL * 0.98) {
  throw new Error(`GEBCO chỉ phủ ${gebco.covered}/${N_CELL} ô (< 98%) — chạy lại`);
}

const missing = cls.reduce((n, v) => (v === -1 ? n + 1 : n), 0);
if (missing > N_CELL * 0.01) {
  throw new Error(`Thiếu ${missing} ô (> 1%) — kiểm tra lại bước/nguồn`);
}

// Đường bờ THẬT nói cái gì là đất — trước mặt nạ rạn, vì mặt nạ "chỉ hạ không
// nâng" phải thấy đất đã đứng ở 0 để không đè rạn-trên-đảo thành lớp 1.
const coast = JSON.parse(readFileSync(COAST, "utf8"));
if (!Array.isArray(coast?.features) || coast.features.length === 0) {
  throw new Error(`${COAST} không có feature nào — đường bờ là nguồn duy nhất nói "đất", không được bỏ qua`);
}
const tCoast = Date.now();
const land = stampCoastLand(cls, coast);
console.log(
  `đường bờ: ${land.polys} đa giác → dập ${land.stamped} ô thành đất (${Date.now() - tCoast} ms scanline)`,
);

const fc = JSON.parse(readFileSync(REEF_SHAPES, "utf8"));
if (!Array.isArray(fc?.features) || fc.features.length === 0) {
  throw new Error(`${REEF_SHAPES} không có feature nào — mặt nạ rạn là ràng buộc an toàn, không được bỏ qua`);
}
const { mask, marked } = buildHazardMask(fc);
const pocket = fillEnclosed(mask);
console.log(
  `mặt nạ hiểm hoạ: ${marked} ô nở từ ${fc.features.length} hình` +
    ` + ${pocket.filled} ô lòng hồ (${pocket.pockets} vụng, lớn nhất ${pocket.biggest} ô` +
    `${pocket.skipped ? `, BỎ QUA ${pocket.skipped} vùng quá lớn` : ""})`,
);
if (pocket.skipped) {
  console.warn(
    `CẢNH BÁO: ${pocket.skipped} vùng kín > ${MAX_ENCLOSED_CELLS} ô không được lấp` +
      ` — xem lại reef-shapes.v1.json xem có vòng nào khép nhầm không`,
  );
}

let forced = 0;
for (let k = 0; k < N_CELL; k++) {
  if (!mask[k]) continue;
  // Ô trong rạn CẤM là lớp 1 "mặt nạ", bất kể mô hình độ sâu nói gì — lớp mà
  // route-plan.ts coi là không đi được (chỉ nới được sát cảng/điểm đến).
  // Không dùng lớp 0 vì 0 nghĩa là ĐẤT LIỀN, chỗ khác đọc để vẽ bờ và loại
  // điểm dự báo. Chỉ HẠ, không nâng: rạn nằm trên đất liền (lớp 0) thì giữ 0.
  if (cls[k] === -1 || cls[k] > CLASS_MASK) { cls[k] = CLASS_MASK; forced++; }
}
console.log(`ép về lớp 1 "mặt nạ rạn": ${forced} ô`);

// ô thiếu lẻ tẻ coi như đủ sâu (an toàn nghiêng về "không chặn nhầm giữa khơi")
// 4 bit/ô, 2 ô/byte: ô chẵn ở 4 bit thấp, ô lẻ ở 4 bit cao.
const packed = new Uint8Array(Math.ceil(N_CELL / 2));
for (let k = 0; k < N_CELL; k++) {
  const c = cls[k] === -1 ? CLASS_DEEP : cls[k];
  packed[k >> 1] |= c << ((k & 1) * 4);
}

mkdirSync("public/data", { recursive: true });
writeFileSync(OUT, packed);
console.log(
  `OK: ${OUT} — ${N_LAT}×${N_LON} ô, ${packed.length} byte, thiếu ${missing}` +
    ` (tổng ${Math.round((Date.now() - tStart) / 1000)} s)`,
);

// ─────────────────────── tự soát sau khi đóng gói ───────────────────────

const at = (lat, lon) => {
  const i = Math.round((lat - LAT0) / STEP);
  const j = Math.round((lon - LON0) / STEP);
  if (i < 0 || i >= N_LAT || j < 0 || j >= N_LON) return null;
  const k = i * N_LON + j;
  return (packed[k >> 1] >> ((k & 1) * 4)) & 15;
};
const tally = [0, 0, 0, 0, 0, 0];
for (let k = 0; k < N_CELL; k++) tally[(packed[k >> 1] >> ((k & 1) * 4)) & 15]++;
console.log(
  `phân bố lớp: đất ${tally[0]} · mặt nạ rạn ${tally[1]} · rất cạn <2 m ${tally[2]}` +
    ` · cạn 2–4 m ${tally[3]} · nông 4–12 m ${tally[4]} · đủ sâu ${tally[5]}`,
);
console.log("khơi Nam Trung Bộ (13, 110.5) →", at(13, 110.5), "(mong 5)");
console.log("giữa Biển Đông  (13, 114)    →", at(13, 114), "(mong 5)");
console.log("đồng bằng Cà Mau (9.1, 105.1) →", at(9.1, 105.1), "(mong 0)");
console.log("Sài Gòn (10.8, 106.7)        →", at(10.8, 106.7), "(mong 0)");
console.log("Vịnh Bắc Bộ (19.5, 107.3)    →", at(19.5, 107.3), "(mong 4-5)");
// Bốn điểm briefing-03: NƯỚC theo đường bờ mà bản cũ bảo là đất
for (const [lat, lon] of [[10.02, 104.99], [10.02, 104.96], [9.75, 104.85], [10.02, 104.72]]) {
  console.log(`briefing-03 (${lat}, ${lon}) →`, at(lat, lon), "(mong ≠ 0)");
}
// Năm toạ độ đã gây ra sự cố 2026-08-29 — ETOPO nói "đủ sâu", GEBCO nói 1–2 m
for (const [lat, lon] of [
  [9.761, 116.514], [9.726, 116.588], [9.761, 114.341],
  [8.682, 114.177], [22.379, 113.886],
]) {
  console.log(`sự cố (${lat}, ${lon}) →`, at(lat, lon), "(mong ≤ 4, KHÔNG được là 5)");
}
// Toàn bộ tâm hình rạn: không cái nào được là "đủ sâu"
const centroid = (g) => {
  let sx = 0, sy = 0, n = 0;
  const w = (a) => { if (typeof a[0] === "number") { sx += a[0]; sy += a[1]; n++; } else a.forEach(w); };
  w(g.coordinates);
  return [sx / n, sy / n];
};
let bad = 0;
for (const f of fc.features) {
  const [lon, lat] = centroid(f.geometry);
  if (at(lat, lon) === CLASS_DEEP) bad++;
}
console.log(`tâm hình rạn còn "đủ sâu": ${bad}/${fc.features.length} (mong 0)`);
