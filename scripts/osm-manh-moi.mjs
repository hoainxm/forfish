// OSM LÀM MANH MỐI — ĐI TÌM, XÁC MINH ĐỘC LẬP, THÀNH DỮ LIỆU CỦA MÌNH.
//
//   node scripts/osm-manh-moi.mjs               # quét + xác minh + ghi kho
//   node scripts/osm-manh-moi.mjs --overpass    # kéo thêm manh mối OSM tươi
//   node scripts/osm-manh-moi.mjs --json        # phễu cho máy đọc
//
// Đầu ra: <tmp>/sdfish-osm-manh-moi/xac-minh.json — KHO NGOÀI REPO (đúng luật
// "cấm file dữ liệu tạm trong cây làm việc"), cùng khuôn với kho sổ AtoN.
// `scripts/generate-vn-aids.mjs` đọc kho này ở NGUỒN E rồi mới sinh
// `public/data/vn-aids.v1.json` — file phát hành chỉ ĐÈ qua đường sinh.
//
// ── VÌ SAO CÓ FILE NÀY (2026-09-02) ───────────────────────────────────────
// Chủ dự án chốt quy trình cho nguồn mang điều khoản tập hợp (ODbL của OSM) —
// docs/formaps/phuong-an-tu-chu-du-lieu.md §1-#3:
//
//   OSM chỉ được dùng làm MANH MỐI ĐI TÌM ("quanh toạ độ này CÓ THỂ có một
//   báo hiệu loại X"). Muốn vào lớp phát hành thì phải XÁC MINH bằng ít nhất
//   một nguồn độc lập không-ODbL, và lý lịch ghi theo NGUỒN XÁC MINH — toạ
//   độ, tên, đặc tính đều lấy của nguồn xác minh, KHÔNG chép gì của OSM.
//   Chuỗi dẫn xuất đứt: dữ liệu là của mình. OSM chỉ còn lại đúng một dòng
//   `crossChecks: [{source:"osm", agreed:true}]` — ghi nhận "OSM cũng thấy",
//   không phải "lấy từ OSM".
//
// Các đường xác minh (mỗi ứng viên cần ÍT NHẤT một):
//   a. Kho Thông báo hàng hải trên đĩa (bản chữ đã bóc, 2 kho ngoài repo) —
//      tin LẬP/ĐỔI/NÊU/NGƯNG nhắc một báo hiệu trong bán kính dò
//      (±500 m với phao — phao trôi quanh neo; ±150 m với tiêu/đèn cố định).
//   b. Sổ AtoN 2016 (bản bóc ngoài repo) — mục sổ trong cùng bán kính.
//   c. Bảng tuyến cổng ENC = nguồn A của vn-aids: mọi hàng của nó ĐÃ ở trong
//      lớp, nên manh mối trùng nó (<150 m) bị loại từ vòng gửi xe ("đã có").
//      Đường c vì thế chỉ XÁC NHẬN thứ đã phát, không đẻ thêm mục mới.
//   d. Sentinel-2 (ảnh mở) — CHỈ cho công trình cố định; quy trình 5 bước ở
//      docs/research/phuong-phap-nha-san-xuat-2026-09.md §3.2. Phao KHÔNG
//      xác minh được bằng vệ tinh (dưới pixel, trôi quanh neo). Bước này làm
//      RIÊNG bằng mắt người trên ô ảnh cắt sẵn — script chỉ chấm a/b.
//
// MẬP MỜ ĐƯỢC PHÂN XỬ, KHÔNG PHẢI NỚI CỔNG: bộ đọc Thông báo hàng hải mù
// (generate-vn-aids nguồn B) phải VỨT hàng toạ độ có ≥2 cách đọc vì chữ số bị
// chẻ — nó không có giả thuyết nào để chọn. Ở đây MỖI manh mối là một giả
// thuyết: nếu ĐÚNG MỘT cách đọc rơi vào bán kính dò của manh mối thì cách đọc
// đó được chọn (≥2 cách cùng rơi vào ⇒ vẫn mập mờ ⇒ vẫn vứt). Hàng được cứu
// mang cờ `daPhanXu` để người soát biết nó đi đường nào.
//
// ⚠️ LỖI THỜI NGƯỢC: OSM còn vẽ một phao mà tin MỚI NHẤT của nhà nước là "GỠ"
// ⇒ manh mối lỗi thời, KHÔNG vào lớp, và ĐẾM RIÊNG — đây chính là bằng chứng
// vì sao không được chép OSM thẳng.
//
// ## Assumptions
// - Manh mối loại `light_major` bỏ qua: đèn biển thuộc lớp den-bien.v1.json
//   (nhóm khác giữ), không thuộc lớp này.
// - Lọc manh mối theo DẢI BỜ VN thô (đa giác chữ nhật theo vĩ độ) chỉ để phễu
//   đếm cho sạch — cổng thật là bước xác minh: một điểm bên bờ Campuchia
//   không bao giờ tìm được Thông báo hàng hải VN trong 500 m.
// - Hai manh mối cùng trỏ một bằng chứng ⇒ MỘT mục (giữ manh mối gần nhất):
//   ngoài thực địa chỉ có một vật.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  kmGiua,
  docThongBao,
  tenBaoHieu,
} from "./lib/tbhh-doc.mjs";

