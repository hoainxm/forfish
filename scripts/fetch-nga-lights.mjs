// ĐỐI CHIẾU LỚP ĐÈN BIỂN VỚI NGA PUB 112 — chạy CÓ CHỦ Ý (khi có mạng):
//
//   node scripts/fetch-nga-lights.mjs               # tải (có cache) + đối chiếu + ghi
//   node scripts/fetch-nga-lights.mjs --khong-ghi   # chỉ báo cáo, KHÔNG sửa file
//   node scripts/fetch-nga-lights.mjs --kho-only    # không ra mạng, chỉ đọc kho
//   node scripts/fetch-nga-lights.mjs --pdf <file>  # dùng bản PDF đã có sẵn
//
// Đầu vào : NGA Pub 112 — List of Lights, Radio Aids and Fog Signals (Western
//           Pacific) — ấn phẩm PUBLIC DOMAIN của chính phủ Mỹ (nguồn `nga-msi`
//           đã đăng ký trong src/lib/provenance.ts).
// Đầu ra  : public/data/den-bien.v1.json — HAI việc, đều CHỈ THÊM:
//           (1) `crossChecks` nguồn `nga-msi` vào lý lịch các ngọn khớp vị trí;
//           (2) 11 đèn KHÔNG TÊN trên thực thể bị chiếm đóng (mục 3b — quyết
//               định chủ dự án 2026-09-02, hàng mang cờ cột 17).
//           KHÔNG xoá, KHÔNG di chuyển, KHÔNG đổi tên một ngọn nào (cổng
//           anti-erase tự kiểm trước khi ghi). Kết quả chi tiết:
//           docs/research/nga-pub112-2026-09.md.
//
// ── VÌ SAO PUB 112 LÀ MÁY ĐỐI CHỨNG TỐT ──────────────────────────────────
// Mọi nguồn của lớp đèn biển hiện tại đều là cơ quan Việt Nam (vmsa, cổng ENC,
// sổ AtoN 2016) — chúng ĐỘC LẬP VỚI NHAU nhưng cùng một hệ thống. Pub 112 do
// Mỹ biên soạn từ đường riêng: một ngọn đèn mà cả hệ VN lẫn NGA cùng đặt trong
// bán kính 2 km là bằng chứng độc lập thật sự cho thang `confidenceOf()`.
// Giấy phép sạch tuyệt đối: public domain, không ODbL, không phi-thương-mại.
//
// ── CHỦ QUYỀN — LUẬT CỨNG ─────────────────────────────────────────────────
// Pub 112 dùng tên của HỌ ("South China Sea", tên Anh/Pháp/Trung của đảo).
// Script này chỉ lấy SỐ LIỆU: toạ độ, số hiệu, đặc tính chớp. KHÔNG một chuỗi
// chữ nào từ Pub 112 được ghi vào file phát hành — bản ghi thêm vào chỉ có
// đúng bốn khoá {source, agreed, offsetM, at} (cổng `sachChuQuyen` chặn cứng
// trước khi ghi, test nhập thẳng cổng này). Tên trong dữ liệu ta luôn là
// tiếng Việt từ nguồn VN — `scripts/audit-names.mjs` phải sạch sau khi chạy.
//
// ── ĐƯỜNG LẤY DỮ LIỆU — ĐO 2026-09-02 ────────────────────────────────────
// (1) API JSON của MSI (`/api/publications/ngalol/lights-buoys?volume=112&
//     output=json&includeRemovals=false`) là đường máy-đọc-được chính danh,
//     NHƯNG toàn bộ `msi.nga.mil/api/*` đang trả 503 "MAINTENANCE" (thử nhiều
//     lần, có cookie Akamai vẫn vậy). Khi API sống lại thì đáng chuyển sang.
// (2) PDF trực tiếp từ msi.nga.mil — cùng cụm API đó, cùng 503.
// (3) BẢN LƯU INTERNET ARCHIVE của đúng file PDF chính thức — snapshot
//     2025-08-23, tải được, là bản 2019 edition (dữ liệu đến 01-06-2019,
//     Notice to Mariners 22/2019 — ghi ngay trang Preface). Script thử (2)
//     trước, hỏng thì rơi về (3); bản nào dùng cũng ghi địa chỉ vào kho meta
//     để tái lập được.
//
// LƯU Ý TUỔI: bản 2019 nghĩa là NGA có thể LẠC HẬU so với nguồn VN 2026 —
// vì thế NGA chỉ là ĐỐI CHỨNG vị trí; mọi lệch đặc tính chỉ BÁO CÁO ra
// stdout/doc, KHÔNG bao giờ sửa dữ liệu VN theo NGA (nguồn VN là chuẩn).
//
// ── BÓC PDF ───────────────────────────────────────────────────────────────
// Dùng lại `scripts/lib/pdf-text.mjs` (bộ bóc chữ thuần Node của dự án).
// Trang danh sách đèn nhận diện bằng dòng đầu bảng "(1) (2) ... (8)" — nhờ đó
// các trang mục lục/chỉ mục (in "F2825.1 . . . 20290") không bao giờ được
// đọc thành bản ghi. Mỗi bản ghi bắt đầu bằng số hiệu Mỹ (4–5 chữ số); số
// quốc tế nằm đầu một dòng dạng "F 3116"; toạ độ ghi PHÚT THẬP PHÂN
// ("10° 41.6´ N") — độ phân giải 0,1′ ≈ 185 m, đủ cho ngưỡng khớp 2 km.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN, không nằm trong app. Không đụng public/sw.js,
// không đụng khoá forfish.*, không thêm request mạng nào vào app. File
// den-bien.v1.json chỉ PHÌNH thêm crossChecks (~5 KB, trần test 200 KB).
//
// ## Assumptions
// - Ba Kiềm (F3115): Pub 112 KHÔNG có ngọn này (soi cả bản 2019 lẫn bản lưu
//   2021 — chỉ mục nhảy F3116 → F3118 → F3120). Ô đặc tính của Ba Kiềm vì
//   thế VẪN TRỐNG — không bịa từ nguồn không có, ghi rõ ở doc nghiên cứu.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { pdfPages } from "./lib/pdf-text.mjs";

