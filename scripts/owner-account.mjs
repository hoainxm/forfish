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

const WEAK = ["password", "matkhau", "123456", "qwerty", "sdvico", "sdfish", "forfish"];

/**
 * Luật mật khẩu admin tổng (thuần, có test). Trả MỌI lý do chưa đạt (rỗng = đạt)
 * để người gõ sửa một lần là xong, không phải đoán từng lượt.
 *
 * NỚI 2026-10-02 (chủ dự án gõ mãi không đạt): bỏ luật "3/4 loại ký tự".
 * Còn lại đúng thứ hay bị dò: đủ dài (≥12), không chứa tên đăng nhập / chuỗi
 * phổ biến, không lặp một hai ký tự, có cả chữ lẫn số (hoặc ≥16 ký tự).
 * Ký tự tiếng Việt có dấu bị chặn: bộ gõ Telex/Unikey biến "aa"→"â" lúc gõ ẩn,
 * nên lần sau gõ ở trình duyệt (bộ gõ tắt/bật khác) sẽ không khớp.
 */
export function ownerPasswordProblems(pw, login) {
  const out = [];
  if (typeof pw !== "string" || pw.length === 0) return ["chưa gõ gì"];
  if (/[^\x20-\x7e]/.test(pw))
    out.push("có ký tự tiếng Việt có dấu / ký tự lạ — TẮT bộ gõ tiếng Việt (Unikey/Telex) rồi gõ lại");
  if (pw.length < OWNER_PASSWORD_MIN) out.push(`mới ${pw.length} ký tự, cần tối thiểu ${OWNER_PASSWORD_MIN}`);
  const low = pw.toLowerCase();
  if (login && low.includes(login)) out.push(`không được chứa tên đăng nhập "${login}"`);
  const weak = WEAK.find((w) => low.includes(w));
  if (weak) out.push(`chứa chuỗi quá dễ đoán "${weak}"`);
  if (new Set(pw).size < 5) out.push("lặp quá ít ký tự khác nhau");
  if (pw.length < 16 && !(/[A-Za-z]/.test(pw) && /\d/.test(pw)))
    out.push("cần có cả chữ lẫn số (hoặc dài từ 16 ký tự)");
  return out;
}

/** Giữ tên cũ cho chỗ gọi cũ: lý do đầu tiên hoặc null. */
export function ownerPasswordProblem(pw, login) {
  return ownerPasswordProblems(pw, login)[0] ?? null;
}

/**
 * Xử lý một cục dữ liệu bàn phím (thuần, có test). Một cục có thể chứa NHIỀU
 * ký tự (gõ nhanh, dán) — bản đầu coi cả cục là một ký tự nên "abc\r" không
 * bao giờ khớp Enter và lệnh treo. Bỏ qua phím mũi tên / phím chức năng (ESC…).
 * Trả { buf, done, cancel, echo } — echo = chuỗi cần in ra màn hình ("•" cho
 * mỗi ký tự thêm, "\b \b" cho mỗi ký tự xoá), đúng thứ tự gõ.
 */
export function feedKeys(buf, chunk) {
  let echo = "";
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    if (ch === "\r" || ch === "\n" || ch === "\u0004") return { buf, done: true, cancel: false, echo };
    if (ch === "\u0003") return { buf, done: false, cancel: true, echo };
    if (ch === "\u007f" || ch === "\b") {
      if (buf.length > 0) {
        buf = buf.slice(0, -1);
        echo += "\b \b";
      }
      continue;
    }
    if (ch === "\u001b") {
      // ESC [ … chữ cái  → bỏ cả chuỗi điều khiển
      while (i + 1 < chunk.length && !/[A-Za-z~]/.test(chunk[i + 1])) i++;
      i++;
      continue;
    }
    if (ch < " ") continue;
    buf += ch;
    echo += "•";
  }
  return { buf, done: false, cancel: false, echo };
}

