// TRỢ LÝ — CÂU TRẢ LỜI TẦNG MÁY (thuần, 14 §4.3; câu chữ theo 13 §3).
//
// `answerOffline(parsed, snapshot, now)` chỉ đọc `DeviceSnapshot` — không
// window, không localStorage, không fetch — nên chạy được ở cả client lẫn
// mock máy chủ. Luật không thoả hiệp: mọi số đi kèm mốc "lưu lúc"
// (`savedAgoLabel` tái dùng), nói bão thì luôn nhắc đài duyên hải, thiếu dữ
// liệu thì nói "máy chưa có" — không bịa, không đổ cho sóng.

import { SDVICO_HOTLINE, SDVICO_HOTLINE_DISPLAY } from "@/data/sdvico-showcase";
import { addDaysIso, todayIsoVN } from "@/lib/days";
import { foldVn } from "@/lib/market/text";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { STORM_MAX_AGE_MS } from "@/lib/storms";
import { weatherFromCode } from "@/lib/weather-codes";
import { SCREEN_LABEL } from "./intents";
import { blockReasonOf } from "./parse";
import { ALL_PORT_NAMES, matchPortKeys, nearPortKeys, portByKey } from "./ports";
import { suggestionsFor } from "./suggestions";
import type {
  AssistantErrorCode, AssistantReply, DeviceSnapshot, Intent, ParsedIntent, SeaDaySummary, Suggestion,
} from "./types";
import { SCREEN_HREF } from "./types";

/* ───────────────── định dạng đời thường ───────────────── */

/** 1430000 → "1.430.000 đ" */
export function fmtVnd(n: number): string {
  const r = Math.round(Math.abs(n));
  const s = String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${s} đ`;
}

/** 0.83 → "0,8" · 2 → "2" */
function fmtM(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r).replace(".", ",");
}

/** "2026-09-08" → "8/9" */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])}/${Number(m[2])}` : iso;
}

/** epoch ms → "9 giờ 40" theo giờ VN */
function fmtClockVN(ms: number): string {
  const d = new Date(ms + 7 * 3600_000);
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  return mi === 0 ? `${h} giờ` : `${h} giờ ${String(mi).padStart(2, "0")}`;
}

/** 1430000 → "1 triệu 430 ngàn" — số tiền ĐỌC được (không dấu chấm ngăn ngàn:
 *  "1.430.000" đọc thành ba câu, và bộ đếm câu của QA cũng đếm dấu chấm đó). */
export function vndSpeech(n: number): string {
  const v = Math.round(Math.abs(n));
  if (v < 1000) return String(v);
  const trieu = Math.floor(v / 1_000_000);
  const ngan = Math.floor((v % 1_000_000) / 1000);
  const le = v % 1000;
  const parts: string[] = [];
  if (trieu) parts.push(`${trieu} triệu`);
  if (ngan) parts.push(`${ngan} ngàn`);
  if (le && !trieu) parts.push(String(le));
  return parts.join(" ");
}

/** Giữ tối đa `n` câu (13 P5: speak ≤2 câu). Không cắt giữa số thập phân "0,8". */
export function limitSentences(text: string, n: number): string {
  // không lookbehind (Safari <16.4): tách ở dấu kết câu CÓ khoảng trắng/hết chuỗi theo sau
  // ("1.430.000" không phải ba câu). split có nhóm bắt giữ lại dấu ở phần tử lẻ.
  const raw = text.split(/([.!?…]+)(?=\s|$)/);
  const parts: string[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const body = raw[i].trim();
    if (body) parts.push(body + (raw[i + 1] ?? ""));
  }
  return parts.slice(0, n).join(" ").trim();
}

/** Chữ hiện → chữ đọc: đơn vị viết tắt thành lời, số tiền thành lời, bỏ ngoặc/xuống dòng. */
export function toSpeech(text: string): string {
  return text
    .replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (m) => vndSpeech(Number(m.replace(/\./g, ""))))
    .replace(/…/g, ".")
    .replace(/\s+—\s+/g, ", ")
    .replace(/\/100\b/g, " trên 100")
    .replace(/\bkm\/h\b/g, " cây số giờ")
    .replace(/\/kg\b/g, " một ký")
    // đơn vị viết tắt CHỈ khi đứng riêng ngay sau số — `\b` đứng được trước "é"/"ó" nên "1,2 mét"
    // từng thành "métét", "1 món" thành "métón" (audit P1-1); chữ có dấu không phải \w
    .replace(/(\d)\s*km(?![a-zà-ỹ/])/gi, "$1 cây số")
    .replace(/(\d)\s*kg(?![a-zà-ỹ])/gi, "$1 ký")
    // "m" phải có BIÊN SỐ THẬT cả hai phía: mã đơn "SD260904M3RT" từng đọc thành
    // "SD260904 mét 3RT" (audit P2-N1) vì chỉ chặn phía sau. Không lookbehind
    // (Safari <16.4) — bắt luôn ký tự đứng trước vào nhóm 1 rồi trả lại.
    .replace(/(^|[^0-9a-zà-ỹ])(\d+(?:[.,]\d+)?)\s*m(?![0-9a-zà-ỹ])/gi, "$1$2 mét")
    .replace(/(\d|ngàn|triệu)\s*đ(?![a-zà-ỹ])/gi, "$1 đồng") // \b không chạy với chữ có dấu
    .replace(/\(ước\)/g, "ước")
    .replace(/[()]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

/*  "Số lưu 0 phút trước" là câu vô nghĩa với bà con (audit vòng 2 P2-3).
    `savedAgoLabel` dùng chung cho 9 màn khác và có test riêng — KHÔNG đổi hàm
    chung, chỉ đổi đúng chuỗi hỏng ở đây. */
function luuLabel(savedAt: number, now: number): string {
  const s = savedAgoLabel(savedAt, now);
  return s === "lưu 0 phút trước" ? "lưu vừa xong" : s;
}

const DAY_NAME = ["Hôm nay", "Ngày mai", "Ngày kia", "3 ngày tới", "4 ngày tới", "5 ngày tới", "6 ngày tới"];

/** Nhắc bắt buộc mọi câu bão / đi được không (13 §6, AC-T13). */
const NGHE_DAI = "Nghe thêm đài duyên hải.";

/** Câu an toàn KHÔNG BAO GIỜ bị cắt khỏi `speak` (13 §6; audit P1-16: TTS từng nuốt "gọi 115"). */
const SAFETY_RE = /115|đài duyên hải/i;

function sentencesOf(text: string): string[] {
  const raw = text.split(/([.!?…]+)(?=\s|$)/);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const body = raw[i].trim();
    if (body) out.push(body + (raw[i + 1] ?? ""));
  }
  return out;
}

