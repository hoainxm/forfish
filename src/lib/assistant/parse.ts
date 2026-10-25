// TRỢ LÝ — BỘ HIỂU Ý TẦNG MÁY (thuần, 14 §4.2). `parseUtterance(text, ctx)`
// KHÔNG BAO GIỜ ném; chuỗi rỗng → khong_hieu conf 0.
//
// Ba bậc, dừng ở bậc đầu khớp:
//   0. chặn (ngoại phạm vi — không bao giờ lên máy chủ) · quá dài · rỗng
//   1. điều khiển (ừ/thôi chỉ có nghĩa khi đang chờ xác nhận)
//   2. mẫu ưu tiên có nhóm bắt (thứ tự = ưu tiên của 13 §3)
//   3. điểm theo từ khoá; câu hỏi mở → hoi_mo; còn lại khong_hieu
// Nhiều ý một câu ("coi thời tiết rồi gọi SDVICO") → ý đầu + followUp.

import { foldVn } from "@/lib/market/text";
import { COASTAL_PROVINCES, provinceKey } from "@/lib/region";
import {
  BLOCKLIST, CLOSE_RE, CONTROL, DESTRUCTIVE, KEYWORDS, NO_RE, OPEN_STRONG, OPEN_WEAK,
  OPEN_VERBS, PROVINCE_ALIASES, SCREEN_PHRASES, SPECIES_WORDS, YES_RE,
} from "./intents";
import { normalizeUtterance, rawSlot, UNIT_DISPLAY, UNIT_WORDS, wordCount } from "./normalize";
import { matchPortKeys } from "./ports";
import type { Intent, ParseContext, ParsedIntent, ScreenTarget, Slots } from "./types";

export const CONFIDENCE_OFFLINE = 0.6;
const MAX_WORDS = 40;
const U = UNIT_WORDS.join("|");

type Hit = { intent: Intent; conf: number; slots?: Slots; followUp?: Intent; reason?: string };

function hit(intent: Intent, conf: number, slots: Slots = {}, followUp?: Intent): Hit {
  return { intent, conf, slots, ...(followUp ? { followUp } : {}) };
}

/* ───────────────── khớp mờ tên trong ngữ cảnh ───────────────── */

/** Các dạng fold của một tên: cả tên, phần ngoài ngoặc, phần trong ngoặc. */
function nameForms(name: string): string[] {
  const forms = new Set<string>();
  const full = foldVn(name);
  if (full) forms.add(full);
  const m = /^([^(]+)\(([^)]+)\)/.exec(name);
  if (m) {
    const a = foldVn(m[1]);
    const b = foldVn(m[2]);
    if (a) forms.add(a);
    if (b) forms.add(b);
  }
  return [...forms];
}

function includesWord(s: string, phrase: string): boolean {
  return new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(s);
}

/** Tên trong `names` xuất hiện trong câu `s` (dạng fold). Trả tên ĐÃ fold đầy đủ. */
export function findNamed(s: string, names: readonly string[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const forms = nameForms(n);
    if (forms.some((f) => f.length >= 2 && includesWord(s, f))) out.push(foldVn(n));
  }
  return out;
}

/** Khớp mờ một cụm với danh sách tên: cụm chứa tên hoặc tên chứa cụm (≥2 ký tự). */
export function fuzzyNames(phrase: string, names: readonly string[]): string[] {
  const p = foldVn(phrase).replace(/^cang /, "").trim();
  if (p.length < 2) return [];
  const out: string[] = [];
  for (const n of names) {
    const forms = nameForms(n);
    if (forms.some((f) => f === p || includesWord(f, p) || includesWord(p, f))) out.push(foldVn(n));
  }
  return out;
}

/* ───────────────── bậc 2: mẫu ưu tiên ───────────────── */

function dayOf(s: string): number | undefined {
  const n = /\b(\d+) (?:ngay|bua) (?:toi|nua|sau|ke)\b/.exec(s);
  if (n) return Math.max(1, Math.min(6, Number(n[1])));
  if (/\btuan sau\b/.test(s)) return 6;
  if (/\bcuoi tuan\b/.test(s)) return 5;
  if (/\bngay kia\b/.test(s)) return 2;
  if (/\bngay mai\b/.test(s)) return 1;
  if (/\b(hom nay|nay)\b/.test(s)) return 0;
  return undefined;
}

function aspectOf(s: string): Slots["aspect"] {
  const song = /\bsong\b/.test(s);
  const gio = /\bgio\b(?! hang)/.test(s) && !/\b\d+ gio\b/.test(s);
  const mua = /\b(mua|dong)\b/.test(s) && !/\b(mua|dong)\s+(gi|do|hang|mon)\b/.test(s);
  const picked = [song, gio, mua].filter(Boolean).length;
  if (picked !== 1) return "chung";
  if (song) return "song";
  if (gio) return "gio";
  return "mua";
}

function portIn(s: string, ctx: ParseContext): string | undefined {
  return findNamed(s, ctx.portNames)[0];
}

