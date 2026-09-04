// RÀ SOÁT TÊN TRÊN HẢI ĐỒ — quét MỌI file dữ liệu đang phát cho bà con, tìm
// ký tự Hán/CJK và tên nước ngoài của thực thể Việt Nam.
//
//   node scripts/audit-names.mjs              # báo cáo người đọc
//   node scripts/audit-names.mjs --json       # JSON máy đọc (cổng test dùng)
//   node scripts/audit-names.mjs --quick      # BỎ .pmtiles (chỉ để soi nhanh)
//   node scripts/audit-names.mjs --file a --file b   # chỉ quét file chỉ định
//
// Thoát 1 nếu còn BẤT KỲ vi phạm nào — dùng được cả ở CLI lẫn trong test.
//
// ── VÌ SAO CÓ FILE NÀY ─────────────────────────────────────────────────────
// Mỗi script sinh dữ liệu (generate-islands / coral-reefs / reef-shapes /
// seamarks) đã có CỔNG TỰ KIỂM CJK riêng, nhưng cổng đó chỉ chạy LÚC SINH và
// chỉ soi đúng file nó sinh. Ba lỗ hổng thật:
//   (1) `public/data/vn-basemap.pmtiles` KHÔNG do script nào trong repo sinh ra
//       (tải sẵn từ Protomaps) → chưa từng qua cổng nào. Đo 2026-08-29: file
//       này chứa 12.755 đối tượng mang chữ Hán, gồm cả "三沙市 / Tam Sa" — đơn
//       vị hành chính Trung Quốc bịa ra để "quản" Hoàng Sa + Trường Sa.
//   (2) grep chữ Hán trên file .pmtiles trả về SẠCH một cách giả tạo: mỗi ô
//       tile nén gzip, chữ Hán không nằm ở dạng văn bản thô. Phải giải nén tile
//       rồi mới thấy. Ai kiểm bằng grep sẽ yên tâm nhầm.
//   (3) Chữ Hán không phải rủi ro duy nhất: tên Anh/Philippines/Malaysia của
//       thực thể Việt Nam (Paracel, Spratly, Vanguard Bank, Ayungin…) và phiên
//       âm Hán-Việt của tên Trung Quốc (Tam Sa, Vĩnh Hưng, Chử Bích…) sai về
//       chủ quyền y hệt, mà cổng CJK không bắt được vì chúng viết bằng chữ Latin.
//
// ── QUÉT GÌ ───────────────────────────────────────────────────────────────
//   public/data/*.json · public/data/*.bin · public/data/*.pmtiles (giải nén
//   tile, đọc bảng thuộc tính) · src/data/*.json · src/data/*.ts ·
//   src/lib/**/*.ts · src/components/**/*.tsx (chuỗi hiển thị).
//
// Không đụng vào dữ liệu — CHỈ ĐỌC. Sửa tên là việc chủ quyền, phải do chủ dự
// án duyệt (xem docs/research/ra-soat-ten-2026-08.md).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gunzipSync, brotliDecompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── DẢI KÝ TỰ ─────────────────────────────────────────────────────────────
// Lấy theo bản trong scripts/generate-islands.mjs rồi MỞ RỘNG cho đủ:
//   2E80–2FFF  bộ thủ Khang Hy + bộ thủ CJK
//   3000–303F  dấu câu CJK (。「」…) — kèm theo tên là kèm theo chữ Hán
//   3040–30FF  Hiragana + Katakana (tên Nhật của thực thể tranh chấp, OSM có
//              trường name:ja — sai chủ quyền y như tên Trung)
//   3100–312F  Bopomofo (chú âm Đài Loan)  ·  31A0–31BF  Bopomofo mở rộng
//   3200–33FF  ký hiệu/chữ tắt CJK bao quanh (㈱ ㎡ ㍿)
//   3400–4DBF  CJK mở rộng A  ·  4E00–9FFF  CJK cơ bản
//   F900–FAFF  CJK tương thích  ·  FE30–FE4F  dấu câu CJK dạng dọc
//   FF00–FF60 / FFE0–FFE6  dạng toàn/nửa chiều rộng (ＡＢ ￥)
// KHÔNG gộp Hangul: chữ Hàn không dính tranh chấp Biển Đông, gộp vào chỉ tạo
// nhiễu. Nếu sau này cần, thêm AC00–D7AF.
const CJK =
  /[⺀-⿿　-〿぀-ヿ㄀-ㄯㆠ-ㆿ㈀-㏿㐀-䶿一-鿿豈-﫿︰-﹏＀-｠￠-￦]/;
const CJK_G = new RegExp(CJK.source, "g");