/**
 * `speak` = chữ đọc: đổi đơn vị MỘT lần (`toSpeech`) rồi giữ ≤2 câu. Nhánh nào
 * tự viết `speak` thì viết ở DẠNG HIỆN ("m", "km/h") — không tự viết "mét" rồi
 * bị đổi thêm lần nữa. Câu an toàn (115 / đài duyên hải) nằm ngoài 2 câu đầu
 * thì ghép vào câu cuối bằng dấu phẩy — vẫn 2 câu, không mất dặn dò.
 */
function reply(intent: Intent, text: string, extra: Partial<AssistantReply> = {}): AssistantReply {
  const spoken = toSpeech(extra.speak ?? text);
  let speak = limitSentences(spoken, 2);
  if (SAFETY_RE.test(spoken) && !SAFETY_RE.test(speak)) {
    const safety = sentencesOf(spoken).find((x) => SAFETY_RE.test(x));
    if (safety) {
      const tail = safety.replace(/^./, (c) => c.toLowerCase()).replace(/^nghe thêm/, "bác nghe thêm");
      speak = `${speak.replace(/[.!?…]+$/, "")}, ${tail}`;
    }
  }
  return { text, source: "offline", intent, ...extra, speak };
}

function nav(href: string): Pick<AssistantReply, "action"> {
  return { action: { type: "navigate", href } };
}

function chip(label: string, utterance: string): Suggestion {
  return { label, utterance };
}

/* ───────────────── từng ý định ───────────────── */

function dayLine(d: SeaDaySummary, aspect: ParsedIntent["slots"]["aspect"]): string {
  const uoc = d.waveEstimated ? " (ước)" : "";
  const wx = weatherFromCode(d.wmoCode);
  if (aspect === "song") return `sóng ${fmtM(d.waveMaxM)} m${uoc}`;
  if (aspect === "gio") return `gió ${Math.round(d.windMaxKmh)} km/h${d.gustMaxKmh > d.windMaxKmh + 10 ? `, giật ${Math.round(d.gustMaxKmh)}` : ""}`;
  if (aspect === "mua") return wx ? `${wx.label.toLowerCase()}, mưa ${Math.round(d.precipMm)} mm` : d.precipMm >= 1 ? `mưa ${Math.round(d.precipMm)} mm` : "không mưa";
  const parts = [`điểm đi biển ${d.score}/100`, `sóng ${fmtM(d.waveMaxM)} m${uoc}`, `gió ${Math.round(d.windMaxKmh)} km/h`];
  if (d.gustMaxKmh > d.windMaxKmh + 10) parts.push(`giật ${Math.round(d.gustMaxKmh)}`);
  if (wx) parts.push(wx.label.toLowerCase());
  return parts.join(", ");
}

function answerWeather(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  const aspect = p.slots.aspect ?? "chung";
  const day = Math.max(0, Math.min(6, p.slots.day ?? 0));
  const diDuoc = aspect === "di_duoc";
  if (!s.home && !s.weather) {
    return reply("thoi_tiet", `Bác chưa đặt cảng nhà, nói tên cảng bác hay đi hoặc chọn trong danh sách cảng nhé.${diDuoc ? ` Chưa có số thì đừng đoán — ${NGHE_DAI.toLowerCase()}` : ""}`, {
      clarify: { question: "Bác hay đi từ cảng nào?", options: [chip("Chọn cảng", "mở cảng")] },
    });
  }
  const w = s.weather;
  const portName = w?.portName ?? s.home?.portName ?? "cảng nhà";
  if (p.slots.portName && w && p.slots.portName !== w.portName.toLowerCase() && !foldLike(p.slots.portName, w.portName)) {
    return reply("thoi_tiet", `Máy chỉ có dự báo cảng ${portName}, chưa có cảng bác hỏi. Có sóng thì mở Ra khơi để tải.${diDuoc ? ` ${NGHE_DAI}` : ""}`, nav(SCREEN_HREF.ra_khoi));
  }
  const storm = stormLead(s, now);
  if (!w || w.days.length === 0) {
    return reply("thoi_tiet", diDuoc
      ? `${storm}Máy chưa có dự báo cảng ${portName} để nói đi được hay không. Đừng đoán — ${NGHE_DAI.toLowerCase()}`
      : `${storm}Máy chưa có dự báo cảng ${portName}. Có sóng thì mở Ra khơi để tải.${storm ? "" : ` ${NGHE_DAI}`}`, nav(SCREEN_HREF.ra_khoi));
  }
  const today = todayIsoVN(now);
  const premiumNote = day > 2 && !s.premium;
  const askDay = premiumNote ? 2 : day;
  const target = addDaysIso(today, askDay);
  const d = w.days.find((x) => x.date === target);
  const luu = luuLabel(w.savedAt, now);
  const stale = w.days.every((x) => x.date < today);
  if (stale) {
    return reply("thoi_tiet", `${storm}Dự báo cảng ${portName} trong máy đã cũ (${luu}). Tải lại khi có sóng. ${NGHE_DAI}`, { ...nav(SCREEN_HREF.ra_khoi), savedAt: w.savedAt });
  }
  if (!d) {
    return reply("thoi_tiet", `${storm}Máy chưa có dự báo ${DAY_NAME[askDay].toLowerCase()} cho cảng ${portName} (${luu}). Có sóng thì mở Ra khơi để tải. ${NGHE_DAI}`, { ...nav(SCREEN_HREF.ra_khoi), savedAt: w.savedAt });
  }
  // đọc: câu bão (nếu có) đứng TRƯỚC, số liệu sau; đài duyên hải luôn có (13 §6, AC-T13/T56)
  const spokenStorm = storm ? `${storm.trim().replace(/\.$/, "")}, bác nghe thêm đài duyên hải. ` : "";
  const spokenTail = storm ? `số ${luu}.` : `số ${luu}, bác nghe thêm đài duyên hải.`;
  if (premiumNote) {
    const lines = [0, 1, 2].map((i) => {
      const dd = w.days.find((x) => x.date === addDaysIso(today, i));
      return dd ? `${DAY_NAME[i]} ${dd.score}/100, sóng ${fmtM(dd.waveMaxM)} m` : `${DAY_NAME[i]} chưa có số`;
    });
    const moi = s.online ? " Dự báo quá 3 ngày là phần Premium — gọi SDVICO để mở." : "";
    const text = `${storm}Ba ngày tới ở ${portName}: ${lines.join("; ")}. Số ${luu}.${moi} ${NGHE_DAI}`;
    const speak = `${spokenStorm}Ba ngày tới ở ${portName} ${lines.join(", ")}, ${spokenTail}`;
    return reply("thoi_tiet", text, { ...nav(SCREEN_HREF.ra_khoi), savedAt: w.savedAt, speak });
  }
  if (diDuoc) {
    // P0-1: có bão trong máy thì KHÔNG kết luận "đi được" — bão nói trước, số liệu chỉ để tham khảo
    const verdict = storm
      ? "chưa nên đi"
      : d.level === "good" ? "biển êm — đi được" : d.level === "caution" ? "sóng gió vừa — bác cân nhắc" : "không nên đi";
    const bao = storm ? "" : ` ${stormShort(s, now)}`;
    const so = `điểm ${d.score}/100, sóng ${fmtM(d.waveMaxM)} m${d.waveEstimated ? " (ước)" : ""}, gió ${Math.round(d.windMaxKmh)} km/h`;
    const text = `${storm}${DAY_NAME[day]} ở ${portName}: ${so} — ${verdict}.${bao} Số ${luu}. ${NGHE_DAI}`;
    // speak viết ở dạng HIỆN (m, km/h) — `reply` đổi sang lời đúng một lần
    const speak = storm
      ? `${spokenStorm}${DAY_NAME[day]} ở ${portName} ${so.replace(/\/100/, " trên 100")}, ${spokenTail}`
      : `${DAY_NAME[day]} ở ${portName} ${so.replace(/\/100/, " trên 100")}, ${verdict.replace(" — ", ", ")}. ${stormShort(s, now).replace(/\.$/, "")}, số ${luu}, bác nghe thêm đài duyên hải.`;
    return reply("thoi_tiet", text, { ...nav(SCREEN_HREF.ra_khoi), savedAt: w.savedAt, speak });
  }
  // bão XA (không dẫn đầu) vẫn phải nhắc một câu phụ — bà con biết có bão, mà không bị chặn chuyến (P1-N3)
  const xa = storm ? "" : stormFarNote(s, now);
  const xaSpeak = xa ? `${xa.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}, ` : "";
  const text = `${storm}${DAY_NAME[day]} ở ${portName}: ${dayLine(d, aspect)}. ${xa ? `${xa} ` : ""}Số ${luu}.${d.level === "bad" ? " Không nên ra khơi." : ""} ${NGHE_DAI}`;
  const speak = `${spokenStorm}${DAY_NAME[day]} ở ${portName} ${dayLine(d, aspect)}${d.level === "bad" ? ", không nên ra khơi" : ""}, ${xaSpeak}${spokenTail}`;
  return reply("thoi_tiet", text, { ...nav(SCREEN_HREF.ra_khoi), savedAt: w.savedAt, speak });
}

