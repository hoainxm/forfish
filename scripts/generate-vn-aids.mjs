// Sinh LỚP BÁO HIỆU HÀNG HẢI VIỆT NAM (phao · đăng tiêu · đèn luồng) từ HAI
// nguồn nhà nước công bố công khai — chạy CÓ CHỦ Ý (khi có mạng):
//   node scripts/generate-vn-aids.mjs                 # cả ba nguồn
//   node scripts/generate-vn-aids.mjs --nguon enc     # chỉ trang tuyến luồng
//   node scripts/generate-vn-aids.mjs --nguon tbhh    # chỉ Thông báo hàng hải
//   node scripts/generate-vn-aids.mjs --nguon sach    # chỉ sổ AtoN 2016 (kho ngoài repo)
//
// Đầu ra: public/data/vn-aids.v1.json
//
// ── LẤP SỐ 0 CỦA MIỀN NAM (2026-09-02) ────────────────────────────────────
// Bản trước có 437 báo hiệu NHƯNG chỉ từ 15,2°B tới 21,4°B. Nam 15°B: KHÔNG
// MỘT CÁI NÀO — mất trắng Vũng Tàu, TP.HCM, Cần Thơ, Cà Mau, Kiên Giang, Nha
// Trang, Quy Nhơn, đúng nửa nước có đội tàu đông nhất.
//
// Giả thuyết ban đầu là "bộ bóc không nhận ra bảng của trang miền Nam". ĐO
// THẬT thì KHÔNG PHẢI. Tải cả 100 ID, cắt bảng cân bằng, dò tiêu đề cột:
//
//   43 tuyến có trên trang · 21 tuyến CÓ bảng "Tên BH | Vĩ độ (N) | Kinh độ
//   (E) | Tác dụng | Đặc tính AS" · 22 tuyến KHÔNG có bảng nào chứa hai chữ
//   "Vĩ độ"/"Kinh độ" ở BẤT KỲ đâu trong HTML — kể cả bảng bọc ngoài.
//
// Khác biệt THẬT giữa trang lấy được và trang trượt nằm ở CHÍNH BẢNG TÓM TẮT
// đầu trang, và nó lộ ra hai khuôn trang khác nhau:
//
//   trang CÓ bảng báo hiệu → "Tên luồng | Thông số luồng thiết kế | Độ sâu
//                             hiện tại | Bán kính cong nhỏ nhất | Số báo hiệu"
//   trang KHÔNG có         → "Tuyến luồng | Thông số kỹ thuật | Số báo hiệu"
//
// Khuôn thứ hai CHỈ công bố CON SỐ ĐẾM ("Phao 118" cho luồng Định An) chứ
// không có chỗ nào để đặt danh sách. Và ranh giới giữa hai khuôn không phải
// ngẫu nhiên: mọi tuyến khuôn-hai đều thuộc địa bàn Bảo đảm an toàn hàng hải
// MIỀN NAM (từ Quảng Ngãi trở vào). Kiểm chéo ở một dataset khác của cùng
// cổng thông tin thì thấy y hệt: `ChiTietDenBien.aspx?id=1..200` chỉ có 36
// đèn biển, ID cao nhất là 45, đèn cực nam là Vạn Ca 15,42°B — không một đèn
// miền Nam nào; phân trang của trang danh sách đèn thì lỗi máy chủ (POST trả
// 302 về `/?aspxerrorpath=`). Nghĩa là **cổng ENC của Cục Hàng hải mới nhập
// phần miền Bắc**, không phải bộ bóc đọc trượt. Sửa regex bao nhiêu lần cũng
// không làm dữ liệu chưa nhập hiện ra.
//
// Nên muốn có miền Nam thì phải lấy ở NGUỒN KHÁC — xem "NGUỒN B" dưới đây.
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// `public/data/seamarks.v1.json` mang tên "báo hiệu vùng biển VN" nhưng nguồn
// của nó (OpenStreetMap / OpenSeaMap) CHƯA TỪNG theo dõi Việt Nam: hơn một
// nửa số điểm nằm ở Hồng Kông – Châu Giang, phần "dải bờ VN" thì dồn gần hết
// ở 21°B (Hải Phòng – Quảng Ninh), cả miền Trung chỉ vài chục điểm. Đếm ở hai
// luồng thật thì thấy rõ mức thiếu:
//
//   Luồng Định An – Cần Thơ : nhà nước công bố 118 phao · seamarks.v1.json 0
//   Luồng Hải Phòng         : nhà nước công bố 120 phao + 45 đăng tiêu · 0
//
// Đây KHÔNG phải lỗi script sinh seamarks — nguồn nó kéo về vốn không có dữ
// liệu Việt Nam. Muốn có báo hiệu thật thì phải lấy từ nơi thật sự quản lý
// chúng: Cục Hàng hải Việt Nam.
//
// ── NGUỒN ─────────────────────────────────────────────────────────────────
// `enc.vinamarine.gov.vn/ChiTietTuyenLuong.aspx?ID=<n>` — trang thông tin
// tuyến luồng hàng hải CÔNG KHAI của Cục Hàng hải Việt Nam. Mỗi tuyến có bảng
// "Hệ thống báo hiệu" gồm: Tên BH · Vĩ độ (N) · Kinh độ (E) · Tác dụng ·
// Đặc tính AS (ánh sáng) — đúng khuôn dữ liệu `Seamark` app đang dùng.
//
// ── NGUỒN B: THÔNG BÁO HÀNG HẢI (lấp miền Nam) ────────────────────────────
// Thông báo hàng hải là văn bản CÔNG BỐ của Tổng công ty Bảo đảm an toàn hàng
// hải / các Cảng vụ: mỗi lần thiết lập, dịch chuyển, đổi đặc tính, tạm ngừng
// hay thu hồi một báo hiệu đều có một thông báo, kèm BẢNG TOẠ ĐỘ VN-2000 và
// WGS-84. Repo đã có sẵn đường ống kéo kho này về (`scripts/fetch-soundings.mjs`
// cho lớp số đo sâu, `scripts/ocr-soundings.mjs` cho bản scan) và kho chữ nằm
// NGOÀI repo. Ở đây chỉ MỞ KHO ĐÓ RA ĐỌC LẠI theo một câu hỏi khác: không hỏi
// "đáy sâu bao nhiêu" mà hỏi "báo hiệu nằm ở đâu".
//
// Thông báo là SỰ KIỆN, không phải sổ đăng ký. Muốn ra được "hiện giờ có gì"
// thì phải xếp theo thời gian rồi lấy tin MỚI NHẤT cho từng báo hiệu:
//   LẬP   thiết lập mới · đưa vào hoạt động · phục hồi hoạt động   → GIỮ
//   ĐỔI   thay đổi đặc tính/vị trí · dịch chuyển · điều chỉnh      → GIỮ
//   NGƯNG tạm ngừng hoạt động (phao còn đó, đèn tắt)               → GIỮ, ghi rõ
//   GỠ    chấm dứt hoạt động · thu hồi · huỷ bỏ                    → BỎ
// Gộp "tạm ngừng" vào "gỡ" là xoá mất một phao đang nổi thật ngoài luồng;
// gộp "gỡ" vào "giữ" là vẽ một phao đã không còn. Hai lỗi ngược chiều nhau,
// nên hai nhãn phải tách.
//
// ⚠️ GIẤY PHÉP.
// Chủ dự án chốt: dữ liệu do nhà nước Việt Nam công bố công khai thì dùng lại
// được — Điều 15 Luật SHTT loại "văn bản hành chính" và "số liệu" khỏi bảo hộ
// quyền tác giả. Hai nguồn ở đây đều đã ĐĂNG KÝ trong `src/lib/provenance.ts`:
// `vinamarine` và `tbhh`, cùng giấy phép `vn-official` (`redistributable`).
//
// ⚠️ ĐỘ TƯƠI — TRANG KHÔNG GHI NGÀY CẬP NHẬT.
// Không có mốc thời gian nào trên trang, và một số tuyến có dấu hiệu lạc hậu
// so với Thông báo hàng hải. Báo hiệu bị dịch/thu hồi/đổi đặc tính đèn là
// chuyện thường. Vì vậy MỌI đối tượng mang nhãn `nhan` = "tham khảo, đối chiếu
// Thông báo hàng hải" — app KHÔNG được trình bày lớp này như hải đồ để lái tàu.
//
// ── ĐẦU RA: DẠNG GỌN (bảng tra + mảng số), cùng khuôn seamarks.v1.json ─────
//   { v, nguon, nhan, layNgay, giayPhep,
//     types[], chars[], groups[], colours[], names[], purposes[],
//     routes[{id, ten, noi, url, prov}], thieuBang[{id, ten, lyDo}],
//     marks[[lon,lat,t,ch,grp,lc,per,rng,bc,rt,nm,pp]] }
//
// Chín cột ĐẦU trùng khít thứ tự của `seamarks.v1.json`, nên
// `decodeSeamarks()` trong `src/lib/seamarks.ts` đọc thẳng được file này —
// KHÔNG đẻ kiểu dữ liệu mới. Ba cột thêm ở CUỐI (`decodeSeamarks` bỏ qua):
//   rt — chỉ số trong routes[]    (tuyến luồng — mang lý lịch nguồn)
//   nm — chỉ số trong names[]     (tên báo hiệu do nhà nước đặt: "Phao 5")
//   pp — chỉ số trong purposes[]  (tác dụng: "Báo hiệu phía phải luồng")
// `bc` (màu THÂN phao) luôn -1: nguồn KHÔNG công bố màu thân. Suy màu thân từ
// màu ánh đèn theo quy ước IALA-A là ĐOÁN — app cấm hứa thứ nguồn không có.
//
// ── NGUỒN C: SỔ "LIST OF ATON SYSTEM" 2016 (lấp nốt 22 tuyến miền Nam) ─────
// "List of AtoN system from the South of Sa Huynh lighthouse" — Tổng công ty
// Bảo đảm an toàn hàng hải miền Nam biên soạn, NXB Giao thông vận tải phát
// hành (QĐ 211/QĐ-GTVT 24/10/2016, ISBN 978-604-76-1153-9). 752 báo hiệu có
// toạ độ, phủ đúng 22 tuyến mà cổng ENC chỉ công bố CON SỐ ĐẾM (khuôn trang
// miền Nam không có chỗ đặt bảng) — xem docs/research/san-so-dang-ky-2026-09.md.
// Trang gốc vms-south.vn ĐÃ CHẾT; toàn internet còn đúng MỘT bản Wayback
// (2023-03-28). Bản chữ đã bóc để ở kho NGOÀI repo (`--kho-aton`, mặc định
// <tmp>/sdfish-aton-2016/aton-aids.json) — script này CHỈ ĐỌC, không tải.
//
// LUẬT BA TẦNG (chốt theo phương án docs/formaps/phuong-an-tu-chu-du-lieu.md §4-#2):
//   · đèn biển (light_major) KHÔNG vào lớp này — chúng đi vào den-bien.v1.json
//     (generate-den-bien.mjs, nguồn D) vì hai lớp có hai nhịp cập nhật khác nhau;
//   · phao/tiêu của sổ là NỀN — bản ghi từ nguồn A (ENC) và nguồn B (Thông báo
//     hàng hải, MỚI HƠN) ĐÈ lên khi trùng chỗ (<150 m) hoặc trùng số hiệu trên
//     cùng khúc luồng (<5 km) — sổ chốt 2016, phao đổi theo từng đợt nạo vét;
//   · mọi tuyến gốc sổ mang cờ TUỔI (`canhBaoTuoi`) để giao diện nói được
//     "vị trí theo sổ 2016", không hứa hơn cái sổ hứa.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { request } from "node:https";
import { Agent } from "node:https";
// Bộ đọc kho Thông báo hàng hải DÙNG CHUNG với scripts/osm-manh-moi.mjs —
// tách 2026-09-02, xem đầu scripts/lib/tbhh-doc.mjs (tách hàm, không chép).
import {
  VN_BBOX,
  decodeEntities,
  toNum,
  VN_COLOUR,
  kmGiua,
  docThongBao,
} from "./lib/tbhh-doc.mjs";