/**
 * Bốn cái tên dưới đây VỪA là phiên âm tên Trung Quốc của thực thể trên Biển
 * Đông, VỪA là địa danh THẬT trong đất liền — đo trên chính nền bản đồ này
 * (2026-08-29):
 *   "Xã Vạn An"  105,50°Đ 18,70°B — Nghệ An, Việt Nam
 *   "Vĩnh Hưng"  105,79°Đ 10,89°B — Đồng Tháp, Việt Nam
 *   "Nam Vi" · "Nam Sa" — hai con sông ở Lào (102,3–102,6°Đ)
 *   "Quận Nam Sa" 113,52°Đ 22,80°B — quận Nam Sa của Quảng Châu (có thật)
 * Cấm trơn bốn tên này thì cổng kêu oan đúng vào địa danh Việt Nam — mà một
 * cổng hay kêu oan là một cổng sắp bị tắt. Nên chỉ tính vi phạm khi tên đi kèm
 * TỪ CHỈ THỰC THỂ TRÊN BIỂN (đảo/đá/bãi/cồn/rạn/quần đảo/thành phố) — đúng
 * dạng nó xuất hiện khi làm NHÃN HẢI ĐỒ, chứ không phải khi làm tên xã.
 * `xã/huyện/quận/phường` KHÔNG nằm trong danh sách: đó chính là dấu hiệu ngược.
 */
const MARITIME = (name) =>
  new RegExp(
    "(?:đảo|đá|bãi|cồn|rạn|quần\\s+đảo|thành\\s+phố|TP\\.?)\\s+" +
      name.split(" ").join("\\s+") +
      "(?![\\p{L}])",
    "iu",
  );

/**
 * DANH SÁCH TÊN CẤM — vì sao chọn từng nhóm:
 *
 * A. Tên Trung Quốc (phiên Latin) của thực thể VN + đơn vị hành chính TQ bịa
 *    ra trên biển VN. Đây là loại nguy hiểm nhất: "Sansha" (Tam Sa) là "thành
 *    phố" Trung Quốc lập năm 2012 để "quản" Hoàng Sa + Trường Sa; in nó lên
 *    hải đồ phát cho ngư dân Việt là công nhận yêu sách đó.
 * B. Tên Anh/thuộc địa của thực thể VN (Paracel, Spratly, Fiery Cross…). OSM
 *    và mọi nguồn quốc tế mặc định dùng bộ này.
 * C. Tên Philippines/Malaysia của thực thể VN (Kalayaan, Ayungin, Layang…).
 * D. Phiên âm HÁN-VIỆT của tên Trung Quốc — bẫy tinh vi nhất vì trông như
 *    tiếng Việt: "Đảo Chử Bích" (渚碧岛) là cách gọi theo TQ của Đá Xu Bi;
 *    "Đá Hoa Quang" (华光礁) là của Đá Lồi. Đúng chính tả tiếng Việt nhưng SAI
 *    tên gọi — dữ liệu nền hiện đang gắn đúng những tên này ở trường name:vi.
 *
 * Mỗi mục là một regex có ranh giới từ, để "Subi" không khớp trong "Subic" và
 * "Nam Sa" không khớp trong "Nam Sách". Cố ý KHÔNG cấm tên các thành phố Trung
 * Quốc trên đất liền (Hải Khẩu, Trạm Giang, Bắc Hải…): đó là địa danh có thật
 * của nước bạn, chỉ chữ Hán của chúng mới bị cổng CJK chặn.
 */
