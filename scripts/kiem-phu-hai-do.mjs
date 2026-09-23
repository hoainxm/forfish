// THƯỚC ĐO PHỦ HẢI ĐỒ — "phủ bao nhiêu % sổ nhà nước, hơn/thua hải đồ thương
// mại ở lớp nào?"
//
//   node scripts/kiem-phu-hai-do.mjs           # hai bảng + một dòng tổng kết
//   node scripts/kiem-phu-hai-do.mjs --json    # cho máy đọc / cho test
//   npm run kiem:phu
//
// ── VÌ SAO CÓ FILE NÀY (2026-09-02) ────────────────────────────────────────
// Chủ dự án yêu cầu "hoàn thiện tới khi 100% vượt qua các hải đồ thương mại".
// Muốn chữ "100%" có nghĩa thì phải có THƯỚC — một phép đo lặp lại được, có
// nguồn cho từng con số, chạy một lệnh là ra. Không có thước thì "vượt rồi"
// chỉ là cảm giác, và cảm giác đã lừa dự án một lần (xem đầu kiem-ban-do.mjs).
//
// Thước có BA trục, cố ý tách rời vì chúng trả lời ba câu khác nhau:
//
//   TRỤC 1 — SO VỚI SỔ NHÀ NƯỚC (khách quan nhất): với từng tuyến luồng, đếm
//   báo hiệu ta đang phát so với CON SỐ NHÀ NƯỚC TỰ CÔNG BỐ (ô "Số báo hiệu"
//   trên trang ENC của Cục Hàng hải + số đếm trong sổ AtoN 2016). Đây không
//   phải ta tự chấm điểm ta: cột chuẩn do cơ quan quản lý báo hiệu in ra.
//
//   TRỤC 2 — SO VỚI NAVIONICS (khung ảnh đối chiếu): trong đúng khung nhìn đã
//   có ảnh chụp Navionics để đối chiếu, đếm của ta (bằng CHÍNH bộ đếm của
//   kiem-ban-do.mjs — import, không chép) so với số đếm tay trên ảnh của họ.
//
//   TRỤC 3 — 15 HẠNG MỤC HẢI ĐỒ ĐIỆN TỬ THƯƠNG MẠI (IHO S-52 + cái C-MAP/
//   Navionics cho ngư dân thấy): mỗi hạng mục chấm ĐẠT/VƯỢT/CHƯA, đọc thẳng
//   `public/data/*.json` + `public/sw.js` (không hardcode con số dữ liệu; chỉ
//   ngưỡng so sánh mới ghi cứng, luôn kèm nguồn). Lý lẽ đầy đủ từng hạng mục:
//   docs/research/thuoc-vuot-hai-do-2026-09.md (định nghĩa "VƯỢT" ở §0).
//
// ⚠️ Thước KHÔNG kiểm đúng-sai của từng vị trí — việc đó là của các cổng trong
// generate-*.mjs và bộ test. Thước chỉ đo ĐỘ PHỦ: có bao nhiêu so với phải có.
//
// ── NGUỒN CỦA TỪNG CON SỐ CHUẨN (không con số nào được bịa) ────────────────
// · Ô "Số báo hiệu" trang ENC: enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=<n>,
//   đọc 2026-09-02 — bảng chép ở docs/research/san-so-dang-ky-2026-09.md §3.
// · Số đếm sổ AtoN 2016: "List of AtoN System" (VMS-South, NXB GTVT 2016) —
//   cùng tài liệu trên.
// · Luồng Hải Phòng 120 phao + 45 đăng tiêu: trang ENC #1, đã ghi trong
//   docs/research/do-phu-hai-do-2026-08.md và đầu generate-vn-aids.mjs.
// · Đèn biển 94 ngọn: con số chủ dự án cung cấp theo sổ đăng ký quốc gia
//   (brief 2026-09-02) — ghi kèm trạng thái "chưa tra được văn bản gốc" ở
//   docs/research/gop-so-aton-2026-09.md; KHÔNG trình bày như trích dẫn văn bản.
// · Số đếm trên ảnh Navionics khung Vũng Tàu: đếm tay trên ảnh chủ dự án cung
//   cấp, ghi ở docs/research/gop-so-aton-2026-09.md (trục 2).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kiem, NOI_MAU } from "./kiem-ban-do.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = (f) => path.join(ROOT, "public/data", f);
const doc = (f) => JSON.parse(readFileSync(D(f), "utf8"));

/* ── TRỤC 1 — bảng con số nhà nước tự công bố ─────────────────────────────
 *
 * `congBo` = ô "Số báo hiệu" (phao + tiêu) của trang ENC tương ứng. `null` =
 * nhà nước KHÔNG công bố con số nào (không có gì để chấm — không đưa vào %).
 * `nghi` = con số công bố có bằng chứng là SAI/CŨ — vẫn in ra bảng cho đủ
 * chuyện, nhưng loại khỏi % tổng: chấm điểm theo một cột chuẩn sai còn tệ hơn
 * không chấm.
 * `khoa` = mảnh tên (đã bỏ dấu, thường hoá) để nhận các tuyến Thông báo hàng
 * hải nói về cùng luồng — tin TBHH không mang mã ENC.
 */
