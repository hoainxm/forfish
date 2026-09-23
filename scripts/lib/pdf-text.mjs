// BÓC CHỮ TỪ PDF CÓ LỚP CHỮ — zlib thuần, KHÔNG dependency.
//
// Tách khỏi `scripts/fetch-soundings.mjs` (2026-09-02) vì bộ này là thứ DÙNG
// CHUNG chứ không phải của riêng lớp số đo sâu: `scripts/extract-tbhh-text.mjs`
// mở cùng kho PDF ra đọc bằng một câu hỏi khác ("báo hiệu nằm ở đâu"). Tách
// hàm, KHÔNG chép — chép là tạo bản sự thật thứ hai, và nó sẽ lệch đúng vào
// hôm ai đó sửa một bên.
//
// `pdfPages(buf)` → mảng TRANG, mỗi trang là mảng DÒNG chữ đã dựng lại theo
// toạ độ vẽ. PDF ảnh scan (không có toán tử vẽ chữ) trả về các trang RỖNG —
// đó là dữ liệu, không phải lỗi: chỗ gọi đọc số dòng để biết cần OCR hay không.

import { inflateSync, inflateRawSync, unzipSync } from "node:zlib";


const ESC = { n: 10, r: 13, t: 9, b: 8, f: 12 };

function hexToUtf16(h) {
  let out = "";
  for (let i = 0; i + 1 < h.length; i += 4) {
    out += String.fromCharCode(parseInt(h.slice(i, i + 4).padEnd(4, "0"), 16));
  }
  return out;
}