/** Cờ dòng lệnh: `--nguon enc|tbhh|ca` (mặc định cả hai). */
const argOf = (ten, mac) => {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
};
const NGUON = argOf("nguon", "ca");
const DUNG_ENC = NGUON === "ca" || NGUON === "enc";
const DUNG_TBHH = NGUON === "ca" || NGUON === "tbhh";
const DUNG_SACH = NGUON === "ca" || NGUON === "sach";
/** Cho phép ghi đè dù số báo hiệu GIẢM so với file đang có (xem cổng 4). */
const CHO_PHEP_GIAM = process.argv.includes("--cho-phep-giam");
/** Chạy thử: bóc + báo cáo đầy đủ nhưng KHÔNG ghi đè file. */
const THU = process.argv.includes("--thu");

const HOST = "enc.vinamarine.gov.vn";
const PAGE = (id) => `/ChiTietTuyenLuong.aspx?ID=${id}`;
const URL_OF = (id) => `https://${HOST}${PAGE(id)}`;

/** Quét ID tới đâu, và dừng sớm sau bao nhiêu ID liên tiếp không có tuyến. */
const MAX_ID = 100;
const STOP_AFTER_EMPTY = 25;
const CONCURRENCY = 4;

const ROUND = 5; // ~1 m
const BUDGET_KB = 200;

/** Ngày LẤY DỮ LIỆU, "YYYY-MM-DD" — đi vào lý lịch nguồn của từng đối tượng. */
const FETCHED_AT = new Date().toISOString().slice(0, 10);

const NHAN =
  "Tham khảo — phải đối chiếu Thông báo hàng hải trước khi dùng để lái tàu";

/* ── TẢI TRANG ────────────────────────────────────────────────────────────
 *
 * ⚠️ BỎ QUA XÁC MINH CHỨNG THƯ TLS CỦA RIÊNG HOST NÀY.
 * `enc.vinamarine.gov.vn` trả về `UNABLE_TO_VERIFY_LEAF_SIGNATURE`: máy chủ
 * KHÔNG gửi kèm chứng thư trung gian nên Node không dựng nổi chuỗi tin cậy
 * (lỗi cấu hình máy chủ, không phải chứng thư giả). Không có cách nào lấy dữ
 * liệu mà không bỏ qua bước này.
 *
 * Vì sao CHẤP NHẬN được: (a) đây là script chạy LÚC BUILD trên máy người phát
 * triển, KHÔNG chạy trong app của bà con; (b) dữ liệu lấy về là thông tin
 * CÔNG KHAI, không có gì bí mật để lộ; (c) chỉ GET, KHÔNG gửi lên bất cứ thứ
 * gì — không cookie, không thông tin đăng nhập, không dữ liệu người dùng;
 * (d) đầu ra còn phải qua ba cổng tự kiểm ở cuối file trước khi được ghi.
 *
 * Vì sao dùng Agent RIÊNG chứ không `NODE_TLS_REJECT_UNAUTHORIZED=0`: biến môi
 * trường đó tắt xác minh cho CẢ TIẾN TRÌNH — mọi kết nối khác cũng mất bảo vệ.
 * Agent này chỉ dán vào đúng những yêu cầu tới host trên.
 */
const insecureAgent = new Agent({ rejectUnauthorized: false, keepAlive: true });

function getPage(id, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: HOST,
        path: PAGE(id),
        method: "GET",
        agent: insecureAgent,
        headers: {
          "User-Agent": "SDFish-build/1.0 (fisherman app; nautical aids)",
          Accept: "text/html",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("hết giờ chờ")));
    req.on("error", reject);
    req.end();
  });
}