/**
 * P0-1 (audit 2026-09-06): máy có tin bão/áp thấp (mức watch hay danger, kể cả
 * tin đã cũ) → MỌI câu thời tiết/đi được mở đầu bằng bão + "đừng ra khơi vùng
 * ảnh hưởng". Không bão → "" (câu thường). Trả về có dấu cách cuối để ghép.
 */
function stormLead(s: DeviceSnapshot, now: number): string {
  const b = s.storm?.storms[0];
  if (!b || !stormNear(b)) return "";
  const old = now - (s.storm?.savedAt ?? now) > STORM_MAX_AGE_MS;
  const gio = b.windKmh != null ? `, gió ${Math.round(b.windKmh)} km/h` : "";
  const cu = old ? ` (tin đã cũ, ${luuLabel(s.storm!.savedAt, now)})` : "";
  return `Có ${b.kindLabel.toLowerCase()} ${b.name}${gio}${cu} — đừng ra khơi vùng ảnh hưởng. `;
}

function foldLike(a: string, b: string): boolean {
  const f = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, " ").trim();
  const fa = f(a);
  const fb = f(b);
  return fa === fb || fb.includes(fa) || fa.includes(fb);
}

/**
 * Bão nào ĐÁNG dẫn đầu câu trả lời (audit vòng 2 P1-N3). Bão `watch` ở Okinawa
 * cách Quy Nhơn ~1.500 km mà ngày nào cũng mở đầu bằng "đừng ra khơi" thì bà
 * con bỏ ngoài tai luôn cả lúc bão thật — mất cảnh báo là mất mạng người.
 * · `danger` → luôn dẫn đầu, xa mấy cũng vậy (mức này là bão đang vào bờ);
 * · `watch` → chỉ khi cách cảng nhà ≤ 500 km (13 §6);
 * · thiếu toạ độ (bản tin không có, hoặc chưa đặt cảng nhà) → COI NHƯ GẦN.
 */
const STORM_NEAR_KM = 500;

function stormNear(b: NonNullable<DeviceSnapshot["storm"]>["storms"][number]): boolean {
  return b.alert === "danger" || b.distanceKm == null || b.distanceKm <= STORM_NEAR_KM;
}

/** "Có bão X ở xa." khi máy CÓ bão mà bão không đáng dẫn đầu; "" khi không có bão nào. */
function stormFarNote(s: DeviceSnapshot, now: number): string {
  return s.storm && s.storm.storms.length > 0 ? stormShort(s, now) : "";
}

/** Một câu ngắn về bão để ghép vào "đi được không" (chỉ tới đây khi bão KHÔNG dẫn đầu). */
function stormShort(s: DeviceSnapshot, now: number): string {
  if (!s.storm) return "Máy chưa có tin bão.";
  const old = now - s.storm.savedAt > STORM_MAX_AGE_MS;
  if (s.storm.storms.length > 0) {
    // bão xa: nói cho biết, KHÔNG chặn chuyến đi — câu "nghe thêm đài duyên hải" ở cuối vẫn còn
    const b = s.storm.storms[0];
    return `Có ${b.kindLabel.toLowerCase()} ${b.name} ở xa${old ? " (tin đã cũ)" : ""}.`;
  }
  return old ? `Tin bão trong máy đã cũ (${luuLabel(s.storm.savedAt, now)}).` : `Không có tin bão (${luuLabel(s.storm.savedAt, now)}).`;
}

