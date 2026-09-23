// Sinh LỚP ĐÈN BIỂN VIỆT NAM — chạy CÓ CHỦ Ý (khi có mạng):
//
//   node scripts/generate-den-bien.mjs                  # cả ba nguồn
//   node scripts/generate-den-bien.mjs --nguon enc      # chỉ cổng ENC
//   node scripts/generate-den-bien.mjs --nguon vmsa     # chỉ vmsa.vn
//   node scripts/generate-den-bien.mjs --nguon luutru   # chỉ bản lưu vms-south
//   node scripts/generate-den-bien.mjs --nguon sach     # chỉ sổ AtoN 2016 (kho ngoài repo)
//   node scripts/generate-den-bien.mjs --kho-only       # KHÔNG ra mạng, chỉ đọc kho
//
// Đầu ra: public/data/den-bien.v1.json
//
// ── VÌ SAO ĐÈN BIỂN PHẢI LÀ MỘT LỚP RIÊNG, KHÔNG GỘP VÀO `vn-aids` ────────
// Phao thì TRÔI: bị dịch, bị thu hồi, đổi số hiệu hằng tháng theo tiến độ
// công trình. Đèn biển thì ĐỨNG YÊN hàng chục năm — Kê Gà 1898, Hòn Khoai
// 1899, Long Châu 1894 — có TÊN RIÊNG, và là thứ bà con định hướng ban đêm
// khi mọi thứ khác tắt. Một cái đèn sai vị trí nguy hiểm hơn một cái phao sai:
// người ta lái THEO nó chứ không chỉ tránh nó.
//
// Vì vậy hai lớp có hai nhịp cập nhật khác nhau, hai mức tin cậy khác nhau, và
// hai cách hiển thị khác nhau. Trộn chung là để nhịp của phao kéo lùi độ tin
// của đèn.
//
// ── SỐ 0 CỦA NỬA NAM (đo 2026-09-02, xem docs/research/bao-hieu-mien-nam) ──
// Cổng ENC của Cục Hàng hải mới nhập phần Bắc–Trung Bộ: 36 đèn, cực nam là
// Vạn Ca 15,42°B. vmsa.vn (Bảo đảm an toàn hàng hải MIỀN BẮC) có 40 đèn, cực
// nam Sa Huỳnh 14,68°B. Cả hai đều DỪNG ở Quảng Ngãi — không phải vì bộ bóc
// đọc trượt mà vì địa bàn: phần từ Bình Định trở vào thuộc Bảo đảm an toàn
// hàng hải MIỀN NAM, và trang của họ (`vms-south.vn`) ĐÃ CHẾT.
//
// Nên nguồn thứ ba là BẢN LƯU TRỮ Internet Archive của vms-south.vn. Kho `cdx`
// đã nằm sẵn trên đĩa từ đợt kéo Thông báo hàng hải
// (`scripts/fetch-soundings.mjs`) — script này DÙNG LẠI, không tải lại.
//
// ── HAI CÁI BẪY ĐÃ CẮN, VÀ CỔNG CHẶN ─────────────────────────────────────
//
//  1. ĐÈN BIỂN BỊ NHẦM VỚI PHAO. Cả hai đều là "báo hiệu hàng hải". Phân biệt
//     bằng CÁI TÊN: đèn biển là công trình cố định có tên riêng ("Kê Gà",
//     "Hòn Khoai"); phao mang SỐ HIỆU ("Phao số 6", "NC1", "TC-02"). Cổng
//     `laTenDenBien()` loại mọi tên trông như số hiệu phao.
//
//  2. TOẠ ĐỘ BỊ TÁCH CHỮ. Cả ba nguồn đều ghi dấu độ bằng `<sup>o</sup>` —
//     CHỮ CÁI o dựng lên cao, không phải ký tự `°`. Gỡ thẻ HTML một cách ngây
//     thơ thì `20<sup>o</sup>37'` thành `20 o 37'`, và bộ đọc nào gom chữ số
//     sẽ ra 20°37' hoặc 2°03,7' hoặc 203,7 tuỳ cách nó gom. Đây đúng cái bẫy
//     đã cắn lớp số đo sâu (`105016'12,7"` → 10°50' thay vì 105°16').
//
//     Cổng: DỰNG LẠI `°` ngay trên HTML *trước* khi gỡ thẻ (`<sup>o</sup>` →
//     `°`, `&deg;` → `°`), rồi BẮT BUỘC chuỗi phải có ký tự `°` THẬT mới đọc.
//     Không có dấu độ = bỏ dòng, KHÔNG đoán. Cộng thêm: phút/giây < 60, và
//     điểm phải nằm trong khung biển VN.
//
//  3. (bẫy phụ, bắt được thật) HAI HỆ TOẠ ĐỘ TRÊN CÙNG TRANG. vmsa.vn và vài
//     trang ENC công bố cả VN-2000, "Hệ Hải đồ" và WGS-84 cạnh nhau. Lấy nhầm
//     cột là lệch ~200 m. Luật: có nhắc WGS thì lấy CẶP CUỐI (cột WGS-84 luôn
//     đứng cuối bảng); và mọi cặp trên cùng một trang phải cách nhau < 2 km —
//     chúng là CÙNG MỘT ĐIỂM đo bằng hai hệ, lệch hơn thế là đọc lộn cột.
//
// ── ĐẶC TÍNH ĐÈN ──────────────────────────────────────────────────────────
// Nguồn ghi bằng tiếng Việt ("Ánh sáng trắng, chớp nhóm (3+1) chu kỳ 20 giây")
// chứ không bằng mã hải đồ. Script dịch NGƯỢC về `LightInfo` của
// `src/lib/seamarks.ts` (`character` = "Fl", `group` = "3+1", `period` = 20)
// để `describeLight()` — bộ dịch DUY NHẤT của dự án — dựng câu cho bà con.
// KHÔNG viết bộ dịch thứ hai.
//
// ── GIẤY PHÉP ─────────────────────────────────────────────────────────────
// Cả ba nguồn là thông tin do cơ quan nhà nước Việt Nam công bố công khai.
// Điều 15 Luật SHTT loại "văn bản hành chính" và "số liệu" khỏi bảo hộ quyền
// tác giả. Hai `SourceId` đã đăng ký sẵn trong `src/lib/provenance.ts`:
// `vinamarine` (cổng ENC của Cục Hàng hải) và `tbhh` (vmsa.vn + kho vms-south),
// cùng `vn-official` (`redistributable: true`).
//
// ── ĐẦU RA: DẠNG GỌN (bảng tra + mảng số), cùng khuôn seamarks.v1.json ─────
//   { v, nguon, nhan, layNgay, giayPhep,
//     types[], chars[], groups[], colours[], names[], places[], years[],
//     provs[], thieu[{ten, lyDo}],
//     lights[[lon,lat,t,ch,grp,lc,per,rng,bc,nm,pl,hThap,hTam,rngNgay,ny,pv]] }
//
// CHÍN CỘT ĐẦU trùng khít thứ tự `seamarks.v1.json`, nên `decodeSeamarks()`
// đọc thẳng được file này — không đẻ kiểu dữ liệu mới. Bảy cột thêm ở cuối:
//   nm  chỉ số names[]   — tên riêng tiếng Việt ("Kê Gà"), KHÔNG kèm "Đèn biển"
//   pl  chỉ số places[]  — nơi đặt ("Bình Thuận"), -1 nếu nguồn không nói
//   hThap  chiều cao tháp đèn (m, làm tròn 0,1) · -1 = nguồn không công bố
//   hTam   chiều cao tâm sáng (m) · -1
//   rngNgay tầm hiệu lực BAN NGÀY (hải lý) · -1
//   ny  chỉ số years[]   — năm thiết lập ("1899", "Trước 1975") · -1
//   pv  chỉ số provs[]   — lý lịch nguồn (`Provenance` của provenance.ts)

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { request, Agent } from "node:https";
import { request as httpRequest } from "node:http";

/* ══ 1. CỜ DÒNG LỆNH + KHO ═════════════════════════════════════════════ */

const argOf = (ten, mac) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
};
const co = (ten) => process.argv.includes(`--${ten}`);

const NGUON = argOf("nguon", "ca");
const DUNG_ENC = NGUON === "ca" || NGUON === "enc";
const DUNG_VMSA = NGUON === "ca" || NGUON === "vmsa";
const DUNG_LUUTRU = NGUON === "ca" || NGUON === "luutru";

/** Chỉ đọc kho, KHÔNG ra mạng — chạy lại được trên máy không có internet. */
const KHO_ONLY = co("kho-only");
const KHO = argOf("kho", join(tmpdir(), "sdfish-den-bien-cache"));
/** Kho của `fetch-soundings.mjs` — chứa sẵn danh mục `cdx` của vms-south.vn. */
const KHO_SOUNDINGS = argOf("kho-tbhh", join(tmpdir(), "sdfish-soundings-cache"));

const NGHI_MS = Number(argOf("nghi", "500"));
const NGHI_LUUTRU_MS = Number(argOf("nghi-luutru", "700"));

const RA = join(process.cwd(), "public", "data", "den-bien.v1.json");
const NGAY = new Date().toISOString().slice(0, 10);