/** Một ô bảng → chữ thuần, đã gộp khoảng trắng. */
function cellText(html) {
  return decodeEntities(
    html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cắt các khối `<table>…</table>` CÂN BẰNG (đếm mở/đóng). Regex không lồng
 * nhau được, mà bảng báo hiệu nằm sâu trong 5–6 lớp bảng layout của trang.
 */
function tableBlocks(html) {
  const out = [];
  const open = /<table\b/gi;
  let m;
  while ((m = open.exec(html))) {
    const tag = /<\/?table\b/gi;
    tag.lastIndex = m.index;
    let depth = 0;
    let t;
    while ((t = tag.exec(html))) {
      depth += t[0][1] === "/" ? -1 : 1;
      if (depth === 0) {
        out.push(html.slice(m.index, t.index));
        break;
      }
    }
  }
  return out;
}

function tableRows(block) {
  return [...block.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) =>
    [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((td) =>
      cellText(td[1]),
    ),
  );
}

/**
 * Bảng "Hệ thống báo hiệu" của MỘT trang, đã xác định cột theo TIÊU ĐỀ (không
 * đếm cột cứng — trang do người soạn tay, thứ tự cột có thể đổi).
 * Chỉ nhận bảng LÁ (không chứa bảng con) để không bắt nhầm bảng layout bọc
 * ngoài: bảng bọc chứa đúng những dòng đó nhưng lồng thêm rác.
 */
function findAidTable(html) {
  for (const block of tableBlocks(html)) {
    if (/<table\b/i.test(block.slice(6))) continue; // còn bảng con ⇒ bảng bọc
    const rows = tableRows(block);
    const hi = rows.findIndex(
      (r) => r.some((c) => /vĩ độ/i.test(c)) && r.some((c) => /kinh độ/i.test(c)),
    );
    if (hi < 0) continue;
    const head = rows[hi];
    const col = {
      name: head.findIndex((c) => /^t[êe]n/i.test(c)),
      lat: head.findIndex((c) => /vĩ độ/i.test(c)),
      lon: head.findIndex((c) => /kinh độ/i.test(c)),
      purpose: head.findIndex((c) => /t[áa]c dụng/i.test(c)),
      light: head.findIndex((c) => /đặc t[íi]nh/i.test(c)),
    };
    if (col.lat < 0 || col.lon < 0) continue;
    return { col, rows: rows.slice(hi + 1) };
  }
  return null;
}

/* ── TOẠ ĐỘ ───────────────────────────────────────────────────────────────
 * Nguồn ghi độ-phút-giây với ba kiểu dấu giây khác nhau ("20°41'19.1\"",
 * "20°57'00.51''") và dùng cả dấu phẩy thập phân. Vài ô để trống. Có thể sau
 * này nguồn đổi sang độ thập phân → nhận CẢ HAI, và ĐỀU kiểm ở ranh giới.
 */
const DMS_RE =
  /^\s*(\d{1,3})\s*°\s*(\d{1,2})\s*['’′]\s*(?:([\d]+(?:[.,]\d+)?)\s*(?:["”″]|''|’’|′′)?)?\s*([NSEW])?\s*$/i;
const DEC_RE = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([NSEW])?\s*$/i;


/** Chuỗi toạ độ → độ thập phân, hoặc `null` khi không đọc được / vô lý. */
function parseCoord(text) {
  const s = String(text ?? "").trim();
  if (!s) return null;

  const dms = DMS_RE.exec(s);
  if (dms) {
    const d = Number(dms[1]);
    const m = Number(dms[2]);
    const sec = dms[3] ? toNum(dms[3]) : 0;
    // Phút/giây ≥ 60 là lỗi chép, KHÔNG phải toạ độ — trả null để loại + ghi log.
    if (!(m < 60) || !(sec < 60)) return null;
    const v = d + m / 60 + sec / 3600;
    if (!Number.isFinite(v)) return null;
    return /[SW]/i.test(dms[4] ?? "") ? -v : v;
  }

  const dec = DEC_RE.exec(s);
  if (dec) {
    const v = toNum(dec[1]);
    if (!Number.isFinite(v)) return null;
    return /[SW]/i.test(dec[2] ?? "") ? -Math.abs(v) : v;
  }
  return null;
}

/* ── ĐẶC TÍNH ĐÈN ─────────────────────────────────────────────────────────
 * Ánh xạ sang ĐÚNG `LightInfo` của `src/lib/seamarks.ts`: `character` phải là
 * một khoá của `CHARACTER_PHRASE` ở đó, `colour` phải là từ tiếng Anh mà
 * `colourLabel()` dịch được. Đưa chuỗi lạ vào là câu mô tả rơi mất nửa đầu —
 * bà con đọc "10 giây một vòng" mà không biết chớp kiểu gì.
 */
const LIGHT_COLOUR = { W: "white", R: "red", G: "green", Y: "yellow" };

/** Khoá HỢP LỆ của CHARACTER_PHRASE trong seamarks.ts (chỉ dùng những cái này). */
const CHARACTERS = new Set([
  "Al.Oc", "Al.Fl", "VQ+LFl", "Q+LFl", "FFl", "LFl", "Iso", "Oc",
  "VQ", "UQ", "IQ", "Mo", "Al", "Fl", "Q", "F",
]);

/**
 * Kiểu hải đồ của nguồn: "Fl(1)G.3s" · "Fl(2+1)R.10s" · "Q(6)+LFl.15s" ·
 * "Mo(A).6s" · "Fl.(2)W.5s" · "Fl(1)W.1,5s".
 * `+LFl` đứng SAU nhóm chớp (đúng chuẩn hải đồ) nhưng `parseLightString` của
 * seamarks.ts chờ nó dính liền đặc tính ("Q+LFl") → gộp lại ở đây.
 */
const CHART_RE =
  /^\s*([A-Za-z]{1,3})\s*\.?\s*(?:\(([^)]*)\))?\s*(\+\s*LFl)?\s*\.?\s*([WRGY])?\s*\.?\s*(\d+(?:[.,]\d+)?)\s*s\s*$/;


/**
 * Ô "Đặc tính AS" → `LightInfo` (rỗng = không đèn). Không đọc được thì trả
 * rỗng + báo về cho chỗ gọi ghi log — KHÔNG đoán.
 */
function parseLight(text) {
  const s = String(text ?? "").trim();
  // "-" và ô trống = báo hiệu KHÔNG đèn. Đây là dữ liệu, không phải thiếu sót.
  if (!s || s === "-" || s === "–") return { light: {}, ok: true };

  const m = CHART_RE.exec(s);
  if (m) {
    const info = {};
    let ch = m[1];
    if (m[3]) ch = `${ch}+LFl`; // "Q" + "(6)" + "+LFl" → "Q+LFl"
    let lost = "";
    if (CHARACTERS.has(ch)) info.character = ch;
    else if (CHARACTERS.has(m[1])) {
      // Bảng của seamarks.ts chỉ có "Q+LFl" và "VQ+LFl". Nguồn còn viết
      // "Fl(6)+LFl.15s" — giữ được "Fl", MẤT vế "+LFl" (một chớp dài kết thúc).
      // Không nuốt im: trả về cho chỗ gọi ghi log để người soát biết mà đối
      // chiếu Thông báo hàng hải.
      info.character = m[1];
      if (m[3]) lost = "+LFl";
    }

    const grp = (m[2] ?? "").trim();
    // Bỏ "(1)" — chuẩn hải đồ, Fl(1) ≡ Fl (một chớp), giữ lại thành "chớp 1
    // nhịp" đọc rất kỳ. Bỏ "(0)" — không phải số nhịp cũng không phải chữ
    // Morse; gần như chắc là lỗi chép của nguồn, đoán ra chữ gì là bịa.
    if (grp && grp !== "1" && grp !== "0") info.group = grp;

    const col = LIGHT_COLOUR[(m[4] ?? "").toUpperCase()];
    if (col) info.colour = col;

    const per = toNum(m[5]);
    if (Number.isFinite(per) && per > 0) info.period = per;
    return { light: info, ok: Boolean(info.character), lost };
  }

  // Câu tiếng Việt: "chớp <màu> … <n>s". Đọc được phần nào lấy phần đó.
  if (/chớp/i.test(s)) {
    const info = { character: "Fl" };
    for (const [re, name] of VN_COLOUR) if (re.test(s)) { info.colour = name; break; }
    const per = /(\d+(?:[.,]\d+)?)\s*s\b/.exec(s);
    if (per) info.period = toNum(per[1]);
    return { light: info, ok: true };
  }

  return { light: {}, ok: false };
}

/* ── LOẠI BÁO HIỆU ────────────────────────────────────────────────────────
 * Nguồn không ghi loại theo IALA; nó ghi TÁC DỤNG bằng tiếng Việt và TÊN.
 * Hai thứ đó cộng lại xác định đủ loại `SeamarkType`:
 *   • tác dụng → VAI TRÒ (mép luồng / hướng an toàn / nước sâu / nguy hiểm)
 *   • tên      → DẠNG VẬT (phao nổi · đăng tiêu cố định · đèn độc lập)
 * Phân biệt phao với đăng tiêu KHÔNG phải chuyện chữ nghĩa: nhà nước công bố
 * riêng "120 phao + 45 đăng tiêu" cho luồng Hải Phòng, và với người lái tàu
 * thì một cái trôi theo neo còn một cái đóng chết xuống đáy.
 */
const ROLE_RULES = [
  // Thứ tự CÓ Ý NGHĨA: "Báo hiệu đầu luồng" chứa chữ "luồng" nên luật mép
  // luồng phải đứng SAU cùng, nếu không nó nuốt hết.
  [/an toàn\s*(?:phía|hướng)\s*(?:bắc|nam|đông|tây)/i, "cardinal"],
  [/chướng ngại vật/i, "isolated_danger"],
  [/đầu luồng|vùng nước an toàn/i, "safe_water"],
  [/chuyên dùng|vùng quay tàu/i, "special_purpose"],
  [/luồng|bờ kênh bên|khu vực chờ tàu|chuyển hướng sang/i, "lateral"],
];

/**
 * Tên báo hiệu → dạng vật. Mặc định là phao (đa số tuyệt đối trong nguồn).
 *
 * "ĐT" (đăng tiêu) viết tắt phải xét RIÊNG và PHÂN BIỆT HOA THƯỜNG: nguồn viết
 * cả rời ("ĐT A") lẫn dính liền ("ĐTB") nên `\b` không dùng được, mà lookahead
 * `(?!\p{Ll})` thì hỏng khi đi kèm cờ `i` — cờ `i` gấp cả lớp Unicode `\p{Ll}`
 * sang chữ hoa, nên "ĐTB" bị loại oan. Luật này giữ nguyên chữ hoa của nguồn.
 */
function shapeOf(name) {
  const n = String(name ?? "").trim();
  if (/^Đ[Tt](?!\p{Ll})/u.test(n)) return "beacon";
  if (/^(?:đăng tiêu|tiêu|chập|đèn kè)/i.test(n)) return "beacon";
  if (/^đèn/i.test(n)) return "light";
  return "buoy";
}

function seamarkType(purpose, name) {
  const shape = shapeOf(name);
  const role = ROLE_RULES.find(([re]) => re.test(String(purpose ?? "")))?.[1];

  if (!role) {
    // Không đọc ra vai trò: đăng tiêu/chập tiêu → tiêu chung; đèn độc lập →
    // đèn nhỏ; phao thì "chuyên dùng" (loại KHÔNG hứa gì về mép luồng — an
    // toàn nhất khi chưa biết, xem "## Assumptions").
    return shape === "beacon" ? "beacon" : shape === "light" ? "light_minor" : "buoy_special_purpose";
  }
  if (shape === "light") return "light_minor";
  return `${shape}_${role}`;
}

/* ══ NGUỒN B — THÔNG BÁO HÀNG HẢI ══════════════════════════════════════════
 *
 * Đọc KHO CHỮ đã bóc sẵn của `scripts/ocr-soundings.mjs` (ngoài repo, mặc định
 * `<tmp>/sdfish-ocr-cache`) cùng KHO TẢI VỀ của `scripts/fetch-soundings.mjs`
 * (`<tmp>/sdfish-soundings-cache`) để lấy LÝ LỊCH của từng thông báo. Ở đây
 * KHÔNG tải gì thêm từ mạng và KHÔNG ghi gì vào hai kho đó.
 *
 * Kho vắng thì nguồn B bỏ qua — nhưng cổng 4 ở cuối file sẽ CHẶN việc ghi đè
 * một file đầy bằng một file rỗng hơn, để "chạy trên máy chưa có kho" không
 * âm thầm xoá mất nửa nước.
 */

const KHO_OCR = argOf("kho-ocr", join(tmpdir(), "sdfish-ocr-cache"));
/**
 * Kho chữ bóc từ LỚP CHỮ của PDF (`scripts/extract-tbhh-text.mjs`).
 *
 * Hai kho chữ, không phải một: `ocr-soundings.mjs` chỉ lo ẢNH SCAN, nên
 * 1.639 PDF CÓ lớp chữ trong kho chưa từng được ai đọc. Để riêng hai kho vì
 * hai bộ sai theo hai kiểu khác nhau (OCR nhầm ký tự, lớp chữ thì vỡ cột) —
 * trộn chung là mất khả năng nói "con số này đến từ đường nào".
 *
 * Thứ tự có ý nghĩa: kho OCR đứng TRƯỚC, nên file nào có ở cả hai thì bản
 * OCR (đã qua bộ gột `ocrLineToNoticeLine`, đang được dùng) thắng.
 */
const KHO_CHU = argOf("kho-chu", join(tmpdir(), "sdfish-tbhh-text"));
const KHO_TBHH = argOf("kho-tbhh", join(tmpdir(), "sdfish-soundings-cache"));
/**
 * Bản chữ đã bóc của sổ "List of AtoN System" 2016 (nguồn C) — 752 bản ghi
 * phẳng `{ten, soHieuQuocTe, lat, lon, tuyen, encId, loai, dacTinhAS, trang}`.
 * Nằm NGOÀI repo như hai kho trên; vắng thì nguồn C bỏ qua và cổng 4 chặn
 * việc ghi đè một file đầy bằng một file thiếu nguồn.
 */
const KHO_ATON = argOf("kho-aton", join(tmpdir(), "sdfish-aton-2016", "aton-aids.json"));

/** Tuổi tối đa của tin mới nhất, tính theo NĂM. */
const TBHH_TUOI_TOI_DA = 10;
/** Riêng phao CHUYÊN DÙNG (dựng cho một công trình) — hết công trình là hết phao. */
const TBHH_TUOI_CHUYEN_DUNG = 3;

/* ── BẢNG TRA ─────────────────────────────────────────────────────────────*/

/** Chuỗi → chỉ số (thêm khi chưa có) — GIỐNG generate-seamarks.mjs. */
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

const r = (v) => Number(v.toFixed(ROUND));

/* ── KÉO VỀ ───────────────────────────────────────────────────────────────*/

const NAME_RE =
  /id="ContentPlaceHolder_lblTenTuyenLuong"[^>]*>([\s\S]*?)<\/span>/i;
const PLACE_RE = /id="ContentPlaceHolder_lblDiaDiem"[^>]*>([\s\S]*?)<\/span>/i;
/** Trang ID không có tuyến vẫn trả 200 với đúng chuỗi mặc định này. */
const NO_ROUTE = /^THÔNG TIN CHI TIẾT TUYẾN LUỒNG$/i;

/**
 * Tên trang viết HOA hết ("TUYẾN LUỒNG HẢI PHÒNG") — chữ hoa toàn phần đọc
 * chậm hơn hẳn trên màn hình nhỏ. Hạ về chữ thường có hoa đầu từ, rồi hạ tiếp
 * "Luồng" trong cụm dẫn "Tuyến luồng …" cho đúng chính tả tiếng Việt (danh từ
 * chung không viết hoa) — chính trang danh sách của nguồn cũng viết như vậy.
 */
function titleCase(s) {
  return s
    .replace(/\p{Lu}[\p{Lu}\p{M}]*/gu, (w) => w[0] + w.slice(1).toLowerCase())
    .replace(/^Tuyến Luồng\b/, "Tuyến luồng");
}

async function fetchRoute(id) {
  let html;
  try {
    html = await getPage(id);
  } catch (e) {
    return { id, error: e.message };
  }
  const ten = cellText(NAME_RE.exec(html)?.[1] ?? "");
  if (!ten || NO_ROUTE.test(ten)) return { id, empty: true };
  const noi = cellText(PLACE_RE.exec(html)?.[1] ?? "");
  return { id, ten: titleCase(ten), noi, table: findAidTable(html) };
}

const found = [];
let emptyStreak = 0;
if (DUNG_ENC) console.log(`Quét ID 1..${MAX_ID} trên ${HOST} …`);
for (let base = 1; DUNG_ENC && base <= MAX_ID; base += CONCURRENCY) {
  const batch = [];
  for (let i = base; i < base + CONCURRENCY && i <= MAX_ID; i++) batch.push(i);
  const res = await Promise.all(batch.map(fetchRoute));
  for (const it of res) {
    if (it.error) console.warn(`  ID ${it.id}: ${it.error}`);
    if (it.empty || it.error) emptyStreak++;
    else {
      emptyStreak = 0;
      found.push(it);
    }
  }
  // "Tới khi hết": ID trống rải rác giữa chừng là bình thường (bản ghi đã xoá),
  // nên chỉ dừng khi trống LIÊN TIẾP đủ dài.
  if (emptyStreak >= STOP_AFTER_EMPTY) {
    console.log(`  dừng ở ID ${base + CONCURRENCY - 1}: ${emptyStreak} ID trống liên tiếp`);
    break;
  }
}

if (DUNG_ENC && !found.length) {
  console.warn("⚠️ Không lấy được tuyến nào — KHÔNG ghi đè file cũ. Chạy lại khi có mạng.");
  process.exit(0);
}

/* ── CHUẨN HOÁ ────────────────────────────────────────────────────────────*/

const types = interner();
const chars = interner();
const groups = interner();
const colours = interner();
const names = interner();
const purposes = interner();

const routes = [];
const thieuBang = [];
const marks = [];
const tally = {};
const log = {
  badCoord: [], outOfFrame: [], badLight: [], noRole: [], dupInRoute: [], lostPart: [],
  sectionRow: 0,
  tbhhKhoVang: "", tbhhKhoHong: 0, tbhhKhongRoViec: 0, tbhhDongLoan: 0, tbhhXaCum: 0,
  tbhhGo: 0, tbhhQuaCu: 0, tbhhTrungEnc: 0, tbhhTrungNhau: 0, tbhhKhongTen: 0,
  tbhhKhongPhaiBaoHieu: 0, tbhhKhongCoBang: 0, tbhhMapMo: 0, tbhhTheoDuong: {},
  sachKhoVang: "", sachDen: 0, sachTrungCho: 0, sachTrungTen: 0, sachXaCum: 0,
  sachLoaiLa: 0, sachKhongTen: 0, sachTenHong: 0, sachTenKhacTuyen: 0,
  sachTenKhacTuyenDs: [],
  xmKhoVang: "", xmTrungCho: 0, xmTrungTenCungTuyen: 0, xmTenKhacTuyen: 0,
  xmMoCoi: 0, xmNgoaiKhung: 0,
};

for (const rt of found) {
  if (!rt.table) {
    // TRANG CÓ, BẢNG KHÔNG — ghi rõ VÌ SAO, không im lặng. Đo thật 2026-09-02:
    // 22 tuyến này dùng khuôn trang "Tuyến luồng | Thông số kỹ thuật | Số báo
    // hiệu", khuôn chỉ có ô ĐẾM chứ không có chỗ đặt danh sách báo hiệu.
    thieuBang.push({
      id: rt.id,
      ten: rt.ten,
      lyDo:
        "trang dùng khuôn chỉ công bố SỐ ĐẾM báo hiệu (Tuyến luồng · Thông số " +
        "kỹ thuật · Số báo hiệu) — không có bảng toạ độ nào trong HTML",
    });
    continue;
  }
  const rtIdx = routes.length;
  const rows = [];
  // Bảng của nguồn chia theo ĐOẠN luồng, và báo hiệu nằm ở chỗ giáp hai đoạn
  // được liệt kê ở CẢ HAI đoạn — cùng toạ độ, cùng đèn, chỉ khác cách viết tên
  // ("Phao 25" ở đoạn Bạch Đằng = "Phao số 25" ở đoạn Kênh Hà Nam). Giữ cả hai
  // là chồng hai chấm lên nhau trên bản đồ và đếm sai số phao của luồng.
  const seenAt = new Set();

  for (const cells of rt.table.rows) {
    const { col } = rt.table;
    // Dòng tiêu đề đoạn luồng ("Đoạn Lạch Huyện") gộp hết bề ngang bằng
    // colspan ⇒ chỉ có 1 ô. Dòng trắng ngăn cách thì đủ ô nhưng rỗng cả.
    // Cả hai đều KHÔNG phải báo hiệu thiếu toạ độ — đừng để chúng làm ồn
    // danh sách "toạ độ không đọc được", chỗ đó phải chỉ còn lỗi thật.
    if (cells.length < 3 || cells.every((c) => !c)) {
      log.sectionRow++;
      continue;
    }
    const at = (i) => (i >= 0 && i < cells.length ? cells[i] : "");
    const name = at(col.name);
    const latRaw = at(col.lat);
    const lonRaw = at(col.lon);
    const purpose = at(col.purpose);
    const lightRaw = at(col.light);

    const lat = parseCoord(latRaw);
    const lon = parseCoord(lonRaw);
    if (lat === null || lon === null) {
      log.badCoord.push(`${rt.ten} · ${name || "(không tên)"} [${latRaw}|${lonRaw}]`);
      continue;
    }
    const [S, W, N, E] = VN_BBOX;
    if (lat < S || lat > N || lon < W || lon > E) {
      log.outOfFrame.push(`${rt.ten} · ${name} [${lon},${lat}]`);
      continue;
    }

    const { light, ok, lost } = parseLight(lightRaw);
    if (!ok) log.badLight.push(`${rt.ten} · ${name} · "${lightRaw}"`);
    else if (lost) {
      log.lostPart.push(`${rt.ten} · ${name} · "${lightRaw}" (mất "${lost}")`);
    }

    const where = `${r(lon)},${r(lat)}`;
    if (seenAt.has(where)) {
      log.dupInRoute.push(`${rt.ten} · ${name} [${where}]`);
      continue;
    }
    seenAt.add(where);

    const type = seamarkType(purpose, name);
    if (type === "buoy_special_purpose" && !/chuyên dùng|vùng quay tàu/i.test(purpose)) {
      log.noRole.push(`${rt.ten} · ${name} · "${purpose}"`);
    }
    tally[type] = (tally[type] ?? 0) + 1;

    rows.push([
      r(lon),
      r(lat),
      types.idx(type),
      chars.idx(light.character),
      groups.idx(light.group),
      colours.idx(light.colour),
      light.period ?? 0,
      0, // tầm hiệu lực: nguồn KHÔNG công bố
      -1, // màu thân phao: nguồn KHÔNG công bố (xem đầu file)
      rtIdx,
      names.idx(name),
      purposes.idx(purpose),
    ]);
  }

  if (!rows.length) {
    thieuBang.push({
      id: rt.id,
      ten: rt.ten,
      lyDo: "có bảng toạ độ nhưng không dòng nào đọc ra được toạ độ hợp lệ",
    });
    continue;
  }

  routes.push({
    id: rt.id,
    ten: rt.ten,
    noi: rt.noi,
    so: rows.length,
    // LÝ LỊCH NGUỒN theo schema `Provenance` của src/lib/provenance.ts.
    // Mọi báo hiệu của tuyến trỏ về đây qua cột `rt` — mỗi đối tượng biết mình
    // lấy ở đâu, ngày nào, từ URL nào, chạy lại được.
    prov: {
      origin: {
        source: "vinamarine",
        at: FETCHED_AT,
        url: URL_OF(rt.id),
      },
    },
  });
  marks.push(...rows);
}

/* ── GỘP NGUỒN B ──────────────────────────────────────────────────────────
 *
 * Thông báo hàng hải là SỰ KIỆN. Muốn ra "hiện giờ có gì" thì:
 *   1. gom mọi tin nói về CÙNG một báo hiệu (khoá = tên + luồng, hoặc = vị trí
 *      khi tin không ghi rõ tên);
 *   2. xếp theo thời gian, lấy tin MỚI NHẤT;
 *   3. tin mới nhất là "GỠ" ⇒ báo hiệu đó không còn, KHÔNG vẽ.
 */
const tbhhList = DUNG_TBHH ? docThongBao(log, { khoOcr: KHO_OCR, khoChu: KHO_CHU, khoTbhh: KHO_TBHH }) : [];
const NAM_NAY = Number(FETCHED_AT.slice(0, 4));
const encO = marks.map((m) => [m[0], m[1]]); // vị trí đã có từ nguồn A

if (tbhhList.length) {
  // Mới nhất đứng SAU để ghi đè bản cũ trong bảng `soTay`.
  tbhhList.sort((a, b) => (a.nam ?? 0) - (b.nam ?? 0) || (a.thang ?? 0) - (b.thang ?? 0));
  const soTay = new Map();
  for (const tb of tbhhList) {
    for (const a of tb.aids) {
      // Khoá theo TÊN + LUỒNG khi có tên; không có tên thì theo VỊ TRÍ làm tròn
      // ~100 m — hai cách đều ổn định qua nhiều lần thông báo của cùng một phao.
      const key = a.ten
        ? `n:${a.ten.toLowerCase()}|${tb.luong.toLowerCase()}`
        : `v:${a.lon.toFixed(3)},${a.lat.toFixed(3)}`;
      soTay.set(key, { tb, a });
    }
  }

  const chuyenDung = (s) => /chuy[êe]n d[ùu]ng/i.test(String(s));
  const theoTin = new Map(); // tin → các báo hiệu còn hiệu lực của nó
  for (const { tb, a } of soTay.values()) {
    if (tb.viec === "GỠ") {
      log.tbhhGo++;
      continue;
    }
    const tuoi = tb.nam ? NAM_NAY - tb.nam : 99;
    const tran = chuyenDung(`${tb.tenChung} ${tb.tacDung}`)
      ? TBHH_TUOI_CHUYEN_DUNG
      : TBHH_TUOI_TOI_DA;
    if (tuoi > tran) {
      log.tbhhQuaCu++;
      continue;
    }
    // Nguồn A là bảng đăng ký chính thức của tuyến; trùng chỗ thì để nó thắng.
    if (encO.some(([lo, la]) => kmGiua(lo, la, a.lon, a.lat) < 0.15)) {
      log.tbhhTrungEnc++;
      continue;
    }
    if (!a.ten) log.tbhhKhongTen++;
    if (!theoTin.has(tb)) theoTin.set(tb, []);
    theoTin.get(tb).push(a);
  }

  const daDat = new Set();
  for (const [tb, aids] of theoTin) {
    const rtIdx = routes.length;
    const rows = [];
    for (const a of aids) {
      const where = `${r(a.lon)},${r(a.lat)}`;
      if (daDat.has(where)) {
        log.tbhhTrungNhau++;
        continue;
      }
      daDat.add(where);
      // Tên do nhà nước đặt là ĐỊNH DANH, không được bịa. Không đọc ra thì nói
      // thẳng "chưa rõ số hiệu" — bà con đọc nhãn đó biết mà đối chiếu tiếp.
      const ten = a.ten || "Báo hiệu (chưa rõ số hiệu)";
      const type = seamarkType(tb.tacDung, ten);
      if (type === "buoy_special_purpose" && !/chuyên dùng|vùng quay tàu/i.test(tb.tacDung)) {
        log.noRole.push(`${tb.luong || tb.vung} · ${ten} · "${tb.tacDung}"`);
      }
      tally[type] = (tally[type] ?? 0) + 1;
      rows.push([
        r(a.lon),
        r(a.lat),
        types.idx(type),
        chars.idx(tb.den.character),
        groups.idx(tb.den.group),
        colours.idx(tb.den.colour),
        tb.den.period ?? 0,
        0,
        -1,
        rtIdx,
        names.idx(ten),
        purposes.idx(tb.tacDung),
      ]);
    }
    if (!rows.length) continue;
    const so = tb.so && tb.coQuan ? `${tb.so}/TBHH-${tb.coQuan}` : (tb.so || tb.coQuan || "");
    routes.push({
      // Không gian tên RIÊNG: `id` của nguồn A là số ID trang ENC, trộn chung
      // sẽ đụng nhau (tuyến ENC #21 và tin TBHH thứ 21) và làm hỏng phép kiểm
      // "tuyến trong thieuBang không được có mặt trong routes".
      id: `tbhh-${rtIdx}`,
      ten: tb.luong || tb.vung || "Thông báo hàng hải",
      noi: tb.vung,
      so: rows.length,
      // Nhãn TRẠNG THÁI đi kèm tuyến, không đi kèm từng phao: cả tin nói về
      // cùng một việc. "NGƯNG" = phao còn nổi nhưng đèn/chức năng đang tắt.
      tinhTrang: tb.viec,
      prov: {
        origin: {
          source: "tbhh",
          at: FETCHED_AT,
          ...(so ? { version: so } : {}),
          ...(tb.url ? { url: tb.url } : {}),
        },
      },
    });
    marks.push(...rows);
  }
}

/* ══ GỘP NGUỒN C — SỔ ATON 2016 LÀM NỀN, NGUỒN MỚI HƠN ĐÈ ═════════════════
 *
 * Thứ tự gộp CÓ Ý NGHĨA: nguồn C chạy SAU CÙNG nên mọi chỗ nguồn A (sổ đăng
 * ký ENC) hoặc nguồn B (Thông báo hàng hải — MỚI HƠN sổ) đã có báo hiệu thì
 * bản ghi 2016 của sổ tự động nhường. Hai luật nhường:
 *   · trùng CHỖ  — cách một báo hiệu đang có < 150 m (cùng ngưỡng B nhường A);
 *   · trùng SỐ HIỆU — cùng tên ("Phao 5") với một báo hiệu đang có trong
 *     vòng 5 km (cùng khúc luồng; phao bị dịch theo nạo vét vẫn là phao đó).
 * Sổ chỉ LẤP CHỖ TRỐNG — đúng vai của một bản nền 2016.
 */

/** Lý lịch chung của mọi tuyến gốc sổ — tra ngược được tới bản Wayback duy nhất. */
const SACH_REF = {
  source: "vms-south-aton-list",
  at: FETCHED_AT,
  version:
    "List of AtoN system from the South of Sa Huynh lighthouse — NXB GTVT 2016, " +
    "QĐ 211/QĐ-GTVT 24/10/2016, ISBN 978-604-76-1153-9",
  url:
    "https://web.archive.org/web/20230328024018id_/http://www.vms-south.vn/wp-content/uploads/2017/02/List-of-AtoN-System.pdf",
};

/** Cờ TUỔI — đi kèm TỪNG tuyến gốc sổ, giao diện đọc để nói "vị trí theo sổ 2016". */
const SACH_CANH_BAO_TUOI =
  "Vị trí theo sổ 2016 — phao luồng đổi theo từng đợt nạo vét, " +
  "đối chiếu Thông báo hàng hải mới hơn trước khi tin";

/**
 * `loai` của bộ bóc sổ → [SeamarkType, câu Tác dụng]. Bên luồng KHÔNG nằm ở
 * `types` (chỉ có `buoy_lateral`) mà nằm ở `purposes` — đúng khuôn nguồn A,
 * và ba câu dưới đây trùng khít từ vựng purposes đang có, KHÔNG đẻ câu mới.
 */
const SACH_LOAI = {
  buoy_lateral_port: ["buoy_lateral", "Báo hiệu phía trái luồng"],
  buoy_lateral_starboard: ["buoy_lateral", "Báo hiệu phía phải luồng"],
  buoy_safe_water: ["buoy_safe_water", "Báo hiệu đầu luồng"],
};

/**
 * Tên trong sổ là TIẾNG ANH ("Buoy no. 68") → đổi về đúng từ vựng tiếng Việt
 * đang dùng ("Phao 68"), KHÔNG đẻ từ vựng thứ hai. Tên không mang số hiệu
 * ("Buoy", "Signpost", "Approach") trả `null` — chỗ gọi dán nhãn "chưa rõ số
 * hiệu" thay vì bịa. Số hiệu thật ("Phao QG151", "B002 SĐT") giữ nguyên văn.
 */
function tenVietSach(t) {
  if (!t) return null;
  let s = String(t).replace(/\s+/g, " ").trim();
  // "Fornt." là lỗi in của chính sổ (trang Đồng Tranh) — sửa CÁCH VIẾT về
  // "Front" trước khi dịch, không phải đặt lại tên.
  s = s.replace(/^Fornt\b\.?/i, "Front");
  let m;
  if ((m = /^(Buoy|Beacon)[.,]?\s*(.*)$/i.exec(s))) {
    const loai = /^buoy/i.test(m[1]) ? "Phao" : "Tiêu";
    let rest = m[2].trim();
    /*  "no." chỉ là CHỮ ĐỆM khi đứng trước một mã số ("no. 7", "no. CT1") —
        cắt đi cho tên về đúng số hiệu. Nhưng "Beacon, North" cũng bắt đầu
        bằng "No": nuốt mù thì tên thành "Tiêu rth" — rác đã lọt ra bản phát
        một lần (phân xử 2026-09-02 bắt được khi soát ca An Thới). Nên chỉ cắt
        khi phần sau là mã thật: chữ số, hoặc cụm chữ HOA + chữ số ("CT1") —
        phép thử này CỐ Ý không mang cờ /i, chữ thường ("rth") phải trượt. */
    const n = /^no\.?\s*(.*)$/i.exec(rest);
    if (n && /^[A-ZĐ]{0,3}\d/.test(n[1])) rest = n[1].trim();
    return rest ? `${loai} ${rest}` : null;
  }
  if ((m = /^Front[.,]?\s*(?:Ldg\.?\s*Lts?\.?)?\s*(.*)$/i.exec(s)))
    return `Tiêu trước${m[1].trim() ? ` ${m[1].trim()}` : ""}`;
  if ((m = /^Rear[.,]?\s*(?:Ldg\.?\s*Lts?\.?)?\s*(.*)$/i.exec(s)))
    return `Tiêu sau${m[1].trim() ? ` ${m[1].trim()}` : ""}`;
  // "Signpost"/"Approach" là LOẠI VẬT, không phải số hiệu — không dịch thành
  // một cái tên trông-như-định-danh.
  if (/^(Signpost|Approach)$/i.test(s)) return null;
  return s;
}

/* ══ NGUỒN E — MANH MỐI OSM ĐÃ XÁC MINH ĐỘC LẬP ═══════════════════════════
 *
 * `scripts/osm-manh-moi.mjs` dùng OSM (ODbL) làm MANH MỐI ĐI TÌM rồi xác minh
 * từng ứng viên bằng nguồn độc lập không-ODbL (kho Thông báo hàng hải, sổ AtoN
 * 2016) — đúng quy trình docs/formaps/phuong-an-tu-chu-du-lieu.md §1-#3. Kho
 * `xac-minh.json` (ngoài repo, như kho sổ) chỉ chứa mục ĐÃ xác minh: toạ độ,
 * tên, đặc tính đều CỦA NGUỒN XÁC MINH; OSM chỉ còn lại một dòng
 * `crossChecks {source:"osm", agreed:true}` — ghi nhận "OSM cũng thấy",
 * không phải "lấy từ OSM". Chuỗi dẫn xuất ODbL đứt tại đây.
 *
 * Chạy TRƯỚC nguồn C (đổi chỗ 2026-09-02, đợt phân xử trùng-tên): mục ở đây
 * qua xác minh KÉP (nguồn nhà nước + OSM đồng thuận vị trí) nên mang lý lịch
 * giàu hơn bản sổ trơn — đặt nó xuống trước, rồi để cổng trùng-chỗ của nguồn
 * C tự nhường (<150 m). Để E chạy sau thì chính bản sổ của cùng cái phao vào
 * trước và E bị nhường ngược — mục xác minh kép biến mất khỏi lớp im lặng
 * (test "nguồn E … có mặt" từng đỏ đúng vì vậy).
 *
 * Luật trùng-số-hiệu: <5 km CÙNG tuyến thì chặn; KHÁC tuyến thì không —
 * án lệ "Phao 1": sổ 2016 ghi Phao 1 luồng Sài Gòn – Vũng Tàu, cổng cũ vứt vì
 * Phao 1 luồng Sông Dinh đứng cách 3,4 km, nhưng đó là HAI vật thật của hai
 * luồng khác nhau. Luật này nay áp cho CẢ nguồn C (quyết định chủ dự án
 * 2026-09-02 — xem docs/research/gop-so-aton-2026-09.md, mục phân xử).
 */
const KHO_XM = argOf("kho-xm", join(tmpdir(), "sdfish-osm-manh-moi", "xac-minh.json"));
const DUNG_XM = NGUON === "ca" || NGUON === "xm";

/** Tên tuyến → khoá so sánh: bỏ tiền tố "Luồng (hàng hải)/Tuyến", bỏ dấu câu. */
const khoaTuyen = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/^(luồng|tuyến)\s*(hàng hải|luồng)?/i, "")
    .replace(/[^0-9a-zà-ỹ]+/gi, "");

if (DUNG_XM) {
  let khoXm = null;
  if (!existsSync(KHO_XM)) {
    log.xmKhoVang = KHO_XM;
  } else {
    try {
      khoXm = JSON.parse(readFileSync(KHO_XM, "utf8"));
    } catch {
      log.xmKhoVang = `${KHO_XM} (không đọc được JSON)`;
    }
  }

  const choDaCoXm = marks.map((m) => [m[0], m[1]]);
  // tên đã có, kèm KHOÁ TUYẾN của nó — để luật trùng-số-hiệu phân biệt được
  // "cùng tuyến" (chặn) với "khác tuyến" (cho qua, có OSM làm chứng).
  const tenDaCoXm = new Map();
  for (const m of marks) {
    const t = names.list[m[10]];
    if (!t || /chưa rõ số hiệu/i.test(t)) continue;
    const k = t.toLowerCase();
    if (!tenDaCoXm.has(k)) tenDaCoXm.set(k, []);
    tenDaCoXm.get(k).push({ lon: m[0], lat: m[1], tuyen: khoaTuyen(routes[m[9]]?.ten) });
  }

  // gom theo (đường xác minh + văn bản/sổ + tuyến) — mỗi nhóm một tuyến prov
  const nhomXm = new Map();
  for (const rec of khoXm?.records ?? []) {
    const key = `${rec.duong}|${rec.nguon?.url ?? rec.nguon?.version ?? ""}|${rec.tuyen}`;
    if (!nhomXm.has(key)) nhomXm.set(key, []);
    nhomXm.get(key).push(rec);
  }

  for (const arr of nhomXm.values()) {
    const rtIdx = routes.length;
    const rows = [];
    let lechMax = 0;
    for (const rec of arr) {
      const [S, W, N, E] = VN_BBOX;
      if (rec.lat < S || rec.lat > N || rec.lon < W || rec.lon > E) {
        log.xmNgoaiKhung++;
        continue;
      }
      if (choDaCoXm.some(([lo, la]) => kmGiua(lo, la, rec.lon, rec.lat) < 0.15)) {
        log.xmTrungCho++;
        continue;
      }
      // mồ côi: không một báo hiệu nào (mọi nguồn) trong 15 km — cùng ngưỡng
      // láng giềng của nguồn C; một mục xác minh đứng giữa hư không vẫn đáng ngờ.
      if (!choDaCoXm.some(([lo, la]) => kmGiua(lo, la, rec.lon, rec.lat) <= 15)) {
        log.xmMoCoi++;
        continue;
      }

      let ten, type, purpose, light;
      if (rec.duong === "aton") {
        ten = tenVietSach(rec.tenGocSach);
        if (ten && (/[°′″]/.test(ten) || /\d{4}/.test(ten))) ten = null;
        [type, purpose] = SACH_LOAI[rec.loaiSach] ?? ["buoy_special_purpose", null];
        if (/^(Beacon|Front|Rear|Fornt|Signpost)\b/i.test(rec.tenGocSach ?? "")) {
          type = type === "buoy_lateral" ? "beacon_lateral" : "beacon";
          if (/^(Front|Rear|Fornt)\b/i.test(rec.tenGocSach ?? ""))
            purpose ??= "Tiêu dẫn luồng (chập tiêu)";
        }
        const asGon = String(rec.dacTinhAS ?? "")
          .replace(/(\d)[ \t]+(?=[\d.,])/g, "$1")
          .replace(/^\s*FL\b/, "Fl")
          .trim();
        ({ light } = parseLight(asGon));
      } else {
        ten = rec.ten || null;
        type = seamarkType(rec.tacDung, ten ?? "");
        purpose = rec.tacDung || null;
        light = rec.den ?? {};
      }

      // luật trùng-số-hiệu: CÙNG tuyến + <5 km = cùng vật, nhường như cũ.
      if (ten) {
        const trung = (tenDaCoXm.get(ten.toLowerCase()) ?? []).filter(
          (x) => kmGiua(x.lon, x.lat, rec.lon, rec.lat) < 5,
        );
        if (trung.some((x) => x.tuyen === khoaTuyen(rec.tuyen))) {
          log.xmTrungTenCungTuyen++;
          continue;
        }
        if (trung.length) log.xmTenKhacTuyen++;
      }

      tally[type] = (tally[type] ?? 0) + 1;
      lechMax = Math.max(lechMax, rec.lechM ?? 0);
      rows.push([
        r(rec.lon),
        r(rec.lat),
        types.idx(type),
        chars.idx(light?.character),
        groups.idx(light?.group),
        colours.idx(light?.colour),
        light?.period ?? 0,
        0,
        -1,
        rtIdx,
        names.idx(ten ?? "Báo hiệu (chưa rõ số hiệu)"),
        purposes.idx(purpose),
      ]);
      choDaCoXm.push([rec.lon, rec.lat]);
      if (ten) {
        const k = ten.toLowerCase();
        if (!tenDaCoXm.has(k)) tenDaCoXm.set(k, []);
        tenDaCoXm.get(k).push({ lon: rec.lon, lat: rec.lat, tuyen: khoaTuyen(rec.tuyen) });
      }
    }
    if (!rows.length) continue;

    const mau = arr[0];
    routes.push({
      id: `xm-${rtIdx}`,
      ten: /^(Luồng|Tuyến|Thông báo)/i.test(mau.tuyen) ? mau.tuyen : `Luồng hàng hải ${mau.tuyen}`,
      noi: "",
      so: rows.length,
      ...(mau.encId ? { encId: mau.encId } : {}),
      // tin Thông báo hàng hải mang trạng thái; tuyến gốc sổ mang cờ tuổi —
      // đúng nghĩa vụ của từng nguồn xác minh (test vn-aids.test.ts giữ luật).
      ...(mau.duong === "tbhh" ? { tinhTrang: mau.tinhTrang } : {}),
      ...(mau.duong === "aton" ? { canhBaoTuoi: SACH_CANH_BAO_TUOI } : {}),
      prov: {
        origin: { ...mau.nguon },
        crossChecks: [
          // OSM đồng ý về vị trí — lệch lớn nhất trong nhóm (ghi dè chừng).
          { source: "osm", agreed: true, offsetM: lechMax, at: mau.nguon.at },
        ],
      },
    });
    marks.push(...rows);
  }
}


/**
 * Tên nhập TAY cho vài dòng sổ mà máy dịch không nên đoán — khoá là tên GỐC
 * in trong sổ. Hai tiêu đầu đê chắn sóng cửa sông Dương Đông (Phú Quốc): sổ
 * in "Beacon, North/South breakwater at Duong Dong river" — "North/South" là
 * MÔ TẢ vị trí trên đê, dịch tay theo đúng câu tả của sổ, không phải số hiệu.
 */
const SACH_TEN_TAY = {
  "Beacon, North": "Tiêu đê Bắc Dương Đông",
  "Beacon, South": "Tiêu đê Nam Dương Đông",
};

if (DUNG_SACH) {
  let soSach = [];
  if (!existsSync(KHO_ATON)) {
    log.sachKhoVang = KHO_ATON;
  } else {
    try {
      soSach = JSON.parse(readFileSync(KHO_ATON, "utf8"));
    } catch {
      log.sachKhoVang = `${KHO_ATON} (không đọc được JSON)`;
    }
  }

  /*  Vị trí + tên đã có từ nguồn A/B/E — để sổ biết chỗ nào phải nhường.
      CHỈ nguồn khác, KHÔNG tính chính sổ: mỗi dòng sổ là một bản ghi đăng ký
      riêng, và cặp phao đối xứng cửa luồng hẹp (Hà Tiên, An Thới…) đứng cách
      nhau 115–148 m THẬT — bản đầu đưa cả sổ-đã-vào vào danh sách này và chém
      oan đúng những cặp đó (phân xử 2026-09-02, kết cục 2: giữ CẢ HAI).
      Tên mang kèm KHOÁ TUYẾN — luật trùng-số-hiệu cần chiều tuyến (xem dưới). */
  const choDaCo = marks.map((m) => [m[0], m[1]]);
  const tenDaCo = new Map();
  for (const m of marks) {
    const t = names.list[m[10]];
    if (!t || /chưa rõ số hiệu/i.test(t)) continue;
    const k = t.toLowerCase();
    if (!tenDaCo.has(k)) tenDaCo.set(k, []);
    tenDaCo.get(k).push({ lon: m[0], lat: m[1], tuyen: khoaTuyen(routes[m[9]]?.ten) });
  }

  const theoTuyen = new Map();
  for (const o of soSach) {
    // TẦNG 1 của phương án: đèn biển KHÔNG vào lớp này — chúng thuộc
    // den-bien.v1.json (generate-den-bien.mjs, nguồn D).
    if (o.loai === "light_major" || /^Đèn biển/i.test(o.tuyen ?? "")) {
      log.sachDen++;
      continue;
    }
    const tuyen = o.tuyen || "(chưa rõ tuyến)";
    if (!theoTuyen.has(tuyen)) theoTuyen.set(tuyen, []);
    theoTuyen.get(tuyen).push(o);
  }

  /*  CỔNG CỤM CHO TUYẾN — theo LÁNG GIỀNG GẦN NHẤT, không theo tâm cụm.
      Cổng 60 km quanh tâm dùng cho MỘT thông báo (một khúc luồng) không áp
      được cho CẢ tuyến: luồng Định An dài 130,6 km (trang ENC tự công bố),
      hai đầu cách tâm 63 km — cổng tâm sẽ chém 9 phao THẬT ở hai mút. Hình
      dạng đúng của một tuyến là CHUỖI: phao liền số cùng bên cách nhau trung
      vị 1,93 km, xa nhất đo được 7,81 km (nghiệm thu độc lập ở
      docs/research/san-so-dang-ky-2026-09.md §3.4). Nên luật là: một báo hiệu
      phải có ÍT NHẤT một bạn cùng tuyến trong 15 km (~gấp đôi khoảng phao xa
      nhất đo được); điểm không có ai quanh mình là dòng thừa kế nhầm nhãn
      tuyến — đúng lỗi 19 ngọn đèn Tây Nam Bộ đã bắt được ở vòng bóc đầu. */
  const SACH_LANG_GIENG_KM = 15;
  for (const [tuyen, arr] of theoTuyen) {
    const rtIdx = routes.length;
    const rows = [];
    for (const o of arr) {
      if (
        arr.length > 1 &&
        !arr.some(
          (b) => b !== o && kmGiua(b.lon, b.lat, o.lon, o.lat) <= SACH_LANG_GIENG_KM,
        )
      ) {
        log.sachXaCum++;
        console.warn(
          `  [C] bỏ điểm mồ côi của tuyến ${tuyen}: ${o.ten ?? "(chưa rõ)"} ` +
            `[${o.lat.toFixed(4)},${o.lon.toFixed(4)}] — không có báo hiệu nào trong ${SACH_LANG_GIENG_KM} km`,
        );
        continue;
      }
      // Nguồn mới hơn ĐÈ: trùng chỗ (<150 m) với A/B/E thì sổ nhường —
      // hai nguồn tả cùng một vật, giữ MỘT, bản mới thắng vị trí (kết cục 1
      // của đợt phân xử 2026-09-02).
      if (choDaCo.some(([lo, la]) => kmGiua(lo, la, o.lon, o.lat) < 0.15)) {
        log.sachTrungCho++;
        continue;
      }
      let ten = SACH_TEN_TAY[o.ten ?? ""] ?? tenVietSach(o.ten);
      // Tên là ĐỊNH DANH: mảnh vỡ mang dấu độ hay chuỗi 4 chữ số liền không
      // phải số hiệu phao — bỏ tên (giữ vị trí), không dán rác lên bản đồ.
      if (ten && (/[°′″]/.test(ten) || /\d{4}/.test(ten))) {
        log.sachTenHong++;
        ten = null;
      }
      /*  Trùng SỐ HIỆU: chỉ nhường khi CÙNG TUYẾN (tuyến + số hiệu mới định
          danh một báo hiệu — "Phao 1" Sài Gòn–Vũng Tàu và "Phao 1" Sông Dinh
          là hai vật thật, mỗi luồng đánh số từ 1). Cổng cũ so tên trần trong
          bán kính 5 km và chém oan đúng những ca đó; chủ dự án chốt
          2026-09-02: "trùng tên thì verify từ nhiều nguồn, giữ 1 cái thôi" —
          cùng-tuyến-cùng-số = một vật (nguồn mới thắng), khác tuyến = hai vật
          (giữ cả hai, đếm `sachTenKhacTuyen` để soát lại được). */
      if (ten) {
        const cungTen = tenDaCo.get(ten.toLowerCase()) ?? [];
        if (cungTen.some((x) => x.tuyen === khoaTuyen(tuyen))) {
          log.sachTrungTen++;
          continue;
        }
        if (cungTen.some((x) => kmGiua(x.lon, x.lat, o.lon, o.lat) < 5)) {
          log.sachTenKhacTuyen++;
          log.sachTenKhacTuyenDs.push(`${ten} (${tuyen})`);
        }
      }
      if (!ten) log.sachKhongTen++;

      let [type, purpose] = SACH_LOAI[o.loai] ?? ["buoy_special_purpose", null];
      if (o.loai && !SACH_LOAI[o.loai]) log.sachLoaiLa++;
      // PHAO hay TIÊU là chuyện KẾT CẤU và chính sổ nói ra ("Buoy no. 68" /
      // "Beacon no. 62" / "Front A1" / "Signpost"). Ký hiệu hải đồ của hai
      // loại khác nhau — vẽ nhầm là bà con đọc nhầm vật thật ngoài biển.
      if (/^(Beacon|Front|Rear|Fornt|Signpost)\b/i.test(o.ten ?? "")) {
        if (type === "buoy_lateral") type = "beacon_lateral";
        else type = "beacon";
        if (/^(Front|Rear|Fornt)\b/i.test(o.ten ?? ""))
          purpose ??= "Tiêu dẫn luồng (chập tiêu)";
      }

      // Đặc tính đèn của sổ ("Fl (2+1 ) R 6s") — đưa qua ĐÚNG bộ đọc của
      // nguồn A, chỉ gột hai lỗi trình bày của PDF trước: chữ số bị font tách
      // rời ("1 0 s" → "10s" — CHỈ nối chữ số với chữ số, không đụng chữ cái:
      // xoá hết khoảng trắng sẽ dán "Fl G" thành "FlG" và mất sạch đặc tính),
      // và "FL" viết hoa là lỗi in, hạ về "Fl".
      const asGon = String(o.dacTinhAS ?? "")
        .replace(/(\d)[ \t]+(?=[\d.,])/g, "$1")
        .replace(/^\s*FL\b/, "Fl")
        .trim();
      const { light, ok } = parseLight(asGon);
      if (!ok && asGon) log.badLight.push(`${tuyen} · ${ten ?? "(chưa rõ)"} · "${o.dacTinhAS}"`);

      tally[type] = (tally[type] ?? 0) + 1;
      rows.push([
        r(o.lon),
        r(o.lat),
        types.idx(type),
        chars.idx(light.character),
        groups.idx(light.group),
        colours.idx(light.colour),
        light.period ?? 0,
        0, // tầm hiệu lực: sổ CÓ cột nhưng bộ bóc chưa tách — không bịa
        -1, // màu thân: chưa tách
        rtIdx,
        names.idx(ten ?? "Báo hiệu (chưa rõ số hiệu)"),
        purposes.idx(purpose),
      ]);
      // Ghi TÊN đã dùng (kèm khoá tuyến) để dòng sổ nào lặp đúng số hiệu trong
      // CÙNG tuyến thì nhường bản đầu — nhưng KHÔNG ghi vị trí vào `choDaCo`:
      // hai dòng sổ đứng gần nhau là hai bản ghi đăng ký, không phải trùng lặp.
      if (ten) {
        const k = ten.toLowerCase();
        if (!tenDaCo.has(k)) tenDaCo.set(k, []);
        tenDaCo.get(k).push({ lon: o.lon, lat: o.lat, tuyen: khoaTuyen(tuyen) });
      }
    }
    if (!rows.length) continue;

    const encId = arr.find((o) => o.encId)?.encId ?? null;
    routes.push({
      // Không gian tên riêng thứ ba: `aton-<mã ENC>` khi tuyến có mã, để tra
      // chéo được với ô "Số báo hiệu" của cổng ENC (kiem-phu-hai-do.mjs).
      // Hai tuyến có thể chung một mã ENC (Nha Trang Bắc/Nam đều là trang
      // #59) — id phải khác nhau, mã ENC dùng chung nằm ở `encId`.
      id: encId
        ? routes.some((x) => x.id === `aton-${encId}`)
          ? `aton-${encId}-${rtIdx}`
          : `aton-${encId}`
        : `aton-x-${rtIdx}`,
      ten: /^Luồng\b/i.test(tuyen) ? tuyen : `Luồng hàng hải ${tuyen}`,
      noi: "",
      so: rows.length,
      ...(encId ? { encId } : {}),
      canhBaoTuoi: SACH_CANH_BAO_TUOI,
      prov: { origin: { ...SACH_REF } },
    });
    marks.push(...rows);

    // Tuyến này từng nằm trong thieuBang ("trang ENC chỉ có ô đếm") — ghi rõ
    // sổ 2016 đã lấp, để người đọc thieuBang không đi săn lại nguồn từ đầu.
    if (encId) {
      const tb = thieuBang.find((x) => x.id === encId);
      if (tb && !/sổ AtoN 2016/.test(tb.lyDo)) {
        tb.lyDo += ` — ĐÃ LẤP bằng sổ AtoN 2016 (tuyến aton-${encId}, mang cờ tuổi)`;
      }
    }
  }
}

// Gom theo loại rồi theo vị trí — chỉ số cạnh nhau giống nhau ⇒ gzip nhỏ hơn.
marks.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);