/* ══ 1. CỜ + HẰNG ══════════════════════════════════════════════════════ */

const argOf = (ten, mac) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
};
const co = (ten) => process.argv.includes(`--${ten}`);

const KHO = argOf("kho", join(tmpdir(), "sdfish-nga-lights-cache"));
const KHO_ONLY = co("kho-only");
const KHONG_GHI = co("khong-ghi");
const PDF_TAY = argOf("pdf", null);

const FILE_DEN = join(process.cwd(), "public", "data", "den-bien.v1.json");
const NGAY = new Date().toISOString().slice(0, 10);

/** Ngưỡng khớp vị trí (mét) — cùng dung sai với bộ ca đối chứng chép tay của
 *  den-bien.test.ts: đủ rộng cho VN-2000↔WGS-84 (~200 m) + phút thập phân
 *  0,1′ của NGA (~185 m), đủ chặt để không dí hai ngọn hàng xóm vào nhau. */
export const KHOP_TOI_DA_M = 2000;

/** PDF chính thức (thử trước) và bản lưu Internet Archive GHIM SNAPSHOT —
 *  ghim để lần chạy sau tải đúng byte lần này, không trôi theo bản mới. */
const URL_SONG =
  "https://msi.nga.mil/api/publications/download?key=16694312%2FSFH00000%2FUpdatedPub112bk.pdf&type=view";
const URL_LUUTRU =
  "https://web.archive.org/web/20250823192506id_/https://msi.nga.mil/api/publications/download?key=16694312%2FSFH00000%2FUpdatedPub112bk.pdf";

/* ══ 2. BÓC BẢN GHI PUB 112 (thuần — test nhập thẳng) ═════════════════ */

