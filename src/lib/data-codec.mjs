/*
  MÃ HOÁ FILE DỮ LIỆU PHÁT RA NGOÀI — `public/data/**` (2026-09-16).

  VÌ SAO CÓ
  Mọi file trong `public/data/` (báo hiệu Cục Hàng hải, đèn biển, số đo sâu,
  luồng lạch, mùa vụ cá, con nước…) được Vercel phát thẳng làm asset tĩnh: ai
  biết URL là `curl` về nguyên bộ JSON đọc được, đem đi dùng cho app khác. Chủ
  dự án chốt: dữ liệu phải qua mã hoá, chỉ web/app của mình giải được.

  CÁI NÀY LÀM ĐƯỢC GÌ — VÀ KHÔNG LÀM ĐƯỢC GÌ (nói thẳng)
  · Chặn được: tải thẳng URL rồi mở ra đọc, cào hàng loạt bằng script, "mượn"
    file làm lớp bản đồ cho sản phẩm khác mà không tốn công.
  · KHÔNG chặn được: người cố ý đọc bundle JS của app tìm bảng giải mã — bảng
    nằm ngay trong file này, app phải có nó để đọc dữ liệu. Đây là khoá cửa,
    không phải két sắt. Két sắt thật là kho mã riêng tư + phần tính toán nằm ở
    server (dự báo cá).

  CÁCH MÃ HOÁ — THAY THẾ TỪNG BYTE (bảng hoán vị 256 phần tử), KHÔNG XOR
  Lý do chọn thứ "yếu" này có chủ ý, cả ba đều là ràng buộc thật của app:
  (1) Nén CDN vẫn ăn: Vercel nén Brotli file .json trước khi phát. Hoán vị byte
      giữ nguyên mọi đoạn lặp ⇒ LZ77 nén y như bản rõ (đo thật ở test
      `data-codec.test.ts`: chênh dưới 10 %). XOR theo vị trí phá đoạn lặp ⇒ file
      tải nặng gấp 4–6 lần trên sóng 3G ngoài cảng — trả giá bằng thời gian của
      bà con để đổi lấy một lớp khoá cũng mở được.
  (2) Không phụ thuộc vị trí ⇒ giải được TỪNG LÁT CẮT: nền bản đồ `.pmtiles`
      đọc bằng Range request (16 KB đầu, rồi từng ô), service worker cũng tự cắt
      lát từ bản đầy đủ trong kho. XOR keystream cần biết offset, hoán vị thì
      không.
  (3) Giải mã là một phép tra bảng mỗi byte — máy rẻ, file 8 MB, không đáng kể.

  ĐỊNH DẠNG: 4 byte đầu `SDF1` (nhận dạng + phiên bản) rồi toàn bộ nội dung đã
  hoán vị. Bản RÕ trong git KHÔNG có 4 byte này ⇒ bộ giải mã nhìn đầu file là
  biết cần giải hay trả nguyên (dev/test chạy bản rõ, production chạy bản mã —
  cùng một đường code).

  File này là ESM thuần (.mjs) có chủ ý — cùng lý do với `reef-bin.mjs`: MỘT bản
  cài đặt cho cả ba nơi (app giải mã, `scripts/encode-data.mjs` lúc build, test).
  Hai bản thì sớm muộn lệch, lệch là bản đồ trắng câm ngoài biển.
*/

/** Bốn byte nhận dạng file đã mã hoá: "SDF" + phiên bản 1. */
export const DATA_MAGIC = Object.freeze([0x53, 0x44, 0x46, 0x31]);
export const DATA_HEADER_LEN = 4;

/* Hạt giống của bảng hoán vị. Đổi hạt giống = đổi khoá = MỌI máy đã cài PWA
   với file cũ trong kho SW đều đọc hỏng cho tới khi tải lại ⇒ chỉ đổi khi bump
   DATA_MAGIC (phiên bản) và bump kho SW cùng lúc. */