const BANNED = [
  // ── A. Tên Trung Quốc (Latin) ───────────────────────────────────────────
  ["Sansha", /\bsansha\b/i, "TQ: 'thành phố Tam Sa' — đơn vị bịa ra để quản Hoàng Sa/Trường Sa"],
  ["Xisha", /\bxisha\b/i, "TQ gọi Hoàng Sa"],
  ["Nansha", /\bnansha\b/i, "TQ gọi Trường Sa"],
  ["Zhongsha", /\bzhongsha\b/i, "TQ gọi bãi ngầm Macclesfield"],
  ["Yongxing", /\byongxing\b/i, "TQ gọi đảo Phú Lâm"],
  ["Yongshu", /\byongshu\b/i, "TQ gọi đá Chữ Thập"],
  ["Zhubi", /\bzhubi\b/i, "TQ gọi đá Xu Bi"],
  ["Meiji", /\bmeiji\s*(reef|jiao)\b/i, "TQ gọi đá Vành Khăn"],
  ["Huangyan", /\bhuangyan\b/i, "TQ gọi bãi Scarborough"],
  ["Yongle", /\byongle\b/i, "TQ gọi nhóm Lưỡi Liềm (Hoàng Sa)"],
  ["Qilianyu", /\bqilianyu\b/i, "TQ gọi nhóm An Vĩnh (Hoàng Sa)"],
  ["Wan'an", /\bwan'?an\s*(tan|bank|shoal)?\b/i, "TQ gọi bãi Tư Chính"],
  ["Nanwei", /\bnanwei\b/i, "TQ gọi bãi Vũng Mây"],
  ["Guangya", /\bguangya\b/i, "TQ gọi bãi Phúc Tần"],
  ["Renjun", /\brenjun\b/i, "TQ gọi bãi Huyền Trân"],
  ["Xiwei", /\bxiwei\b/i, "TQ gọi bãi Phúc Nguyên"],
  ["Chigua", /\bchigua\b/i, "TQ gọi đá Gạc Ma"],
  ["Nine-dash line", /\bnine[- ]?dash\b/i, "đường lưỡi bò"],

  // ── B. Tên Anh/thuộc địa của thực thể VN ────────────────────────────────
  ["Paracel", /\bparacel/i, "tên Anh của Hoàng Sa"],
  ["Spratly", /\bspratly/i, "tên Anh của Trường Sa"],
  ["South China Sea", /\bsouth\s+china\s+sea\b/i, "tên Anh của Biển Đông"],
  ["Fiery Cross", /\bfiery\s+cross\b/i, "đá Chữ Thập"],
  ["Woody Island", /\bwoody\s+island\b/i, "đảo Phú Lâm"],
  ["Subi Reef", /\bsubi\b/i, "đá Xu Bi"],
  ["Mischief Reef", /\bmischief\b/i, "đá Vành Khăn"],
  ["Vanguard Bank", /\bvanguard\s+bank\b/i, "bãi Tư Chính"],
  ["Scarborough", /\bscarborough\b/i, "bãi Scarborough"],
  ["Macclesfield", /\bmacclesfield\b/i, "bãi ngầm Macclesfield"],
  ["Triton Island", /\btriton\s+island\b/i, "đảo Tri Tôn"],
  ["Discovery Reef", /\bdiscovery\s+reef\b/i, "đá Lồi"],
  ["Bombay Reef", /\bbombay\s+reef\b/i, "đá Bông Bay"],
  ["Bremen Bank", /\bbremen\s+bank\b/i, "bãi Tân Mê"],
  ["Owen Shoal", /\bowen\s+shoal\b/i, "bãi Chim Biển"],
  ["Rifleman Bank", /\brifleman\s+bank\b/i, "bãi Vũng Mây"],
  ["Prince Consort Bank", /\bprince\s+consort\b/i, "bãi Phúc Nguyên"],
  ["Prince of Wales Bank", /\bprince\s+of\s+wales\b/i, "bãi Phúc Tần"],
  ["Alexandra Bank", /\balexandra\s+bank\b/i, "bãi Huyền Trân"],
  ["Second Thomas Shoal", /\bsecond\s+thomas\b/i, "bãi Cỏ Mây"],
  ["Reed Bank", /\breed\s+bank\b/i, "bãi Cỏ Rong"],
  ["Whitsun Reef", /\bwhitsun\b/i, "đá Ba Đầu"],
  ["Itu Aba", /\bitu\s+aba\b/i, "đảo Ba Bình"],
  ["Gaven Reef", /\bgaven\b/i, "đá Ga Ven"],
  ["Amphitrite Group", /\bamphitrite\b/i, "nhóm An Vĩnh (Hoàng Sa)"],
  ["Crescent Group", /\bcrescent\s+group\b/i, "nhóm Lưỡi Liềm (Hoàng Sa)"],
  ["Pattle Island", /\bpattle\b/i, "đảo Hoàng Sa"],
  ["Duncan Island", /\bduncan\s+island\b/i, "đảo Quang Hòa"],
  ["Drummond Island", /\bdrummond\s+island\b/i, "đảo Duy Mộng"],
  ["Robert Island", /\brobert\s+island\b/i, "đảo Hữu Nhật"],
  ["Money Island", /\bmoney\s+island\b/i, "đảo Quang Ảnh"],
  ["Lincoln Island", /\blincoln\s+island\b/i, "đảo Linh Côn"],
  ["Tree Island", /\btree\s+island\b/i, "đảo Cây"],
  ["Passu Keah", /\bpassu\s+keah\b/i, "đảo Bạch Quy"],
  ["Antelope Reef", /\bantelope\s+reef\b/i, "đá Hải Sâm"],
  ["Swallow Reef", /\bswallow\s+reef\b/i, "đá Hoa Lau"],
  ["Barque Canada Reef", /\bbarque\s+canada\b/i, "bãi Thuyền Chài"],
  ["Amboyna Cay", /\bamboyna\b/i, "đảo An Bang"],
  ["Ladd Reef", /\bladd\s+reef\b/i, "đá Lát"],
  ["Cuarteron Reef", /\bcuarteron\b/i, "đá Châu Viên"],
  ["Johnson South Reef", /\bjohnson\s+(south\s+)?reef\b/i, "đá Gạc Ma"],
  ["Union Banks", /\bunion\s+banks?\b/i, "cụm Sinh Tồn"],
  ["Tizard Bank", /\btizard\b/i, "cụm Nam Yết"],
  ["North Danger Reef", /\bnorth\s+danger\b/i, "cụm Song Tử"],

  // ── C. Tên Philippines / Malaysia của thực thể VN ───────────────────────
  ["Kalayaan", /\bkalayaan\b/i, "PH gọi phần Trường Sa họ chiếm"],
  ["Pag-asa", /\bpag[- ]?asa\b/i, "PH gọi đảo Thị Tứ"],
  ["Ayungin", /\bayungin\b/i, "PH gọi bãi Cỏ Mây"],
  ["Panganiban", /\bpanganiban\b/i, "PH gọi đá Vành Khăn"],
  ["Zamora", /\bzamora\s*(reef)?\b/i, "PH gọi đá Xu Bi"],
  ["Kagitingan", /\bkagitingan\b/i, "PH gọi đá Chữ Thập"],
  ["Recto Bank", /\brecto\s+bank\b/i, "PH gọi bãi Cỏ Rong"],
  ["Bajo de Masinloc", /\bbajo\s+de\s+masinloc\b/i, "PH gọi bãi Scarborough"],
  ["West Philippine Sea", /\bwest\s+philippine\s+sea\b/i, "PH gọi phần Biển Đông"],
  ["Layang-Layang", /\blayang[- ]?layang\b/i, "MY gọi đá Hoa Lau"],
  ["Beting Patinggi Ali", /\bbeting\s+patinggi\b/i, "MY gọi bãi Tư Chính"],

  // ── D. Phiên âm Hán-Việt của tên Trung Quốc ─────────────────────────────
  ["Tam Sa", /(?<![\p{L}])Tam\s+Sa(?![\p{L}])/u, "phiên âm 三沙 — 'thành phố' TQ bịa trên Hoàng Sa/Trường Sa"],
  ["Tây Sa", /(?<![\p{L}])Tây\s+Sa(?![\p{L}])/u, "phiên âm 西沙 — TQ gọi Hoàng Sa"],
  ["Nam Sa", MARITIME("Nam Sa"), "phiên âm 南沙 — TQ gọi Trường Sa"],
  ["Trung Sa", /(?<![\p{L}])Trung\s+Sa(?![\p{L}])/u, "phiên âm 中沙 — TQ gọi bãi Macclesfield"],
  ["Chử Bích", /(?<![\p{L}])Chử\s+Bích(?![\p{L}])/u, "phiên âm 渚碧 — TQ gọi đá Xu Bi"],
  ["Vĩnh Hưng", MARITIME("Vĩnh Hưng"), "phiên âm 永兴 — TQ gọi đảo Phú Lâm"],
  ["Vĩnh Thử", /(?<![\p{L}])Vĩnh\s+Thử(?![\p{L}])/u, "phiên âm 永暑 — TQ gọi đá Chữ Thập"],
  ["Vĩnh Lạc", /(?<![\p{L}])Vĩnh\s+Lạc(?![\p{L}])/u, "phiên âm 永乐 — TQ gọi nhóm Lưỡi Liềm"],
  ["Mỹ Tế", /(?<![\p{L}])Mỹ\s+Tế(?![\p{L}])/u, "phiên âm 美济 — TQ gọi đá Vành Khăn"],
  ["Hoàng Nham", /(?<![\p{L}])Hoàng\s+Nham(?![\p{L}])/u, "phiên âm 黄岩 — TQ gọi bãi Scarborough"],
  ["Vạn An", MARITIME("Vạn An"), "phiên âm 万安 — TQ gọi bãi Tư Chính"],
  ["Nam Vi", MARITIME("Nam Vi"), "phiên âm 南薇 — TQ gọi bãi Vũng Mây"],
  ["Quảng Nhã", /(?<![\p{L}])Quảng\s+Nhã(?![\p{L}])/u, "phiên âm 广雅 — TQ gọi bãi Phúc Tần"],
  ["Nhân Tuấn", /(?<![\p{L}])Nhân\s+Tuấn(?![\p{L}])/u, "phiên âm 人骏 — TQ gọi bãi Huyền Trân"],
  ["Tây Vệ", /(?<![\p{L}])Tây\s+Vệ(?![\p{L}])/u, "phiên âm 西卫 — TQ gọi bãi Phúc Nguyên"],
  ["Thất Liên", /(?<![\p{L}])Thất\s+Liên(?![\p{L}])/u, "phiên âm 七连屿 — TQ gọi nhóm An Vĩnh"],
  ["Hoa Quang", /(?<![\p{L}])Hoa\s+Quang(?![\p{L}])/u, "phiên âm 华光 — TQ gọi đá Lồi"],
  ["Lãng Hoa", /(?<![\p{L}])Lãng\s+Hoa(?![\p{L}])/u, "phiên âm 浪花 — TQ gọi đá Bông Bay"],
];

// ── VARINT / PROTOBUF TỐI THIỂU ───────────────────────────────────────────
// Tự đọc Mapbox Vector Tile thay vì mượn @mapbox/vector-tile + pbf: hai gói đó
// chỉ là dependency BẮC CẦU của maplibre-gl, maplibre nâng phiên bản là cổng
// chủ quyền gãy — không đáng cho ~90 dòng. Ở đây cũng chỉ cần BẢNG THUỘC TÍNH,
// bỏ hẳn hình học (nhanh hơn nhiều).
//
// Lược đồ MVT:  Tile{3: Layer}
//   Layer{1: name, 2: Feature, 3: keys(string), 4: Value, 5: extent, 15: version}
//   Value{1: string, 2: float, 3: double, 4: int64, 5: uint64, 6: sint64, 7: bool}
//   Feature{1: id, 2: tags(packed uint32), 3: type, 4: geometry(packed uint32)}
class Reader {
  constructor(buf, pos = 0, end = buf.length) {
    this.b = buf;
    this.p = pos;
    this.end = end;
  }
  varint() {
    let r = 0;
    let s = 0;
    for (;;) {
      const b = this.b[this.p++];
      r += (b & 0x7f) * 2 ** s;
      if (b < 0x80) return r;
      s += 7;
      if (s > 56) return r; // giá trị 64-bit tràn: dữ liệu này không cần chính xác
    }
  }
  /** Bỏ qua một trường theo wire type. */
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.p += 8;
    else if (wire === 2) {
      // varint() ĐÃ dịch this.p; `this.p += this.varint()` sẽ cộng vào giá trị
      // cũ và nuốt mất mấy byte độ dài → lệch khung, đọc ra wire type rác.
      const len = this.varint();
      this.p += len;
    } else if (wire === 5) this.p += 4;
    else throw new Error(`wire type lạ ${wire}`);
  }
  str(len) {
    const s = this.b.toString("utf8", this.p, this.p + len);
    this.p += len;
    return s;
  }
}