/* Đọc dòng cho stdin không-TTY: MỘT người nghe sống suốt lệnh, giữ phần thừa
   giữa các lần hỏi (dán/pipe cả mấy dòng một lúc thì lần hỏi sau vẫn có). */
let lineBuf = "";
let lineWaiters = [];
let lineEnded = false;
let lineListening = false;
function nextLine() {
  const { stdin } = process;
  if (!lineListening) {
    lineListening = true;
    stdin.setEncoding("utf8");
    stdin.on("data", (c) => {
      lineBuf += c;
      flushLines();
    });
    stdin.on("end", () => {
      lineEnded = true;
      flushLines();
    });
  }
  return new Promise((resolve) => {
    lineWaiters.push(resolve);
    flushLines();
  });
}
function flushLines() {
  while (lineWaiters.length > 0) {
    const nl = lineBuf.search(/\r?\n/);
    if (nl >= 0) {
      const line = lineBuf.slice(0, nl);
      lineBuf = lineBuf.slice(nl + (lineBuf[nl] === "\r" ? 2 : 1));
      lineWaiters.shift()(line);
    } else if (lineEnded) {
      const rest = lineBuf;
      lineBuf = "";
      lineWaiters.shift()(rest);
    } else return;
  }
}

/** Hỏi mật khẩu: hiện "•" mỗi ký tự (biết là đang gõ được), không hiện chữ thật. */
function askHidden(question) {
  return new Promise((done) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {
      // Terminal không phải TTY (một số khung terminal của IDE/app): đọc từng
      // DÒNG — chữ CÓ THỂ hiện ra, nên dọn màn hình sau khi xong.
      stdout.write("(terminal này không ẩn được chữ) ");
      nextLine().then((line) => {
        stdout.write("\n");
        done(line);
      });
      return;
    }
    let buf = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      const r = feedKeys(buf, chunk);
      buf = r.buf;
      if (r.echo) stdout.write(r.echo);
      if (r.cancel) {
        stdin.setRawMode(false);
        stdout.write("\n");
        process.exit(130);
      }
      if (r.done) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write(`  (${buf.length} ký tự)\n`);
        done(buf);
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
    console.log(`Mật khẩu: tối thiểu ${OWNER_PASSWORD_MIN} ký tự, có cả chữ lẫn số, không chứa "${login}" / 123456 / sdvico.`);
    console.log("Mẹo: TẮT bộ gõ tiếng Việt trước khi gõ. Mỗi ký tự hiện một dấu •. Dạng dễ nhớ: vài từ không dấu viết liền + năm, vd <TenTau><Nam><2 chu>");
    let pw = null;
    for (let lan = 1; lan <= 3 && pw === null; lan++) {
      const a = await askHidden(`Mật khẩu mới (lần ${lan}/3): `);
      const problems = ownerPasswordProblems(a, login);
      if (problems.length > 0) {
        console.log("✗ Chưa đạt:");
        for (const p of problems) console.log(`   - ${p}`);
        continue;
      }
      const b2 = await askHidden("Gõ lại để chắc chắn: ");
      if (b2 !== a) {
        console.log(`✗ Hai lần gõ không khớp (${a.length} và ${b2.length} ký tự) — gõ lại từ đầu.`);
        continue;
      }
      pw = a;
    }
    if (pw === null) throw new Error("Dừng sau 3 lần chưa đạt — chạy lại lệnh khi sẵn sàng.");
    const r = await setupOwner({ auth: makeAuth(env), rest: makeRest(env), login, password: pw });
    console.log(r === "created" ? "✓ Đã TẠO admin tổng." : "✓ Đã ĐỔI mật khẩu admin tổng (mọi máy đang đăng nhập đã bị đăng xuất).");
    console.log(`Nhớ: env OWNER_LOGIN=${login} trên Vercel rồi deploy; đăng nhập /quan-tri bằng tên "${login}".`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