const out = {
  v: 1,
  nguon:
    "Cục Hàng hải Việt Nam (enc.vinamarine.gov.vn) · Thông báo hàng hải — " +
    "Tổng công ty Bảo đảm an toàn hàng hải và các Cảng vụ Hàng hải · " +
    "List of AtoN System — Bảo đảm an toàn hàng hải miền Nam (NXB GTVT 2016)",
  nhan: NHAN,
  layNgay: FETCHED_AT,
  giayPhep: {
    trangThai: "công bố công khai bởi cơ quan nhà nước Việt Nam",
    /* Điều 15 Luật Sở hữu trí tuệ loại "văn bản hành chính" và "tin tức thời
       sự thuần tuý đưa tin / số liệu" khỏi bảo hộ quyền tác giả. Thông báo
       hàng hải và bảng báo hiệu tuyến luồng nằm đúng nhóm đó. Cả hai nguồn đã
       đăng ký trong `src/lib/provenance.ts` dưới giấy phép `vn-official`
       (`redistributable: true`), nên dataset này ĐƯỢC vào `cleanPackage()`. */
    giayPhepId: "vn-official",
    ghiChu:
      "Số liệu do cơ quan nhà nước Việt Nam công bố công khai — dùng lại được, " +
      "kèm ghi công nguồn. Phải ghi rõ đây là bản THAM KHẢO: bà con (hoặc cán " +
      "bộ cảng vụ) tra lại tận gốc bằng số hiệu Thông báo hàng hải trong `routes`.",
  },
  types: types.list,
  chars: chars.list,
  groups: groups.list,
  colours: colours.list,
  names: names.list,
  purposes: purposes.list,
  routes,
  // Tuyến CÓ trên trang nhưng KHÔNG có bảng báo hiệu. Ghi ra để app nói được
  // "luồng này chưa có dữ liệu" thay vì im lặng vẽ 0 phao — im lặng ở đây
  // đọc thành "luồng này không có phao", sai và nguy hiểm.
  thieuBang,
  marks,
};
const json = JSON.stringify(out);

