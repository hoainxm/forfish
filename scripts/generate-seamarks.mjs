// Sinh LỚP BÁO HIỆU HÀNG HẢI (phao · đèn biển · tiêu · lồng bè) cho Trục 1 —
// chạy MỘT LẦN (khi có mạng):
//   node scripts/generate-seamarks.mjs
//
// Đầu ra: public/data/seamarks.v1.json — dạng GỌN (bảng tra + mảng số), KHÔNG
// GeoJSON: 4.000+ điểm mà mỗi điểm đeo một object properties thì file phình gấp
// mấy lần, trong khi bà con tải qua sóng 3G ngoài khơi. Bảng tra + chỉ số nén
// tốt hơn nhiều. src/lib/seamarks.ts giải mã ngược.
//
//   { v, types[], chars[], groups[], colours[],
//     marks[[lon,lat,t,ch,grp,lc,per,rng,bc]] }
//     lon,lat — 5 số thập phân (~1 m; báo hiệu cần chính xác hơn rạn)
//     t   — chỉ số trong types[]        (loại báo hiệu)
//     ch  — chỉ số trong chars[]        (đặc tính đèn: Fl, Q, Iso, Mo…)  | -1
//     grp — chỉ số trong groups[]       (nhóm chớp: "2", "2+1", "A"…)    | -1
//     lc  — chỉ số trong colours[]      (màu ÁNH ĐÈN)                    | -1
//     per — chu kỳ (giây)                                               | 0
//     rng — tầm hiệu lực (hải lý)                                       | 0
//     bc  — chỉ số trong colours[]      (màu THÂN phao/tiêu)             | -1
//   Phần tử cuối bằng giá trị "trống" thì CẮT — phao không đèn chỉ còn 3 số.
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Trước đây phao/đèn biển trong app CHỈ là ảnh raster kéo từ OpenSeaMap qua
// mạng (src/lib/tile-proxy.ts, nguồn "seamark"). Ảnh thì: (a) app KHÔNG biết
// chấm đó là phao gì — không tra được, không chạm xem được; (b) mất sóng chỉ
// còn mấy ô bà con tình cờ đã mở. Ngoài khơi mất sóng nhiều ngày = mất báo
// hiệu. Đóng gói thành vector nằm sẵn trong máy thì tra được VÀ luôn có.
//
// ── NGUỒN ─────────────────────────────────────────────────────────────────
// OpenStreetMap qua Overpass (ODbL, dùng thương mại được), tag `seamark:*`
// (dữ liệu gốc của chính OpenSeaMap). Cùng khuôn generate-sea-lanes.mjs: kéo
// LÚC BUILD chứ không runtime — Overpass là host ngoài, mất sóng không về +
// rate-limit → xuất sẵn asset cùng-origin để service worker giữ.
//
// ⚠️ CHỦ QUYỀN: BỎ HẲN mọi trường TÊN (`name`, `seamark:name`,
// `seamark:national_name`). OSM vùng tranh chấp gắn tên nước ngoài/chữ Hán;
// giữ tên là lọt đúng thứ app cấm. Dự án đã chọn cách này cho reef-shapes và
// nó an toàn hơn lọc tay. CỔNG TỰ KIỂM ở cuối file quét CJK trên TOÀN BỘ chuỗi
// sắp ghi ra — còn một ký tự Hán là NÉM lỗi, không ghi file.
//
// ## Assumptions
// - `light_float` (phao đèn nổi) không nằm trong danh sách ba-spec liệt kê
//   nhưng cùng họ với `buoy_*`/`light_*` (đúng nghĩa là phao có đèn) nên giữ.
// - `beacon` trơn (không hậu tố) giữ như tiêu báo hiệu chung.
// - Đối tượng dạng WAY (vùng neo đậu, lồng bè, cảng, cửa âu) rút về TÂM
//   (`out center`) — dataset này là lớp ĐIỂM để chạm xem, không phải lớp vùng.
//   Hình vùng nếu cần sau này thuộc về một file khác, không nhét chung.
// - Bỏ `berth` (chỗ cập cầu) và mọi thứ chỉ có nghĩa trong bến cảng
//   (small_craft_facility, crane, bunker_station, terminal…): ngư dân ngoài
//   khơi không dùng, chỉ tốn dung lượng.