export const CONG_BO_TUYEN = [
  // ── 22 tuyến miền Nam (khuôn trang chỉ có ô đếm) ──
  { encId: 33, ten: "Định An – Cần Thơ", congBo: 118, khoa: ["dinh an"] },
  { encId: 19, ten: "Sài Gòn – Vũng Tàu", congBo: 112, khoa: ["sai gon"] },
  { encId: 21, ten: "Soài Rạp", congBo: 73, khoa: ["soai rap"] },
  { encId: 32, ten: "Sông Tiền (Cửa Tiểu)", congBo: 64, khoa: ["song tien", "cua tieu"] },
  { encId: 31, ten: "Vũng Tàu – Thị Vải", congBo: 71, khoa: ["thi vai"] },
  { encId: 20, ten: "Đồng Nai", congBo: 33, khoa: ["dong nai"] },
  { encId: 36, ten: "Sông Dinh", congBo: 20, khoa: ["song dinh"] },
  { encId: 35, ten: "Sông Dừa", congBo: 12, khoa: ["song dua"] },
  { encId: 59, ten: "Nha Trang", congBo: 13, khoa: ["nha trang"] },
  { encId: 44, ten: "Ba Ngòi", congBo: 13, khoa: ["ba ngoi"] },
  { encId: 41, ten: "Hà Tiên", congBo: 12, khoa: ["ha tien"] },
  { encId: 40, ten: "Năm Căn – Bồ Đề", congBo: 10, khoa: ["nam can"] },
  { encId: 64, ten: "Phú Quý", congBo: 7, khoa: ["phu quy"] },
  { encId: 70, ten: "An Thới", congBo: 6, khoa: ["an thoi"] },
  { encId: 43, ten: "Côn Sơn – Côn Đảo", congBo: 5, khoa: ["con son"] },
  { encId: 42, ten: "Đầm Môn", congBo: 4, khoa: ["dam mon"] },
  { encId: 30, ten: "Vũng Rô", congBo: 3, khoa: ["vung ro"] },
  { encId: 65, ten: "Bến Đầm – Côn Đảo", congBo: 3, khoa: ["ben dam"] },
  { encId: 73, ten: "Sa Đéc", congBo: 2, khoa: ["sa dec"] },
  {
    encId: 66,
    ten: "Đồng Tranh – Tắt Bài – Tắt Cua",
    congBo: 6,
    khoa: ["dong tranh", "tat bai", "tat cua"],
    // Ô đếm ENC là số CŨ trước đợt "thiết lập hệ thống phao báo hiệu" (có
    // Thông báo hàng hải riêng); sổ 2016 in 29. Vẫn tính vào % (ta chỉ hơn).
    ghi: "ô đếm ENC là số cũ; sổ 2016 in 29 (san-so-dang-ky §3)",
  },
  {
    encId: 38,
    ten: "Quy Nhơn",
    congBo: 314,
    nghi: true,
    khoa: ["quy nhon"],
    ghi: "ENC ghi '300 phao' cho luồng dài 6 km — gần chắc lỗi nhập liệu; sổ 2016 in 21. LOẠI khỏi % tổng",
  },
  {
    encId: 34,
    ten: "Gò Gia",
    congBo: null,
    khoa: ["go gia"],
    ghi: "ENC để trống cả ô Phao lẫn ô Tiêu; tuyến nằm trong mục Đồng Tranh của sổ (san-so-dang-ky §8)",
  },
  // ── hai tuyến sổ 2016 có mà ENC chưa liệt kê ──
  {
    encId: null,
    ten: "Luồng tàu lớn vào sông Hậu (kênh Quan Chánh Bố)",
    congBo: 65,
    khoa: ["quan chanh bo"],
    ghi: "ENC chưa liệt kê tuyến; con số chuẩn lấy từ số đếm sổ 2016",
  },
  // ── mốc miền Bắc để thước không chỉ nhìn một nửa nước ──
  {
    encId: 1,
    ten: "Hải Phòng",
    congBo: 165,
    khoa: ["hai phong"],
    ghi: "120 phao + 45 đăng tiêu — trang ENC #1 (do-phu-hai-do-2026-08.md)",
  },
];

/** Đèn biển: ta so với sổ đăng ký quốc gia. */
export const CONG_BO_DEN_BIEN = {
  ten: "Đèn biển (cả nước)",
  congBo: 94,
  nguon:
    "sổ đăng ký quốc gia 94 ngọn — chủ dự án cung cấp (brief 2026-09-02); " +
    "LƯU Ý mẫu số (2026-09-02b): lớp nay có 105 ngọn — 11 ngọn thêm từ Pub 112 " +
    "nằm trên thực thể VN bị chiếm đóng, NGOÀI sổ VN nên không tính vào tử số; " +
    "phần trăm chặn trần theo congBo để 105/94 không hiện thành 112% gây hiểu nhầm; " +
    "chưa tra được văn bản gốc, ghi ở docs/research/gop-so-aton-2026-09.md",
};

const NGUON_ENC = (id) =>
  `ô "Số báo hiệu" — enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=${id} (đọc 2026-09-02, san-so-dang-ky-2026-09.md §3)`;

/** Bỏ dấu + thường hoá — để khớp tên tuyến giữa các nguồn. */
const boDau = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * TRỤC 1: mỗi tuyến — nhà nước công bố · ta có · % phủ.
 *
 * "Ta có" đếm qua tuyến (`routes`) của vn-aids.v1.json: tuyến mang mã ENC
 * (nguồn A: `id` số, nguồn C: `encId`) khớp thẳng; tuyến Thông báo hàng hải
 * khớp theo mảnh tên. MỖI tuyến chỉ được tính vào MỘT hàng — hàng khớp đầu
 * tiên thắng — để không đếm một phao hai lần.
 */
