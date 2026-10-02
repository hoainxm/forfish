// ADMIN TỔNG — tạo / đổi mật khẩu tài khoản đăng nhập bằng TÊN (2026-10-02).
//
// Vì sao là script chứ không phải nút trên web: đây là chìa mở mọi cửa, nên
// mật khẩu do CHỦ DỰ ÁN tự gõ trên máy mình (không hiện ra màn hình, không đi
// qua chat/log/web), script gửi thẳng tới Supabase Auth bằng service-role.
//
//   node scripts/owner-account.mjs admin          # tạo mới, hoặc đổi mật khẩu nếu đã có
//
// Cần: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env hoặc .env.local).
// Tên phải TRÙNG env OWNER_LOGIN trên Vercel — không trùng thì đăng nhập được
// vào Supabase nhưng máy chủ SDFish không nhận là admin tổng (an toàn: không
// mở quyền gì).
//
// Đổi mật khẩu ⇒ THU HỒI mọi chuỗi đăng nhập đang sống của admin tổng, và ghi
// nhật ký `staff.owner-setup` (không bao giờ ghi mật khẩu).

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, makeRest } from "./test-account.mjs";

export const OWNER_DOMAIN = "sdvico.local";
export const OWNER_PASSWORD_MIN = 12;

/** Cùng khuôn với lib/admin normalizeOwnerLogin (thuần, có test). */
export function normalizeOwnerLogin(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(s)) return null;
  return s;
}

const WEAK = ["password", "matkhau", "123456", "qwerty", "admin", "sdvico", "sdfish", "forfish"];

/**
 * Luật mật khẩu admin tổng (thuần, có test). Trả null = đạt, hoặc câu lý do.
 * Không chặn cứng kiểu "phải có ký tự đặc biệt" — chặn đúng thứ hay bị dò.
 */
export function ownerPasswordProblem(pw, login) {
  if (typeof pw !== "string" || pw.length < OWNER_PASSWORD_MIN)
    return `tối thiểu ${OWNER_PASSWORD_MIN} ký tự`;
  const low = pw.toLowerCase();
  if (login && low.includes(login)) return "không được chứa tên đăng nhập";
  if (WEAK.some((w) => low.includes(w))) return "chứa chuỗi quá dễ đoán (admin, 123456, password, sdvico…)";
  if (new Set(pw).size < 6) return "quá ít ký tự khác nhau";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (kinds < 3) return "cần ít nhất 3 trong 4 loại: chữ thường, chữ hoa, số, ký tự khác";
  return null;
}

/** Hỏi mật khẩu KHÔNG hiện ra màn hình. */
function askHidden(question) {
  return new Promise((done, fail) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return fail(new Error("Cần chạy trong terminal (TTY) để gõ mật khẩu ẩn."));
    stdout.write(question);
    let buf = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        done(buf);
      } else if (ch === "\u0003") {
        stdin.setRawMode(false);
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/** Gọi Auth admin API của Supabase bằng service-role. */
export function makeAuth({ url, srk }, fetchImpl = globalThis.fetch) {
  const headers = { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" };
  const call = async (method, path, body) => {
    const r = await fetchImpl(`${url}/auth/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`AUTH ${method} ${path.split("?")[0]} → HTTP ${r.status}: ${text.slice(0, 160)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    async findByEmail(email) {
      for (let page = 1; page <= 50; page++) {
        const j = await call("GET", `admin/users?page=${page}&per_page=200`);
        const users = j?.users ?? [];
        const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (hit) return hit;
        if (users.length < 200) return null;
      }
      return null;
    },
    create: (email, password) =>
      call("POST", "admin/users", { email, password, email_confirm: true, user_metadata: { owner: true, must_change_password: false } }),
    setPassword: (id, password) => call("PUT", `admin/users/${id}`, { password }),
  };
}

/** Tạo hoặc đổi mật khẩu + thu hồi chuỗi + ghi nhật ký. Trả "created" | "updated". */
export async function setupOwner({ auth, rest, login, password }) {
  const email = `${login}@${OWNER_DOMAIN}`;
  const existing = await auth.findByEmail(email);
  let result;
  if (existing) {
    await auth.setPassword(existing.id, password);
    result = "updated";
  } else {
    await auth.create(email, password);
    result = "created";
  }
  // đổi mật khẩu = mọi máy đang giữ chuỗi admin tổng phải đăng nhập lại
  await rest.patch(`device_tokens?customer_phone=eq.${encodeURIComponent(login)}&revoked_at=is.null`, {
    revoked_at: new Date().toISOString(),
    revoked_reason: "admin",
  });
  try {
    await rest.post("admin_activity_log", {
      actor_phone: "script:owner-account",
      actor_role: "script",
      action: "staff.owner-setup",
      target: login,
      detail: { result },
    });
  } catch (e) {
    console.error(`! không ghi được nhật ký: ${String(e).slice(0, 120)}`);
  }
  return result;
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const login = normalizeOwnerLogin(process.argv[2] ?? "");
    if (!login) throw new Error("Dùng: node scripts/owner-account.mjs <tên> (chữ thường, 3–32 ký tự, vd admin)");
    const env = loadEnv();
    console.log(`Admin tổng "${login}" → ${login}@${OWNER_DOMAIN} trên ${env.url}`);
    console.log(`Mật khẩu: tối thiểu ${OWNER_PASSWORD_MIN} ký tự, 3/4 loại (thường/HOA/số/ký tự khác), không chứa tên/admin/123456.`);
    const pw = await askHidden("Mật khẩu mới: ");
    const why = ownerPasswordProblem(pw, login);
    if (why) throw new Error(`Mật khẩu chưa đạt: ${why}`);
    const pw2 = await askHidden("Gõ lại: ");
    if (pw2 !== pw) throw new Error("Hai lần gõ không khớp.");
    const r = await setupOwner({ auth: makeAuth(env), rest: makeRest(env), login, password: pw });
    console.log(r === "created" ? "✓ Đã TẠO admin tổng." : "✓ Đã ĐỔI mật khẩu admin tổng (mọi máy đang đăng nhập đã bị đăng xuất).");
    console.log(`Nhớ: env OWNER_LOGIN=${login} trên Vercel rồi deploy; đăng nhập /quan-tri bằng tên "${login}".`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
