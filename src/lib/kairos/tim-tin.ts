// KAIROS — HỎI SEN BIỂN THAY Ô TÌM KIẾM (14 §15, việc 10 nghiên cứu FB). THUẦN, không mạng.
//
// "Sen ơi, bài về câu mực" / "tin Kairos về Lý Sơn" / "đọc báo" ⇒ lọc BẢN LƯU dòng tin trong máy
// (forfish.kairos.v1, cache.ts) theo từ khoá / chủ đề / tỉnh / cảng, đọc to 2–3 bài mới nhất và mở bài
// đầu. Mất sóng vẫn chạy y hệt — chỉ đọc bản lưu, KHÔNG gọi máy chủ.
//
// Nhận ý bằng LUẬT TỪ KHOÁ (không n-gram): phải có dấu hiệu Kairos rõ.
//  · MẠNH: "Kairos" (cả cách máy nghe ra "kai rốt"…), "bài", "đọc báo"/"bài báo"/"báo chí".
//  · YẾU: "tin tức", "bản tin", "tin về", "có tin", "đọc tin"… — chỉ nhận khi câu CÓ chủ đề/nơi chốn.
// ⚠️ Hỏi BÃO mà chỉ có dấu hiệu yếu ("có tin bão gì không") ⇒ KHÔNG nhận, để luồng cũ trả lời bằng tin bão
//    CHÍNH THỨC trong máy (answer.ts + đài duyên hải). Tin báo không được thay tin bão cho câu hỏi an toàn.
//    Muốn đọc báo về bão thì nói "bài về bão" / "tin bão trên Kairos".
// Khớp chữ CÓ DẤU khi câu có dấu (máy nghe luôn ra chữ có dấu): bỏ dấu thì "bão" trùng "báo", "cầu" trùng
// "câu". Câu gõ không dấu mới so kiểu bỏ dấu.

import { TOPICS, type Topic } from "./chu-de.mjs";
import { provinceIdOf } from "./khu-vuc.mjs";
import { foldVi } from "./lien-ket.mjs";
import type { KairosPost } from "./types";
import { NHAN_CHIP_KAIROS } from "@/lib/labels";

