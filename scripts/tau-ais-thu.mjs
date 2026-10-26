#!/usr/bin/env node
// MÁY THU TÀU AIS — chạy trên gpu-desktop theo timer systemd (ops/runbook.md › "Tàu xung quanh").
//
// Cách lấy: mở web nguồn bằng Chromium THẬT có màn hình (xvfb-run) — hồ sơ trình duyệt giữ ở
// TAU_AIS_PROFILE để cookie (kể cả cookie đăng nhập) sống qua các lượt. Trong trang đó gọi đúng
// các URL ô dữ liệu mà bản đồ của họ gọi (getData/get_data_json_4/z:8/X:/Y:) — không API trả phí.
// Chạy headless hay hồ sơ "dính" lượt headless ⇒ Cloudflare 403 "Attention Required" (đo 2026-10-26);
// gặp 403 thì dừng lượt, lượt sau tự xoá hồ sơ làm lại (HO_SO_HONG).
//
// Đầu ra: POST ${TAU_AIS_API_BASE}/api/tau-ais/nhap, header x-tau-ais-key. Gói { luc, tau[] } đã
// chuẩn hoá bằng lib/tau-ais/chuan-hoa.mjs (máy chủ kiểm lại cùng hàm).
//
// Env (~/.config/forlife/tau-ais.env, hoặc env process): TAU_AIS_KEY · TAU_AIS_API_BASE (https) ·
// TAU_AIS_PROFILE (mặc định ~/.local/forlife/tau-ais/profile) · MT_EMAIL + MT_PASSWORD (TUỲ CHỌN:
// có thì đăng nhập một lần, thiếu thì đi khách — khách vẫn thấy đủ tàu ở z:8) · TAU_AIS_STATE_DIR.
// Cờ: --thu (không gửi, in số tàu) · --anh (chụp màn hình vào state dir để soi khi hỏng).

import path from "node:path";
import { homedir } from "node:os";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { chuanHoaHang, danhSachO, gopTau, kiemGoi } from "../src/lib/tau-ais/chuan-hoa.mjs";

// Tiện ích nhỏ chép từ kairos-chung.mjs (không import để bản chạy chỉ cần 2 tệp — lam-moi.sh).
const log = (...a) => console.log(new Date().toISOString(), ...a);
function docTepEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch {
    /* không có tệp env ⇒ chỉ dùng env process */
  }
  return out;
}
function docJson(file, macDinh) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return macDinh;
  }
}
function ghiJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}

const NGUON = "https://www.marinetraffic.com";
const TRANG_MO = `${NGUON}/en/ais/home/centerx:112.0/centery:14.0/zoom:7`;
const TRANG_DANG_NHAP = `${NGUON}/en/users/login`;
const CHO_TRANG_MS = 9_000;
const NGHI_GIUA_O_MS = 350;
const HET_GIO_O_MS = 20_000;
const HET_GIO_GUI_MS = 60_000;

const argv = process.argv.slice(2);
const thu = argv.includes("--thu") || argv.includes("--dry");
const chupAnh = argv.includes("--anh");

function cauHinh(env = process.env) {
  const file = env.TAU_AIS_ENV_FILE || path.join(homedir(), ".config", "forlife", "tau-ais.env");
  const f = docTepEnv(file);
  const get = (k) => (env[k] ?? f[k] ?? "").trim();
  const stateDir = get("TAU_AIS_STATE_DIR") || path.join(homedir(), ".local", "forlife", "tau-ais");
  return {
    envFile: file,
    key: get("TAU_AIS_KEY"),
    base: get("TAU_AIS_API_BASE").replace(/\/+$/, ""),
    profile: get("TAU_AIS_PROFILE") || path.join(stateDir, "profile"),
    stateDir,
    email: get("MT_EMAIL"),
    password: get("MT_PASSWORD"),
  };
}

