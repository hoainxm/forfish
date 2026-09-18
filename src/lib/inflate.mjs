/*
  GIẢI NÉN GZIP THUẦN JS — đường lùi cho máy cũ (2026-09-16).

  VÌ SAO CÓ: nhóm file dữ liệu biên tập (data-codec SDF2) được NÉN GZIP RỒI MỚI
  MÃ HOÁ AES lúc build — vì AES ra byte ngẫu nhiên, CDN không nén được nữa, nên
  phải nén trước. Trình duyệt giải nén bằng `DecompressionStream("gzip")` (Safari
  16.4+, Chrome 80+). iPhone kẹt iOS 15 KHÔNG có ⇒ không có file này là mất
  lớp độ sâu/báo hiệu trên đúng máy nghèo nhất. Không thêm dependency (luật
  repo): RFC 1951 gọn, viết theo lối "puff" của zlib, có cổng test đối chiếu với
  `zlib` của Node trên file thật.

  ESM thuần (.mjs) để test Node lẫn app dùng chung — cùng lý do data-codec.mjs.
  Chỉ GIẢI, không nén (nén ở build bằng zlib của Node).
*/

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const MAXBITS = 15;

class BitReader {
  /** @param {Uint8Array} u8 @param {number} pos */
  constructor(u8, pos) {
    this.u8 = u8;
    this.pos = pos;
    this.buf = 0;
    this.cnt = 0;
  }
  /** @param {number} n ≤ 16 */
  bits(n) {
    while (this.cnt < n) {
      if (this.pos >= this.u8.length) throw new Error("inflate: hết dữ liệu giữa chừng");
      this.buf |= this.u8[this.pos++] << this.cnt;
      this.cnt += 8;
    }
    const v = this.buf & ((1 << n) - 1);
    this.buf >>>= n;
    this.cnt -= n;
    return v;
  }
  /** Bỏ phần bit lẻ của byte hiện tại (khối stored). Sau `bits()` luôn còn < 8 bit. */
  align() {
    this.buf = 0;
    this.cnt = 0;
  }
}

/**
 * Bảng Huffman chuẩn tắc từ mảng độ dài mã (lối "puff": đếm theo độ dài + ký hiệu xếp thứ tự).
 * @param {ArrayLike<number>} lengths
 */
function buildHuff(lengths) {
  const count = new Uint16Array(MAXBITS + 1);
  for (let i = 0; i < lengths.length; i++) count[lengths[i]]++;
  count[0] = 0;
  const offs = new Uint16Array(MAXBITS + 2);
  for (let len = 1; len <= MAXBITS; len++) offs[len + 1] = offs[len] + count[len];
  const symbol = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbol[offs[lengths[s]]++] = s;
  return { count, symbol };
}

/** @param {BitReader} br @param {{count: Uint16Array, symbol: Uint16Array}} h */
function decodeSym(br, h) {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len <= MAXBITS; len++) {
    code |= br.bits(1);
    const c = h.count[len];
    if (code - c < first) return h.symbol[index + (code - first)];
    index += c;
    first += c;
    first <<= 1;
    code <<= 1;
  }
  throw new Error("inflate: mã Huffman hỏng");
}

const FIXED = (() => {
  const lit = new Uint8Array(288);
  for (let i = 0; i < 144; i++) lit[i] = 8;
  for (let i = 144; i < 256; i++) lit[i] = 9;
  for (let i = 256; i < 280; i++) lit[i] = 7;
  for (let i = 280; i < 288; i++) lit[i] = 8;
  const dist = new Uint8Array(30).fill(5);
  return { lit: buildHuff(lit), dist: buildHuff(dist) };
})();

class Out {
  /** @param {number} hint */
  constructor(hint) {
    this.buf = new Uint8Array(Math.max(hint, 1024));
    this.len = 0;
  }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf.subarray(0, this.len));
    this.buf = nb;
  }
  byte(b) {
    this.ensure(1);
    this.buf[this.len++] = b;
  }
  copy(dist, len) {
    if (dist > this.len) throw new Error("inflate: khoảng cách lùi vượt đầu bộ đệm");
    this.ensure(len);
    let from = this.len - dist;
    for (let i = 0; i < len; i++) this.buf[this.len++] = this.buf[from++];
  }
  result() {
    return this.buf.subarray(0, this.len);
  }
}

