// TRỢ LÝ — CHUẨN HOÁ CÂU NÓI (thuần, 14 §4.1).
//
// Thứ tự cố định: foldVn (tái dùng lib/market/text) → số tiếng Việt → số → đồng
// nghĩa → gộp khoảng trắng → cắt 300 ký tự. Mọi regex ở parse chạy trên CHUỖI
// ĐÃ QUA ĐÂY, nên đây là chỗ duy nhất biết "bữa nay" = "hôm nay" hay "nhớt" =
// "dầu nhớt". Không đọc window/localStorage/fetch — test Vitest không cần jsdom.
//
// Vì sao ĐỒNG NGHĨA ở đây ÍT hơn bảng gợi ý của 14 §4.1: sau foldVn, nhiều chữ
// đâm nhau ("mua" = mua/mưa, "dong" = dông/đông/đóng/đồng ý, "nam" = năm/5,
// "muoi" = mười/muối, "may" = máy/mấy, "vay" = vay/vậy). Gộp bừa ở tầng này
// là làm hỏng ý ở tầng sau mà không thấy. Nên chỉ gộp thứ KHÔNG đâm nhau; phần
// còn lại để regex của intents.ts tự liệt kê các biến thể.

import { foldVn } from "@/lib/market/text";

export const MAX_UTTERANCE_CHARS = 300;

/** Đơn vị đếm vật tư — giữ lại làm slot `unit` (13 §11 #11). */
export const UNIT_WORDS = [
  "cay", "thung", "bao", "lit", "kg", "ky", "can", "chai", "cuon", "bo", "cai",
  "thanh", "met", "m", "goi", "hop", "tui", "chiec", "cuc", "vien", "phuy", "binh", "ta",
] as const;

/** Chữ đứng sau một số đếm thì số đó CHẮC là số (không phải "một" = ngày mốt,
 *  "ba" = bà, "nam" = năm). Gồm đơn vị vật tư + vài danh từ đếm được khác. */
const NUMBER_TRIGGERS = new Set<string>([
  ...UNIT_WORDS,
  "ngay", "bua", "tuan", "nguoi", "tau", "mon", "lan", "gio", "phut", "thang",
]);

const ONES: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
};
/** Số lượng ước ("vài", "mấy") — chỉ có nghĩa khi đứng trước đơn vị. */
const VAGUE: Record<string, number> = { vai: 3, may: 3 };
/** Nhân tử. `ta` (tá) = 12 chỉ khi đứng sau số ("nửa tá", "một tá"). */
const MULT: Record<string, number> = { muoi: 10, chuc: 10, tram: 100, ta: 12 };

/**
 * "hai" → 2, "mười lăm" → 15, "hai mươi" → 20, "hai chục" → 20, "hai mươi lăm"
 * → 25, "một trăm" → 100, "nửa tá" → 6, "nửa" → 0.5. Tối đa 3 từ. `null` khi
 * không phải số. Đầu vào là chuỗi ĐÃ foldVn.
 */
export function vnNumberToInt(words: string): number | null {
  const w = foldVn(words).split(" ").filter(Boolean);
  if (w.length === 0 || w.length > 3) return null;
  if (/^\d+([.,]\d+)?$/.test(w.join(""))) return Number(w.join("").replace(",", "."));
  let total = 0;
  let cur = 0;
  let sawNumber = false;
  for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (t === "nua") {
      cur = 0.5;
      sawNumber = true;
      continue;
    }
    if (t in ONES) {
      cur = ONES[t];
      sawNumber = true;
      continue;
    }
    if (t in VAGUE && w.length === 1) return VAGUE[t];
    if (t in MULT) {
      if (t === "ta" && !sawNumber) return null;
      if (t === "chuc" && !sawNumber) cur = 1; // "chục" trần = 10
      if (t === "muoi" && !sawNumber) cur = 1; // "mười" trần = 10
      if (t === "tram" && !sawNumber) return null;
      total += (cur || 1) * MULT[t];
      cur = 0;
      sawNumber = true;
      continue;
    }
    return null;
  }
  if (!sawNumber) return null;
  return total + cur;
}

/** Có phải một từ số / nhân tử / "nửa" không (để dò chuỗi số trong câu). */
function isNumberWord(t: string): boolean {
  return t in ONES || t in MULT || t === "nua" || t in VAGUE;
}

/**
 * Đổi CHUỖI SỐ TIẾNG VIỆT trong câu thành số. Luật an toàn (chống "mốt" = ngày
 * kia, "bà"/"năm"/"muối"/"máy" thành số): một chuỗi từ chỉ được đổi khi
 *   (a) có nhân tử THẬT ("hai mươi", "một chục", "nửa tá") — trừ "mười"/"chục"
 *       đứng một mình phải có đơn vị theo sau ("mười thùng" đổi, "bao muối" không);
 *   (b) hoặc từ kế tiếp là đơn vị / danh từ đếm được (NUMBER_TRIGGERS).
 * Số đã là chữ số thì bỏ số 0 đầu ("02" → "2").
 */
