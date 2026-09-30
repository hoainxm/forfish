// TRỢ LÝ — ĐỌC GÓI NÃO + TÌM TRONG KHO (thuần; ADR 0010 P1, contract
// docs/contracts/tro-ly-brain-pack.contract.md).
//
// Hai việc, cả hai KHÔNG sinh chữ:
//  · `searchKnowledge` — câu hỏi mở ("ướp cá ngừ sao cho tươi") tìm trong kho FAQ
//    ĐÃ DUYỆT bằng BM25 nhỏ trên từ đã `foldVn`. Có cổng bằng chứng: câu hỏi phải
//    chứa trọn ÍT NHẤT MỘT từ khoá của mục và phủ đủ phần lớn chữ có nghĩa — không
//    đủ thì trả `null` ("chưa có trong máy"), KHÔNG cố trả lời gần đúng.
//  · `buildAudioMap` — câu cố định (answers) → mp3 giọng Sen Biển sinh sẵn ở bờ.
//
// Không window/fetch/localStorage — chạy được ở client (brain-pack.ts nạp từ kho
// riêng) lẫn máy chủ (tool `tra_kho` của tầng mạng đọc cùng file đã phát hành).

import { foldVn } from "@/lib/market/text";
import { toSpeech } from "./answer";
import type { AssistantReply } from "./types";

/* ───────────────── shape trong gói (contract v1) ───────────────── */

export interface KnowledgeItem {
  id: string;
  cauHoiMau: string[];
  tuKhoa: string[];
  traLoi: string;
  nguon: string;
  /** ISO yyyy-mm-dd — người duyệt soát gần nhất */
  ngaySoat: string;
  chipMoMan?: string;
}

export interface AnswerItem {
  /** tuỳ chọn — mã câu trong catalog giọng (một ý định có thể có nhiều câu cố định) */
  id?: string;
  intentId: string;
  /** câu app ĐỌC (đúng nguyên văn `reply.speak`) — khoá tra mp3 */
  text: string;
  mp3?: { bac?: string; nam?: string };
}

export type VoiceRegion = "bac" | "nam";