const WEATHER_WORDS = /\b(thoi tiet|song|gio|mua|bien|troi|dong|em|nang|diem di bien|du bao|sap mua|gio giat|cap may|cap \d)\b/;
const DI_DUOC = /\b(di duoc khong|di duoc ko|di duoc|nen di|ra khoi duoc|di bien duoc|co nen|ok khong|ra khoi ok|diem di bien|di bien ok|di dc khong|di dc|xuat ben duoc|chay duoc khong)\b/;
const BAO_STRONG = /\b(ap thap|atnd|bao so|tin bao)\b/;
/** "bao" đứng SAU chữ này là thông báo/đảm bảo/bao bao/đọc báo (Kairos), không phải bão. */
const BAO_PREV_NOT = new Set(["thong", "dam", "bao", "doc"]);
/** "bao" đứng TRƯỚC chữ này là bảo hiểm/bảo dưỡng/bao nhiêu/bao gạo…, không phải bão. */
const BAO_NEXT_NOT = new Set(["hiem", "duong", "nhieu", "cao", "gio", "lau", "xa", "lon", "tri", "ve", "ho", "muoi", "da", "gao", "dam", "cat", "tay", "gia", "cho"]);
/** Không dùng lookbehind (Safari <16.4 chết cả chunk — safari-cu.test.ts). */
function isStorm(s: string): boolean {
  if (BAO_STRONG.test(s)) return true;
  const w = s.split(" ");
  for (let i = 0; i < w.length; i++) {
    if (w[i] !== "bao") continue;
    if (i > 0 && BAO_PREV_NOT.has(w[i - 1])) continue;
    if (i + 1 < w.length && BAO_NEXT_NOT.has(w[i + 1])) continue;
    return true;
  }
  return false;
}

/* ───────────────── cơ cấu app mới 2026-10-25 (hợp đồng §B) ───────────────── */

/** Tỉnh ven biển nói trong câu (đã fold) → tên CHUẨN `COASTAL_PROVINCES`; tên cũ qua `PROVINCE_ALIASES`. Cụm dài khớp trước. */
export function provinceIn(s: string): string | undefined {
  const cands: [string, string][] = [
    ...COASTAL_PROVINCES.map((p): [string, string] => [foldVn(p.name).replace(/^thanh pho /, ""), p.name]),
    ...PROVINCE_ALIASES,
  ].sort((a, b) => b[0].length - a[0].length);
  for (const [k, name] of cands) if (includesWord(s, k)) return name;
  // "tp hcm" / "hồ chí minh" viết liền, dạng lạ — qua khoá vùng
  const kw = provinceKey(s);
  if (/hochiminh/.test(kw)) return "Thành phố Hồ Chí Minh";
  return undefined;
}

/** "nhắn Zalo cho vựa" / "gửi tin Zalo cho ông Ba" / "nhắn cho chủ tin này" — đứng TRƯỚC bảng DESTRUCTIVE ("gui tin", "nhan tin cho"). */
const ZALO_RE = /\bzalo\b|^(?:toi |tui |cho toi |giup toi )?(?:muon |can |nho )?(?:nhan|nhan tin|gui tin|gui tin nhan|chat|inbox)\s+(?:zalo\s+)?(?:cho|voi|qua)\s+\S/;
const TAI_BAI_RE = /\b(?:tai|luu|down|tai ve|tai san|tai truoc|tai het)\s+(?:may |mot it |it |vai |them )?(?:bai|tin|bao|bai doc|bai bao|tin tuc|bai kairos|tin kairos)\b|\btai (?:bai|tin) mang di\b|\b(?:bai|tin) doc tren bien\b|\bmang di doc\b|\bde ra khoi doc\b/;
const BAT_CHUONG_RE = /^(?:cho toi |giup toi |lam on |nho )?(?:bat|cai|dang ky|mo|kich hoat)\s+(?:cai |cho |lai )?chuong\b|\bbat (?:cai |lai )?(?:thong bao|canh bao|bao dong)\b|\b(?:cho |de |cai )?may (?:reo|rung|keu|hu|bao dong|bao)(?: len)? khi (?:co |sap |sap co )?bao\b|\bchuong bao bao\b|\bbat (?:bao|tin) bao\b/;
const DANG_XUAT_RE = /\b(dang xuat|thoat tai khoan|go tai khoan|thoat ra khoi tai khoan|logout|log out|thoat ra khoi app|dang xuat ra)\b/;
const CHUA_DOC_RE = /\b(chua doc|chua xem|chua coi|co ai nhan|ai nhan gi|ai nhan khong|may tin (moi|chua)|bao nhieu tin|tin nao (moi|chua)|co tin nao|con tin nao|co ai (goi|hoi|nhan))\b/;
const SHOP_TAM_NGHI_RE = /\b(tam nghi( ban)?|nghi ban|dong (gian hang|shop)( tam| vai bua| may bua| it bua)?|tam dong( cua| gian hang)?|ngung ban( tam| vai bua)?|nghi (vai|may|it) bua|khong ban nua|treo bang nghi)\b/;
const SHOP_MO_BAN_RE = /\b(mo ban lai|ban lai( roi)?|het nghi( roi)?|mo lai (gian hang|shop)|mo (gian hang|shop) lai|ban tiep|ngung nghi|nghi xong( roi)?|bo tam nghi|tat tam nghi|hoat dong lai)\b/;
/** "chọn tỉnh Khánh Hoà" / "đổi sang Kiên Giang" / "lọc theo tỉnh Cà Mau" — động từ chọn/đổi/lọc: phần sau là tỉnh. */
const CHON_TINH_RE = /^(?:toi |tui |cho toi )?(?:chon|chon lai|doi|doi lai|doi sang|doi qua|chuyen|chuyen sang|chuyen qua|loc|loc theo|dat|lay theo)\s+(?:tinh |vua |cho |dau moi |o |sang |qua |ve |theo |theo tinh )*(.+)$/;
/** "xem vựa ở Bình Định" / "coi đầu mối Cà Mau" — động từ xem/coi chỉ tính khi ngay sau là vựa/chợ/đầu mối/cảng/tỉnh
 *  ("coi thời tiết Vũng Tàu" là thời tiết, không phải chọn tỉnh). */