/** @param {BitReader} br @param {Out} out @param {{count: Uint16Array, symbol: Uint16Array}} lit @param {{count: Uint16Array, symbol: Uint16Array}} dist */
function inflateBlock(br, out, lit, dist) {
  for (;;) {
    const sym = decodeSym(br, lit);
    if (sym < 256) {
      out.byte(sym);
    } else if (sym === 256) {
      return;
    } else {
      const li = sym - 257;
      if (li >= 29) throw new Error("inflate: mã độ dài hỏng");
      const len = LEN_BASE[li] + br.bits(LEN_EXTRA[li]);
      const di = decodeSym(br, dist);
      if (di >= 30) throw new Error("inflate: mã khoảng cách hỏng");
      const d = DIST_BASE[di] + br.bits(DIST_EXTRA[di]);
      out.copy(d, len);
    }
  }
}

/**
 * Giải luồng DEFLATE thô (RFC 1951) bắt đầu ở `pos`.
 * @param {Uint8Array} u8
 * @param {number} pos
 * @param {number} sizeHint kích thước đầu ra dự kiến (0 = không biết)
 * @returns {{ data: Uint8Array, end: number }} `end` = vị trí byte sau luồng
 */
export function inflateRaw(u8, pos = 0, sizeHint = 0) {
  const br = new BitReader(u8, pos);
  const out = new Out(sizeHint);
  let last = 0;
  do {
    last = br.bits(1);
    const type = br.bits(2);
    if (type === 0) {
      br.align();
      if (br.pos + 4 > u8.length) throw new Error("inflate: khối stored cụt");
      const len = u8[br.pos] | (u8[br.pos + 1] << 8);
      const nlen = u8[br.pos + 2] | (u8[br.pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error("inflate: LEN/NLEN không khớp");
      br.pos += 4;
      if (br.pos + len > u8.length) throw new Error("inflate: khối stored cụt");
      out.ensure(len);
      out.buf.set(u8.subarray(br.pos, br.pos + len), out.len);
      out.len += len;
      br.pos += len;
    } else if (type === 1) {
      inflateBlock(br, out, FIXED.lit, FIXED.dist);
    } else if (type === 2) {
      const hlit = br.bits(5) + 257;
      const hdist = br.bits(5) + 1;
      const hclen = br.bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) cl[CL_ORDER[i]] = br.bits(3);
      const clh = buildHuff(cl);
      const lengths = new Uint8Array(hlit + hdist);
      for (let i = 0; i < hlit + hdist; ) {
        const sym = decodeSym(br, clh);
        if (sym < 16) {
          lengths[i++] = sym;
        } else {
          let rep = 0;
          let val = 0;
          if (sym === 16) {
            if (i === 0) throw new Error("inflate: lặp mà chưa có mã trước");
            val = lengths[i - 1];
            rep = 3 + br.bits(2);
          } else if (sym === 17) {
            rep = 3 + br.bits(3);
          } else {
            rep = 11 + br.bits(7);
          }
          if (i + rep > hlit + hdist) throw new Error("inflate: bảng độ dài tràn");
          while (rep--) lengths[i++] = val;
        }
      }
      if (lengths[256] === 0) throw new Error("inflate: thiếu mã kết thúc khối");
      const lit = buildHuff(lengths.subarray(0, hlit));
      const dist = buildHuff(lengths.subarray(hlit));
      inflateBlock(br, out, lit, dist);
    } else {
      throw new Error("inflate: loại khối 3 không hợp lệ");
    }
  } while (!last);
  return { data: out.result(), end: br.pos };
}

/**
 * Giải một thành viên gzip (RFC 1952). Bỏ qua CRC32 (ISIZE dùng để cấp bộ đệm
 * và kiểm cỡ — sai cỡ là ném, không trả dữ liệu cụt câm).
 * @param {Uint8Array} u8
 * @returns {Uint8Array}
 */
export function gunzip(u8) {
  if (u8.length < 18 || u8[0] !== 0x1f || u8[1] !== 0x8b) throw new Error("gunzip: không phải gzip");
  if (u8[2] !== 8) throw new Error("gunzip: phương pháp nén lạ");
  const flg = u8[3];
  let pos = 10;
  if (flg & 4) {
    const xlen = u8[pos] | (u8[pos + 1] << 8);
    pos += 2 + xlen;
  }
  if (flg & 8) while (u8[pos++] !== 0) if (pos >= u8.length) throw new Error("gunzip: FNAME cụt");
  if (flg & 16) while (u8[pos++] !== 0) if (pos >= u8.length) throw new Error("gunzip: FCOMMENT cụt");
  if (flg & 2) pos += 2;
  const n = u8.length;
  const isize = (u8[n - 4] | (u8[n - 3] << 8) | (u8[n - 2] << 16) | (u8[n - 1] << 24)) >>> 0;
  const { data } = inflateRaw(u8, pos, isize);
  if (data.length !== isize) throw new Error(`gunzip: cỡ giải ra ${data.length} ≠ ISIZE ${isize}`);
  return data;
}