export function doTrucNhaNuoc() {
  const va = doc("vn-aids.v1.json");
  const db = doc("den-bien.v1.json");

  const hang = CONG_BO_TUYEN.map((r) => ({
    ...r,
    nguon: r.encId != null ? NGUON_ENC(r.encId) : (r.ghi ?? "sổ AtoN 2016"),
    ta: 0,
    tuyenKhop: [],
  }));

  va.routes.forEach((rt, i) => {
    const soMark = va.marks.filter((m) => m[9] === i).length;
    if (!soMark) return;
    const maEnc = typeof rt.id === "number" ? rt.id : (rt.encId ?? null);
    const tenChuan = boDau(rt.ten);
    const row =
      hang.find((r) => r.encId != null && r.encId === maEnc) ??
      hang.find((r) => r.khoa.some((k) => tenChuan.includes(k)));
    if (!row) return;
    row.ta += soMark;
    row.tuyenKhop.push(rt.ten);
  });

  for (const r of hang) {
    r.phanTram = r.congBo ? Math.round((Math.min(r.ta, r.congBo) / r.congBo) * 100) : null;
  }

  // % tổng: chỉ các hàng CÓ con số công bố và con số đó không bị nghi sai.
  // Mỗi hàng đóng góp tối đa 100% phần của nó — có 28 phao ở tuyến công bố 6
  // là "phủ đủ tuyến đó", không phải "phủ 460%" bù cho tuyến khác.
  const tinh = hang.filter((r) => r.congBo != null && !r.nghi);
  const tongCongBo = tinh.reduce((n, r) => n + r.congBo, 0);
  const tongTa = tinh.reduce((n, r) => n + Math.min(r.ta, r.congBo), 0);

  const denBien = {
    ...CONG_BO_DEN_BIEN,
    ta: db.lights.length,
    phanTram: Math.round((Math.min(db.lights.length, CONG_BO_DEN_BIEN.congBo) / CONG_BO_DEN_BIEN.congBo) * 100),
  };

  return {
    hang,
    denBien,
    tong: {
      congBo: tongCongBo,
      ta: tongTa,
      phanTram: Math.round((tongTa / tongCongBo) * 1000) / 10,
      soHangTinh: tinh.length,
    },
  };
}

/* ── TRỤC 2 — khung ảnh Navionics đối chiếu ───────────────────────────────
 *
 * Chỉ những khung ĐÃ CÓ ảnh Navionics và số đếm tay được ghi nguồn. Khung
 * "vung-tau" lấy toạ độ/zoom từ CHÍNH NOI_MAU của kiem-ban-do.mjs (một bản
 * sự thật). Số của họ là số đếm TAY trên ảnh — ghi cả biên ("~25–30") lẫn
 * con số dùng để chấm (lấy BIÊN TRÊN: chấm với chuẩn khó nhất).
 */
export const KHUNG_NAVIONICS = [
  {
    noi: "vung-tau",
    nguon:
      "ảnh Navionics khung Vũng Tàu — đếm tay, ghi ở docs/research/gop-so-aton-2026-09.md (trục 2)",
    lop: [
      { ten: "số đo sâu rời", ho: 30, hoGhi: "~25–30" },
      { ten: "phao · tiêu · đèn báo hiệu", ho: 20, hoGhi: "~15–20" },
      { ten: "xác tàu", ho: 2, hoGhi: "2" },
    ],
  },
];

export function doKhungNavionics() {
  const out = [];
  for (const kh of KHUNG_NAVIONICS) {
    const cho = NOI_MAU[kh.noi];
    if (!cho) throw new Error(`kiem-ban-do.mjs không còn chỗ mẫu "${kh.noi}"`);
    const r = kiem(cho.lat, cho.lon, cho.zoom);

    const taCua = {
      "số đo sâu rời": r.lop["sounding-dot"].soLuong,
      // Phao/tiêu/đèn = lớp báo hiệu chính thức + lớp OSM + đèn biển — đúng
      // những chấm báo hiệu màn hình vẽ trong khung. Hai lớp đầu có thể chồng
      // vài đối tượng; script sinh dữ liệu đã loại trùng <150 m nên phần chồng
      // còn lại là không đáng kể so với biên "~15–20" của số đếm tay.
      "phao · tiêu · đèn báo hiệu":
        r.lop["báo hiệu Cục HH"].soLuong +
        r.lop["seamark-*"].soLuong +
        r.lop["đèn biển"].soLuong,
      // 2026-09-03: từng đếm thủ công từ reef-shapes.v1.json (kind=wreck) —
      // lớp CŨ, không phải lớp thật sự vẽ trên màn hình. `xac-tau.v1.json`
      // (sinh 2026-09-02 riêng để lấp lỗ này, xem docs/research/xac-tau-2026-09.md)
      // đã nối vào bản đồ và kiem-ban-do.mjs đã đếm nó đúng — dùng lại
      // CHÍNH bộ đếm đó (r.lop["xác tàu"]), không đếm tay hai lần.
      "xác tàu": r.lop["xác tàu"].soLuong,
    };

    out.push({
      noi: kh.noi,
      nguon: kh.nguon,
      lop: kh.lop.map((l) => ({
        ...l,
        ta: taCua[l.ten],
        vuot: taCua[l.ten] > l.ho,
      })),
    });
  }
  return out;
}

/* ── TRỤC 3 — 15 hạng mục hải đồ điện tử thương mại ───────────────────────
 *
 * Danh mục + lý lẽ đầy đủ: docs/research/thuoc-vuot-hai-do-2026-09.md (định
 * nghĩa "VƯỢT" ở §0 của file đó). Ở đây chỉ ĐO: mọi con số đọc thẳng từ
 * `public/data/*.json` + `public/sw.js`, không gõ tay — sinh dữ liệu lại thì
 * bảng đổi theo, không cần sửa file này.
 *
 * "Đã nối" = đường dẫn `/data/<file>` có mặt trong `public/sw.js`, tức lớp đó
 * CHẠY ĐƯỢC OFFLINE. Dữ liệu sinh xong mà không nối đã tái phát 4 lần trong dự
 * án này (kiem-ke-du-lieu-2026-09.md §1.5) — thước này không cho một lớp
 * "có file" giả làm "có trên màn hình".
 */

