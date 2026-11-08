#!/usr/bin/env node
// MÁY THU TÀU AIS — chạy trên gpu-desktop theo timer systemd (ops/runbook.md › "Tàu xung quanh").
//
// Cách lấy: mở web nguồn bằng Chromium THẬT có màn hình (xvfb-run) — hồ sơ trình duyệt giữ ở
// TAU_AIS_PROFILE để cookie (kể cả cookie đăng nhập) sống qua các lượt. Trong trang đó gọi đúng
// các URL ô dữ liệu mà bản đồ của họ gọi (getData/get_data_json_4/z:8/X:/Y:) — không API trả phí.
// Chạy headless hay hồ sơ "dính" lượt headless ⇒ Cloudflare 403 "Attention Required" (đo 2026-10-26);
// gặp 403 thì dừng lượt, lượt sau tự xoá hồ sơ làm lại (HO_SO_HONG).
//
// Đầu ra: POST ${TAU_AIS_API_BASE}/api/tau-ais/nhap, header x-tau-ais-key, thân NÉN gzip. Gói { luc, tau[] } đã
// chuẩn hoá bằng lib/tau-ais/chuan-hoa.mjs (máy chủ kiểm lại cùng hàm). Vùng quét: VUNG_QUET (cả Biển Đông, ~99 ô).
//
// Env (~/.config/forlife/tau-ais.env, hoặc env process): TAU_AIS_KEY · TAU_AIS_API_BASE (https) ·
// TAU_AIS_PROFILE (mặc định ~/.local/forlife/tau-ais/profile) · MT_EMAIL + MT_PASSWORD (TUỲ CHỌN:
// có thì đăng nhập một lần, thiếu thì đi khách — khách vẫn thấy đủ tàu ở z:8) · TAU_AIS_STATE_DIR ·
// TAU_AIS_LUU_DIR (kho vĩnh viễn, mặc định <state>/luu: MỌI lượt ~10 phút một bản (từ 08/11; trước đó mỗi giờ một bản), tệp ngày YYYY-MM/YYYY-MM-DD.ndjson.gz;
// kho chi tiết tàu MMSI/IMO… ở <luu>/chi-tiet/tau.ndjson — xem phần "CHI TIẾT TÀU" dưới).
// Cờ: --thu (không gửi, in số tàu, tra chi tiết 5 tàu) · --anh (chụp màn hình vào state dir để soi khi hỏng).

import path from "node:path";
import { homedir } from "node:os";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { chiTietTuDoc, chonTauCanTra, chuanHoaHang, danhSachO, gopHangTho, gopTau, khoaGioLuu, kiemGoi } from "../src/lib/tau-ais/chuan-hoa.mjs";

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
/* CHI TIẾT TÀU (2026-10-30): mỗi lượt tra thêm tối đa CHI_TIET_MOI_LUOT tàu (2 lời gọi/tàu, nghỉ giữa lời gọi), dừng sớm khi
   hết CHI_TIET_TOI_DA_MS để lượt 10 phút không chồng lượt sau. ~30 nghìn tàu ⇒ lần đầu ~1 ngày, sau chỉ tàu mới. Bị
   403/429 ⇒ nghỉ tra CHI_TIET_NGHI_MS (không xoá hồ sơ — quét ô vẫn chạy). */