import { writeFileSync, mkdirSync } from "node:fs";

// Khung trọn vùng biển VN (Nam, Tây, Bắc, Đông) — gồm Hoàng Sa/Trường Sa.
const OVP_BBOX = [4.0, 102.0, 24.0, 118.0];
const ROUND = 5; // ~1 m
const BUDGET_KB = 400;

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

/**
 * Loại báo hiệu GIỮ LẠI — lọc theo GIÁ TRỊ ĐI BIỂN, không lấy hết 43 loại OSM.
 * Giữ: mọi phao, mọi tiêu, mọi đèn, phao ảo, vùng neo, cảng, trụ buộc, cọc,
 * giàn khoan, lồng bè (né), cửa/âu tàu. `landmark` chỉ giữ KHI CÓ ĐÈN (2.100
 * mốc trên bờ mà chỉ ~107 cái có đèn — số còn lại là nhà thờ, ống khói… vô ích
 * ngoài khơi).
 */
const KEEP = new Set([
  "buoy_lateral",
  "buoy_cardinal",
  "buoy_safe_water",
  "buoy_special_purpose",
  "buoy_isolated_danger",
  "buoy_installation",
  "beacon",
  "beacon_lateral",
  "beacon_cardinal",
  "beacon_safe_water",
  "beacon_special_purpose",
  "beacon_isolated_danger",
  "light",
  "light_major",
  "light_minor",
  "light_vessel",
  "light_float",
  "virtual_aton",
  "landmark", // CHỈ khi có tag seamark:light:*
  "anchorage",
  "harbour",
  "mooring",
  "pile",
  "platform",
  "marine_farm",
  "gate",
]);

function overpassQL() {
  const [s, w, n, e] = OVP_BBOX;
  const b = `(${s},${w},${n},${e})`;
  // Lấy CẢ 43 loại rồi lọc trong JS: một truy vấn gọn hơn 27 mệnh đề, và bảng
  // lọc nằm cạnh bảng nhãn tiếng Việt (sửa một chỗ, không lệch hai nơi).
  return `[out:json][timeout:240];
(
  node["seamark:type"]${b};
  way["seamark:type"]${b};
);
out center;`;
}