export function convertNumberWords(s: string): string {
  const w = s.split(" ").filter(Boolean);
  const out: string[] = [];
  const goods = new Set<string>(UNIT_WORDS);
  let i = 0;
  while (i < w.length) {
    if (/^\d+([.,]\d+)?$/.test(w[i])) {
      out.push(String(Number(w[i].replace(",", "."))));
      i++;
      continue;
    }
    if (!isNumberWord(w[i])) {
      out.push(w[i]);
      i++;
      continue;
    }
    // gom tối đa 3 từ số liên tiếp
    let j = i;
    while (j < w.length && j - i < 3 && isNumberWord(w[j])) j++;
    let converted = false;
    for (let len = j - i; len >= 1 && !converted; len--) {
      const seq = w.slice(i, i + len);
      const after = w[i + len];
      const head = seq[0];
      const hasStrongMult =
        seq.some((t, k) => (t === "tram" || t === "ta") && k > 0) ||
        (seq.length >= 2 && seq.some((t) => t === "muoi" || t === "chuc"));
      const followedByGoods = after != null && goods.has(after);
      const followedByUnit = after != null && NUMBER_TRIGGERS.has(after);
      // "muối" (salt) đứng SAU đơn vị là danh từ, không phải 10
      const prevIsUnit = out.length > 0 && NUMBER_TRIGGERS.has(out[out.length - 1]);
      if (seq.length === 1 && (head === "muoi" || head === "chuc") && prevIsUnit) break;
      /*  Chữ vừa là số vừa là từ thường HAY GẶP ("từ", "làm", "sau", "mấy",
          "vài") chỉ được là số khi đứng ngay trước ĐƠN VỊ VẬT TƯ — "từ ngày
          mai", "sau ngày mai", "mấy người" phải giữ nguyên chữ. */
      const risky = head === "tu" || head === "lam" || head === "sau" || head in VAGUE;
      if (risky && !followedByGoods) continue;
      if (!hasStrongMult && !followedByUnit) continue;
      const n = vnNumberToInt(seq.join(" "));
      if (n == null) continue;
      out.push(String(n));
      i += len;
      converted = true;
    }
    if (!converted) {
      out.push(w[i]);
      i++;
    }
  }
  return out.join(" ");
}

/**
 * Đồng nghĩa → dạng chuẩn. Áp THEO THỨ TỰ, ranh giới từ (chuỗi đã foldVn nên
 * `\b` chạy đúng). Chỉ gộp thứ không đâm chữ khác — xem ghi chú đầu file.
 */
export const SYNONYMS: [RegExp, string | ((m: string, ...g: string[]) => string)][] = [
  // ── thời gian ──
  [/\b(bua nay|hnay|hum nay|hom nay)\b/g, "hom nay"],
  [/\b(sang mai|toi mai|chieu mai|ngay mai|sang ngay mai)\b/g, "ngay mai"],
  // KHÔNG lookbehind (Safari <16.4 chết cả chunk — safari-cu.test.ts): giữ nguyên khi đã có "ngay " đứng trước
  [/\b(ngay )?mai\b(?! moc)/g, (m, pre) => (pre ? m : "ngay mai")],
  [/\b(ngay mot|ngay kia|bua kia|bua mot)\b/g, "ngay kia"],
  // "mốt" đứng một mình (không theo sau "ngay"/"bua", và không phải số 1 đã đổi ở bước trước)
  [/\b(ngay |bua )?mot\b/g, (m, pre) => (pre ? m : "ngay kia")],
  [/\b(tuan toi|tuan sau)\b/g, "tuan sau"],
  // ── đá ──
  [/\b(nuoc da|da lanh|da cuc|da xay)\b/g, "da"],
  // ── dầu ──
  [/\b(dau diesel|dau chay may|dau di ze n|dau dizen|diesel)\b/g, "dau do"],
  [/\bdau (nhot|boi tron|may nhot)\b/g, "dau nhot"],
  [/\b(dau )?(nhot may|nhot)\b/g, (m, pre) => (pre ? m : "dau nhot")],
  // ── thời tiết ──
  [/\b(song bien|song lon|song to|song cao)\b/g, "song"],
  [/\b(sam set|sam chop|dong set|dong sam)\b/g, "dong"],
  // ── chợ / gọi ──
  [/\b(sd vico|es di vi co|cong ty sdvico|tong dai sdvico|hang sdvico)\b/g, "sdvico"],
  [/\b(dien thoai cho|goi dien cho|goi cho|goi dien|bam so cho|bam so)\b/g, "goi"],
  [/\b(dang ship|ship toi|ship den|giao toi)\b/g, "dang giao"],
  [/\b(dat hang cua toi|don dat hang|don hang)\b/g, "don"],
  [/\bhang da (toi|ve|den)\b/g, "hang $1"],
  // ── xưng hô / đệm ──
  [/\b(tui|minh|tao)\b(?= (co|can|muon|hay|dang|cua))/g, "toi"],
  [/\b(hong|hok|ko|k|hem)\b/g, "khong"],
  [/\bkhong (vay|ta|he|ha|a|nhe|nha)\b/g, "khong"],
  // đệm cuối câu — bỏ để regex anchor `$` khớp ("gọi SDVICO giúp", "im đi", "hả")
  [/\s(gium|giup|giup toi|gium toi|giup tui|gium tui|cho toi|di|nhe|ha|a|ne|nghen|nhen|voi|vay|ta|he|coi|xem)$/g, ""],
  // "nha" cuối câu là đệm ("mở chợ nha") — trừ "cảng nhà" / "về nhà" là danh từ
  [/\s(cang nha|ve nha|nha)$/g, (m, w) => (w === "nha" ? "" : m)],
];

