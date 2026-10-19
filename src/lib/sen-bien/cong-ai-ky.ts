// KÝ YÊU CẦU GỬI CỔNG NHÀ AI ASSISTANT (/gw/v1/forfish/hoi) — luật THUẦN, test được (ADR 0016, 2026-10-19).
//
// Sen Biển hỏi "máy nhà" (gpu-desktop, Gemma trong máy) khi máy bà con không tự trả lời được. Server ForFish đứng
// giữa: kiểm thuê bao, rồi KÝ yêu cầu theo đúng công thức của repo AI Assistant `app/core/cong-gw.mjs`:
//   chuoiKy = ts ⏎ nonce ⏎ METHOD ⏎ duong ⏎ nguoi ⏎ khachThue ⏎ hex SHA-256(body)
//   HMAC:  x-forlife-sig  = hex HMAC-SHA256(khoá cổng, chuoiKy)        (IIS công ty / máy dev — env FORLIFE_GW_KEY)
//   OIDC:  x-forlife-bind = hex SHA-256(token ⏎ chuoiKy)               (Vercel — token x-vercel-oidc-token)
// Sai một byte là 401 bên kia ⇒ cổng `sen-bien-cong-ai.test.ts` khoá công thức bằng một vector tính độc lập.
//
// `nguoi` = MÃ THUÊ BAO GIẢ DANH "tb-" + 24 hex = HMAC-SHA256(muối, "forfish-tb:" + SĐT) cắt 96 bit. Máy nhà KHÔNG
// BAO GIỜ thấy SĐT; cùng một người luôn ra cùng mã (để nhịp + vòng train nhóm câu theo người), đổi muối = đổi hết mã.

import { createHash, createHmac, randomBytes } from "node:crypto";

export const GW_URL_MAC_DINH = "https://gpu-desktop.tail1438a1.ts.net";
export const DUONG_HOI = "/gw/v1/forfish/hoi";
export const KHACH_THUE_TB = "forfish-thue-bao";
const KHOA_RE = /^[A-Za-z0-9_-]{32,128}$/;
const OIDC_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const sha256Hex = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");

export type TruongKy = { ts: string; nonce: string; method: string; duong: string; nguoi: string; khachThue: string; body: string };

/** = chuoiKy của AI Assistant cong-gw.mjs (7 dòng). */
export function chuoiKy(t: TruongKy): string {
  return `${t.ts}\n${t.nonce}\n${t.method.toUpperCase()}\n${t.duong}\n${t.nguoi}\n${t.khachThue}\n${sha256Hex(t.body)}`;
}
export const kyHmac = (khoa: string, t: TruongKy) => createHmac("sha256", khoa).update(chuoiKy(t)).digest("hex");
export const bindOidc = (token: string, t: TruongKy) => sha256Hex(`${token}\n${chuoiKy(t)}`);

/** Mã thuê bao giả danh. Muối rỗng ⇒ null (KHÔNG băm trần SĐT — băm trần dò ngược được từ danh bạ 10 số). */
export function maThueBao(phone: string, muoi: string): string | null {
  if (!muoi || !/^0\d{9}$/.test(phone)) return null;
  return "tb-" + createHmac("sha256", muoi).update(`forfish-tb:${phone}`).digest("hex").slice(0, 24);
}

/**
 * Chọn cách ký: có khoá HMAC hợp lệ ⇒ HMAC; không thì token OIDC Vercel hợp lệ ⇒ OIDC; không có gì ⇒ null (chưa nối —
 * route trả 503, app nói câu trong máy). `FORLIFE_GW_OIDC=1` ép OIDC (giống api/_chung.mjs bên AI Assistant).
 */
export function cachKy(env: Record<string, string | undefined>, oidcToken: string | null):
  | { loai: "hmac"; khoa: string }
  | { loai: "oidc"; token: string }
  | null {
  const khoa = env.FORLIFE_GW_KEY ?? "";
  const token = oidcToken || env.VERCEL_OIDC_TOKEN || "";
  if (env.FORLIFE_GW_OIDC !== "1" && KHOA_RE.test(khoa)) return { loai: "hmac", khoa };
  if (token.length <= 8192 && OIDC_RE.test(token)) return { loai: "oidc", token };
  return null;
}

/** Header đầy đủ cho một lượt hỏi (ts + nonce mới mỗi lượt — bên kia chống phát lại). */
export function dauKy(
  ky: NonNullable<ReturnType<typeof cachKy>>,
  tb: string,
  body: string,
  now = Date.now(),
  nonce = randomBytes(16).toString("hex"),
): Record<string, string> {
  const t: TruongKy = { ts: String(now), nonce, method: "POST", duong: DUONG_HOI, nguoi: tb, khachThue: KHACH_THUE_TB, body };
  return {
    "content-type": "application/json",
    "x-forlife-ts": t.ts,
    "x-forlife-nonce": nonce,
    "x-forlife-nguoi": tb,
    "x-forlife-khach-thue": KHACH_THUE_TB,
    ...(ky.loai === "hmac"
      ? { authorization: `Bearer ${ky.khoa}`, "x-forlife-sig": kyHmac(ky.khoa, t) }
      : { authorization: `Bearer ${ky.token}`, "x-forlife-bind": bindOidc(ky.token, t) }),
  };
}

/**
 * Kiểm câu hỏi máy gửi lên (ranh giới): text 1–300 ký tự; màn = đường đầu; cảng ≤40 chữ; hạng = dấu hạng TRONG MÁY
 * ("premium" | "thuong"). Lạ ⇒ bỏ ô (text lạ ⇒ null). Hạng do máy tự khai CHỈ đổi câu chữ của Gemma (nói đúng gói),
 * KHÔNG mở quyền gì — nên không tra DB mỗi câu (bớt một lượt khứ hồi, mục tiêu < 1 s, 19/10).
 */
export function kiemCauHoi(b: unknown): { text: string; man: string | null; cang: string | null; hang: "premium" | "thuong" | null } | null {
  if (!b || typeof b !== "object" || Array.isArray(b)) return null;
  const o = b as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > 300) return null;
  const man = typeof o.man === "string" && /^\/[a-z0-9/-]{0,60}$/.test(o.man) ? o.man : null;
  const cang = typeof o.cang === "string" && /^[\p{L}\p{N} .,'()-]{1,40}$/u.test(o.cang.trim()) ? o.cang.trim() : null;
  const hang = o.hang === "premium" || o.hang === "thuong" ? o.hang : null;
  return { text, man, cang, hang };
}