const argOf = (ten, mac) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
};
const JSON_RA = process.argv.includes("--json");
const DUNG_OVERPASS = process.argv.includes("--overpass");

const KHO_OCR = argOf("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));
const KHO_CHU = argOf("kho-chu", join(tmpdir(), "sdfish-tbhh-text"));
const KHO_TBHH = argOf("kho-tbhh", join(tmpdir(), "sdfish-soundings-cache"));
const KHO_ATON = argOf("kho-aton", join(tmpdir(), "sdfish-aton-2016", "aton-aids.json"));
const KHO_RA = argOf("ra", join(tmpdir(), "sdfish-osm-manh-moi", "xac-minh.json"));

const HOM_NAY = new Date().toISOString().slice(0, 10);
const NAM_NAY = Number(HOM_NAY.slice(0, 4));

/** Bán kính dò quanh manh mối (km) — phao trôi quanh neo, tiêu đóng chết. */
const DO_PHAO_KM = 0.5;
const DO_TIEU_KM = 0.15;
/** Dưới ngưỡng này so với lớp đang phát = "đã có", không phải manh mối mới. */
const DA_CO_KM = 0.15;
/** Tuổi tin xác minh — CÙNG luật với nguồn B của generate-vn-aids.mjs. */
const TUOI_TOI_DA = 10;
const TUOI_CHUYEN_DUNG = 3;

/** Loại OSM là BÁO HIỆU (không tính cảng, khu neo, lồng bè, cột mốc…). */
const LOAI_PHAO = new Set([
  "buoy_lateral", "buoy_cardinal", "buoy_safe_water",
  "buoy_isolated_danger", "buoy_special_purpose", "light_float",
]);
const LOAI_TIEU = new Set([
  "beacon", "beacon_lateral", "beacon_cardinal",
  "beacon_special_purpose", "beacon_isolated_danger", "light_minor",
]);

/**
 * Dải bờ VN thô — chữ nhật theo vĩ độ, chỉ để PHỄU đếm cho sạch (loại cụm
 * Hồng Kông – Châu Giang và đất liền Campuchia/Thái chiếm quá nửa file OSM).
 * Cố ý RỘNG: giữ cả Phú Quốc, Côn Đảo, Bạch Long Vĩ. Cổng thật là xác minh.
 */
function trongDaiBoVN(lon, lat) {
  if (lat < 7 || lat > 23.5) return false;
  if (lat >= 21.5) return lon >= 106.5 && lon <= 108.2;
  if (lat >= 20) return lon >= 105.5 && lon <= 108.3;
  if (lat >= 17) return lon >= 105 && lon <= 108.7;
  if (lat >= 12) return lon >= 107.5 && lon <= 110.1;
  if (lat >= 11) return lon >= 106.5 && lon <= 109.6;
  if (lat >= 8) return lon >= 103.3 && lon <= 108.6;
  return lon >= 103 && lon <= 107;
}

/* ── 1. MANH MỐI ──────────────────────────────────────────────────────────*/

function docManhMoiSnapshot() {
  const sm = JSON.parse(readFileSync("public/data/seamarks.v1.json", "utf8"));
  return sm.marks.map((m) => ({ lon: m[0], lat: m[1], loai: sm.types[m[2]] }));
}

/**
 * Overpass tươi — CHỈ để tìm thêm manh mối, tuyệt đối không chép thuộc tính.
 *
 * Hai câu hỏi, vì OSM vẽ báo hiệu theo HAI trường phái: dân OpenSeaMap gắn
 * `seamark:type`, dân vẽ bản đồ thường chỉ gắn `man_made=lighthouse|beacon`
 * (đo 2026-09-02: dải bờ VN có 125 điểm man_made KHÔNG mang seamark:type —
 * file seamarks.v1.json không hề thấy chúng). Điểm man_made là CÔNG TRÌNH
 * CỐ ĐỊNH → nhận vai tiêu/đèn; nếu thực chất là đèn biển lớn thì nó sẽ nằm
 * cạnh lớp den-bien (<150 m) và bị lọc "đã có" ngay vòng sau.
 */
/** Cùng danh sách gương với generate-seamarks.mjs — máy chủ chính hay 504. */
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

async function hoiOverpass(q) {
  let loi;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Overpass trả 406 cho client không khai User-Agent — khai danh chính chủ.
          "User-Agent": "SDFish-build/1.0 (nautical aids cross-check)",
        },
        body: "data=" + encodeURIComponent(`[out:json][timeout:90];${q};out center;`),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return (await res.json()).elements ?? [];
    } catch (e) {
      loi = e;
    }
  }
  throw loi;
}

