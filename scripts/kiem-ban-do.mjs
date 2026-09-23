// TỰ KIỂM BẢN ĐỒ — "ở chỗ này, zoom này, lớp nào BẬT và có bao nhiêu thứ để vẽ?"
//
//   node scripts/kiem-ban-do.mjs                  # bảng cho mọi chỗ mẫu
//   node scripts/kiem-ban-do.mjs --noi nha-trang  # một chỗ
//   node scripts/kiem-ban-do.mjs --lat 12.2 --lon 109.2 --zoom 13
//   node scripts/kiem-ban-do.mjs --json           # cho máy đọc / cho test
//
// ── VÌ SAO CÓ FILE NÀY (2026-09-02) ────────────────────────────────────────
// Phiên 2026-09-01 mất rất nhiều công vì KHÔNG CÓ CÁCH TỰ KIỂM LẶP LẠI ĐƯỢC.
// Lead nhìn màn hình thấy bản đồ trống rồi kết luận "bản đồ hỏng" — trong khi
// sự thật là màn mở đầu nằm ở 110,8°Đ/12,8°B, GIỮA BIỂN HỞ, chỗ vốn không có
// đất để vẽ. Kết luận sai đó tốn gần một buổi và suýt dẫn tới việc đi sửa một
// thứ không hỏng.
//
// Bài học không phải "nhìn kỹ hơn" mà là: **mắt người không phải công cụ đo**.
// Chỗ nào không có dữ liệu thì trông y hệt chỗ có dữ liệu mà lớp bị tắt, và y
// hệt chỗ lớp bật mà dữ liệu rỗng. Ba nguyên nhân khác hẳn nhau, một hình ảnh.
//
// File này tách ba thứ đó ra bằng SỐ:
//   · CỔNG ZOOM — lớp có được phép vẽ ở mức zoom này không (đọc CHÍNH hằng số
//     trong `src/lib/ocean-map.ts`, không chép lại, nên không bao giờ lệch)
//   · DỮ LIỆU  — trong khung nhìn có bao nhiêu đối tượng
//   · KẾT LUẬN — "sẽ thấy", "lớp tắt ở zoom này", hay "không có gì ở đây"
//
// ⚠️ NÓ KHÔNG KIỂM ĐIỂM ẢNH. Nó không biết màu có đủ tương phản không, chữ có
// chồng nhau không, ký hiệu có vẽ ra hình đúng không. Những thứ đó vẫn phải
// nhìn — nhưng nhờ file này, khi nhìn thấy trống thì đã biết TRỐNG VÌ SAO.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = (f) => path.join(ROOT, "public/data", f);

/* ── Đọc hằng số nấc zoom TỪ CHÍNH MÃ NGUỒN ────────────────────────────────
   Chép tay lại các con số là tạo ra một bản sự thật thứ hai, và bản sao sẽ
   lệch đúng vào hôm ai đó đổi nấc zoom mà quên file này. Đọc thẳng thì không
   thể lệch: sửa mã là bảng đổi theo. */