function answerStorm(s: DeviceSnapshot, now: number): AssistantReply {
  if (!s.storm) return reply("bao", `Máy chưa có tin bão. Có sóng tôi hỏi lại được. ${NGHE_DAI}`, nav(SCREEN_HREF.ra_khoi));
  const luu = luuLabel(s.storm.savedAt, now);
  const old = now - s.storm.savedAt > STORM_MAX_AGE_MS;
  const extra = { ...nav(SCREEN_HREF.ra_khoi), savedAt: s.storm.savedAt };
  if (s.storm.storms.length === 0) {
    if (old) return reply("bao", `Tin bão trong máy đã cũ (${luu}), tôi chưa dám chắc. ${NGHE_DAI}`, extra);
    return reply("bao", `Tin bão ${luu}: chưa có bão hay áp thấp trên Biển Đông. Bác vẫn nghe đài duyên hải nhé.`, extra);
  }
  const lines = s.storm.storms.slice(0, 2).map((b) => `${b.kindLabel} ${b.name}${b.windKmh != null ? `, gió ${Math.round(b.windKmh)} km/h` : ""}`);
  const head = old ? `Tin bão trong máy đã cũ (${luu}): ` : "";
  return reply("bao", `${head}${lines.join("; ")}${old ? "" : `, tin ${luu}`}. Nghe đài duyên hải để chắc.`, extra);
}

function answerTide(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  if (!s.tide || s.tide.extremes.length === 0) {
    return reply("con_nuoc", "Máy chưa tải bảng con nước. Mở Ra khơi lúc còn sóng.", nav(SCREEN_HREF.ra_khoi));
  }
  const highs = s.tide.extremes.filter((e) => e.kind === "high");
  const lows = s.tide.extremes.filter((e) => e.kind === "low");
  const parts: string[] = [];
  if (highs[0]) parts.push(`nước lớn ${fmtClockVN(highs[0].at)} (${fmtM(highs[0].heightM)} m)`);
  if (lows[0]) parts.push(`nước ròng ${fmtClockVN(lows[0].at)}`);
  const dayName = DAY_NAME[Math.max(0, Math.min(6, p.slots.day ?? 0))];
  return reply("con_nuoc", `${dayName} ${s.tide.stationName}: ${parts.join(", ")}. Số ${luuLabel(s.tide.savedAt, now)}.`, { ...nav(SCREEN_HREF.ra_khoi), savedAt: s.tide.savedAt });
}

/** "tàu BĐ 91234" — nhưng tên bà con đặt đã mở bằng "Tàu/Ghe/Thuyền" thì KHÔNG ghép thêm
    (từng đọc "Tàu Tàu của tôi", 2026-09-30). */
export function tauTen(name: string): string {
  return /^(tau|ghe|thuyen)( |$)/.test(foldVn(name)) ? name : `tàu ${name}`;
}

function answerDocs(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.giay_to);
  if (s.docs === null) return reply("giay_to", "Tủ giấy tờ trong máy đang đọc không được, bác mở Tàu cá xem giúp.", extra);
  const boat = s.boat?.name ? tauTen(s.boat.name) : "tàu";
  let docs = s.docs;
  if (p.slots.docKind) {
    const want = p.slots.docKind;
    const byKind = docs.filter((d) => kindOfLabel(d.label) === want);
    if (byKind.length > 0) docs = byKind;
  }
  if (docs.length === 0) {
    return reply("giay_to", p.slots.docKind ? `Tủ chưa có ${kindName(p.slots.docKind)}. Mở Tàu cá để thêm.` : "Tủ giấy tờ còn trống. Mở Tàu cá để thêm.", extra);
  }
  const urgent = docs
    .filter((d) => d.level === "expired" || d.level === "soon")
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
  if (urgent.length === 0) {
    const next = docs.filter((d) => d.daysLeft != null).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
    return reply("giay_to", `Giấy tờ ${boat} còn hạn cả${next ? `, gần nhất là ${next.label.toLowerCase()} còn ${next.daysLeft} ngày` : ""}.`, extra);
  }
  const items = urgent.slice(0, 3).map((d) => {
    const n = d.daysLeft ?? 0;
    if (n < 0) return `${d.label.toLowerCase()} quá hạn ${Math.abs(n)} ngày`;
    if (n === 0) return `${d.label.toLowerCase()} hết hạn hôm nay`;
    return `${d.label.toLowerCase()} còn ${n} ngày`;
  });
  return reply("giay_to", `${boat[0].toUpperCase()}${boat.slice(1)} có ${urgent.length} giấy cần lo: ${items.join("; ")}.`, extra);
}

function kindOfLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("đăng kiểm")) return "dang_kiem";
  if (l.includes("giấy phép")) return "giay_phep_khai_thac";
  if (l.includes("an toàn")) return "an_toan_thuc_pham";
  if (l.includes("bảo hiểm")) return "bao_hiem";
  if (l.includes("chứng chỉ")) return "chung_chi_thuyen_truong";
  return "khac";
}

function kindName(kind: string): string {
  return ({
    dang_kiem: "đăng kiểm",
    giay_phep_khai_thac: "giấy phép khai thác",
    an_toan_thuc_pham: "chứng nhận an toàn thực phẩm",
    bao_hiem: "bảo hiểm",
    chung_chi_thuyen_truong: "chứng chỉ thuyền trưởng/máy trưởng",
  } as Record<string, string>)[kind] ?? "giấy đó";
}

function answerMaintenance(s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.bao_duong);
  if (s.maintenance === null) return reply("bao_duong", "Sổ bảo dưỡng trong máy đang đọc không được, bác mở Tàu cá xem giúp.", extra);
  if (s.maintenance.length === 0) return reply("bao_duong", "Chưa ghi việc bảo dưỡng nào. Mở Tàu cá, mục Dịch vụ để thêm.", extra);
  const due = s.maintenance.filter((m) => m.level !== "ok").sort((a, b) => a.daysLeft - b.daysLeft);
  if (due.length === 0) return reply("bao_duong", "Chưa có việc bảo dưỡng nào tới kỳ trong 2 tuần.", extra);
  const over = due.filter((m) => m.level === "overdue");
  const soon = due.filter((m) => m.level === "soon");
  const parts: string[] = [];
  if (over.length) parts.push(`Có ${over.length} việc quá hạn: ${over.slice(0, 2).map((m) => `${m.item}${m.daysLeft < 0 ? `, trễ ${Math.abs(m.daysLeft)} ngày` : " hôm nay"}`).join("; ")}.`);
  if (soon.length) parts.push(`Sắp tới: ${soon.slice(0, 2).map((m) => `${m.item} còn ${m.daysLeft} ngày`).join("; ")}.`);
  return reply("bao_duong", parts.join(" "), extra);
}