const DAU_BANG = /^\(1\) \(2\) \(3\)/;
const DAU_BAN_GHI = /^(\d{4,5}(?:\.\d+)?)\s+\S/;
const VI_DO = /(\d{1,2})° (\d{1,2}\.\d)´ ([NS])/;
const KINH_DO = /(\d{2,3})° (\d{1,2}\.\d)´ ([EW])/;
/** Số quốc tế đứng ĐẦU DÒNG: "F 3116", "F 2825.194", "P 3196"… */
const SO_QUOC_TE = /^([A-Z]) (\d{3,4}(?:\.\d+)?)(?=\s|$)/m;
const DAC_TINH =
  /(?:^|\s)(Mo\.\([A-Z]\)|L\.Fl\.|Fl\.|F\.|Oc\.|Iso\.|Q\.|VQ\.)(?:\((\d+(?:\+\d+)?)\))?((?:[WRGY]\.)+)?/;
const CHU_KY = /period (\d+(?:\.\d+)?)s/;
const MAU = { W: "white", R: "red", G: "green", Y: "yellow" };

/**
 * Trang Pub 112 (mảng dòng, từ `pdfPages`) → mảng bản ghi
 * {soMy, vung, soQT?, lat?, lon?, ch?, grp?, lc?, per?}.
 *
 * Chỉ đọc trang có dòng đầu bảng "(1) (2)…" — trang chỉ mục/chú dẫn vì thế
 * KHÔNG BAO GIỜ thành bản ghi. Toạ độ thiếu chữ N/E hoặc phút ≥ 60 thì bỏ
 * trống, không đoán — cùng triết lý cổng dấu-độ của generate-den-bien.mjs.
 */