/* ── CỔNG TỰ KIỂM ─────────────────────────────────────────────────────────*/

// (1) CHỦ QUYỀN — không cho lọt một ký tự Hán/CJK nào. Chép từ cổng cuối
// `generate-coral-reefs.mjs`. Nguồn là trang nhà nước Việt Nam nên đáng ra
// sạch; cổng này để nếu nguồn đổi/bị chèn thì KHÔNG ghi file, chứ không phải
// để lọc rồi ghi tiếp.
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

// Cổng phải CHỨNG MINH được nó không rỗng: một regex viết hỏng (lớp ký tự
// trống, cờ sai) vẫn "chạy qua" mọi lần và im lặng cho mọi thứ lọt. Ký tự thử
// dựng từ mã điểm để bản thân file này không chứa chữ Hán.
if (!CJK.test(String.fromCodePoint(0x6d77))) {
  throw new Error("CHẶN: cổng CJK hỏng — không nhận ra cả ký tự Hán mẫu.");
}

if (CJK.test(json)) {
  const dirty = [
    ...types.list, ...chars.list, ...groups.list, ...colours.list,
    ...names.list, ...purposes.list,
    ...routes.map((x) => `${x.ten} ${x.noi}`),
    ...thieuBang.map((x) => x.ten),
  ].filter((s) => CJK.test(s));
  throw new Error(
    `CHẶN: dữ liệu còn ký tự Hán/CJK — ${dirty.slice(0, 10).join(", ")}`,
  );
}

