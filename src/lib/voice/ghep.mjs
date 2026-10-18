// GHÉP GIỌNG SEN BIỂN — câu động → các mảnh mp3 thu sẵn (doc 15 §21).
//
// Dùng chung cho app (lib/voice/tts.ts) và máy lập danh mục ở bờ
// (scripts/sen-bien-giong/lap_manh.mjs): MỘT luật chuẩn hoá, nên khoá mảnh
// lúc thu và khoá lúc đọc không bao giờ lệch nhau. Thuần, không DOM.
//
//  1. `chuNoi`: chữ viết → các âm tiết NÓI ("4,5 hải lý" → bốn phẩy năm hải lý,
//     "2–4 m" → hai đến bốn mét, "23.488 ha" → hai mươi ba nghìn … héc ta).
//  2. `ghepManh`: đi trái → phải, lấy cụm âm tiết DÀI NHẤT có mảnh; âm tiết
//     không mảnh nào phủ gom thành một đoạn đọc giọng máy. Tên riêng (chữ hoa)
//     dính vào đoạn thiếu thì kéo theo luôn — không đọc nửa tên mp3 nửa giọng máy.

const SO = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** 0–99. `sauTram`: đứng sau "… trăm" ⇒ hàng chục 0 đọc "lẻ". */
function duoiTram(n, sauTram) {
  if (n === 0) return [];
  if (n < 10) return sauTram ? ["lẻ", SO[n]] : [SO[n]];
  const c = Math.floor(n / 10);
  const u = n % 10;
  const dv = u === 0 ? [] : u === 5 ? ["lăm"] : [SO[u]];
  if (c === 1) return ["mười", ...dv];
  const dvMuoi = u === 1 ? ["mốt"] : u === 4 ? ["tư"] : dv;
  return [SO[c], "mươi", ...dvMuoi];
}

/** 0–999. `du`: có nhóm lớn hơn đứng trước ⇒ đọc đủ "không trăm". */
function duoiNghin(n, du) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0 && !du) return duoiTram(r, false);
  return [SO[h], "trăm", ...duoiTram(r, true)];
}

/**
 * Chuỗi chữ số → âm tiết đọc. "0" → không; "05" / số quá dài → đọc từng chữ số
 * (biển số tàu "09", số hiệu). Dưới một tỷ đọc như người Việt đọc số.
 * @param {string} s
 * @returns {string[]}
 */
export function docSo(s) {
  if (!/^\d+$/.test(s)) return [];
  if ((s.length > 1 && s[0] === "0") || s.length > 9) return [...s].map((d) => SO[+d]);
  const n = Number(s);
  if (n === 0) return ["không"];
  const tr = Math.floor(n / 1e6);
  const ng = Math.floor((n % 1e6) / 1000);
  const r = n % 1000;
  const out = [];
  if (tr) out.push(...duoiNghin(tr, false), "triệu");
  if (ng) out.push(...duoiNghin(ng, tr > 0), "nghìn");
  if (r) out.push(...duoiNghin(r, tr > 0 || ng > 0));
  return out;
}

/** "4,5" → bốn phẩy năm; "1,05" → một phẩy không năm; "2,25" → hai phẩy hai mươi lăm. */
function docThapPhan(nguyen, le) {
  const sau = le.length === 1 || le[0] === "0" ? [...le].map((d) => SO[+d]) : docSo(le);
  return [...docSo(nguyen), "phẩy", ...sau];
}

const L = "\\p{L}";

/**
 * Chữ viết → câu NÓI (vẫn giữ hoa/thường của chữ gốc để nhận tên riêng).
 * Không tách đoạn — chỗ gọi tách ở dấu phẩy/hai chấm trước.
 * @param {string} text
 * @returns {string}
 */