const say = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Khung biển VN (Nam, Tây, Bắc, Đông) — GIỐNG `generate-vn-aids.mjs`. */
const VN_BBOX = [4.0, 102.0, 24.0, 118.0];

const stat = {
  encTai: 0, encDoc: 0,
  vmsaTai: 0, vmsaDoc: 0,
  luutruTai: 0, luutruDoc: 0,
  boToaDo: 0, boTen: 0, boKhung: 0, boLechHe: 0,
};
/** Đèn tìm thấy tên mà KHÔNG lấy được toạ độ — báo cáo, không giấu. */
const thieu = [];

/*  Agent RIÊNG cho `enc.vinamarine.gov.vn`: chuỗi chứng thư của cổng này thiếu
    mắt xích trung gian nên Node từ chối bắt tay, trong khi `curl` (dùng kho
    chứng thư hệ thống) thì qua. KHÔNG dùng `NODE_TLS_REJECT_UNAUTHORIZED=0`:
    biến môi trường đó tắt kiểm chứng thư cho MỌI kết nối của tiến trình. */
const insecureAgent = new Agent({ rejectUnauthorized: false, keepAlive: true });
const UA = "SDFish-build/1.0 (fisherman app; lighthouse layer)";

function tai1(url) {
  return new Promise((res, rej) => {
    const dungHttp = url.startsWith("http://");
    const goi = dungHttp ? httpRequest : request;
    const opt = { headers: { "User-Agent": UA } };
    if (!dungHttp) opt.agent = insecureAgent;
    const r = goi(url, opt, (rs) => {
      // Bản lưu trữ hay trả 301/302 sang bản chụp gần nhất — đi theo.
      if (rs.statusCode >= 300 && rs.statusCode < 400 && rs.headers.location) {
        rs.resume();
        const kt = new URL(rs.headers.location, url).toString();
        return tai1(kt).then(res, rej);
      }
      if (rs.statusCode !== 200) {
        rs.resume();
        return rej(new Error(`HTTP ${rs.statusCode}`));
      }
      const c = [];
      rs.on("data", (d) => c.push(d));
      rs.on("end", () => res(Buffer.concat(c).toString("utf8")));
    });
    r.on("error", rej);
    r.setTimeout(60000, () => r.destroy(new Error("quá hạn 60 giây")));
    r.end();
  });
}

/** Tải một lần rồi giữ lại; chạy lại KHÔNG tải lại. `null` = kho chưa có. */
async function tai(loai, url, nghi = NGHI_MS) {
  const d = join(KHO, loai);
  const f = join(d, createHash("sha1").update(url).digest("hex") + ".txt");
  if (existsSync(f)) return readFileSync(f, "utf8");
  if (KHO_ONLY) return null;
  mkdirSync(d, { recursive: true });
  const v = await tai1(url);
  writeFileSync(f, v);
  await sleep(nghi);
  return v;
}

/* ══ 2. HTML → CHỮ (dựng lại ký tự độ TRƯỚC khi gỡ thẻ) ════════════════ */

const LATIN1_NAMES =
  "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml " +
  "Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times " +
  "Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc " +
  "atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc " +
  "iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute " +
  "ucirc uuml yacute thorn yuml";

const ENTITY = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°",
  prime: "'", Prime: '"', ndash: "–", mdash: "—", minus: "−",
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "’", sbquo: ",",
  hellip: "…", middot: "·", bull: "·", rarr: "→", times: "×",
};
LATIN1_NAMES.split(" ").forEach((n, i) => {
  ENTITY[n] = String.fromCodePoint(0xc0 + i);
});

function giaiThucThe(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCodePoint(parseInt(d, 16)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => ENTITY[n] ?? m);
}

/**
 * DỰNG LẠI KÝ TỰ ĐỘ — bước BẮT BUỘC, chạy trên HTML còn nguyên thẻ.
 *
 * Cả ba nguồn đều gõ dấu độ bằng chữ cái `o` (hoặc số `0`) đặt trong `<sup>`.
 * Đó là dấu độ THẬT về mặt trình bày; nó chỉ mất khi ta gỡ thẻ. Gỡ thẻ trước
 * rồi mới đọc là tự tay tạo ra lỗi "toạ độ bị tách chữ".
 */
function dungLaiDauDo(html) {
  return html
    .replace(/<sup>\s*(?:&deg;|[oO0°º])\s*<\/sup>/g, "°")
    .replace(/&deg;/g, "°")
    .replace(/º/g, "°");
}