async function fetchOverpass() {
  const body = "data=" + encodeURIComponent(overpassQL());
  for (const url of OVERPASS_MIRRORS) {
    try {
      process.stdout.write(`Overpass ${new URL(url).host} … `);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SDFish-build/1.0 (fisherman app; nautical chart)",
        },
        body,
      });
      if (!res.ok) {
        console.log(`HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      console.log(`ok — ${json.elements?.length ?? 0} phần tử`);
      return json;
    } catch (e) {
      console.log(`lỗi: ${e.message}`);
    }
  }
  return null;
}

const r = (v) => Number(v.toFixed(ROUND));

/** Bảng tra dùng chung: chuỗi → chỉ số (thêm khi chưa có). */
function interner() {
  const list = [];
  const map = new Map();
  return {
    list,
    idx(v) {
      if (v === undefined || v === null) return -1;
      const s = String(v).trim();
      if (!s) return -1;
      let i = map.get(s);
      if (i === undefined) {
        i = list.length;
        list.push(s);
        map.set(s, i);
      }
      return i;
    },
  };
}

/** Số dương hoặc 0 (0 = không có) — chu kỳ / tầm hiệu lực. */
function num(v) {
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
}

const ovp = await fetchOverpass();
if (!ovp?.elements?.length) {
  console.warn(
    "⚠️ Overpass không trả gì — KHÔNG ghi đè file cũ. Chạy lại khi có mạng.",
  );
  process.exit(0);
}

const types = interner();
const chars = interner();
const groups = interner();
const colours = interner();
const marks = [];
const tally = {};
let dropped = 0;

for (const el of ovp.elements) {
  const tags = el.tags ?? {};
  const t = tags["seamark:type"];
  if (!t || !KEEP.has(t)) {
    dropped++;
    continue;
  }
  // landmark: chỉ giữ cái CÓ ĐÈN (mốc trên bờ không đèn thì ngoài khơi vô dụng)
  const lightKeys = Object.keys(tags).filter((k) =>
    k.startsWith("seamark:light"),
  );
  if (t === "landmark" && lightKeys.length === 0) {
    dropped++;
    continue;
  }

  const lon = el.lon ?? el.center?.lon;
  const lat = el.lat ?? el.center?.lat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    dropped++;
    continue;
  }

  // màu THÂN phao/tiêu: seamark:<loại>:colour (KHÔNG phải màu ánh đèn)
  const bodyColour = tags[`seamark:${t}:colour`] ?? tags["seamark:colour"];

  const row = [
    r(lon),
    r(lat),
    types.idx(t),
    chars.idx(tags["seamark:light:character"]),
    groups.idx(tags["seamark:light:group"]),
    colours.idx(tags["seamark:light:colour"]),
    num(tags["seamark:light:period"]),
    num(tags["seamark:light:range"]),
    colours.idx(bodyColour),
  ];
  marks.push(row);
  tally[t] = (tally[t] ?? 0) + 1;
}

// gom theo loại rồi theo vị trí — chỉ số cạnh nhau giống nhau ⇒ gzip nhỏ hơn
marks.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);

// cắt đuôi rỗng: [lon,lat,t] cho phao không đèn (đa số bản ghi ngắn hẳn)
const EMPTY = [null, null, null, -1, -1, -1, 0, 0, -1];
for (const row of marks) {
  while (row.length > 3 && row[row.length - 1] === EMPTY[row.length - 1]) {
    row.pop();
  }
}

// ── CỔNG TỰ KIỂM 1: toạ độ phải trong khung biển VN ────────────────────────
const [S, W, N, E] = OVP_BBOX;
const outOfRange = marks.filter(
  (m) => m[1] < S || m[1] > N || m[0] < W || m[0] > E,
);
if (outOfRange.length) {
  throw new Error(
    `CHẶN: ${outOfRange.length} báo hiệu ngoài khung biển VN — ` +
      outOfRange
        .slice(0, 5)
        .map((m) => `[${m[0]},${m[1]}]`)
        .join(", "),
  );
}

const out = {
  v: 1,
  types: types.list,
  chars: chars.list,
  groups: groups.list,
  colours: colours.list,
  marks,
};
const json = JSON.stringify(out);

// ── CỔNG TỰ KIỂM 2 — CHỦ QUYỀN: không cho lọt ký tự Hán/CJK ────────────────
// Quét TOÀN BỘ chuỗi sắp ghi ra file (bảng loại + bảng đặc tính + bảng màu).
// Đã bỏ hẳn trường tên nên cổng này là chốt chặn cuối, không phải bộ lọc.
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;
if (CJK.test(json)) {
  const dirty = [
    ...types.list,
    ...chars.list,
    ...groups.list,
    ...colours.list,
  ].filter((s) => CJK.test(s));
  throw new Error(
    `CHẶN: dữ liệu còn ký tự Hán/CJK — ${dirty.slice(0, 10).join(", ")}`,
  );
}

// ── CỔNG TỰ KIỂM 3: ngân sách dung lượng (offline qua sóng 3G) ─────────────
const kb = Math.round(json.length / 1024);
if (kb > BUDGET_KB) {
  throw new Error(`CHẶN: ${kb} KB > ngân sách ${BUDGET_KB} KB — cắt bớt loại.`);
}

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/seamarks.v1.json", json);
console.log(
  "giữ theo loại:",
  Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1])),
);
console.log(`bỏ (ngoài danh sách / thiếu toạ độ / mốc không đèn): ${dropped}`);
console.log(
  `OK: public/data/seamarks.v1.json — ${marks.length} báo hiệu, ${kb} KB ` +
    `(ngân sách ${BUDGET_KB} KB) · ${types.list.length} loại, ` +
    `${chars.list.length} đặc tính đèn, ${groups.list.length} nhóm chớp, ` +
    `${colours.list.length} màu`,
);