function docHangSo() {
  const src = readFileSync(path.join(ROOT, "src/lib/ocean-map.ts"), "utf8");
  /*  Từ 2026-09-03c các hằng trỏ về CHART_TIER.<MỐC> (bốn tầng có tên) thay
      vì số — đọc bảng mốc trước, rồi giải tham chiếu. Số trần (12,5) vẫn đọc. */
  const tierSrc = src.match(/export const CHART_TIER\s*=\s*\{([^}]*)\}/);
  if (!tierSrc) throw new Error("không đọc được CHART_TIER trong ocean-map.ts");
  const tier = Object.fromEntries(
    [...tierSrc[1].matchAll(/(\w+)\s*:\s*([0-9.]+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  const lay = (ten) => {
    const m = src.match(new RegExp(`export const ${ten}\\s*=\\s*(CHART_TIER\\.(\\w+)|[0-9.]+)`));
    if (!m) throw new Error(`không đọc được hằng ${ten} trong ocean-map.ts`);
    if (m[2]) {
      if (!(m[2] in tier)) throw new Error(`${ten} trỏ mốc lạ CHART_TIER.${m[2]}`);
      return tier[m[2]];
    }
    return Number(m[1]);
  };
  return {
    FAIRWAY_DEPTH_MINZOOM: lay("FAIRWAY_DEPTH_MINZOOM"),
    SOUNDING_DOT_MINZOOM: lay("SOUNDING_DOT_MINZOOM"),
    SOUNDING_LABEL_MINZOOM: lay("SOUNDING_LABEL_MINZOOM"),
    LIGHTHOUSE_MINZOOM: lay("LIGHTHOUSE_MINZOOM"),
    LIGHTHOUSE_LABEL_MINZOOM: lay("LIGHTHOUSE_LABEL_MINZOOM"),
    WRECK_MINZOOM: lay("WRECK_MINZOOM"),
  };
}

/* ── Khung nhìn ────────────────────────────────────────────────────────────
   Xấp xỉ Web Mercator: ở zoom z, thế giới rộng 256·2^z điểm ảnh. Màn điện
   thoại lấy 430×760 (đúng khung app đang dùng khi soi). Không cần chính xác
   tới điểm ảnh — câu hỏi là "có gì quanh đây không", sai vài phần trăm khung
   không đổi câu trả lời. */
function khungNhin(lat, lon, zoom, rongPx = 430, caoPx = 760) {
  const doMoiPx = 360 / (256 * 2 ** zoom);
  const nuaRongDo = (rongPx / 2) * doMoiPx;
  // vĩ độ co lại theo cos(lat) trong Mercator
  const nuaCaoDo = (caoPx / 2) * doMoiPx * Math.cos((lat * Math.PI) / 180);
  return {
    tay: lon - nuaRongDo,
    dong: lon + nuaRongDo,
    nam: lat - nuaCaoDo,
    bac: lat + nuaCaoDo,
  };
}

const trong = (k, lon, lat) =>
  lon >= k.tay && lon <= k.dong && lat >= k.nam && lat <= k.bac;

/* ── Nạp dữ liệu (thiếu file thì nói thiếu, không ném) ──────────────────── */
function nap(ten) {
  const p = D(ten);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Đếm đối tượng của từng lớp trong khung. */
function demTrongKhung(k) {
  const out = {};

  const s = nap("soundings.v1.json");
  const cv = nap("soundings-cangvu.v1.json");
  const xac = nap("soundings-verified.v1.json");

  /*  ĐIỂM BỊ CHẤM NGHI LỖI KHÔNG ĐƯỢC ĐẾM — vì bản đồ cũng không vẽ chúng.
      Bảng này phải nói đúng cái MÀN HÌNH sẽ có, không phải cái FILE có. */
  const nghi = new Set();
  for (const m of xac?.muc ?? [])
    if (m?.kq === "nghi-loi" && m.loai === "diem")
      nghi.add(`${m.tep}:${m.i}`);

  let diem = 0;
  for (const [i, r] of (s?.diem ?? []).entries())
    if (!nghi.has(`0:${i}`) && trong(k, r[0], r[1])) diem++;
  for (const [i, r] of (cv?.diem ?? []).entries())
    if (!nghi.has(`1:${i}`) && trong(k, r[0], r[1])) diem++;
  out["sounding-dot"] = diem;
  out["sounding-label"] = diem;

  let tuyen = 0;
  for (const t of s?.tuyen ?? [])
    if ((t.diem ?? []).some((c) => trong(k, c[0], c[1]))) tuyen++;
  const f = nap("fairway-depths.v1.json");
  let doan = 0;
  for (const r of f?.doan ?? [])
    if (trong(k, r[4], r[5]) || trong(k, r[6], r[7])) doan++;
  out["depth-line"] = tuyen + doan;

  const sm = nap("seamarks.v1.json");
  out["seamark-*"] = (sm?.marks ?? []).filter((m) => trong(k, m[0], m[1])).length;

  const ai = nap("vn-aids.v1.json");
  out["báo hiệu Cục HH"] = (ai?.marks ?? []).filter((m) => trong(k, m[0], m[1])).length;

  /*  Đèn biển đọc khoá `lights`, KHÔNG phải `marks` — khuôn riêng của
      `den-bien.v1.json`. Đọc nhầm khoá thì bảng báo 0 cho một lớp có 90 ngọn,
      đúng kiểu sai đã làm mất gần một buổi hôm 2026-09-01. */
  const db = nap("den-bien.v1.json");
  out["đèn biển"] = (db?.lights ?? []).filter((m) => trong(k, m[0], m[1])).length;

  const xt = nap("xac-tau.v1.json");
  out["xác tàu"] = (xt?.items ?? []).filter((m) => trong(k, m[0], m[1])).length;

  const iso = nap("isobaths.v1.json");
  let ndg = 0;
  for (const ft of iso?.features ?? []) {
    if (ft?.properties?.k !== "duong") continue;
    const gs = ft.geometry?.coordinates ?? [];
    for (const line of gs)
      if (line.some((c) => trong(k, c[0], c[1]))) {
        ndg++;
        break;
      }
  }
  out["isobath-lines"] = ndg;

  return out;
}

/* ── Cổng zoom: lớp có được phép vẽ ở mức này không ─────────────────────── */
function congZoom(H, zoom) {
  return {
    "sounding-dot": zoom >= H.SOUNDING_DOT_MINZOOM,
    "sounding-label": zoom >= H.SOUNDING_LABEL_MINZOOM,
    "depth-line": zoom >= H.FAIRWAY_DEPTH_MINZOOM,
    "seamark-*": zoom >= 9,
    "báo hiệu Cục HH": zoom >= 9,
    "đèn biển": zoom >= H.LIGHTHOUSE_MINZOOM,
    "xác tàu": zoom >= H.WRECK_MINZOOM,
    "isobath-lines": zoom >= 5,
  };
}

/*  Chỗ mẫu — mỗi chỗ trả lời MỘT câu hỏi khác nhau, đừng bỏ chỗ nào.

    ⚠️ TOẠ ĐỘ LẤY TỪ CỤM DỮ LIỆU THẬT, không gõ theo trí nhớ. Bản đầu của file
    này ghi "Nha Trang = 12,215°B" theo cảm tính, trong khi dữ liệu nằm ở
    11,88°B — ở zoom 13 khung chỉ rộng ~0,06° nên trượt sạch, và bảng báo
    "không có gì ở đây" cho một chỗ có 246 điểm. Chính công cụ này bắt được nó
    ngay lần chạy đầu. Đổi chỗ mẫu thì dò lại cụm, đừng đoán:
      node -e "..." trên soundings.v1.json, gom ô 0,05°, lấy ô dày nhất. */
export const NOI_MAU = {
  "vung-tau": { lat: 10.35, lon: 107.05, zoom: 13, ghi: "cụm dày nhất — khung ảnh Navionics đối chiếu" },
  "ca-mau": { lat: 8.7, lon: 105.3, zoom: 13, ghi: "cụm dày thứ nhì — cực nam" },
  "long-tau": { lat: 10.6, lon: 107.0, zoom: 13, ghi: "luồng sông — nơi 17 điểm nghi lỗi bị GIẤU" },
  "nghe-an": { lat: 19.8, lon: 105.93, zoom: 13, ghi: "miền Bắc — chỉ có ĐOẠN LUỒNG, KHÔNG có điểm rời" },
  "man-mo-dau": { lat: 12.8, lon: 110.8, zoom: 4.6, ghi: "màn mở đầu — CỐ Ý trống, biển hở" },
  "truong-sa": { lat: 8.65, lon: 111.92, zoom: 10, ghi: "ngoài khơi xa — chưa có số đo sâu" },
};

export function kiem(lat, lon, zoom) {
  const H = docHangSo();
  const k = khungNhin(lat, lon, zoom);
  const dem = demTrongKhung(k);
  const cong = congZoom(H, zoom);
  const lop = {};
  for (const ten of Object.keys(dem)) {
    const bat = cong[ten] ?? true;
    const n = dem[ten];
    lop[ten] = {
      soLuong: n,
      congZoomBat: bat,
      ketLuan: !bat
        ? "lớp TẮT ở zoom này"
        : n === 0
          ? "không có gì ở đây"
          : "sẽ thấy",
    };
  }
  return { lat, lon, zoom, khung: k, lop };
}

/* ── Chạy ──────────────────────────────────────────────────────────────── */
function doThamSo(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") o.json = true;
    else if (a.startsWith("--")) o[a.slice(2)] = argv[++i];
  }
  return o;
}

function main() {
  const o = doThamSo(process.argv.slice(2));
  const ds =
    o.lat && o.lon
      ? [["(tự nhập)", { lat: +o.lat, lon: +o.lon, zoom: +(o.zoom ?? 13), ghi: "" }]]
      : o.noi
        ? [[o.noi, NOI_MAU[o.noi]]]
        : Object.entries(NOI_MAU);

  if (o.noi && !NOI_MAU[o.noi]) {
    console.error(`Không có chỗ "${o.noi}". Có: ${Object.keys(NOI_MAU).join(", ")}`);
    process.exit(1);
  }

  const ketQua = {};
  for (const [ten, n] of ds) ketQua[ten] = { ...kiem(n.lat, n.lon, n.zoom), ghi: n.ghi };

  if (o.json) {
    console.log(JSON.stringify(ketQua, null, 2));
    return;
  }

  for (const [ten, r] of Object.entries(ketQua)) {
    console.log(
      `\n── ${ten}  ${r.lat}°B ${r.lon}°Đ  zoom ${r.zoom}${r.ghi ? `  · ${r.ghi}` : ""}`,
    );
    for (const [lop, v] of Object.entries(r.lop)) {
      const dau = v.ketLuan === "sẽ thấy" ? "✓" : v.ketLuan === "lớp TẮT ở zoom này" ? "·" : "✗";
      console.log(
        `   ${dau} ${lop.padEnd(18)} ${String(v.soLuong).padStart(5)}  ${v.ketLuan}`,
      );
    }
  }
  console.log(
    "\n  ✓ sẽ thấy · ✗ không có dữ liệu ở đây · · lớp tắt theo nấc zoom" +
      "\n  ⚠️ Bảng này KHÔNG kiểm điểm ảnh — màu, chồng chữ, hình ký hiệu vẫn phải nhìn.\n",
  );
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("kiem-ban-do.mjs"))
  main();