async function docManhMoiOverpass() {
  const seamark = await hoiOverpass(
    'node["seamark:type"~"^(buoy_|beacon|light_)"](7,102,23.5,110.5)',
  );
  const manMade = await hoiOverpass(
    '(node["man_made"~"^(lighthouse|beacon)$"](7,102.5,23.5,110);' +
      'way["man_made"~"^(lighthouse|beacon)$"](7,102.5,23.5,110);)',
  );
  const diem = [];
  for (const e of seamark) {
    if (e.type !== "node") continue;
    diem.push({ lon: e.lon, lat: e.lat, loai: e.tags?.["seamark:type"] ?? "?" });
  }
  for (const e of manMade) {
    const lon = e.lon ?? e.center?.lon;
    const lat = e.lat ?? e.center?.lat;
    if (lon == null || lat == null) continue;
    // seamark:type (nếu có) nói rõ hơn man_made — ưu tiên nó
    const st = e.tags?.["seamark:type"];
    const loai = st ?? (e.tags?.man_made === "beacon" ? "beacon" : "light_minor");
    diem.push({ lon, lat, loai });
  }
  return diem;
}

/* ── 2. LỚP ĐANG PHÁT (để biết manh mối nào là "đã có") ──────────────────*/

function docLopDangPhat() {
  const va = JSON.parse(readFileSync("public/data/vn-aids.v1.json", "utf8"));
  const db = JSON.parse(readFileSync("public/data/den-bien.v1.json", "utf8"));
  /* LOẠI các mục tuyến `xm-*` (chính nguồn E) khỏi tập "đã phát": chúng SINH
     RA TỪ quy trình này, giữ chúng lại là tự nhìn thấy vết chân mình — chạy
     lại script sau một lần generate sẽ tưởng mọi mục xác minh "đã có", ghi
     kho RỖNG, và lần generate kế tiếp âm thầm rút chúng khỏi bản đồ (bắt
     được đúng vết này 2026-09-02: vào kho 1 → 0 giữa hai lần chạy liên tiếp). */
  const cuaXm = new Set(
    va.routes.map((r, i) => [r, i]).filter(([r]) => String(r.id).startsWith("xm-")).map(([, i]) => i),
  );
  const marksGoc = va.marks.filter((m) => !cuaXm.has(m[9]));
  return {
    va: { ...va, marks: marksGoc },
    diem: [
      ...marksGoc.map((m) => [m[0], m[1]]),
      ...db.lights.map((l) => [l[0], l[1]]),
    ],
  };
}