/** Nhân hai ma trận affine PDF [a b c d e f]. */
function mul(a, b) {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/** Tách chuỗi nội dung PDF thành token: số · tên · chuỗi · dấu gom · toán tử. */
function* tokens(t) {
  let i = 0;
  const n = t.length;
  while (i < n) {
    const c = t[i];
    if (c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0") {
      i++;
      continue;
    }
    if (c === "%") {
      while (i < n && t[i] !== "\n") i++;
      continue;
    }
    if (c === "(") {
      const bytes = [];
      let depth = 1;
      i++;
      while (i < n && depth > 0) {
        const ch = t[i];
        if (ch === "\\") {
          const nx = t[++i];
          if (nx >= "0" && nx <= "7") {
            let o = nx;
            while (o.length < 3 && t[i + 1] >= "0" && t[i + 1] <= "7") o += t[++i];
            bytes.push(parseInt(o, 8));
          } else if (nx !== "\n") {
            bytes.push(ESC[nx] ?? nx.charCodeAt(0));
          }
          i++;
          continue;
        }
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        bytes.push(ch.charCodeAt(0));
        i++;
      }
      yield { k: "str", bytes };
      continue;
    }
    if (c === "<" && t[i + 1] !== "<") {
      const end = t.indexOf(">", i);
      const hex = t.slice(i + 1, end < 0 ? n : end).replace(/[^0-9A-Fa-f]/g, "");
      const bytes = [];
      for (let j = 0; j < hex.length; j += 2) bytes.push(parseInt(hex.slice(j, j + 2).padEnd(2, "0"), 16));
      yield { k: "str", bytes };
      i = end < 0 ? n : end + 1;
      continue;
    }
    if (c === "<" || c === ">") {
      yield { k: "op", v: t.slice(i, i + 2) };
      i += 2;
      continue;
    }
    if (c === "[" || c === "]" || c === "{" || c === "}") {
      yield { k: "op", v: c };
      i++;
      continue;
    }
    if (c === "/") {
      let j = i + 1;
      while (j < n && !/[\s/[\]<>(){}%]/.test(t[j])) j++;
      yield { k: "name", v: t.slice(i + 1, j) };
      i = j;
      continue;
    }
    if (/[-+.0-9]/.test(c)) {
      let j = i;
      while (j < n && /[-+.0-9eE]/.test(t[j])) j++;
      const v = Number.parseFloat(t.slice(i, j));
      yield { k: "num", v: Number.isFinite(v) ? v : 0 };
      i = j;
      continue;
    }
    let j = i;
    while (j < n && !/[\s/[\]<>(){}%]/.test(t[j])) j++;
    if (j === i) j++;
    yield { k: "op", v: t.slice(i, j) };
    i = j;
  }
}

/** PDF (Buffer) → mảng TRANG, mỗi trang là mảng DÒNG chữ đã dựng lại. */
function pdfPages(buf) {
  const s = buf.toString("latin1");

  const objs = new Map();
  const reObj = /(?:^|[\s>])(\d+)\s+0\s+obj\b/g;
  let m;
  while ((m = reObj.exec(s)) !== null) objs.set(Number(m[1]), m.index + m[0].length);

  const rawCache = new Map();
  const packed = new Map(); // đối tượng nằm trong /ObjStm

  function rawOf(num) {
    if (rawCache.has(num)) return rawCache.get(num);
    const st = objs.get(num);
    let r = null;
    if (st != null) {
      const end = s.indexOf("endobj", st);
      r = { body: s.slice(st, end < 0 ? s.length : end), start: st };
    } else if (packed.has(num)) {
      r = { body: packed.get(num), start: -1 };
    }
    rawCache.set(num, r);
    return r;
  }

  function decode(bytes, hdr) {
    let b = bytes;
    const filters = [...hdr.matchAll(/\/(FlateDecode|LZWDecode|ASCIIHexDecode|ASCII85Decode|DCTDecode|CCITTFaxDecode|JBIG2Decode|JPXDecode|RunLengthDecode)/g)].map(
      (f) => f[1],
    );
    for (const f of filters) {
      if (f !== "FlateDecode") return null; // ảnh — không phải chữ
      try {
        b = inflateSync(b);
      } catch {
        try {
          b = inflateRawSync(b);
        } catch {
          try {
            b = unzipSync(b);
          } catch {
            return null;
          }
        }
      }
    }
    return b;
  }

  function streamOf(num) {
    const r = rawOf(num);
    if (!r || r.start < 0) return null;
    const k = r.body.search(/stream\r?\n|stream\r/);
    if (k < 0) return null;
    const lead = r.body.slice(k).match(/stream\r?\n|stream\r/)[0];
    const hdr = r.body.slice(0, k);
    const abs = r.start + k + lead.length;
    const endRel = r.body.indexOf("endstream", k);
    if (endRel < 0) return null;
    return decode(buf.subarray(abs, r.start + endRel), hdr);
  }

  // ── bung object stream TRƯỚC, vì từ điển font/trang nằm trong đó
  for (const num of [...objs.keys()]) {
    const r = rawOf(num);
    if (!r || !/\/Type\s*\/ObjStm/.test(r.body)) continue;
    const b = streamOf(num);
    if (!b) continue;
    const t = b.toString("latin1");
    const n = Number(r.body.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const first = Number(r.body.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const head = t.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const on = head[i * 2];
      const off = head[i * 2 + 1];
      if (!Number.isFinite(on) || !Number.isFinite(off)) continue;
      const nxt = i + 1 < n ? first + head[i * 2 + 3] : t.length;
      if (!objs.has(on) && !packed.has(on)) packed.set(on, t.slice(first + off, nxt));
    }
  }

  function cmapOf(num) {
    const b = streamOf(num);
    if (!b) return null;
    const t = b.toString("latin1");
    const map = new Map();
    for (const blk of t.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
      for (const p of blk.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) {
        map.set(parseInt(p[1], 16), hexToUtf16(p[2]));
      }
    }
    // bfrange có HAI dạng đích: `<lo> <hi> <dst>` và `<lo> <hi> [<d0> <d1> …]`.
    // Bỏ dạng mảng là nuốt đúng các dấu tiếng Việt (á à â).
    for (const blk of t.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
      const re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]*>)/g;
      let p;
      while ((p = re.exec(blk)) !== null) {
        const a = parseInt(p[1], 16);
        const z = parseInt(p[2], 16);
        if (p[3][0] === "[") {
          const dst = [...p[3].matchAll(/<([0-9A-Fa-f]*)>/g)].map((d) => hexToUtf16(d[1]));
          for (let c = a; c <= z && c - a < dst.length; c++) map.set(c, dst[c - a]);
        } else {
          const d = parseInt(p[3].slice(1, -1).slice(0, 4) || "0", 16);
          for (let c = a; c <= z && c - a < 65536; c++) map.set(c, String.fromCharCode(d + (c - a)));
        }
      }
    }
    return map.size ? map : null;
  }

  const fontCache = new Map();
  function fontOf(num) {
    if (fontCache.has(num)) return fontCache.get(num);
    const r = rawOf(num);
    const body = r ? r.body : "";
    const tu = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    const f = { cid: /\/Type0\b/.test(body), map: tu ? cmapOf(Number(tu[1])) : null };
    fontCache.set(num, f);
    return f;
  }

  function decodeStr(bytes, font) {
    if (font?.cid) {
      let out = "";
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        out += font.map?.get((bytes[i] << 8) | bytes[i + 1]) ?? "";
      }
      return out;
    }
    if (font?.map) return bytes.map((c) => font.map.get(c) ?? String.fromCharCode(c)).join("");
    return bytes.map((c) => String.fromCharCode(c)).join("");
  }

  const pages = [];
  for (const num of [...objs.keys(), ...packed.keys()]) {
    const r = rawOf(num);
    if (!r || !/\/Type\s*\/Page(?![sA-Za-z])/.test(r.body)) continue;
    const res = {};
    const fm = r.body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (fm) for (const p of fm[1].matchAll(/\/([^\s/]+)\s+(\d+)\s+0\s+R/g)) res[p[1]] = Number(p[2]);
    const cts = [];
    const c1 = r.body.match(/\/Contents\s+(\d+)\s+0\s+R/);
    if (c1) cts.push(Number(c1[1]));
    const c2 = r.body.match(/\/Contents\s*\[([^\]]*)\]/);
    if (c2) for (const p of c2[1].matchAll(/(\d+)\s+0\s+R/g)) cts.push(Number(p[1]));
    pages.push({ num, res, cts });
  }
  pages.sort((a, b) => a.num - b.num);

  return pages.map((pg) => {
    const items = [];
    for (const c of pg.cts) {
      const b = streamOf(c);
      if (b) runContent(b.toString("latin1"), pg.res, items);
    }
    return itemsToLines(items);
  });

  function runContent(t, res, items) {
    let ctm = [1, 0, 0, 1, 0, 0];
    const gs = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = tm;
    let leading = 0;
    let font = null;
    const st = [];
    const push = (str) => {
      if (!str) return;
      const d = mul(tm, ctm);
      items.push({ x: d[4], y: d[5], s: str });
    };
    for (const tk of tokens(t)) {
      // `[ ] << >>` là DẤU GOM, không phải toán tử — xoá chồng ở đây là xoá
      // trắng mảng của TJ trước khi TJ đọc tới.
      if (tk.k !== "op" || tk.v === "[" || tk.v === "]" || tk.v === "<<" || tk.v === ">>") {
        st.push(tk);
        if (st.length > 4096) st.shift();
        continue;
      }
      const nums = st.filter((x) => x.k === "num").map((x) => x.v);
      switch (tk.v) {
        case "q":
          gs.push(ctm.slice());
          break;
        case "Q":
          ctm = gs.pop() ?? ctm;
          break;
        case "cm":
          if (nums.length >= 6) ctm = mul(nums.slice(-6), ctm);
          break;
        case "BT":
          tm = tlm = [1, 0, 0, 1, 0, 0];
          break;
        case "Tf": {
          const nm = [...st].reverse().find((x) => x.k === "name");
          font = nm && res[nm.v] != null ? fontOf(res[nm.v]) : null;
          break;
        }
        case "Tm":
          if (nums.length >= 6) tm = tlm = nums.slice(-6);
          break;
        case "Td":
        case "TD":
          if (nums.length >= 2) {
            if (tk.v === "TD") leading = -nums[nums.length - 1];
            tlm = mul([1, 0, 0, 1, nums[nums.length - 2], nums[nums.length - 1]], tlm);
            tm = tlm;
          }
          break;
        case "TL":
          if (nums.length) leading = nums[nums.length - 1];
          break;
        case "T*":
          tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
          tm = tlm;
          break;
        case "Tj":
        case "'":
        case '"': {
          if (tk.v !== "Tj") {
            tlm = mul([1, 0, 0, 1, 0, -leading], tlm);
            tm = tlm;
          }
          const sv = [...st].reverse().find((x) => x.k === "str");
          if (sv) push(decodeStr(sv.bytes, font));
          break;
        }
        case "TJ": {
          const open = st.map((x) => x.k === "op" && x.v === "[").lastIndexOf(true);
          const arr = open >= 0 ? st.slice(open + 1) : st;
          let out = "";
          for (const el of arr) {
            if (el.k === "str") out += decodeStr(el.bytes, font);
            else if (el.k === "num" && el.v <= -200) out += " ";
          }
          push(out);
          break;
        }
        default:
          break;
      }
      st.length = 0;
    }
  }

  /** Gom mẩu chữ về DÒNG theo toạ độ vẽ; trong dòng sắp theo x (trái→phải). */
  function itemsToLines(items) {
    const rows = new Map();
    for (const it of items) {
      const k = Math.round(it.y / 3.2);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push(it);
    }
    return [...rows.entries()]
      .sort((a, b) => b[0] - a[0]) // y lớn = trên đầu trang
      .map(([, r]) =>
        r
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean);
  }
}

export { pdfPages, tokens, hexToUtf16, mul };
