// KAIROS — PHẦN CHUNG CÓ TÁC DỤNG PHỤ của hai việc chạy trên gpu-desktop:
//   scripts/kairos-thu.mjs  (thu tin báo, 15 phút/lần)  ·  scripts/kairos-kiem.mjs (kiểm duyệt, 5 phút/lần)
// Đọc env NGOÀI repo, gọi `claude -p` (gói Claude của anh Long, KHÔNG API key), gọi API có đồng
// hồ, ghi file trạng thái nguyên tử. Phần thuần nằm ở src/lib/kairos/thu-core.mjs (có test).
//
// Khuôn gọi CLI chép tối thiểu từ AI-Assistant/train/thay/opus.mjs (goiCli): cấm mọi công cụ,
// thư mục làm việc RỖNG 0700, prompt qua stdin, --max-turns 1, đồng hồ SIGTERM ⇒ SIGKILL.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { cliArgs, docKetQuaCli } from "../src/lib/kairos/thu-core.mjs";

export const MODEL_MAC_DINH = "claude-haiku-5-5";
/** CLI cũ không nhận id đầy đủ ⇒ lùi về bí danh. */
export const MODEL_LUI = "haiku";

/** Đọc tệp env kiểu KEY=VALUE (bỏ dòng trống/#, bỏ nháy bọc). Không có tệp ⇒ {}. */
export function docTepEnv(file) {
  if (!file || !existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/**
 * Cấu hình: env của tiến trình ĐÈ tệp env (mặc định ~/.config/forlife/kairos.env — ngoài repo,
 * chmod 600). Không có khoá trong code.
 */
export function cauHinh(env = process.env) {
  const file = env.KAIROS_ENV_FILE || path.join(homedir(), ".config", "forlife", "kairos.env");
  const f = docTepEnv(file);
  const get = (k) => (env[k] ?? f[k] ?? "").trim();
  const base = get("KAIROS_API_BASE").replace(/\/+$/, "");
  return {
    envFile: file,
    key: get("KAIROS_INGEST_KEY"),
    base,
    stateDir: get("KAIROS_STATE_DIR") || path.join(homedir(), ".local", "forlife", "kairos"),
    model: get("KAIROS_MODEL") || MODEL_MAC_DINH,
    claudeBin: get("CLAUDE_BIN"),
  };
}

/** Kiểm cấu hình trước khi chạy thật — thiếu thì nói rõ thiếu gì, không đoán. */
export function canCauHinh(c) {
  const thieu = [];
  if (!c.key) thieu.push("KAIROS_INGEST_KEY");
  if (!c.base) thieu.push("KAIROS_API_BASE");
  else if (!/^https:\/\//.test(c.base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.base)) thieu.push("KAIROS_API_BASE (phải https)");
  return thieu;
}

export function timClaude(c) {
  const ds = [c.claudeBin, path.join(homedir(), ".local", "bin", "claude"), path.join(homedir(), ".local", "forlife", "claude", "node_modules", ".bin", "claude")].filter(Boolean);
  return ds.find((p) => existsSync(p)) || null;
}

/** Thư mục làm việc RỖNG cho claude -p (0700). Có gì lạ trong đó ⇒ dùng thư mục con mới. */
function thuMucRong(stateDir, ten) {
  const d = path.join(stateDir, "cwd", ten);
  mkdirSync(d, { recursive: true, mode: 0o700 });
  return readdirSync(d).length === 0 ? d : (() => {
    const d2 = path.join(stateDir, "cwd", `${ten}-${Date.now()}`);
    mkdirSync(d2, { recursive: true, mode: 0o700 });
    return d2;
  })();
}

function goiCliMotLan({ bin, prompt, model, timeoutMs, cwd }) {
  return new Promise((resolve) => {
    const child = spawn(bin, cliArgs(model), {
      cwd,
      env: { ...process.env, CI: "1", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", errOut = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (errOut += c).length > 4000 && (errOut = errOut.slice(-4000)));
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, timeoutMs);
    child.on("error", () => (clearTimeout(t), resolve({ ok: false, dung: "loi", chiTiet: "khong_chay_duoc_cli" })));
    child.on("close", (_code, sig) => {
      clearTimeout(t);
      if (sig) return resolve({ ok: false, dung: "loi", chiTiet: "het_gio" });
      resolve(docKetQuaCli(out.trim() || errOut));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

/**
 * Gọi `claude -p` một lần; CLI báo model lạ ⇒ thử lại MỘT lần bằng bí danh `haiku`.
 * @returns {Promise<{ok: true, text: string, model: string} | {ok: false, dung: string, chiTiet?: string}>}
 */
export async function goiClaude(c, { prompt, timeoutMs = 120_000, ten = "goi" }) {
  const bin = timClaude(c);
  if (!bin) return { ok: false, dung: "loi", chiTiet: "khong_co_cli" };
  const cwd = thuMucRong(c.stateDir, ten);
  let r = await goiCliMotLan({ bin, prompt, model: c.model, timeoutMs, cwd });
  if (!r.ok && r.dung === "model_khong_ho_tro" && c.model !== MODEL_LUI) {
    r = await goiCliMotLan({ bin, prompt, model: MODEL_LUI, timeoutMs, cwd });
    return r.ok ? { ...r, model: MODEL_LUI } : r;
  }
  return r.ok ? { ...r, model: c.model } : r;
}

/** Gọi API Kairos có khoá + đồng hồ. Không ném: trả { ok, status, json } hoặc { ok:false, status:0, error }. */
export async function goiApi(c, pathname, { method = "GET", body, timeoutMs = 30_000 } = {}) {
  try {
    const r = await fetch(`${c.base}${pathname}`, {
      method,
      headers: { "x-kairos-key": c.key, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await r.json().catch(() => null);
    return { ok: r.ok && json?.ok === true, status: r.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: null, error: e?.name === "TimeoutError" ? "het_gio" : String(e?.message ?? e).slice(0, 200) };
  }
}

/** Đọc JSON trạng thái; hỏng/không có ⇒ `macDinh`. */
export function docJson(file, macDinh) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return macDinh;
  }
}

/** Ghi nguyên tử (tệp tạm + rename) — mất điện giữa chừng không để lại sổ nửa vời. */
export function ghiJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  renameSync(tmp, file);
}

export const log = (...a) => console.log(new Date().toISOString(), ...a);