const SEED = 0x53444649;

/**
 * Sinh bảng hoán vị 256 byte từ hạt giống — xorshift32 + Fisher–Yates, thuần,
 * tất định (cùng hạt giống ⇒ cùng bảng ở Node lẫn trình duyệt).
 * @param {number} seed
 * @returns {Uint8Array}
 */
function buildTable(seed) {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = i;
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
  for (let i = 255; i > 0; i--) {
    const j = next() % (i + 1);
    const tmp = t[i];
    t[i] = t[j];
    t[j] = tmp;
  }
  return t;
}

/** Bảng mã hoá: byte rõ → byte mã. */
export const ENC_TABLE = buildTable(SEED);
/** Bảng giải mã: byte mã → byte rõ (nghịch đảo của ENC_TABLE). */
export const DEC_TABLE = (() => {
  const d = new Uint8Array(256);
  for (let i = 0; i < 256; i++) d[ENC_TABLE[i]] = i;
  return d;
})();

/**
 * Có 4 byte nhận dạng ở đầu không.
 * @param {Uint8Array} u8
 * @returns {boolean}
 */
export function hasDataHeader(u8) {
  if (!u8 || u8.length < DATA_HEADER_LEN) return false;
  for (let i = 0; i < DATA_HEADER_LEN; i++) if (u8[i] !== DATA_MAGIC[i]) return false;
  return true;
}

/**
 * Hoán vị NGƯỢC một đoạn đã mã (không header) — dùng cho lát cắt Range của
 * .pmtiles và cho thân file sau header. Luôn trả buffer MỚI, không đụng đầu vào.
 * @param {Uint8Array} u8
 * @returns {Uint8Array}
 */
export function unsubstitute(u8) {
  const out = new Uint8Array(u8.length);
  for (let i = 0; i < u8.length; i++) out[i] = DEC_TABLE[u8[i]];
  return out;
}

/**
 * Mã hoá trọn file: header + thân hoán vị. Đầu vào đã có header thì trả NGUYÊN
 * (idempotent — chạy script hai lần không mã hoá chồng).
 * @param {Uint8Array} u8
 * @returns {Uint8Array}
 */
export function encodeData(u8) {
  if (hasDataHeader(u8)) return u8;
  const out = new Uint8Array(DATA_HEADER_LEN + u8.length);
  for (let i = 0; i < DATA_HEADER_LEN; i++) out[i] = DATA_MAGIC[i];
  for (let i = 0; i < u8.length; i++) out[DATA_HEADER_LEN + i] = ENC_TABLE[u8[i]];
  return out;
}

/**
 * Giải mã trọn file. KHÔNG có header ⇒ là bản rõ (dev/test) ⇒ trả nguyên đầu
 * vào. Có header ⇒ trả buffer mới đã giải.
 * @param {Uint8Array} u8
 * @returns {Uint8Array}
 */