function answerCrew(s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.ban_thuyen);
  if (s.crew === null) return reply("thuyen_vien", "Sổ thuyền viên trong máy đang đọc không được, bác mở Bạn thuyền xem giúp.", extra);
  if (s.crew.count === 0) return reply("thuyen_vien", "Chưa có ai trong sổ bạn thuyền. Mở Bạn thuyền để thêm.", extra);
  if (s.crew.issues === 0) return reply("thuyen_vien", `Sổ có ${s.crew.count} người, giấy tờ đủ cả.`, extra);
  return reply("thuyen_vien", `Sổ có ${s.crew.count} người, ${s.crew.issues} người có cảnh báo giấy tờ. Mở Bạn thuyền để coi ai.`, extra);
}

function answerBoat(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  if (!s.boat || s.boat.count === 0) return reply("tau_cua_toi", "Chưa có tàu nào trong máy. Mở Tàu cá để thêm tàu.", nav(SCREEN_HREF.tau));
  if (p.slots.boatName) {
    const want = p.slots.boatName;
    const hitName = s.boat.names.find((n) => foldLike(want, n));
    if (hitName) {
      /*  boatId không có trong snapshot (chỉ tên) — UI tra id theo tên qua
          boat-store khi thực hiện; ở đây gắn tên làm id để hợp đồng đủ trường. */
      // chip "Đổi lại" = đặt lại tàu đang chọn trước đó (nói "đổi lại" cũng chọn chip này — use-assistant)
      const back = s.boat.name && s.boat.name !== hitName ? [chip("Đổi lại", `đổi sang tàu ${s.boat.name}`)] : [];
      return reply("tau_cua_toi", `Đã chuyển sang ${tauTen(hitName)}.${back.length ? " Không đúng thì chạm 'Đổi lại'." : ""}`, {
        action: { type: "setBoat", boatId: hitName, boatName: hitName },
        ...(back.length ? { clarify: { question: "", options: back } } : {}),
      });
    }
    const options = s.boat.names.slice(0, 4).map((n) => chip(n, `đổi sang tàu ${n}`));
    return reply("tau_cua_toi", "Không thấy tàu tên đó. Bác chọn tàu:", { clarify: { question: "Đổi sang tàu nào?", options } });
  }
  return reply("tau_cua_toi", `Đang chọn ${tauTen(s.boat.name)}${s.boat.count > 1 ? ` (bác có ${s.boat.count} tàu)` : ""}.`, nav(SCREEN_HREF.tau));
}

function answerFind(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const q = p.slots.q ?? "";
  const shown = p.slots.qRaw || q; // chữ có dấu để hiện/đọc; `q` (fold) chỉ để tra kho
  if (!s.online) {
    return reply("tim_mon", `Chợ cần có sóng mới tìm được. Có sóng lại bác hỏi tôi tìm '${shown}' nhé.`, {
      clarify: { question: "Mở chợ để coi theo nhóm?", options: [chip("Mở chợ", "mở chợ")] },
    });
  }
  return reply("tim_mon", `Tôi mở chợ tìm '${shown}' nhé.`, { action: { type: "search", q } });
}

function answerAddCart(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const shown = p.slots.qRaw || p.slots.q || "";
  const qty = p.slots.qty ?? 1;
  const unit = p.slots.unitRaw || p.slots.unit ? ` ${p.slots.unitRaw || p.slots.unit}` : "";
  if (!s.online) {
    return reply("them_gio", `Thêm vào giỏ cần có sóng để tìm món. Có sóng lại bác nói 'thêm ${qty}${unit} ${shown} vào giỏ' nhé.`, {
      clarify: { question: "Mở chợ để coi?", options: [chip("Mở chợ", "mở chợ")] },
    });
  }
  // khung — use-assistant tìm /api/cho/san-pham rồi điền candidates/confirm/action; `qty` đi theo để UI mở sẵn đúng số
  return reply("them_gio", `Để tôi tìm ${qty}${unit} ${shown} trên chợ.`, { qty });
}

function answerCart(s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.gio_hang);
  if (s.cart.lines === 0) return reply("xem_gio", "Giỏ chưa có gì. Bác nói tên món cần mua, tôi tìm giúp.", extra);
  const names = s.cart.titles.slice(0, 3).join(", ");
  return reply("xem_gio", `Giỏ có ${s.cart.lines} món${names ? `: ${names}` : ""}${s.cart.lines > 3 ? "…" : ""}.`, extra);
}

const ORDER_STATUS: Record<string, string> = {
  cho_xac_nhan: "chờ shop xác nhận",
  da_xac_nhan: "shop đã xác nhận",
  dang_giao: "đang giao",
  da_giao: "đã giao",
  hoan_thanh: "hoàn thành",
  da_huy: "đã huỷ",
};

function answerOrders(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  const extra = nav(SCREEN_HREF.don_hang);
  if (!s.orders) {
    return reply("don_cua_toi", s.online ? "Máy chưa có bản đơn. Mở Đơn của tôi để tải." : "Máy chưa lưu đơn nào, và đang không có sóng.", extra);
  }
  const luu = luuLabel(s.orders.savedAt, now);
  const onlyShip = p.slots.orderFilter === "dang_giao";
  const items = onlyShip ? s.orders.items.filter((o) => o.status === "dang_giao") : s.orders.items;
  if (items.length === 0) {
    return reply("don_cua_toi", onlyShip ? `Không có đơn nào đang giao (bản ${luu}).` : "Bác chưa có đơn nào.", { ...extra, savedAt: s.orders.savedAt });
  }
  const lines = items.slice(0, 3).map((o) => `${o.code} của ${o.shopName}, ${fmtVnd(o.totalVnd)}${onlyShip ? "" : `, ${ORDER_STATUS[o.status] ?? o.status}`}`);
  const head = onlyShip ? `${items.length} đơn đang giao` : `${items.length} đơn`;
  const speak = `${head}: ${items[0].code} của ${items[0].shopName}, ${fmtVnd(items[0].totalVnd)}, ${ORDER_STATUS[items[0].status] ?? ""}. Bản ${luu}.`;
  return reply("don_cua_toi", `${head}: ${lines.join("; ")}. Bản ${luu}.`, { ...extra, savedAt: s.orders.savedAt, speak });
}