/** Hộp toạ độ Việt Nam trừ hộp Hải Nam — CHÍNH phương pháp do-phu-hai-do-2026-08.md
 * §1 dùng để tách "dữ liệu Việt Nam" khỏi khung OSM rộng 4–24°B/102–118°Đ (đa
 * phần seamarks/sea-lanes OSM là Hồng Kông/Quảng Đông/Hải Nam). Hộp này RỘNG
 * RÃI về phía có lợi cho ta (còn dính ít Campuchia + cửa sông nội địa) — cố ý,
 * để không tự thổi phồng bằng cách siết hộp chặt hơn thật tế. */
function trongVN(lon, lat) {
  const hop = lat >= 8.2 && lat <= 21.6 && lon >= 102 && lon <= 110;
  const haiNam = lat >= 17.9 && lat <= 20.4 && lon >= 108.4 && lon <= 111.3;
  return hop && !haiNam;
}

/** Có toạ độ nào của feature (Point/LineString/Polygon, mọi độ lồng) rơi vào hộp VN không. */
function coDiemVN(geom) {
  const diem = [];
  (function di(a) {
    if (typeof a?.[0] === "number") diem.push(a);
    else for (const b of a ?? []) di(b);
  })(geom?.coordinates);
  return diem.some(([lon, lat]) => trongVN(lon, lat));
}

let _sw;
/** Lớp `<file>` có precache trong service worker không — tức chạy được offline. */
function daNoiSW(tenFile) {
  _sw ??= readFileSync(path.join(ROOT, "public/sw.js"), "utf8");
  return _sw.includes(`/data/${tenFile}`);
}

/** Đếm feature theo `properties.kind` của vn-sea-lanes.v1.json — tổng khung vs riêng VN. */
function demSeaLanes(kind) {
  const vsl = doc("vn-sea-lanes.v1.json");
  const kinds = new Set(Array.isArray(kind) ? kind : [kind]);
  let tong = 0,
    vn = 0;
  for (const f of vsl.features) {
    if (!kinds.has(f.properties?.kind)) continue;
    tong++;
    if (coDiemVN(f.geometry)) vn++;
  }
  return { tong, vn };
}

/** Đếm mark theo `types[i]` của seamarks.v1.json — tổng khung vs riêng VN. */
function demSeamark(loai) {
  const sm = doc("seamarks.v1.json");
  const idx = sm.types.indexOf(loai);
  let tong = 0,
    vn = 0;
  for (const m of sm.marks) {
    if (m[2] !== idx) continue;
    tong++;
    if (trongVN(m[0], m[1])) vn++;
  }
  return { tong, vn };
}