export function decodeData(u8) {
  if (!hasDataHeader(u8)) return u8;
  return unsubstitute(u8.subarray(DATA_HEADER_LEN));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SDF2 — NHÓM BIÊN TẬP: gzip rồi AES-256-CTR, khoá giao theo tài khoản
   (2026-09-16, chủ dự án chốt "PWA trước, một phương án tối ưu").

   VÌ SAO KHÁC SDF1: hoán vị byte bẻ được bằng thống kê tần suất. Nhóm file tốn
   công biên tập (số đo sâu, báo hiệu Cục Hàng hải, luồng, đèn biển, chất đáy,
   mùa vụ cá, lưới độ sâu) dùng mã THẬT; khoá KHÔNG nằm trong bundle mà do
   `/api/data-key` giao cho tài khoản đã đăng nhập (lib/data-key.ts), thu hồi
   được, ghi được ai nhận. Trần của PWA vẫn là: người có tài khoản rút được khoá
   khỏi máy mình — nhưng người KHÔNG có tài khoản tải file về là rác thật.

   VÌ SAO CTR: giải được từng lát Range (.pmtiles) — bộ đếm = số thứ tự khối
   16 byte, tính từ offset, không cần đọc từ đầu. VÌ SAO GZIP TRƯỚC: AES ra byte
   ngẫu nhiên, CDN hết nén được; nén trước rồi mã (pmtiles không nén — ô bên
   trong đã gzip sẵn, và Range cần byte-thật-bằng-byte).

   ĐỊNH DẠNG (29 byte header):
     0–3   "SDF2"
     4     cờ: bit0 = thân đã gzip trước khi mã
     5–12  key id — 8 byte đầu SHA-256(khoá)
     13–28 nonce 16 byte: 8 byte ngẫu nhiên + 8 byte 0 (bộ đếm khối, big-endian)
     29…   AES-256-CTR( gzip?(bản rõ) )
   Bộ đếm chỉ tăng ở 8 byte thấp (WebCrypto `length: 64`) — file < 2^64 khối,
   không bao giờ tràn, nên Node (tăng cả 128 bit) và WebCrypto cho cùng keystream.
   ═══════════════════════════════════════════════════════════════════════════ */

export const DATA_MAGIC2 = Object.freeze([0x53, 0x44, 0x46, 0x32]);
export const DATA_HEADER2_LEN = 29;
export const DATA_FLAG_GZIP = 1;
export const AES_BLOCK = 16;

/**
 * @param {Uint8Array} u8
 * @returns {boolean}
 */
export function hasDataHeader2(u8) {
  if (!u8 || u8.length < DATA_HEADER2_LEN) return false;
  for (let i = 0; i < 4; i++) if (u8[i] !== DATA_MAGIC2[i]) return false;
  return true;
}

/** @param {Uint8Array} u8 @returns {string} hex thường */
export function hexOf(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
  return s;
}

/** @param {string} hex @returns {Uint8Array | null} null nếu không phải hex chẵn */
export function bytesOfHex(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Dựng header SDF2.
 * @param {{ gzip: boolean, keyId: Uint8Array, nonce: Uint8Array }} h keyId 8 byte, nonce 16 byte
 * @returns {Uint8Array}
 */
export function buildHeader2(h) {
  if (h.keyId.length !== 8) throw new Error("buildHeader2: keyId phải 8 byte");
  if (h.nonce.length !== 16) throw new Error("buildHeader2: nonce phải 16 byte");
  const out = new Uint8Array(DATA_HEADER2_LEN);
  for (let i = 0; i < 4; i++) out[i] = DATA_MAGIC2[i];
  out[4] = h.gzip ? DATA_FLAG_GZIP : 0;
  out.set(h.keyId, 5);
  out.set(h.nonce, 13);
  return out;
}

/**
 * Đọc header SDF2. Không phải SDF2 ⇒ null.
 * @param {Uint8Array} u8
 * @returns {{ gzip: boolean, keyId: string, nonce: Uint8Array } | null} keyId dạng hex 16 ký tự
 */
export function parseHeader2(u8) {
  if (!hasDataHeader2(u8)) return null;
  return {
    gzip: (u8[4] & DATA_FLAG_GZIP) !== 0,
    keyId: hexOf(u8.subarray(5, 13)),
    nonce: u8.slice(13, 29),
  };
}

/**
 * Khối bộ đếm cho khối thứ `block` (0-based): 8 byte đầu của nonce giữ nguyên,
 * 8 byte thấp = block (big-endian). `block` an toàn tới 2^53.
 * @param {Uint8Array} nonce 16 byte
 * @param {number} block
 * @returns {Uint8Array}
 */
export function counterAt(nonce, block) {
  const c = nonce.slice(0, 16);
  let b = block;
  for (let i = 15; i >= 8; i--) {
    c[i] = b % 256;
    b = Math.floor(b / 256);
  }
  return c;
}