function answerFishPrice(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  const extra = nav(SCREEN_HREF.giao_dich);
  if (!s.fishPrices || s.fishPrices.items.length === 0) return reply("gia_ca", "Máy chưa có bảng giá. Có sóng mở Giao dịch để tải.", extra);
  const luu = luuLabel(s.fishPrices.savedAt, now);
  const week = s.fishPrices.week ? `tuần ${s.fishPrices.week}` : "tham khảo";
  let items = s.fishPrices.items;
  if (p.slots.species) {
    const want = p.slots.species;
    const found = items.filter((i) => foldLike(want, i.species));
    if (found.length === 0) {
      return reply("gia_ca", `Bảng giá ${week} không có '${p.slots.nameRaw || want}'. Bác xem bảng giá đầy đủ nhé.`, { ...extra, savedAt: s.fishPrices.savedAt });
    }
    items = found;
  }
  const lines = items.slice(0, 3).map((i) => `${i.species} ${fmtVnd(i.minVnd)} – ${fmtVnd(i.maxVnd)}/kg`);
  return reply("gia_ca", `Giá bến ${week}: ${lines.join("; ")}. Số ${luu}, giá thật hỏi đại lý.`, { ...extra, savedAt: s.fishPrices.savedAt });
}

function answerFuel(s: DeviceSnapshot, now: number): AssistantReply {
  const extra = nav(SCREEN_HREF.giao_dich);
  if (!s.fuel) return reply("gia_dau", "Chưa có giá dầu trong máy. Có sóng mở Giao dịch để tải.", extra);
  return reply("gia_dau", `Dầu DO ${fmtVnd(s.fuel.priceVnd)}/lít, kỳ ${fmtDate(s.fuel.date)}. Số ${luuLabel(s.fuel.savedAt, now)}.`, { ...extra, savedAt: s.fuel.savedAt });
}

function answerCallShop(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  if (p.followUp === "thuyen_vien") {
    return reply("goi_shop", "Số bạn thuyền ở màn Bạn thuyền, bác mở ra rồi bấm gọi nhé.", nav(SCREEN_HREF.ban_thuyen));
  }
  const orders = s.orders?.items ?? [];
  const want = p.slots.shopName;
  const pick = want
    ? orders.find((o) => foldLike(want, o.shopName))
    : orders.find((o) => o.status === "dang_giao") ?? orders[0];
  if (!pick) {
    return reply("goi_shop", want ? `Không thấy shop '${p.slots.nameRaw || want}' trong đơn của bác. Mở đơn hàng để coi.` : "Chưa có đơn nào để gọi shop. Mở đơn hàng để coi.", nav(SCREEN_HREF.don_hang));
  }
  if (!pick.shopPhone) {
    return reply("goi_shop", `Máy chưa lưu số của ${pick.shopName}. Mở đơn ${pick.code} để gọi.`, nav(SCREEN_HREF.don_hang));
  }
  return reply("goi_shop", `Gọi ${pick.shopName} nhé?`, {
    action: { type: "call", tel: pick.shopPhone, label: pick.shopName },
    confirm: { question: `Gọi ${pick.shopName}?` },
  });
}

function answerCallSdvico(): AssistantReply {
  return reply("goi_sdvico", `Gọi SDVICO ${SDVICO_HOTLINE_DISPLAY} nhé?`, {
    action: { type: "call", tel: SDVICO_HOTLINE, label: "SDVICO" },
    confirm: { question: `Gọi SDVICO ${SDVICO_HOTLINE_DISPLAY}?` },
  });
}

function answerMarket(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.giao_dich);
  const where = p.slots.portName ?? s.home?.province;
  if (where) return reply("tin_mua_ban", `Chỗ thu mua ở ${where} có trong danh bạ Giao dịch. Mở Giao dịch để coi và gọi.`, extra);
  return reply("tin_mua_ban", s.online ? "Mở Giao dịch để coi tin mua bán và chỗ thu mua nhé." : "Chưa có tin mua bán nào trong máy. Có sóng tôi coi lại giúp.", extra);
}

function answerScreen(p: ParsedIntent): AssistantReply {
  const t = p.slots.target;
  if (!t) {
    return reply("mo_man", "Tôi mở được: Ra khơi, Tàu cá, Bạn thuyền, Giao dịch, Chợ. Bác muốn mở cái nào?", {
      clarify: {
        question: "Mở màn nào?",
        options: [chip("Ra khơi", "mở ra khơi"), chip("Tàu cá", "mở tàu cá"), chip("Bạn thuyền", "mở bạn thuyền"), chip("Chợ", "mở chợ")],
      },
    });
  }
  if (t === "hop_thu") return reply("mo_man", "Mở Trang chủ, bác kéo xuống hộp thư nhé.", nav(SCREEN_HREF.hop_thu));
  return reply("mo_man", `Mở ${SCREEN_LABEL[t]}.`, nav(SCREEN_HREF[t]));
}

function answerHomePort(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const name = p.slots.placeName ?? "";
  if (!name) {
    return reply("dat_cang_nha", `Bác hay đi từ cảng nào? Nói 'đặt cảng nhà là …' hoặc chọn trong danh sách.${s.home ? ` Đang là ${s.home.portName}.` : ""}`, {
      clarify: { question: "Bác hay đi từ cảng nào?", options: [chip("Mở danh sách cảng", "mở cảng")] },
    });
  }
  // khớp lại với DANH SÁCH THẬT (PORTS + FISHING_PORTS gộp trùng) — parse chỉ có tên trong ctx
  const keys = matchPortKeys(name, ALL_PORT_NAMES);
  const hit = keys.length === 1 ? portByKey(keys[0]) : undefined;
  if (hit) {
    // chip "Đổi lại" = đặt lại cảng cũ (hoàn tác 1 chạm; nói "đổi lại" cũng chọn chip này — use-assistant)
    const back = s.home && s.home.portId !== hit.id
      ? chip("Đổi lại", `đặt cảng nhà là ${s.home.portName}`)
      : chip("Chọn cảng khác", "mở cảng"); // cùng chữ với nút của băng → tấm che lọc bớt một cái (P2-N2)
    const tinh = hit.province ? `, ${hit.province}` : "";
    return reply("dat_cang_nha", `Đã đặt cảng nhà là ${hit.name}${tinh}. Không đúng thì chạm '${back.label}'.`, {
      action: { type: "setHomePort", portId: hit.id, portName: hit.name, ...(hit.province ? { province: hit.province } : {}) },
      clarify: { question: "", options: [back] },
    });
  }
  if (keys.length > 1) {
    const options = keys.slice(0, 4).map((k) => portByKey(k)).filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => chip(x.province ? `${x.name} (${x.province})` : x.name, `đặt cảng nhà là ${x.name}`));
    return reply("dat_cang_nha", `Có ${options.length} cảng gần tên đó. Bác chọn:`, { clarify: { question: "Cảng nào?", options } });
  }
  /*  Không thấy tên đó (audit P1-N2: "Đà Nẵng" từng thành "Bến Đá, TP.HCM").
      Bà con hay nói tên TỈNH thay tên cảng — gợi ý mấy cảng trong tỉnh đó làm
      chip để vẫn 1 chạm; không đoán được thì chỉ còn đường mở danh sách. */
  const gan = nearPortKeys(name).map((k) => portByKey(k)).filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => chip(x.province ? `${x.name} (${x.province})` : x.name, `đặt cảng nhà là ${x.name}`));
  return reply("dat_cang_nha", `Không thấy cảng tên '${p.slots.nameRaw || name}'. Bác nói lại tên cảng, hoặc chọn trong danh sách.`, {
    clarify: { question: "Chọn cảng nhà", options: [...gan, chip("Mở danh sách cảng", "mở cảng")] },
  });
}