export function bocBanGhiPub112(pages) {
  const ra = [];
  let vung = "";
  for (const trang of pages) {
    // Phải là trang DANH SÁCH ĐÈN: có cả dòng "(1) (2)…" LẪN đầu cột của bảng
    // đèn. Mục radiobeacon cuối sách cũng đánh cột "(1) (2)…" nhưng đầu cột
    // là "No. Name Position … Frequency" — không có "and Location" — nếu
    // không chặn thì đài radiobeacon Ba Lạt lọt vào làm bản ghi đèn.
    if (
      !trang.some((d) => DAU_BANG.test(d)) ||
      !trang.some((d) => /^No\. Name and Location/.test(d))
    )
      continue;
    let dang = null;
    for (const dong of trang) {
      if (DAU_BANG.test(dong) || /^No\. Name and Location/.test(dong)) continue;
      if (/^\d{1,3}$/.test(dong)) continue; // số trang in chân
      // Đầu mục QUỐC GIA/VÙNG: toàn chữ hoa, không chữ số, không dấu ":"
      // (tiểu mục như "CUA NAM TRIEU:" có ":" — không đổi vùng).
      if (/^[A-Z][A-Z' .,()-]+$/.test(dong) && !/[:\d]/.test(dong)) {
        vung = dong.trim();
        dang = null;
        continue;
      }
      const m = dong.match(DAU_BAN_GHI);
      if (m) {
        dang = { soMy: m[1], vung, dong: [dong] };
        ra.push(dang);
        continue;
      }
      if (dang) dang.dong.push(dong);
    }
  }
  for (const r of ra) {
    const t = r.dong.join("\n");
    delete r.dong;
    const qt = t.match(SO_QUOC_TE);
    if (qt) r.soQT = qt[1] + qt[2];
    const la = t.match(VI_DO);
    const lo = t.match(KINH_DO);
    if (la && Number(la[2]) < 60)
      r.lat = (Number(la[1]) + Number(la[2]) / 60) * (la[3] === "S" ? -1 : 1);
    if (lo && Number(lo[2]) < 60)
      r.lon = (Number(lo[1]) + Number(lo[2]) / 60) * (lo[3] === "W" ? -1 : 1);
    const dt = t.match(DAC_TINH);
    if (dt) {
      r.ch = dt[1]
        .replace(/\.$/, "")
        .replace(/^Mo\.\(([A-Z])\)$/, "Mo($1)")
        .replace("L.Fl", "LFl");
      if (dt[2]) r.grp = dt[2];
      if (dt[3])
        r.lc = dt[3].split(".").filter(Boolean).map((x) => MAU[x]).join(";");
      // Cột (5)(6) đứng NGAY SAU đặc tính trên cùng dòng: "Fl.(2)W. 75 15 …"
      // = cao 75 ft · tầm 15 hải lý. Chỉ nhận khi có ĐỦ CẢ HAI số và tầm ≤ 40
      // hải lý — một số đơn lẻ ("F.W. 20 White tower") không phân biệt được
      // cao/tầm thì BỎ, không đoán.
      const sau = t
        .slice((dt.index ?? 0) + dt[0].length)
        .match(/^ ?(\d{2,4}) (\d{1,2})(?:\s|$)/);
      if (sau && Number(sau[2]) <= 40 && Number(sau[1]) > Number(sau[2])) {
        r.rng = Number(sau[2]);
      }
    }
    const ck = t.match(CHU_KY);
    if (ck) r.per = Number(ck[1]);
    // Chiều cao TÂM SÁNG theo MÉT in ngay sau "period Ns" trên dòng kinh độ
    // ("period 10s 55" = 55 m) — cột (5) hàng dưới của khuôn hai-dòng.
    const hm = t.match(/period \d+(?:\.\d+)?s (\d{1,3})(?:\s|$)/);
    if (hm) r.hTamM = Number(hm[1]);
  }
  return ra;
}

/* ══ 3. KHOẢNG CÁCH + GHÉP (thuần — test nhập thẳng) ══════════════════ */

function metGiua(aLon, aLat, bLon, bLat) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la = (aLat * Math.PI) / 180;
  const lb = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ghép đèn của ta với bản ghi NGA theo vị trí. Thuần — không sửa gì.
 *
 * `dens`: [{ten, lon, lat, ch, grp, per, pv}] · `banGhi`: từ bocBanGhiPub112.
 * Trả về {khop, lechDacTinh, khongKhop}; phần tử mang {den, rec, kc} (kc =
 * mét), riêng lechDacTinh thêm mảng `lech` mô tả từng chỗ khác nhau.
 *
 * MỘT bản ghi NGA chỉ được nhận MỘT đèn (đèn gần hơn thắng): hai đèn của ta
 * cùng ôm một bản ghi NGA nghĩa là một trong hai không có đối chứng thật,
 * cho cả hai "khớp" là đếm trùng bằng chứng.
 */
export function ghepDoiChieu(dens, banGhi) {
  const coToaDo = banGhi.filter((r) => r.lat != null && r.lon != null);
  const ung = dens.map((d) => {
    let rec = null;
    let kc = Infinity;
    for (const r of coToaDo) {
      const m = metGiua(d.lon, d.lat, r.lon, r.lat);
      if (m < kc) {
        kc = m;
        rec = r;
      }
    }
    return { den: d, rec, kc };
  });
  const chuSoHuu = new Map(); // soMy → ứng viên gần nhất
  for (const u of ung) {
    if (!u.rec || u.kc > KHOP_TOI_DA_M) continue;
    const cu = chuSoHuu.get(u.rec.soMy);
    if (!cu || u.kc < cu.kc) chuSoHuu.set(u.rec.soMy, u);
  }
  const khop = [];
  const lechDacTinh = [];
  const khongKhop = [];
  for (const u of ung) {
    const thang = u.rec && u.kc <= KHOP_TOI_DA_M && chuSoHuu.get(u.rec.soMy) === u;
    if (!thang) {
      khongKhop.push(u);
      continue;
    }
    khop.push(u);
    const { den: d, rec: r } = u;
    const lech = [];
    if (r.ch && d.ch && r.ch !== d.ch) lech.push(`kiểu ${d.ch} ↔ NGA ${r.ch}`);
    if (r.ch && (d.grp ?? null) !== (r.grp ?? null))
      lech.push(`nhóm ${d.grp ?? "—"} ↔ NGA ${r.grp ?? "—"}`);
    if (r.per && d.per && r.per !== d.per)
      lech.push(`chu kỳ ${d.per}s ↔ NGA ${r.per}s`);
    if (lech.length) lechDacTinh.push({ ...u, lech });
  }
  return { khop, lechDacTinh, khongKhop };
}

/**
 * CỔNG CHỦ QUYỀN trước khi ghi: bản ghi thêm vào file phát hành chỉ được
 * mang đúng BỐN KHOÁ SỐ LIỆU — không một chuỗi tên nào của NGA lọt vào
 * dữ liệu phát cho bà con.
 */
export function sachChuQuyen(cc) {
  return (
    Object.keys(cc).sort().join(",") === "agreed,at,offsetM,source" &&
    cc.source === "nga-msi" &&
    cc.agreed === true &&
    Number.isFinite(cc.offsetM) &&
    cc.offsetM >= 0 &&
    cc.offsetM <= KHOP_TOI_DA_M &&
    /^\d{4}-\d{2}-\d{2}$/.test(cc.at)
  );
}

/* ══ 3b. MƯỜI MỘT ĐÈN KHÔNG TÊN (quyết định chủ dự án 2026-09-02) ═════ */

/**
 * Đèn trên thực thể thuộc chủ quyền VN nhưng nước khác đang chiếm đóng/vận
 * hành (+ P3316 phía TQ vịnh Bắc Bộ, sát đường phân định) — danh sách chốt ở
 * docs/research/nga-pub112-2026-09.md §6b. Chủ dự án quyết:
 *
 *   "11 ngọn đèn nếu không có info chính xác thì chỉ ghi gọn là đèn thôi,
 *    đừng để tên."
 *
 * Nghĩa là: lấy SỐ (toạ độ, đặc tính chớp, tầm) từ Pub 112, KHÔNG lấy một
 * cái tên nào — hàng ghi cột tên = -1 + CỜ cột 17 = 1 (cố-ý-không-tên,
 * `decodeDenBien` nhận, `tenDayDu()` hiện "Đèn biển" trần). Đèn vẫn phải có
 * trên bản đồ vì bà con lái tàu BAN ĐÊM quanh các thực thể này — một ngọn
 * đèn 22 hải lý không tên vẫn cứu người; một ngọn đèn bị giấu thì không.
 *
 * Khoá theo số hiệu MỸ (cột 1 Pub 112) — ổn định trong một ấn bản, đổi ấn
 * bản thì cổng `loi` báo ngay chứ không im lặng thiếu đèn.
 *
 * ĐÃ ĐỐI CHIẾU sổ AtoN 2016 (bản chữ, kho ngoài repo, 316 cặp toạ độ đọc
 * được): KHÔNG một báo hiệu nào của sổ nằm trong 2 km quanh 11 điểm này —
 * gần nhất 3,5 km là Song Tử Tây (đảo KHÁC, cạnh Song Tử Đông F2825). Nên
 * không có crossCheck sổ nào để thêm — VN không vận hành các đèn này.
 */
export const DEN_KHONG_TEN_PUB112 = [
  "20288", // P3196     — Hoàng Sa, tây bắc
  "20280", // P3197.5   — Hoàng Sa, đảo lớn phía đông
  "20284", // P3199.5   — Hoàng Sa, rạn đông nam
  "20289", // F2825     — Trường Sa, cụm Song Tử (đảo phía đông)
  "20289.6", // F2824   — Trường Sa, tây bắc
  "20289.62", // F2825.02 — Trường Sa, đá tây bắc
  "20289.64", // F2823.5  — Trường Sa, đảo cụm Nam Yết
  "20289.8", // F2825.17 — Trường Sa, đá trung tâm
  "20290.11", // F2825.16 — Trường Sa, đá phía tây
  "20290.12", // F2823.21 — Trường Sa, đá cụm Sinh Tồn
  "20215", // P3316     — phía TQ vịnh Bắc Bộ, sát đường phân định
];

/** Ranh major/minor — CÙNG con số với generate-den-bien.mjs (mốc chức năng
 *  10 hải lý: đèn định hướng đường dài vs đèn cửa/cảng). */
const RANH_MAJOR = 10;

/**
 * Thêm các đèn không tên vào `data` (mutate). Idempotent: điểm đã có hàng
 * cố-ý-không-tên trong 500 m thì bỏ qua. Trả {them, daCo, loi}.
 */
export function themDenKhongTen(data, banGhi) {
  const intern = (bang, v) => {
    let i = bang.indexOf(v);
    if (i < 0) i = bang.push(v) - 1;
    return i;
  };
  const ra = { them: [], daCo: [], loi: [] };
  for (const soMy of DEN_KHONG_TEN_PUB112) {
    const r = banGhi.find((b) => b.soMy === soMy);
    if (!r || r.lat == null || r.lon == null || !r.ch || !r.per) {
      ra.loi.push(soMy); // ấn bản đổi số hiệu / bộ bóc trượt — BÁO, không im
      continue;
    }
    const daCo = data.lights.some(
      (l) => l[16] === 1 && metGiua(l[0], l[1], r.lon, r.lat) < 500,
    );
    if (daCo) {
      ra.daCo.push(soMy);
      continue;
    }
    const pv =
      data.provs.push({
        origin: {
          source: "nga-msi",
          at: NGAY,
          version: "Pub 112 — 2019 edition (đến NM 22/2019)",
          url: URL_LUUTRU,
        },
      }) - 1;
    const row = [
      Number(r.lon.toFixed(5)),
      Number(r.lat.toFixed(5)),
      intern(data.types, r.rng != null && r.rng < RANH_MAJOR ? "light_minor" : "light_major"),
      intern(data.chars, r.ch),
      r.grp ? intern(data.groups, r.grp) : -1,
      r.lc ? intern(data.colours, r.lc) : -1,
      r.per ?? -1,
      r.rng ?? -1,
      -1, // màu thân: NGA tả bằng CHỮ — không lấy chữ của họ
      -1, // tên: CỐ Ý không có
      -1, // nơi đặt: tên địa lý — không lấy
      -1, // chiều cao tháp: nguồn không tách riêng
      r.hTamM ?? -1,
      -1,
      -1,
      pv,
      1, // cột 17: cờ cố-ý-không-tên
    ];
    data.lights.push(row);
    ra.them.push({ soMy, soQT: r.soQT ?? null, row });
  }
  return ra;
}

/* ══ 4. TẢI PDF (kho cache NGOÀI repo — CLAUDE.md quy tắc 5) ══════════ */

async function taiPdf() {
  if (PDF_TAY) return { buf: readFileSync(PDF_TAY), nguon: `file: ${PDF_TAY}` };
  mkdirSync(KHO, { recursive: true });
  const fCache = join(KHO, "pub112.pdf");
  const fMeta = join(KHO, "pub112.meta.json");
  if (existsSync(fCache)) {
    const meta = existsSync(fMeta)
      ? JSON.parse(readFileSync(fMeta, "utf8"))
      : { url: "?" };
    return { buf: readFileSync(fCache), nguon: `kho: ${meta.url}` };
  }
  if (KHO_ONLY) {
    throw new Error(
      `--kho-only mà kho trống (${fCache}) — chạy một lần có mạng trước`,
    );
  }
  for (const url of [URL_SONG, URL_LUUTRU]) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (SDFish doi-chieu den-bien)" },
        signal: AbortSignal.timeout(180000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Trang 503 "maintenance" của MSI trả HTML — không phải PDF thì không cất.
      if (buf.subarray(0, 5).toString() !== "%PDF-")
        throw new Error("không phải PDF (chắc trang lỗi/maintenance)");
      writeFileSync(fCache, buf);
      writeFileSync(fMeta, JSON.stringify({ url, layNgay: NGAY }));
      return { buf, nguon: url };
    } catch (e) {
      console.error(`  ✗ ${url}\n    ${e.message}`);
    }
  }
  throw new Error("không tải được Pub 112 từ cả hai đường");
}

