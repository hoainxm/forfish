// TÀI KHOẢN TEST — cấp chuỗi thiết bị / nâng hạng tạm / dọn, MỘT LỆNH (2026-09-17).
//
// Vì sao: app xác thực bằng chuỗi thiết bị (lib/device-token), không có phiên
// Supabase, nên "đăng nhập tài khoản test" = chèn một hàng device_tokens. Trước
// đây phải nhớ SQL + cách băm + luật "1 tài khoản 1 máy"; nay script làm và
// tự dọn. KHOANH VÙNG: chỉ số có trong scripts/test-accounts.json.
//
// Cần: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env hoặc .env.local).
//
//   node scripts/test-account.mjs ds                       # danh sách + hạng + số chuỗi sống
//   node scripts/test-account.mjs cap 0900000777           # cấp chuỗi, in header + đoạn dán trình duyệt
//   node scripts/test-account.mjs cap 0900000777 --premium 1   # kèm nâng premium tạm 1 ngày
//   node scripts/test-account.mjs cap 0912345678 --multi   # tài khoản đang có máy thật: cấp thêm, không đá
//   node scripts/test-account.mjs thu 0900000777           # xoá chuỗi do script cấp + trả hạng gốc
//   node scripts/test-account.mjs thu --all                # dọn mọi chuỗi do script cấp
//
// Dấu vết để dọn đúng thứ mình tạo: device_tokens.device_id = "test-script",
// platform = "test:<hạng gốc>" (đọc lại để trả hạng). Không đụng chuỗi của máy thật.

import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

export const MARK = "test-script";
const HERE = dirname(fileURLToPath(import.meta.url));
export const ACCOUNTS_FILE = join(HERE, "test-accounts.json");

/** @returns {{ phone: string, tier: string, name: string, purpose: string }[]} */
export function loadTestAccounts(file = ACCOUNTS_FILE) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(j.accounts)) throw new Error("test-accounts.json: thiếu mảng accounts");
  for (const a of j.accounts) {
    if (!/^0\d{9}$/.test(a.phone) || !["basic", "premium"].includes(a.tier)) throw new Error(`test-accounts.json: hàng hỏng ${JSON.stringify(a)}`);
  }
  return j.accounts;
}

/** Đọc KEY=VALUE từ .env.local (không ghi đè env đã có). Thuần, test được. */
export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function loadEnv(root = process.cwd()) {
  const p = join(root, ".env.local");
  const file = existsSync(p) ? parseEnvFile(readFileSync(p, "utf8")) : {};
  const env = { ...file, ...process.env };
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const srk = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !srk) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env hoặc .env.local)");
  return { url, srk };
}