const c = cauHinh();
const thieu = [];
if (!thu && !c.key) thieu.push("TAU_AIS_KEY");
// http chỉ khi kiểm tay tới máy dev trong mạng riêng (TAU_AIS_CHO_PHEP_HTTP=1)
if (!thu && !/^https:\/\//.test(c.base) && !(process.env.TAU_AIS_CHO_PHEP_HTTP === "1" && /^http:\/\//.test(c.base))) thieu.push("TAU_AIS_API_BASE (https)");
if (thieu.length) {
  log(`[tàu AIS] thiếu cấu hình ở ${c.envFile}: ${thieu.join(", ")}`);
  process.exit(2);
}
mkdirSync(c.stateDir, { recursive: true });
const SO = path.join(c.stateDir, "lan-cuoi.json");
const so = docJson(SO, {});
if (so.hoSoHong) {
  log("[tàu AIS] lượt trước bị chặn 403 — xoá hồ sơ trình duyệt, mở lại từ đầu");
  rmSync(c.profile, { recursive: true, force: true });
}

const ctx = await chromium.launchPersistentContext(c.profile, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
  timezoneId: "Asia/Ho_Chi_Minh",
  args: ["--disable-blink-features=AutomationControlled"],
});
let ketQua = { ok: false, soTau: 0, loi: null, hoSoHong: false };
try {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(TRANG_MO, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(CHO_TRANG_MS);
  const tieuDe = await page.title();
  if (/attention required|cloudflare/i.test(tieuDe)) throw Object.assign(new Error("bị chặn 403 ngay trang chủ"), { hoSoHong: true });
  if (chupAnh) await page.screenshot({ path: path.join(c.stateDir, "man-hinh.png") });

  // Đăng nhập một lần nếu có tài khoản và trang chưa nhận mình. Lối vào theo trang login hiện tại
  // (2026-10-26, chưa kiểm vì chưa có tài khoản) — hỏng thì chỉ log, vẫn quét kiểu khách.
  if (c.email && c.password && !so.daDangNhap) {
    try {
      await page.goto(TRANG_DANG_NHAP, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(3_000);
      await page.fill('input[type="email"], input[name="email"]', c.email, { timeout: 10_000 });
      await page.fill('input[type="password"]', c.password, { timeout: 10_000 });
      await page.keyboard.press("Enter");
      await page.waitForTimeout(6_000);
      const u = await page.evaluate(async () => {
        const r = await fetch("/en/ajax_user_settings/get_user_data", { headers: { "x-requested-with": "XMLHttpRequest" } });
        return r.ok ? await r.text() : "";
      });
      so.daDangNhap = /"id"\s*:\s*\d+|user_id|username/.test(u) && !/guest/i.test(u);
      log(`[tàu AIS] đăng nhập: ${so.daDangNhap ? "được" : "không rõ — quét kiểu khách"}`);
      await page.goto(TRANG_MO, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(CHO_TRANG_MS);
    } catch (e) {
      log("[tàu AIS] đăng nhập hỏng (bỏ qua, quét kiểu khách):", String(e?.message ?? e).slice(0, 160));
    }
  }

  const o = danhSachO();
  const tho = [];
  let hong = 0;
  const t0 = Date.now();
  for (const { z, x, y } of o) {
    const r = await page.evaluate(
      async ({ z, x, y, ms }) => {
        try {
          const res = await fetch(`/getData/get_data_json_4/z:${z}/X:${x}/Y:${y}/station:0`, {
            headers: { "x-requested-with": "XMLHttpRequest" },
            signal: AbortSignal.timeout(ms),
          });
          if (!res.ok) return { status: res.status, rows: null };
          const j = await res.json();
          return { status: 200, rows: Array.isArray(j?.data?.rows) ? j.data.rows : [] };
        } catch (e) {
          return { status: 0, rows: null, loi: String(e?.message ?? e).slice(0, 100) };
        }
      },
      { z, x, y, ms: HET_GIO_O_MS },
    );
    if (r.status === 403) throw Object.assign(new Error(`ô ${x}/${y} bị chặn 403`), { hoSoHong: true });
    if (!r.rows) {
      hong++;
      if (hong > 8) throw new Error(`quá nhiều ô hỏng (${hong}), ô cuối ${x}/${y}: ${r.status} ${r.loi ?? ""}`);
    } else {
      for (const h of r.rows) tho.push(h);
    }
    await page.waitForTimeout(NGHI_GIUA_O_MS);
  }
  // kiemGoi = đúng bộ lọc máy chủ (tin ≤4 giờ, trong vùng) — lọc ở đây để không gửi thừa
  const kiem = kiemGoi({ luc: new Date().toISOString(), tau: gopTau(tho.map(chuanHoaHang)) });
  const tau = kiem.ok ? kiem.ban.tau : [];
  const soCa = tau.filter((t) => t.loai === 2).length;
  log(`[tàu AIS] ${o.length} ô (${hong} hỏng) · ${tho.length} hàng ⇒ ${tau.length} tàu (cá ${soCa}) · ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!tau.length) throw new Error("không có tàu nào — nguồn đổi định dạng?");
  const goi = { luc: new Date().toISOString(), tau };
  if (thu) {
    const chuoi = JSON.stringify(goi);
    log(`[tàu AIS] --thu: không gửi. Bản ${Math.round(chuoi.length / 1024)} KB (gzip ${Math.round(gzipSync(chuoi).length / 1024)} KB). 3 tàu đầu:`, JSON.stringify(tau.slice(0, 3)));
    ketQua = { ok: true, soTau: tau.length, loi: null, hoSoHong: false };
  } else {
    const res = await fetch(`${c.base}/api/tau-ais/nhap`, {
      method: "POST",
      headers: { "x-tau-ais-key": c.key, "content-type": "application/json" },
      body: JSON.stringify(goi),
      signal: AbortSignal.timeout(HET_GIO_GUI_MS),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) throw new Error(`gửi hỏng: HTTP ${res.status} ${j?.code ?? ""}`);
    log(`[tàu AIS] đã gửi ${j.soTau} tàu`);
    ketQua = { ok: true, soTau: j.soTau, loi: null, hoSoHong: false };
  }
} catch (e) {
  ketQua = { ok: false, soTau: 0, loi: String(e?.message ?? e).slice(0, 300), hoSoHong: !!e?.hoSoHong };
  log("[tàu AIS] hỏng:", ketQua.loi);
} finally {
  await ctx.close().catch(() => {});
}
ghiJson(SO, { ...so, luc: new Date().toISOString(), ...ketQua, daDangNhap: !!so.daDangNhap && !ketQua.hoSoHong });
process.exit(ketQua.ok ? 0 : 1);