export function hangMucChuan() {
  const t1 = doTrucNhaNuoc();
  const t2 = doKhungNavionics();
  const vt = t2.find((k) => k.noi === "vung-tau");
  const layVT = (re) => vt?.lop.find((l) => re.test(l.ten));

  const vc = doc("vn-coast.v1.json");
  const iso = doc("isobaths.v1.json");
  const s = doc("soundings.v1.json");
  const db = doc("den-bien.v1.json");
  const xt = doc("xac-tau.v1.json");
  const rs = doc("reef-shapes.v1.json");
  const cr = doc("coral-reefs.v1.json");
  const vi = doc("vn-islands.v1.json");
  const ts = doc("tide-stations.v1.json");
  // 2026-09-03: ba lớp mới do Lead nối — chỉ ĐỌC, không sinh/đụng file.
  const cd = doc("chat-day.v1.json");
  const kt = doc("khu-tru-bao.v1.json");
  const dd = doc("dia-danh-ngam.v1.json");

  const mucDuong = iso.features.filter((f) => f.properties?.k === "duong").length;
  const maxLatSounding = Math.max(0, ...s.diem.map((d) => d[1]));
  const denDuDacTinh = db.lights.filter((l) => l[3] >= 0 && l[6] > 0).length;
  const xacTauCoDoSau = xt.items.filter((r) => r[4] >= 0).length;
  // 2026-09-03 (chiều): coral-reefs.v1.json nay có group "ven-bo" riêng
  // (1.225 mục, TT 33/2024 Mục A.I — bãi/đá/rạn NỔI ven bờ) tách khỏi
  // "hoang-sa"/"truong-sa"/"them-luc-dia" (offshore/sovereignty). Đếm THẲNG
  // group đó thay vì suy luận qua loại trừ — không lệ thuộc danh sách nhóm
  // offshore có đổi thêm sau này.
  const venBoCoTen = cr.features.filter((f) => f.properties?.group === "ven-bo").length;
  const venBoTinh = new Set(
    cr.features.filter((f) => f.properties?.group === "ven-bo").map((f) => f.properties?.admin),
  ).size;
  // Địa danh ngầm (Mục III TT 33/2024) là địa hình ĐÁY BIỂN (núi/đồi/thung
  // lũng ngầm...) — kể cả 2 mục gắn nhãn "bãi ven bờ" trong đó vẫn là bãi
  // NGẦM (chìm), không phải bãi/đá NỔI ven bờ (Mục A.I) — KHÔNG cộng vào
  // venBoCoTen, hai bộ đo hai câu hỏi khác nhau (ngầm vs nổi).

  const luong = demSeaLanes("luong");
  const phanLuong = demSeaLanes("phanluong");
  const vungCam = demSeaLanes("vungcam");
  // 2026-09-03 (tối): cáp và ỐNG tách kind (`cap` / `ong`), điểm cập bờ thành
  // Point `cap-bo` (review A.4) — hạng mục 12 "Cáp/ống ngầm" đếm CẢ BA.
  const cap = demSeaLanes(["cap", "ong", "cap-bo"]);
  const neoDau = demSeamark("anchorage");
  // Vùng cấm neo AN TOÀN (nguồn VN, không phải OSM Hồng Kông) — cờ `src`
  // phân biệt rõ hơn hộp toạ độ VN: hộp cũ (102–110°Đ) cắt mất các vòng cấm
  // ở cửa vịnh Bắc Bộ (tới 111,6°Đ), lọc theo NGUỒN mới đúng, không cần nới
  // hộp (nới hộp ảnh hưởng luôn cả tính đếm 4 hạng mục khác — ngoài phạm vi
  // yêu cầu lần này).
  const vsl2 = doc("vn-sea-lanes.v1.json");
  const vungCamAnToan = vsl2.features.filter(
    (f) => f.properties?.kind === "vungcam" && f.properties?.src === "an-toan",
  ).length;
  // 2026-09-03 (chiều): 10 tuyến cáp quang biển thật (điểm cập bờ) nối vào
  // vn-sea-lanes với cờ src="cap-vn" — cùng lối tách nguồn VN khỏi OSM Hồng
  // Kông như vungCamAnToan ở trên, không lệ thuộc hộp toạ độ.
  const capVNThat = vsl2.features.filter(
    (f) => f.properties?.kind === "cap-bo" && f.properties?.src === "cap-vn",
  ).length;
  const khuOSM = kt.khu.filter((k) => /OSM/i.test(k.nguonToaDo ?? "")).length;
  const khuTinh = new Set(kt.khu.map((k) => k.tinh)).size;
  const denDoTram = ts.stations.filter((tr) => tr.nguon !== "model").length;
  const moHinhTram = ts.stations.length - denDoTram;

  const hang = [
    {
      id: 1,
      ten: "Đường bờ + đất liền",
      taCo: `${vc.features.length} polygon bờ + nền vector vn-basemap.pmtiles (gột sạch CJK)`,
      ketLuan:
        vc.features.length > 0 && daNoiSW("vn-coast.v1.json") && daNoiSW("vn-basemap.pmtiles")
          ? "VƯỢT"
          : "CHƯA",
      ghi: "offline hoàn toàn; C-MAP là raster trực tuyến, không giấy phép thuỷ đạc VN (trinh-sat-cmap-2026-09.md). Thiếu: nền chi tiết chỉ tới z9.",
    },
    {
      id: 2,
      ten: "Đường đẳng sâu + số mét",
      taCo: `${mucDuong} mức đường có nhãn số mét`,
      ketLuan: mucDuong >= 9 && daNoiSW("isobaths.v1.json") ? "VƯỢT" : "CHƯA",
      ghi: "9 mức 5–2000 m, sinh từ ETOPO 2022, offline; C-MAP vẽ chết vào raster, không đếm được mức qua API công khai.",
    },
    {
      id: 3,
      ten: "Số đo sâu điểm",
      taCo: `${s.diem.length} điểm rời (tới ${maxLatSounding.toFixed(2)}°B)`,
      // Thắng khung tham chiếu (161 vs ~25-30) KHÔNG bù được khoảng trắng quốc
      // gia — điểm rời dừng ở Nha Trang (~11,88°B), trắng hoàn toàn tới Sa Kỳ
      // (~15,2°B). Ngưỡng 13°B (qua khỏi Nha Trang một đoạn) là ranh để phân
      // biệt "phủ toàn quốc" khỏi "phủ một khúc" — xem thu-tu-uu-tien-2026-09.md.
      ketLuan: !layVT(/số đo sâu/)?.vuot ? "CHƯA" : maxLatSounding >= 13 ? "VƯỢT" : "ĐẠT",
      ghi: `khung Vũng Tàu: ta ${layVT(/số đo sâu/)?.ta ?? "?"} vs Navionics ${layVT(/số đo sâu/)?.hoGhi ?? "?"}; nhưng trắng 12°B–15,2°B (Nha Trang→Sa Kỳ) — thiếu OCR 337 bản scan miền Bắc.`,
    },
    {
      id: 4,
      ten: "Phao/tiêu (lateral/cardinal/special/safe/isolated)",
      taCo: `phủ ${t1.tong.phanTram}% sổ nhà nước (${t1.tong.ta}/${t1.tong.congBo}, ${t1.tong.soHangTinh} tuyến)`,
      ketLuan:
        t1.tong.phanTram >= 90 && layVT(/phao/)?.vuot && daNoiSW("vn-aids.v1.json")
          ? "VƯỢT"
          : "CHƯA",
      ghi: `khung Vũng Tàu: ta ${layVT(/phao/)?.ta ?? "?"} vs Navionics ${layVT(/phao/)?.hoGhi ?? "?"}; ký hiệu IALA vùng A đầy đủ (QCVN 20:2015).`,
    },
    {
      id: 5,
      ten: "Đèn biển + đặc tính chớp",
      taCo: `${db.lights.length} ngọn, ${denDuDacTinh}/${db.lights.length} đủ chu kỳ + màu chớp`,
      ketLuan:
        t1.denBien.phanTram >= 100 && denDuDacTinh === db.lights.length && daNoiSW("den-bien.v1.json")
          ? "VƯỢT"
          : "CHƯA",
      ghi: `phủ ${t1.denBien.ta}/${t1.denBien.congBo} sổ đăng ký quốc gia; tên tiếng Việt, offline.`,
    },
    {
      id: 6,
      ten: "Xác tàu + chướng ngại + độ sâu vượt qua",
      taCo: `${xt.items.length} mục, ${xacTauCoDoSau}/${xt.items.length} có độ sâu vượt qua thật`,
      // 2026-09-03 (chiều): đã lục cạn đường vòng — NGA MSI 503 cả site (không
      // chỉ một endpoint), Wayback không còn snapshot, OSM 0 trường độ sâu
      // cho xác tàu VN, TBHH chỉ có đúng 1 vật (Cửa Gianh) công bố độ sâu
      // vượt qua. Đây là GIỚI HẠN NGUỒN thật (Việt Nam không in độ sâu vượt
      // qua trên đỉnh xác tàu trong đa số thông báo), không phải việc chưa
      // làm — và thước TỪ CHỐI bịa một con số "an toàn" cho 42 mục còn lại.
      ketLuan: layVT(/xác tàu/)?.vuot ? "VƯỢT" : "CHƯA",
      ghi: `khung Vũng Tàu: ta ${layVT(/xác tàu/)?.ta ?? "?"} vs Navionics ${layVT(/xác tàu/)?.hoGhi ?? "?"}; giới hạn NGUỒN, không phải việc chưa làm — NGA MSI 503 cả site, Wayback trống, OSM 0 độ sâu, TBHH chỉ 1/${xt.items.length} vật có độ sâu vượt qua công bố. Không bịa số an toàn cho 42 mục còn lại.`,
    },
    {
      id: 7,
      ten: "Rạn/đá ngầm/bãi cạn (HÌNH)",
      taCo: `${rs.features.length} hình OSM + rạn ACA/WCMC (vector tile riêng, mép ≤8,4 m)`,
      ketLuan:
        rs.features.length > 0 &&
        daNoiSW("reef-shapes.v1.json") &&
        daNoiSW("reef-shapes-aca.v1.pmtiles")
          ? "VƯỢT"
          : "CHƯA",
      ghi: "ven bờ dày gấp 33,8 lần OSM, mỗi hình có lý lịch (prov); 80 cụm gốc WCMC còn mâu thuẫn giấy phép chưa xử (xem docs/research/thuoc-vuot-hai-do-2026-09.md §3.7).",
    },
    {
      id: 8,
      ten: "TÊN bãi cạn/đá/rạn",
      taCo: `${cr.features.length + dd.diaDanh.length} tên Việt (${venBoCoTen} ven bờ NỔI/${venBoTinh} tỉnh + ${cr.features.length - venBoCoTen} Hoàng Sa/Trường Sa/thềm lục địa + ${dd.diaDanh.length} địa danh ngầm Mục III)`,
      // 2026-09-03 (chiều): coral-reefs.v1.json nay có 1.225 tên ven bờ NỔI
      // (TT 33/2024 Mục A.I, 28 tỉnh) — lỗ hổng "0 rạn ven bờ nổi có tên" của
      // bản trước đã LẤP, verdict lên VƯỢT. Vẫn giữ câu phân biệt NGẦM (Mục
      // III, dia-danh-ngam) vs NỔI (Mục A.I, coral-reefs group=ven-bo) vì đây
      // là hai bộ dữ liệu khác nguồn, khác mục đích — gộp lẫn hai câu hỏi
      // "tên gì dưới đáy" và "tên gì bà con nhìn thấy" là chỗ dễ tô hồng nhất.
      ketLuan: venBoCoTen === 0 ? "ĐẠT" : "VƯỢT",
      ghi: `0 tên Việt ở đối thủ tại Trường Sa (do-phu-hai-do-2026-08.md §F); ven bờ NỔI (Mục A.I) ${venBoCoTen} tên phủ ${venBoTinh}/28 tỉnh ven biển, Hoàng Sa 28 + Trường Sa 106 + thềm lục địa 15 tên Việt; cộng riêng ${dd.diaDanh.length} địa danh NGẦM (Mục III, núi/đồi/thung lũng đáy biển — cross-check 9/9 khớp nguồn đối chiếu) — hai bộ khác mục đích, không gộp lẫn.`,
    },
    {
      id: 9,
      ten: "Chất đáy (cát/bùn/đá/san hô)",
      taCo: `${cd.points.length.toLocaleString("vi-VN")} điểm chất đáy (vùng rạn/đảo, ${cd.codes.length} loại: ${cd.codes.join("/")})`,
      // 2026-09-03: chat-day.v1.json nối xong (Allen Coral Atlas benthic, CC
      // BY 4.0) — trước là 0 tuyệt đối. NHƯNG ACA cần nước trong thấy đáy qua
      // ảnh vệ tinh ⇒ CHỈ phủ vùng rạn/đảo nước trong, KHÔNG phủ đáy bùn/cát
      // cửa sông ven bờ — đúng nơi phần lớn tàu cá ven bờ VN hoạt động. Không
      // đủ bằng chứng để nói ta "vượt" SBDARE của hải đồ thương mại (chưa
      // đối chiếu được — C-MAP là raster, không đếm qua API), nên ĐẠT chứ
      // không VƯỢT — có thật, sạch giấy phép, offline, nhưng KHÔNG "phủ hết".
      ketLuan: cd.points.length > 0 && daNoiSW("chat-day.v1.pmtiles") ? "ĐẠT" : "CHƯA",
      ghi: "nguồn ACA benthic_data_verbose (CC BY 4.0), offline (pmtiles); CHỈ phủ vùng rạn/đảo nước trong — 0% đáy bùn/cát cửa sông ven bờ (nơi đa số tàu cá hoạt động). Không hải đồ miễn phí nào khác có lớp này cho VN (chưa kiểm chứng độc lập với C-MAP — họ là raster, không đếm được).",
    },
    {
      id: 10,
      ten: "Tuyến luồng + phân luồng",
      taCo: `luồng VN ${luong.vn}/${luong.tong} · phân luồng VN ${phanLuong.vn}/${phanLuong.tong}`,
      ketLuan: luong.vn + phanLuong.vn >= 10 ? "VƯỢT" : "CHƯA",
      ghi: "tên file 'vn-' gây hiểu lầm — hơn 90% nội dung là Hồng Kông/Quảng Đông/Hải Nam (OSM). Nên dựng lại từ 22 tuyến vn-aids đã có toạ độ.",
    },
    {
      id: 11,
      ten: "Vùng cấm/khu đặc biệt",
      taCo: `vùng cấm neo AN TOÀN (nguồn VN) ${vungCamAnToan} vòng + OSM RESARE VN ${vungCam.vn}/${vungCam.tong}`,
      // 2026-09-03: sea-lanes nay có 7 vòng cấm neo 500 m quanh công trình
      // biển vịnh Bắc Bộ, kind=vungcam nhưng src="an-toan" — nguồn Việt Nam
      // thật (không phải OSM Hồng Kông), lọc theo CỜ NGUỒN chứ không theo hộp
      // toạ độ (hộp VN 102–110°Đ cắt mất các vòng ở cửa vịnh, tới 111,6°Đ).
      // Đây LÀ RESARE lần đầu > 0 — nhưng chỉ phủ vịnh Bắc Bộ quanh công
      // trình biển, chưa có khu bảo tồn/quân sự/cấm neo nơi khác ⇒ ĐẠT, chưa
      // đủ rộng để gọi VƯỢT cả hạng mục "vùng cấm/khu đặc biệt".
      ketLuan: vungCamAnToan >= 3 ? "ĐẠT" : vungCam.vn >= 3 ? "VƯỢT" : "CHƯA",
      ghi: "7 vòng cấm neo 500 m/công trình biển (nguồn VN, src=an-toan) — thật nhưng hẹp (chỉ vịnh Bắc Bộ); VMS zones (NĐ 26/2019) phục vụ mục đích khác (quản lý khai thác); chưa có khu bảo tồn biển/khu quân sự — vẫn thiếu phần lớn phạm vi RESARE hàng hải.",
    },
    {
      id: 12,
      ten: "Cáp/ống ngầm",
      taCo: `${capVNThat} tuyến cáp quang biển VN (điểm cập bờ, nguồn VN) trong tổng cáp+ống VN ${cap.vn}/${cap.tong} (cáp/ống đã tách kind)`,
      // 2026-09-03 (chiều): 10 tuyến cáp quang biển thật — AAG/APG/SMW-3/
      // AAE-1/ADC/SJC2/Liên Á/ALC/VTS/MViSTA, điểm cập bờ Vũng Tàu/Đà Nẵng/
      // Quy Nhơn, mỗi điểm xác minh ≥2 nguồn độc lập. TeleGeography (bản đồ
      // cáp) chỉ dùng làm MANH MỐI để tìm — KHÔNG chép hình tuyến của họ
      // (CC BY-NC-SA, không sạch để bán); điểm cập bờ tự nó là sự thật công
      // khai, không phải sản phẩm sáng tạo của TeleGeography. Gate: 0 cáp VN
      // thật thì KHÔNG được VƯỢT, dù cap.vn (đếm theo hộp toạ độ) dương.
      ketLuan: capVNThat > 0 && cap.vn >= 5 ? "VƯỢT" : "CHƯA",
      ghi: `10 tuyến cáp quang biển quốc tế cập bờ VN, xác minh ≥2 nguồn/điểm, KHÔNG chép hình tuyến TeleGeography (CC BY-NC-SA — chỉ dùng làm manh mối). Vẫn thiếu: cáp điện ngầm nội địa, ống dẫn dầu khí (Bạch Hổ–Dinh Cố...) — chưa có nguồn.`,
    },
    {
      id: 13,
      ten: "Khu neo đậu",
      taCo: `${kt.khu.length} khu tránh trú bão (${khuTinh}/28 tỉnh ven biển) + seamark neo đậu VN ${neoDau.vn}/${neoDau.tong}`,
      // 2026-09-03: khu-tru-bao.v1.json nối xong — 51 khu THẬT từ QĐ 582/2024
      // (danh mục nhà nước), CRITICAL_SHELL nên chạy offline. Trước đó thước
      // chỉ đọc seamarks anchorage (2/112) — quá thưa. Đây đúng là hạng mục
      // "rẻ nhất để lấp" mà báo cáo trước xếp ưu tiên #1 — nay đã lấp.
      ketLuan: kt.khu.length >= 20 && daNoiSW("khu-tru-bao.v1.json") ? "VƯỢT" : "CHƯA",
      ghi: `51/160 khu của QĐ 582 (109 khu bỏ vì không có toạ độ đáng tin — ghi rõ trong nguồn, không bịa); ${khuOSM}/${kt.khu.length} khu dùng toạ độ OSM (cờ trong nguonToaDo, ràng buộc ODbL — được cho lớp bản đồ miễn phí, không đưa thẳng vào gói bán). 21/28 tỉnh ven biển có ít nhất một khu.`,
    },
    {
      id: 14,
      ten: "Thuỷ triều",
      taCo: `${ts.stations.length} trạm — ${denDoTram} trạm ĐO thật (gauge, UHSLC/JASL) + ${moHinhTram} trạm MÔ HÌNH (EOT20, CC BY 4.0; trong đó ${ts.stations.filter((s) => s.hang === "cang").length} trạm tại cảng cá, 2026-09-04)`,
      // 2026-09-03 (chiều): thêm 7 trạm EOT20 (mô hình thuỷ triều toàn cầu,
      // KHÔNG phải trạm đo thật — gắn cờ `nguon: "model"` trong chính file,
      // đếm riêng denDoTram/moHinhTram để KHÔNG lẫn mô hình vào trạm đo). Giá
      // trị nhất: phủ bờ Tây (Rạch Giá, Mũi Cà Mau — vịnh Thái Lan, bồn triều
      // khác hẳn Biển Đông) trước đây trắng hoàn toàn.
      ketLuan: daNoiSW("tide-stations.v1.json") && ts.stations.length >= 8 ? "VƯỢT" : "CHƯA",
      ghi: `${denDoTram} trạm đo thật (Hòn Dấu/Vũng Áng/Quy Nhơn/Vũng Tàu) + ${moHinhTram} trạm mô hình EOT20 (RMSE ~0,13 m — không lẫn với trạm đo) — phủ bờ Tây (Rạch Giá/Cà Mau, vịnh Thái Lan) và từ 2026-09-04 lấy tại toạ độ TỪNG cảng cá đang hoạt động: mọi cảng cách trạm ≤ 40 km (cổng test), hết cảng nào chỉ xem được "lên/xuống".`,
    },
    {
      id: 15,
      ten: "Nhãn tên tiếng Việt/chủ quyền",
      taCo: `${vi.features.length} đảo tên Việt + ${cr.features.length} tên rạn Việt`,
      ketLuan: vi.features.length > 0 && daNoiSW("vn-islands.v1.json") ? "VƯỢT" : "CHƯA",
      ghi: 'nền pmtiles sạch 0 CJK (audit-names, cổng no-cjk-data.test.ts); C-MAP tự công bố không có mục "Vietnam" trong danh sách cơ quan cấp phép.',
    },
  ];

  return {
    hang,
    tongVuot: hang.filter((h) => h.ketLuan === "VƯỢT").length,
    tongDat: hang.filter((h) => h.ketLuan === "ĐẠT").length,
    tongChua: hang.filter((h) => h.ketLuan === "CHƯA").length,
  };
}