/* ══ 5. CHẠY ═══════════════════════════════════════════════════════════ */

async function chay() {
  const { buf, nguon } = await taiPdf();
  console.log(`Pub 112: ${(buf.length / 1e6).toFixed(1)} MB — ${nguon}`);

  const pages = pdfPages(buf);
  const banGhi = bocBanGhiPub112(pages);
  // Cổng "đúng file": Pub 112 có ~12.000 bản ghi toàn Tây Thái Bình Dương.
  if (pages.length < 500 || banGhi.length < 5000) {
    throw new Error(
      `file lạ: ${pages.length} trang, ${banGhi.length} bản ghi — không giống Pub 112`,
    );
  }
  console.log(`  ${pages.length} trang · ${banGhi.length} bản ghi có số hiệu`);

  const raw = readFileSync(FILE_DEN, "utf8");
  const data = JSON.parse(raw);
  const dens = data.lights.map((l) => ({
    lon: l[0],
    lat: l[1],
    ch: l[3] >= 0 ? data.chars[l[3]] : null,
    grp: l[4] >= 0 ? data.groups[l[4]] : null,
    per: l[6] > 0 ? l[6] : null,
    ten: data.names[l[9]],
    pv: l[15],
  }));

  // Đèn có GỐC nga-msi (11 ngọn không tên) không tham gia đối chiếu NGA —
  // NGA xác nhận chính nó là bằng chứng rỗng, `confidenceOf()` cũng đã loại
  // crossCheck trùng nguồn gốc.
  const densGoc = dens.filter(
    (d) => data.provs[d.pv]?.origin?.source !== "nga-msi",
  );
  const { khop, lechDacTinh, khongKhop } = ghepDoiChieu(densGoc, banGhi);

  const demHaiNguon = () =>
    data.lights.filter((l) => {
      const p = data.provs[l[15]];
      const s = new Set([
        p.origin.source,
        ...(p.crossChecks ?? []).filter((c) => c.agreed).map((c) => c.source),
      ]);
      return s.size >= 2;
    }).length;
  const truoc = demHaiNguon();

  let them = 0;
  let daCo = 0;
  for (const u of khop) {
    const prov = data.provs[u.den.pv];
    const cc = (prov.crossChecks ??= []);
    if (cc.some((c) => c.source === "nga-msi")) {
      daCo++; // chạy lại không nhân đôi — idempotent
      continue;
    }
    const moi = {
      source: "nga-msi",
      agreed: true,
      offsetM: Math.round(u.kc),
      at: NGAY,
    };
    if (!sachChuQuyen(moi))
      throw new Error(`cổng chủ quyền chặn: ${JSON.stringify(moi)}`);
    cc.push(moi);
    them++;
  }

  console.log(
    `\n── KHỚP ≤ ${KHOP_TOI_DA_M} m: ${khop.length}/${densGoc.length}` +
      ` — thêm ${them} crossCheck, ${daCo} đã có từ lần trước`,
  );
  console.log(`── Đèn có ≥2 nguồn độc lập xác nhận: ${truoc} → ${demHaiNguon()}`);

  const khongTen = themDenKhongTen(data, banGhi);
  console.log(
    `\n── ĐÈN KHÔNG TÊN (11 ngọn, quyết định chủ dự án 2026-09-02): ` +
      `thêm ${khongTen.them.length} · đã có ${khongTen.daCo.length}`,
  );
  for (const t of khongTen.them)
    console.log(`   ${t.soQT ?? t.soMy}: ${t.row[1]}°B ${t.row[0]}°Đ`);
  if (khongTen.loi.length)
    console.log(
      `   ✗ KHÔNG bóc được từ Pub 112 (đổi ấn bản? bộ bóc trượt?): ${khongTen.loi.join(", ")}`,
    );

  console.log(
    `\n── LỆCH ĐẶC TÍNH (${lechDacTinh.length}) — CHỈ BÁO, không sửa theo bên nào` +
      ` (nguồn VN là chuẩn, NGA bản 2019):`,
  );
  for (const u of lechDacTinh)
    console.log(
      `   ${u.den.ten} ↔ ${u.rec.soQT ?? u.rec.soMy} (${Math.round(u.kc)} m): ${u.lech.join(", ")}`,
    );

  console.log(`\n── KHÔNG KHỚP ≤ 2 km (${khongKhop.length}) — bản ghi NGA gần nhất:`);
  for (const u of khongKhop)
    console.log(
      `   ${u.den.ten} (${u.den.lat.toFixed(4)}°B ${u.den.lon.toFixed(4)}°Đ): ` +
        (u.rec
          ? `${u.rec.soQT ?? u.rec.soMy} cách ${(u.kc / 1000).toFixed(1)} km`
          : "—"),
    );

  // Ứng viên: bản ghi NGA trong khung biển VN chưa ứng với đèn nào của ta.
  // CHỈ in số hiệu + toạ độ + đặc tính — tên để tra ngược qua nguồn VN, không
  // chép tên NGA đi đâu cả.
  const trongKhungVN = (r) =>
    r.lon != null &&
    r.lat != null &&
    r.lon >= 102 &&
    r.lon <= 117 &&
    r.lat >= 5 &&
    r.lat <= 23.6;
  const ungVien = banGhi.filter(
    (r) =>
      trongKhungVN(r) &&
      (r.vung === "VIETNAM" || r.vung === "SOUTH CHINA SEA") &&
      // so với data.lights SAU khi thêm — 11 ngọn không tên hết là ứng viên
      !data.lights.some((l) => metGiua(l[0], l[1], r.lon, r.lat) <= KHOP_TOI_DA_M),
  );
  console.log(
    `\n── ỨNG VIÊN NGA trong khung biển VN chưa có trong lớp: ${ungVien.length}` +
      ` (đa số là đèn luồng/chập tiêu — xem doc nghiên cứu)`,
  );
  for (const r of ungVien)
    console.log(
      `   ${r.soQT ?? "(không số QT)"} (${r.soMy}) ${r.lat.toFixed(3)}°B ${r.lon.toFixed(3)}°Đ ` +
        `${r.ch ?? "?"}${r.grp ? `(${r.grp})` : ""}${r.per ? ` ${r.per}s` : ""}`,
    );

  if (KHONG_GHI) {
    console.log("\n(--khong-ghi: không sửa file)");
    return;
  }

  // Cổng ANTI-ERASE: chỉ được THÊM — mọi hàng CŨ phải y nguyên từng số ở
  // đúng chỗ cũ, bảng tên y nguyên, bảng tra chỉ được nối đuôi, và hàng nối
  // thêm BẮT BUỘC mang cờ cố-ý-không-tên (đường thêm duy nhất được phép).
  const cu = JSON.parse(raw);
  const bangCu = [cu.types, cu.chars, cu.groups, cu.colours];
  const bangMoi = [data.types, data.chars, data.groups, data.colours];
  if (
    data.lights.length < cu.lights.length ||
    JSON.stringify(data.names) !== JSON.stringify(cu.names) ||
    cu.lights.some(
      (l, i) => JSON.stringify(data.lights[i]) !== JSON.stringify(l),
    ) ||
    data.lights.slice(cu.lights.length).some((l) => l[16] !== 1) ||
    !bangCu.every((b, k) => b.every((v, i) => bangMoi[k][i] === v))
  ) {
    throw new Error("anti-erase: hàng/tên/bảng tra cũ bị đổi — KHÔNG ghi");
  }
  const json = JSON.stringify(data);
  writeFileSync(FILE_DEN, json);
  console.log(`\n✓ ${FILE_DEN} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`);
}

/*  CHỈ CHẠY KHI ĐƯỢC GỌI THẲNG — bộ test nhập các cổng thuần ở trên
    (bocBanGhiPub112, ghepDoiChieu, sachChuQuyen); nhập KHÔNG được kéo
    mạng hay ghi đè dữ liệu. Cùng khuôn generate-den-bien.mjs.  */
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await chay();
}