/** Giải nén ô tile theo cờ nén của pmtiles (1 none · 2 gzip · 3 brotli · 4 zstd). */
function decompress(buf, compression) {
  if (compression === 2) return gunzipSync(buf);
  if (compression === 3) return brotliDecompressSync(buf);
  if (compression === 1 || compression === 0) return buf;
  // 4 = zstd: Node ≥22 mới có zlib.zstdDecompressSync. Không đoán mò — báo rõ.
  throw new Error(`Kiểu nén tile ${compression} chưa hỗ trợ trong bộ quét`);
}

/**
 * Đọc một MVT → [{ layer, props }]. Chỉ thuộc tính, KHÔNG hình học.
 * Feature nào không có tag nào thì bỏ qua (đường bờ, ô đất… không mang tên).
 */
function readVectorTile(buf) {
  const out = [];
  const r = new Reader(buf);
  while (r.p < r.end) {
    const tag = r.varint();
    if (tag >> 3 !== 3) {
      r.skip(tag & 7);
      continue;
    }
    const len = r.varint();
    readLayer(new Reader(buf, r.p, r.p + len), out);
    r.p += len;
  }
  return out;
}

function readLayer(r, out) {
  let name = "?";
  const keys = [];
  const values = [];
  const featureTagRanges = [];
  while (r.p < r.end) {
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) name = r.str(r.varint());
    else if (field === 3 && wire === 2) keys.push(r.str(r.varint()));
    else if (field === 4 && wire === 2) {
      const len = r.varint();
      values.push(readValue(new Reader(r.b, r.p, r.p + len)));
      r.p += len;
    } else if (field === 2 && wire === 2) {
      const len = r.varint();
      featureTagRanges.push([r.p, r.p + len]);
      r.p += len;
    } else r.skip(wire);
  }
  for (const [s, e] of featureTagRanges) {
    const props = readFeatureTags(new Reader(r.b, s, e), keys, values);
    if (props) out.push({ layer: name, props });
  }
}

