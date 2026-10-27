// KAIROS — CHUẨN HOÁ LINK + TIÊU ĐỀ ĐỂ CHẶN TRÙNG (14 §9 bước 2). THUẦN.
//
// Vì sao .mjs: máy thu tin (scripts/kairos-thu.mjs, Node trần trên gpu-desktop) và route
// /api/kairos/nhap (máy chủ chạy LẠI chặn trùng) phải băm ĐÚNG một cách — một bên lệch một
// ký tự là bài trùng lọt lên dòng tin. Node trần không import được .ts có alias "@/", nên
// phần dùng chung viết JS thuần + JSDoc (khuôn data-codec.mjs); TS vẫn đọc được kiểu.
//
// Luật trùng: link chuẩn hoá trùng ⇒ bỏ VĨNH VIỄN (url_hash unique); tiêu đề chuẩn hoá
// trùng trong 7 NGÀY ⇒ bỏ (báo khác đăng lại cùng tin).
//
// KHÔNG `import … from "node:crypto"` ở đầu file (2026-10-26): `foldVi` của file này đi vào
// màn Kairos phía điện thoại (khu-vuc, chu-de, chinh-sach → thu-core…), import tĩnh làm Next
// nhét nguyên bộ crypto giả lập ~420 KB vào JS MỌI trang. `urlHash` chỉ chạy ở máy chủ/máy thu
// ⇒ lấy node:crypto lúc gọi (`process.getBuiltinModule`, Node ≥ 20.16). Cổng: kairos-lien-ket-chu-de.test.ts.

/** Tham số theo dõi quảng cáo — bỏ khỏi link trước khi băm. */
const TRACKING = /^(utm_[a-z_]*|fbclid|gclid|zarsrc|zaloid|_gl|mc_cid|mc_eid)$/i;

/** Cửa sổ trùng tiêu đề (ms). */
export const TITLE_DUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bỏ dấu — ĐÚNG luật `foldVn` (src/lib/market/text.ts): thường, NFD bỏ dấu, đ→d, chỉ giữ
 * [a-z0-9 ], gộp khoảng trắng. Chép lại vì file này phải chạy được ở Node trần;
 * test `kairos-lien-ket.test.ts` so hai hàm trên cùng bộ chuỗi để không lệch nhau.
 * @param {string} s
 * @returns {string}
 */
export function foldVi(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Link gốc ⇒ dạng chuẩn: https, host chữ thường bỏ "www." và ".amp" cuối/"/amp", bỏ `#…`,
 * bỏ tham số theo dõi, bỏ "/" cuối. Link hỏng / không phải http(s) ⇒ null (không nhận bài).
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 1000) return null;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.protocol = "https:";
  u.hash = "";
  u.username = "";
  u.password = "";
  u.port = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^amp\./, "");
  const keep = [];
  for (const [k, v] of u.searchParams) if (!TRACKING.test(k)) keep.push([k, v]);
  keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  u.search = keep.length ? "?" + new URLSearchParams(keep).toString() : "";
  let path = u.pathname.replace(/\/amp\/?$/i, "").replace(/\.amp$/i, "");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  u.pathname = path || "/";
  const out = u.toString();
  return out.endsWith("/") && u.pathname === "/" && !u.search ? out.slice(0, -1) : out;
}

/**
 * Băm link chuẩn hoá (sha256 hex) — cột `url_hash`. Link hỏng ⇒ null.
 * @param {string} raw
 * @returns {string | null}
 */
export function urlHash(raw) {
  const n = normalizeUrl(raw);
  return n ? process.getBuiltinModule("node:crypto").createHash("sha256").update(n).digest("hex") : null;
}

/**
 * Tiêu đề ⇒ khoá so trùng (`title_norm`): bỏ dấu, bỏ tiền tố kiểu "[Video]", "Video:",
 * "Clip:", "Ảnh:", "Trực tiếp:"; cắt 300 ký tự. Quá ngắn (< 12 ký tự) ⇒ null — tiêu đề kiểu
 * "Tin vắn" giữa hai báo không phải cùng một tin.
 * @param {string} title
 * @returns {string | null}
 */
export function titleNorm(title) {
  const t = String(title ?? "")
    .replace(/^\s*\[[^\]]{1,20}\]\s*/, "")
    .replace(/^\s*(video|clip|ảnh|anh|trực tiếp|truc tiep|infographic|emagazine)\s*[:|-]\s*/i, "");
  const f = foldVi(t).slice(0, 300).trim();
  return f.length >= 12 ? f : null;
}

/**
 * Tiêu đề này có trùng tin đã thấy trong 7 ngày không.
 * @param {string | null} norm  kết quả titleNorm
 * @param {{ titleNorm: string | null, firstSeenAt: string | number | Date }[]} seen
 * @param {number} now  ms
 * @returns {boolean}
 */
export function isDupTitle(norm, seen, now) {
  if (!norm) return false;
  for (const s of seen) {
    if (s.titleNorm !== norm) continue;
    const t = new Date(s.firstSeenAt).getTime();
    if (Number.isFinite(t) && now - t <= TITLE_DUP_WINDOW_MS && t <= now + 60_000) return true;
  }
  return false;
}