/** Bước 3 riêng lẻ (để test từng bảng). */
export function applySynonyms(s: string): string {
  let out = s;
  for (const [re, rep] of SYNONYMS) {
    out = typeof rep === "string" ? out.replace(re, rep) : out.replace(re, rep);
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * `normalizeUtterance(text)` — 14 §4.1. KHÔNG BAO GIỜ ném; rỗng → "".
 */
export function normalizeUtterance(text: string): string {
  const folded = foldVn(String(text ?? "")).slice(0, MAX_UTTERANCE_CHARS);
  if (!folded) return "";
  const withNumbers = convertNumberWords(folded);
  // đệm cuối câu có thể lặp ("giùm nha") — áp hai lượt cho sạch
  const s1 = applySynonyms(withNumbers);
  const s2 = applySynonyms(s1);
  return s2.slice(0, MAX_UTTERANCE_CHARS).trim();
}

const UNIT_RE = UNIT_WORDS.join("|");

/**
 * Bắt "N đơn-vị phần-còn-lại" ở ĐẦU chuỗi (đã normalize): "2 thung dau nhot" →
 * { qty 2, unit "thung", rest "dau nhot" }. `null` khi không có số đứng đầu.
 * qty kẹp 1..999 (13 INT-14) — 0,5 → 1.
 */
export function extractQty(normalized: string): { qty: number; unit?: string; rest: string } | null {
  const m = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(?:(${UNIT_RE})\\b)?\\s*(.*)$`).exec(normalized.trim());
  if (!m) return null;
  const raw = Number(m[1].replace(",", "."));
  if (!Number.isFinite(raw)) return null;
  const qty = Math.max(1, Math.min(999, Math.round(raw)));
  const unit = m[2] || undefined;
  return { qty, unit, rest: (m[3] ?? "").trim() };
}

/** Đơn vị đã fold → chữ có dấu để hiện/đọc ("thung" → "thùng"). */
export const UNIT_DISPLAY: Record<string, string> = {
  cay: "cây", thung: "thùng", bao: "bao", lit: "lít", kg: "kg", ky: "ký", can: "can", chai: "chai", cuon: "cuộn",
  bo: "bộ", cai: "cái", thanh: "thanh", met: "mét", m: "m", goi: "gói", hop: "hộp", tui: "túi", chiec: "chiếc",
  cuc: "cục", vien: "viên", phuy: "phuy", binh: "bình", ta: "tá",
};

/** Chữ đồng nghĩa đã gộp (SYNONYMS) → chữ có dấu, dùng khi câu gốc không có chữ đó. */
const WORD_DISPLAY: Record<string, string> = {
  dau: "dầu", nhot: "nhớt", da: "đá", do: "DO", muoi: "muối", song: "sóng", gio: "gió", ngay: "ngày", mai: "mai",
};

/**
 * Trả lại CHỮ CÓ DẤU của một cụm đã fold, lấy từ câu gốc bà con nói (audit P1-5:
 * "dau nhot", "bai muc" hiện trên màn là chữ máy, không phải chữ người).
 * Ưu tiên cụm liền nhau trong câu gốc; không có thì ghép từng chữ (chữ nào câu
 * gốc không có — vì đồng nghĩa đã đổi, "nhớt" → "dau nhot" — tra bảng nhỏ);
 * còn lại giữ nguyên dạng fold (không bịa dấu).
 */
export function rawSlot(original: string, folded: string): string {
  const want = (folded ?? "").trim().split(" ").filter(Boolean);
  if (want.length === 0) return "";
  const tokens = String(original ?? "")
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  const folds = tokens.map((t) => foldVn(t));
  // cụm liền nhau — lấy cụm CUỐI: món/tên thường đứng cuối câu ("tôi đã mua đá" → "đá", không phải "đã")
  for (let i = folds.length - want.length; i >= 0; i--) {
    let ok = true;
    for (let j = 0; j < want.length; j++) {
      if (folds[i + j] !== want[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return tokens.slice(i, i + want.length).join(" ");
  }
  // từng chữ, đi tới (không quay lui để "đã"/"đá" không lẫn nhau)
  const out: string[] = [];
  let from = 0;
  for (const w of want) {
    const at = folds.indexOf(w, from);
    if (at >= 0) {
      out.push(tokens[at]);
      from = at + 1;
    } else {
      out.push(WORD_DISPLAY[w] ?? w);
    }
  }
  return out.join(" ");
}

/** Số chữ (từ) trong câu đã normalize — ngưỡng 40 chữ (13 INT-27). */
export function wordCount(normalized: string): number {
  return normalized ? normalized.split(" ").filter(Boolean).length : 0;
}