function readValue(r) {
  while (r.p < r.end) {
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) return r.str(r.varint());
    r.skip(wire); // số/bool: không mang tên, bỏ
  }
  return null;
}

function readFeatureTags(r, keys, values) {
  let props = null;
  while (r.p < r.end) {
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field !== 2 || wire !== 2) {
      r.skip(wire); // id / type / GEOMETRY — bỏ hẳn, đây là phần nặng nhất
      continue;
    }
    const len = r.varint(); // đọc TRƯỚC rồi mới cộng: r.p đã dịch sau varint
    const end = r.p + len;
    props = props || {};
    while (r.p < end) {
      const k = keys[r.varint()];
      const v = values[r.varint()];
      if (k !== undefined && typeof v === "string") props[k] = v;
    }
  }
  return props;
}

// ── NGUỒN PMTILES ĐỌC TỪ Ổ ĐĨA ────────────────────────────────────────────
class FileBytes {
  constructor(file) {
    this.file = file;
    this.buf = readFileSync(file);
  }
  getKey() {
    return this.file;
  }
  async getBytes(offset, length) {
    return {
      data: this.buf.buffer.slice(
        this.buf.byteOffset + offset,
        this.buf.byteOffset + offset + length,
      ),
    };
  }
}

/** Danh sách z/x/y phủ trọn khung của archive, theo từng mức zoom. */
function tileCoords(header) {
  const out = [];
  for (let z = header.minZoom; z <= header.maxZoom; z++) {
    const n = 2 ** z;
    const x0 = Math.floor(((header.minLon + 180) / 360) * n);
    const x1 = Math.floor(((header.maxLon + 180) / 360) * n);
    const yOf = (lat) => {
      const r = (lat * Math.PI) / 180;
      return Math.floor(
        ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
      );
    };
    for (let x = x0; x <= x1; x++)
      for (let y = yOf(header.maxLat); y <= yOf(header.minLat); y++)
        out.push([z, x, y]);
  }
  return out;
}