// (2) TOẠ ĐỘ phải trong khung biển VN. Đã lọc từng dòng ở trên; cổng này bắt
// lỗi lập trình (lọc sai cột, quên lọc) chứ không phải lỗi dữ liệu.
const [S, W, N, E] = VN_BBOX;
const bad = marks.filter((m) => m[1] < S || m[1] > N || m[0] < W || m[0] > E);
if (bad.length) {
  throw new Error(
    `CHẶN: ${bad.length} báo hiệu ngoài khung biển VN — ` +
      bad.slice(0, 5).map((m) => `[${m[0]},${m[1]}]`).join(", "),
  );
}

// (2b) DẤU VÂN TAY TRÙNG-TOẠ-ĐỘ. Hai báo hiệu KHÁC TÊN không thể trùng khít
// toạ độ tới 5 chữ số lẻ (~1 m) — ngoài thực địa không ai thả hai phao chồng
// lên nhau. Khi nó xảy ra trong dữ liệu thì đó là MỘT CHUỖI TOẠ ĐỘ ĐƯỢC TÁI
// DÙNG: OCR trộn dòng, bảng chép kéo ô, hay bộ bóc dán cùng một cặp số cho
// nhiều hàng (đợt dò sổ AtoN đã thấy đúng vết này — 11 điểm chuỗi rác tái
// dùng ở vòng bóc đầu). Điểm như vậy TRÔNG hợp lệ hoàn toàn — đúng khung,
// đúng cụm — nên đây là cổng duy nhất bắt được nó. Cổng này không giết nhầm
// ai: dữ liệu sạch hiện có 0 ca, và các luật nhường-chỗ phía trên đã gộp mọi
// ca trùng hợp lệ trước khi tới đây.
{
  const vanTay = new Map();
  for (const m of marks) {
    const k = `${m[0]},${m[1]}`;
    if (!vanTay.has(k)) vanTay.set(k, []);
    vanTay.get(k).push(m);
  }
  const rac = [...vanTay.entries()].filter(
    ([, ds]) => ds.length >= 2 && new Set(ds.map((m) => m[10])).size >= 2,
  );
  if (rac.length) {
    throw new Error(
      `CHẶN: ${rac.length} toạ độ được TÁI DÙNG cho các báo hiệu khác tên — ` +
        rac
          .slice(0, 5)
          .map(([k, ds]) => `[${k}] ${ds.map((m) => names.list[m[10]]).join(" / ")}`)
          .join(" · "),
    );
  }
}

