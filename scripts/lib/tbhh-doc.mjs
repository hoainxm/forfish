// ĐỌC KHO THÔNG BÁO HÀNG HẢI — bộ dùng chung, KHÔNG dependency.
//
// Tách khỏi `scripts/generate-vn-aids.mjs` (2026-09-02) vì bộ đọc này là thứ
// DÙNG CHUNG chứ không phải của riêng lớp báo hiệu chính thức:
// `scripts/osm-manh-moi.mjs` mở CÙNG kho chữ ra đọc bằng một câu hỏi khác
// ("toạ độ này có thông báo nào nhắc tới không?"). Tách hàm, KHÔNG chép —
// chép là tạo bản sự thật thứ hai, và nó sẽ lệch đúng vào hôm ai đó sửa một
// bên (cùng lý do `scripts/lib/pdf-text.mjs` được tách).
//
// Mọi chú thích "vì sao" của từng hàm giữ nguyên từ nơi ở cũ — chúng là án lệ
// (BL.1 → 81.1, `10 5 ° 18'` → 5,3°…), không phải văn mẫu.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Khung biển VN (Nam, Tây, Bắc, Đông) — GIỐNG generate-seamarks.mjs. */
export const VN_BBOX = [4.0, 102.0, 24.0, 118.0];

/* ── HTML → CHỮ ───────────────────────────────────────────────────────────
 * Trang nguồn là ASP.NET WebForms đời cũ: chữ tiếng Việt bị mã hoá NỬA VỜI —
 * dấu mũ/huyền của bảng Latin-1 ra thực thể có tên (`&ecirc;` = ê) còn chữ
 * riêng của tiếng Việt (ơ ư đ…) ra thực thể số. Thiếu bảng tên thì "Tên BH"
 * đọc thành "T&ecirc;n BH" và mọi so khớp sau đó trượt hết.
 */
const LATIN1_NAMES =
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml " +
  "Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times " +
  "Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc " +
  "atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc " +
  "iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute " +
  "ucirc uuml yacute thorn yuml";

const ENTITY = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  deg: "°", prime: "'", Prime: '"', ndash: "–", mdash: "—",
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", sbquo: ",",
  hellip: "…", middot: "·", bull: "·", laquo: "<<", raquo: ">>",
  plusmn: "±", sup2: "2", sup3: "3", frac12: "1/2", frac14: "1/4",
};
LATIN1_NAMES.split(" ").forEach((n, i) => {
  ENTITY[n] = String.fromCodePoint(0xc0 + i);
});

export function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCodePoint(parseInt(d, 16)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => ENTITY[n] ?? m);
}

export const toNum = (s) => Number(String(s).replace(",", "."));

/** Câu tiếng Việt tả màu ánh đèn — dùng ở cả bảng ENC lẫn Thông báo hàng hải. */
export const VN_COLOUR = [
  [/trắng/i, "white"], [/đỏ/i, "red"], [/xanh/i, "green"], [/vàng/i, "yellow"],
];

/** Khoảng cách lớn nhất từ một báo hiệu tới TÂM CỤM của cùng thông báo (km). */
export const TBHH_BAN_KINH_KM = 60;
/** Hai hệ toạ độ của CÙNG một điểm lệch nhau ~200 m; quá ngưỡng này là dòng loạn. */
export const TBHH_LECH_HE_KM = 2;