// ── PHÁT HIỆN ─────────────────────────────────────────────────────────────
/** Trả về danh sách vi phạm của MỘT chuỗi (có thể vừa CJK vừa tên cấm). */
function inspect(text) {
  const hits = [];
  const cjk = text.match(CJK_G);
  if (cjk) hits.push({ rule: "CJK", detail: [...new Set(cjk)].join("") });
  for (const [label, re, why] of BANNED)
    if (re.test(text)) hits.push({ rule: label, detail: why });
  return hits;
}

/** Chuỗi ký tự literal trong mã nguồn TS/TSX (bỏ chú thích một cách tự nhiên). */
const STRING_LITERAL = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

/**
 * Xoá chú thích `//` và ` /* … *\/ ` khỏi mã nguồn, GIỮ nguyên số dòng (thay
 * bằng khoảng trắng) để chỉ số dòng báo ra vẫn đúng.
 *
 * VÌ SAO cần bước này chứ không regex thẳng chuỗi literal: chú thích trong repo
 * trích dẫn có ngoặc kép — `// "South China Sea / Paracel / Spratly" của tile
 * quốc tế` — nên bộ bắt chuỗi literal tưởng đó là một chuỗi hiển thị và kêu oan
 * đúng cái dòng giải thích vì sao phải tránh chúng.
 * Máy trạng thái nhỏ này phân biệt được chú thích / chuỗi / regex literal, thứ
 * mà một regex đơn không làm nổi.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (c === "/" && d === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
    } else if (c === '"' || c === "'" || c === "`") {
      out += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") {
          out += src[i];
          i++;
        }
        if (i < n) {
          out += src[i];
          i++;
        }
      }
      out += src[i] ?? "";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * MIỄN TRỪ — chỉ đúng MỘT ca, ghi rõ lý do:
 * dòng nào bản thân nó LÀ một biểu thức chính quy dải ký tự (`/[⺀-⿟…]/`) thì
 * chữ Hán trong đó chính là ĐẦU DÃY/CUỐI DÃY của cổng chặn CJK — viết dải mà
 * không dùng ký tự thật thì không viết được. Đây là chính cái cổng, không phải
 * nhãn. Ví dụ thật: src/lib/islands.ts.
 * KHÔNG mở rộng miễn trừ này cho bất cứ thứ gì khác.
 */
const CJK_RANGE_LINE = /^(?:(?:export\s+)?const\s+\w+\s*=\s*)?\/\[[^\]]*\]\/[gimsuy]*;?$/;