export function vietThanhNoi(text) {
  let s = ` ${text.normalize("NFC")} `;
  s = s.replace(/km\s*\/\s*(?:giờ|h)/giu, " cây số một giờ ");
  s = s.replace(/hải lý\s*\/\s*giờ/giu, " hải lý một giờ ");
  s = s.replace(/%/g, " phần trăm ");
  s = s.replace(/°/g, " độ ");
  s = s.replace(/±/g, " sai số ");
  // 23.488 → 23488 (dấu chấm nghìn kiểu Việt)
  s = s.replace(/\d{1,3}(?:\.\d{3})+(?![\d,])/g, (m) => m.replace(/\./g, ""));
  // 2–4 / 2-4 → 2 đến 4
  s = s.replace(/(\d)\s*[–—-]\s*(?=\d)/g, "$1 đến ");
  s = s.replace(new RegExp(`(\\d)\\s*km(?![${L}])`, "gu"), "$1 cây số");
  s = s.replace(new RegExp(`(\\d)\\s*m(?![${L}])`, "gu"), "$1 mét");
  s = s.replace(new RegExp(`(\\d)\\s*ha(?![${L}])`, "gu"), "$1 héc ta");
  s = s.replace(new RegExp(`(\\d)\\s*h(?![${L}])`, "gu"), "$1 giờ");
  s = s.replace(/(\d+),(\d+)/g, (_, a, b) => ` ${docThapPhan(a, b).join(" ")} `);
  s = s.replace(/\d+/g, (m) => ` ${docSo(m).join(" ")} `);
  return s
    .replace(new RegExp(`[^${L}\\p{N}]+`, "gu"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Âm tiết → khoá tra (chữ thường, NFC). */
export const khoaAmTiet = (w) => w.normalize("NFC").toLowerCase();

/**
 * Khoá tra MỘT mảnh: chữ của mảnh qua cùng luật với câu đọc.
 * @param {string} text
 */
export function khoaManh(text) {
  return vietThanhNoi(text).split(" ").filter(Boolean).map(khoaAmTiet).join(" ");
}

/**
 * Một đoạn câu (đã tách ở dấu câu) → các khúc: khúc có mảnh (`ids`) và khúc
 * đọc giọng máy (`ids: null`). `tra(khoa)` trả id mảnh hoặc undefined;
 * `dai` = số âm tiết của mảnh dài nhất.
 * @param {string} doan
 * @param {(khoa: string) => string | undefined} tra
 * @param {number} dai
 * @returns {{ text: string; ids: string[] | null }[]}
 */
export function ghepManh(doan, tra, dai) {
  const w = vietThanhNoi(doan).split(" ").filter(Boolean);
  const k = w.map(khoaAmTiet);
  /** @type {{ a: number; b: number; id: string | null }[]} */
  const seg = [];
  for (let i = 0; i < w.length; ) {
    let hit = null;
    for (let n = Math.min(dai, w.length - i); n >= 1; n--) {
      const id = tra(k.slice(i, i + n).join(" "));
      if (id) {
        hit = { a: i, b: i + n, id };
        break;
      }
    }
    if (hit) {
      seg.push(hit);
      i = hit.b;
    } else {
      const last = seg[seg.length - 1];
      if (last && last.id === null) last.b = i + 1;
      else seg.push({ a: i, b: i + 1, id: null });
      i++;
    }
  }
  // tên riêng: khúc thiếu có chữ hoa ⇒ nuốt các khúc mp3 sát bên toàn chữ hoa
  const hoa = (j) => w[j] !== w[j].toLowerCase();
  const toanHoa = (s) => {
    for (let j = s.a; j < s.b; j++) if (!hoa(j) || j === 0) return false;
    return true;
  };
  for (let x = 0; x < seg.length; x++) {
    const s = seg[x];
    if (s.id !== null) continue;
    let coHoa = false;
    for (let j = s.a; j < s.b; j++) if (hoa(j)) coHoa = true;
    if (!coHoa) continue;
    while (x > 0 && seg[x - 1].id !== null && toanHoa(seg[x - 1])) {
      s.a = seg[x - 1].a;
      seg.splice(x - 1, 1);
      x--;
    }
    while (x + 1 < seg.length && toanHoa(seg[x + 1])) {
      s.b = seg[x + 1].b;
      seg.splice(x + 1, 1);
    }
  }
  /** @type {{ text: string; ids: string[] | null }[]} */
  const out = [];
  for (const s of seg) {
    const text = w.slice(s.a, s.b).join(" ");
    const prev = out[out.length - 1];
    if (s.id === null) {
      if (prev && prev.ids === null) prev.text += ` ${text}`;
      else out.push({ text, ids: null });
    } else if (prev && prev.ids) {
      prev.text += ` ${text}`;
      prev.ids.push(s.id);
    } else out.push({ text, ids: [s.id] });
  }
  return out;
}