// (3) NGÂN SÁCH dung lượng (bà con tải qua sóng 3G ngoài khơi).
const kb = Math.round(json.length / 1024);
if (kb > BUDGET_KB) {
  throw new Error(`CHẶN: ${kb} KB > ngân sách ${BUDGET_KB} KB.`);
}

// (4) CHỐNG XOÁ NHẦM. Hai nguồn nằm ở hai chỗ khác nhau: nguồn A cần MẠNG,
// nguồn B cần KHO CHỮ ngoài repo. Chạy trên máy thiếu một trong hai mà vẫn ghi
// đè thì file trong repo mất nửa số báo hiệu — và mất im lặng, vì script vẫn
// báo "OK". Cổng này so với file đang có và CHẶN nếu ít đi.
const DICH = "public/data/vn-aids.v1.json";

/** Đếm báo hiệu theo NGUỒN của tuyến — dùng cho cổng chống xoá nhầm. */
function demTheoNguon(d) {
  const out = {};
  for (const m of d.marks ?? []) {
    const s = d.routes?.[m[9]]?.prov?.origin?.source ?? "?";
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

if (existsSync(DICH) && !CHO_PHEP_GIAM && !THU) {
  let cu = null;
  try {
    cu = JSON.parse(readFileSync(DICH, "utf8"));
  } catch {
    cu = null;
  }
  if (cu) {
    const truoc = demTheoNguon(cu);
    const sau = demTheoNguon(out);
    // Cổng bắt đúng MỘT chuyện: một nguồn BIẾN MẤT hoặc teo hẳn. Dao động vài
    // báo hiệu là bình thường (gột tên luồng làm hai tin gộp lại thành một),
    // chặn ở đó thì cổng kêu suốt và người ta sẽ tắt nó — cổng kêu bừa là cổng
    // chết. Ngưỡng đặt ở 80%: mất hơn 1/5 một nguồn là có chuyện thật.
    for (const [ng, n] of Object.entries(truoc)) {
      if ((sau[ng] ?? 0) >= n * 0.8) continue;
      throw new Error(
        `CHẶN: nguồn "${ng}" tụt từ ${n} xuống ${sau[ng] ?? 0} báo hiệu. ` +
          (log.tbhhKhoVang ? `Kho chữ Thông báo hàng hải KHÔNG có ở "${log.tbhhKhoVang}". ` : "") +
          `Chạy đủ hai nguồn, hoặc thêm --cho-phep-giam nếu CỐ Ý cắt bớt.`,
      );
    }
  }
}

if (!THU) {
  mkdirSync("public/data", { recursive: true });
  writeFileSync(DICH, json);
}

/* ── BÁO CÁO ──────────────────────────────────────────────────────────────*/

const encRoutes = routes.filter((x) => x.prov.origin.source === "vinamarine");
const tbRoutes = routes.filter((x) => x.prov.origin.source === "tbhh");
const byRoute = encRoutes.map((x) => `${x.ten}: ${x.so}`).join(" · ");
console.log(`\n[A] tuyến ENC có bảng báo hiệu: ${encRoutes.length} — ${byRoute}`);
console.log(
  `[A] tuyến KHÔNG có bảng: ${thieuBang.length} — ${thieuBang.map((x) => x.ten).join(" · ")}`,
);
if (thieuBang.length) console.log(`    lý do: ${thieuBang[0].lyDo}`);
console.log(
  `[B] Thông báo hàng hải: ${tbRoutes.length} tin còn hiệu lực → ` +
    `${tbRoutes.reduce((n, x) => n + x.so, 0)} báo hiệu` +
    (log.tbhhKhoVang ? `  ⚠️ KHÔNG có kho chữ ở "${log.tbhhKhoVang}"` : ""),
);
console.log(
  `[B] bỏ: ${log.tbhhGo} tin mới nhất là GỠ · ${log.tbhhQuaCu} quá cũ · ` +
    `${log.tbhhTrungEnc} trùng chỗ với nguồn A · ${log.tbhhTrungNhau} trùng chỗ lẫn nhau · ` +
    `${log.tbhhDongLoan} dòng hai hệ toạ độ lệch nhau (OCR trộn cột) · ` +
    `${log.tbhhXaCum} điểm xa tâm cụm · ${log.tbhhKhongRoViec} tin không rõ việc · ${log.tbhhMapMo} hàng chữ số bị chẻ ⇒ hai cách đọc trở lên (bỏ, không đoán)`,
);
console.log(
  `[B] bản chữ đọc vào: ` +
    Object.entries(log.tbhhTheoDuong)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ") +
    ` → ${log.tbhhKhongPhaiBaoHieu} tin KHÔNG về báo hiệu · ` +
    `${log.tbhhKhongCoBang} tin về báo hiệu mà không đọc ra dòng toạ độ nào`,
);
console.log(`[B] báo hiệu giữ lại mà KHÔNG đọc ra số hiệu: ${log.tbhhKhongTen}`);
{
  const sachRoutes = routes.filter((x) => x.prov.origin.source === "vms-south-aton-list");
  console.log(
    `[C] sổ AtoN 2016: ${sachRoutes.length} tuyến → ` +
      `${sachRoutes.reduce((n, x) => n + x.so, 0)} báo hiệu (NỀN, mang cờ tuổi)` +
      (log.sachKhoVang ? `  ⚠️ KHÔNG có kho sổ ở "${log.sachKhoVang}"` : ""),
  );
  console.log(
    `[C] nhường: ${log.sachTrungCho} trùng chỗ (<150 m) với nguồn A/B · ` +
      `${log.sachTrungTen} trùng số hiệu CÙNG TUYẾN (một vật, bản mới thắng) · ` +
      `${log.sachDen} đèn biển chuyển lớp den-bien · ${log.sachXaCum} điểm mồ côi (không bạn trong 15 km) · ` +
      `${log.sachLoaiLa} loại lạ (rơi về chuyên dùng) · ${log.sachTenHong} tên là mảnh vỡ (bỏ tên, giữ vị trí) · ` +
      `${log.sachKhongTen} không số hiệu (dán nhãn "chưa rõ", không bịa)`,
  );
  console.log(
    `[C] trùng số hiệu KHÁC tuyến — giữ cả hai (kết cục 2, đếm để soát): ${log.sachTenKhacTuyen}` +
      (log.sachTenKhacTuyenDs.length ? ` — ${log.sachTenKhacTuyenDs.join(" · ")}` : ""),
  );
}
{
  const xmRoutes = routes.filter((x) => String(x.id).startsWith("xm-"));
  console.log(
    `[E] manh mối OSM đã xác minh: ${xmRoutes.length} tuyến → ` +
      `${xmRoutes.reduce((n, x) => n + x.so, 0)} báo hiệu (origin = nguồn xác minh, OSM chỉ ở crossChecks)` +
      (log.xmKhoVang ? `  ⚠️ KHÔNG có kho xác minh ở "${log.xmKhoVang}" (chạy scripts/osm-manh-moi.mjs)` : ""),
  );
  console.log(
    `[E] nhường/bỏ: ${log.xmTrungCho} trùng chỗ (<150 m) với A/B/C · ` +
      `${log.xmTrungTenCungTuyen} trùng số hiệu CÙNG tuyến (<5 km) · ${log.xmMoCoi} mồ côi (>15 km) · ` +
      `${log.xmNgoaiKhung} ngoài khung VN · ${log.xmTenKhacTuyen} trùng số hiệu KHÁC tuyến (cho qua, OSM làm chứng)`,
  );
}
{
  const nam = marks.filter((m) => m[1] < 15).length;
  const bac = marks.length - nam;
  console.log(`chia theo vĩ độ: nam 15°B ${nam} · bắc 15°B ${bac}`);
}
console.log("giữ theo loại:", Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1])));
console.log(
  `bỏ: ${log.sectionRow} dòng tiêu đề đoạn/dòng trắng · ${log.badCoord.length} toạ độ không đọc được` +
    (log.badCoord.length ? ` (${log.badCoord.slice(0, 5).join(" | ")})` : "") +
    ` · ${log.outOfFrame.length} ngoài khung VN` +
    (log.outOfFrame.length ? ` (${log.outOfFrame.slice(0, 5).join(" | ")})` : ""),
);
console.log(
  `đèn không đọc được đặc tính: ${log.badLight.length}` +
    (log.badLight.length ? ` — ${log.badLight.slice(0, 5).join(" | ")}` : ""),
);
console.log(
  `báo hiệu trùng chỗ trong cùng tuyến (nguồn liệt kê lặp ở hai đoạn): ${log.dupInRoute.length}` +
    (log.dupInRoute.length ? ` — ${log.dupInRoute.slice(0, 5).join(" | ")}` : ""),
);
console.log(
  `đèn bóc thiếu một vế đặc tính: ${log.lostPart.length}` +
    (log.lostPart.length ? ` — ${log.lostPart.slice(0, 5).join(" | ")}` : ""),
);
console.log(
  `phao không đọc ra vai trò (xếp "chuyên dùng"): ${log.noRole.length}` +
    (log.noRole.length ? ` — ${log.noRole.slice(0, 5).join(" | ")}` : ""),
);
console.log(
  `OK: public/data/vn-aids.v1.json — ${marks.length} báo hiệu, ${kb} KB ` +
    `(ngân sách ${BUDGET_KB} KB) · ${types.list.length} loại, ` +
    `${chars.list.length} đặc tính đèn, ${groups.list.length} nhóm chớp, ` +
    `${colours.list.length} màu đèn, ${names.list.length} tên`,
);