const CHI_TIET_MOI_LUOT = 250;
const CHI_TIET_TOI_DA_MS = 5 * 60_000;
const NGHI_GIUA_TRA_MS = 450;
const CHI_TIET_NGHI_MS = 60 * 60_000;

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
    // kho vĩnh viễn mỗi lượt một bản (tệp ngày theo khoaGioLuu) — đặt TAU_AIS_LUU_DIR nếu muốn để ổ khác
    luuDir: get("TAU_AIS_LUU_DIR") || path.join(stateDir, "luu"),
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
  /*  CHI TIẾT TÀU — kho NỐI ĐUÔI `chi-tiet/tau.ndjson`, mỗi dòng { id, luc, general, info } (NGUYÊN JSON của nguồn) hoặc
      { id, luc, loi }. Dòng sau đè dòng trước cùng id. Lỗi đọc/ghi kho chỉ log — không làm hỏng lượt quét/gửi. */
  const tepChiTiet = path.join(c.luuDir, "chi-tiet", "tau.ndjson");
  const kho = new Map(); // id ⇒ { luc, loi?, mmsi, imo, hh }
  try {
    if (existsSync(tepChiTiet)) {
      for (const dong of readFileSync(tepChiTiet, "utf8").split("\n")) {
        if (!dong) continue;
        try {
          const d = JSON.parse(dong);
          if (d?.id) kho.set(String(d.id), { luc: d.luc, loi: d.loi ?? null, ...chiTietTuDoc(d.general, d.info) });
        } catch {
          /* dòng hỏng (mất điện giữa lúc ghi) — bỏ, tàu đó sẽ được tra lại */
        }
      }
    }
  } catch (e) {
    log("[tàu AIS] đọc kho chi tiết hỏng:", String(e?.message ?? e).slice(0, 200));
  }
  const nghiDen = Date.parse(so.chiTietNghiDen ?? "");
  if (!(nghiDen > Date.now())) {
    // --thu chỉ tra 5 tàu để soi đường tra (vẫn ghi kho — dữ liệu thật)
    const canTra = chonTauCanTra(gopTau(tho.map(chuanHoaHang)), kho, Date.now(), thu ? 5 : CHI_TIET_MOI_LUOT);
    const t1 = Date.now();
    let duoc = 0;
    let loi = 0;
    try {
      mkdirSync(path.dirname(tepChiTiet), { recursive: true });
      for (const id of canTra) {
        if (Date.now() - t1 > CHI_TIET_TOI_DA_MS) break;
        const r = await page.evaluate(
          async ({ id, ms }) => {
            const lay = async (u) => {
              try {
                const res = await fetch(u, { headers: { "x-requested-with": "XMLHttpRequest", accept: "application/json" }, signal: AbortSignal.timeout(ms) });
                if (!res.ok) return { s: res.status, j: null };
                return { s: 200, j: await res.json().catch(() => null) };
              } catch {
                return { s: 0, j: null };
              }
            };
            const g = await lay(`/en/vessels/${id}/general`);
            if (g.s === 403 || g.s === 429) return { s: g.s };
            await new Promise((ok) => setTimeout(ok, 250));
            const v = await lay(`/vesselDetails/vesselInfo/shipid:${id}`);
            return { s: g.s === 200 || v.s === 200 ? 200 : v.s || g.s, general: g.j, info: v.j, chan: v.s === 403 || v.s === 429 };
          },
          { id, ms: HET_GIO_O_MS },
        );
        if (r.s === 403 || r.s === 429 || r.chan) {
          so.chiTietNghiDen = new Date(Date.now() + CHI_TIET_NGHI_MS).toISOString();
          log(`[tàu AIS] tra chi tiết bị chặn (${r.s}) — nghỉ tới ${so.chiTietNghiDen}`);
          break;
        }
        const luc = new Date().toISOString();
        const ban = r.s === 200 && (r.general || r.info) ? { id, luc, general: r.general, info: r.info } : { id, luc, loi: r.s || "khong_tra_duoc" };
        appendFileSync(tepChiTiet, `${JSON.stringify(ban)}\n`);
        kho.set(id, { luc, loi: ban.loi ?? null, ...chiTietTuDoc(ban.general, ban.info) });
        if (ban.loi) loi++;
        else duoc++;
        await page.waitForTimeout(NGHI_GIUA_TRA_MS);
      }
    } catch (e) {
      log("[tàu AIS] tra chi tiết hỏng (bỏ qua):", String(e?.message ?? e).slice(0, 200));
    }
    const coMmsi = [...kho.values()].filter((k) => k.mmsi).length;
    log(`[tàu AIS] chi tiết: tra ${duoc} được, ${loi} hỏng · ${Math.round((Date.now() - t1) / 1000)} s · kho ${kho.size} tàu (${coMmsi} có MMSI) · còn ${Math.max(0, canTra.length - duoc - loi)}+ chờ`);
  }
  // ghép MMSI/IMO/hô hiệu vào hàng thô ⇒ cả bản gửi lẫn kho giờ đều mang
  const thoDu = gopHangTho(tho, kho);

  // kiemGoi = đúng bộ lọc máy chủ (tin ≤4 giờ, trong vùng) — lọc ở đây để không gửi thừa
  const kiem = kiemGoi({ luc: new Date().toISOString(), tau: gopTau(thoDu.map(chuanHoaHang)) });
  const tau = kiem.ok ? kiem.ban.tau : [];
  const soCa = tau.filter((t) => t.loai === 2).length;
  log(`[tàu AIS] ${o.length} ô (${hong} hỏng) · ${tho.length} hàng ⇒ ${tau.length} tàu (cá ${soCa}) · ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!tau.length) throw new Error("không có tàu nào — nguồn đổi định dạng?");
  const goi = { luc: new Date().toISOString(), tau };
  /*  KHO VĨNH VIỄN (2026-10-29): bản đầu tiên của mỗi giờ VN ⇒ nối một khối gzip vào tệp ngày. Ghi TRƯỚC khi gửi —
      máy chủ hỏng vẫn có dữ liệu học. Lỗi ghi đĩa chỉ log, không làm hỏng lượt gửi.
      BẢN 2 (2026-10-30, "lưu đủ"): dòng { v: 2, luc, soTau, tho[] } — `tho` = hàng NGUYÊN của nguồn (mọi trường, kể cả
      tàu vệ tinh và tin cũ hơn 4 giờ) + MMSI/IMO/CALLSIGN đã ghép; bản gọn suy lại được bằng chuanHoaHang. Dòng không có
      `v` là bản 1 (29–30/10): { luc, soTau, tau[] } đã gọn. */
  /*  BẢN 3 (2026-11-08, anh Long: "lưu lại thì mới so khớp đúng theo mốc của vms đc chứ, lưu luôn đi"): lưu MỌI lượt
      (~10 phút), không chỉ bản đầu mỗi giờ — so vị trí AIS ↔ VMS theo đúng mốc điểm VMS. ~6 MB nén/giờ ⇒ ~55 GB/năm. */
  const kg = khoaGioLuu(goi.luc);
  if (!thu && kg) {
    try {
      const tep = path.join(c.luuDir, kg.tep);
      mkdirSync(path.dirname(tep), { recursive: true });
      appendFileSync(tep, gzipSync(`${JSON.stringify({ v: 2, luc: goi.luc, soTau: thoDu.length, tho: thoDu })}\n`));
      so.gioLuu = kg.gio;
      log(`[tàu AIS] đã lưu kho ${kg.tep} (giờ ${kg.gio})`);
    } catch (e) {
      log("[tàu AIS] lưu kho hỏng:", String(e?.message ?? e).slice(0, 200));
    }
  }
  if (thu) {
    const chuoi = JSON.stringify(goi);
    log(`[tàu AIS] --thu: không gửi. Bản ${Math.round(chuoi.length / 1024)} KB (gzip ${Math.round(gzipSync(chuoi).length / 1024)} KB). 3 tàu đầu:`, JSON.stringify(tau.slice(0, 3)));
    ketQua = { ok: true, soTau: tau.length, loi: null, hoSoHong: false };
  } else {
    // NÉN gzip (2026-10-29): vùng quét cả Biển Đông ~25–30 nghìn tàu ⇒ bản thô vượt trần 4,5 MB thân request của Vercel
    const res = await fetch(`${c.base}/api/tau-ais/nhap`, {
      method: "POST",
      headers: { "x-tau-ais-key": c.key, "content-type": "application/json", "content-encoding": "gzip" },
      body: gzipSync(JSON.stringify(goi)),
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