const ID_RE = /^[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Đường gói: tương đối, không `..`, không bắt đầu bằng `/` (contract §manifest). */
export const PACK_PATH_RE = /^(?!\/)(?!.*\.\.)[a-zA-Z0-9_./-]+$/;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

/** Đếm câu (dấu kết câu có khoảng trắng/hết chuỗi theo sau — "1.430.000" không phải 3 câu). */
function sentenceCount(text: string): number {
  return text.split(/[.!?…]+(?=\s|$)/).filter((s) => s.trim()).length;
}

/** Route nội bộ an toàn cho chip "mở màn liên quan": `/x...`, không `//` (mở ra ngoài). */
function internalHref(v: unknown): string | undefined {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && v.length <= 80 ? v : undefined;
}

/**
 * `knowledge.v1.json` → mục HỢP LỆ. Mục sai luật contract (thiếu nguồn/ngày soát,
 * >4 câu, id trùng) bị BỎ — gói hỏng một mục không được làm hỏng cả kho. Validator
 * ở bờ (`validate-brain-pack.mjs`) chặn trước khi phát hành; đây là lưới thứ hai.
 */
export function parseKnowledge(json: unknown): KnowledgeItem[] {
  const muc = (json as { muc?: unknown })?.muc;
  if (!Array.isArray(muc)) return [];
  const seen = new Set<string>();
  const out: KnowledgeItem[] = [];
  for (const raw of muc) {
    const m = raw as Record<string, unknown>;
    const id = typeof m?.id === "string" ? m.id : "";
    const traLoi = typeof m?.traLoi === "string" ? m.traLoi.trim() : "";
    const nguon = typeof m?.nguon === "string" ? m.nguon.trim() : "";
    const ngaySoat = typeof m?.ngaySoat === "string" ? m.ngaySoat : "";
    const cauHoiMau = strList(m?.cauHoiMau);
    const tuKhoa = strList(m?.tuKhoa);
    if (!ID_RE.test(id) || seen.has(id)) continue;
    if (!traLoi || sentenceCount(traLoi) > 4 || !nguon || !DATE_RE.test(ngaySoat)) continue;
    if (cauHoiMau.length === 0 || tuKhoa.length === 0) continue;
    seen.add(id);
    const chip = internalHref(m.chipMoMan);
    out.push({ id, cauHoiMau, tuKhoa, traLoi, nguon, ngaySoat, ...(chip ? { chipMoMan: chip } : {}) });
  }
  return out;
}

/** `answers.v1.json` → câu cố định hợp lệ (đường mp3 phải đúng khuôn đường gói). */
export function parseAnswers(json: unknown): AnswerItem[] {
  const list = (json as { answers?: unknown })?.answers;
  if (!Array.isArray(list)) return [];
  const out: AnswerItem[] = [];
  for (const raw of list) {
    const a = raw as Record<string, unknown>;
    const text = typeof a?.text === "string" ? a.text.trim() : "";
    const intentId = typeof a?.intentId === "string" ? a.intentId : "";
    if (!text || !intentId) continue;
    const mp3Raw = (a.mp3 ?? {}) as Record<string, unknown>;
    const mp3: AnswerItem["mp3"] = {};
    for (const r of ["bac", "nam"] as const) {
      const p = mp3Raw[r];
      if (typeof p === "string" && PACK_PATH_RE.test(p)) mp3[r] = p;
    }
    out.push({
      ...(typeof a.id === "string" ? { id: a.id } : {}),
      intentId, text,
      ...(mp3.bac || mp3.nam ? { mp3 } : {}),
    });
  }
  return out;
}

/* ───────────────── kho: BM25 nhỏ + cổng bằng chứng ───────────────── */

/**
 * Chữ không mang nghĩa tra cứu (đã fold). Bỏ đi để "bác ơi cho tôi hỏi cá ngừ
 * ướp sao" chỉ còn "ca ngu uop" đi so — không thì chữ đệm kéo điểm mục bất kỳ.
 */
const STOP = new Set(
  (
    "bac oi a a ha nhe nha di thi la cua va voi cho toi toi minh em anh chu co khong ko k gi nao sao the nhu " +
    "the nao ra sao lam sao bang cach nao duoc bi can phai nen hay hoac ma de o tai trong ngoai tren duoi " +
    "mot nhung cac may nay kia do day vay roi chua dang se da hoi xin giup coi xem biet muon noi"
  ).split(" "),
);

function words(text: string): string[] {
  return foldVn(text).split(" ").filter(Boolean);
}

/** Từ có nghĩa + cặp liền nhau (bigram) — "ca ngu" khớp trọn tốt hơn "ca" + "ngu" rời. */
function terms(text: string): string[] {
  const w = words(text).filter((x) => !STOP.has(x));
  const out = [...w];
  for (let i = 0; i + 1 < w.length; i++) out.push(`${w[i]}_${w[i + 1]}`);
  return out;
}

interface DocStat {
  item: KnowledgeItem;
  tf: Map<string, number>;
  len: number;
  /** từ khoá đã fold, tách chữ — khớp khi câu hỏi có ĐỦ mọi chữ của một từ khoá (không cần liền nhau:
   *  "máy tàu bị NÓNG" vẫn khớp "máy nóng") */
  keys: string[][];
}

/** Câu hỏi đòi SỐ SỐNG (giá, tiền) — kho không bao giờ trả lời (contract: số sống chỉ từ snapshot/tool). */
const LIVE_Q = /\b(gia|tien|bao nhieu tien|may tien)\b/;

export interface KnowledgeIndex {
  docs: DocStat[];
  df: Map<string, number>;
  avgLen: number;
}

export function buildKnowledgeIndex(items: readonly KnowledgeItem[]): KnowledgeIndex {
  const df = new Map<string, number>();
  const docs: DocStat[] = items.map((item) => {
    // từ khoá tính HAI lần — chúng là thứ người duyệt chọn làm lõi của mục
    const all = [...item.cauHoiMau.flatMap(terms), ...item.tuKhoa.flatMap(terms), ...item.tuKhoa.flatMap(terms)];
    const tf = new Map<string, number>();
    for (const t of all) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    const keys = item.tuKhoa.map((k) => words(k)).filter((k) => k.length > 0);
    return { item, tf, len: all.length, keys };
  });
  const avgLen = docs.length ? docs.reduce((s, d) => s + d.len, 0) / docs.length : 1;
  return { docs, df, avgLen };
}

const K1 = 1.2;
const B = 0.75;
/** Phần chữ có nghĩa của câu hỏi phải nằm trong mục (0..1). Dưới mức này = mục chỉ trùng vài chữ lẻ. */
export const KNOWLEDGE_MIN_COVERAGE = 0.5;
/** Điểm BM25 tối thiểu. nợ: hiệu chỉnh τ trên eval set nghề cá (doc 10 §1.1), nâng khi kho >50 mục */
export const KNOWLEDGE_MIN_SCORE = 1.5;

export interface KnowledgeHit {
  item: KnowledgeItem;
  score: number;
  coverage: number;
}

/**
 * Tìm mục trả lời câu hỏi. `null` = không đủ bằng chứng (abstention-first): câu
 * hỏi phải chứa đủ chữ của ≥1 từ khoá của mục + phủ ≥50% chữ có nghĩa + điểm ≥ τ,
 * và KHÔNG hỏi giá/tiền (số sống không bao giờ lấy từ kho).
 */
export function searchKnowledge(index: KnowledgeIndex, text: string): KnowledgeHit | null {
  const n = index.docs.length;
  if (n === 0) return null;
  const qTerms = terms(text);
  const qWords = qTerms.filter((t) => !t.includes("_"));
  if (qWords.length === 0) return null;
  const qAll = words(text);
  if (LIVE_Q.test(qAll.join(" "))) return null;
  const qSet = new Set(qAll);
  let best: KnowledgeHit | null = null;
  for (const d of index.docs) {
    if (!d.keys.some((k) => k.every((w) => qSet.has(w)))) continue;
    let score = 0;
    for (const t of new Set(qTerms)) {
      const f = d.tf.get(t);
      if (!f) continue;
      const nt = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (n - nt + 0.5) / (nt + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avgLen)));
    }
    const hitWords = qWords.filter((w) => d.tf.has(w)).length;
    const coverage = hitWords / qWords.length;
    if (coverage < KNOWLEDGE_MIN_COVERAGE || score < KNOWLEDGE_MIN_SCORE) continue;
    if (!best || score > best.score) best = { item: d.item, score, coverage };
  }
  return best;
}