/** chữ thường, CÒN dấu, chỉ giữ chữ + số, gộp khoảng trắng */
export function thuongCoDau(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const coDau = (s: string) => /[\u0080-￿]/.test(s);

const KAIROS_CO_DAU = /(^| )(kairos|kai ?rốt|kai ?rốs|kai ?rô|cai ?rốt|cai ?rô|khai ?rốt|ka ?i ?rốt)( |$)/;
const KAIROS_KHONG_DAU = /(^| )(kairos|kai ?ro[ts]?|cai ?rot|khai ?rot)( |$)/;
const BAO_CHI = /(^| )(đọc báo|bài báo|báo chí|tờ báo|xem báo|coi báo)( |$)/;
const BAI = /(^| )bài( |$)/;
const TIN_YEU = /(^| )(tin tức|bản tin|tin mới|tin về|tin gì|tin nào|có tin|đọc tin|xem tin|coi tin|tin trên|tin ở)( |$)/;
/** câu về hộp thư / giấy tờ — "thông tin", "tin nhắn", "thông báo" không phải đọc tin Kairos */
const KHONG_PHAI = /(^| )(thông tin|tin nhắn|nhắn tin|thông báo|hộp thư|tin tưởng|tin cậy)( |$)/;
const BAO_CO_DAU = /(^| )(bão|áp thấp|siêu bão)( |$)/;

/** chữ đệm bỏ khỏi câu để còn lại đúng "cái cần tìm" (so trên chữ có dấu) */
const DEM = new Set(
  (
    "sen ơi có không gì nào về cho tôi mình tui tao em anh chị bác chú cô ông bà con đọc xem coi tìm kiếm mở nghe " +
    "những các mấy mới nhất hôm nay nay trên ở tại nói viết đăng của bài tin tức bản báo chí tờ kairos kai cai khai rốt rốs rô " +
    "nhé nha đi với giùm dùm giúp hộ xíu chút đâu được ai liên quan đến tới chuyện hay vậy thế à ạ hả hông hem đó này kia " +
    "thử coi cái một vài ít nhiều là thì mà gần đây vừa rồi"
  ).split(" "),
);
const DEM_KHONG_DAU = new Set([...DEM].map(foldVi));

export interface YTimTin {
  /** cụm cần tìm (chữ thường, còn dấu nếu câu có dấu); "" = đọc bài mới nhất */
  cum: string;
  /** câu có dấu ⇒ so chữ có dấu */
  coDau: boolean;
  chuDe: Topic | null;
  tinh: string | null;
  /** hỏi về bão/áp thấp (để nhắc đài duyên hải) */
  bao: boolean;
}

/**
 * Câu nói ⇒ ý "tìm tin Kairos", hoặc null (không phải — để luồng Sen Biển cũ xử lý).
 */
export function hieuTimTinKairos(text: string): YTimTin | null {
  const s = thuongCoDau(text).replace(/^(sen biển ơi|sen ơi|sen biển|ơi sen)( |$)/, "").trim();
  if (!s) return null;
  const f = foldVi(s);
  const daDau = coDau(s);
  const manh = KAIROS_CO_DAU.test(s) || KAIROS_KHONG_DAU.test(f) || BAO_CHI.test(s) || (daDau ? BAI.test(s) : /(^| )bai (ve|bao|tren|moi|nao|gi|noi|viet|dang)( |$)/.test(f));
  const yeu = daDau ? TIN_YEU.test(s) : /(^| )(tin tuc|ban tin|tin moi|tin ve|doc tin|tin tren)( |$)/.test(f);
  if (!manh && !yeu) return null;
  if (!manh && KHONG_PHAI.test(s)) return null;
  const bao = daDau ? BAO_CO_DAU.test(s) : false;
  const tu = (daDau ? s : f).split(" ").filter((w) => w && !(daDau ? DEM : DEM_KHONG_DAU).has(w));
  const cum = tu.join(" ");
  if (!manh) {
    if (!cum) return null; // "có tin gì không" trần — không rõ hỏi Kairos
    if (bao) return null; // câu bão: tin CHÍNH THỨC trước (xem đầu file)
    if (!daDau && /(^| )bao( |$)/.test(cum)) return null; // gõ không dấu "tin bao" — có thể là bão
  }
  const fc = foldVi(cum);
  const chuDe = (TOPICS as readonly Topic[]).find((t) => foldVi(NHAN_CHIP_KAIROS[t]) === fc) ?? null;
  const tinh = cum ? provinceIdOf(cum) : null;
  return { cum: chuDe ? "" : cum, coDau: daDau, chuDe, tinh, bao: bao || (!daDau && fc === "bao") };
}

const hayCuaBai = (p: KairosPost) => [p.title, p.summary, p.body, p.outlet, p.author?.handle].filter(Boolean).join(" ");
const maNoi = (p: KairosPost) => [...p.provinces, ...p.ports].join(" ").replace(/-/g, " ");
const coCum = (hay: string, cum: string) => ` ${hay} `.includes(` ${cum} `);
const coDuTu = (hay: string, cum: string) => {
  const w = new Set(hay.split(" "));
  return cum.split(" ").every((t) => w.has(t));
};

/** Bài khớp ý, mới nhất trước (bài đăng lại xét cả bài gốc). */
export function timTinKairos(posts: readonly KairosPost[], y: YTimTin): KairosPost[] {
  const cum = y.coDau ? y.cum : foldVi(y.cum);
  const fcum = foldVi(y.cum);
  const out = posts.filter((p) => {
    if (y.chuDe && p.topic !== y.chuDe) return false;
    if (!cum) return true;
    if (y.tinh && p.provinces.includes(y.tinh)) return true;
    const goc = p.reshareOf ? `${hayCuaBai(p)} ${hayCuaBai(p.reshareOf)}` : hayCuaBai(p);
    const hay = y.coDau ? thuongCoDau(goc) : foldVi(goc);
    if (coCum(hay, cum) || coDuTu(hay, cum)) return true;
    if (y.bao && y.coDau && /(^| )áp thấp( |$)/.test(hay)) return true;
    return fcum.length >= 3 && coCum(maNoi(p), fcum);
  });
  return out.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}

/** Một dòng đọc to cho một bài: tiêu đề (bài báo) hoặc "Tên: câu đầu" (bài bà con), ≤90 ký tự. */
export function dongDoc(p: KairosPost): string {
  const cat = (s: string, n: number) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length <= n) return t.replace(/[.!?…]+$/, "");
    const c = t.slice(0, n);
    return `${c.slice(0, Math.max(c.lastIndexOf(" "), n - 15))}…`;
  };
  if (p.title) return cat(p.title, 90);
  const dau = (p.summary || p.body || (p.reshareOf ? (p.reshareOf.title ?? p.reshareOf.body) : "")).split(/[.!?]\s/)[0] ?? ""; // không lookbehind — Safari < 16.4 chết cả chunk (safari-cu.test)
  const ai = p.author?.handle ? `${p.author.handle}: ` : "";
  return `${ai}${cat(dau, 90 - ai.length)}`;
}

export interface TraLoiTinKairos {
  noi: string;
  den: string;
}

const TRE_MS = 6 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Trả lời đủ câu: đọc tối đa 3 bài + đường mở. `cache` = bản lưu đúng ngăn SĐT (loadFeedCache) hoặc null.
 */
export function traLoiTinKairos(
  y: YTimTin,
  cache: { savedAt: number; posts: readonly KairosPost[] } | null,
  now: number,
  toiDa = 3,
): TraLoiTinKairos {
  const nhacBao = y.bao ? " Tin bão chính thức bà con nghe đài duyên hải." : "";
  if (!cache || cache.posts.length === 0) {
    return { noi: `Máy chưa lưu tin Kairos nào. Có sóng thì mở Kairos để tải.${nhacBao}`, den: "/kairos" };
  }
  const gi = y.chuDe ? `mục ${NHAN_CHIP_KAIROS[y.chuDe]}` : y.cum;
  const kq = timTinKairos(cache.posts, y);
  if (!kq.length) {
    return { noi: `Bản lưu Kairos chưa có bài về ${gi}. Có sóng thì mở Kairos xem thêm.${nhacBao}`, den: "/kairos" };
  }
  const dau = gi ? `Có ${kq.length} bài về ${gi}.` : "Tin Kairos mới nhất.";
  const dong = kq.slice(0, toiDa).map((p, i) => `${kq.length > 1 ? `Bài ${i + 1}: ` : ""}${dongDoc(p)}.`);
  const d = new Date(cache.savedAt);
  const cu = now - cache.savedAt > TRE_MS ? ` Bản lưu lúc ${pad(d.getHours())}:${pad(d.getMinutes())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}.` : "";
  return { noi: `${dau} ${dong.join(" ")}${cu}${nhacBao}`, den: `/kairos/p/${encodeURIComponent(kq[0].id)}` };
}
