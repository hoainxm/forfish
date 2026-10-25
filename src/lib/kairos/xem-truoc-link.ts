// KAIROS — THẺ XEM TRƯỚC LINK TRONG BÌNH LUẬN (14 §3.4b, kiểu Facebook; migration 0070).
//
// Máy chủ đọc trang LÚC GHI bình luận (route POST bình luận), lưu {url, site, title, image} vào
// `link_preview` — người đọc không gọi mạng ra ngoài, mất sóng vẫn hiện chữ thẻ từ bản lưu.
//
// Chống SSRF (máy chủ đi đọc link do người dùng dán): chỉ http(s) cổng mặc định, host phải là tên miền
// (không IP trần, không localhost/.local/.internal), tên miền phân giải ra IP CÔNG KHAI (kiểm lại mỗi
// lần chuyển hướng, tối đa 3), đồng hồ 3 s tổng, đọc tối đa 256 KB, chỉ text/html. Mọi lỗi ⇒ null —
// bình luận vẫn đăng, chỉ thiếu thẻ.
// nợ: kiểm DNS rồi fetch phân giải lại (DNS rebinding) — trần: kẻ xấu cần tên miền tự đổi IP trong ~ms; nâng bằng agent http tự nối IP đã kiểm khi có dịch vụ nội bộ đáng giữ sau lưng máy chủ.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { decodeEntities, stripHtml } from "./thu-core.mjs";
import { laNoiBo, type LinkPreview } from "./types";

export type { LinkPreview };

const URL_RE = /\bhttps?:\/\/[^\s<>"'()]+/i;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 3_000;

/** Link http(s) ĐẦU TIÊN trong chữ bình luận (bỏ dấu câu dính đuôi). Không có ⇒ null. */
export function timLink(body: string): string | null {
  const m = URL_RE.exec(body ?? "");
  if (!m) return null;
  const raw = m[0].replace(/[.,;:!?…]+$/, "");
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Host được phép đi đọc (kiểm TÊN, chưa phân giải): tên miền có chấm, không IP trần, không tên nội bộ. */
export function hostDuocDoc(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.port && u.port !== "80" && u.port !== "443") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!h.includes(".") || isIP(h.replace(/^\[|\]$/g, ""))) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(h);
}

/** IP công khai? (chặn mạng riêng, loopback, link-local, CGNAT, multicast, IPv6 ULA/link-local, IPv4-mapped). */
export function ipCongKhai(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return ipCongKhai(mapped[1]);
    if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith("ff")) return false;
    return true;
  }
  return false;
}

const meta = (html: string, ten: string): string | null => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${ten}["'][^>]*>`, "i");
  const the = re.exec(html)?.[0];
  if (!the) return null;
  return /content=["']([^"']*)["']/i.exec(the)?.[1] ?? null;
};

const gon = (s: string, n: number) => {
  const t = stripHtml(decodeEntities(s)).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Trang HTML ⇒ thẻ xem trước (THUẦN). Không có tiêu đề ⇒ null (thẻ trống không đáng hiện). */
export function docTrang(html: string, url: string): LinkPreview | null {
  const s = String(html ?? "").slice(0, MAX_BYTES);
  const rawTitle = meta(s, "og:title") ?? meta(s, "twitter:title") ?? /<title[^>]*>([^<]*)<\/title>/i.exec(s)?.[1] ?? null;
  const title = rawTitle ? gon(rawTitle, 140) : "";
  if (!title) return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const rawSite = meta(s, "og:site_name");
  const site = rawSite ? gon(rawSite, 40) || host : host;
  let image: string | null = null;
  const rawImg = meta(s, "og:image") ?? meta(s, "twitter:image");
  if (rawImg) {
    try {
      const u = new URL(decodeEntities(rawImg).trim(), url);
      if (u.protocol === "https:") image = u.toString();
    } catch {
      image = null;
    }
  }
  return { url, site, title, image };
}

/** Bản lưu DB (jsonb, có thể hỏng) ⇒ thẻ hợp lệ hoặc null. */
export function docXemTruoc(raw: unknown): LinkPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.url !== "string" || typeof r.title !== "string" || !r.title) return null;
  if (!/^https?:\/\//i.test(r.url) && !laNoiBo(r.url)) return null;
  const image = typeof r.image === "string" && (r.image.startsWith("https://") || laNoiBo(r.image)) ? r.image : null;
  return { url: r.url, site: typeof r.site === "string" ? r.site : "", title: r.title, image };
}

async function hostAnToan(u: URL): Promise<boolean> {
  if (!hostDuocDoc(u)) return false;
  try {
    const all = await lookup(u.hostname, { all: true });
    return all.length > 0 && all.every((a) => ipCongKhai(a.address));
  } catch {
    return false;
  }
}

/** Đọc trang ⇒ thẻ xem trước. KHÔNG ném; lỗi / quá giờ / trang lạ ⇒ null. */
export async function layXemTruoc(link: string, fetchImpl: typeof fetch = fetch): Promise<LinkPreview | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    let u = new URL(link);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      if (!(await hostAnToan(u))) return null;
      const r = await fetchImpl(u.toString(), {
        redirect: "manual",
        signal: ac.signal,
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; KairosLinkPreview/1.0)" },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        u = new URL(loc, u);
        continue;
      }
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("text/html") || !r.body) return null;
      const reader = r.body.getReader();
      const parts: Uint8Array[] = [];
      let n = 0;
      while (n < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        n += value.length;
      }
      void reader.cancel().catch(() => {});
      const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(parts.map((p) => Buffer.from(p))).subarray(0, MAX_BYTES));
      return docTrang(html, u.toString());
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