function answerNavigate(p: ParsedIntent, s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.ra_khoi);
  if (s.placeNames.length === 0 && p.slots.placeName !== "cang nha") {
    return reply("dan_duong", "Bác chưa ghim điểm nào. Mở Ra khơi, chạm giữ trên biển để ghim.", extra);
  }
  if (p.confidence >= 0.9 && p.slots.placeName) {
    const want = p.slots.placeName;
    // tên điểm CÓ DẤU: tra trong máy theo khoá fold; không có thì chữ bà con nói (audit P1-5)
    const name = want === "cang nha" ? (s.home?.portName ?? "cảng nhà") : (s.placeNames.find((n) => foldLike(want, n)) ?? p.slots.nameRaw ?? want);
    // nợ: ?den=<placeId> mở thẳng thẻ dẫn đường (2 chạm), nâng khi đụng route-planner Trục 1
    return reply("dan_duong", `Tôi mở Ra khơi. Bác bấm Điểm đã lưu rồi chọn ${name} nhé.`, extra);
  }
  const options = s.placeNames.slice(0, 4).map((n) => chip(n, `dẫn đường tới ${n}`));
  if (p.confidence >= 0.55) return reply("dan_duong", "Có mấy điểm gần tên đó. Bác chọn:", { clarify: { question: "Đi điểm nào?", options } });
  return reply("dan_duong", `Không thấy điểm tên '${p.slots.nameRaw || p.slots.placeName || ""}'. Bác có: ${s.placeNames.slice(0, 3).join(", ")}.`, { clarify: { question: "Đi điểm nào?", options } });
}

function answerInbox(s: DeviceSnapshot): AssistantReply {
  const extra = nav(SCREEN_HREF.hop_thu);
  if (s.inboxUnread === 0) return reply("hop_thu", "Không có tin mới.", extra);
  return reply("hop_thu", `${s.inboxUnread} tin chưa đọc, bác kéo xuống hộp thư ở Trang chủ.`, extra);
}

function answerHelp(s: DeviceSnapshot, now: number): AssistantReply {
  const hour = Number(new Date(now + 7 * 3600_000).getUTCHours());
  const options = suggestionsFor(s.route, hour, s);
  return reply("tro_giup", "Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay bảo tôi mở màn, tìm món, gọi shop.", {
    clarify: { question: "Ví dụ:", options },
  });
}

function answerBlocked(p: ParsedIntent): AssistantReply {
  const reason = blockReasonOf(p);
  if (reason === "tra_nguoi") {
    return reply("ngoai_pham_vi", "Tra cảnh báo bạn thuyền làm ở màn Bạn thuyền, cần CCCD gõ tay.", nav(SCREEN_HREF.ban_thuyen));
  }
  const base = "Việc này tôi không trả lời được. Bác hỏi tôi chuyện đi biển, tàu, giấy tờ, mua bán nhé.";
  // speak 2 câu tự viết để câu "gọi 115" không bị cắt (audit P1-16)
  if (reason === "y_te") return reply("ngoai_pham_vi", `${base} Đau ốm thì gọi 115 hoặc trạm y tế.`, { speak: "Việc này tôi không trả lời được. Đau ốm thì gọi 115 hoặc trạm y tế." });
  if (reason === "phap_ly") return reply("ngoai_pham_vi", "Chuyện phạt hỏi cảng cá hoặc biên phòng giúp. Tôi coi được giấy tờ nào sắp hết hạn.", {
    clarify: { question: "", options: [chip("Giấy tờ sắp hết hạn", "giấy tờ sắp hết hạn")] },
  });
  return reply("ngoai_pham_vi", base);
}

function answerUnknown(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  if (p.reason === "qua_dai") return reply("khong_hieu", "Bác nói ngắn từng việc một giúp.");
  if (p.slots.q === "dau") {
    return reply("khong_hieu", "Bác cần dầu nhớt hay dầu DO chạy máy?", {
      clarify: { question: "Dầu nào?", options: [chip("Dầu nhớt", "mua dầu nhớt"), chip("Dầu DO", "mua dầu DO"), chip("Giá dầu", "giá dầu")] },
    });
  }
  if (p.followUp) {
    // hành động có hậu quả (huỷ đơn, đặt hàng, xoá…) — chỉ đường tới màn, không làm
    const href = HREF_OF_INTENT[p.followUp] ?? SCREEN_HREF.trang_chu;
    const label = LABEL_OF_INTENT[p.followUp] ?? "màn đó";
    return reply("khong_hieu", `Việc đó bác làm trên màn ${label} nhé.`, {
      clarify: { question: "", options: [chip(`Mở ${label}`, `mở ${label.toLowerCase()}`)] },
      action: { type: "navigate", href },
    });
  }
  const hour = Number(new Date(now + 7 * 3600_000).getUTCHours());
  return reply("khong_hieu", "Tôi chưa nghe rõ. Bác nói lại giúp.", { clarify: { question: "Hoặc chọn:", options: suggestionsFor(s.route, hour, s) } });
}

const HREF_OF_INTENT: Partial<Record<Intent, string>> = {
  don_cua_toi: SCREEN_HREF.don_hang,
  xem_gio: SCREEN_HREF.gio_hang,
  giay_to: SCREEN_HREF.giay_to,
  tau_cua_toi: SCREEN_HREF.tau,
  thuyen_vien: SCREEN_HREF.ban_thuyen,
  dan_duong: SCREEN_HREF.ra_khoi,
  tin_mua_ban: SCREEN_HREF.giao_dich,
  mo_man: SCREEN_HREF.trang_chu,
  tim_mon: SCREEN_HREF.cho,
};
const LABEL_OF_INTENT: Partial<Record<Intent, string>> = {
  don_cua_toi: "Đơn hàng",
  xem_gio: "Giỏ hàng",
  giay_to: "Giấy tờ",
  tau_cua_toi: "Tàu cá",
  thuyen_vien: "Bạn thuyền",
  dan_duong: "Ra khơi",
  tin_mua_ban: "Giao dịch",
  mo_man: "Trang chủ",
  tim_mon: "Chợ",
};