/** Chuỗi thiết bị đúng khuôn lib/device-token: "sdf_" + 43 base64url = 47 ký tự; băm SHA-256 hex. */
export function newToken() {
  const token = "sdf_" + randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

/** REST Supabase bằng service-role (bỏ qua RLS). */
export function makeRest({ url, srk }, fetchImpl = globalThis.fetch) {
  const headers = { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" };
  const call = async (method, path, body, prefer) => {
    const r = await fetchImpl(`${url}/rest/v1/${path}`, {
      method,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`REST ${method} ${path} → HTTP ${r.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
  return {
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body, "return=representation"),
    patch: (path, body) => call("PATCH", path, body, "return=representation"),
    del: (path) => call("DELETE", path, undefined, "return=representation"),
  };
}

const q = (s) => encodeURIComponent(s);

/** Tình trạng một SĐT: hạng, hạn, số chuỗi sống, số chuỗi do script cấp. */
export async function status(rest, phone) {
  const [c] = await rest.get(`customers?select=phone,tier,premium_until,name&phone=eq.${q(phone)}`);
  const tokens = await rest.get(`device_tokens?select=token_hash,device_id,platform,created_at&customer_phone=eq.${q(phone)}&revoked_at=is.null`);
  return { customer: c ?? null, live: tokens.length, mine: tokens.filter((t) => t.device_id === MARK) };
}

/**
 * Lập kế hoạch cấp (thuần, test được): từ tình trạng + cờ → việc phải làm hoặc lý do từ chối.
 * @param {{ customer: any, live: number }} st
 * @param {{ multi?: boolean, premiumDays?: number }} flags
 */
export function planCap(st, flags) {
  if (!st.customer) return { ok: false, reason: "SĐT không có trong bảng customers" };
  if (st.live > 0 && !flags.multi) {
    return { ok: false, reason: `đang có ${st.live} chuỗi sống (máy thật?) — luật 1 tài khoản 1 máy; muốn cấp thêm thì --multi` };
  }
  const tier = st.customer.tier === "premium" ? "premium" : "basic";
  const raise = !!flags.premiumDays && tier !== "premium";
  return { ok: true, origTier: tier, raise, allowMulti: !!flags.multi };
}

export async function cap(rest, phone, flags, out = console.log) {
  const st = await status(rest, phone);
  const plan = planCap(st, flags);
  if (!plan.ok) throw new Error(`Không cấp cho ${phone}: ${plan.reason}`);
  const { token, hash } = newToken();
  await rest.post("device_tokens", {
    token_hash: hash,
    customer_phone: phone,
    device_id: MARK,
    platform: `test:${plan.origTier}`,
    allow_multi: plan.allowMulti,
  });
  if (plan.raise) {
    const until = new Date(Date.now() + flags.premiumDays * 86400000).toISOString();
    await rest.patch(`customers?phone=eq.${q(phone)}`, { tier: "premium", premium_until: until });
    out(`↑ nâng ${phone} lên premium tạm tới ${until} (script sẽ trả về ${plan.origTier} khi 'thu')`);
  }
  out(`✓ đã cấp chuỗi cho ${phone} (${st.customer.name ?? ""})`);
  out(``);
  out(`  header:   x-sdfish-token: ${token}`);
  out(`  curl:     curl -H "x-sdfish-token: ${token}" https://forfish.vercel.app/api/fish-forecast`);
  out(`  trình duyệt (Console ở trang app, rồi mở /ngu-truong):`);
  out(`            localStorage.setItem('forfish.token.v1','${token}')`);
  out(``);
  out(`  Xong nhớ:  node scripts/test-account.mjs thu ${phone}`);
  return token;
}

export async function thu(rest, phone, out = console.log) {
  const st = await status(rest, phone);
  if (!st.customer) throw new Error(`${phone} không có trong customers`);
  let orig = null;
  for (const t of st.mine) {
    const m = /^test:(basic|premium)$/.exec(t.platform ?? "");
    if (m) orig = m[1];
  }
  const del = await rest.del(`device_tokens?customer_phone=eq.${q(phone)}&device_id=eq.${q(MARK)}`);
  out(`✓ xoá ${del.length} chuỗi do script cấp của ${phone} (chuỗi máy thật không đụng)`);
  if (orig === "basic" && st.customer.tier === "premium") {
    await rest.patch(`customers?phone=eq.${q(phone)}`, { tier: "basic", premium_until: null });
    out(`↓ trả ${phone} về basic`);
  }
}

export async function ds(rest, accounts, out = console.log) {
  out(`${"SĐT".padEnd(12)}${"hạng gốc".padEnd(10)}${"hạng DB".padEnd(10)}${"hạn premium".padEnd(22)}${"chuỗi sống".padEnd(12)}tên`);
  for (const a of accounts) {
    const st = await status(rest, a.phone);
    const c = st.customer;
    out(
      `${a.phone.padEnd(12)}${a.tier.padEnd(10)}${(c?.tier ?? "—").padEnd(10)}${(c?.premium_until ?? "").slice(0, 19).padEnd(22)}${String(st.live).padEnd(3)}${st.mine.length ? `(${st.mine.length} của script)` : ""}`.padEnd(66) + (c?.name ?? "(không có trong DB)"),
    );
  }
}

const isMain = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, arg, ...rest] = process.argv.slice(2);
  const flags = { multi: rest.includes("--multi") || arg === "--multi", premiumDays: 0 };
  const pi = rest.indexOf("--premium");
  if (pi >= 0) flags.premiumDays = Number(rest[pi + 1] ?? 1) || 1;
  try {
    const accounts = loadTestAccounts();
    const restApi = makeRest(loadEnv());
    const allowed = (p) => accounts.some((a) => a.phone === p);
    if (cmd === "ds") await ds(restApi, accounts);
    else if (cmd === "cap") {
      if (!allowed(arg)) throw new Error(`${arg} KHÔNG nằm trong scripts/test-accounts.json — thêm vào đó trước (khoanh vùng tài khoản test).`);
      await cap(restApi, arg, flags);
    } else if (cmd === "thu") {
      const list = arg === "--all" ? accounts.map((a) => a.phone) : [arg];
      for (const p of list) {
        if (!allowed(p)) throw new Error(`${p} không nằm trong scripts/test-accounts.json`);
        await thu(restApi, p);
      }
    } else {
      console.log("Dùng: node scripts/test-account.mjs ds | cap <sđt> [--premium N] [--multi] | thu <sđt>|--all");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