function scanTextFile(file, rel, findings) {
  const raw = readFileSync(file, "utf8");
  const isSource = /\.(ts|tsx|mjs|js)$/.test(file);
  const text = isSource ? stripComments(raw) : raw;
  // CJK: quét TOÀN BỘ file kể cả chú thích — một chữ Hán trong mã nguồn của app
  // hải đồ luôn đáng nhìn lại, dù nó nằm ở đâu.
  raw.split("\n").forEach((line, i) => {
    const cjk = line.match(CJK_G);
    if (!cjk || CJK_RANGE_LINE.test(line.trim())) return;
    findings.push({
      file: rel,
      where: `dòng ${i + 1}`,
      rule: "CJK",
      detail: [...new Set(cjk)].join(""),
      sample: line.trim().slice(0, 160),
    });
  });
  // Tên cấm: với mã nguồn CHỈ soi chuỗi literal (sau khi đã bỏ chú thích) —
  // chuỗi literal mới là thứ có thể hiện lên màn hình của bà con.
  const haystacks = isSource ? text.match(STRING_LITERAL) || [] : [text];
  for (const h of haystacks) {
    for (const [label, re, why] of BANNED) {
      const m = h.match(re);
      if (!m) continue;
      const at = text.indexOf(m[0]);
      findings.push({
        file: rel,
        where: at >= 0 ? `dòng ${text.slice(0, at).split("\n").length}` : "?",
        rule: label,
        detail: why,
        sample: (isSource ? h : m[0]).slice(0, 160),
      });
    }
  }
}

/**
 * File .bin — vì sao KHÔNG quét thẳng bằng `buf.toString("utf8")`:
 * `depth-grid.v1.bin` là lưới 4 bit/ô, byte thuần số. Ép nó thành UTF-8 rồi soi
 * CJK cho ra 19 "chữ Hán" TOÀN BỘ là rác (đo 2026-08-29: 鯪﫪鯥迪諑…) — bãi mìn
 * dương-tính-giả sẽ dạy người ta bỏ qua cổng này, và một cổng bị bỏ qua thì
 * bằng không có.
 * Cách phân loại: giải mã UTF-8 NGHIÊM (fatal). Byte số ngẫu nhiên gần như chắc
 * chắn hỏng ở đâu đó → không phải văn bản → không thể chứa tên; chỉ ghi một
 * dòng ghi chú. Nếu file giải mã SẠCH thì nó THẬT SỰ mang văn bản, lúc đó mới
 * quét như file chữ (nghiêm ngặt y hệt .json).
 */
function scanBinaryFile(file, rel, findings, notes) {
  const buf = readFileSync(file);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    notes.push(`${rel}: nhị phân số học (không giải mã được UTF-8) — không mang văn bản, bỏ quét tên`);
    return;
  }
  for (const [label, re, why] of BANNED)
    if (re.test(text))
      findings.push({ file: rel, where: "nội dung", rule: label, detail: why, sample: text.match(re)[0] });
  const cjk = text.match(CJK_G);
  if (cjk)
    findings.push({
      file: rel,
      where: "nội dung",
      rule: "CJK",
      detail: [...new Set(cjk)].join("").slice(0, 40),
      sample: "(file .bin giải mã UTF-8 sạch → đang mang văn bản thật)",
    });
}

async function scanPmtiles(file, rel, findings, opts) {
  const { PMTiles } = await import("pmtiles");
  const p = new PMTiles(new FileBytes(file));
  const header = await p.getHeader();
  // Sổ ghi từng chuỗi bẩn MỘT LẦN: cùng một địa danh nằm trong hàng chục ô
  // tile ở nhiều mức zoom, in hết là 12 nghìn dòng không ai đọc.
  const seen = new Map();
  let tiles = 0;
  let features = 0;
  for (const [z, x, y] of tileCoords(header)) {
    const t = await p.getZxy(z, x, y);
    if (!t?.data) continue;
    tiles++;
    const raw = Buffer.from(t.data);
    // pmtiles v4 đã giải nén sẵn theo header; nếu chưa thì tự giải.
    const buf =
      raw[0] === 0x1f && raw[1] === 0x8b
        ? decompress(raw, header.tileCompression)
        : raw;
    for (const { layer, props } of readVectorTile(buf)) {
      features++;
      for (const [k, v] of Object.entries(props)) {
        const hits = inspect(v);
        if (!hits.length) continue;
        for (const h of hits) {
          const id = `${layer}|${k}|${v}|${h.rule}`;
          const rec = seen.get(id);
          if (rec) {
            rec.n++;
            rec.z.add(z);
            continue;
          }
          seen.set(id, {
            n: 1,
            z: new Set([z]),
            layer,
            key: k,
            value: v,
            rule: h.rule,
            detail: h.detail,
            vi: props["name:vi"],
            en: props["name:en"],
            kind: props.kind,
          });
        }
      }
    }
  }
  for (const rec of seen.values())
    findings.push({
      file: rel,
      where: `lớp ${rec.layer} · trường ${rec.key} · z=${[...rec.z].sort((a, b) => a - b).join(",")} · ${rec.n} lần`,
      rule: rec.rule,
      detail: rec.detail,
      sample: `${rec.value}${rec.vi ? `  [name:vi=${rec.vi}]` : ""}${rec.en ? `  [name:en=${rec.en}]` : ""}${rec.kind ? `  (${rec.kind})` : ""}`,
    });
  if (opts?.verbose)
    console.error(`   ${rel}: ${tiles} ô tile · ${features} đối tượng`);
  return { tiles, features };
}