/** HTML → các DÒNG chữ, đã giải thực thể và dựng lại dấu độ. */
function docDong(html) {
  const sach = dungLaiDauDo(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  return giaiThucThe(sach.replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((s) => s.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);
}

/* ══ 3. TOẠ ĐỘ — CỔNG DẤU ĐỘ THẬT ══════════════════════════════════════ */

/**
 * Một giá trị độ-phút-giây. BẮT BUỘC có `°`; phút và giây có thể dính dấu lạ:
 *   `10°41’42.7”N`  ·  `07° 52′ 14″ N`  ·  `11° 52′ 51″8 N`  ·  `9° 02'0 8″ N`
 * Ba kiểu sau là cách gõ thật trong nguồn, không phải lỗi — `gotPhutGiay()`
 * gột chúng. Không có `°` thì KHÔNG khớp: thà mất một đèn còn hơn vẽ sai chỗ.
 */
const DMS_RE = /(\d{1,3})\s*°\s*([\d\s.,]{1,8}?)\s*['’′]([\d\s.,"”″'’]*)/g;

/**
 * DẤU NGĂN giữa hai giá trị toạ độ liền nhau.
 *
 * Bảng ba hệ toạ độ của cổng ENC nằm trên nhiều ô `<td>`; gỡ thẻ xong chúng
 * dính thành một chuỗi: `19°59'14"7 106°10'45"6`. Phần giây của giá trị trước
 * (chữ số + khoảng trắng + dấu giây) trông y hệt phần đầu của giá trị sau, nên
 * bộ đọc sẽ nuốt luôn `106` vào ô giây rồi làm MẤT HẲN kinh độ — mà chỉ thiếu
 * kinh độ thì cả cái đèn biến mất, im lặng. Chèn một dấu ngăn ngay trước mỗi
 * cụm `<số>°` cho ô giây không thể tràn qua ranh giới.
 */
const NGAN = "\u0001";

/**
 * Gột một mảnh phút/giây. Dấu giây NẰM GIỮA hai cụm số là DẤU THẬP PHÂN —
 * nguồn gõ `51″8` nghĩa là 51,8 giây (đúng kiểu bảng toạ độ nhà nước). Dấu ở
 * cuối thì chỉ là đơn vị, bỏ. Khoảng trắng bên trong (`0 8`) là lỗi dàn trang,
 * ghép lại.
 */
function gotPhutGiay(s) {
  return String(s ?? "")
    .replace(/["”″'’′]\s*(?=\d)/g, ".")
    .replace(/["”″'’′]/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
}

/** Mọi giá trị DMS trong một đoạn chữ, theo thứ tự xuất hiện. `null` = bỏ. */
function docMoiDMS(text) {
  const out = [];
  const t = String(text ?? "").replace(/(\d{1,3}\s*°)/g, NGAN + "$1");
  DMS_RE.lastIndex = 0;
  for (const m of t.matchAll(DMS_RE)) {
    const d = Number(m[1]);
    const phut = Number(gotPhutGiay(m[2]) || "0");
    const giay = Number(gotPhutGiay(m[3]) || "0");
    if (!Number.isFinite(d) || !Number.isFinite(phut) || !Number.isFinite(giay)) continue;
    // Phút/giây ≥ 60 là lỗi chép chứ không phải toạ độ — bỏ, không sửa hộ.
    if (!(phut < 60) || !(giay < 60)) continue;
    out.push(d + phut / 60 + giay / 3600);
  }
  return out;
}

const trongKhung = (lon, lat) => {
  const [S, W, N, E] = VN_BBOX;
  return lat >= S && lat <= N && lon >= W && lon <= E;
};

/** Khoảng cách hai điểm (km) — đủ cho cổng "hai hệ toạ độ phải trùng chỗ". */
function kmGiua(aLon, aLat, bLon, bLat) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la = (aLat * Math.PI) / 180;
  const lb = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Đoạn chữ chứa bảng toạ độ → một điểm `{lon, lat}` hoặc `null`.
 *
 * Nguồn xếp các giá trị theo hàng: vĩ, kinh (VN-2000) [, vĩ, kinh (hải đồ)],
 * vĩ, kinh (WGS-84). Cột WGS-84 LUÔN đứng cuối, nên có nhắc "WGS" thì lấy cặp
 * cuối — đó là hệ bản đồ app dùng. Mọi cặp phải nằm trong 2 km của nhau: chúng
 * là CÙNG MỘT ĐIỂM đo bằng hai hệ (lệch thật giữa VN-2000 và WGS-84 ở VN chỉ
 * cỡ trăm mét). Lệch hơn = đọc lộn cột, và một điểm lộn cột trông hợp lệ hoàn
 * toàn — không có cổng này thì nó lọt hết mọi phép kiểm khác.
 */
function docDiem(text) {
  const v = docMoiDMS(text);
  if (v.length < 2) return null;

  const cap = [];
  for (let i = 0; i + 1 < v.length; i += 2) cap.push([v[i + 1], v[i]]); // [lon, lat]
  const hopLe = cap.filter(([lon, lat]) => trongKhung(lon, lat));
  if (!hopLe.length) {
    stat.boKhung++;
    return null;
  }
  for (let i = 1; i < hopLe.length; i++) {
    if (kmGiua(...hopLe[0], ...hopLe[i]) > 2) {
      stat.boLechHe++;
      return null;
    }
  }
  const wgs = /WGS\s*-?\s*84/i.test(text);
  const [lon, lat] = wgs ? hopLe[hopLe.length - 1] : hopLe[0];
  return { lon: Math.round(lon * 1e5) / 1e5, lat: Math.round(lat * 1e5) / 1e5 };
}

/* ══ 4. TÊN ĐÈN BIỂN — CỔNG "ĐỪNG NHẦM VỚI PHAO" ═══════════════════════ */

const BO_DAU = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

/** Bỏ tiền tố loại để còn TÊN RIÊNG: "Đèn biển Kê Gà" → "Kê Gà". */
function gotTen(raw) {
  return String(raw ?? "")
    //  Chỉ cắt HAI tiền tố loại. KHÔNG cắt chữ "Đèn" đứng một mình: có đèn tên
    //  thật là "Đèn báo cảng Lý Sơn", cắt đi thì còn "báo cảng Lý Sơn" — một
    //  cái tên không ai gọi và không tra ngược được.
    .replace(/^\s*(?:đ[èe]n\s*bi[ểe]n|h[ảa]i\s*đ[ăă]ng)\s+/i, "")
    .replace(/\s*[-–—(].*$/, "")
    .replace(/[.,;:]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tên này có phải TÊN ĐÈN BIỂN không — hay là số hiệu phao lọt vào.
 *
 * Đèn biển có tên riêng ("Kê Gà", "Hòn Khoai", "Song Tử Tây"); phao mang số
 * hiệu ("Phao số 6", "NC1", "TC-02", "26A"). Gộp hai thứ là hỏng đúng điều
 * lớp này hứa: một cái tên bà con nhớ được và tra lại được.
 */
function laTenDenBien(ten) {
  const t = String(ten ?? "").trim();
  if (t.length < 2 || t.length > 40) return false;
  if (/[°"'‘’“”]/.test(t)) return false; // mảnh toạ độ
  if (/\d{3,}/.test(t)) return false; // chuỗi số dài = số hiệu/toạ độ vỡ
  if (/^\d+([.,]\d+)?$/.test(t)) return false; // số trơn
  if (/\b(phao|ti[êe]u|đ[ăa]ng ti[êe]u)\b/i.test(t)) return false;
  if (/^[A-Z]{1,4}[-\s]?\d{1,3}$/i.test(t)) return false; // "NC1", "TC-02"
  if (!/[A-Za-zÀ-ỹ]/.test(t)) return false; // phải có chữ cái
  if (t.split(/\s+/).length > 6) return false; // câu văn tràn sang cột tên
  return true;
}

/** Khoá gộp giữa ba nguồn — bỏ dấu, bỏ khoảng trắng, thường hoá. */
const khoaTen = (ten) => BO_DAU(ten).toLowerCase().replace(/[^a-z0-9]/g, "");

/* ══ 5. ĐẶC TÍNH ĐÈN — TIẾNG VIỆT → `LightInfo` ════════════════════════ */

/*  Nguồn viết bằng lời ("Ánh sáng trắng, chớp nhóm (3+1) chu kỳ 20 giây"), có
    trang kèm sẵn mã hải đồ Việt ("Ch.Tr.Nh(3+1).20s"). Cả hai đều phải ra
    đúng `LightInfo` của `src/lib/seamarks.ts` thì `describeLight()` mới dựng
    được câu. Đưa chuỗi lạ vào là câu mô tả rơi mất nửa đầu — bà con đọc
    "20 giây một vòng" mà không biết chớp kiểu gì. */

/*  `\b` của JavaScript coi chữ có dấu là RANH GIỚI TỪ (nó chỉ biết [A-Za-z0-9_]),
    nên `\bđỏ\b` khớp cả trong "màuđỏ" lẫn những chỗ không mong muốn. Vì vậy dò
    bằng CHÍNH TẢ ĐẦY ĐỦ, không dựa vào ranh giới từ. Mã hải đồ Việt viết tắt
    ("Ch.Tr." = chớp trắng, "Đ" = đỏ) chỉ nhận dạng viết hoa có dấu chấm. */
const MAU_ANH = [
  [/trắng|Ch\.\s*Tr\./i, "white"],
  [/xanh\s*lục/i, "green"],
  [/đỏ/i, "red"],
  [/vàng/i, "yellow"],
];

/** "Ánh sáng trắng" → "white". Không nhận ra thì trả "" (thà im còn hơn bịa). */
function mauAnhDen(text) {
  const t = String(text ?? "");
  const m = /[áa]nh\s*s[áa]ng\s*([^,;.]{1,20})/i.exec(t);
  const doan = m ? m[1] : t;
  for (const [re, v] of MAU_ANH) if (re.test(doan)) return v;
  return "";
}

/**
 * Câu tiếng Việt → `{character, group, period}`.
 *
 *   "chớp nhóm (3+1) chu kỳ 20 giây" → Fl · "3+1" · 20
 *   "chớp đơn, chu kỳ 5s"            → Fl · —     · 5
 *   "chớp dài chu kỳ 10s"            → LFl
 *   "sáng liên tục"                  → F
 *   "sáng, ngắt nhóm (2) chu kỳ 6s"  → Oc · "2"
 */
function docDacTinh(text) {
  const t = String(text ?? "");
  const info = {};

  if (/ch[ớo]p\s*d[àa]i|\bLFl\b/i.test(t)) info.character = "LFl";
  else if (/ng[ắa]t|che\s*khu[ấa]t|\bOc\b/i.test(t)) info.character = "Oc";
  else if (/đ[ềe]u\s*nhau|\bIso\b/i.test(t)) info.character = "Iso";
  else if (/ch[ớo]p\s*nhanh|\bQ\b/.test(t)) info.character = "Q";
  else if (/ch[ớo]p|\bCh\b|\bFl\b/i.test(t)) info.character = "Fl";
  else if (/s[áa]ng\s*li[êe]n\s*t[ụu]c|\bF\b/.test(t)) info.character = "F";

  //  Nhóm chớp: "nhóm (3+1)" · "nhóm 3+1," · "Nh(2+1)" · "nhóm 3 nhịp".
  //  KHÔNG lấy số đứng ngay trước "giây"/"s" — đó là chu kỳ.
  const g =
    /nh[óo]m\s*\(?\s*(\d(?:\s*\+\s*\d)?)\s*\)?/i.exec(t) ??
    /\bNh\s*\(\s*(\d(?:\s*\+\s*\d)?)\s*\)/i.exec(t) ??
    /\(\s*(\d\s*\+\s*\d)\s*\)/.exec(t);
  if (g) info.group = g[1].replace(/\s+/g, "");

  const p = /chu\s*k[ỳyù]\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:s\b|gi[âa]y)/i.exec(t)
    ?? /(\d+(?:[.,]\d+)?)\s*s\b/i.exec(t);
  if (p) {
    const v = Number(p[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0 && v < 600) info.period = v;
  }

  const c = mauAnhDen(t);
  if (c) info.colour = c;
  return info;
}

/**
 * "27 hải lý với hệ số…" → 27. Trả `null` khi nguồn để trống.
 *
 * KHÔNG đóng bằng `\b` sau "lý": `\b` của JavaScript chỉ biết `[A-Za-z0-9_]`,
 * nên nó coi `ý` là ký tự KHÔNG PHẢI CHỮ — và giữa `ý` với khoảng trắng đứng
 * sau thì không có ranh giới nào cả. Cái `\b` đó làm mọi "hải lý" trượt sạch
 * (chỉ "HL" viết tắt còn lọt), tức là mất tầm hiệu lực của gần hết số đèn mà
 * không có lỗi nào nổi lên.
 */
function docHaiLy(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:h[ảa]i\s*l[ýy]|HL(?![A-Za-z]))/i.exec(String(text ?? ""));
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v > 0 && v < 100 ? v : null;
}

/** "110,0m (tính đến…)" → 110. Trả `null` khi không có. */
function docMet(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*m\b/i.exec(String(text ?? ""));
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v > 0 && v < 500 ? Math.round(v * 10) / 10 : null;
}

/*  Màu THÂN tháp đèn — đây là dấu hiệu BAN NGÀY, thứ bà con nhìn từ xa để
    nhận ra đúng cái đèn nào. Nguồn ghi bằng lời ("Tháp đèn khoang đỏ-trắng
    xen kẽ"), ta đổi sang mã màu mà `colourLabel()` của seamarks.ts dịch được.
    Chỉ nhận màu ĐÍCH DANH; câu không có màu nào thì để trống, không đoán. */
const MAU_THAN = [
  [/trắng/i, "white"],
  [/đỏ/i, "red"],
  [/xanh\s*(?:lục|lá)/i, "green"],
  [/vàng/i, "yellow"],
  [/đen/i, "black"],
  [/xám/i, "grey"],
];

/**
 * Chỉ lấy màu của THÁP ĐÈN, cắt ở dấu phẩy đầu tiên.
 *
 * Nguồn hay ghi hai vật trong một câu: "Tháp đèn màu trắng, công trình màu
 * vàng". Gộp cả hai thành "trắng–vàng" là mô tả một cái tháp sọc trắng vàng —
 * không có thật, và đúng thứ bà con dùng để nhận mặt cái đèn từ xa.
 */
function docMauThan(text) {
  const t = String(text ?? "").split(/[,;]/)[0];
  if (!t) return "";
  const found = [];
  //  Giữ THỨ TỰ xuất hiện trong câu: "đỏ-trắng xen kẽ" khác "trắng-đỏ" ở chỗ
  //  màu nào là khoang trên. Dò theo vị trí chứ không theo thứ tự bảng.
  for (const [re, v] of MAU_THAN) {
    const m = re.exec(t);
    if (m) found.push([m.index, v]);
  }
  return found
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(";");
}

/* ══ 6. NGUỒN A — cổng ENC của Cục Hàng hải ════════════════════════════ */

const ENC_URL = (id) => `https://enc.vinamarine.gov.vn/ChiTietDenBien.aspx?id=${id}`;
/** Trang RỖNG của cổng này dài đúng 34.050 byte — dưới ngưỡng là không có đèn. */
const ENC_RONG = 35000;
const ENC_MAX_ID = Number(argOf("enc-max", "60"));

function bocEnc(html, url, id) {
  const dong = docDong(html);
  const tenDong = dong.find((s) => /^Đ[èe]n\s*bi[ểe]n\s+\S/i.test(s));
  if (!tenDong) return null;
  const ten = gotTen(tenDong);
  if (!laTenDenBien(ten)) {
    stat.boTen++;
    return null;
  }

  //  Khối toạ độ: từ dòng nhắc "Toạ độ" tới trước "Tác dụng". Ghép cả khối
  //  chứ không đọc từng dòng — bảng ba hệ toạ độ nằm rải trên nhiều ô.
  const iToa = dong.findIndex((s) => /T[oọ][aạ]\s*độ/i.test(s));
  const iSau = dong.findIndex((s, k) => k > iToa && /T[áa]c\s*dụng/i.test(s));
  const khoi = iToa < 0 ? "" : dong.slice(iToa, iSau < 0 ? iToa + 20 : iSau).join(" ");
  const diem = docDiem(khoi);

  const line = (re) => dong.find((s) => re.test(s)) ?? "";
  //  "Vị trí:" đôi khi đứng RIÊNG một ô, câu mô tả nằm ở ô kế — nên đọc cả
  //  cụm ba dòng chứ không chỉ dòng khớp, và không quét cả trang (chân trang
  //  của cổng có địa chỉ cơ quan, sẽ dán nhầm tỉnh cho mọi cái đèn).
  const iVi = dong.findIndex((s) => /V[ịi]\s*tr[íi]\s*:/i.test(s));
  const noiDong =
    (iVi >= 0 ? dong.slice(iVi, iVi + 3).join(" ") : "") || line(/T[áa]c\s*dụng/i);
  const asDong =
    dong.find((s) => /ch[ớo]p|s[áa]ng\s*li[êe]n/i.test(s) && /\d\s*(s\b|gi[âa]y)/i.test(s)) ?? "";
  const tam = docHaiLy(line(/T[ầa]m\s*hiệu\s*lực\s*[áa]nh\s*s[áa]ng/i));

  return {
    ten,
    diem,
    noi: layTinh(noiDong),
    light: { ...docDacTinh(asDong), ...(tam ? { range: tam } : {}) },
    rngNgay: docHaiLy(line(/T[ầa]m\s*nh[ìi]n\s*địa\s*l[ýy]/i)),
    hThap: docMet(line(/Chiều\s*cao\s*to[àa]n\s*bộ/i)),
    hTam: docMet(line(/Chiều\s*cao\s*t[âa]m\s*s[áa]ng/i)),
    nam: docNam(line(/N[ăa]m\s*(?:đưa\s*v[àa]o|thiết\s*lập|x[âa]y)/i)),
    mauThan: docMauThan(line(/M[àa]u\s*s[ắa]c/i)),
    prov: {
      origin: { source: "vinamarine", at: NGAY, url },
    },
    khoa: `enc-${id}`,
  };
}

async function quetEnc() {
  say("\n── nguồn A: cổng ENC (enc.vinamarine.gov.vn)");
  const ra = [];
  for (let id = 1; id <= ENC_MAX_ID; id++) {
    let html;
    try {
      html = await tai("enc", ENC_URL(id));
    } catch (e) {
      say(`   ! id=${id}: ${e.message}`);
      continue;
    }
    if (html === null) continue;
    stat.encTai++;
    if (html.length < ENC_RONG) continue; // trang rỗng
    const d = bocEnc(html, ENC_URL(id), id);
    if (!d) continue;
    if (!d.diem) {
      stat.boToaDo++;
      thieu.push({ ten: d.ten, lyDo: "cổng ENC: có trang nhưng ô toạ độ để trống" });
      continue;
    }
    stat.encDoc++;
    ra.push(d);
  }
  say(`   tải ${stat.encTai} trang · đọc được ${ra.length} đèn`);
  return ra;
}

/** "Năm đưa vào hoạt động: 1894." → "1894"; "Trước 1975" giữ nguyên chữ. */
function docNam(text) {
  const t = String(text ?? "");
  const m = /(tr[ưu][ớo]c\s*)?(\d{4})/i.exec(t);
  if (!m) return "";
  const nam = Number(m[2]);
  if (nam < 1800 || nam > 2100) return "";
  return (m[1] ? "Trước " : "") + m[2];
}

/**
 * Câu "Vị trí"/"Tác dụng" → TÊN TỈNH. Chỉ lấy khi có chữ "tỉnh"/"thành phố"
 * đứng trước, hoặc khi câu kết bằng một địa danh sau "vùng biển". Không suy
 * diễn: nguồn không nói thì để trống.
 */
function layTinh(text) {
  const t = String(text ?? "").replace(/\s+/g, " ");
  const m =
    /(?:t[ỉi]nh|th[àa]nh\s*ph[ốo])\s+([A-ZÀ-Ỹ][^,.;]{1,24})/.exec(t) ??
    /v[ùu]ng\s*bi[ểe]n\s+([A-ZÀ-Ỹ][^,.;]{1,24})/.exec(t);
  if (!m) return "";
  const v = m[1]
    .trim()
    .replace(/\s+(thu[ộo]c|đ[ịi]nh|gi[úu]p).*$/i, "")
    //  Nguồn gõ dấu nối trong tên tỉnh ba kiểu ("Bà Rịa- Vũng Tàu",
    //  "Bà Rịa – Vũng Tàu", "Bà Rịa-Vũng Tàu"). Không gộp thì MỘT tỉnh thành
    //  ba mục trong bảng tra, và lọc theo tỉnh sẽ sót.
    .replace(/\s*[-–—]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  return v.length >= 2 && v.length <= 26 && !/\d/.test(v) ? v : "";
}

/* ══ 7. NGUỒN B — vmsa.vn (Bảo đảm an toàn hàng hải miền Bắc) ══════════ */

const VMSA_GOC = "https://vmsa.vn/bao-hieu-hang-hai-249/he-thong-den-bien-286/";
const VMSA_TRANG = [0, 20, 40, 60];

function bocVmsa(html, url) {
  const dong = docDong(html);
  const tenDong = dong.find((s) => /^Đ[èe]n\s*bi[ểe]n\s+\S/i.test(s));
  if (!tenDong) return null;
  const ten = gotTen(tenDong);
  if (!laTenDenBien(ten)) {
    stat.boTen++;
    return null;
  }

  const iToa = dong.findIndex((s) => /T[oọ][aạ]\s*độ/i.test(s));
  const iSau = dong.findIndex((s, k) => k > iToa && /T[áa]c\s*dụng/i.test(s));
  const khoi = iToa < 0 ? "" : dong.slice(iToa, iSau < 0 ? iToa + 20 : iSau).join(" ");
  const diem = docDiem(khoi);

  const line = (re) => dong.find((s) => re.test(s)) ?? "";
  const tam = line(/T[ầa]m\s*hiệu\s*lực\s*[áa]nh\s*s[áa]ng/i);
  //  KHÔNG dò theo nhãn "Đặc tính ánh sáng": trang còn một TIÊU ĐỀ MỤC cùng
  //  chữ ("b. Đặc tính ánh sáng ban đêm") đứng trước, và nó khớp trước — lấy
  //  phải nó thì mọi đèn miền Bắc mất sạch kiểu chớp mà không có lỗi nào nổi
  //  lên. Dò theo NỘI DUNG: dòng nào vừa nói kiểu chớp vừa có chu kỳ tính
  //  bằng giây thì đó mới là dòng mang dữ liệu.
  const asDong =
    dong.find(
      (s) =>
        /ch[ớo]p|s[áa]ng\s*li[êe]n\s*t[ụu]c/i.test(s) && /\d\s*(s\b|gi[âa]y)/i.test(s),
    ) ?? "";

  return {
    ten,
    diem,
    noi: layTinh(line(/V[ịi]\s*tr[íi]/i) || line(/T[áa]c\s*dụng/i)),
    light: { ...docDacTinh(asDong), ...(docHaiLy(tam) ? { range: docHaiLy(tam) } : {}) },
    rngNgay: docHaiLy(line(/T[ầa]m\s*nh[ìi]n\s*địa\s*l[ýy]/i)),
    hThap: docMet(line(/Chiều\s*cao\s*to[àa]n\s*bộ/i)),
    hTam: docMet(line(/Chiều\s*cao\s*t[âa]m\s*s[áa]ng/i)),
    nam: docNam(line(/N[ăa]m\s*(?:đưa\s*v[àa]o|thiết\s*lập|x[âa]y)/i)),
    mauThan: docMauThan(line(/M[àa]u\s*s[ắa]c/i)),
    prov: { origin: { source: "tbhh", at: NGAY, url } },
  };
}

async function quetVmsa() {
  say("\n── nguồn B: vmsa.vn (Bảo đảm an toàn hàng hải miền Bắc)");
  const duong = new Set();
  for (const p of VMSA_TRANG) {
    let html;
    try {
      html = await tai("vmsa-list", p ? `${VMSA_GOC}${p}` : VMSA_GOC);
    } catch (e) {
      say(`   ! danh sách trang ${p}: ${e.message}`);
      continue;
    }
    if (html === null) continue;
    for (const m of html.matchAll(/href="([^"]*\/den-bien-[^"]*\.html)"/gi)) {
      duong.add(new URL(m[1], VMSA_GOC).toString());
    }
  }
  say(`   ${duong.size} trang chi tiết`);

  const ra = [];
  for (const url of duong) {
    let html;
    try {
      html = await tai("vmsa", url);
    } catch (e) {
      say(`   ! ${url}: ${e.message}`);
      continue;
    }
    if (html === null) continue;
    stat.vmsaTai++;
    const d = bocVmsa(html, url);
    if (!d) continue;
    if (!d.diem) {
      stat.boToaDo++;
      thieu.push({ ten: d.ten, lyDo: "vmsa.vn: trang không có bảng toạ độ đọc được" });
      continue;
    }
    stat.vmsaDoc++;
    ra.push(d);
  }
  say(`   đọc được ${ra.length} đèn`);
  return ra;
}

/* ══ 8. NGUỒN C — bản lưu trữ vms-south.vn trong Internet Archive ══════ */

/*  Trang gốc đã chết. Bản lưu giữ nguyên khối "THÔNG SỐ CHI TIẾT" của từng
    đèn — đây là NƠI DUY NHẤT còn dữ liệu đèn biển từ Bình Định trở vào, kể cả
    Trường Sa (Song Tử Tây, Sinh Tồn, Nam Yết, An Bang, Tiên Nữ, Đá Lát, Đá
    Tây, Trường Sa Lớn) và các nhà giàn DK1 (Ba Kè, Phúc Tần, Huyền Trân,
    Quế Đường).

    Một bản chụp có thể rơi vào lúc trang đang lỗi hoặc chưa nhập thông số, nên
    với mỗi đèn ta đi từ bản MỚI NHẤT lùi dần cho tới khi lấy được toạ độ.  */

const WB_CDX_CHUNG =
  "http://web.archive.org/cdx/search/cdx?url=vms-south.vn*&output=json" +
  "&fl=timestamp,original&filter=statuscode:200&collapse=urlkey";
const WB_CDX_MOT = (duong) =>
  `http://web.archive.org/cdx/search/cdx?url=${duong}&matchType=prefix` +
  "&output=json&filter=statuscode:200&limit=40";
const HAI_DANG_RE = /he-thong-hai-dang\/([a-z0-9-]+)\/?$/;
/** Số bản chụp thử tối đa cho MỘT đèn — quá số này thì nguồn thật sự trống. */
const WB_THU_MAX = Number(argOf("luutru-thu", "6"));

/** Danh mục `cdx` đã nằm sẵn trong kho của `fetch-soundings.mjs` — dùng lại. */
async function cdxChung() {
  const f = join(
    KHO_SOUNDINGS,
    "cdx",
    createHash("sha1").update(WB_CDX_CHUNG).digest("hex") + ".txt",
  );
  if (existsSync(f)) {
    say("   dùng lại danh mục cdx có sẵn trong kho Thông báo hàng hải");
    return readFileSync(f, "utf8");
  }
  return tai("cdx", WB_CDX_CHUNG, NGHI_LUUTRU_MS);
}

function bocLuuTru(html, org, ts) {
  //  Hai đời giao diện: khối nội dung là `col1` (bản 2015–2016) hoặc `col7`
  //  (bản 2017–2018). Cùng một khuôn chữ bên trong.
  const khoi = /<div class="col[17]">([\s\S]*?)<\/div>/.exec(html);
  if (!khoi) return null;
  const h1 = /<h1 class="entry-title">([\s\S]*?)<\/h1>/.exec(html);

  const than = dungLaiDauDo(khoi[1])
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const dong = giaiThucThe(than)
    .split("\n")
    .map((s) => s.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);

  const ten = gotTen(h1 ? giaiThucThe(h1[1].replace(/<[^>]+>/g, "")) : "");
  if (!laTenDenBien(ten)) {
    if (ten) stat.boTen++;
    return null;
  }

  const line = (re) => dong.find((s) => re.test(s)) ?? "";
  //  Vài trang xuống dòng GIỮA vĩ độ và kinh độ (Thổ Chu, Dương Đông): dòng
  //  đầu chỉ có "9° 17′ 34″ N", kinh độ nằm ở dòng sau. Đọc mỗi dòng khớp thì
  //  mất luôn cả cái đèn — mà mất im lặng, vì "một giá trị" chỉ đơn giản là
  //  không đủ để thành một điểm. Lấy cả cụm ba dòng; các dòng sau đó là tầm
  //  hiệu lực tính bằng hải lý nên không có dấu độ để lẫn vào.
  //  `đ[ịạ]a` chứ không phải `địa`: trang Cù Lao Xanh gõ nhầm "Tọa độ ĐẠI dư".
  //  Một lỗi chính tả của người nhập liệu không được phép làm mất một ngọn đèn
  //  120 tuổi ở cửa ngõ Quy Nhơn.
  const iToa = dong.findIndex((s) => /T[oọ][aạ]\s*đ[ộo]\s*đ[ịạ][ai]\s*d[ưu]/i.test(s));
  const diem = iToa < 0 ? null : docDiem(dong.slice(iToa, iToa + 3).join(" "));

  const dem = line(/Ban\s*đ[êe]m/i);
  const ngay = line(/Ban\s*ng[àa]y/i);
  const chop = line(/Đ[ăặ]c\s*t[íi]nh\s*ch[ớo]p/i);
  const mauAs = line(/M[àa]u\s*s[ắa]c\s*:/i);
  const tam = docHaiLy(dem);

  return {
    ten,
    diem,
    noi: layTinh(line(/T[áa]c\s*dụng/i) || dong[0] || ""),
    light: { ...docDacTinh(`${chop} ${mauAs}`), ...(tam ? { range: tam } : {}) },
    rngNgay: docHaiLy(ngay),
    hThap: docMet(line(/Th[áa]p\s*đ[èe]n\s*:/i)),
    hTam: docMet(line(/T[âa]m\s*s[áa]ng\s*:/i)),
    nam: docNam(line(/N[ăa]m\s*thiết\s*lập/i)),
    mauThan: docMauThan(line(/M[àa]u\s*s[ắa]c\s*th[âa]n\s*đ[èe]n/i)),
    prov: {
      origin: {
        source: "tbhh",
        at: NGAY,
        version: `bản lưu ${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`,
        url: `https://web.archive.org/web/${ts}/${org}`,
      },
    },
  };
}

async function quetLuuTru() {
  say("\n── nguồn C: bản lưu trữ vms-south.vn (Internet Archive)");
  let raw;
  try {
    raw = await cdxChung();
  } catch (e) {
    say(`   ! danh mục cdx không lấy được (${e.message}) — bỏ nguồn lưu trữ`);
    return [];
  }
  if (raw === null) return [];

  let hang;
  try {
    hang = JSON.parse(raw);
  } catch {
    say("   ! danh mục cdx không phải JSON — bỏ nguồn lưu trữ");
    return [];
  }

  /*  Gom SLUG (không phải URL): cùng một đèn có nhiều biến thể đường dẫn
      (`/vi/…`, `/en/…`, cổng `:80`) — chúng là một cái đèn.

      Giữ luôn CÁC BIẾN THỂ làm bản chụp dự phòng. Danh mục cdx theo từng đèn ở
      dưới chỉ dò đúng một đường dẫn, nên đèn nào mà bản lưu chỉ còn ở nhánh
      `/vi/` hay `/en/` sẽ mất trắng — mà mất im lặng, vì "không có bản chụp
      nào" trông y hệt "nguồn không có đèn đó". */
  const slug = new Map();
  for (const [ts, org] of hang.slice(1)) {
    const m = HAI_DANG_RE.exec(String(org));
    if (!m) continue;
    if (!slug.has(m[1])) slug.set(m[1], []);
    slug.get(m[1]).push({ ts: String(ts), org: String(org) });
  }
  say(`   ${slug.size} đèn có trang trong bản lưu`);

  const ra = [];
  for (const [s, bienThe] of [...slug].sort((a, b) => a[0].localeCompare(b[0]))) {
    const duong = `vms-south.vn/hai-dang-luong-hang-hai/he-thong-hai-dang/${s}`;
    let ds = [];
    try {
      const t = await tai("cdx1", WB_CDX_MOT(duong), NGHI_LUUTRU_MS);
      if (t === null) continue;
      ds = t.trim() ? JSON.parse(t) : [];
    } catch (e) {
      say(`   ! cdx ${s}: ${e.message}`);
      continue;
    }
    //  Cột cdx mặc định: urlkey, timestamp, original, mimetype, statuscode…
    const tatCa = ds
      .slice(1)
      .filter((r) => new RegExp(`/${s}/?$`).test(String(r[2] ?? "")))
      .map((r) => ({ ts: String(r[1]), org: String(r[2]) }))
      .sort((a, b) => b.ts.localeCompare(a.ts)); // mới nhất trước

    /*  MỚI NHẤT TRƯỚC, RỒI CŨ NHẤT — hai đầu, không phải một dải.
        Bản mới thắng khi cả hai bản đều có thông số: `truong-sa-lon` bản 2013
        ghi 10°22'42"N 114°28'33"E, bản 2020 ghi 08°38'25"N 111°55'00"E, và bản
        2020 mới đúng (đảo Trường Sa Lớn ở 8°38'B 111°55'Đ).
        Nhưng đợt dựng lại trang khoảng 2019 ĐÃ GỠ hẳn khối "THÔNG SỐ CHI TIẾT"
        ở một số đèn — Kê Gà, Cù Lao Xanh — nên mọi bản từ 2019 trở đi chỉ còn
        bài giới thiệu. Dừng ở sáu bản mới nhất là mất trắng đúng những ngọn
        đèn nổi tiếng nhất mà nguồn vẫn còn giữ ở bản cũ. */
    const dau = tatCa.slice(0, WB_THU_MAX);
    const cuoi = tatCa.slice(-WB_THU_MAX).filter((b) => !dau.some((x) => x.ts === b.ts));
    const ban = [...dau, ...cuoi.reverse()];
    // …rồi mới tới các biến thể đường dẫn lấy từ danh mục chung.
    for (const b of bienThe) if (!ban.some((x) => x.ts === b.ts)) ban.push(b);

    let duoc = null;
    for (const b of ban) {
      let html;
      try {
        html = await tai(
          "wb",
          `https://web.archive.org/web/${b.ts}id_/http://${b.org.replace(/^https?:\/\//, "")}`,
          NGHI_LUUTRU_MS,
        );
      } catch {
        continue;
      }
      if (html === null) continue;
      stat.luutruTai++;
      const d = bocLuuTru(html, b.org, b.ts);
      if (d?.diem) {
        duoc = d;
        break;
      }
      if (d && !duoc) duoc = d; // giữ bản có tên để báo cáo nếu không đèn nào có toạ độ
    }
    if (!duoc) continue;
    if (!duoc.diem) {
      stat.boToaDo++;
      thieu.push({
        ten: duoc.ten,
        lyDo: `bản lưu vms-south: ${ban.length} bản chụp, không bản nào có ô toạ độ`,
      });
      continue;
    }
    stat.luutruDoc++;
    ra.push(duoc);
  }
  say(`   đọc được ${ra.length} đèn`);
  return ra;
}

/* ══ 9. GỘP BA NGUỒN ═══════════════════════════════════════════════════ */

/*  Thứ tự ưu tiên HÌNH HỌC: vmsa.vn → ENC → bản lưu.
    Không phải "trang nào đẹp hơn" mà là ĐỘ RÕ CỦA HỆ TOẠ ĐỘ: vmsa.vn công bố
    thẳng cột WGS-84 (hệ bản đồ app dùng); cổng ENC phần lớn chỉ ghi một cột
    không nói hệ; bản lưu là ảnh chụp một trang đã ngừng cập nhật từ 2018.

    Nguồn thua KHÔNG bị vứt: nó thành `crossChecks` — hai cơ quan độc lập cùng
    nói có đèn ở đó là bằng chứng mạnh nhất trong thang `confidenceOf()`.  */
const UU_TIEN = { vmsa: 3, enc: 2, luutru: 1 };

function gop(nhom) {
  const theoKhoa = new Map();
  for (const { ten: nhan, ds } of nhom) {
    for (const d of ds) {
      const k = khoaTen(d.ten);
      if (!theoKhoa.has(k)) theoKhoa.set(k, []);
      theoKhoa.get(k).push({ ...d, tuNguon: nhan });
    }
  }

  const ra = [];
  for (const [, list] of theoKhoa) {
    list.sort((a, b) => UU_TIEN[b.tuNguon] - UU_TIEN[a.tuNguon]);
    const chinh = list[0];
    const prov = { origin: chinh.prov.origin };

    const checks = [];
    for (const k of list.slice(1)) {
      if (k.prov.origin.source === chinh.prov.origin.source) continue;
      if (checks.some((c) => c.source === k.prov.origin.source)) continue;
      const m = Math.round(kmGiua(chinh.diem.lon, chinh.diem.lat, k.diem.lon, k.diem.lat) * 1000);
      //  "Đồng ý" = trong 2 km. Xa hơn thì hai nguồn đang nói về hai chỗ khác
      //  nhau (hoặc một bên chép sai) — ghi `agreed: false`, KHÔNG ghi khoảng
      //  lệch: `validateProvenance()` coi "không khớp mà vẫn có offsetM" là mâu
      //  thuẫn, và điểm tin cậy sẽ bỏ qua con số đó.
      const agreed = m <= 2000;
      checks.push({ source: k.prov.origin.source, agreed, offsetM: agreed ? m : null, at: NGAY });
    }
    if (checks.length) prov.crossChecks = checks;

    //  Trường nào nguồn chính để trống thì lấy của nguồn phụ — thà có số thật
    //  của cơ quan khác còn hơn để trống. Toạ độ thì KHÔNG trộn.
    const lay = (f) => list.map((x) => x[f]).find((v) => v != null && v !== "") ?? null;
    ra.push({
      ten: chinh.ten,
      lon: chinh.diem.lon,
      lat: chinh.diem.lat,
      noi: lay("noi") ?? "",
      light: list.map((x) => x.light).find((l) => l && Object.keys(l).length) ?? {},
      rngNgay: lay("rngNgay"),
      hThap: lay("hThap"),
      hTam: lay("hTam"),
      nam: lay("nam") ?? "",
      mauThan: lay("mauThan") ?? "",
      prov,
    });
  }
  ra.sort((a, b) => b.lat - a.lat || a.ten.localeCompare(b.ten, "vi"));
  return boTrungCho(ra);
}

/**
 * HAI ĐÈN KHÁC TÊN Ở CÙNG MỘT CHỖ — bỏ CẢ HAI.
 *
 * Hai ngọn đèn biển không thể đứng cách nhau 100 m: nếu dữ liệu nói vậy thì
 * một trong hai cái sai vị trí, và ta KHÔNG có cách nào biết cái nào.
 *
 * Đã dính thật: trang lưu 2024 của `que-duong` mang y nguyên toạ độ của
 * `ba-ke` (07°49'09,8"N 110°30'03,4"E) — nguồn chép nhầm giữa hai nhà giàn
 * DK1 nằm gần nhau. Đè bừa một cái là vẽ một ngọn đèn không có ở đó.
 *
 * Giữ cái nào cũng là đoán, nên bỏ cả hai và NÓI RA trong `thieu[]`. Một cái
 * đèn thiếu thì bà con biết là thiếu; một cái đèn sai chỗ thì bà con tin nó.
 */
function boTrungCho(ds) {
  const xoa = new Set();
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      if (kmGiua(ds[i].lon, ds[i].lat, ds[j].lon, ds[j].lat) > 0.1) continue;
      for (const k of [i, j]) {
        if (xoa.has(k)) continue;
        xoa.add(k);
        thieu.push({
          ten: ds[k].ten,
          lyDo:
            `nguồn ghi cùng toạ độ ${ds[k].lat}°B ${ds[k].lon}°Đ với đèn ` +
            `${ds[k === i ? j : i].ten} — một trong hai sai chỗ, chưa phân ` +
            "giải được nên bỏ cả hai. Ghi lại toạ độ để tra Thông báo hàng hải",
        });
      }
    }
  }
  if (xoa.size) say(`   ! bỏ ${xoa.size} đèn vì trùng chỗ với đèn khác`);
  return ds.filter((_, k) => !xoa.has(k));
}

/* ══ 9b. NGUỒN D — SỔ "LIST OF ATON SYSTEM" 2016 (VMS-South, NXB GTVT) ══
 *
 * Sổ in 50 đèn biển miền Nam kèm SỐ HIỆU DANH MỤC ĐÈN QUỐC TẾ (`F####`) —
 * nguồn giấy độc lập với cả ba nguồn web ở trên (xem
 * docs/research/san-so-dang-ky-2026-09.md §4). Vai trò của nó ở lớp này theo
 * đúng phương án ba tầng (docs/formaps/phuong-an-tu-chu-du-lieu.md §4-#2):
 *
 *   · đèn ĐÃ CÓ trong lớp (gần nhất < 2 km): sổ chỉ XÁC NHẬN — ghi một
 *     `crossCheck`, vì hai cơ quan độc lập cùng nói có đèn ở đó là bằng
 *     chứng mạnh nhất trong thang `confidenceOf()`;
 *   · đèn CHƯA CÓ: bổ sung với nguồn gốc `vms-south-aton-list`. Đèn biển
 *     đứng yên hàng chục năm nên bản 2016 tin được — khác hẳn phao luồng.
 *
 * TÊN của đèn bổ sung KHÔNG lấy từ sổ bằng máy: sổ in tiếng Anh (không dấu)
 * và bộ chữ PDF cắt vụn từ đúng chỗ có dấu ("Hòn Nước" → "Hon N uoc") — ghép
 * máy là đoán, đoán sai tên một ngọn đèn là bà con tra không ra. Tên nhập TAY
 * vào bảng `SACH_TEN` dưới đây, khoá theo `F####` (49/50 dòng sổ có số hiệu).
 */

const DUNG_SACH = NGUON === "ca" || NGUON === "sach";
const KHO_ATON = argOf("kho-aton", join(tmpdir(), "sdfish-aton-2016", "aton-aids.json"));

const SACH_REF = {
  source: "vms-south-aton-list",
  at: NGAY,
  version:
    "List of AtoN system from the South of Sa Huynh lighthouse — NXB GTVT 2016, " +
    "QĐ 211/QĐ-GTVT 24/10/2016, ISBN 978-604-76-1153-9",
  url:
    "https://web.archive.org/web/20230328024018id_/http://www.vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf",
};

/**
 * Bảng tên NHẬP TAY — chỉ cần cho đèn sổ BỔ SUNG (đèn đã khớp vị trí thì lớp
 * đang giữ sẵn tên tiếng Việt của nó). Đối chiếu ba chiều trước khi ghi:
 * chữ vụn trong sổ + toạ độ in trong sổ + số hiệu F#### (trang sổ ghi kèm).
 *
 *   F3120.7   "H o n H a i"  09°58'26,5"B 109°05'04"Đ  → Hòn Hải (đảo Hòn Hải,
 *             Phú Quý — ĐIỂM CƠ SỞ A6 đường cơ sở lãnh hải Việt Nam)
 *   F3115     "Ba Ki e m"    10°30'28"B  107°30'36"Đ   → Ba Kiềm (mũi Ba Kiềm,
 *             Bình Thuận)
 *   F2825.19  "Ba Ke"        07°52'30"B  111°44'42"Đ   → Ba Kè (nhà giàn DK1,
 *             bãi Ba Kè)
 *   F2825.194 "Que Duong"    07°49'10"B  110°30'04"Đ   → Quế Đường (nhà giàn
 *             DK1, bãi Quế Đường)
 *
 * Bốn ngọn này chính là bốn đèn cổng `boTrungCho()` đã phải bỏ vì bản lưu
 * vms-south chép NHẦM toạ độ giữa hai trang (Ba Kiềm mang toạ độ Hòn Hải,
 * Ba Kè mang toạ độ Quế Đường). Sổ giấy cho mỗi ngọn MỘT toạ độ riêng và
 * chúng khớp địa lý thật — mâu thuẫn được phân giải, khôi phục cả bốn.
 */
const SACH_TEN = {
  "F3120.7": "Hòn Hải",
  F3115: "Ba Kiềm",
  "F2825.19": "Ba Kè",
  "F2825.194": "Quế Đường",
  /*  F3060 "C u a T ie u" 10°12'34,5"B 106°36'16,3"Đ — sổ đặt đèn Cửa Tiểu
      LỆCH ~25 km so với ngọn cùng tên đang có trong lớp (từ bản lưu
      vms-south). Ghi tên vào đây để cổng cãi-nhau bên dưới NÓI RA mâu thuẫn
      thay vì im lặng bỏ; chưa phân giải được bằng nguồn thứ ba thì không thêm. */
  F3060: "Cửa Tiểu",
};

/**
 * "Fl (2+1)W 10s" (mã hải đồ trong sổ) → `LightInfo`. Bộ đọc câu tiếng Việt
 * `docDacTinh()` ở trên không đọc được mã này, và bộ đọc mã hải đồ của
 * `generate-vn-aids.mjs` không nhập được (file đó chạy ngay khi import).
 * Chỉ gột một lỗi trình bày của PDF: chữ số bị font tách rời ("1 0 s").
 */
function docDacTinhSach(text) {
  const s = String(text ?? "").replace(/(\d)[ \t]+(?=[\d.,])/g, "$1").trim();
  const m =
    /^(FL|Fl|LFl|Iso|Oc|Q|F)\s*\.?\s*(?:\(\s*([\d+A-Z ]+?)\s*\))?\s*([WRGY])?\s*(\d+(?:[.,]\d+)?)\s*s\s*$/.exec(
      s,
    );
  if (!m) return {};
  const info = { character: m[1] === "FL" ? "Fl" : m[1] };
  const grp = (m[2] ?? "").replace(/\s+/g, "");
  if (grp && grp !== "1" && grp !== "0") info.group = grp;
  const mau = { W: "white", R: "red", G: "green", Y: "yellow" }[m[3] ?? ""];
  if (mau) info.colour = mau;
  const per = Number(m[4].replace(",", "."));
  if (Number.isFinite(per) && per > 0) info.period = per;
  return info;
}

/** Gộp sổ vào danh sách đèn ĐÃ gộp ba nguồn web — sửa `ds` tại chỗ. */
function gopSach(ds) {
  if (!DUNG_SACH) return;
  if (!existsSync(KHO_ATON)) {
    say(`\n── nguồn D: sổ AtoN 2016 — ⚠️ KHÔNG có kho ở ${KHO_ATON}, bỏ nguồn này`);
    return;
  }
  let so;
  try {
    so = JSON.parse(readFileSync(KHO_ATON, "utf8"));
  } catch {
    say(`\n── nguồn D: sổ AtoN 2016 — ⚠️ kho không đọc được JSON, bỏ nguồn này`);
    return;
  }
  say("\n── nguồn D: sổ AtoN 2016 (List of AtoN System — VMS-South)");
  const den = so.filter((o) => o.loai === "light_major");

  let khop = 0;
  let them = 0;
  const lechTen = [];
  for (const o of den) {
    let best = null;
    for (const d of ds) {
      const m = kmGiua(d.lon, d.lat, o.lon, o.lat) * 1000;
      if (!best || m < best.m) best = { d, m };
    }
    if (best && best.m <= 2000) {
      // Sổ xác nhận một ngọn đã có — ghi crossCheck (một lần cho mỗi nguồn).
      const cc = (best.d.prov.crossChecks ??= []);
      if (!cc.some((c) => c.source === "vms-south-aton-list")) {
        cc.push({
          source: "vms-south-aton-list",
          agreed: true,
          offsetM: Math.round(best.m),
          at: NGAY,
        });
      }
      khop++;
      // Tên hai bên phải là CÙNG một đèn: so sau khi bỏ dấu + bỏ khoảng trắng
      // (chính phép này vô hiệu hoá vết cắt vụn "Hon N uoc" → "honnuoc").
      // Sổ hay đóng đuôi "Light"/"Lighthouse" vào tên — đó là LOẠI VẬT chứ
      // không phải tên, gột trước khi so.
      const tenSo = String(o.ten ?? "").replace(/\s*light(house)?\s*$/i, "");
      if (tenSo && khoaTen(tenSo) !== khoaTen(best.d.ten)) {
        lechTen.push(`sổ "${o.ten}" ↔ lớp "${best.d.ten}" (${Math.round(best.m)} m)`);
      }
      continue;
    }

    const ten = o.soHieuQuocTe ? SACH_TEN[o.soHieuQuocTe] : undefined;
    if (!ten) {
      // Không có tên tra tay thì KHÔNG thêm — một ngọn đèn không tên (hoặc
      // tên ghép máy từ chữ vụn) là thứ bà con không tra lại được.
      thieu.push({
        ten: o.ten?.replace(/\s+/g, " ") ?? `(số hiệu ${o.soHieuQuocTe ?? "?"})`,
        lyDo:
          `sổ AtoN 2016 có đèn ở ${o.lat.toFixed(4)}°B ${o.lon.toFixed(4)}°Đ ` +
          "không khớp ngọn nào đang có (<2 km) mà chưa có tên tiếng Việt " +
          "nhập tay trong SACH_TEN — bổ tên rồi chạy lại, không ghép máy",
      });
      continue;
    }
    if (ds.some((d) => d.ten === ten)) {
      // Cùng TÊN mà lệch chỗ >2 km: hai nguồn cãi nhau về vị trí — không đoán,
      // không thêm, nói ra. (Ca thật: "Cửa Tiểu" của sổ lệch ~25 km so với
      // bản lưu vms-south — chưa phân giải được bằng nguồn thứ ba.)
      thieu.push({
        ten: `${ten} (bản sổ AtoN 2016)`,
        lyDo:
          `sổ AtoN 2016 đặt đèn ${ten} ở ${o.lat.toFixed(4)}°B ${o.lon.toFixed(4)}°Đ, ` +
          "lệch >2 km so với ngọn cùng tên đang có trong lớp — hai nguồn cãi " +
          "nhau về vị trí, giữ bản đang có và ghi lại để tra Thông báo hàng hải",
      });
      continue;
    }
    ds.push({
      ten,
      lon: Math.round(o.lon * 1e5) / 1e5,
      lat: Math.round(o.lat * 1e5) / 1e5,
      noi: "", // sổ không ghi tỉnh — không suy diễn
      light: docDacTinhSach(o.dacTinhAS),
      rngNgay: null,
      hThap: null,
      hTam: null,
      nam: "",
      mauThan: "",
      prov: { origin: { ...SACH_REF } },
    });
    // Đèn khôi phục được thì gỡ khỏi danh sách "thiếu" của cổng trùng-chỗ —
    // để `thieu[]` chỉ còn nói về thứ THẬT SỰ đang thiếu.
    for (let i = thieu.length - 1; i >= 0; i--) {
      if (thieu[i].ten === ten) thieu.splice(i, 1);
    }
    them++;
  }
  ds.sort((a, b) => b.lat - a.lat || a.ten.localeCompare(b.ten, "vi"));
  say(`   ${den.length} đèn trong sổ · xác nhận (crossCheck) ${khop} · bổ sung ${them}`);
  if (lechTen.length) {
    say(`   ⚠️ ${lechTen.length} cặp khớp vị trí mà LỆCH TÊN — soát tay:`);
    for (const l of lechTen.slice(0, 10)) say(`      ${l}`);
  }
}

/* ══ 10. ĐÓNG GÓI + CỔNG TỰ KIỂM ═══════════════════════════════════════ */

/*  Loại: đèn biển tầm xa là `light_major`, đèn cửa/đèn cảng tầm gần là
    `light_minor`. Ranh 10 hải lý KHÔNG phải con số đẹp mà là mốc chức năng:
    dưới 10 hải lý thì cái đèn chỉ dùng để VÀO CỬA (đã nhìn thấy bờ), trên 10
    thì nó là mốc ĐỊNH HƯỚNG NGOÀI KHƠI — đúng phân biệt hải đồ vẽ hai cỡ ký
    hiệu khác nhau. Nguồn không công bố tầm thì mặc định `light_major`: đèn
    biển có tên riêng vốn là công trình lớn, hạ nó xuống nhỏ là nói giảm.  */
const RANH_MAJOR = 10;

function dongGoi(ds) {
  const types = [];
  const chars = [];
  const groups = [];
  const colours = [];
  const names = [];
  const places = [];
  const years = [];
  const provs = [];
  const idx = (bang, v) => {
    if (v == null || v === "") return -1;
    const i = bang.indexOf(v);
    return i >= 0 ? i : bang.push(v) - 1;
  };

  const lights = [];
  for (const d of ds) {
    const rng = d.light.range ?? null;
    const type = rng != null && rng < RANH_MAJOR ? "light_minor" : "light_major";
    lights.push([
      d.lon,
      d.lat,
      idx(types, type),
      idx(chars, d.light.character ?? ""),
      idx(groups, d.light.group ?? ""),
      idx(colours, d.light.colour ?? ""),
      d.light.period ?? -1,
      rng ?? -1,
      idx(colours, d.mauThan ?? ""),
      idx(names, d.ten),
      idx(places, d.noi ?? ""),
      d.hThap ?? -1,
      d.hTam ?? -1,
      d.rngNgay ?? -1,
      idx(years, d.nam ?? ""),
      provs.push(d.prov) - 1,
    ]);
  }

  return {
    v: 1,
    nguon:
      "Cục Hàng hải Việt Nam (enc.vinamarine.gov.vn) · Bảo đảm an toàn hàng hải " +
      "miền Bắc (vmsa.vn) · bản lưu trữ vms-south.vn (Internet Archive) · " +
      "List of AtoN System — Bảo đảm an toàn hàng hải miền Nam (NXB GTVT 2016)",
    nhan:
      "Tham khảo — phải đối chiếu Thông báo hàng hải trước khi dùng để lái tàu",
    layNgay: NGAY,
    giayPhep: {
      trangThai: "phát hành lại được",
      giayPhepId: "vn-official",
      ghiChu:
        "Thông tin do cơ quan nhà nước Việt Nam công bố công khai. Điều 15 " +
        "Luật Sở hữu trí tuệ loại văn bản hành chính và số liệu khỏi bảo hộ " +
        "quyền tác giả.",
    },
    types,
    chars,
    groups,
    colours,
    names,
    places,
    years,
    provs,
    thieu,
    lights,
  };
}

/** Chữ Hán/CJK — cùng dải với `scripts/audit-names.mjs`. */
const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㄯㆠ-ㆿ㈀-㏿㐀-䶿一-鿿豈-﫿︰-﹏＀-｠￠-￦]/;

function tuKiem(file, json) {
  const loi = [];
  if (!file.lights.length) loi.push("không có đèn nào — nguồn trống hoặc bóc hỏng");

  const hit = json.match(new RegExp(CJK.source, "g"));
  if (hit) loi.push(`còn ký tự Hán: ${[...new Set(hit)].join("")}`);

  for (const r of file.lights) {
    const [lon, lat] = r;
    if (!trongKhung(lon, lat)) loi.push(`ngoài khung biển VN: ${lat}, ${lon}`);
  }
  for (const n of file.names) {
    if (!laTenDenBien(n)) loi.push(`tên không phải tên đèn biển: "${n}"`);
  }
  const kb = Buffer.byteLength(json) / 1024;
  if (kb > 200) loi.push(`file ${kb.toFixed(0)} KB — quá trần 200 KB`);
  return loi;
}

/* ══ 11. CHẠY ══════════════════════════════════════════════════════════ */

async function chay() {
  const nhom = [];
  if (DUNG_VMSA) nhom.push({ ten: "vmsa", ds: await quetVmsa() });
  if (DUNG_ENC) nhom.push({ ten: "enc", ds: await quetEnc() });
  if (DUNG_LUUTRU) nhom.push({ ten: "luutru", ds: await quetLuuTru() });

  const ds = gop(nhom);
  gopSach(ds);
  const file = dongGoi(ds);
  const json = JSON.stringify(file);

  const loi = tuKiem(file, json);
  if (loi.length) {
    say("\n✗ CỔNG TỰ KIỂM CHẶN — KHÔNG ghi file:");
    for (const l of loi.slice(0, 20)) say("   • " + l);
    process.exit(1);
  }

  /*  Cổng chống xoá nhầm: ba nguồn nằm ba nơi và đều cần MẠNG. Chạy trên máy
      mất một nguồn mà vẫn ghi đè thì repo mất một mảng đèn, và mất IM LẶNG.
      Ngưỡng 20% chứ không phải 0: dao động vài cái là bình thường, cổng kêu
      bừa là cổng sẽ bị tắt. */
  if (existsSync(RA)) {
    try {
      const cu = JSON.parse(readFileSync(RA, "utf8"));
      const soCu = Array.isArray(cu.lights) ? cu.lights.length : 0;
      if (soCu && file.lights.length < soCu * 0.8) {
        say(
          `\n✗ CHẶN: file đang có ${soCu} đèn, lần chạy này chỉ ${file.lights.length}` +
            " — thiếu quá 20%. Kiểm tra nguồn nào không trả lời rồi chạy lại.",
        );
        process.exit(1);
      }
    } catch {
      // file cũ hỏng thì cứ ghi đè — không có gì để bảo vệ
    }
  }

  mkdirSync(join(process.cwd(), "public", "data"), { recursive: true });
  writeFileSync(RA, json);

  const nam15 = file.lights.filter((r) => r[1] < 15).length;
  const nam10 = file.lights.filter((r) => r[1] < 10).length;
  const duDacTinh = file.lights.filter((r) => r[3] >= 0 && r[6] > 0).length;
  say(`\n✓ ${RA}`);
  say(`  ${file.lights.length} đèn biển · ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`);
  say(`  vĩ độ: nam 10°B ${nam10} · nam 15°B ${nam15} · bắc 15°B ${file.lights.length - nam15}`);
  say(`  có đặc tính đèn (kiểu chớp + chu kỳ): ${duDacTinh}`);
  say(`  chưa lấy được toạ độ: ${thieu.length}`);
  say(
    `  bỏ vì: toạ độ trống ${stat.boToaDo} · tên hỏng ${stat.boTen} · ` +
      `ngoài khung ${stat.boKhung} · hai hệ toạ độ lệch ${stat.boLechHe}`,
  );
}

/*  CHỈ CHẠY KHI ĐƯỢC GỌI THẲNG. Bộ test nhập file này để soi ĐÚNG những cổng
    đã sinh ra dữ liệu (`docDiem`, `laTenDenBien`, `docDacTinh`) thay vì chép
    lại một bản thứ hai rồi để hai bản trôi khỏi nhau. Nếu phần chạy nằm ở
    mức ngoài cùng thì mỗi lần `npm test` sẽ kéo cả ba nguồn qua mạng và ghi
    đè dataset — không thể chấp nhận.  */
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  await chay();
}

export { docDiem, docMoiDMS, laTenDenBien, docDacTinh, docHaiLy, docMauThan, gotTen, trongKhung };