const XEM_TINH_RE = /^(?:toi |tui |cho toi )?(?:(?:xem|coi|lay|tim|kiem)\s+)?(?:vua|cho|dau moi|cang|tinh|nha may|moi quen|cho si)(?: ca)?(?:\s+(?:o|tai|ben|cua|tinh|duoi|tren|ngoai|trong))*\s+(.+)$/;

/** Ý mới, ưu tiên cao: đứng trước DESTRUCTIVE (nhắn Zalo) và trước mẫu bão / hộp thư (bật chuông, chưa đọc). */
function matchCoCauMoi(s: string): Hit | null {
  if (ZALO_RE.test(s)) return hit("nhan_zalo", 0.9);
  if (DANG_XUAT_RE.test(s)) return hit("dang_xuat", 0.95);
  if (BAT_CHUONG_RE.test(s)) return hit("bat_chuong", 0.9);
  if (TAI_BAI_RE.test(s)) return hit("tai_bai", 0.9);
  if (CHUA_DOC_RE.test(s)) return hit("chua_doc", 0.85);
  if (SHOP_TAM_NGHI_RE.test(s) && !SHOP_MO_BAN_RE.test(s)) return hit("shop_tam_nghi", 0.85);
  if (SHOP_MO_BAN_RE.test(s)) return hit("shop_mo_ban", 0.85);
  // chọn tỉnh — không giành câu cảng nhà / đổi tàu ("đổi cảng nhà Cà Mau" là đặt cảng nhà); "Vũng Tàu" là tỉnh, không phải tàu
  if (!/\bcang nha\b/.test(s) && !/\btau\b/.test(s.replace(/\bvung tau\b/g, ""))) {
    const m = CHON_TINH_RE.exec(s) ?? XEM_TINH_RE.exec(s);
    if (m) {
      const province = provinceIn(m[1]);
      if (province) return hit("chon_tinh", 0.9, { province });
      // "chọn tỉnh" / "đổi tỉnh khác" mà chưa nói tên ⇒ answer hỏi lại
      if (/\btinh\b/.test(s) && /^(?:toi |tui |cho toi )?(?:chon|doi|loc|chuyen)/.test(s)) return hit("chon_tinh", 0.6);
    }
  }
  return null;
}