/* ── ## Assumptions ───────────────────────────────────────────────────────
 * - Nguồn KHÔNG công bố màu thân phao và tầm hiệu lực đèn → để trống (-1 / 0),
 *   KHÔNG suy từ màu ánh đèn theo quy ước IALA-A. Suy ra là hứa thứ nguồn
 *   không bảo đảm.
 * - Nhóm chớp "(1)" bỏ đi (chuẩn hải đồ: Fl(1) ≡ Fl). Nhóm "(0)" cũng bỏ:
 *   không phải số nhịp, không phải chữ Morse — gần như chắc là lỗi chép của
 *   nguồn, đoán ra chữ gì là bịa.
 * - "Đặc tính AS" = "-" hoặc trống ⇒ báo hiệu KHÔNG đèn (dữ liệu thật), không
 *   phải thiếu sót. Đó là lý do `parseLight` trả `ok: true` cho hai giá trị đó.
 * - Phao không đọc ra vai trò từ "Tác dụng" xếp `buoy_special_purpose` — loại
 *   KHÔNG hứa gì về mép luồng. Xếp nhầm thành `buoy_lateral` sẽ khiến bà con
 *   tưởng có mép luồng ở chỗ chưa biết.
 * - Tên tuyến trên trang viết HOA toàn bộ; đổi về chữ thường có hoa đầu từ cho
 *   dễ đọc trên màn hình nhỏ. KHÔNG đổi tên báo hiệu ("Phao 5", "Tiêu HN1") —
 *   đó là định danh nhà nước đặt, phải khớp với Thông báo hàng hải.
 *
 * ── Riêng NGUỒN B (Thông báo hàng hải) ────────────────────────────────────
 * - Kho chữ là bản OCR của PDF ký số, KHÔNG phải cơ sở dữ liệu. Vì vậy MỌI
 *   toạ độ bắt buộc có dấu độ THẬT (`°`); dòng nào OCR đọc `°` thành `0`/`9`
 *   thì BỎ, không đoán. Thà thiếu một phao còn hơn dựng một phao lệch chỗ.
 * - "Tạm ngừng hoạt động" GIỮ LẠI (phao còn nổi, chỉ tắt chức năng), "chấm dứt
 *   hoạt động / thu hồi" thì BỎ. Trạng thái ghi ở `routes[].tinhTrang`.
 * - Kho chữ chỉ có 917/2.556 thông báo đã tải (phần còn lại là PDF có lớp chữ,
 *   `scripts/ocr-soundings.mjs` không chạy vào). Nên đây là SÀN, không phải
 *   trần: bóc thêm được thì số báo hiệu miền Nam còn tăng.
 * - Một thông báo thường chỉ ghi MỘT câu "Tác dụng" và MỘT "Đặc tính ánh sáng"
 *   cho cả nhóm báo hiệu nó nói tới; script gán câu đó cho mọi báo hiệu của
 *   tin. Tin nào liệt kê nhiều loại khác nhau thì phần đèn/tác dụng chỉ đúng
 *   với đa số — đây là lý do NHÃN "tham khảo" không được gỡ.
 * - Một số dòng bảng bị OCR nuốt mất cột tên. Những báo hiệu đó VẪN GIỮ vị trí
 *   nhưng mang tên "Báo hiệu (chưa rõ số hiệu)" — bịa một số hiệu trông như
 *   thật là kiểu sai tệ nhất, vì bà con tra lại sẽ không thấy.
 * - Tuổi tin: bỏ nếu tin mới nhất cũ hơn 10 năm, riêng phao CHUYÊN DÙNG (dựng
 *   cho một công trình) thì 3 năm — hết công trình là hết phao.
 * - Hai hệ toạ độ trên cùng một dòng phải cách nhau dưới 2 km (chúng là cùng
 *   một điểm ở VN-2000 và WGS-84, lệch ~200 m); xa hơn là OCR trộn cột hai
 *   dòng, bỏ cả dòng. Và mọi báo hiệu của một tin phải nằm trong 60 km quanh
 *   tâm cụm của tin đó — đây là cái bắt được những điểm "hợp lệ mà sai chỗ".
 *
 * ── Riêng NGUỒN C (sổ AtoN 2016) ──────────────────────────────────────────
 * - Sổ là NỀN 2016, chỉ lấp chỗ trống: mọi chỗ nguồn A/B (mới hơn) đã có thì
 *   sổ nhường (<150 m, hoặc cùng số hiệu trong 5 km). Tuyến gốc sổ mang
 *   `canhBaoTuoi` — giao diện phải nói "vị trí theo sổ 2016", không hơn.
 * - Ngưỡng 5 km cho luật trùng-số-hiệu: phao bị dịch theo nạo vét vẫn là phao
 *   đó, nhưng "Phao 5" của hai luồng khác nhau là hai vật khác nhau — 5 km đủ
 *   rộng để ôm mọi đợt dịch phao, đủ hẹp để không nuốt phao trùng tên khác luồng.
 * - Cột "tầm hiệu lực" và "màu thân phao" sổ CÓ nhưng bộ bóc chưa tách theo
 *   cột — để trống (0/-1) thay vì đoán; xem docs/research/san-so-dang-ky-2026-09.md §8.
 */