/* ───────────────── điểm vào ───────────────── */

/** Ý thứ hai trong câu ("coi thời tiết rồi gọi SDVICO") → chip, không tự làm (13 §3 cuối, AC-T07; audit P1-10). */
const FOLLOW_CHIP: Partial<Record<Intent, Suggestion>> = {
  goi_sdvico: chip("Gọi SDVICO", "gọi SDVICO"),
  goi_shop: chip("Gọi shop", "gọi shop"),
  bao: chip("Có bão không", "có bão không"),
  thoi_tiet: chip("Thời tiết hôm nay", "thời tiết hôm nay"),
  con_nuoc: chip("Con nước", "con nước hôm nay"),
  giay_to: chip("Giấy tờ sắp hết hạn", "giấy tờ sắp hết hạn"),
  bao_duong: chip("Bảo dưỡng tới hạn", "bảo dưỡng gì tới hạn"),
  thuyen_vien: chip("Bạn thuyền", "tàu có mấy người"),
  xem_gio: chip("Xem giỏ", "giỏ có gì"),
  don_cua_toi: chip("Đơn của tôi", "đơn của tôi"),
  gia_ca: chip("Giá cá", "giá cá hôm nay"),
  gia_dau: chip("Giá dầu", "giá dầu"),
  hop_thu: chip("Tin mới", "có tin mới không"),
};

function withFollowUp(r: AssistantReply, p: ParsedIntent): AssistantReply {
  if (!p.followUp || p.intent === "khong_hieu" || p.intent === "goi_shop") return r; // khong_hieu/goi_shop dùng followUp làm đích riêng
  const c = FOLLOW_CHIP[p.followUp];
  if (!c) return r;
  const options = [...(r.clarify?.options ?? []).filter((o) => o.utterance !== c.utterance), c].slice(0, 4);
  return { ...r, clarify: { question: r.clarify?.question ?? "", options } };
}

export function answerOffline(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  try {
    return withFollowUp(answerOne(p, s, now), p);
  } catch {
    return reply(p.intent, "Tôi chưa trả lời được câu này. Bác thử hỏi cách khác giúp.");
  }
}

function answerOne(p: ParsedIntent, s: DeviceSnapshot, now: number): AssistantReply {
  switch (p.intent) {
    case "thoi_tiet": return answerWeather(p, s, now);
    case "bao": return answerStorm(s, now);
    case "con_nuoc": return answerTide(p, s, now);
    case "giay_to": return answerDocs(p, s);
    case "bao_duong": return answerMaintenance(s);
    case "thuyen_vien": return answerCrew(s);
    case "tau_cua_toi": return answerBoat(p, s);
    case "tim_mon": return answerFind(p, s);
    case "them_gio": return answerAddCart(p, s);
    case "xem_gio": return answerCart(s);
    case "don_cua_toi": return answerOrders(p, s, now);
    case "gia_ca": return answerFishPrice(p, s, now);
    case "gia_dau": return answerFuel(s, now);
    case "goi_shop": return answerCallShop(p, s);
    case "goi_sdvico": return answerCallSdvico();
    case "tin_mua_ban": return answerMarket(p, s);
    case "mo_man": return answerScreen(p);
    case "dat_cang_nha": return answerHomePort(p, s);
    case "dan_duong": return answerNavigate(p, s);
    case "hop_thu": return answerInbox(s);
    case "tro_giup": return answerHelp(s, now);
    case "lap_lai": return reply("lap_lai", "");
    case "tat_tieng": return reply("tat_tieng", "Đã tắt tiếng — tôi chỉ hiện chữ.", { action: { type: "mute", on: true } });
    case "bat_tieng": return reply("bat_tieng", "Đã bật tiếng.", { action: { type: "mute", on: false } });
    case "xac_nhan": return reply("xac_nhan", "Rồi.");
    case "tu_choi": return reply("tu_choi", "Thôi vậy.");
    case "huy": return reply("huy", "");
    case "chao_hoi": return reply("chao_hoi", /cam on/.test(p.normalized) ? "Dạ." : "Dạ, bác cần gì?");
    case "ngoai_pham_vi": return answerBlocked(p);
    case "hoi_mo":
      return reply("hoi_mo", s.online
        ? "Câu này tôi cần hỏi thêm khi có sóng. Bác chờ chút."
        : "Câu này phải có sóng mới hỏi được. Có sóng lại bác hỏi nhé. Giờ tôi trả lời được: thời tiết, bão, giấy tờ, giá cá.");
    case "khong_hieu":
    default:
      return answerUnknown(p, s, now);
  }
}

/** Câu khi tầng mạng hỏng (14 §4.3) — thuần, `source: "offline"`. */
export function onlineErrorReply(code: AssistantErrorCode | "offline", s: DeviceSnapshot): AssistantReply {
  void s;
  switch (code) {
    case "quota":
      return reply("khong_hieu", "Hôm nay bác đã hỏi đủ 30 câu cần sóng. Mai hỏi tiếp nhé — việc trong máy tôi vẫn trả lời.");
    case "no_key":
      return reply("khong_hieu", "Phần hỏi thêm chưa mở. Bác hỏi tôi việc trong máy nhé.");
    case "unavailable":
    case "upstream":
      return reply("khong_hieu", "Trợ lý mạng đang không sẵn sàng. Bác hỏi việc trong máy nhé.");
    case "timeout":
      return reply("khong_hieu", "Sóng yếu, hỏi không kịp. Bác thử lại hoặc hỏi việc trong máy.");
    case "offline":
      return reply("khong_hieu", "Câu này phải có sóng mới hỏi được. Giờ tôi trả lời được: thời tiết, bão, giấy tờ, giá cá, mở màn.");
    case "no_token":
    case "unknown_token":
    case "token_revoked":
      return reply("khong_hieu", "Bác đăng nhập để dùng trợ lý mạng.", nav("/login"));
    case "refused":
      return reply("khong_hieu", "Câu này tôi không trả lời được.");
    case "invalid":
    case "bad_snapshot":
    default:
      return reply("khong_hieu", code === "invalid" ? "Câu dài quá, bác nói ngắn lại." : "Chưa hỏi được lúc này. Bác thử lại sau, hoặc hỏi việc trong máy.");
  }
}