/* ── 3. BẰNG CHỨNG ───────────────────────────────────────────────────────*/

/**
 * Đường a — kho Thông báo hàng hải. Trả về danh sách HÀNG bằng chứng:
 * { lon, lat, ten, tb, daPhanXu } — hàng mập mờ chưa gắn toạ độ (hop nhiều
 * cách đọc) để nguyên, phân xử lúc so với từng manh mối.
 */
function bangChungTbhh(log) {
  const tbList = docThongBao(log, { khoOcr: KHO_OCR, khoChu: KHO_CHU, khoTbhh: KHO_TBHH }, {
    giuMapMo: true,
    giuKhongRoViec: true,
  });
  const hangRo = [];
  const hangMapMo = [];
  for (const tb of tbList) {
    for (const a of tb.aids) hangRo.push({ lon: a.lon, lat: a.lat, ten: a.ten, tb });
    for (const mm of tb.mapMo ?? []) hangMapMo.push({ dong: mm.dong, hop: mm.hop, tb });
  }
  return { tbList, hangRo, hangMapMo };
}

/** Đường b — sổ AtoN 2016 (mục KHÔNG phải đèn biển). */
function bangChungSach() {
  if (!existsSync(KHO_ATON)) return null;
  try {
    return JSON.parse(readFileSync(KHO_ATON, "utf8")).filter(
      (o) => o.loai !== "light_major" && !/^Đèn biển/i.test(o.tuyen ?? ""),
    );
  } catch {
    return null;
  }
}

/* ── 4. XÁC MINH TỪNG MANH MỐI ───────────────────────────────────────────*/

const chuyenDung = (s) => /chuy[êe]n d[ùu]ng/i.test(String(s));

/**
 * DẠNG VẬT đọc từ tên bằng chứng — để bắt cặp manh-mối↔bằng-chứng cho khớp:
 * một manh mối PHAO mà bằng chứng gần nhất là một ĐĂNG TIÊU thì đó là hai vật
 * khác nhau đứng gần nhau, không phải một lần xác minh. Tên không nói rõ thì
 * không chặn (nhiều hàng Thông báo hàng hải mất cột tên).
 */
function dangBangChung(ten) {
  const t = String(ten ?? "").trim();
  if (/^(Phao|Buoy)/i.test(t)) return "phao";
  if (/^(Ti[êe]u|Đăng ti[êe]u|Beacon|Front|Rear|Fornt|Ch[ậa]p|ĐT|Đ[èe]n|Signpost)/i.test(t)) return "tieu";
  return null;
}
const dangKhop = (loaiOsm, tenBc) => {
  const bc = dangBangChung(tenBc);
  if (!bc) return true;
  return LOAI_PHAO.has(loaiOsm) ? bc === "phao" : bc === "tieu";
};

/**
 * Tin mới nhất trong các tin khớp quyết định số phận (đúng luật "báo hiệu là
 * sự kiện" của nguồn B): GỠ ⇒ manh mối lỗi thời; quá cũ ⇒ không đủ tươi;
 * LẬP/ĐỔI/NÊU/NGƯNG còn tuổi ⇒ XÁC MINH ĐƯỢC.
 */
function phanXuTbhh(khop) {
  khop.sort((x, y) => (x.tb.nam ?? 0) - (y.tb.nam ?? 0) || (x.tb.thang ?? 0) - (y.tb.thang ?? 0));
  const moi = khop[khop.length - 1];
  const tb = moi.tb;
  if (tb.viec === "GỠ") return { ket: "go", moi };
  if (!tb.viec) return { ket: "khong-ro-viec", moi };
  const tuoi = tb.nam ? NAM_NAY - tb.nam : 99;
  const tran = chuyenDung(`${tb.tenChung} ${tb.tacDung}`) ? TUOI_CHUYEN_DUNG : TUOI_TOI_DA;
  if (tuoi > tran) return { ket: "qua-cu", moi };
  return { ket: "xac-minh", moi };
}