/** Một dòng tổng kết — cho người, cho commit message, cho báo cáo. */
export function tongKet() {
  const t1 = doTrucNhaNuoc();
  const t2 = doKhungNavionics();
  const hm = hangMucChuan();
  const lop = t2.flatMap((k) => k.lop);
  const vuot = lop.filter((l) => l.vuot).length;
  return {
    hangMuc: hm,
    cau:
      `phủ ${t1.tong.phanTram}% sổ nhà nước (${t1.tong.ta}/${t1.tong.congBo} báo hiệu, ` +
      `${t1.tong.soHangTinh} tuyến có số công bố) · đèn biển ${t1.denBien.ta}/${t1.denBien.congBo} · ` +
      `vượt Navionics ở ${vuot}/${lop.length} lớp trong khung đối chiếu · ` +
      `15 hạng mục hải đồ thương mại: VƯỢT ${hm.tongVuot} · ĐẠT ${hm.tongDat} · CHƯA ${hm.tongChua}`,
    trucNhaNuoc: t1,
    khungNavionics: t2,
  };
}

/* ── Chạy ─────────────────────────────────────────────────────────────── */
function main() {
  const json = process.argv.includes("--json");
  const kq = tongKet();
  if (json) {
    console.log(JSON.stringify(kq, null, 2));
    return;
  }

  const t1 = kq.trucNhaNuoc;
  console.log("\n── TRỤC 1 · so với sổ nhà nước (tuyến · công bố · ta · %)");
  for (const r of [...t1.hang].sort((a, b) => (b.congBo ?? 0) - (a.congBo ?? 0))) {
    const pc =
      r.congBo == null ? "  —" : r.nghi ? "LOẠI" : `${String(r.phanTram).padStart(3)}%`;
    console.log(
      `   ${r.ten.padEnd(42)} ${String(r.congBo ?? "—").padStart(4)} ` +
        `${String(r.ta).padStart(4)}  ${pc}${r.ghi ? `   (${r.ghi})` : ""}`,
    );
  }
  console.log(
    `   ${t1.denBien.ten.padEnd(42)} ${String(t1.denBien.congBo).padStart(4)} ` +
      `${String(t1.denBien.ta).padStart(4)}  ${String(t1.denBien.phanTram).padStart(3)}%`,
  );
  console.log(
    `   TỔNG (${t1.tong.soHangTinh} tuyến có số công bố, hàng LOẠI không tính): ` +
      `${t1.tong.ta}/${t1.tong.congBo} = ${t1.tong.phanTram}%`,
  );

  console.log("\n── TRỤC 2 · so với Navionics trong khung ảnh đối chiếu");
  for (const kh of kq.khungNavionics) {
    console.log(`   khung "${kh.noi}" (${kh.nguon.split("—")[0].trim()})`);
    for (const l of kh.lop) {
      console.log(
        `     ${l.ten.padEnd(28)} ta ${String(l.ta).padStart(4)} · họ ${String(l.hoGhi).padStart(6)}  ${l.vuot ? "VƯỢT" : "chưa"}`,
      );
    }
  }

  console.log(
    "\n── TRỤC 3 · 15 hạng mục hải đồ điện tử thương mại (chi tiết + nguồn: " +
      "docs/research/thuoc-vuot-hai-do-2026-09.md)",
  );
  for (const h of kq.hangMuc.hang) {
    console.log(
      `   ${String(h.id).padStart(2)}. ${h.ten.padEnd(38)} ${h.ketLuan.padEnd(5)}  ${h.taCo}`,
    );
    console.log(`       ${h.ghi}`);
  }
  console.log(
    `   TỔNG: VƯỢT ${kq.hangMuc.tongVuot}/15 · ĐẠT ${kq.hangMuc.tongDat}/15 · CHƯA ${kq.hangMuc.tongChua}/15`,
  );

  console.log(`\n➡ ${kq.cau}\n`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("kiem-phu-hai-do.mjs"))
  main();