/** "2026-09-01" → "9/2026" (dòng nguồn dưới câu trả lời). */
function monthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${Number(m[2])}/${m[1]}` : iso;
}

/**
 * Câu trả lời từ kho: chữ = đúng `traLoi` đã duyệt (≤4 câu, đọc trọn — cắt còn 2
 * câu là mất nửa cách làm), dòng nguồn riêng, chip mở màn liên quan nếu có.
 */
export function knowledgeReply(hit: KnowledgeHit): AssistantReply {
  const { item } = hit;
  return {
    text: item.traLoi,
    speak: toSpeech(item.traLoi),
    source: "offline",
    intent: "hoi_mo",
    sourceNote: `Theo ${item.nguon} · SDVICO soát ${monthYear(item.ngaySoat)}`,
    ...(item.chipMoMan ? { action: { type: "navigate" as const, href: item.chipMoMan } } : {}),
  };
}

/* ───────────────── giọng sinh sẵn ───────────────── */

/** Khoá so câu đọc ↔ mp3: giữ dấu (dấu đổi nghĩa), bỏ hoa/thường + khoảng trắng thừa + dấu câu cuối. */
export function speakKey(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").replace(/[.!?…\s]+$/, "").trim();
}

export function buildAudioMap(answers: readonly AnswerItem[]): Map<string, { bac?: string; nam?: string }> {
  const m = new Map<string, { bac?: string; nam?: string }>();
  for (const a of answers) if (a.mp3) m.set(speakKey(a.text), a.mp3);
  return m;
}

/**
 * Vùng giọng theo tỉnh cảng nhà: Nam Bộ → Mỹ Duyên (`nam`), còn lại → Trúc Ly
 * (`bac`, dùng cho cả Bắc + Trung — chốt 2026-09-08). Nhận cả tên tỉnh cũ lẫn tên
 * sau sáp nhập 2025. Chưa đặt cảng nhà → `bac`.
 */
const NAM_BO = [
  "ho chi minh", "hcm", "sai gon", "ba ria", "vung tau", "binh duong", "dong nai", "long an", "tien giang", "dong thap",
  "ben tre", "vinh long", "tra vinh", "can tho", "hau giang", "soc trang", "bac lieu", "ca mau", "kien giang",
  "an giang", "tay ninh", "binh phuoc",
];

export function voiceRegion(province: string | null | undefined): VoiceRegion {
  const p = foldVn(province ?? "");
  return p && NAM_BO.some((k) => p.includes(k)) ? "nam" : "bac";
}