async function main() {
  const log = {
    // các quầy đếm docThongBao cần
    tbhhKhoVang: "", tbhhKhoHong: 0, tbhhKhongRoViec: 0, tbhhDongLoan: 0,
    tbhhXaCum: 0, tbhhKhongPhaiBaoHieu: 0, tbhhKhongCoBang: 0, tbhhMapMo: 0,
    tbhhTheoDuong: {},
  };

  // 1. manh mối
  const goc = docManhMoiSnapshot();
  let tuoi = [];
  let overpassLoi = "";
  if (DUNG_OVERPASS) {
    try {
      tuoi = await docManhMoiOverpass();
    } catch (e) {
      overpassLoi = e.message; // mất mạng thì chạy tiếp với snapshot — không treo
    }
  }
  // gộp: điểm tươi cách mọi điểm snapshot ≥50 m mới là manh mối MỚI
  const themTuoi = tuoi.filter(
    (t) => !goc.some((g) => kmGiua(g.lon, g.lat, t.lon, t.lat) < 0.05),
  );
  const tatCa = [...goc, ...themTuoi];

  const laPhao = (l) => LOAI_PHAO.has(l);
  const laTieu = (l) => LOAI_TIEU.has(l);
  const trongDai = tatCa.filter((p) => trongDaiBoVN(p.lon, p.lat));
  const denBienLon = trongDai.filter((p) => p.loai === "light_major").length;
  const loaiBaoHieu = trongDai.filter((p) => laPhao(p.loai) || laTieu(p.loai));

  // 2. trừ "đã có"
  const { va, diem } = docLopDangPhat();
  const daCo = [];
  const manhMoi = [];
  for (const p of loaiBaoHieu) {
    const gan = diem.some(([lo, la]) => kmGiua(lo, la, p.lon, p.lat) < DA_CO_KM);
    (gan ? daCo : manhMoi).push(p);
  }

  // 3. bằng chứng
  const { hangRo, hangMapMo } = bangChungTbhh(log);
  const sach = bangChungSach();

  // 4. xác minh
  const phanXu = { xacMinhA: 0, xacMinhB: 0, cuuMapMo: 0, loiThoi: 0, quaCu: 0,
    khongRoViec: 0, khongBangChung: 0, capA: 0, capB: 0, trungLopSauXacMinh: 0 };
  const records = [];
  const chuaXacMinh = [];
  const dungBang = new Set(); // một hàng bằng chứng chỉ đỡ được MỘT manh mối

  for (const p of manhMoi) {
    const doKm = laPhao(p.loai) ? DO_PHAO_KM : DO_TIEU_KM;

    // đường a — hàng rõ
    const khopA = hangRo
      .map((h, i) => ({ ...h, i, d: kmGiua(h.lon, h.lat, p.lon, p.lat) }))
      .filter((h) => h.d <= doKm && !dungBang.has(`a:${h.i}`) && dangKhop(p.loai, h.ten));
    // đường a — hàng mập mờ, phân xử bằng chính manh mối
    let cuu = null;
    for (let i = 0; i < hangMapMo.length; i++) {
      if (dungBang.has(`m:${i}`)) continue;
      const mm = hangMapMo[i];
      const trong = mm.hop.filter((h) => kmGiua(h.lon, h.lat, p.lon, p.lat) <= doKm);
      if (trong.length !== 1) continue; // 0 = không dính; ≥2 = vẫn mập mờ, vẫn vứt
      const h = trong[0];
      cuu = { i, lon: h.lon, lat: h.lat, ten: tenBaoHieu(mm.dong, h.at), tb: mm.tb,
        d: kmGiua(h.lon, h.lat, p.lon, p.lat), daPhanXu: true };
      break;
    }
    if (cuu) khopA.push(cuu);

    // đường b
    const khopB = (sach ?? [])
      .map((o, i) => ({ o, i, d: kmGiua(o.lon, o.lat, p.lon, p.lat) }))
      .filter((x) => x.d <= doKm && !dungBang.has(`b:${x.i}`) && dangKhop(p.loai, x.o.ten));

    if (khopA.length) phanXu.capA++;
    if (khopB.length) phanXu.capB++;

    if (khopA.length) {
      const { ket, moi } = phanXuTbhh(khopA);
      if (ket === "go") { phanXu.loiThoi++; continue; }        // OSM lỗi thời — KHÔNG vào
      if (ket === "qua-cu") { phanXu.quaCu++; chuaXacMinh.push({ ...p, lyDo: "tin khớp quá cũ" }); continue; }
      if (ket === "khong-ro-viec") {
        phanXu.khongRoViec++;
        chuaXacMinh.push({ ...p, lyDo: "tin khớp không rõ LẬP hay GỠ" });
        continue;
      }
      const tb = moi.tb;
      // Toạ độ xác minh nằm cạnh một báo hiệu ĐÃ PHÁT (<150 m) ⇒ hai nguồn
      // đồng ý về một vật đã có trên bản đồ — không có gì mới để thêm.
      if (va.marks.some((m) => kmGiua(m[0], m[1], moi.lon, moi.lat) < DA_CO_KM)) {
        phanXu.trungLopSauXacMinh++;
        continue;
      }
      dungBang.add(moi.daPhanXu ? `m:${moi.i}` : `a:${moi.i}`);
      if (moi.daPhanXu) phanXu.cuuMapMo++;
      phanXu.xacMinhA++;
      const so = tb.so && tb.coQuan ? `${tb.so}/TBHH-${tb.coQuan}` : (tb.so || tb.coQuan || "");
      records.push({
        lon: moi.lon, lat: moi.lat,                       // toạ độ NGUỒN XÁC MINH
        ten: moi.ten || null,                             // tên từ nguồn xác minh
        duong: "tbhh",
        tuyen: tb.luong || tb.vung || "Thông báo hàng hải",
        encId: null,
        tinhTrang: tb.viec,
        tacDung: tb.tacDung || null,
        den: tb.den ?? null,
        dacTinhAS: null,
        loaiSach: null,
        tenGocSach: null,
        loaiOsm: p.loai,
        lechM: Math.round(moi.d * 1000),
        daPhanXu: Boolean(moi.daPhanXu),
        nguon: {
          source: "tbhh",
          at: HOM_NAY,
          ...(so ? { version: so } : {}),
          ...(tb.url ? { url: tb.url } : {}),
        },
      });
      continue;
    }

    if (khopB.length) {
      khopB.sort((x, y) => x.d - y.d);
      const { o, i, d } = khopB[0];
      if (va.marks.some((m) => kmGiua(m[0], m[1], o.lon, o.lat) < DA_CO_KM)) {
        phanXu.trungLopSauXacMinh++;
        continue;
      }
      dungBang.add(`b:${i}`);
      phanXu.xacMinhB++;
      records.push({
        lon: o.lon, lat: o.lat,
        ten: null,                                        // generate dịch từ tenGocSach
        duong: "aton",
        tuyen: o.tuyen || "(chưa rõ tuyến)",
        encId: o.encId ?? null,
        tinhTrang: null,
        tacDung: null,
        den: null,
        dacTinhAS: o.dacTinhAS ?? null,
        loaiSach: o.loai ?? null,
        tenGocSach: o.ten ?? null,
        loaiOsm: p.loai,
        lechM: Math.round(d * 1000),
        daPhanXu: false,
        nguon: {
          source: "vms-south-aton-list",
          at: HOM_NAY,
          version:
            "List of AtoN system from the South of Sa Huynh lighthouse — NXB GTVT 2016, " +
            "QĐ 211/QĐ-GTVT 24/10/2016, ISBN 978-604-76-1153-9",
          url:
            "https://web.archive.org/web/20230328024018id_/http://www.vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf",
        },
      });
      continue;
    }

    phanXu.khongBangChung++;
    chuaXacMinh.push({ ...p, lyDo: "không nguồn độc lập nào trong bán kính dò" });
  }

  // 5. ghi kho + phễu
  const out = {
    v: 1,
    sinhLuc: HOM_NAY,
    ghi:
      "Manh mối OSM đã xác minh độc lập — toạ độ/tên/đặc tính là CỦA NGUỒN XÁC " +
      "MINH (tbhh / vms-south-aton-list), OSM chỉ còn trong crossChecks. " +
      "Sinh bởi scripts/osm-manh-moi.mjs; generate-vn-aids.mjs đọc ở NGUỒN E.",
    records,
  };
  mkdirSync(join(KHO_RA, ".."), { recursive: true });
  writeFileSync(KHO_RA, JSON.stringify(out, null, 1));

  const pheu = {
    osmSnapshot: goc.length,
    osmTuoiThem: themTuoi.length,
    ...(overpassLoi ? { overpassLoi } : {}),
    trongDaiBoVN: trongDai.length,
    loaiBaoHieu: loaiBaoHieu.length,
    denBienNgoaiPhamVi: denBienLon,
    daCoTrongLop: daCo.length,
    manhMoi: manhMoi.length,
    ...phanXu,
    vaoKho: records.length,
    khoRa: KHO_RA,
  };

  if (JSON_RA) {
    console.log(JSON.stringify({ pheu, chuaXacMinh, records }, null, 2));
    return;
  }
  console.log("\n── PHỄU MANH MỐI OSM (đếm và in — số liệu cho phương án)");
  console.log(`   OSM snapshot ${pheu.osmSnapshot} điểm · Overpass tươi thêm ${pheu.osmTuoiThem}` +
    (overpassLoi ? ` (LỖI: ${overpassLoi})` : ""));
  console.log(`   trong dải bờ VN ${pheu.trongDaiBoVN} · là loại báo hiệu ${pheu.loaiBaoHieu}` +
    ` (bỏ ${pheu.denBienNgoaiPhamVi} đèn biển lớn — lớp den-bien giữ)`);
  console.log(`   đã có trong lớp (<150 m) ${pheu.daCoTrongLop} → MANH MỐI THẬT: ${pheu.manhMoi}`);
  console.log(`   gặp bằng chứng: đường a (TBHH) ${pheu.capA} · đường b (sổ 2016) ${pheu.capB}`);
  console.log(`   XÁC MINH ĐƯỢC: a=${pheu.xacMinhA} (trong đó cứu hàng mập mờ ${pheu.cuuMapMo}) · b=${pheu.xacMinhB}`);
  console.log(`   KHÔNG vào: lỗi thời (nhà nước đã GỠ, OSM còn vẽ) ${pheu.loiThoi} · tin quá cũ ${pheu.quaCu}` +
    ` · tin không rõ việc ${pheu.khongRoViec} · xác minh xong mới thấy đã phát ${pheu.trungLopSauXacMinh} · không bằng chứng ${pheu.khongBangChung}`);
  console.log(`   → vào kho nguồn E: ${pheu.vaoKho} — ${KHO_RA}`);
  if (chuaXacMinh.length) {
    console.log("\n── MANH MỐI CHƯA XÁC MINH (treo — không vào lớp)");
    for (const p of chuaXacMinh) {
      console.log(`   ${p.loai.padEnd(24)} [${p.lat.toFixed(5)},${p.lon.toFixed(5)}] — ${p.lyDo}`);
    }
  }
  // vài tuyến của các mục vào kho — để đối chiếu nhanh với kiem-phu
  const theoTuyen = {};
  for (const r of records) theoTuyen[r.tuyen] = (theoTuyen[r.tuyen] ?? 0) + 1;
  if (records.length) console.log("\n── VÀO KHO THEO TUYẾN:", theoTuyen);
}

await main();
