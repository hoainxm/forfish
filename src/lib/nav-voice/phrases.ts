// CHẾ ĐỘ ĐANG CHẠY — CÂU ĐỌC TIẾNG VIỆT (thuần, không DOM).
//
// Câu cảnh báo trong app viết cho MẮT ("600 m", "2–4 m", "±80 m", "—"). Máy
// đọc thì "m" thành "mờ", gạch nối thành im lặng, ± bị bỏ. File này đổi câu
// chữ sang câu NÓI — một chỗ duy nhất, có test từng ca (doc 15 §6.11).
//
// Luật câu nói (doc 15 §6.12 + 7c): ngắn, có số, không hỏi lại, KHÔNG ra lệnh
// ("bẻ lái", "giảm ga"), KHÔNG "an toàn", KHÔNG "South China Sea".

import { windDirectionVN } from "@/lib/marine-weather";

export type SpeechUnit = "nm" | "km";

const KM_PER_NM = 1.852;

/** "2,5" → "2,5"; số nguyên giữ nguyên; bỏ ",0". Dấu phẩy thập phân kiểu VN. */
export function numVN(n: number, digits = 1): string {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits).replace(/0+$/, "").replace(".", ",");
}

/**
 * Quãng đường để ĐỌC. Làm tròn theo tầm cho tai nghe một lần là nhớ:
 *  · < 2 km  → trăm mét ("chừng 400 mét"), dưới 100 m → "chưa tới 100 mét"
 *  · km: < 10 → 1 chữ số lẻ, ≥ 10 → số nguyên — đọc "cây số"
 *  · hải lý: < 10 → 1 chữ số lẻ, ≥ 10 → số nguyên
 */
export function distSpeech(km: number, unit: SpeechUnit): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 0.1) return "chưa tới 100 mét";
  if (km < 2) return `${Math.round(km * 10) * 100} mét`;
  if (unit === "km") return `${numVN(km, km < 10 ? 1 : 0)} cây số`;
  const nm = km / KM_PER_NM;
  return `${numVN(nm, nm < 10 ? 1 : 0)} hải lý`;
}

/** Sóng: 2,5 → "2 mét rưỡi"; 2 → "2 mét"; 1,3 → "1,3 mét"; 0,4 → "dưới nửa mét". */
export function waveSpeech(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < 0.5) return "dưới nửa mét";
  const half = Math.round(m * 2) / 2;
  if (Math.abs(half - m) <= 0.1) {
    const whole = Math.floor(half);
    if (half === whole) return `${whole} mét`;
    return whole === 0 ? "nửa mét" : `${whole} mét rưỡi`;
  }
  return `${numVN(m, 1)} mét`;
}

/** Tốc độ tàu đọc theo đơn vị bà con chọn: "7 hải lý một giờ" / "13 cây số một giờ". */
export function speedSpeech(kmh: number, unit: SpeechUnit): string {
  if (unit === "km") return `${Math.round(kmh)} cây số một giờ`;
  return `${Math.round(kmh / KM_PER_NM)} hải lý một giờ`;
}

/** Hướng 8 phía tiếng Việt. */
export function dirSpeech(deg: number): string {
  return windDirectionVN(deg);
}

/** epoch ms → "7 giờ sáng" / "3 giờ 30 chiều" / "10 giờ tối" (giờ VN). */
export function clockSpeech(ms: number): string {
  const d = new Date(ms + 7 * 3600_000);
  // làm tròn 5 phút cho tai nghe; 7:58 → "8 giờ"
  const total = (d.getUTCHours() * 60 + Math.round(d.getUTCMinutes() / 5) * 5) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const buoi = h < 11 ? "sáng" : h < 13 ? "trưa" : h < 18 ? "chiều" : "tối";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} giờ${m ? ` ${m}` : ""} ${buoi}`;
}

/** Tuổi tin: "tin lúc 7 giờ sáng" khi < 2 giờ; "tin cũ 5 giờ" / "tin cũ 2 ngày" khi già hơn. */
export function ageSpeech(atMs: number | null, nowMs: number): string {
  if (atMs == null || !Number.isFinite(atMs)) return "chưa rõ giờ tin";
  const age = nowMs - atMs;
  if (age < 2 * 3600_000) return `tin lúc ${clockSpeech(atMs)}`;
  const h = Math.round(age / 3600_000);
  if (h < 48) return `tin cũ ${h} giờ`;
  return `tin cũ ${Math.round(h / 24)} ngày`;
}

/**
 * Câu HIỂN THỊ → câu NÓI. Áp cho mọi câu đi qua loa (kể cả câu của
 * `nav-hazards` và `nav-context` viết sẵn cho HUD).
 */
export function toSpeechVN(text: string): string {
  let s = text;
  s = s.replace(/±\s*/g, "sai số ");
  s = s.replace(/(\d)\s*[–-]\s*(\d)/g, "$1 đến $2");
  s = s.replace(/\s*[—–]\s*/g, ", ");
  s = s.replace(/\s*\(([^)]*)\)/g, ", $1");
  // đơn vị đứng riêng sau số — không đụng chữ "m" trong từ khác
  s = s.replace(/(\d)\s*km\b/g, "$1 cây số");
  s = s.replace(/(\d)\s*m\b/g, "$1 mét");
  s = s.replace(/(\d)\s*hl\b/g, "$1 hải lý");
  s = s.replace(/(\d)\s*°/g, "$1 độ");
  s = s.replace(/~\s*/g, "chừng ");
  s = s.replace(/\s*\/\s*/g, " trên ");
  s = s.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").replace(/,\s*,/g, ",");
  s = s.replace(/,\s*\./g, ".");
  return s.trim();
}

/** Từ CẤM trong câu nói (doc 15 §6.12): câu nào dính là lỗi viết câu. */
export const FORBIDDEN_SPEECH = [
  /an toàn/i,
  /bẻ lái/i,
  /giảm ga/i,
  /south china sea/i,
  /không có (đá|rạn|gì) (ngầm )?phía trước/i,
];

export function speechIsClean(s: string): boolean {
  return !FORBIDDEN_SPEECH.some((r) => r.test(s));
}

/** Số từ của câu — trần độ dài câu cảnh báo (≤ 30 từ, Labiale/FHWA ~7–9 ý). */
export function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export const KM_PER_NM_SPEECH = KM_PER_NM;