// ── TẬP FILE MẶC ĐỊNH ─────────────────────────────────────────────────────
function listDir(dir, re) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => path.join(dir, f))
    .filter((f) => statSync(f).isFile() && re.test(f));
}

function walk(dir, re, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const f of readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, re, acc);
    else if (re.test(full)) acc.push(full);
  }
  return acc;
}

/**
 * Tập file mặc định = MỌI THỨ PHÁT ĐI CHO NGƯỜI DÙNG.
 *
 * BỎ `__tests__/`: file test không nằm trong bundle gửi tới máy bà con, và nó
 * BẮT BUỘC phải viết được tên cấm ra để chứng minh cổng bắt được (fixture bẩn).
 * Quét chúng thì cổng tự cắn chính bằng chứng của mình.
 */
export function defaultTargets(root = ROOT) {
  const notTest = (f) => !/[\\/]__tests__[\\/]/.test(f);
  return [
    ...listDir(path.join(root, "public/data"), /\.(json|bin|pmtiles)$/),
    ...listDir(path.join(root, "src/data"), /\.(json|ts)$/),
    ...walk(path.join(root, "src/lib"), /\.ts$/).filter(notTest),
    ...walk(path.join(root, "src/components"), /\.(ts|tsx)$/).filter(notTest),
  ];
}

/**
 * Quét danh sách file → { findings, stats }. Không ném lỗi cho file thiếu —
 * ghi nó thành một finding để người đọc thấy, thay vì im lặng bỏ qua.
 */
export async function scan(files, opts = {}) {
  const findings = [];
  const notes = [];
  const stats = { files: 0, pmtiles: 0, tiles: 0, features: 0, skipped: [], notes };
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (!existsSync(file)) {
      findings.push({
        file: rel,
        where: "-",
        rule: "THIẾU FILE",
        detail: "không tồn tại — cổng không quét được thứ nó phải quét",
        sample: "",
      });
      continue;
    }
    stats.files++;
    if (file.endsWith(".pmtiles")) {
      if (opts.quick) {
        stats.skipped.push(rel);
        continue;
      }
      stats.pmtiles++;
      const s = await scanPmtiles(file, rel, findings, opts);
      stats.tiles += s.tiles;
      stats.features += s.features;
    } else if (file.endsWith(".bin")) scanBinaryFile(file, rel, findings, notes);
    else scanTextFile(file, rel, findings);
  }
  return { findings, stats };
}

// ── CLI ───────────────────────────────────────────────────────────────────
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const argv = process.argv.slice(2);
  const opts = {
    json: argv.includes("--json"),
    quick: argv.includes("--quick"),
    verbose: !argv.includes("--json"),
  };
  const picked = [];
  for (let i = 0; i < argv.length; i++)
    if (argv[i] === "--file" && argv[i + 1]) picked.push(path.resolve(argv[++i]));
  const files = picked.length ? picked : defaultTargets();

  const t0 = Date.now();
  const { findings, stats } = await scan(files, opts);
  const ms = Date.now() - t0;

  if (opts.json) {
    console.log(JSON.stringify({ findings, stats, ms }, null, 1));
  } else {
    console.log(
      `\nQuét ${stats.files} file (${stats.pmtiles} pmtiles · ${stats.tiles} ô tile · ${stats.features} đối tượng) trong ${ms} ms`,
    );
    if (stats.skipped.length) console.log(`BỎ QUA (--quick): ${stats.skipped.join(", ")}`);
    for (const n of stats.notes) console.log(`ghi chú: ${n}`);
    if (!findings.length) {
      console.log("SẠCH: không tìm thấy chữ Hán hay tên nước ngoài nào.\n");
    } else {
      const byFile = new Map();
      for (const f of findings) {
        if (!byFile.has(f.file)) byFile.set(f.file, []);
        byFile.get(f.file).push(f);
      }
      console.log(`\n❌ ${findings.length} vi phạm ở ${byFile.size} file:\n`);
      for (const [file, list] of byFile) {
        console.log(`── ${file} (${list.length}) ─────────────────────`);
        for (const f of list.slice(0, 60))
          console.log(`  [${f.rule}] ${f.where}\n      ${f.sample}\n      → ${f.detail}`);
        if (list.length > 60) console.log(`  … còn ${list.length - 60} vi phạm nữa`);
        console.log("");
      }
    }
  }
  process.exit(findings.length ? 1 : 0);
}