function matchPatterns(s: string, ctx: ParseContext): Hit | null {
  let m: RegExpExecArray | null;

  /* ── câu hỏi mở (chỉ báo mạnh) — trước cả chợ để "mùa này cá gì được giá" không thành "mua" ── */
  if (OPEN_STRONG.test(s)) return hit("hoi_mo", 0.8);

  /* ── cơ cấu mới 2026-10-25: bật chuông ("bật chuông báo bão" có chữ bão) · tải bài · chưa đọc · tạm nghỉ bán · chọn tỉnh ── */
  const cc = matchCoCauMoi(s);
  if (cc) return cc;

  /* ── them_gio (13 AC-T05: chỉ khi có giỏ hoặc "lấy N") ── */
  if ((m = new RegExp(`^(?:them|bo|cho|lay|mua gium|mua giup|them gium|them giup|them cho toi)\\s+(\\d+(?:[.,]\\d+)?)\\s*(?:(${U})\\s+)?(.+?)\\s+(?:vao|vo|bo|vao trong|vo trong)\\s+gio(?: hang)?$`).exec(s))) {
    return hit("them_gio", 0.9, qtySlots(m[1], m[2], m[3]));
  }
  if ((m = new RegExp(`^(?:them|bo|cho)\\s+(?:vao|vo)\\s+gio(?: hang)?\\s+(\\d+(?:[.,]\\d+)?)\\s*(?:(${U})\\s+)?(.+)$`).exec(s))) {
    return hit("them_gio", 0.9, qtySlots(m[1], m[2], m[3]));
  }
  if ((m = new RegExp(`^(?:them|bo|cho)\\s+(?:(${U})\\s+)?(.+?)\\s+(?:vao|vo|bo)\\s+gio(?: hang)?$`).exec(s))) {
    return hit("them_gio", 0.85, qtySlots("1", m[1], m[2]));
  }
  if ((m = new RegExp(`^lay\\s+(\\d+(?:[.,]\\d+)?)\\s*(?:(${U})\\s+)?(.+)$`).exec(s))) {
    return hit("them_gio", 0.85, qtySlots(m[1], m[2], m[3]));
  }

  /* ── tim_mon ── */
  if ((m = new RegExp(`^(?:toi )?(?:can mua|can tim|can|mua|tim|kiem|co ban|cho nao ban|cho nao co|o dau ban|ban o dau|dau co ban|tim mua|kiem mua|muon mua|dat mua)\\s+(?:(\\d+(?:[.,]\\d+)?)\\s*)?(?:(${U})\\s+)?(.+?)(?:\\s+(?:khong|o dau|gia bao nhieu|bao nhieu tien|bao nhieu|cho toi|duoc khong|nhe))*$`).exec(s))) {
    const q = m[3].trim();
    const notGoods = /^(khong|gio|bao|to|nhieu|lon|nho|it|suot|lai rai|ca|gia|hang|do|mon|gi|cai gi)$/.test(q) || /^(gio|dong|mua|goi|alo) /.test(q); // "cần gọi shop" không phải món
    if (q === "dau") return hit("khong_hieu", 0.5, { q }, "tim_mon"); // "mua dầu" — nhớt hay DO? hỏi lại
    // "cần gọi shop": "goi" bị bắt làm đơn vị (gói) — là gọi người, không phải mua gói gì
    const goiNguoi = m[2] === "goi" && /^(shop|sdvico|cua hang|nguoi ban|dai ly|tiem|tong dai|cong ty|hotline|hang|anh|chu|chi|co|ong|ba|bac)\b/.test(q);
    if (!notGoods && !goiNguoi) {
      const slots: Slots = { q };
      if (m[1]) {
        const n = Number(m[1].replace(",", "."));
        if (Number.isFinite(n)) slots.qty = Math.max(1, Math.min(999, Math.round(n)));
      }
      if (m[2]) slots.unit = m[2];
      // số đứng SAU danh từ ("mua đá 5 cây") — audit P2-4
      const tail = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${U})?$`).exec(q);
      if (tail && slots.qty === undefined) {
        slots.q = tail[1].trim();
        slots.qty = Math.max(1, Math.min(999, Math.round(Number(tail[2].replace(",", ".")))));
        if (tail[3]) slots.unit = tail[3];
      }
      return hit("tim_mon", 0.8, slots);
    }
  }

  /* ── đi được không (INT-06) — thắng mọi thoi_tiet ── */
  if (DI_DUOC.test(s)) {
    return hit("thoi_tiet", 0.9, { day: dayOf(s) ?? 0, aspect: "di_duoc", ...opt("portName", portIn(s, ctx)) });
  }

  /* ── giá dầu nói kèm "báo/bao nhiêu" — trước bão để "báo giá dầu" không thành tin bão (audit P1-6) ── */
  if (/\bgia (xang )?dau\b/.test(s)) return hit("gia_dau", 0.9);

  /* ── bão ── */
  if (isStorm(s)) return hit("bao", 0.9);

  /* ── "biển động không" = hỏi đi được không, không phải "dông" (audit P1-7); SAU bão vì "Biển Đông" fold giống hệt ── */
  if (/\bbien dong\b/.test(s)) {
    return hit("thoi_tiet", 0.85, { day: dayOf(s) ?? 0, aspect: "di_duoc", ...opt("portName", portIn(s, ctx)) });
  }

  /* ── con nước ── */
  if (/\b(con nuoc|nuoc lon|nuoc rong|thuy trieu|nuoc len|nuoc xuong|nuoc rac|trieu cuong|nuoc sao|nuoc dang|nuoc kem)\b/.test(s)) {
    return hit("con_nuoc", 0.85, { day: dayOf(s) ?? 0 });
  }

  /* ── giỏ (trước mo_man để "mở giỏ hàng" = INT-15) ── */
  if (/^(?:mo|xem|coi|kiem tra|cho xem)?\s*(?:trong )?gio(?: hang)?(?: cua toi| co gi| co may mon| dang co| co may| co nhung gi| the nao| sao)?$/.test(s) || /^trong gio co gi$/.test(s) || /^gio (co gi|co may mon)$/.test(s)) {
    return hit("xem_gio", 0.9);
  }

  /* ── gọi ── */
  // "tui muốn gọi shop" / "cần gọi SDVICO": chủ ngữ + muốn/cần đứng trước vẫn là gọi (audit P1-9)
  if ((m = /^(?:toi )?(?:muon |can |dinh |nho |cho toi )?(?:goi|alo)\s+(?:cho )?(?:sdvico|cong ty|tong dai|hotline|hang)$/.exec(s)) || /^alo sdvico$/.test(s)) {
    return hit("goi_sdvico", 0.95);
  }
  if ((m = /^(?:toi )?(?:muon |can |dinh |nho |cho toi )?(?:goi|alo)\s+(?:cho )?(shop|cua hang|nguoi ban|cho ban|dai ly|tiem|thang ban|ong ban|ba ban|ben ban|cho mua|ban(?= \S))(?:\s+(.+))?$/.exec(s))) {
    const rest = (m[2] ?? "").trim();
    if (m[1] === "ban" && /^thuyen/.test(rest)) return hit("goi_shop", 0.8, {}, "thuyen_vien");
    const isOrderRef = /^(don|dang giao|don dang giao|cua don|don moi|moi nhat|gan nhat)/.test(rest) || rest === "";
    return hit("goi_shop", 0.85, isOrderRef ? {} : { shopName: rest });
  }
  if ((m = /^(?:goi|alo)\s+(?:cho )?(anh|chu|chi|co|ong|ba|thang|em|bac|cau|thim|di)\s+(.+)$/.exec(s))) {
    // gọi người trong sổ (bạn thuyền) — F-30: không đọc SĐT, chỉ đường tới màn Bạn thuyền
    return hit("goi_shop", 0.8, { shopName: `${m[1]} ${m[2]}`.trim() }, "thuyen_vien");
  }

  /* ── mở màn (chỉ khi có động từ + tên màn; vài tên rõ nghĩa được đứng một mình) ── */
  if ((m = new RegExp(`^(?:${OPEN_VERBS})\\s+(?:man |muc |tab |phan |trang (?!chu|dau))?(.+)$`).exec(s))) {
    const target = screenOf(m[1]);
    if (target) return hit("mo_man", 0.9, { target });
  }
  if (/^(kenh nguoi ban|ban hang|trang chu|hop thu|huong dan|ra khoi|ngu truong|cho vat tu)$/.test(s)) {
    return hit("mo_man", 0.85, { target: screenOf(s)! });
  }

  /* ── giá dầu ── */
  if (/\b(gia dau|gia xang dau|gia xang)\b|\bdau do (bao nhieu|gia|sao|the nao|ky nay|hom nay|len|xuong|tang|giam)\b|\bdau (len|xuong|tang|giam|len hay xuong)\b|\b1 lit dau\b|\bdau bao nhieu\b|\bmot lit dau\b/.test(s)) {
    return hit("gia_dau", 0.9);
  }

  /* ── giá cá ── */
  if ((m = /^(?:coi |xem |cho hoi |hoi |cho coi |cho xem |coi giup |bao )?(?:bang )?gia(?:\s+(.+?))?(?:\s+(?:hom nay|tuan nay|bua nay|bao nhieu|sao|the nao|ra sao|ky nay))*$/.exec(s))) {
    if (!/\bdau\b/.test(m[1] ?? "")) return hit("gia_ca", 0.85, speciesSlots(m[1], s, ctx));
  }
  if ((m = /^(.+?)\s+(?:gia|ban)\s+(?:bao nhieu|sao|the nao|nhieu khong|re khong|ra sao)(?:\s+.*)?$/.exec(s)) && !/\bdau\b/.test(m[1])) {
    return hit("gia_ca", 0.85, speciesSlots(m[1], s, ctx));
  }
  if ((m = /^(.+?)\s+bao nhieu(?:\s+(?:1|mot))?\s+(?:ky|kg|kilo|can)(?:\s+.*)?$/.exec(s)) && !/\bdau\b/.test(m[1])) {
    return hit("gia_ca", 0.85, speciesSlots(m[1], s, ctx));
  }
  if ((m = /^(ca .+?|muc.*?|tom.*?)\s+o\s+(.+?)\s+(?:bao nhieu|gia sao|gia bao nhieu)$/.exec(s))) {
    return hit("gia_ca", 0.8, { ...speciesSlots(m[1], s, ctx), ...opt("portName", fuzzyNames(m[2], ctx.portNames)[0]) });
  }
  if (/\b(gia ben|bang gia|gia hom nay|gia tuan nay)\b/.test(s)) return hit("gia_ca", 0.8, {});
  // "đá cây bao nhiêu tiền" / "nhớt castrol bao nhiêu": loài cá → giá cá; vật tư → tìm trên chợ (audit P2-5)
  if ((m = /^(.+?)\s+(?:bao nhieu tien|gia bao nhieu|bao nhieu|gia sao|gia the nao|bao nhieu 1 (?:cai|thung|cay|bao|lit))$/.exec(s))
    && !WEATHER_WORDS.test(m[1]) && !/\b(tau|nguoi|gio|don|hang|tien|lit)\b/.test(m[1]) && !/^(dau|dau do|xang|xang dau|cai|mon|do|gi|hang|con|no|cai nay|cai do)$/.test(m[1])) {
    const subj = m[1].trim();
    if (SPECIES_WORDS.test(subj)) return hit("gia_ca", 0.85, speciesSlots(subj, s, ctx));
    return hit("tim_mon", 0.7, { q: subj });
  }

  /* ── tin mua bán ── */
  if ((m = /\b(?:ai mua|ai thu mua|cho nao thu mua|cho nao mua|thu mua|vua nao mua|dang tin ban|ban ca o dau|ban o dau duoc gia|tin mua ban|vua nao|ban ca)\b(?:\s+(.+))?/.exec(s))) {
    const rest = (m[1] ?? "").trim();
    const slots: Slots = {};
    const sp = SPECIES_WORDS.exec(rest);
    if (sp && sp[0] !== "ca") slots.species = sp[0];
    const port = portIn(s, ctx);
    if (port) slots.portName = port;
    return hit("tin_mua_ban", 0.85, slots);
  }

  /* ── đơn của tôi ── */
  if (/\b(don( cua toi)?|hang (toi|ve|den|tho) chua|dang giao|ship (toi|den|chua)|don (dau|toi|den|ve) (roi|chua)|shop xac nhan chua|shop giao chua|shop gui chua|coi don|xem don|don sao roi|don dang giao|don toi dau|hang (dau|toi dau|di dau))\b/.test(s) && !/\bdon gian\b/.test(s)) {
    const dangGiao = /\b(dang giao|toi chua|ve chua|den chua|tho chua|ship|toi dau|di dau|giao chua|gui chua)\b/.test(s);
    return hit("don_cua_toi", 0.85, { orderFilter: dangGiao ? "dang_giao" : "tat_ca" });
  }

  /* ── đặt cảng nhà ── */
  if (/^(?:dat|chon|doi|dat lai|doi lai|chuyen)\s+cang nha$/.test(s)) return hit("dat_cang_nha", 0.9); // chưa nói tên → answer hỏi lại
  if ((m = /^(?:dat|chon|doi|lay|dat lai|doi lai|chuyen)\s+cang nha\s+(?:la|thanh|sang|qua|o|ve|thanh cang)?\s*(.+)$/.exec(s))
    || (m = /^cang nha(?: cua toi| toi)?\s+(?:la|o|o cang)\s+(.+)$/.exec(s))
    || (m = /^(?:toi )?hay (?:di|xuat phat|di tu|ra khoi) (?:tu |o )?(?:cang )?(.+)$/.exec(s))
    || (m = /^cang (?:cua toi|cua tui|toi hay cap|hay cap) (?:la|o)\s+(.+)$/.exec(s))) {
    // khớp theo khoá cảng (bỏ tiền tố, gộp trùng hai danh sách) — audit P1-2; answer tra lại danh sách thật
    const found = matchPortKeys(m[1], ctx.portNames);
    return hit("dat_cang_nha", found.length === 1 ? 0.9 : found.length > 1 ? 0.55 : 0.5, { placeName: found.length === 1 ? found[0] : foldVn(m[1]) });
  }

  /* ── tàu của tôi / đổi tàu ── */
  if ((m = /^(?:doi|chuyen|chon)\s+(?:sang|qua|ve)?\s*tau\s+(.+)$/.exec(s))) {
    const found = fuzzyNames(m[1], ctx.boatNames);
    return hit("tau_cua_toi", found.length === 1 ? 0.9 : 0.5, { boatName: found[0] ?? foldVn(m[1]) });
  }
  if (/\b(tau (nao|dang chon|cua toi|nay|dang dung)|dang o tau nao|toi co may tau|co may tau|tau nay so gi|tau so gi|tau (toi|tui|minh|nay) so (gi|may|bao nhieu)|tau dang chon|tau gi|chon tau nao)\b/.test(s)) {
    return hit("tau_cua_toi", 0.9);
  }

  /* ── thuyền viên (trước giấy tờ: "ai chưa có bảo hiểm") ── */
  if (/\b(thuyen vien|ban thuyen|may nguoi|so nguoi|ai (chua|thieu|het|khong|can|con|bi)|danh sach (nguoi|ban)|may truong|thuyen truong|nguoi thieu gi|du nguoi|thieu nguoi)\b/.test(s)) {
    return hit("thuyen_vien", 0.85);
  }

  /* ── giấy tờ ── */
  if ((m = /\b(giay to|giay phep|dang kiem|bao hiem|chung chi|het han|sap het han|giay tau|giay gi|con han|giay nao|han giay|giay)\b/.exec(s))) {
    const slots: Slots = {};
    if (/\bdang kiem\b/.test(s)) slots.docKind = "dang_kiem";
    else if (/\bgiay phep\b/.test(s)) slots.docKind = "giay_phep_khai_thac";
    else if (/\bbao hiem\b/.test(s)) slots.docKind = "bao_hiem";
    else if (/\bchung chi\b/.test(s)) slots.docKind = "chung_chi_thuyen_truong";
    else if (/\ban toan thuc pham\b/.test(s)) slots.docKind = "an_toan_thuc_pham";
    return hit("giay_to", 0.85, slots);
  }

  /* ── bảo dưỡng ── */
  if (/\b(bao duong|thay dau nhot|toi han|toi ky|may moc|kiem tra may|thay loc|so bao duong|qua han|may toi ky|thay dau may|(toi|den) ky|dau nhot chua|loc dau chua|thay (dau nhot|loc))\b/.test(s)) {
    return hit("bao_duong", 0.85);
  }

  /* ── hộp thư ── */
  if (/\b(hop thu|tin (gi )?moi|thong bao( gi)?( moi| khong| nao)?|tin nhan|sdvico nhan gi|co tin gi|doc tin|thu moi|tin tuc)\b/.test(s)) {
    return hit("hop_thu", 0.85);
  }

  /* ── dẫn đường tới điểm đã lưu ── */
  if ((m = /^(?:dan duong|chi duong|dan|chay|di|toi|ra|den|ve|dan toi|chay toi|chay ra|di toi|di ra|di den|dan ve)\s+(?:toi |ra |den |ve |cho |diem |bai |chi )?(.+)$/.exec(s)) && !/\b(cho|gio|don|tau|giay)\b$/.test(s)) {
    const phrase = m[1].trim();
    if (/^cang nha$/.test(phrase) || /^(cang|nha)$/.test(phrase)) return hit("dan_duong", 0.9, { placeName: "cang nha" });
    const found = fuzzyNames(phrase, ctx.placeNames);
    if (found.length === 1) return hit("dan_duong", 0.9, { placeName: found[0] });
    if (found.length > 1) return hit("dan_duong", 0.55, { placeName: foldVn(phrase) });
    if (/^(dan duong|chi duong|dan toi|chay toi|chay ra|dan ve)\b/.test(s)) return hit("dan_duong", 0.45, { placeName: foldVn(phrase) });
  }

  /* ── thời tiết chung ── */
  if (WEATHER_WORDS.test(s)) {
    return hit("thoi_tiet", 0.85, { day: dayOf(s) ?? 0, aspect: aspectOf(s), ...opt("portName", portIn(s, ctx)) });
  }
  // "ngày mai sao" / "mốt trời sao" — chỉ mốc thời gian + hỏi
  if (/^(?:coi |xem )?(hom nay|ngay mai|ngay kia|tuan sau|cuoi tuan|\d+ (?:ngay|bua) (?:toi|nua|sau))(?: (?:troi|bien))?(?: (?:sao|the nao|ra sao|nhu the nao|sao roi|co gi|the nao roi))?$/.test(s)) {
    return hit("thoi_tiet", 0.8, { day: dayOf(s) ?? 0, aspect: "chung" });
  }

  return null;
}

function qtySlots(n: string, unit: string | undefined, q: string): Slots {
  const raw = Number(n.replace(",", "."));
  const qty = Number.isFinite(raw) ? Math.max(1, Math.min(999, Math.round(raw))) : 1;
  const out: Slots = { q: q.trim(), qty };
  if (unit) out.unit = unit;
  return out;
}

function speciesSlots(raw: string | undefined, s: string, ctx: ParseContext): Slots {
  const out: Slots = {};
  const cleaned = (raw ?? "")
    .replace(/\b(hom nay|tuan nay|bua nay|bao nhieu|sao|the nao|ra sao|ky nay|mot ky|1 ky|ben|bang|o .*)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned && cleaned !== "ca") out.species = cleaned;
  const port = portIn(s, ctx);
  if (port) out.portName = port;
  return out;
}

function screenOf(phrase: string): ScreenTarget | undefined {
  const p = phrase.replace(/\b(cua toi|toi|di|gium|giup|coi|nhe)\b/g, "").replace(/\s+/g, " ").trim();
  for (const [k, t] of SCREEN_PHRASES) {
    if (p === k) return t;
  }
  return undefined;
}

function opt<K extends keyof Slots>(k: K, v: Slots[K] | undefined): Partial<Slots> {
  return v === undefined || v === "" ? {} : ({ [k]: v } as Partial<Slots>);
}

/* ───────────────── bậc 3: điểm theo từ khoá ───────────────── */

const ROUTE_BIAS: [RegExp, Intent[]][] = [
  [/^\/cho/, ["tim_mon", "xem_gio", "don_cua_toi", "them_gio"]],
  [/^\/tau/, ["giay_to", "bao_duong", "tau_cua_toi"]],
  [/^\/ngu-truong/, ["thoi_tiet", "bao", "con_nuoc"]],
  // cơ cấu mới 2026-10-25: /tien?muc= (giá · mua bán · đầu mối: chọn tỉnh, nhắn Zalo) · /kairos · /cang · /ban-hang
  [/^\/tien/, ["gia_ca", "gia_dau", "tin_mua_ban", "chon_tinh", "nhan_zalo"]],
  [/^\/kairos/, ["tai_bai", "chua_doc"]],
  [/^\/cang/, ["dat_cang_nha", "chon_tinh"]],
  [/^\/ban-hang/, ["shop_tam_nghi", "shop_mo_ban"]],
  [/^\/nguoi/, ["thuyen_vien"]],
];

function scoreKeywords(s: string, ctx: ParseContext): Hit | null {
  let best: { intent: Intent; score: number } | null = null;
  const bias = ROUTE_BIAS.find(([re]) => re.test(ctx.route))?.[1] ?? [];
  for (const [intent, words] of Object.entries(KEYWORDS) as [Intent, string[]][]) {
    if (!words.length) continue;
    const got = words.filter((w) => includesWord(s, w)).length;
    if (!got) continue;
    let score = (got / words.length) * 0.7 + Math.min(0.15, got * 0.05);
    // route chỉ PHÁ HOÀ, không nâng qua ngưỡng 0.6
    if (bias.includes(intent)) score += 0.02;
    score = Math.min(0.59, score);
    if (!best || score > best.score) best = { intent, score };
  }
  if (best && best.score >= 0.35) return hit(best.intent, best.score);
  return null;
}

/* ───────────────── điểm vào ───────────────── */

function parseOne(s: string, ctx: ParseContext): Hit {
  if (!s) return hit("khong_hieu", 0);

  // 0. chặn trước
  for (const b of BLOCKLIST) {
    if (b.re.test(s)) return { intent: "ngoai_pham_vi", conf: 1, slots: {}, reason: b.reason };
  }

  // 1. điều khiển
  if (YES_RE.test(s)) {
    if (ctx.awaitingConfirm) return hit("xac_nhan", 1);
    if (CLOSE_RE.test(s)) return hit("huy", 1); // "dừng" (không chờ gì) = đóng, không phải "đúng"
    return /^(da|ok|oke|okie)$/.test(s) ? hit("chao_hoi", 1) : hit("khong_hieu", 0.3);
  }
  if (NO_RE.test(s)) {
    if (ctx.awaitingConfirm) return hit("tu_choi", 1);
    if (CLOSE_RE.test(s)) return hit("huy", 1);
    return hit("khong_hieu", 0.3);
  }
  if (CLOSE_RE.test(s)) return hit("huy", 1);
  for (const c of CONTROL) if (c.re.test(s)) return hit(c.intent, 1);

  // nhắn Zalo (cơ cấu mới): "gửi tin Zalo cho…" đứng trước bảng chặn "gui tin / nhan tin cho" bên dưới
  if (ZALO_RE.test(s)) return hit("nhan_zalo", 0.9);
  // hành động có hậu quả → không có mã, chỉ đường tới màn
  for (const d of DESTRUCTIVE) {
    if (d.re.test(s)) return hit("khong_hieu", 0.5, {}, d.goto);
  }

  // 2. mẫu ưu tiên
  const p = matchPatterns(s, ctx);
  if (p) return p;

  // 3. điểm từ khoá / câu hỏi mở
  const k = scoreKeywords(s, ctx);
  if (k) return k;
  if (OPEN_WEAK.test(s) && wordCount(s) >= 3) return hit("hoi_mo", 0.8);
  return hit("khong_hieu", 0);
}

/** Nối hai ý: chỉ tách khi cả hai vế có ≥2 chữ ("đơn của tôi sao rồi" không tách). */
const JOIN_RE = /\s(?:roi|xong|va|roi thi|xong roi|sau do)\s/;

export function parseUtterance(text: string, ctx: ParseContext): ParsedIntent {
  try {
    const s = normalizeUtterance(text);
    if (!s) return { intent: "khong_hieu", confidence: 0, slots: {}, normalized: "", reason: "rong" };
    if (wordCount(s) > MAX_WORDS) {
      return { intent: "khong_hieu", confidence: 0, slots: {}, normalized: s, reason: "qua_dai" };
    }

    // nhiều ý một câu
    const jm = JOIN_RE.exec(s);
    if (jm && jm.index !== undefined) {
      const left = s.slice(0, jm.index).trim();
      const right = s.slice(jm.index + jm[0].length).trim();
      if (wordCount(left) >= 2 && wordCount(right) >= 2) {
        const a = parseOne(left, ctx);
        const b = parseOne(right, ctx);
        if (a.conf >= CONFIDENCE_OFFLINE && b.conf >= CONFIDENCE_OFFLINE && a.intent !== "khong_hieu" && b.intent !== "khong_hieu" && a.intent !== b.intent) {
          return toParsed({ ...a, followUp: b.intent }, s, text);
        }
      }
    }

    return toParsed(parseOne(s, ctx), s, text);
  } catch {
    return { intent: "khong_hieu", confidence: 0, slots: {}, normalized: "" };
  }
}

function toParsed(h: Hit, normalized: string, original = ""): ParsedIntent {
  const out: ParsedIntent = { intent: h.intent, confidence: round2(h.conf), slots: withRaw(h.slots ?? {}, original), normalized };
  if (h.followUp) out.followUp = h.followUp;
  /*  Lý do chặn (y_te/phap_ly/tien/tra_nguoi/khac): hợp đồng `Slots` (14 §3.1
      nguyên văn) không có trường `reason`, còn `ParsedIntent.reason` chỉ nhận
      qua_dai/rong. Gắn vào `slots.q` (chuỗi nội bộ, không hiện) — đọc qua
      `blockReasonOf`. Ghi ở 14 History nếu lead muốn mở rộng hợp đồng. */
  if (h.intent === "ngoai_pham_vi" && h.reason) out.slots = { ...out.slots, q: h.reason };
  return out;
}

/** Chữ CÓ DẤU để hiện/đọc (audit P1-5) — khoá fold vẫn giữ nguyên để tra kho. */
function withRaw(slots: Slots, original: string): Slots {
  const out: Slots = { ...slots };
  if (slots.q) out.qRaw = rawSlot(original, slots.q);
  if (slots.unit) out.unitRaw = UNIT_DISPLAY[slots.unit] ?? slots.unit;
  const name = slots.shopName ?? slots.species ?? (slots.placeName !== "cang nha" ? slots.placeName : undefined);
  if (name) out.nameRaw = rawSlot(original, name);
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Lý do chặn (INT-26) — answer/test đọc từ `slots.q` của ngoai_pham_vi. */
export function blockReasonOf(p: ParsedIntent): string | undefined {
  return p.intent === "ngoai_pham_vi" ? p.slots.q : undefined;
}