const RAD = (d) => (d * Math.PI) / 180;
export function kmGiua(aLon, aLat, bLon, bLat) {
  const dLat = RAD(bLat - aLat);
  const dLon = RAD(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(RAD(aLat)) * Math.cos(RAD(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* ── KHOẢNG TRẮNG CHÈN GIỮA CHỮ SỐ ────────────────────────────────────────
 *
 * Kho có HAI đường vào và chúng vỡ theo hai kiểu khác nhau. Bản OCR đọc nhầm
 * KÝ TỰ (`°` thành `0`/`9`). Bản bóc từ LỚP CHỮ thì ký tự luôn đúng — PDF ghi
 * đúng chữ `°` — nhưng nó chẻ một con số thành nhiều mẩu vẽ rời, và bước dựng
 * dòng nối các mẩu ấy bằng khoảng trắng:
 *
 *   thật:  20°03'29,4" 107°12'19,1"
 *   ra:    20° 03 ' 29.4 " 107°1 2 ' 19. 1 "      ← phút "1 2", giây "19. 1"
 *   ra:    “PH1” 10° 3 6 ’ 59 . 0 ” 10 7 ° 00 ’   ← cả ĐỘ cũng bị chẻ
 *
 * PHÚT và GIÂY nằm KẸP GIỮA hai dấu — gộp khoảng trắng ở đó là phép ghép chắc
 * chắn. ĐỘ thì hở BÊN TRÁI (sát cột TÊN) nên phải liệt kê MỌI cách đọc rồi
 * chỉ nhận khi có ĐÚNG MỘT cặp rơi vào khung biển VN — đúng luật `ocrCoordLine`
 * trong `src/lib/soundings.ts`, một cách xử mập mờ cho cả repo.
 */

/** Nhóm chữ số có thể bị chẻ: tối đa 3 chữ số (độ) hoặc 2 (phút). */
const SO3 = String.raw`(\d(?:[ \t]{0,2}\d){0,2})`;
const SO2 = String.raw`(\d(?:[ \t]{0,2}\d)?)`;
/** Giây: tối đa 2 chữ số nguyên + phần lẻ; khoảng trắng rơi được vào mọi khe. */
const SO_GIAY = String.raw`(\d(?:[ \t]{0,2}\d)?(?:[ \t]*[.,][ \t]*\d(?:[ \t]{0,2}\d)?)?)?`;
const DAU_DO = String.raw`[ \t]*°[ \t]*`;
const DAU_PHUT = String.raw`[ \t]*['’][ \t]*`;
const DAU_GIAY = String.raw`[ \t]*(?:["”″]|''|’’|′′)?`;

/**
 * MỘT CẶP toạ độ độ-phút-giây trên một dòng bảng.
 *
 * BẮT BUỘC có dấu độ THẬT (`°`). Bản OCR hay đọc `°` thành `0` hoặc `9`, nên
 * "105016'12,7\"" có thể là 105°16' mà cũng có thể là 10°50'16"… — đoán ra là
 * dựng một cái phao ở chỗ không có.
 */
const TBHH_PAIR = new RegExp(
  SO3 + DAU_DO + SO2 + DAU_PHUT + SO_GIAY + DAU_GIAY + String.raw`[ \t]*[Nn]?[\s,;]*` +
    SO3 + DAU_DO + SO2 + DAU_PHUT + SO_GIAY + DAU_GIAY + String.raw`[ \t]*[Ee]?`,
  "g",
);

/** Bỏ khoảng trắng chèn giữa chữ số — chỉ cho PHÚT và GIÂY (kẹp giữa hai dấu). */
const gopSo = (raw) => String(raw ?? "").replace(/[ \t]+/g, "");

/**
 * Mọi cách đọc của nhóm ĐỘ, cắt tại từng khoảng trắng. Gom theo GIÁ TRỊ SỐ,
 * không theo chuỗi: "0 7" cho ra "07" và "7" — cùng một số, phải kể là MỘT
 * cách đọc, nếu không thì mọi hàng viết kiểu đó đều bị coi là mập mờ rồi vứt oan.
 *
 * Trả kèm `off` — vị trí ký tự nơi cách đọc ấy BẮT ĐẦU trong nhóm. Cần nó vì
 * nhóm ĐỘ hở bên trái nên hay ngoạm sang cột TÊN: hàng "Phao 5 20°03'…" khớp
 * từ chữ "5", và nếu báo vị trí bắt đầu là chữ "5" thì `tenBaoHieu` chỉ còn
 * "Phao" — mất số hiệu của một cái phao đọc ĐÚNG toạ độ. Đo thật: bỏ qua
 * `off` làm số tên đọc được tụt từ 143 xuống 110.
 */
function cachDocDo(raw) {
  const s = String(raw ?? "");
  const out = [];
  const thay = new Set();
  // Cắt tại từng khoảng trắng: "1 1 7" → 117 (off 0) · 17 (off 2) · 7 (off 4).
  for (const m of [...s.matchAll(/\d/g)]) {
    const i = m.index;
    if (i > 0 && /\d/.test(s[i - 1])) continue; // giữa một mẩu, không phải chỗ cắt
    const n = Number(s.slice(i).replace(/[ \t]+/g, ""));
    if (!Number.isFinite(n) || thay.has(n)) continue;
    thay.add(n);
    out.push({ val: n, off: i });
  }
  return out;
}

/**
 * Mọi cặp toạ độ HỢP LỆ trên một dòng, kèm vị trí ký tự bắt đầu.
 *
 * `mapMoRa` (tuỳ chọn): hàng chữ số bị chẻ ra ≥2 cách đọc thì bộ đọc MÙ phải
 * bỏ (không đoán) — nhưng một bộ đọc CÓ GIẢ THUYẾT (một toạ độ ứng viên từ
 * nguồn khác để đối chiếu) thì phân xử được. Truyền mảng vào đây để nhận về
 * các cách đọc `{hop: [{lon,lat,at}…]}` thay vì chỉ đếm rồi vứt. KHÔNG truyền
 * thì hành vi y như cũ.
 */
export function capToaDo(dong, log, mapMoRa = null) {
  const out = [];
  TBHH_PAIR.lastIndex = 0;
  let m;
  while ((m = TBHH_PAIR.exec(dong))) {
    const p = Number(gopSo(m[2]));
    const g = m[3] ? toNum(gopSo(m[3])) : 0;
    const p2 = Number(gopSo(m[5]));
    const g2 = m[6] ? toNum(gopSo(m[6])) : 0;
    if (!(p < 60) || !(g < 60) || !(p2 < 60) || !(g2 < 60)) continue;
    const [S, W, N, E] = VN_BBOX;
    const hop = [];
    for (const dLat of cachDocDo(m[1])) {
      for (const dLon of cachDocDo(m[4])) {
        const lat = dLat.val + p / 60 + g / 3600;
        const lon = dLon.val + p2 / 60 + g2 / 3600;
        if (lat < S || lat > N || lon < W || lon > E) continue;
        // `at` = nơi con số ĐƯỢC CHỌN bắt đầu, không phải nơi regex khớp: phần
        // thừa bên trái là cột TÊN, và `tenBaoHieu` đọc đúng khúc đó.
        hop.push({ lon, lat, at: m.index + dLat.off });
      }
    }
    // 0 cách đọc ⇒ hàng không phải toạ độ biển VN (bỏ im lặng, y như trước).
    // ≥2 cách đọc ⇒ MẬP MỜ vì chữ số bị chẻ: bỏ hàng và ĐẾM, tuyệt đối không
    // đoán — trừ khi chỗ gọi xin giữ lại để phân xử bằng giả thuyết riêng.
    if (hop.length > 1) {
      if (log) log.tbhhMapMo++;
      if (mapMoRa) mapMoRa.push({ hop });
      continue;
    }
    if (!hop.length) continue;
    out.push(hop[0]);
  }
  return out;
}

/**
 * TÊN BÁO HIỆU nằm ở phần đầu dòng, trước cặp toạ độ đầu tiên.
 *
 * Cái BẪY ở đây đã cắn dự án một lần với `BL.1` bị đọc thành `81.1`: cột TÊN
 * hoá thành số đo. Ở đây bẫy chạy ngược — một mảnh toạ độ vỡ ("10,9", "15,4",
 * "107904") trôi lên đầu dòng và hoá thành TÊN. Nên luật là: tên phải còn ít
 * nhất một CHỮ CÁI hoặc một cụm chữ-số kiểu số hiệu; chuỗi chỉ gồm chữ số và
 * dấu thì KHÔNG phải tên, trả rỗng để chỗ gọi xử lý tiếp.
 */
export function tenBaoHieu(dong, tuoiDau) {
  let s = String(dong).slice(0, tuoiDau);
  s = s.replace(/[«»<>*`|~^\\]/g, " ").replace(/["”“'’]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Còn dấu độ/phút = mảnh toạ độ, không phải tên.
  if (/[°′″]/.test(s)) return "";
  // Cắt tiền tố mô tả để còn lại đúng số hiệu ("Phao báo hiệu số 5" → "Phao 5").
  s = s.replace(/^(?:Phao|Ti[êe]u|Đăng ti[êe]u)\s+b[áa]o hi[êệ]u(?:\s+h[àa]ng h[ảa]i)?/i, "Phao");
  s = s.replace(/\s+s[ốô]\s+/i, " ");
  s = s.replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, "");
  if (!s || s.length > 40) return "";
  if (!/[A-Za-zÀ-ỹ0-9]/.test(s)) return "";
  // Chuỗi 4 chữ số liền trở lên = mảnh toạ độ bị OCR đẩy lên đầu dòng
  // ("26A 1092649,8"). Số hiệu phao thật không bao giờ dài như vậy.
  if (/\d{4}/.test(s)) return "";
  // Chỉ toàn số + dấu thập phân ⇒ mảnh toạ độ/độ sâu, KHÔNG phải số hiệu phao.
  if (/^[\d\s.,]+$/.test(s) && /[.,]\d/.test(s)) return "";
  // Ô "Vùng biển"/"Tên luồng" tràn sang cột tên — đó là ĐỊA DANH, không phải
  // định danh báo hiệu. Nhận nhầm là dán tên tỉnh lên một cái phao.
  if (/th[àa]nh ph[ốo]|t[ỉi]nh\b|huy[ệe]n\b|v[ùu]ng bi[ểe]n|t[êe]n lu[ồo]ng|to[ạa] đ[ộo]|h[ệe] (?:VN|WGS)/i.test(s))
    return "";
  if (s.split(" ").length > 4) return "";
  return s;
}

/**
 * Đặc tính đèn viết bằng CÂU TIẾNG VIỆT trong thông báo:
 *   "Ánh sáng màu vàng, chớp nhóm (3+1), chu kỳ 18s"
 *   "Ánh sáng trắng, chớp đơn chu kỳ 5 giây"
 * Trả về `LightInfo` đúng từ vựng `seamarks.ts`; không đọc ra thì trả rỗng.
 */
export function parseLightVN(cau) {
  const s = String(cau ?? "");
  if (!/ch[ớo]p|đẳng ph[aá]|[áa]nh s[áa]ng/i.test(s)) return {};
  const info = {};
  if (/ch[ớo]p d[àa]i/i.test(s)) info.character = "LFl";
  else if (/đẳng ph[aá]/i.test(s)) info.character = "Iso";
  else if (/ch[ớo]p r[ấa]t nhanh/i.test(s)) info.character = "VQ";
  else if (/ch[ớo]p nhanh/i.test(s)) info.character = "Q";
  else if (/ch[ớo]p/i.test(s)) info.character = "Fl";
  if (!info.character) return {};
  const grp = /ch[ớo]p nh[óo]m\s*\(?\s*(\d(?:\s*\+\s*\d)?)\s*\)?/i.exec(s);
  if (grp) {
    const g = grp[1].replace(/\s+/g, "");
    if (g !== "1" && g !== "0") info.group = g;
  }
  for (const [re, name] of VN_COLOUR) if (re.test(s)) { info.colour = name; break; }
  const per = /chu k[ỳy][^\d]{0,12}(\d+(?:[.,]\d+)?)\s*(?:s\b|gi[âa]y)/i.exec(s);
  if (per) {
    const v = toNum(per[1]);
    if (Number.isFinite(v) && v > 0 && v < 120) info.period = v;
  }
  return info;
}

/**
 * Việc mà một thông báo báo hiệu làm — xem đầu generate-vn-aids.mjs.
 *
 * THỨ TỰ CÓ Ý NGHĨA và không đảo được: một tin "chấm dứt hoạt động phao báo
 * hiệu … đã thiết lập theo Thông báo số X" chứa CẢ HAI động từ. Xét "GỠ"
 * trước thì đọc đúng; xét "LẬP" trước thì vẽ lại một cái phao đã tháo.
 *
 * Chữ trong kho là chữ OCR nên mọi mẫu phải chịu được vài kiểu đọc sai quen
 * thuộc: `l`↔`I`, `ơ`↔`o`, dấu gạch dưới thay khoảng trắng.
 */
export function viecCuaThongBao(dau) {
  const s = String(dau).replace(/_/g, " ");
  if (/ch[âấa]m d[ưứ]t ho[ạa]t đ[ộo]ng|thu h[ồo]i|hu[ỷy] b[ỏo]|d[ừư]ng ho[ạa]t đ[ộo]ng|th[áa]o d[ỡơ]/i.test(s))
    return "GỠ";
  if (/t[ạa]m ng[ưừ]ng ho[ạa]t đ[ộo]ng|ng[ưừ]ng ho[ạa]t đ[ộo]ng t[ạa]m/i.test(s)) return "NGƯNG";
  if (
    /thi[êế]t\s*[lI1i][âậa]p|đưa v[àa]o (?:s[ửu] d[ụu]ng|ho[ạa]t đ[ộo]ng)|ph[ụu]c h[ồo]i ho[ạa]t đ[ộo]ng|kh[ôo]i ph[ụu]c/i.test(s)
  )
    return "LẬP";
  if (/thay đ[ổo]i|d[ịi]ch chuy[ểe]n|đi[êề]u ch[ỉi]nh|s[ửu]a ch[ữu]a/i.test(s)) return "ĐỔI";
  /* CÒN LẠI mà vẫn có mục "Tên báo hiệu" + bảng toạ độ: đây là tin CÔNG BỐ
     THÔNG SỐ ("về thông số kỹ thuật đèn biển Đại Lãnh", "phao chuyên dùng
     phục vụ thi công …"). Nó khẳng định báo hiệu ĐANG TỒN TẠI ở toạ độ đó —
     đúng thứ ta cần. Bỏ qua nhóm này là vứt 1/3 số tin miền Nam. */
  if (/T[êe]n b[áa]o hi[êệ]u\s*:/i.test(dau)) return "NÊU";
  return null;
}

/** Ghép lý lịch: sha1(URL) → { url, nam, thang, tieuDe }. */
export function lyLichThongBao(khoTbhh) {
  const idx = new Map();
  const them = (url, meta) => {
    if (!url) return;
    idx.set(createHash("sha1").update(url).digest("hex"), { url, ...meta });
  };
  // (a) trang chi tiết vmsa.vn đã tải — cho tiêu đề + link PDF
  const dDetail = join(khoTbhh, "detail");
  if (existsSync(dDetail)) {
    for (const f of readdirSync(dDetail)) {
      let h;
      try {
        h = readFileSync(join(dDetail, f), "utf8");
      } catch {
        continue;
      }
      const tieuDe = decodeEntities(
        /<meta property="og:title" content="([^"]*)"/.exec(h)?.[1] ?? "",
      );
      for (const m of h.matchAll(/href="([^"]*\.pdf)"/gi)) {
        let u = m[1];
        if (u.startsWith("/")) u = `https://vmsa.vn${u}`;
        else if (!/^https?:/i.test(u)) u = `https://vmsa.vn/${u}`;
        const nam = /TBHH(\d{4})\//.exec(u)?.[1] ?? /\/(\d{4})\/\d{1,2}\//.exec(u)?.[1];
        them(u, { tieuDe, nam: nam ? Number(nam) : null, thang: null });
      }
    }
  }
  // (b) danh mục bản lưu trữ vms-south.vn — kho chữ OCR khoá theo URL GỐC
  const dCdx = join(khoTbhh, "cdx");
  if (existsSync(dCdx)) {
    for (const f of readdirSync(dCdx)) {
      let rows;
      try {
        rows = JSON.parse(readFileSync(join(dCdx, f), "utf8"));
      } catch {
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const r of rows.slice(1)) {
        const org = r?.[1];
        if (typeof org !== "string") continue;
        const u = /\/uploads\/(\d{4})\/(\d{2})\//.exec(org);
        them(org, {
          tieuDe: "",
          nam: u ? Number(u[1]) : Number(String(r[0]).slice(0, 4)) || null,
          thang: u ? Number(u[2]) : null,
        });
      }
    }
  }
  return idx;
}

/**
 * Đọc kho chữ → danh sách THÔNG BÁO BÁO HIỆU đã bóc.
 * Mỗi phần tử: { so, coQuan, nam, thang, url, viec, luong, vung, tacDung,
 *                den, aids:[{lon,lat,ten}] }
 *
 * `kho` = { khoOcr, khoChu, khoTbhh } — đường dẫn ba kho ngoài repo.
 * `opts.giuMapMo`      — giữ các HÀNG chữ số bị chẻ (≥2 cách đọc) ở
 *                        `mapMo: [{dong, hop}]` cho chỗ gọi có giả thuyết
 *                        riêng phân xử; bộ đọc mù thì như cũ (bỏ, đếm).
 * `opts.giuKhongRoViec`— giữ cả tin không đọc ra việc (`viec: null`) — chỗ
 *                        gọi tự chịu trách nhiệm KHÔNG dựng phao từ tin
 *                        chưa rõ là LẬP hay GỠ.
 */
export function docThongBao(log, kho, opts = {}) {
  const khoCo = [kho.khoOcr, kho.khoChu].filter((d) => existsSync(d));
  if (!khoCo.length) {
    log.tbhhKhoVang = `${kho.khoOcr} + ${kho.khoChu}`;
    return [];
  }
  const lyLich = lyLichThongBao(kho.khoTbhh);
  /* MỘT thông báo = MỘT bản chữ. File có ở cả hai kho thì kho đứng trước
     thắng — không đọc hai lần rồi đếm một cái phao thành hai. */
  const chon = new Map();
  for (const khoDir of khoCo) {
    for (const f of readdirSync(khoDir)) {
      if (!f.endsWith(".dong.json") || chon.has(f)) continue;
      chon.set(f, khoDir);
    }
  }
  const out = [];
  for (const [f, khoDir] of chon) {
    let d;
    try {
      d = JSON.parse(readFileSync(join(khoDir, f), "utf8"));
    } catch {
      log.tbhhKhoHong++;
      continue;
    }
    const duong = khoDir === kho.khoOcr ? "ocr" : "lop-chu";
    log.tbhhTheoDuong[duong] = (log.tbhhTheoDuong[duong] ?? 0) + 1;
    const lines = (d.trang ?? []).flat().filter((x) => typeof x === "string");
    if (!lines.length) continue;
    /* KHỐI CHỦ ĐỀ, không phải "40 dòng đầu". Thông báo nào cũng mở bằng vài
       chục dòng tiêu ngữ và tên cơ quan; câu "Về việc …" nằm SAU đó, rồi tới
       "Căn cứ …" là hết phần chủ đề. Cắt đúng khúc giữa thì bắt được việc mà
       không nhặt nhầm động từ trong phần căn cứ pháp lý. */
    const toanBo = lines.join("\n");
    const het = toanBo.search(/C[ăa]n c[ứu]|X[ée]t [Đđ]ơn|Th[ừư]a [ủu]y quy[ềê]n/);
    const dau = toanBo.slice(0, het > 200 ? het : 3000);
    if (!/b[áa]o hi[êệ]u/i.test(dau)) {
      /* Tin VỀ VIỆC KHÁC (độ sâu luồng, thông số cầu, khu neo, thông báo đấu
         thầu). Trước đây `continue` không đếm, nên báo cáo không bao giờ nói
         được "kho có bao nhiêu tin là về báo hiệu" — và một bộ dò hỏng (regex
         trượt dấu) sẽ trông y hệt một kho không có tin báo hiệu nào. */
      log.tbhhKhongPhaiBaoHieu++;
      continue;
    }
    const viec = viecCuaThongBao(dau);
    if (!viec && !opts.giuKhongRoViec) {
      log.tbhhKhongRoViec++;
      continue;
    }

    const meta = lyLich.get(f.replace(".dong.json", "")) ?? {};
    const toanVan = lines.join("\n");
    const ngayVan = /ng[àa]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*năm\s*(\d{4})/i.exec(toanVan);
    // Năm lấy từ ĐƯỜNG DẪN kho trước, vì OCR đọc số trong dấu ngày rất hay sai;
    // chỉ dùng ngày trong văn bản khi NĂM của nó khớp năm của bản lưu.
    const nam = meta.nam ?? (ngayVan ? Number(ngayVan[3]) : null);
    const thang =
      ngayVan && Number(ngayVan[3]) === nam ? Number(ngayVan[2]) : (meta.thang ?? null);
    const coQuan = /TBHH\s*[-–—]\s*([A-ZÀ-Ỹ][A-ZÀ-Ỹa-zà-ỹ]{2,19})/.exec(toanVan)?.[1] ?? "";
    /* SỐ HIỆU THÔNG BÁO là cách duy nhất để bà con (hay cán bộ cảng vụ) tra
       lại tận gốc, nên đừng bỏ trống khi còn chỗ lấy. Ô "Số:" trong bản scan
       hay bị OCR đọc hỏng, nhưng TÊN FILE của bản công bố thì luôn mang đúng
       con số. Lấy từ văn bản trước, hụt thì lấy từ đường dẫn. */
    const soVan = /S[ốô]\s*:?\s*(\d{1,5})\s*[\/I|]?\s*TBHH/i.exec(toanVan)?.[1] ?? "";
    const url0 = meta.url ?? "";
    const soUrl =
      /\/(\d{1,5})[-_]TBHH/i.exec(url0)?.[1] ?? /\/TBHH\d{4}\/(\d{1,5})\.pdf/i.exec(url0)?.[1] ?? "";
    const so = soVan || soUrl;
    /* Tên luồng là NHÃN bà con đọc trên bản đồ, nên gột hai lỗi OCR quen tay:
       rơi mất chữ "hàng" ("Luồng hải Năm Căn") và dính dấu chấm cuối câu. Đây
       là sửa CÁCH VIẾT, không phải đặt lại tên — số hiệu báo hiệu thì tuyệt
       đối không đụng vào. */
    const luong = (/T[êe]n lu[ồo]ng\s*:?\s*([^\n]{3,80})/i.exec(toanVan)?.[1] ?? "")
      .trim()
      .replace(/^Lu[ồo]ng h[ảa]i\b/i, "Luồng hàng hải")
      .replace(/[.,;:\s]+$/, "");
    const vung = /V[ùu]ng bi[ểe]n\s*:?\s*([^\n]{3,60})/i.exec(toanVan)?.[1]?.trim() ?? "";
    const tacDung = /T[áa]c d[ụu]ng\s*:?\s*([^\n]{5,120})/i.exec(toanVan)?.[1]?.trim() ?? "";
    const denCau = /Đ[ặa]c t[íi]nh [áa]nh s[áa]ng\s*:?\s*([^\n]{5,120})/i.exec(toanVan)?.[1] ?? "";
    const tenChung = /T[êe]n b[áa]o hi[êệ]u\s*:?\s*([^\n]{3,70})/i.exec(toanVan)?.[1]?.trim() ?? "";

    // Thứ tự hai hệ toạ độ trên đầu bảng — VN-2000 đứng trước thì cặp THỨ HAI
    // của mỗi dòng mới là WGS-84 (cùng hệ với hải đồ và GPS của bà con).
    const iVn = toanVan.search(/VN\s*-?\s*2000/i);
    const iWgs = toanVan.search(/WGS\s*-?\s*84/i);
    const wgsSau = iVn >= 0 && iWgs >= 0 && iVn < iWgs;

    const aids = [];
    const mapMo = opts.giuMapMo ? [] : null;
    for (const l of lines) {
      const mapMoDong = opts.giuMapMo ? [] : null;
      const caps = capToaDo(l, log, mapMoDong);
      if (mapMoDong?.length) {
        for (const mm of mapMoDong) mapMo.push({ dong: l, hop: mm.hop });
      }
      if (!caps.length) continue;
      let chonCap;
      if (caps.length === 1) chonCap = caps[0];
      else {
        // Hai cặp trên một dòng PHẢI là cùng một điểm ở hai hệ toạ độ. Lệch xa
        // hơn ngưỡng ⇒ OCR trộn cột của hai dòng khác nhau ⇒ bỏ cả dòng.
        const a = caps[0];
        const b = caps[caps.length - 1];
        if (kmGiua(a.lon, a.lat, b.lon, b.lat) > TBHH_LECH_HE_KM) {
          log.tbhhDongLoan++;
          continue;
        }
        chonCap = wgsSau ? b : a;
      }
      const ten = tenBaoHieu(l, caps[0].at);
      aids.push({ lon: chonCap.lon, lat: chonCap.lat, ten });
    }
    if (!aids.length && !mapMo?.length) {
      /* Tin VỀ báo hiệu nhưng KHÔNG có một dòng toạ độ nào đọc ra được — tin
         thu hồi chỉ dẫn chiếu số hiệu cũ, hoặc bảng toạ độ vỡ cột. ĐẾM: đây là
         con số duy nhất nói được "bộ đọc bảng trượt bao nhiêu". */
      log.tbhhKhongCoBang++;
      continue;
    }

    // CỔNG CỤM: mọi báo hiệu của MỘT thông báo nằm trong một khúc luồng. Điểm
    // xa tâm cụm hàng trăm km là dòng bị OCR trộn — bỏ điểm, không bỏ tin.
    let giu = [];
    if (aids.length) {
      const midLon = [...aids].sort((a, b) => a.lon - b.lon)[aids.length >> 1].lon;
      const midLat = [...aids].sort((a, b) => a.lat - b.lat)[aids.length >> 1].lat;
      giu = aids.filter((a) => {
        const xa = kmGiua(midLon, midLat, a.lon, a.lat) <= TBHH_BAN_KINH_KM;
        if (!xa) log.tbhhXaCum++;
        return xa;
      });
      if (!giu.length && !mapMo?.length) continue;
    }

    out.push({
      so, coQuan, nam, thang, viec, luong, vung, tacDung, tenChung,
      den: parseLightVN(denCau),
      url: meta.url ?? "",
      aids: giu,
      ...(mapMo ? { mapMo } : {}),
    });
  }
  return out;
}
